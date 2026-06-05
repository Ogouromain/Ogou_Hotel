import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = ['restaurant_staff', 'manager', 'owner']

/**
 * PATCH /api/staff/orders/[id]
 * Update order status (pending → preparing → served).
 * Used by restaurant staff.
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

    const validStatuses = ['pending', 'preparing', 'served', 'paid', 'cancelled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Statut invalide. Statuts valides : ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Verify order belongs to this hotel
    const { data: existing } = await adminClient
      .from('restaurant_orders')
      .select('id, status')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
    }

    // Staff can only do: pending → preparing, preparing → served
    // Manager/owner can do full transitions
    const staffTransitions: Record<string, string[]> = {
      pending: ['preparing'],
      preparing: ['served'],
      served: [],
      paid: [],
      cancelled: [],
    }

    const managerTransitions: Record<string, string[]> = {
      pending: ['preparing', 'cancelled'],
      preparing: ['served', 'cancelled'],
      served: ['paid'],
      paid: [],
      cancelled: [],
    }

    const transitions = (role === 'manager' || role === 'owner')
      ? managerTransitions
      : staffTransitions

    const allowed = transitions[existing.status] || []
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `Transition non autorisée : "${existing.status}" → "${status}". Transitions autorisées : ${allowed.join(', ') || 'aucune'}` },
        { status: 400 }
      )
    }

    const { data: order, error } = await adminClient
      .from('restaurant_orders')
      .update({ status })
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ order })
  } catch (error) {
    console.error('Staff orders PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
