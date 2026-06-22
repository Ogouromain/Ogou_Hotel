import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { isDemoMode, DEMO_ROOMS, updateDemoRoomStatus } from '@/lib/demo-data'

/**
 * PATCH /api/staff/room-status/[id]
 * Update room status with role-based transition rules.
 *
 * Workflow coherent:
 *   Available → Occupied  (check-in: réceptionniste, manager)
 *   Occupied → Cleaning   (check-out: réceptionniste, manager → room needs cleaning)
 *   Cleaning → Available  (housekeeper validates room is clean: ménage, manager)
 *   Cleaning → Maintenance (housekeeper finds issue: ménage, manager)
 *   Available → Maintenance (owner, manager, réceptionniste)
 *   Maintenance → Cleaning (repair done, needs cleaning: owner, manager, réceptionniste)
 *   Maintenance → Available (clean after repair: ménage, manager)
 *
 * Key rules:
 *   - Ménage can ONLY: cleaning→available, cleaning→maintenance, maintenance→available
 *   - Réceptionniste can: available→maintenance, occupied→cleaning (check-out), maintenance→cleaning
 *     but CANNOT mark cleaning→available (that's the housekeeper's job)
 *   - Manager can do all transitions
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status: newStatus } = body

    if (!newStatus) {
      return NextResponse.json({ error: 'Le statut est requis' }, { status: 400 })
    }

    const validStatuses = ['available', 'occupied', 'cleaning', 'maintenance']
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: `Statut invalide. Statuts valides : ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // ─── Role-based transition rules ─────────────────────────────
    // Workflow coherent :
    //   Available → Occupied   (check-in : réceptionniste, manager)
    //   Occupied → Cleaning    (check-out : réceptionniste, manager → la chambre nécessite un nettoyage)
    //   Cleaning → Available   (ménage valide que la chambre est propre : ménage, manager)
    //   Cleaning → Maintenance (ménage trouve un problème : ménage, manager)
    //   Available → Maintenance (propriétaire, manager, réceptionniste)
    //   Maintenance → Cleaning (réparation terminée, nécessite nettoyage : owner, manager, réceptionniste)
    //
    // Règles clés :
    //   - Le MÉNAGE ne PEUT QUE : cleaning→available, cleaning→maintenance
    //     Il NE PEUT PAS : maintenance→available (il faut d'abord passer par cleaning)
    //   - Le RÉCEPTIONNISTE peut : available→maintenance, occupied→cleaning (check-out), maintenance→cleaning
    //     Il NE PEUT PAS : cleaning→available (c'est le travail du ménage)
    //   - Le Manager peut faire toutes les transitions
    const ROLE_TRANSITIONS: Record<string, Record<string, string[]>> = {
      housekeeper: {
        cleaning: ['available', 'maintenance'],
        maintenance: [],
        available: [],
        occupied: [],
      },
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

    // Demo mode: update in-memory demo data
    if (isDemoMode()) {
      const existing = DEMO_ROOMS.find(r => r.id === id)
      if (!existing) {
        return NextResponse.json({ error: 'Chambre introuvable' }, { status: 404 })
      }

      // Idempotent: if the room is already in the desired status, return success
      // (handles race conditions where the user clicks twice)
      if (existing.status === newStatus) {
        return NextResponse.json({ room: { ...existing }, message: 'La chambre est déjà dans ce statut' })
      }

      // For demo, we don't strictly enforce role transitions but we do validate the transition exists
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

    const hotelId = user.app_metadata?.hotel_id
    const role = user.app_metadata?.role

    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 403 })
    }

    if (!role) {
      return NextResponse.json({ error: 'Rôle non défini' }, { status: 403 })
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }

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

    // Idempotent: if the room is already in the desired status, return success
    // (handles race conditions where the user clicks twice before the UI refreshes)
    if (existing.status === newStatus) {
      return NextResponse.json({ room: existing, message: 'La chambre est déjà dans ce statut' })
    }

    const allowedTransitions = ROLE_TRANSITIONS[role]?.[existing.status] || []
    if (!allowedTransitions.includes(newStatus)) {
      // Provide helpful error messages
      const roleLabel: Record<string, string> = {
        housekeeper: 'Ménage',
        receptionist: 'Réceptionniste',
        manager: 'Manager',
        owner: 'Propriétaire',
      }
      const statusLabel: Record<string, string> = {
        available: 'Disponible',
        occupied: 'Occupée',
        cleaning: 'Nettoyage',
        maintenance: 'Maintenance',
      }

      if (role === 'receptionist' && existing.status === 'cleaning' && newStatus === 'available') {
        return NextResponse.json(
          { error: 'Seul le personnel de ménage peut valider qu\'une chambre est propre après nettoyage.' },
          { status: 400 }
        )
      }

      if (role === 'housekeeper' && existing.status === 'available') {
        return NextResponse.json(
          { error: 'Les chambres disponibles ne nécessitent aucune action de votre part.' },
          { status: 400 }
        )
      }

      if (role === 'housekeeper' && existing.status === 'occupied') {
        return NextResponse.json(
          { error: 'Les chambres occupées ne peuvent être modifiées. Le check-out doit être effectué par le réceptionniste ou le manager.' },
          { status: 400 }
        )
      }

      if (role === 'housekeeper' && existing.status === 'maintenance') {
        return NextResponse.json(
          { error: 'Les chambres en maintenance nécessitent d\'abord une réparation. Le manager ou le réceptionniste doit marquer la réparation comme terminée avant que vous puissiez nettoyer.' },
          { status: 400 }
        )
      }

      if (role === 'manager' && existing.status === 'maintenance' && newStatus === 'available') {
        return NextResponse.json(
          { error: 'Après une maintenance, la chambre doit d\'abord être nettoyée. Veuillez la passer en "Nettoyage" pour que le ménage puisse intervenir.' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        {
          error: `Transition non autorisée pour le rôle ${roleLabel[role] || role} : "${statusLabel[existing.status] || existing.status}" → "${statusLabel[newStatus] || newStatus}". Transitions autorisées : ${allowedTransitions.map(s => statusLabel[s]).join(', ') || 'Aucune'}`,
        },
        { status: 400 }
      )
    }

    // ─── Update room status ──────────────────────────────────────
    const { data: room, error } = await adminClient
      .from('rooms')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .select('id, room_number, room_type, price_per_night, status')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ─── Audit log ───────────────────────────────────────────────
    await logAudit({
      hotel_id: hotelId,
      profile_id: user.id,
      action: 'room_status_change',
      entity_type: 'room',
      entity_id: id,
      old_values: { status: existing.status },
      new_values: { status: newStatus },
    })

    return NextResponse.json({ room })
  } catch (error) {
    console.error('Staff room-status PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
