import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * PATCH /api/owner/rooms/[id]
 * Update a room (status, price, type, number).
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
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const { id } = await params
    const body = await request.json()
    const adminClient = createAdminClient()

    // Verify room belongs to this hotel
    const { data: existingRoom } = await adminClient
      .from('rooms')
      .select('id, room_number')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existingRoom) {
      return NextResponse.json({ error: 'Chambre introuvable' }, { status: 404 })
    }

    // Build update object (only allow certain fields)
    const updateData: Record<string, unknown> = {}
    if (body.room_number !== undefined) updateData.room_number = body.room_number.trim()
    if (body.room_type !== undefined) updateData.room_type = body.room_type.trim()
    if (body.price_per_night !== undefined) {
      const price = parseFloat(body.price_per_night)
      if (isNaN(price) || price <= 0) {
        return NextResponse.json({ error: 'Le prix par nuit doit être un nombre positif' }, { status: 400 })
      }
      updateData.price_per_night = price
    }
    if (body.status !== undefined) {
      const validStatuses = ['available', 'occupied', 'cleaning', 'maintenance']
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
      }
      updateData.status = body.status
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
    }

    // Check duplicate room number if changing
    if (updateData.room_number && updateData.room_number !== existingRoom.room_number) {
      const { data: duplicate } = await adminClient
        .from('rooms')
        .select('id')
        .eq('hotel_id', hotelId)
        .eq('room_number', updateData.room_number)
        .maybeSingle()

      if (duplicate) {
        return NextResponse.json({ error: `La chambre "${updateData.room_number}" existe déjà` }, { status: 409 })
      }
    }

    const { data: room, error } = await adminClient
      .from('rooms')
      .update(updateData)
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Numéro de chambre déjà utilisé' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ room })
  } catch (error) {
    console.error('Owner rooms PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/owner/rooms/[id]
 * Delete a room from the owner's hotel.
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

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const { id } = await params
    const adminClient = createAdminClient()

    // Verify room belongs to this hotel
    const { data: existingRoom } = await adminClient
      .from('rooms')
      .select('id, room_number, status')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existingRoom) {
      return NextResponse.json({ error: 'Chambre introuvable' }, { status: 404 })
    }

    // Prevent deletion of occupied rooms
    if (existingRoom.status === 'occupied') {
      return NextResponse.json(
        { error: 'Impossible de supprimer une chambre occupée' },
        { status: 400 }
      )
    }

    const { error } = await adminClient
      .from('rooms')
      .delete()
      .eq('id', id)
      .eq('hotel_id', hotelId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Owner rooms DELETE error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
