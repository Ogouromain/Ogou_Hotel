import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoMode, DEMO_ROOM_RATES } from '@/lib/demo-data'

const ALLOWED_ROLES = ['owner', 'manager']

/**
 * PATCH /api/owner/room-rates/[id]
 * Update a seasonal rate.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // ─── Demo mode ────────────────────────────────────────────
    if (isDemoMode()) {
      const existing = DEMO_ROOM_RATES.find(r => r.id === id)
      if (!existing) {
        return NextResponse.json({ error: 'Tarif saisonnier introuvable' }, { status: 404 })
      }
      // Update in-memory
      if (body.name !== undefined) existing.name = body.name
      if (body.price_per_night !== undefined) {
        const price = parseFloat(body.price_per_night)
        if (isNaN(price) || price <= 0) {
          return NextResponse.json({ error: 'Le prix par nuit doit être un nombre positif' }, { status: 400 })
        }
        existing.price_per_night = price
      }
      if (body.start_date !== undefined) existing.start_date = body.start_date
      if (body.end_date !== undefined) existing.end_date = body.end_date
      if (body.priority !== undefined) existing.priority = parseInt(body.priority)
      return NextResponse.json({ rate: { ...existing } })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Seul le propriétaire ou le manager peut modifier les tarifs saisonniers' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const adminClient = createAdminClient()

    // Verify rate belongs to this hotel
    const { data: existingRate } = await adminClient
      .from('room_rates')
      .select('id')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existingRate) {
      return NextResponse.json({ error: 'Tarif saisonnier introuvable' }, { status: 404 })
    }

    // Build update object
    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.price_per_night !== undefined) {
      const price = parseFloat(body.price_per_night)
      if (isNaN(price) || price <= 0) {
        return NextResponse.json({ error: 'Le prix par nuit doit être un nombre positif' }, { status: 400 })
      }
      updateData.price_per_night = price
    }
    if (body.start_date !== undefined) updateData.start_date = body.start_date
    if (body.end_date !== undefined) updateData.end_date = body.end_date
    if (body.priority !== undefined) updateData.priority = parseInt(body.priority)

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
    }

    const { data: rate, error } = await adminClient
      .from('room_rates')
      .update(updateData)
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ rate })
  } catch (error) {
    console.error('Room rates PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/owner/room-rates/[id]
 * Delete a seasonal rate.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // ─── Demo mode ────────────────────────────────────────────
    if (isDemoMode()) {
      const index = DEMO_ROOM_RATES.findIndex(r => r.id === id)
      if (index === -1) {
        return NextResponse.json({ error: 'Tarif saisonnier introuvable' }, { status: 404 })
      }
      DEMO_ROOM_RATES.splice(index, 1)
      return NextResponse.json({ success: true })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Seul le propriétaire ou le manager peut supprimer les tarifs saisonniers' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const adminClient = createAdminClient()

    // Verify rate belongs to this hotel
    const { data: existingRate } = await adminClient
      .from('room_rates')
      .select('id')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existingRate) {
      return NextResponse.json({ error: 'Tarif saisonnier introuvable' }, { status: 404 })
    }

    const { error } = await adminClient
      .from('room_rates')
      .delete()
      .eq('id', id)
      .eq('hotel_id', hotelId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Room rates DELETE error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
