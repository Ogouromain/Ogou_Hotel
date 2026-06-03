import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifySuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { authorized: false, error: 'Non authentifié' }
  const role = user.app_metadata?.role
  if (role !== 'super_admin') return { authorized: false, error: 'Accès refusé : rôle super_admin requis' }
  return { authorized: true, userId: user.id }
}

export async function GET() {
  try {
    const auth = await verifySuperAdmin()
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 403 })
    }

    const supabase = createAdminClient()

    // Active hotels count
    const { count: activeHotels } = await supabase
      .from('hotels')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // New leads count
    const { count: newLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new')

    // Unused activation codes
    const { count: unusedCodes } = await supabase
      .from('activation_codes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'unused')

    // Estimated revenue: sum of active subscription plan prices
    const { data: activeSubscriptions } = await supabase
      .from('subscriptions')
      .select('plan_id, subscription_plans(price_fcfa)')
      .eq('status', 'active')

    let estimatedRevenue = 0
    if (activeSubscriptions) {
      for (const sub of activeSubscriptions) {
        const planData = sub.subscription_plans as unknown as { price_fcfa: number } | null
        if (planData?.price_fcfa) {
          estimatedRevenue += planData.price_fcfa
        }
      }
    }

    return NextResponse.json({
      activeHotels: activeHotels ?? 0,
      newLeads: newLeads ?? 0,
      unusedCodes: unusedCodes ?? 0,
      estimatedRevenue,
    })
  } catch (error) {
    console.error('Error fetching super admin stats:', error)
    return NextResponse.json(
      { error: 'Erreur lors du chargement des statistiques' },
      { status: 500 }
    )
  }
}
