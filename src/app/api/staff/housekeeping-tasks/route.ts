import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoMode, DEMO_HOUSEKEEPING_TASKS, DEMO_ROOMS } from '@/lib/demo-data'

const ALLOWED_ROLES = ['housekeeper', 'manager', 'owner']

/**
 * GET /api/staff/housekeeping-tasks
 * Récupère les tâches de ménage assignées au housekeeper connecté pour aujourd'hui.
 */
export async function GET() {
  try {
    // Demo mode: retourner les tâches du jour
    if (isDemoMode()) {
      const today = new Date().toISOString().split('T')[0]
      const tasks = DEMO_HOUSEKEEPING_TASKS
        .filter(t => t.due_date === today)
        .map(t => {
          const room = DEMO_ROOMS.find(r => r.id === t.room_id)
          return {
            ...t,
            rooms: room ? { id: room.id, room_number: room.room_number, room_type: room.room_type, status: room.status } : t.rooms,
          }
        })

      return NextResponse.json({ tasks })
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
    const today = new Date().toISOString().split('T')[0]

    // Pour un housekeeper, on filtre par assigned_to ou tâches non assignées
    let query = adminClient
      .from('housekeeping_tasks')
      .select('*, rooms(id, room_number, room_type, status), profiles(id, first_name, last_name)')
      .eq('hotel_id', hotelId)
      .eq('due_date', today)
      .order('priority', { ascending: false })

    // Les housekeepers ne voient que leurs tâches ou les tâches non assignées
    if (role === 'housekeeper') {
      query = query.or(`assigned_to.eq.${user.id},assigned_to.is.null`)
    }

    const { data: tasks, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tasks: tasks || [] })
  } catch (error) {
    console.error('Staff housekeeping-tasks GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
