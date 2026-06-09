import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = ['restaurant_staff', 'manager', 'owner']

/**
 * PATCH /api/staff/menu/[id]
 * Toggle menu item availability (restaurant staff can mark items as unavailable when out of stock).
 * Only the is_available field can be changed by restaurant_staff.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json()
    const { is_available } = body

    if (typeof is_available !== 'boolean') {
      return NextResponse.json(
        { error: 'Le champ is_available (booléen) est requis' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }

    // Verify menu item belongs to this hotel
    const { data: existing } = await adminClient
      .from('menu_items')
      .select('id, name, is_available')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    }

    // Update only the is_available field
    const { data: item, error } = await adminClient
      .from('menu_items')
      .update({ is_available })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Staff menu availability PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
