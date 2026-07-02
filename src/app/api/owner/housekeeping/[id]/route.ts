import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoMode, DEMO_HOUSEKEEPING_TASKS, DEMO_ROOMS } from '@/lib/demo-data'

const ALLOWED_ROLES = ['owner', 'manager']

/**
 * PATCH /api/owner/housekeeping/[id]
 * Met à jour une tâche de ménage (statut, assignation, notes, etc.)
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
      const existing = DEMO_HOUSEKEEPING_TASKS.find(t => t.id === id)
      if (!existing) {
        return NextResponse.json({ error: 'Tâche de ménage introuvable' }, { status: 404 })
      }

      // Mise à jour en mémoire
      if (body.status !== undefined) {
        const validStatuses = ['pending', 'in_progress', 'completed', 'skipped']
        if (!validStatuses.includes(body.status)) {
          return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
        }
        existing.status = body.status
        if (body.status === 'completed') {
          existing.completed_at = new Date().toISOString()
        } else {
          existing.completed_at = null
        }
      }
      if (body.assigned_to !== undefined) existing.assigned_to = body.assigned_to
      if (body.notes !== undefined) existing.notes = body.notes
      if (body.priority !== undefined) {
        const validPriorities = ['urgent', 'high', 'normal', 'low']
        if (!validPriorities.includes(body.priority)) {
          return NextResponse.json({ error: 'Priorité invalide' }, { status: 400 })
        }
        existing.priority = body.priority
      }
      if (body.task_type !== undefined) existing.task_type = body.task_type
      if (body.due_date !== undefined) existing.due_date = body.due_date

      // Mettre à jour les données jointes
      const room = DEMO_ROOMS.find(r => r.id === existing.room_id)
      existing.rooms = room
        ? { id: room.id, room_number: room.room_number, room_type: room.room_type, status: room.status }
        : existing.rooms

      return NextResponse.json({ task: { ...existing } })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Seul le propriétaire ou le manager peut modifier les tâches de ménage' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const adminClient = createAdminClient()

    // Vérifier que la tâche appartient à cet hôtel
    const { data: existingTask } = await adminClient
      .from('housekeeping_tasks')
      .select('id')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existingTask) {
      return NextResponse.json({ error: 'Tâche de ménage introuvable' }, { status: 404 })
    }

    // Construire l'objet de mise à jour
    const updateData: Record<string, unknown> = {}
    if (body.status !== undefined) {
      const validStatuses = ['pending', 'in_progress', 'completed', 'skipped']
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
      }
      updateData.status = body.status
      if (body.status === 'completed') {
        updateData.completed_at = new Date().toISOString()
      } else {
        updateData.completed_at = null
      }
    }
    if (body.assigned_to !== undefined) updateData.assigned_to = body.assigned_to || null
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.priority !== undefined) {
      const validPriorities = ['urgent', 'high', 'normal', 'low']
      if (!validPriorities.includes(body.priority)) {
        return NextResponse.json({ error: 'Priorité invalide' }, { status: 400 })
      }
      updateData.priority = body.priority
    }
    if (body.task_type !== undefined) updateData.task_type = body.task_type
    if (body.due_date !== undefined) updateData.due_date = body.due_date

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
    }

    const { data: task, error } = await adminClient
      .from('housekeeping_tasks')
      .update(updateData)
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .select('*, rooms(id, room_number, room_type, status), profiles(id, first_name, last_name)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error('Housekeeping PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/owner/housekeeping/[id]
 * Supprime une tâche de ménage.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // ─── Demo mode ────────────────────────────────────────────
    if (isDemoMode()) {
      const index = DEMO_HOUSEKEEPING_TASKS.findIndex(t => t.id === id)
      if (index === -1) {
        return NextResponse.json({ error: 'Tâche de ménage introuvable' }, { status: 404 })
      }
      DEMO_HOUSEKEEPING_TASKS.splice(index, 1)
      return NextResponse.json({ success: true })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Seul le propriétaire ou le manager peut supprimer les tâches de ménage' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const adminClient = createAdminClient()

    // Vérifier que la tâche appartient à cet hôtel
    const { data: existingTask } = await adminClient
      .from('housekeeping_tasks')
      .select('id')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existingTask) {
      return NextResponse.json({ error: 'Tâche de ménage introuvable' }, { status: 404 })
    }

    const { error } = await adminClient
      .from('housekeeping_tasks')
      .delete()
      .eq('id', id)
      .eq('hotel_id', hotelId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Housekeeping DELETE error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
