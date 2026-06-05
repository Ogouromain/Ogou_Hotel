import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = ['restaurant_staff', 'manager', 'owner']

/**
 * GET /api/staff/restaurant
 * List restaurant orders with status 'pending' or 'preparing' for the staff's hotel.
 * Include order items with names and quantities.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const hotelId = user.app_metadata?.hotel_id
    const role = user.app_metadata?.role

    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 403 })
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    const { data: orders, error } = await adminClient
      .from('restaurant_orders')
      .select('*, restaurant_order_items(*)')
      .eq('hotel_id', hotelId)
      .in('status', ['pending', 'preparing'])
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ orders: orders || [] })
  } catch (error) {
    console.error('Staff restaurant GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
