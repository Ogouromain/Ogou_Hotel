import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoMode, DEMO_HOUSEKEEPING_TASKS, DEMO_ROOMS } from '@/lib/demo-data'

const ALLOWED_ROLES_GET = ['owner', 'manager', 'receptionist']
const ALLOWED_ROLES_POST = ['owner', 'manager']

/**
 * GET /api/owner/housekeeping
 * Liste les tâches de ménage avec filtres optionnels.
 * Query params: date, status, assigned_to, room_id
 */
export async function GET(request: NextRequest) {
  try {
    // Demo mode: retourner les tâches en mémoire
    if (isDemoMode()) {
      const { searchParams } = new URL(request.url)
      const date = searchParams.get('date')
      const status = searchParams.get('status')
      const assignedTo = searchParams.get('assigned_to')
      const roomId = searchParams.get('room_id')

      let tasks = DEMO_HOUSEKEEPING_TASKS.map(t => ({
        ...t,
        rooms: DEMO_ROOMS.find(r => r.id === t.room_id)
          ? { id: t.room_id, room_number: DEMO_ROOMS.find(r => r.id === t.room_id)!.room_number, room_type: DEMO_ROOMS.find(r => r.id === t.room_id)!.room_type, status: DEMO_ROOMS.find(r => r.id === t.room_id)!.status }
          : t.rooms,
      }))

      if (date) tasks = tasks.filter(t => t.due_date === date)
      if (status) tasks = tasks.filter(t => t.status === status)
      if (assignedTo) tasks = tasks.filter(t => t.assigned_to === assignedTo)
      if (roomId) tasks = tasks.filter(t => t.room_id === roomId)

      return NextResponse.json({ tasks })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!ALLOWED_ROLES_GET.includes(role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const status = searchParams.get('status')
    const assignedTo = searchParams.get('assigned_to')
    const roomId = searchParams.get('room_id')

    const adminClient = createAdminClient()
    let query = adminClient
      .from('housekeeping_tasks')
      .select('*, rooms(id, room_number, room_type, status), profiles(id, first_name, last_name)')
      .eq('hotel_id', hotelId)
      .order('due_date', { ascending: true })
      .order('priority', { ascending: false })

    if (date) query = query.eq('due_date', date)
    if (status) query = query.eq('status', status)
    if (assignedTo) query = query.eq('assigned_to', assignedTo)
    if (roomId) query = query.eq('room_id', roomId)

    const { data: tasks, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('Housekeeping GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/owner/housekeeping
 * Crée une nouvelle tâche de ménage.
 */
export async function POST(request: NextRequest) {
  try {
    // Demo mode: créer en mémoire
    if (isDemoMode()) {
      const body = await request.json()
      const { room_id, task_type, priority, assigned_to, due_date, notes } = body

      if (!room_id || !due_date) {
        return NextResponse.json(
          { error: 'Chambre et date d\'échéance sont requises' },
          { status: 400 }
        )
      }

      const room = DEMO_ROOMS.find(r => r.id === room_id)
      if (!room) {
        return NextResponse.json({ error: 'Chambre introuvable' }, { status: 404 })
      }

      const newTask = {
        id: `htask-${Date.now()}`,
        hotel_id: 'demo-hotel-0001',
        room_id,
        assigned_to: assigned_to || null,
        task_type: task_type || 'checkout_cleaning',
        priority: priority || 'normal',
        status: 'pending' as const,
        notes: notes || null,
        due_date,
        completed_at: null,
        created_at: new Date().toISOString(),
        rooms: { id: room.id, room_number: room.room_number, room_type: room.room_type, status: room.status },
        profiles: null,
      }

      DEMO_HOUSEKEEPING_TASKS.push(newTask)
      return NextResponse.json({ task: newTask }, { status: 201 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!ALLOWED_ROLES_POST.includes(role)) {
      return NextResponse.json({ error: 'Seul le propriétaire ou le manager peut créer des tâches de ménage' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const body = await request.json()
    const { room_id, task_type, priority, assigned_to, due_date, notes } = body

    // ─── Validation ──────────────────────────────────────────
    if (!room_id || !due_date) {
      return NextResponse.json(
        { error: 'Chambre et date d\'échéance sont requises' },
        { status: 400 }
      )
    }

    const validTaskTypes = ['checkout_cleaning', 'deep_cleaning', 'maintenance_cleaning', 'inspection']
    if (task_type && !validTaskTypes.includes(task_type)) {
      return NextResponse.json({ error: 'Type de tâche invalide' }, { status: 400 })
    }

    const validPriorities = ['urgent', 'high', 'normal', 'low']
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json({ error: 'Priorité invalide' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // ─── Vérifier que la chambre appartient à cet hôtel ──────
    const { data: room } = await adminClient
      .from('rooms')
      .select('id, room_number, room_type, status')
      .eq('id', room_id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!room) {
      return NextResponse.json({ error: 'Chambre introuvable ou n\'appartient pas à votre hôtel' }, { status: 404 })
    }

    // ─── Si assigned_to, vérifier que le profil est un housekeeper du même hôtel ──
    if (assigned_to) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('id, first_name, last_name, role, hotel_id')
        .eq('id', assigned_to)
        .eq('hotel_id', hotelId)
        .maybeSingle()

      if (!profile) {
        return NextResponse.json({ error: 'Employé introuvable ou n\'appartient pas à votre hôtel' }, { status: 404 })
      }
    }

    // ─── Créer la tâche ─────────────────────────────────────
    const insertData: Record<string, unknown> = {
      hotel_id: hotelId,
      room_id,
      task_type: task_type || 'checkout_cleaning',
      priority: priority || 'normal',
      status: 'pending',
      due_date,
    }

    if (assigned_to) insertData.assigned_to = assigned_to
    if (notes) insertData.notes = notes

    const { data: task, error } = await adminClient
      .from('housekeeping_tasks')
      .insert(insertData)
      .select('*, rooms(id, room_number, room_type, status), profiles(id, first_name, last_name)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error('Housekeeping POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
