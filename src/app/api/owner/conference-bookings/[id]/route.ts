import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoMode, DEMO_CONFERENCE_BOOKINGS } from '@/lib/demo-data'

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

// Types d'événements valides
const VALID_EVENT_TYPES = [
  'seminar', 'workshop', 'wedding', 'corporate_meeting',
  'birthday', 'conference', 'other',
]

/**
 * PATCH /api/owner/conference-bookings/[id]
 * Update booking status and/or event planning fields.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      status,
      // Champs planification événement
      event_name, event_type, attendees_count, catering_required,
      equipment_needs, setup_notes, contact_name, contact_phone,
    } = body

    // Vérifier qu'au moins un champ est fourni
    const hasStatusUpdate = !!status
    const hasEventUpdate = event_name !== undefined || event_type !== undefined ||
      attendees_count !== undefined || catering_required !== undefined ||
      equipment_needs !== undefined || setup_notes !== undefined ||
      contact_name !== undefined || contact_phone !== undefined

    if (!hasStatusUpdate && !hasEventUpdate) {
      return NextResponse.json({ error: 'Au moins un champ à modifier est requis' }, { status: 400 })
    }

    // Mode démo : mettre à jour en mémoire
    if (isDemoMode()) {
      const booking = DEMO_CONFERENCE_BOOKINGS.find(b => b.id === id)
      if (!booking) {
        return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
      }

      // Traitement du statut
      if (hasStatusUpdate) {
        const validStatuses = ['confirmed', 'cancelled', 'completed']
        if (!validStatuses.includes(status)) {
          return NextResponse.json(
            { error: `Statut invalide. Statuts valides : ${validStatuses.join(', ')}` },
            { status: 400 }
          )
        }
        const allowed = VALID_TRANSITIONS[booking.status] || []
        if (!allowed.includes(status)) {
          return NextResponse.json(
            { error: `Transition invalide : "${booking.status}" → "${status}". Transitions autorisées : ${allowed.join(', ') || 'aucune'}` },
            { status: 400 }
          )
        }
        booking.status = status as 'confirmed' | 'cancelled' | 'completed'
      }

      // Traitement des champs événement
      if (event_name !== undefined) booking.event_name = event_name || null
      if (event_type !== undefined) {
        if (event_type && !VALID_EVENT_TYPES.includes(event_type)) {
          return NextResponse.json(
            { error: `Type d'événement invalide. Types valides : ${VALID_EVENT_TYPES.join(', ')}` },
            { status: 400 }
          )
        }
        booking.event_type = event_type || null
      }
      if (attendees_count !== undefined) {
        if (attendees_count !== null) {
          const ac = parseInt(String(attendees_count))
          if (isNaN(ac) || ac < 1) {
            return NextResponse.json(
              { error: 'Le nombre de participants doit être un entier positif' },
              { status: 400 }
            )
          }
          booking.attendees_count = ac
        } else {
          booking.attendees_count = null
        }
      }
      if (catering_required !== undefined) booking.catering_required = Boolean(catering_required)
      if (equipment_needs !== undefined) booking.equipment_needs = equipment_needs || null
      if (setup_notes !== undefined) booking.setup_notes = setup_notes || null
      if (contact_name !== undefined) booking.contact_name = contact_name || null
      if (contact_phone !== undefined) booking.contact_phone = contact_phone || null

      booking.updated_at = new Date().toISOString()
      return NextResponse.json({ booking })
    }

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

    // Construire l'objet de mise à jour
    const updateData: Record<string, unknown> = {}

    // Traitement du statut
    if (hasStatusUpdate) {
      const validStatuses = ['confirmed', 'cancelled', 'completed']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Statut invalide. Statuts valides : ${validStatuses.join(', ')}` },
          { status: 400 }
        )
      }

      // Validate transition
      const allowed = VALID_TRANSITIONS[existing.status] || []
      if (!allowed.includes(status)) {
        return NextResponse.json(
          { error: `Transition invalide : "${existing.status}" → "${status}". Transitions autorisées : ${allowed.join(', ') || 'aucune'}` },
          { status: 400 }
        )
      }
      updateData.status = status
    }

    // Traitement des champs événement
    if (event_name !== undefined) updateData.event_name = event_name || null
    if (event_type !== undefined) {
      if (event_type && !VALID_EVENT_TYPES.includes(event_type)) {
        return NextResponse.json(
          { error: `Type d'événement invalide. Types valides : ${VALID_EVENT_TYPES.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.event_type = event_type || null
    }
    if (attendees_count !== undefined) {
      if (attendees_count !== null) {
        const ac = parseInt(String(attendees_count))
        if (isNaN(ac) || ac < 1) {
          return NextResponse.json(
            { error: 'Le nombre de participants doit être un entier positif' },
            { status: 400 }
          )
        }
        updateData.attendees_count = ac
      } else {
        updateData.attendees_count = null
      }
    }
    if (catering_required !== undefined) {
      updateData.catering_required = Boolean(catering_required)
    }
    if (equipment_needs !== undefined) {
      updateData.equipment_needs = equipment_needs || null
    }
    if (setup_notes !== undefined) {
      updateData.setup_notes = setup_notes || null
    }
    if (contact_name !== undefined) {
      updateData.contact_name = contact_name || null
    }
    if (contact_phone !== undefined) {
      updateData.contact_phone = contact_phone || null
    }

    const { data: booking, error } = await adminClient
      .from('conference_bookings')
      .update(updateData)
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
