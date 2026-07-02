import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { isDemoMode, DEMO_ROOMS, DEMO_RESERVATIONS, DEMO_ROOM_RATES, generateDemoInvoiceFromReservation } from '@/lib/demo-data'
import { calculateDynamicPrice } from '@/lib/pricing'

const ALLOWED_ROLES = ['owner', 'manager', 'receptionist']

/**
 * POST /api/owner/reservations/walk-in
 *
 * Walk-in check-in: Creates a customer (if new) + reservation with checked_in status
 * + marks room as occupied — all in one atomic operation.
 *
 * Body:
 *   - customer_id? (if existing customer)
 *   - first_name?, last_name?, phone?, email? (if new customer)
 *   - room_id (required)
 *   - check_out_date (required, YYYY-MM-DD)
 *   - identity_document_type?, identity_document_number? (optional for new customer)
 *   - payment_method? (default: 'Espèces') — for auto invoice generation
 *   - generate_invoice? (default: true) — whether to auto-generate invoice
 *   - invoice_status? ('paid' | 'pending', default: 'paid') — status for auto-generated invoice
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      customer_id,
      // New customer fields
      first_name,
      last_name,
      phone,
      email,
      identity_document_type,
      identity_document_number,
      // Reservation fields
      room_id,
      check_out_date,
      // Invoice fields
      payment_method = 'Espèces',
      generate_invoice = true,
      invoice_status = 'paid',
    } = body

    // ─── Demo mode: handle walk-in in-memory ──────────────────────────
    if (isDemoMode()) {
      if (!room_id) {
        return NextResponse.json({ error: 'La chambre est requise' }, { status: 400 })
      }
      if (!check_out_date) {
        return NextResponse.json({ error: 'La date de départ est requise' }, { status: 400 })
      }

      const room = DEMO_ROOMS.find(r => r.id === room_id)
      if (!room) {
        return NextResponse.json({ error: 'Chambre introuvable' }, { status: 404 })
      }
      if (room.status === 'occupied') {
        return NextResponse.json(
          { error: `La chambre ${room.room_number} est actuellement occupée. Veuillez choisir une autre chambre.` },
          { status: 409 }
        )
      }
      if (room.status === 'maintenance') {
        return NextResponse.json(
          { error: `La chambre ${room.room_number} est en maintenance. Veuillez choisir une autre chambre.` },
          { status: 409 }
        )
      }

      const todayStr = new Date().toISOString().split('T')[0]
      const checkOut = new Date(check_out_date)

      // Calcul dynamique du prix (tarification weekend + saisonnière)
      const roomRates = DEMO_ROOM_RATES.filter(r => r.room_id === room_id)
      const totalPrice = calculateDynamicPrice(
        {
          price_per_night: room.price_per_night,
          weekend_price: room.weekend_price,
          weekend_days: room.weekend_days || '5,6',
        },
        roomRates.map(r => ({ id: r.id, price_per_night: r.price_per_night, start_date: r.start_date, end_date: r.end_date, priority: r.priority })),
        todayStr,
        check_out_date
      )

      const newId = `res-walkin-${Date.now()}`
      const custFirstName = first_name || 'Client'
      const custLastName = last_name || 'Walk-in'
      const custPhone = phone || null
      const custEmail = email || null

      const newReservation = {
        id: newId,
        hotel_id: room.hotel_id,
        customer_id: customer_id || `cust-walkin-${Date.now()}`,
        room_id,
        check_in_date: todayStr,
        check_out_date,
        total_price: totalPrice,
        status: 'checked_in' as const,
        customers: { first_name: custFirstName, last_name: custLastName, phone: custPhone, email: custEmail },
        rooms: { id: room.id, room_number: room.room_number, room_type: room.room_type, price_per_night: room.price_per_night, status: 'occupied' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      DEMO_RESERVATIONS.push(newReservation)

      // Update room to occupied
      room.status = 'occupied'
      room.updated_at = new Date().toISOString()

      // ─── Auto-generate invoice ──────────────────────────────
      let invoice = null
      if (generate_invoice) {
        const invStatus = (invoice_status === 'paid' ? 'paid' : 'pending') as 'paid' | 'pending'
        invoice = generateDemoInvoiceFromReservation(newReservation, payment_method, invStatus)
      }

      return NextResponse.json({
        reservation: newReservation,
        walk_in: true,
        invoice: invoice || undefined,
      }, { status: 201 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const adminClient = createAdminClient()

    // ─── Validate reservation fields ──────────────────────────────
    if (!room_id) {
      return NextResponse.json(
        { error: 'La chambre est requise' },
        { status: 400 }
      )
    }

    if (!check_out_date) {
      return NextResponse.json(
        { error: 'La date de départ est requise' },
        { status: 400 }
      )
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(check_out_date)) {
      return NextResponse.json(
        { error: 'Format de date de départ invalide. Utilisez YYYY-MM-DD' },
        { status: 400 }
      )
    }

    // Check-in date is always today
    const today = new Date()
    const checkInDate = today.toISOString().split('T')[0]
    const checkOut = new Date(check_out_date)

    if (isNaN(checkOut.getTime())) {
      return NextResponse.json({ error: 'Date de départ invalide' }, { status: 400 })
    }

    if (checkOut <= today) {
      return NextResponse.json(
        { error: 'La date de départ doit être postérieure à aujourd\'hui' },
        { status: 400 }
      )
    }

    // ─── Resolve customer ─────────────────────────────────────────
    let customerId = customer_id

    if (!customerId) {
      // Create new customer
      if (!first_name || !last_name || !phone) {
        return NextResponse.json(
          { error: 'Pour un nouveau client, le prénom, le nom et le téléphone sont requis' },
          { status: 400 }
        )
      }

      // Validate email format if provided
      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email.trim())) {
          return NextResponse.json({ error: 'Adresse e-mail invalide' }, { status: 400 })
        }
      }

      // ─── Check for duplicate customer (same phone in same hotel) ──
      const { data: existingCustomer } = await adminClient
        .from('customers')
        .select('id, first_name, last_name, phone')
        .eq('hotel_id', hotelId)
        .eq('phone', phone.trim())
        .maybeSingle()

      if (existingCustomer) {
        // Auto-use the existing customer instead of creating a duplicate
        customerId = (existingCustomer as Record<string, unknown>).id as string
      } else {
        // No duplicate found — create new customer
        const { data: newCustomer, error: customerError } = await adminClient
          .from('customers')
          .insert({
            hotel_id: hotelId,
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            email: email?.trim() || null,
            phone: phone.trim(),
            identity_document_type: identity_document_type || null,
            identity_document_number: identity_document_number?.trim() || null,
          })
          .select('id, first_name, last_name, phone, email')
          .single()

        if (customerError) {
          return NextResponse.json(
            { error: `Erreur lors de la création du client : ${customerError.message}` },
            { status: 500 }
          )
        }

        customerId = newCustomer.id

        // Audit log for customer creation
        await logAudit({
          hotel_id: hotelId,
          profile_id: user.id,
          action: 'create',
          entity_type: 'customer',
          entity_id: customerId,
          new_values: {
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            phone: phone.trim(),
            source: 'walk_in',
          },
        })
      }
    } else {
      // Verify existing customer belongs to this hotel
      const { data: existingCustomer } = await adminClient
        .from('customers')
        .select('id, first_name, last_name')
        .eq('id', customerId)
        .eq('hotel_id', hotelId)
        .maybeSingle()

      if (!existingCustomer) {
        return NextResponse.json(
          { error: 'Client introuvable ou n\'appartient pas à votre hôtel' },
          { status: 404 }
        )
      }
    }

    // ─── Verify room belongs to hotel and is available ────────────
    const { data: room } = await adminClient
      .from('rooms')
      .select('id, room_number, room_type, price_per_night, weekend_price, weekend_days, status')
      .eq('id', room_id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!room) {
      return NextResponse.json(
        { error: 'Chambre introuvable ou n\'appartient pas à votre hôtel' },
        { status: 404 }
      )
    }

    if (room.status === 'occupied') {
      return NextResponse.json(
        { error: `La chambre ${room.room_number} est actuellement occupée. Veuillez choisir une autre chambre.` },
        { status: 409 }
      )
    }

    if (room.status === 'maintenance') {
      return NextResponse.json(
        { error: `La chambre ${room.room_number} est en maintenance. Veuillez choisir une autre chambre.` },
        { status: 409 }
      )
    }

    // ─── Check for date overlap ───────────────────────────────────
    const { data: conflictingReservations } = await adminClient
      .from('reservations')
      .select('id, check_in_date, check_out_date, status, customers(first_name, last_name)')
      .eq('room_id', room_id)
      .not('status', 'in', '(cancelled,checked_out)')
      .lt('check_in_date', check_out_date)
      .gt('check_out_date', checkInDate)

    if (conflictingReservations && conflictingReservations.length > 0) {
      const conflict = conflictingReservations[0]
      const customerName = conflict.customers
        ? `${(conflict.customers as Record<string, unknown>).first_name} ${(conflict.customers as Record<string, unknown>).last_name}`
        : 'Inconnu'

      return NextResponse.json(
        {
          error: 'La chambre est déjà réservée pour cette période',
          conflict: {
            id: conflict.id,
            check_in_date: conflict.check_in_date,
            check_out_date: conflict.check_out_date,
            status: conflict.status,
            customer: customerName,
          },
        },
        { status: 409 }
      )
    }

    // ─── Calculate total_price (tarification dynamique) ────────────
    // Récupérer les tarifs saisonniers pour cette chambre
    const { data: seasonalRates } = await adminClient
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
      checkInDate,
      check_out_date
    )

    // ─── Create reservation with checked_in status ────────────────
    const { data: reservation, error: reservationError } = await adminClient
      .from('reservations')
      .insert({
        hotel_id: hotelId,
        customer_id: customerId,
        room_id,
        check_in_date: checkInDate,
        check_out_date,
        total_price: totalPrice,
        status: 'checked_in', // Direct check-in!
      })
      .select('*, customers(*), rooms(id, room_number, room_type, price_per_night, status)')
      .single()

    if (reservationError) {
      return NextResponse.json({ error: reservationError.message }, { status: 500 })
    }

    // ─── Update room status to occupied ───────────────────────────
    await adminClient
      .from('rooms')
      .update({ status: 'occupied', updated_at: new Date().toISOString() })
      .eq('id', room_id)

    // ─── Audit log ────────────────────────────────────────────────
    await logAudit({
      hotel_id: hotelId,
      profile_id: user.id,
      action: 'walk_in_check_in',
      entity_type: 'reservation',
      entity_id: reservation.id,
      new_values: {
        customer_id: customerId,
        room_id,
        check_in_date: checkInDate,
        check_out_date,
        total_price: totalPrice,
        status: 'checked_in',
        room_status: 'occupied',
        source: 'walk_in',
      },
    })

    // Re-fetch with updated room status
    const { data: refreshedReservation } = await adminClient
      .from('reservations')
      .select('*, customers(*), rooms(id, room_number, room_type, price_per_night, status)')
      .eq('id', reservation.id)
      .single()

    // ─── Auto-generate invoice ──────────────────────────────────
    let generatedInvoice = null
    if (generate_invoice) {
      const VALID_PAYMENT_METHODS = ['OM', 'MTN', 'Wave', 'Espèces', 'Chèque', 'Carte'] as const
      const invPaymentMethod = VALID_PAYMENT_METHODS.includes(payment_method as typeof VALID_PAYMENT_METHODS[number]) ? payment_method : 'Espèces'
      const invStatus = invoice_status === 'pending' ? 'pending' : 'paid'
      const nights = Math.max(1, Math.ceil((new Date(check_out_date).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24)))
      const pricePerNight = Math.round(totalPrice / nights)
      const invSubtotal = Math.round(totalPrice / 1.18)
      const invVat = totalPrice - invSubtotal

      // Generate invoice number: FACT-YYYY-MM-XXXX
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const invPrefix = `FACT-${year}-${month}-`

      const { data: lastInvoice } = await adminClient
        .from('invoices')
        .select('invoice_number')
        .eq('hotel_id', hotelId)
        .like('invoice_number', `${invPrefix}%`)
        .order('invoice_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      let nextCounter = 1
      if (lastInvoice?.invoice_number) {
        const lastCounterStr = lastInvoice.invoice_number.substring(invPrefix.length)
        const lastCounter = parseInt(lastCounterStr, 10)
        if (!isNaN(lastCounter)) {
          nextCounter = lastCounter + 1
        }
      }
      const invoiceNumber = `${invPrefix}${String(nextCounter).padStart(4, '0')}`

      // Generate receipt number if paid
      let receiptNumber: string | null = null
      if (invStatus === 'paid') {
        const recPrefix = `REC-${year}-${month}-`
        const { data: lastReceipt } = await adminClient
          .from('invoices')
          .select('receipt_number')
          .eq('hotel_id', hotelId)
          .like('receipt_number', `${recPrefix}%`)
          .order('receipt_number', { ascending: false })
          .limit(1)
          .maybeSingle()

        let recCounter = 1
        if (lastReceipt?.receipt_number) {
          const lastCounterStr = lastReceipt.receipt_number.substring(recPrefix.length)
          const lastCounter = parseInt(lastCounterStr, 10)
          if (!isNaN(lastCounter)) {
            recCounter = lastCounter + 1
          }
        }
        receiptNumber = `${recPrefix}${String(recCounter).padStart(4, '0')}`
      }

      const { data: invoice } = await adminClient
        .from('invoices')
        .insert({
          hotel_id: hotelId,
          invoice_number: invoiceNumber,
          customer_id: customerId,
          reservation_id: reservation.id,
          subtotal: invSubtotal,
          tourist_tax: 0,
          vat: invVat,
          total_amount: totalPrice,
          payment_method: invPaymentMethod,
          status: invStatus,
          receipt_number: receiptNumber,
          paid_at: invStatus === 'paid' ? new Date().toISOString() : null,
          notes: invStatus === 'paid' ? 'Facture auto-générée (Walk-in)' : 'Facture auto-générée (En attente de paiement)',
        })
        .select()
        .single()

      if (invoice) {
        // Insert invoice item
        await adminClient.from('invoice_items').insert({
          invoice_id: invoice.id,
          description: `Chambre ${room.room_number} (${room.room_type}) — Nuitée`,
          quantity: nights,
          unit_price: pricePerNight,
          total: totalPrice,
        })
        generatedInvoice = invoice

        await logAudit({
          hotel_id: hotelId,
          profile_id: user.id,
          action: 'auto_create_invoice',
          entity_type: 'invoice',
          entity_id: invoice.id,
          new_values: {
            invoice_number: invoiceNumber,
            customer_id: customerId,
            reservation_id: reservation.id,
            total_amount: totalPrice,
            payment_method: invPaymentMethod,
            status: invStatus,
            receipt_number: receiptNumber,
            source: 'walk_in',
          },
        })
      }
    }

    return NextResponse.json({
      reservation: refreshedReservation || reservation,
      walk_in: true,
      invoice: generatedInvoice || undefined,
    }, { status: 201 })
  } catch (error) {
    console.error('Walk-in check-in error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
