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
      .from('reservations')
      .select('*, customers(*), rooms(*)')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ reservations: data })
  } catch (error) {
    console.error('Reservations GET error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { hotel_id, customer_id, room_id, check_in_date, check_out_date, total_price, status } = body

    if (!hotel_id || !customer_id || !room_id || !check_in_date || !check_out_date || !total_price) {
      return NextResponse.json({ error: 'Tous les champs sont requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('reservations')
      .insert({ 
        hotel_id, 
        customer_id, 
        room_id, 
        check_in_date, 
        check_out_date, 
        total_price, 
        status: status || 'pending' 
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update room status to occupied
    await supabase
      .from('rooms')
      .update({ status: 'occupied' })
      .eq('id', room_id)

    return NextResponse.json({ reservation: data })
  } catch (error) {
    console.error('Reservations POST error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
