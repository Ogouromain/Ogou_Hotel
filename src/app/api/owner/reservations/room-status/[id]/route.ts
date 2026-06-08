import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'

const ALLOWED_ROLES = ['manager', 'receptionist']

// Valid room status transitions for quick status updates
// Receptionist can mark rooms as available after cleaning, or set cleaning/maintenance
const VALID_TRANSITIONS: Record<string, string[]> = {
  available: ['cleaning', 'maintenance'],
  cleaning: ['available', 'maintenance'],
  maintenance: ['available', 'cleaning'],
  occupied: [], // Occupied rooms can only be changed via check-out
}

/**
 * PATCH /api/owner/reservations/room-status/[id]
 * Quick room status update (e.g., mark cleaning room as available after housekeeping).
 * Valid transitions: cleaning → available, maintenance → available
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
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const { id } = await params
    const body = await request.json()
    const { status: newStatus } = body

    if (!newStatus) {
      return NextResponse.json({ error: 'Nouveau statut requis' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // ─── Verify room belongs to this hotel ─────────────────────
    const { data: room, error: fetchError } = await adminClient
      .from('rooms')
      .select('id, room_number, room_type, price_per_night, status')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .single()

    if (fetchError || !room) {
      return NextResponse.json({ error: 'Chambre introuvable' }, { status: 404 })
    }

    const currentStatus = room.status

    // ─── Validate transition ───────────────────────────────────
    const allowedNewStatuses = VALID_TRANSITIONS[currentStatus]
    if (!allowedNewStatuses || allowedNewStatuses.length === 0) {
      return NextResponse.json(
        { error: `Aucune transition autorisée depuis le statut "${currentStatus}". Les chambres occupées ne peuvent être modifiées que via un check-out.` },
        { status: 400 }
      )
    }

    if (!allowedNewStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: `Transition non autorisée : "${currentStatus}" → "${newStatus}". Transitions autorisées depuis "${currentStatus}" : ${allowedNewStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // ─── Update room status ────────────────────────────────────
    const { data: updatedRoom, error: updateError } = await adminClient
      .from('rooms')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, room_number, room_type, price_per_night, status')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // ─── Audit log ─────────────────────────────────────────────
    await logAudit({
      hotel_id: hotelId,
      profile_id: user.id,
      action: 'room_status_change',
      entity_type: 'room',
      entity_id: id,
      old_values: { status: currentStatus },
      new_values: { status: newStatus },
    })

    return NextResponse.json({ room: updatedRoom })
  } catch (error) {
    console.error('Room status PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
