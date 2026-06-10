import { NextRequest, NextResponse } from 'next/server'
import { createClientWithCookies } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = ['owner', 'manager']

/**
 * GET /api/owner/analytics
 *
 * Returns analytics data for the authenticated user's hotel.
 * Tries the `get_hotel_analytics()` SQL function first; if it
 * doesn't exist, falls back to computing analytics directly
 * from database tables using the admin client.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate via cookie-based session.
    //    Read cookies directly from the middleware-modified request to avoid
    //    issues where cookies() from next/headers may not see the refreshed
    //    session cookies set by the middleware's setAll() callback.
    const supabase = createClientWithCookies({
      getAll() {
        return request.cookies.getAll()
      },
      setAll() {
        // Cookie persistence is handled by the middleware;
        // no-op here to avoid interfering with the response.
      },
    })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const role = user.app_metadata?.role
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json(
        { error: 'Aucun hôtel associé à ce compte' },
        { status: 404 }
      )
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json(
        { error: 'Service admin non configuré' },
        { status: 500 }
      )
    }

    // 2. Try the analytics SQL function first
    const { data: rpcData, error: rpcError } = await adminClient.rpc(
      'get_hotel_analytics',
      { p_hotel_id: hotelId }
    )

    let analytics: Record<string, unknown>

    if (rpcError) {
      // RPC function doesn't exist or failed — compute analytics from tables
      console.warn('Analytics RPC unavailable, using fallback queries:', rpcError.message)
      analytics = await computeAnalyticsFallback(adminClient, hotelId)
    } else {
      // RPC returned data — flatten if needed and add extra fields
      analytics = typeof rpcData === 'object' && rpcData !== null ? { ...rpcData } : {}

      // Ensure monthly_revenue, stock_alerts, reservation_alerts are present
      if (!analytics.monthly_revenue) {
        analytics.monthly_revenue = await computeMonthlyRevenue(adminClient, hotelId)
      }
      if (!analytics.stock_alerts) {
        analytics.stock_alerts = await computeStockAlerts(adminClient, hotelId)
      }
      if (!analytics.reservation_alerts) {
        analytics.reservation_alerts = await computeReservationAlerts(adminClient, hotelId)
      }
    }

    // 3. Return analytics data FLAT (not nested under an "analytics" key)
    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Owner analytics GET error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// ─── Fallback: compute analytics directly from tables ─────────────────────────

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

async function computeAnalyticsFallback(
  adminClient: AdminClient,
  hotelId: string
): Promise<Record<string, unknown>> {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-indexed

  // First day of current month
  const monthStart = new Date(currentYear, currentMonth, 1).toISOString()
  // First day of next month
  const monthEnd = new Date(currentYear, currentMonth + 1, 1).toISOString()
  // First day of current year
  const yearStart = new Date(currentYear, 0, 1).toISOString()
  // First day of next year
  const yearEnd = new Date(currentYear + 1, 0, 1).toISOString()

  // ─── Rooms ─────────────────────────────────────────────────────────────
  const { data: rooms } = await adminClient
    .from('rooms')
    .select('id, status')
    .eq('hotel_id', hotelId)

  const total_rooms = rooms?.length ?? 0
  const occupied_rooms = rooms?.filter((r: { status: string }) => r.status === 'occupied').length ?? 0
  const occupancy_rate = total_rooms > 0 ? (occupied_rooms / total_rooms) * 100 : 0

  // ─── Revenue (reservations) ─────────────────────────────────────────────
  // Monthly revenue: checked_out + checked_in reservations in current month
  const { data: monthReservations } = await adminClient
    .from('reservations')
    .select('total_price')
    .eq('hotel_id', hotelId)
    .in('status', ['checked_out', 'checked_in'])
    .gte('check_in_date', monthStart)
    .lt('check_in_date', monthEnd)

  const total_revenue_month = monthReservations?.reduce(
    (sum: number, r: { total_price: number }) => sum + (r.total_price || 0), 0
  ) ?? 0

  // Yearly revenue
  const { data: yearReservations } = await adminClient
    .from('reservations')
    .select('total_price')
    .eq('hotel_id', hotelId)
    .in('status', ['checked_out', 'checked_in'])
    .gte('check_in_date', yearStart)
    .lt('check_in_date', yearEnd)

  const total_revenue_year = yearReservations?.reduce(
    (sum: number, r: { total_price: number }) => sum + (r.total_price || 0), 0
  ) ?? 0

  // ─── Reservation counts ────────────────────────────────────────────────
  const { count: pending_reservations } = await adminClient
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .eq('hotel_id', hotelId)
    .eq('status', 'pending')

  const { count: checked_in_reservations } = await adminClient
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .eq('hotel_id', hotelId)
    .eq('status', 'checked_in')

  // ─── ADR & RevPAR ──────────────────────────────────────────────────────
  // ADR = total revenue / number of rooms sold (checked_out + checked_in this year)
  const roomsSoldYear = yearReservations?.length ?? 0
  const adr = roomsSoldYear > 0 ? total_revenue_year / roomsSoldYear : 0
  const revpar = total_rooms > 0 ? (adr * occupied_rooms) / total_rooms : 0

  // ─── Restaurant revenue (month) ────────────────────────────────────────
  let restaurant_revenue_month = 0
  try {
    const { data: restaurantOrders } = await adminClient
      .from('restaurant_orders')
      .select('total_amount')
      .eq('hotel_id', hotelId)
      .in('status', ['paid', 'served'])
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd)

    restaurant_revenue_month = restaurantOrders?.reduce(
      (sum: number, o: { total_amount: number }) => sum + (o.total_amount || 0), 0
    ) ?? 0
  } catch {
    // Table might not exist
    restaurant_revenue_month = 0
  }

  // ─── Conference revenue (month) ────────────────────────────────────────
  let conference_revenue_month = 0
  try {
    const { data: conferenceBookings } = await adminClient
      .from('conference_bookings')
      .select('total_price')
      .eq('hotel_id', hotelId)
      .neq('status', 'cancelled')
      .gte('start_time', monthStart)
      .lt('start_time', monthEnd)

    conference_revenue_month = conferenceBookings?.reduce(
      (sum: number, b: { total_price: number }) => sum + (b.total_price || 0), 0
    ) ?? 0
  } catch {
    // Table might not exist
    conference_revenue_month = 0
  }

  // ─── Monthly revenue (last 6 months) ───────────────────────────────────
  const monthly_revenue = await computeMonthlyRevenue(adminClient, hotelId)

  // ─── Expenses (month & year) ────────────────────────────────────────
  let total_expenses_month = 0
  let total_expenses_year = 0
  try {
    const { data: monthExpenses } = await adminClient
      .from('expenses')
      .select('amount')
      .eq('hotel_id', hotelId)
      .gte('expense_date', monthStart)
      .lt('expense_date', monthEnd)

    total_expenses_month = monthExpenses?.reduce(
      (sum: number, e: { amount: number }) => sum + (e.amount || 0), 0
    ) ?? 0

    const { data: yearExpenses } = await adminClient
      .from('expenses')
      .select('amount')
      .eq('hotel_id', hotelId)
      .gte('expense_date', yearStart)
      .lt('expense_date', yearEnd)

    total_expenses_year = yearExpenses?.reduce(
      (sum: number, e: { amount: number }) => sum + (e.amount || 0), 0
    ) ?? 0
  } catch {
    // expenses table might not exist yet
    total_expenses_month = 0
    total_expenses_year = 0
  }

  // ─── Stock alerts ──────────────────────────────────────────────────────
  const stock_alerts = await computeStockAlerts(adminClient, hotelId)

  // ─── Reservation alerts ────────────────────────────────────────────────
  const reservation_alerts = await computeReservationAlerts(adminClient, hotelId)

  return {
    total_rooms,
    occupied_rooms,
    occupancy_rate,
    total_revenue_month,
    total_revenue_year,
    pending_reservations: pending_reservations ?? 0,
    checked_in_reservations: checked_in_reservations ?? 0,
    adr,
    revpar,
    restaurant_revenue_month,
    conference_revenue_month,
    total_expenses_month,
    total_expenses_year,
    monthly_revenue,
    stock_alerts,
    reservation_alerts,
  }
}

// ─── Monthly revenue for the last 6 months ────────────────────────────────────

async function computeMonthlyRevenue(
  adminClient: AdminClient,
  hotelId: string
): Promise<Array<{ month: string; revenue: number }>> {
  const now = new Date()
  const result: Array<{ month: string; revenue: number }> = []

  const MONTHS_FR = [
    'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
    'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
  ]

  for (let i = 5; i >= 0; i--) {
    const year = now.getFullYear()
    const month = now.getMonth() - i
    const date = new Date(year, month, 1)
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).toISOString()
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1).toISOString()

    const { data: reservations } = await adminClient
      .from('reservations')
      .select('total_price')
      .eq('hotel_id', hotelId)
      .in('status', ['checked_out', 'checked_in'])
      .gte('check_in_date', monthStart)
      .lt('check_in_date', monthEnd)

    const revenue = reservations?.reduce(
      (sum: number, r: { total_price: number }) => sum + (r.total_price || 0), 0
    ) ?? 0

    result.push({
      month: MONTHS_FR[date.getMonth()],
      revenue,
    })
  }

  return result
}

// ─── Stock alerts: items where quantity < min_threshold ───────────────────────

async function computeStockAlerts(
  adminClient: AdminClient,
  hotelId: string
): Promise<Array<{ id: string; name: string; quantity: number; unit: string; min_threshold: number }>> {
  try {
    const { data: items } = await adminClient
      .from('stock_items')
      .select('id, name, quantity, unit, min_threshold')
      .eq('hotel_id', hotelId)

    // Filter in JS since Supabase JS client cannot compare two columns
    const filtered = (items as Array<{ id: string; name: string; quantity: number; unit: string; min_threshold: number }> | null)
      ?.filter(item => item.quantity < item.min_threshold) ?? []

    return filtered
  } catch {
    return []
  }
}

// ─── Reservation alerts: pending reservations for today or overdue ────────────

async function computeReservationAlerts(
  adminClient: AdminClient,
  hotelId: string
): Promise<Array<{ id: string; customer_name: string; room_number: string; check_in_date: string; status: string }>> {
  try {
    const today = new Date().toISOString().split('T')[0]

    // Pending reservations for today or earlier (overdue)
    const { data: pendingReservations } = await adminClient
      .from('reservations')
      .select('id, check_in_date, status, customers(first_name, last_name), rooms(room_number)')
      .eq('hotel_id', hotelId)
      .eq('status', 'pending')
      .lte('check_in_date', today)

    return (pendingReservations as Array<Record<string, unknown>>)?.map((r) => ({
      id: r.id as string,
      customer_name: `${(r.customers as Record<string, string>)?.first_name || ''} ${(r.customers as Record<string, string>)?.last_name || ''}`.trim(),
      room_number: (r.rooms as Record<string, string>)?.room_number || '—',
      check_in_date: r.check_in_date as string,
      status: r.status as string,
    })) ?? []
  } catch {
    return []
  }
}
