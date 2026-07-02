import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoMode, DEMO_HOUSEKEEPING_TASKS, DEMO_ROOMS } from '@/lib/demo-data'

const ALLOWED_ROLES = ['housekeeper', 'manager', 'owner']

/**
 * PATCH /api/staff/housekeeping-tasks/[id]
 * Permet au housekeeper de mettre à jour le statut d'une tâche (in_progress, completed).
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
        return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })
      }

      const validStatuses = ['in_progress', 'completed', 'skipped']
      if (!body.status || !validStatuses.includes(body.status)) {
        return NextResponse.json({ error: 'Statut invalide. Utilisez: in_progress, completed, ou skipped' }, { status: 400 })
      }

      existing.status = body.status
      if (body.status === 'completed') {
        existing.completed_at = new Date().toISOString()
      } else {
        existing.completed_at = null
      }
      if (body.notes !== undefined) existing.notes = body.notes

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

    const hotelId = user.app_metadata?.hotel_id
    const role = user.app_metadata?.role

    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 403 })
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Vérifier que la tâche appartient à cet hôtel
    const { data: existingTask } = await adminClient
      .from('housekeeping_tasks')
      .select('id, assigned_to, status')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existingTask) {
      return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })
    }

    // Les housekeepers ne peuvent modifier que leurs propres tâches ou les tâches non assignées
    if (role === 'housekeeper' && existingTask.assigned_to && existingTask.assigned_to !== user.id) {
      return NextResponse.json({ error: 'Vous ne pouvez modifier que vos propres tâches' }, { status: 403 })
    }

    const validStatuses = ['in_progress', 'completed', 'skipped']
    if (!body.status || !validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Statut invalide. Utilisez: in_progress, completed, ou skipped' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {
      status: body.status,
    }

    if (body.status === 'completed') {
      updateData.completed_at = new Date().toISOString()
    } else {
      updateData.completed_at = null
    }

    if (body.notes !== undefined) updateData.notes = body.notes

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
    console.error('Staff housekeeping-tasks PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
