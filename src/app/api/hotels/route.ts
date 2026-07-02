import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoMode, DEMO_HOTELS } from '@/lib/demo-data'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hotelId = searchParams.get('hotel_id')

    // ─── Mode démo ────────────────────────────────────────────
    if (isDemoMode()) {
      let hotels = [...DEMO_HOTELS]
      if (hotelId) {
        hotels = hotels.filter(h => h.id === hotelId)
      }
      return NextResponse.json({ hotels })
    }

    // ─── Mode production ──────────────────────────────────────
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 })
    }

    let query = supabase.from('hotels').select('*').eq('status', 'active').order('created_at', { ascending: false })
    
    if (hotelId) {
      query = query.eq('id', hotelId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ hotels: data })
  } catch (error) {
    console.error('Hotels GET error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, address, city, phone, email } = body

    if (!name || !city || !phone) {
      return NextResponse.json({ error: 'Nom, ville et téléphone sont requis' }, { status: 400 })
    }

    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 })
    }

    const { data, error } = await supabase
      .from('hotels')
      .insert({ name, address, city, phone, email, status: 'active' })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ hotel: data })
  } catch (error) {
    console.error('Hotels POST error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
