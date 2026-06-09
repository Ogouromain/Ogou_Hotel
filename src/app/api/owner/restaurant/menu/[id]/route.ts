import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const WRITE_ROLES = ['owner', 'manager']

/**
 * PATCH /api/owner/restaurant/menu/[id]
 * Update a menu item.
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

    const role = user.app_metadata?.role
    if (!WRITE_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé. Seuls le propriétaire et le manager peuvent modifier les articles.' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const { id } = await params
    const body = await request.json()
    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }

    // Verify item belongs to this hotel
    const { data: existing } = await adminClient
      .from('menu_items')
      .select('id, name')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    }

    // Build update object
    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.category !== undefined) {
      const CATEGORY_MAP: Record<string, string> = {
        'entree': 'Entrée',
        'plat_principal': 'Plat principal',
        'dessert': 'Dessert',
        'boisson': 'Boisson',
        'aperitif': 'Apéritif',
        'autre': 'Autre',
        'Entrée': 'Entrée',
        'Plat principal': 'Plat principal',
        'Dessert': 'Dessert',
        'Boisson': 'Boisson',
        'Apéritif': 'Apéritif',
        'Autre': 'Autre',
      }
      const normalizedCategory = CATEGORY_MAP[body.category]
      if (!normalizedCategory) {
        return NextResponse.json(
          { error: `Catégorie invalide. Catégories valides : ${Object.values(CATEGORY_MAP).filter((v, i, a) => a.indexOf(v) === i).join(', ')}` },
          { status: 400 }
        )
      }
      updateData.category = normalizedCategory
    }
    if (body.description !== undefined) updateData.description = body.description?.trim() || null
    if (body.price !== undefined) {
      const price = parseFloat(body.price)
      if (isNaN(price) || price <= 0) {
        return NextResponse.json({ error: 'Le prix doit être un nombre positif' }, { status: 400 })
      }
      updateData.price = price
    }
    if (body.is_available !== undefined) updateData.is_available = body.is_available

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
    }

    // Check duplicate name if changing
    if (updateData.name && updateData.name !== existing.name) {
      const { data: duplicate } = await adminClient
        .from('menu_items')
        .select('id')
        .eq('hotel_id', hotelId)
        .eq('name', updateData.name)
        .maybeSingle()

      if (duplicate) {
        return NextResponse.json(
          { error: `Un article nommé "${updateData.name}" existe déjà` },
          { status: 409 }
        )
      }
    }

    const { data: item, error } = await adminClient
      .from('menu_items')
      .update(updateData)
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Un article avec ce nom existe déjà' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Restaurant menu PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/owner/restaurant/menu/[id]
 * Delete a menu item.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!WRITE_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé. Seuls le propriétaire et le manager peuvent supprimer les articles.' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const { id } = await params
    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }

    // Verify item belongs to this hotel
    const { data: existing } = await adminClient
      .from('menu_items')
      .select('id')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    }

    const { error } = await adminClient
      .from('menu_items')
      .delete()
      .eq('id', id)
      .eq('hotel_id', hotelId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Restaurant menu DELETE error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
