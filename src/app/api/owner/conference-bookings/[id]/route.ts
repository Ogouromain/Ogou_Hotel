import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const WRITE_ROLES = ['owner', 'manager']

/**
 * Valid conference booking status transitions:
 * confirmed → cancelled
 * confirmed → completed
 * cancelled → (no further transitions)
 * completed → (no further transitions)
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  confirmed: ['cancelled', 'completed'],
  cancelled: [],
  completed: [],
}

/**
 * PATCH /api/owner/conference-bookings/[id]
 * Update booking status.
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
      return NextResponse.json({ error: 'Accès non autorisé. Seuls le propriétaire et le manager peuvent modifier les réservations de salle.' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: 'Le statut est requis' }, { status: 400 })
    }

    const validStatuses = ['confirmed', 'cancelled', 'completed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Statut invalide. Statuts valides : ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Verify booking belongs to this hotel
    const { data: existing } = await adminClient
      .from('conference_bookings')
      .select('id, status')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
    }

    // Validate transition
    const allowed = VALID_TRANSITIONS[existing.status] || []
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `Transition invalide : "${existing.status}" → "${status}". Transitions autorisées : ${allowed.join(', ') || 'aucune'}` },
        { status: 400 }
      )
    }

    const { data: booking, error } = await adminClient
      .from('conference_bookings')
      .update({ status })
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ booking })
  } catch (error) {
    console.error('Conference bookings PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
