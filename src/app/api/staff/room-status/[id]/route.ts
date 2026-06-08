import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = ['receptionist', 'housekeeper', 'manager']

/**
 * PATCH /api/staff/room-status/[id]
 * Update room status (e.g., cleaning → available).
 * Used by housekeepers to mark rooms as clean.
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
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: 'Le statut est requis' }, { status: 400 })
    }

    const validStatuses = ['available', 'occupied', 'cleaning', 'maintenance']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Statut invalide. Statuts valides : ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Verify room belongs to this hotel
    const { data: existing } = await adminClient
      .from('rooms')
      .select('id, room_number, status')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Chambre introuvable' }, { status: 404 })
    }

    // Validate allowed transitions for housekeeper role
    // Housekeepers typically: cleaning → available, maintenance → available
    const allowedTransitions: Record<string, string[]> = {
      cleaning: ['available', 'maintenance'],
      available: ['cleaning', 'maintenance'],
      maintenance: ['available', 'cleaning'],
      occupied: [], // Housekeepers should not change occupied rooms
    }

    const transitionAllowed = allowedTransitions[existing.status] || []
    if (!transitionAllowed.includes(status)) {
      return NextResponse.json(
        { error: `Transition non autorisée : "${existing.status}" → "${status}"` },
        { status: 400 }
      )
    }

    const { data: room, error } = await adminClient
      .from('rooms')
      .update({ status })
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ room })
  } catch (error) {
    console.error('Staff room-status PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
