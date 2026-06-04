import { NextRequest, NextResponse } from 'next/server'
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifySuperAdmin()
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status || !['active', 'suspended', 'inactive'].includes(status)) {
      return NextResponse.json(
        { error: 'Statut invalide' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('hotels')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Hôtel non trouvé' },
        { status: 404 }
      )
    }

    // Also update subscription status if suspending
    if (status === 'suspended') {
      await supabase
        .from('subscriptions')
        .update({ status: 'suspended', updated_at: new Date().toISOString() })
        .eq('hotel_id', id)
        .eq('status', 'active')
    } else if (status === 'active') {
      // Reactivate subscriptions that were suspended due to hotel suspension
      await supabase
        .from('subscriptions')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('hotel_id', id)
        .eq('status', 'suspended')
    }

    return NextResponse.json({ hotel: data })
  } catch (error) {
    console.error('Error updating hotel:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour' },
      { status: 500 }
    )
  }
}
