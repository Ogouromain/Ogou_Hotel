import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const WRITE_ROLES = ['owner', 'manager']

/**
 * PATCH /api/owner/stocks/items/[id]
 * Update a stock item.
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
      return NextResponse.json({ error: 'Accès non autorisé. Seuls le propriétaire et le manager peuvent modifier les articles de stock.' }, { status: 403 })
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
      .from('stock_items')
      .select('id, name')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Article de stock introuvable' }, { status: 404 })
    }

    // Build update object
    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.quantity !== undefined) {
      const qty = parseFloat(body.quantity)
      if (isNaN(qty) || qty < 0) {
        return NextResponse.json(
          { error: 'La quantité doit être un nombre positif ou nul' },
          { status: 400 }
        )
      }
      updateData.quantity = qty
    }
    if (body.unit !== undefined) updateData.unit = body.unit.trim()
    if (body.min_threshold !== undefined) {
      const threshold = parseInt(body.min_threshold)
      if (isNaN(threshold) || threshold < 0) {
        return NextResponse.json(
          { error: 'Le seuil minimum doit être un nombre positif ou nul' },
          { status: 400 }
        )
      }
      updateData.min_threshold = threshold
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
    }

    // Check duplicate name if changing
    if (updateData.name && updateData.name !== existing.name) {
      const { data: duplicate } = await adminClient
        .from('stock_items')
        .select('id')
        .eq('hotel_id', hotelId)
        .eq('name', updateData.name)
        .maybeSingle()

      if (duplicate) {
        return NextResponse.json(
          { error: `Un article de stock nommé "${updateData.name}" existe déjà` },
          { status: 409 }
        )
      }
    }

    const { data: item, error } = await adminClient
      .from('stock_items')
      .update(updateData)
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Un article de stock avec ce nom existe déjà' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      item: {
        ...item,
        low_stock: item.quantity <= item.min_threshold,
      },
    })
  } catch (error) {
    console.error('Stock items PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/owner/stocks/items/[id]
 * Delete a stock item (only if no transactions reference it).
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
      return NextResponse.json({ error: 'Accès non autorisé. Seuls le propriétaire et le manager peuvent supprimer les articles de stock.' }, { status: 403 })
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
      .from('stock_items')
      .select('id')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Article de stock introuvable' }, { status: 404 })
    }

    // Check for transactions referencing this item
    const { count } = await adminClient
      .from('stock_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('stock_item_id', id)

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Impossible de supprimer cet article car des transactions y font référence' },
        { status: 400 }
      )
    }

    const { error } = await adminClient
      .from('stock_items')
      .delete()
      .eq('id', id)
      .eq('hotel_id', hotelId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Stock items DELETE error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
