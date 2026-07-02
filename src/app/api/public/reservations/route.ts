import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoMode, DEMO_ROOMS, DEMO_RESERVATIONS, DEMO_ROOM_RATES, DEMO_CUSTOMERS, DEMO_HOTEL_ID } from '@/lib/demo-data'
import { calculateDynamicPrice } from '@/lib/pricing'

/**
 * POST /api/public/reservations
 * Crée une demande de réservation publique (sans authentification).
 * Crée un client si inexistant, valide la disponibilité, et retourne un code de confirmation.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      hotel_id,
      room_id,
      check_in_date,
      check_out_date,
      first_name,
      last_name,
      phone,
      email,
      guests,
      special_requests,
    } = body

    // ─── Validation des champs requis ──────────────────────────
    if (!hotel_id || !room_id || !check_in_date || !check_out_date || !first_name || !last_name || !phone) {
      return NextResponse.json(
        { error: 'hotel_id, room_id, dates, prénom, nom et téléphone sont requis' },
        { status: 400 }
      )
    }

    // ─── Validation du format de date ──────────────────────────
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(check_in_date) || !dateRegex.test(check_out_date)) {
      return NextResponse.json(
        { error: 'Format de date invalide. Utilisez YYYY-MM-DD' },
        { status: 400 }
      )
    }

    const checkIn = new Date(check_in_date)
    const checkOut = new Date(check_out_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return NextResponse.json({ error: 'Dates invalides' }, { status: 400 })
    }

    if (checkIn < today) {
      return NextResponse.json(
        { error: 'La date d\'arrivée ne peut pas être dans le passé' },
        { status: 400 }
      )
    }

    if (checkOut <= checkIn) {
      return NextResponse.json(
        { error: 'La date de départ doit être postérieure à la date d\'arrivée' },
        { status: 400 }
      )
    }

    // ─── Mode démo ────────────────────────────────────────────
    if (isDemoMode()) {
      // Vérifier que la chambre existe
      const room = DEMO_ROOMS.find(r => r.id === room_id && r.hotel_id === hotel_id)
      if (!room) {
        return NextResponse.json({ error: 'Chambre introuvable' }, { status: 404 })
      }

      // Vérifier la disponibilité
      const conflictingReservation = DEMO_RESERVATIONS.find(r =>
        r.room_id === room_id &&
        r.status !== 'cancelled' &&
        r.status !== 'checked_out' &&
        r.check_in_date < check_out_date &&
        r.check_out_date > check_in_date
      )

      if (conflictingReservation) {
        return NextResponse.json(
          { error: 'La chambre n\'est plus disponible pour ces dates' },
          { status: 409 }
        )
      }

      // Trouver ou créer le client
      let customer = DEMO_CUSTOMERS.find(c => c.phone === phone && c.hotel_id === hotel_id)
      if (!customer && email) {
        customer = DEMO_CUSTOMERS.find(c => c.email === email && c.hotel_id === hotel_id)
      }

      let customerId: string
      if (customer) {
        customerId = customer.id
      } else {
        customerId = `cust-public-${Date.now()}`
        DEMO_CUSTOMERS.push({
          id: customerId,
          hotel_id,
          first_name,
          last_name,
          email: email || null,
          phone,
          identity_document_type: null,
          identity_document_number: null,
          notes: special_requests || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }

      // Calculer le prix dynamique
      const seasonalRates = DEMO_ROOM_RATES.filter(rate => rate.room_id === room_id)
      const totalPrice = calculateDynamicPrice(
        {
          price_per_night: room.price_per_night,
          weekend_price: room.weekend_price,
          weekend_days: room.weekend_days || '5,6',
        },
        seasonalRates.map(r => ({
          id: r.id,
          price_per_night: r.price_per_night,
          start_date: r.start_date,
          end_date: r.end_date,
          priority: r.priority,
        })),
        check_in_date,
        check_out_date
      )

      // Créer la réservation
      const reservationId = `res-public-${Date.now()}`
      const confirmationCode = `OGOU-${Date.now().toString(36).toUpperCase()}`

      DEMO_RESERVATIONS.push({
        id: reservationId,
        hotel_id,
        customer_id: customerId,
        room_id,
        check_in_date,
        check_out_date,
        total_price: totalPrice,
        status: 'pending',
        customers: { first_name, last_name, phone, email: email || null },
        rooms: { id: room.id, room_number: room.room_number, room_type: room.room_type, price_per_night: room.price_per_night, status: room.status },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      return NextResponse.json({
        reservation: {
          id: reservationId,
          confirmation_code: confirmationCode,
          hotel_id,
          room_id,
          check_in_date,
          check_out_date,
          total_price: totalPrice,
          status: 'pending',
          guests: guests || 1,
          special_requests: special_requests || null,
          customer: { first_name, last_name, phone, email: email || null },
          room: { id: room.id, room_number: room.room_number, room_type: room.room_type, price_per_night: room.price_per_night },
        },
      }, { status: 201 })
    }

    // ─── Mode production ──────────────────────────────────────
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 })
    }

    // Vérifier que l'hôtel existe et est actif
    const { data: hotel } = await supabase
      .from('hotels')
      .select('id, name, status')
      .eq('id', hotel_id)
      .eq('status', 'active')
      .maybeSingle()

    if (!hotel) {
      return NextResponse.json({ error: 'Hôtel introuvable ou inactif' }, { status: 404 })
    }

    // Vérifier que la chambre existe
    const { data: room } = await supabase
      .from('rooms')
      .select('id, room_number, room_type, price_per_night, weekend_price, weekend_days, status')
      .eq('id', room_id)
      .eq('hotel_id', hotel_id)
      .maybeSingle()

    if (!room) {
      return NextResponse.json({ error: 'Chambre introuvable' }, { status: 404 })
    }

    if (room.status === 'maintenance') {
      return NextResponse.json({ error: 'Chambre en maintenance' }, { status: 400 })
    }

    // Vérifier la disponibilité
    const { data: conflictingReservations } = await supabase
      .from('reservations')
      .select('id')
      .eq('room_id', room_id)
      .not('status', 'in', '(cancelled,checked_out)')
      .lt('check_in_date', check_out_date)
      .gt('check_out_date', check_in_date)

    if (conflictingReservations && conflictingReservations.length > 0) {
      return NextResponse.json(
        { error: 'La chambre n\'est plus disponible pour ces dates' },
        { status: 409 }
      )
    }

    // Trouver ou créer le client
    let customerId: string

    // Chercher par téléphone d'abord
    const { data: existingCustomerByPhone } = await supabase
      .from('customers')
      .select('id')
      .eq('hotel_id', hotel_id)
      .eq('phone', phone)
      .maybeSingle()

    if (existingCustomerByPhone) {
      customerId = existingCustomerByPhone.id
    } else if (email) {
      // Chercher par email
      const { data: existingCustomerByEmail } = await supabase
        .from('customers')
        .select('id')
        .eq('hotel_id', hotel_id)
        .eq('email', email)
        .maybeSingle()

      if (existingCustomerByEmail) {
        customerId = existingCustomerByEmail.id
      } else {
        // Créer un nouveau client
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            hotel_id,
            first_name,
            last_name,
            email: email || null,
            phone,
            notes: special_requests || null,
          })
          .select('id')
          .single()

        if (customerError || !newCustomer) {
          return NextResponse.json({ error: 'Erreur lors de la création du client' }, { status: 500 })
        }
        customerId = newCustomer.id
      }
    } else {
      // Créer un nouveau client (sans email)
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          hotel_id,
          first_name,
          last_name,
          phone,
          notes: special_requests || null,
        })
        .select('id')
        .single()

      if (customerError || !newCustomer) {
        return NextResponse.json({ error: 'Erreur lors de la création du client' }, { status: 500 })
      }
      customerId = newCustomer.id
    }

    // Calculer le prix dynamique
    const { data: seasonalRates } = await supabase
      .from('room_rates')
      .select('id, price_per_night, start_date, end_date, priority')
      .eq('room_id', room_id)

    const totalPrice = calculateDynamicPrice(
      {
        price_per_night: room.price_per_night,
        weekend_price: room.weekend_price,
        weekend_days: room.weekend_days || '5,6',
      },
      (seasonalRates || []) as { id: string; price_per_night: number; start_date: string; end_date: string; priority: number }[],
      check_in_date,
      check_out_date
    )

    // Créer la réservation
    const confirmationCode = `OGOU-${Date.now().toString(36).toUpperCase()}`

    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .insert({
        hotel_id,
        customer_id: customerId,
        room_id,
        check_in_date,
        check_out_date,
        total_price: totalPrice,
        status: 'pending',
      })
      .select('*, customers(*), rooms(id, room_number, room_type, price_per_night, status)')
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json({ error: 'Erreur lors de la création de la réservation' }, { status: 500 })
    }

    return NextResponse.json({
      reservation: {
        id: reservation.id,
        confirmation_code: confirmationCode,
        hotel_id,
        room_id,
        check_in_date,
        check_out_date,
        total_price: totalPrice,
        status: 'pending',
        guests: guests || 1,
        special_requests: special_requests || null,
        customer: { first_name, last_name, phone, email: email || null },
        room: { id: room.id, room_number: room.room_number, room_type: room.room_type, price_per_night: room.price_per_night },
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Public reservations POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
