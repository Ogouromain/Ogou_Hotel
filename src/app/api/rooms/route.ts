import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoMode, DEMO_ROOMS, DEMO_RESERVATIONS, DEMO_ROOM_RATES } from '@/lib/demo-data'
import { calculateDynamicPrice } from '@/lib/pricing'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hotelId = searchParams.get('hotel_id')
    const checkIn = searchParams.get('check_in')
    const checkOut = searchParams.get('check_out')

    if (!hotelId) {
      return NextResponse.json({ error: 'hotel_id requis' }, { status: 400 })
    }

    // ─── Mode démo ────────────────────────────────────────────
    if (isDemoMode()) {
      let rooms = DEMO_ROOMS.filter(r => r.hotel_id === hotelId)

      // Si des dates sont fournies, filtrer par disponibilité
      if (checkIn && checkOut) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/
        if (!dateRegex.test(checkIn) || !dateRegex.test(checkOut)) {
          return NextResponse.json({ error: 'Format de date invalide. Utilisez YYYY-MM-DD' }, { status: 400 })
        }

        const checkInDate = new Date(checkIn)
        const checkOutDate = new Date(checkOut)
        if (checkOutDate <= checkInDate) {
          return NextResponse.json({ error: 'La date de départ doit être postérieure à la date d\'arrivée' }, { status: 400 })
        }

        // Trouver les chambres avec des réservations en conflit
        const conflictingRoomIds = new Set(
          DEMO_RESERVATIONS
            .filter(r =>
              r.hotel_id === hotelId &&
              r.status !== 'cancelled' &&
              r.status !== 'checked_out' &&
              r.check_in_date < checkOut &&
              r.check_out_date > checkIn
            )
            .map(r => r.room_id)
        )

        // Retourner uniquement les chambres disponibles (non en conflit et pas en maintenance)
        rooms = rooms.filter(r => !conflictingRoomIds.has(r.id) && r.status !== 'maintenance')

        // Calculer le prix dynamique pour chaque chambre disponible
        const roomsWithPricing = rooms.map(room => {
          const seasonalRates = DEMO_ROOM_RATES.filter(rate => rate.room_id === room.id)
          const dynamicPrice = calculateDynamicPrice(
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
            checkIn,
            checkOut
          )
          return { ...room, total_price: dynamicPrice }
        })

        return NextResponse.json({ rooms: roomsWithPricing })
      }

      return NextResponse.json({ rooms })
    }

    // ─── Mode production ──────────────────────────────────────
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 })
    }

    let query = supabase
      .from('rooms')
      .select('*')
      .eq('hotel_id', hotelId)

    // Si des dates sont fournies, filtrer par disponibilité
    if (checkIn && checkOut) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(checkIn) || !dateRegex.test(checkOut)) {
        return NextResponse.json({ error: 'Format de date invalide. Utilisez YYYY-MM-DD' }, { status: 400 })
      }

      const checkInDate = new Date(checkIn)
      const checkOutDate = new Date(checkOut)
      if (checkOutDate <= checkInDate) {
        return NextResponse.json({ error: 'La date de départ doit être postérieure à la date d\'arrivée' }, { status: 400 })
      }

      // Récupérer toutes les chambres de l'hôtel
      const { data: allRooms, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .eq('hotel_id', hotelId)
        .neq('status', 'maintenance')
        .order('room_number', { ascending: true })

      if (roomsError) {
        return NextResponse.json({ error: roomsError.message }, { status: 500 })
      }

      if (!allRooms || allRooms.length === 0) {
        return NextResponse.json({ rooms: [] })
      }

      // Trouver les chambres réservées pour cette période
      const roomIds = allRooms.map(r => r.id)
      const { data: conflictingReservations } = await supabase
        .from('reservations')
        .select('room_id')
        .in('room_id', roomIds)
        .not('status', 'in', '(cancelled,checked_out)')
        .lt('check_in_date', checkOut)
        .gt('check_out_date', checkIn)

      const conflictingRoomIds = new Set(
        (conflictingReservations || []).map(r => r.room_id)
      )

      // Filtrer les chambres disponibles
      const availableRooms = allRooms.filter(r => !conflictingRoomIds.has(r.id))

      // Calculer le prix dynamique pour chaque chambre
      const roomsWithPricing = await Promise.all(
        availableRooms.map(async (room) => {
          const { data: seasonalRates } = await supabase
            .from('room_rates')
            .select('id, price_per_night, start_date, end_date, priority')
            .eq('room_id', room.id)

          const dynamicPrice = calculateDynamicPrice(
            {
              price_per_night: room.price_per_night,
              weekend_price: room.weekend_price,
              weekend_days: room.weekend_days || '5,6',
            },
            (seasonalRates || []) as { id: string; price_per_night: number; start_date: string; end_date: string; priority: number }[],
            checkIn,
            checkOut
          )
          return { ...room, total_price: dynamicPrice }
        })
      )

      return NextResponse.json({ rooms: roomsWithPricing })
    }

    // Sans dates : retourner toutes les chambres
    const { data, error } = await query.order('room_number', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ rooms: data })
  } catch (error) {
    console.error('Rooms GET error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { hotel_id, room_number, room_type, price_per_night, status } = body

    if (!hotel_id || !room_number || !room_type || !price_per_night) {
      return NextResponse.json({ error: 'hotel_id, room_number, room_type et price_per_night sont requis' }, { status: 400 })
    }

    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 })
    }

    const { data, error } = await supabase
      .from('rooms')
      .insert({ 
        hotel_id, 
        room_number, 
        room_type, 
        price_per_night, 
        status: status || 'available' 
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ room: data })
  } catch (error) {
    console.error('Rooms POST error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
