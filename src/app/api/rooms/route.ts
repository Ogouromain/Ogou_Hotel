import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hotelId = searchParams.get('hotel_id')

    if (!hotelId) {
      return NextResponse.json({ error: 'hotel_id requis' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('room_number', { ascending: true })

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
