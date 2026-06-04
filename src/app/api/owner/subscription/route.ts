import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/owner/subscription
 *
 * Returns the owner's subscription details including plan limits
 * and current usage counts for rooms, receptionists, and managers.
 */
export async function GET() {
  try {
    // 1. Authenticate the user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé à ce compte' }, { status: 404 })
    }

    const adminClient = createAdminClient()

    // 2. Fetch subscription with plan details
    const { data: subscription, error: subError } = await adminClient
      .from('subscriptions')
      .select('id, starts_at, ends_at, status, subscription_plans(*)')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subError) {
      return NextResponse.json({ error: 'Erreur lors du chargement de l\'abonnement' }, { status: 500 })
    }

    // 3. Get current usage counts
    const [roomsResult, receptionistsResult, managersResult, employeesResult, reservationsResult, customersResult] = await Promise.all([
      adminClient.from('rooms').select('id', { count: 'exact', head: true }).eq('hotel_id', hotelId),
      adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('hotel_id', hotelId).eq('role', 'receptionist').eq('status', 'active'),
      adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('hotel_id', hotelId).eq('role', 'manager').eq('status', 'active'),
      adminClient.from('profiles').select('id, first_name, last_name, role, phone, status, created_at').eq('hotel_id', hotelId).order('created_at', { ascending: true }),
      adminClient.from('reservations').select('id', { count: 'exact', head: true }).eq('hotel_id', hotelId),
      adminClient.from('customers').select('id', { count: 'exact', head: true }).eq('hotel_id', hotelId),
    ])

    const plan = subscription?.subscription_plans as unknown as {
      id: string
      name: string
      price_fcfa: number
      max_rooms: number
      max_receptionists: number
      max_managers: number
      support_type: string
    } | null

    const currentRooms = roomsResult.count ?? 0
    const currentReceptionists = receptionistsResult.count ?? 0
    const currentManagers = managersResult.count ?? 0

    return NextResponse.json({
      subscription: subscription ? {
        id: subscription.id,
        starts_at: subscription.starts_at,
        ends_at: subscription.ends_at,
        status: subscription.status,
      } : null,
      plan: plan ? {
        id: plan.id,
        name: plan.name,
        price_fcfa: plan.price_fcfa,
        support_type: plan.support_type,
        limits: {
          max_rooms: plan.max_rooms,
          max_receptionists: plan.max_receptionists,
          max_managers: plan.max_managers,
        },
      } : null,
      usage: {
        rooms: currentRooms,
        receptionists: currentReceptionists,
        managers: currentManagers,
        reservations: reservationsResult.count ?? 0,
        customers: customersResult.count ?? 0,
      },
      canAdd: {
        rooms: plan ? currentRooms < plan.max_rooms : false,
        receptionists: plan ? currentReceptionists < plan.max_receptionists : false,
        managers: plan ? currentManagers < plan.max_managers : false,
      },
      employees: employeesResult.data || [],
    })
  } catch (error) {
    console.error('Owner subscription GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
