import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const WRITE_ROLES = ['owner', 'manager']

/**
 * PATCH /api/owner/conference-rooms/[id]
 * Update a conference room.
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
      return NextResponse.json({ error: 'Accès non autorisé. Seuls le propriétaire et le manager peuvent modifier les salles de conférence.' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const { id } = await params
    const body = await request.json()
    const adminClient = createAdminClient()

    // Verify room belongs to this hotel
    const { data: existing } = await adminClient
      .from('conference_rooms')
      .select('id, name')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Salle de conférence introuvable' }, { status: 404 })
    }

    // Build update object
    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.capacity !== undefined) {
      const cap = parseInt(body.capacity)
      if (isNaN(cap) || cap <= 0) {
        return NextResponse.json({ error: 'La capacité doit être un nombre positif' }, { status: 400 })
      }
      updateData.capacity = cap
    }
    if (body.price_per_hour !== undefined) {
      const price = parseFloat(body.price_per_hour)
      if (isNaN(price) || price <= 0) {
        return NextResponse.json({ error: 'Le prix par heure doit être un nombre positif' }, { status: 400 })
      }
      updateData.price_per_hour = price
    }
    if (body.status !== undefined) {
      const validStatuses = ['available', 'occupied', 'maintenance']
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: `Statut invalide. Statuts valides : ${validStatuses.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.status = body.status
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
    }

    // Check duplicate name if changing
    if (updateData.name && updateData.name !== existing.name) {
      const { data: duplicate } = await adminClient
        .from('conference_rooms')
        .select('id')
        .eq('hotel_id', hotelId)
        .eq('name', updateData.name)
        .maybeSingle()

      if (duplicate) {
        return NextResponse.json(
          { error: `Une salle de conférence nommée "${updateData.name}" existe déjà` },
          { status: 409 }
        )
      }
    }

    const { data: room, error } = await adminClient
      .from('conference_rooms')
      .update(updateData)
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Une salle de conférence avec ce nom existe déjà' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ room })
  } catch (error) {
    console.error('Conference rooms PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/owner/conference-rooms/[id]
 * Delete a conference room (check no active bookings).
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
      return NextResponse.json({ error: 'Accès non autorisé. Seuls le propriétaire et le manager peuvent supprimer les salles de conférence.' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const { id } = await params
    const adminClient = createAdminClient()

    // Verify room belongs to this hotel
    const { data: existing } = await adminClient
      .from('conference_rooms')
      .select('id')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Salle de conférence introuvable' }, { status: 404 })
    }

    // Check for active bookings (confirmed status)
    const { count } = await adminClient
      .from('conference_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('conference_room_id', id)
      .eq('status', 'confirmed')

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Impossible de supprimer cette salle car des réservations confirmées y sont associées' },
        { status: 400 }
      )
    }

    const { error } = await adminClient
      .from('conference_rooms')
      .delete()
      .eq('id', id)
      .eq('hotel_id', hotelId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Conference rooms DELETE error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
