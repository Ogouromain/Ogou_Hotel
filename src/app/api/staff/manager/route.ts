import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = ['manager', 'owner']

/**
 * GET /api/staff/manager
 *
 * Returns comprehensive dashboard statistics for the manager's hotel:
 * - Room stats (total, available, occupied, cleaning, maintenance)
 * - Today's check-ins count
 * - Today's check-outs count
 * - Expired stays count (checked_in reservations where check_out_date < today)
 * - Today's restaurant orders stats (pending, preparing, served)
 * - Today's revenue (from paid invoices)
 * - Active reservations count
 * - Total customers count
 */
export async function GET(request: NextRequest) {
  try {
    // ── Auth verification (defense-in-depth) ──────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // ── Role & hotel from middleware headers ──────────────────────────────
    const role = request.headers.get('x-user-role')
    const hotelId = request.headers.get('x-user-hotel-id')

    if (!ALLOWED_ROLES.includes(role || '')) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 403 })
    }

    // ── Admin client for database queries ─────────────────────────────────
    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json(
        { error: 'Service admin non configuré' },
        { status: 500 }
      )
    }

    // ── Today's date range ────────────────────────────────────────────────
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0] // YYYY-MM-DD
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

    // ── Parallel queries for dashboard stats ──────────────────────────────
    const [
      roomsResult,
      todayCheckInsResult,
      todayCheckOutsResult,
      expiredStaysResult,
      pendingOrdersResult,
      preparingOrdersResult,
      servedOrdersResult,
      todayRevenueResult,
      activeReservationsResult,
      totalCustomersResult,
    ] = await Promise.all([
      // 1. All rooms with status
      adminClient
        .from('rooms')
        .select('id, status')
        .eq('hotel_id', hotelId),

      // 2. Today's check-ins: reservations where check_in_date = today and status in (pending, confirmed)
      adminClient
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('check_in_date', todayStr)
        .in('status', ['pending', 'confirmed']),

      // 3. Today's check-outs: reservations where check_out_date = today and status = checked_in
      adminClient
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('check_out_date', todayStr)
        .eq('status', 'checked_in'),

      // 4. Expired stays: checked_in reservations where check_out_date < today
      adminClient
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('status', 'checked_in')
        .lt('check_out_date', todayStr),

      // 5. Today's pending restaurant orders
      adminClient
        .from('restaurant_orders')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('status', 'pending')
        .gte('created_at', todayStart)
        .lt('created_at', todayEnd),

      // 6. Today's preparing restaurant orders
      adminClient
        .from('restaurant_orders')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('status', 'preparing')
        .gte('created_at', todayStart)
        .lt('created_at', todayEnd),

      // 7. Today's served restaurant orders
      adminClient
        .from('restaurant_orders')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('status', 'served')
        .gte('created_at', todayStart)
        .lt('created_at', todayEnd),

      // 8. Today's revenue from paid invoices
      adminClient
        .from('invoices')
        .select('total_amount')
        .eq('hotel_id', hotelId)
        .eq('status', 'paid')
        .gte('created_at', todayStart)
        .lt('created_at', todayEnd),

      // 9. Active reservations count (pending, confirmed, or checked_in)
      adminClient
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .in('status', ['pending', 'confirmed', 'checked_in']),

      // 10. Total customers count
      adminClient
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId),
    ])

    // ── Process room stats ────────────────────────────────────────────────
    const rooms = roomsResult.data || []
    const roomStats = {
      total: rooms.length,
      available: rooms.filter((r: { status: string }) => r.status === 'available').length,
      occupied: rooms.filter((r: { status: string }) => r.status === 'occupied').length,
      cleaning: rooms.filter((r: { status: string }) => r.status === 'cleaning').length,
      maintenance: rooms.filter((r: { status: string }) => r.status === 'maintenance').length,
    }

    // ── Compute today's revenue ───────────────────────────────────────────
    const todayRevenue = (todayRevenueResult.data || []).reduce(
      (sum: number, inv: { total_amount: number }) => sum + (inv.total_amount || 0),
      0
    )

    // ── Build response ────────────────────────────────────────────────────
    return NextResponse.json({
      rooms: roomStats,
      todayCheckIns: todayCheckInsResult.count ?? 0,
      todayCheckOuts: todayCheckOutsResult.count ?? 0,
      expiredStays: expiredStaysResult.count ?? 0,
      orders: {
        pending: pendingOrdersResult.count ?? 0,
        preparing: preparingOrdersResult.count ?? 0,
        served: servedOrdersResult.count ?? 0,
      },
      todayRevenue,
      activeReservations: activeReservationsResult.count ?? 0,
      totalCustomers: totalCustomersResult.count ?? 0,
    })
  } catch (error) {
    console.error('Staff manager dashboard GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
