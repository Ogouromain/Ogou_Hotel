import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = ['restaurant_staff', 'manager', 'owner']

/**
 * GET /api/staff/restaurant
 *
 * Returns restaurant orders and stats for the staff's hotel.
 * Includes ALL orders (pending, preparing, served) so the UI
 * can display all filter tabs and compute daily revenue.
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
    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }

    // Fetch today's date range for stats
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

    // Fetch all orders (pending + preparing + served) for the hotel
    const { data: orders, error } = await adminClient
      .from('restaurant_orders')
      .select('*, restaurant_order_items(*)')
      .eq('hotel_id', hotelId)
      .in('status', ['pending', 'preparing', 'served'])
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Compute stats
    const allOrders = orders || []
    const stats = {
      pending: allOrders.filter(o => o.status === 'pending').length,
      preparing: allOrders.filter(o => o.status === 'preparing').length,
      served: allOrders.filter(o => o.status === 'served').length,
    }

    return NextResponse.json({ orders: allOrders, stats })
  } catch (error) {
    console.error('Staff restaurant GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
