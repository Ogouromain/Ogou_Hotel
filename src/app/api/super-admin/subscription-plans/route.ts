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

    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('price_fcfa', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ plans: plans || [] })
  } catch (error) {
    console.error('Error fetching subscription plans:', error)
    return NextResponse.json(
      { error: 'Erreur lors du chargement des plans' },
      { status: 500 }
    )
  }
}
