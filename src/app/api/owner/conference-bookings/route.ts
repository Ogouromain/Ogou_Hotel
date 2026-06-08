import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const READ_ROLES = ['owner', 'manager', 'receptionist']
const WRITE_ROLES = ['owner', 'manager', 'receptionist']

/**
 * GET /api/owner/conference-bookings
 * List all conference bookings with room name and customer name joined.
 * Optional filters: ?status=confirmed, ?conference_room_id=
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!READ_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')
    const conferenceRoomId = searchParams.get('conference_room_id')

    const adminClient = createAdminClient()
    let query = adminClient
      .from('conference_bookings')
      .select('*, conference_rooms(name), customers(first_name, last_name)')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })

    if (statusFilter) {
      const validStatuses = ['confirmed', 'cancelled', 'completed']
      if (!validStatuses.includes(statusFilter)) {
        return NextResponse.json(
          { error: `Statut invalide. Statuts valides : ${validStatuses.join(', ')}` },
          { status: 400 }
        )
      }
      query = query.eq('status', statusFilter)
    }
    if (conferenceRoomId) {
      query = query.eq('conference_room_id', conferenceRoomId)
    }

    const { data: bookings, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Flatten joined data for cleaner response
    const enriched = (bookings || []).map(booking => ({
      ...booking,
      conference_room_name: booking.conference_rooms?.name || null,
      customer_name: booking.customers
        ? `${booking.customers.first_name} ${booking.customers.last_name}`
        : null,
      conference_rooms: undefined,
      customers: undefined,
    }))

    return NextResponse.json({ bookings: enriched })
  } catch (error) {
    console.error('Conference bookings GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/owner/conference-bookings
 * Create a new conference booking with time overlap validation.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!WRITE_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé. Seuls le propriétaire, le manager et le réceptionniste peuvent créer des réservations de salle.' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const body = await request.json()
    const { conference_room_id, customer_id, start_time, end_time, total_price } = body

    if (!conference_room_id || !customer_id || !start_time || !end_time) {
      return NextResponse.json(
        { error: 'La salle, le client, l\'heure de début et l\'heure de fin sont requis' },
        { status: 400 }
      )
    }

    const startDate = new Date(start_time)
    const endDate = new Date(end_time)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Dates invalides' }, { status: 400 })
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'L\'heure de début doit être antérieure à l\'heure de fin' },
        { status: 400 }
      )
    }

    const priceNum = total_price !== undefined ? parseFloat(total_price) : 0
    if (isNaN(priceNum) || priceNum < 0) {
      return NextResponse.json(
        { error: 'Le prix total doit être un nombre positif' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Verify conference room belongs to this hotel
    const { data: room } = await adminClient
      .from('conference_rooms')
      .select('id, name, price_per_hour, status')
      .eq('id', conference_room_id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!room) {
      return NextResponse.json({ error: 'Salle de conférence introuvable' }, { status: 404 })
    }

    if (room.status === 'maintenance') {
      return NextResponse.json(
        { error: 'Cette salle est actuellement en maintenance' },
        { status: 400 }
      )
    }

    // Verify customer belongs to this hotel
    const { data: customer } = await adminClient
      .from('customers')
      .select('id')
      .eq('id', customer_id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!customer) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    // Check time overlap for the same room (excluding cancelled bookings)
    const { data: overlapping } = await adminClient
      .from('conference_bookings')
      .select('id, start_time, end_time')
      .eq('conference_room_id', conference_room_id)
      .neq('status', 'cancelled')
      .lt('start_time', end_time)  // existing starts before new ends
      .gt('end_time', start_time)  // existing ends after new starts

    if (overlapping && overlapping.length > 0) {
      return NextResponse.json(
        {
          error: 'Conflit d\'horaire : cette salle est déjà réservée pour ce créneau',
          conflicts: overlapping,
        },
        { status: 409 }
      )
    }

    // Calculate total_price from room price if not provided
    let calculatedPrice = priceNum
    if (!priceNum || priceNum === 0) {
      const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)
      calculatedPrice = Math.round(hours * room.price_per_hour)
    }

    const { data: booking, error } = await adminClient
      .from('conference_bookings')
      .insert({
        hotel_id: hotelId,
        conference_room_id,
        customer_id,
        start_time,
        end_time,
        total_price: calculatedPrice,
        status: 'confirmed',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ booking }, { status: 201 })
  } catch (error) {
    console.error('Conference bookings POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
