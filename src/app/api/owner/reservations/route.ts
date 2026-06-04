import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'

const ALLOWED_ROLES = ['owner', 'manager', 'receptionist']

/**
 * GET /api/owner/reservations
 * List all reservations for the owner's hotel with optional filters.
 * Query params: status, date_from, date_to, month (YYYY-MM)
 */
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const month = searchParams.get('month') // e.g. "2025-01"

    const adminClient = createAdminClient()

    let query = adminClient
      .from('reservations')
      .select('*, customers(*), rooms(id, room_number, room_type, price_per_night, status)')
      .eq('hotel_id', hotelId)

    // Filter by exact status
    if (status) {
      const validStatuses = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Statut invalide. Statuts autorisés : ${validStatuses.join(', ')}` },
          { status: 400 }
        )
      }
      query = query.eq('status', status)
    }

    // Filter by date range (reservations that overlap with the given range)
    if (dateFrom && dateTo) {
      // Overlap logic: reservation overlaps if check_in_date < dateTo AND check_out_date > dateFrom
      query = query.lt('check_in_date', dateTo).gt('check_out_date', dateFrom)
    } else if (dateFrom) {
      query = query.gte('check_out_date', dateFrom)
    } else if (dateTo) {
      query = query.lte('check_in_date', dateTo)
    }

    // Month filter (calendar view) — get all reservations overlapping with the given month
    if (month) {
      const monthRegex = /^\d{4}-\d{2}$/
      if (!monthRegex.test(month)) {
        return NextResponse.json(
          { error: 'Format de mois invalide. Utilisez YYYY-MM (ex: 2025-01)' },
          { status: 400 }
        )
      }
      const monthStart = `${month}-01`
      // Calculate the first day of the next month
      const [year, mon] = month.split('-').map(Number)
      const nextMonth = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`
      // Reservations that overlap with the month
      query = query.lt('check_in_date', nextMonth).gt('check_out_date', monthStart)
    }

    query = query.order('check_in_date', { ascending: false })

    const { data: reservations, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ reservations })
  } catch (error) {
    console.error('Owner reservations GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/owner/reservations
 * Create a new reservation with date overlap validation.
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json()
    const { customer_id, room_id, check_in_date, check_out_date } = body

    // ─── Validate required fields ──────────────────────────────
    if (!customer_id || !room_id || !check_in_date || !check_out_date) {
      return NextResponse.json(
        { error: 'client, chambre, date d\'arrivée et date de départ sont requis' },
        { status: 400 }
      )
    }

    // ─── Validate date format ──────────────────────────────────
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(check_in_date) || !dateRegex.test(check_out_date)) {
      return NextResponse.json(
        { error: 'Format de date invalide. Utilisez YYYY-MM-DD' },
        { status: 400 }
      )
    }

    const checkIn = new Date(check_in_date)
    const checkOut = new Date(check_out_date)

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return NextResponse.json({ error: 'Dates invalides' }, { status: 400 })
    }

    if (checkOut <= checkIn) {
      return NextResponse.json(
        { error: 'La date de départ doit être postérieure à la date d\'arrivée' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // ─── Verify room belongs to this hotel ─────────────────────
    const { data: room } = await adminClient
      .from('rooms')
      .select('id, room_number, room_type, price_per_night, status')
      .eq('id', room_id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!room) {
      return NextResponse.json(
        { error: 'Chambre introuvable ou n\'appartient pas à votre hôtel' },
        { status: 404 }
      )
    }

    // ─── Verify customer belongs to this hotel ─────────────────
    const { data: customer } = await adminClient
      .from('customers')
      .select('id, first_name, last_name')
      .eq('id', customer_id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!customer) {
      return NextResponse.json(
        { error: 'Client introuvable ou n\'appartient pas à votre hôtel' },
        { status: 404 }
      )
    }

    // ─── Check for date overlap ────────────────────────────────
    // A reservation overlaps if:
    // existing.check_in_date < new.check_out_date AND existing.check_out_date > new.check_in_date
    // AND existing.status NOT IN ('cancelled', 'checked_out')
    const { data: conflictingReservations } = await adminClient
      .from('reservations')
      .select('id, check_in_date, check_out_date, status, customers(first_name, last_name)')
      .eq('room_id', room_id)
      .not('status', 'in', '(cancelled,checked_out)')
      .lt('check_in_date', check_out_date)
      .gt('check_out_date', check_in_date)

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

    // ─── Calculate total_price ─────────────────────────────────
    const diffTime = checkOut.getTime() - checkIn.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const totalPrice = room.price_per_night * diffDays

    // ─── Create reservation ────────────────────────────────────
    const { data: reservation, error } = await adminClient
      .from('reservations')
      .insert({
        hotel_id: hotelId,
        customer_id,
        room_id,
        check_in_date,
        check_out_date,
        total_price: totalPrice,
        status: 'pending',
      })
      .select('*, customers(*), rooms(id, room_number, room_type, price_per_night, status)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ─── Audit log ─────────────────────────────────────────────
    await logAudit({
      hotel_id: hotelId,
      profile_id: user.id,
      action: 'create',
      entity_type: 'reservation',
      entity_id: reservation.id,
      new_values: {
        customer_id,
        room_id,
        check_in_date,
        check_out_date,
        total_price: totalPrice,
        status: 'pending',
      },
    })

    return NextResponse.json({ reservation }, { status: 201 })
  } catch (error) {
    console.error('Owner reservations POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
