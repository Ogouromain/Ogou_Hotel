import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { isDemoMode, DEMO_ROOMS, updateDemoRoomStatus } from '@/lib/demo-data'

/**
 * PATCH /api/owner/reservations/room-status/[id]
 * Quick room status update for owner/manager/receptionist.
 *
 * Workflow cohérent :
 *   - Réceptionniste : available→maintenance, occupied→cleaning (check-out), maintenance→cleaning
 *     NE PEUT PAS : cleaning→available (c'est le travail du ménage !)
 *   - Manager : available→maintenance, occupied→cleaning, cleaning→available/maintenance, maintenance→cleaning
 *     Après une maintenance, la chambre DOIT passer par le nettoyage avant d'être disponible
 *   - Owner : contrôle total
 */

// ─── Role-based transition rules ─────────────────────────────
const ROLE_TRANSITIONS: Record<string, Record<string, string[]>> = {
  receptionist: {
    available: ['maintenance'],
    occupied: ['cleaning'],
    cleaning: [],
    maintenance: ['cleaning'],
  },
  manager: {
    available: ['maintenance'],
    occupied: ['cleaning'],
    cleaning: ['available', 'maintenance'],
    maintenance: ['cleaning'],
  },
  owner: {
    available: ['occupied', 'cleaning', 'maintenance'],
    occupied: ['cleaning'],
    cleaning: ['available', 'maintenance'],
    maintenance: ['available', 'cleaning'],
  },
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status: newStatus } = body

    if (!newStatus) {
      return NextResponse.json({ error: 'Nouveau statut requis' }, { status: 400 })
    }

    // Demo mode: update in-memory demo data
    if (isDemoMode()) {
      const existing = DEMO_ROOMS.find(r => r.id === id)
      if (!existing) {
        return NextResponse.json({ error: 'Chambre introuvable' }, { status: 404 })
      }

      const allowedTransitions = ROLE_TRANSITIONS['owner']?.[existing.status] || []
      if (!allowedTransitions.includes(newStatus)) {
        return NextResponse.json(
          { error: `Transition non autorisée : "${existing.status}" → "${newStatus}"` },
          { status: 400 }
        )
      }

      const room = updateDemoRoomStatus(id, newStatus)
      return NextResponse.json({ room })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    const ALLOWED_ROLES = ['manager', 'receptionist', 'owner']
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }

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

    const allowedNewStatuses = ROLE_TRANSITIONS[role]?.[currentStatus] || []

    if (allowedNewStatuses.length === 0) {
      const statusLabel: Record<string, string> = {
        available: 'Disponible',
        occupied: 'Occupée',
        cleaning: 'Nettoyage',
        maintenance: 'Maintenance',
      }

      if (role === 'receptionist' && currentStatus === 'cleaning') {
        return NextResponse.json(
          { error: 'Vous ne pouvez pas modifier le statut d\'une chambre en nettoyage. Seul le personnel de ménage peut valider qu\'une chambre est propre.' },
          { status: 400 }
        )
      }

      if (currentStatus === 'occupied') {
        return NextResponse.json(
          { error: `Les chambres occupées ne peuvent être modifiées que via un check-out (statut → Nettoyage).` },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: `Aucune transition autorisée depuis le statut "${statusLabel[currentStatus] || currentStatus}".` },
        { status: 400 }
      )
    }

    if (!allowedNewStatuses.includes(newStatus)) {
      const statusLabel: Record<string, string> = {
        available: 'Disponible',
        occupied: 'Occupée',
        cleaning: 'Nettoyage',
        maintenance: 'Maintenance',
      }

      if (role === 'receptionist' && currentStatus === 'cleaning' && newStatus === 'available') {
        return NextResponse.json(
          { error: 'Seul le personnel de ménage peut valider qu\'une chambre est propre après nettoyage.' },
          { status: 400 }
        )
      }

      if (role === 'manager' && currentStatus === 'maintenance' && newStatus === 'available') {
        return NextResponse.json(
          { error: 'Après une maintenance, la chambre doit d\'abord être nettoyée. Veuillez la passer en "Nettoyage" pour que le ménage puisse intervenir.' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        {
          error: `Transition non autorisée : "${statusLabel[currentStatus]}" → "${statusLabel[newStatus]}". Transitions autorisées : ${allowedNewStatuses.map(s => statusLabel[s]).join(', ')}`,
        },
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
