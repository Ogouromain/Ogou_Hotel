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
      .from('customers')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ customers: data })
  } catch (error) {
    console.error('Customers GET error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { hotel_id, first_name, last_name, email, phone, identity_document_type, identity_document_number } = body

    if (!hotel_id || !first_name || !last_name || !phone) {
      return NextResponse.json({ error: 'hotel_id, first_name, last_name et phone sont requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('customers')
      .insert({ hotel_id, first_name, last_name, email, phone, identity_document_type, identity_document_number })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ customer: data })
  } catch (error) {
    console.error('Customers POST error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
