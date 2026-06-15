import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { isDemoMode, DEMO_RESERVATIONS, updateDemoReservationStatus } from '@/lib/demo-data'

const ALLOWED_ROLES = ['owner', 'manager', 'receptionist']

/**
 * GET /api/owner/reservations/[id]
 * Fetch a single reservation with customer and room details.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Demo mode: return in-memory reservation
    if (isDemoMode()) {
      const reservation = DEMO_RESERVATIONS.find(r => r.id === id)
      if (!reservation) {
        return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
      }
      return NextResponse.json({ reservation })
    }

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

    const adminClient = createAdminClient()

    const { data: reservation, error } = await adminClient
      .from('reservations')
      .select('*, customers(*), rooms(id, room_number, room_type, price_per_night, status)')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .single()

    if (error || !reservation) {
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
    }

    return NextResponse.json({ reservation })
  } catch (error) {
    console.error('Owner reservation GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PATCH /api/owner/reservations/[id]
 * Handle status transitions (check_in, check_out, cancel) and date/customer updates.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const action = body.action

    // ─── Demo mode: handle reservation actions in-memory ────────────────
    if (isDemoMode()) {
      if (!action) {
        return NextResponse.json({ error: 'Action requise (check_in, check_out, cancel, update)' }, { status: 400 })
      }

      const reservation = DEMO_RESERVATIONS.find(r => r.id === id)
      if (!reservation) {
        return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
      }

      if (action === 'check_in') {
        if (!['pending', 'confirmed'].includes(reservation.status)) {
          return NextResponse.json(
            { error: `Enregistrement impossible. La réservation doit être en statut "en attente" ou "confirmée". Statut actuel : ${reservation.status}` },
            { status: 400 }
          )
        }
        const updated = updateDemoReservationStatus(id, 'checked_in')
        return NextResponse.json({ reservation: updated })
      }

      if (action === 'check_out') {
        if (reservation.status !== 'checked_in') {
          return NextResponse.json(
            { error: `Départ impossible. La réservation doit être en statut "enregistrée". Statut actuel : ${reservation.status}` },
            { status: 400 }
          )
        }
        const updated = updateDemoReservationStatus(id, 'checked_out')
        return NextResponse.json({ reservation: updated })
      }

      if (action === 'cancel') {
        if (!['pending', 'confirmed'].includes(reservation.status)) {
          return NextResponse.json(
            { error: `Annulation impossible. Statut actuel : ${reservation.status}` },
            { status: 400 }
          )
        }
        reservation.status = 'cancelled'
        reservation.updated_at = new Date().toISOString()
        return NextResponse.json({ reservation: { ...reservation } })
      }

      if (action === 'update') {
        return NextResponse.json({ error: 'Modification non supportée en mode démo' }, { status: 400 })
      }

      return NextResponse.json({ error: 'Action non supportée en mode démo' }, { status: 400 })
    }

    // ─── Normal (Supabase) mode ────────────────────────────────────────
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

    const adminClient = createAdminClient()

    // ─── Fetch existing reservation ────────────────────────────
    const { data: existing, error: fetchError } = await adminClient
      .from('reservations')
      .select('*, customers(id, first_name, last_name), rooms(id, room_number, room_type, price_per_night, status)')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
    }

    // Role-based action restrictions
    const userRole = user.app_metadata?.role

    // Owner can do everything (full oversight authority)
    // Manager can do everything except cancel (requires owner approval in some cases)
    // Receptionist can only perform operational actions (check_in, check_out, update)
    // Receptionist CANNOT cancel reservations (must escalate to manager/owner)
    const CANCEL_ROLES = ['owner', 'manager']
    if (action === 'cancel' && !CANCEL_ROLES.includes(userRole)) {
      return NextResponse.json(
        { error: 'Annulation non autorisée. Seuls le propriétaire et le manager peuvent annuler les réservations.' },
        { status: 403 }
      )
    }

    if (!action) {
      return NextResponse.json({ error: 'Action requise (check_in, check_out, cancel, update)' }, { status: 400 })
    }

    // ═══════════════════════════════════════════════════════════
    // ACTION: check_in
    // ═══════════════════════════════════════════════════════════
    if (action === 'check_in') {
      if (!['pending', 'confirmed'].includes(existing.status)) {
        return NextResponse.json(
          { error: `Enregistrement impossible. La réservation doit être en statut "en attente" ou "confirmée". Statut actuel : ${existing.status}` },
          { status: 400 }
        )
      }

      const oldStatus = existing.status

      // Update reservation status
      const { data: reservation, error: updateError } = await adminClient
        .from('reservations')
        .update({ status: 'checked_in', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, customers(*), rooms(id, room_number, room_type, price_per_night, status)')
        .single()

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      // Update room status to occupied
      await adminClient
        .from('rooms')
        .update({ status: 'occupied', updated_at: new Date().toISOString() })
        .eq('id', existing.room_id)

      // Audit log
      await logAudit({
        hotel_id: hotelId,
        profile_id: user.id,
        action: 'check_in',
        entity_type: 'reservation',
        entity_id: id,
        old_values: { status: oldStatus },
        new_values: { status: 'checked_in', room_status: 'occupied' },
      })

      // Re-fetch with updated room status
      const { data: refreshedReservation } = await adminClient
        .from('reservations')
        .select('*, customers(*), rooms(id, room_number, room_type, price_per_night, status)')
        .eq('id', id)
        .single()

      return NextResponse.json({ reservation: refreshedReservation || reservation })
    }

    // ═══════════════════════════════════════════════════════════
    // ACTION: check_out
    // ═══════════════════════════════════════════════════════════
    if (action === 'check_out') {
      if (existing.status !== 'checked_in') {
        return NextResponse.json(
          { error: `Départ impossible. La réservation doit être en statut "enregistrée". Statut actuel : ${existing.status}` },
          { status: 400 }
        )
      }

      // Update reservation status
      const { data: reservation, error: updateError } = await adminClient
        .from('reservations')
        .update({ status: 'checked_out', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, customers(*), rooms(id, room_number, room_type, price_per_night, status)')
        .single()

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      // Update room status to cleaning (housekeeping required before re-sale)
      await adminClient
        .from('rooms')
        .update({ status: 'cleaning', updated_at: new Date().toISOString() })
        .eq('id', existing.room_id)

      // Audit log
      await logAudit({
        hotel_id: hotelId,
        profile_id: user.id,
        action: 'check_out',
        entity_type: 'reservation',
        entity_id: id,
        old_values: { status: 'checked_in' },
        new_values: { status: 'checked_out', room_status: 'cleaning' },
      })

      // Re-fetch with updated room status
      const { data: refreshedReservation } = await adminClient
        .from('reservations')
        .select('*, customers(*), rooms(id, room_number, room_type, price_per_night, status)')
        .eq('id', id)
        .single()

      return NextResponse.json({ reservation: refreshedReservation || reservation })
    }

    // ═══════════════════════════════════════════════════════════
    // ACTION: cancel
    // ═══════════════════════════════════════════════════════════
    if (action === 'cancel') {
      if (!['pending', 'confirmed'].includes(existing.status)) {
        return NextResponse.json(
          { error: `Annulation impossible. La réservation doit être en statut "en attente" ou "confirmée". Statut actuel : ${existing.status}` },
          { status: 400 }
        )
      }

      const oldStatus = existing.status

      // Update reservation status
      const { data: reservation, error: updateError } = await adminClient
        .from('reservations')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, customers(*), rooms(id, room_number, room_type, price_per_night, status)')
        .single()

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      // Check if there are other active reservations for this room
      const { data: otherActiveReservations } = await adminClient
        .from('reservations')
        .select('id')
        .eq('room_id', existing.room_id)
        .eq('status', 'checked_in')
        .limit(1)

      // Only set room to available if no other checked_in reservations exist
      if (!otherActiveReservations || otherActiveReservations.length === 0) {
        await adminClient
          .from('rooms')
          .update({ status: 'available', updated_at: new Date().toISOString() })
          .eq('id', existing.room_id)
      }

      // Audit log
      await logAudit({
        hotel_id: hotelId,
        profile_id: user.id,
        action: 'cancel',
        entity_type: 'reservation',
        entity_id: id,
        old_values: { status: oldStatus },
        new_values: { status: 'cancelled', room_status: 'available' },
      })

      return NextResponse.json({ reservation })
    }

    // ═══════════════════════════════════════════════════════════
    // ACTION: update (dates, customer_id)
    // ═══════════════════════════════════════════════════════════
    if (action === 'update') {
      if (!['pending', 'confirmed'].includes(existing.status)) {
        return NextResponse.json(
          { error: 'Modification impossible. Seules les réservations en attente ou confirmées peuvent être modifiées.' },
          { status: 400 }
        )
      }

      const updateData: Record<string, unknown> = {}
      const newCheckIn = body.check_in_date || existing.check_in_date
      const newCheckOut = body.check_out_date || existing.check_out_date
      const newRoomId = body.room_id || existing.room_id
      const datesChanged = body.check_in_date || body.check_out_date
      const roomChanged = body.room_id && body.room_id !== existing.room_id

      // Validate new dates if provided
      if (body.check_in_date || body.check_out_date) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/
        if (body.check_in_date && !dateRegex.test(body.check_in_date)) {
          return NextResponse.json({ error: 'Format de date d\'arrivée invalide' }, { status: 400 })
        }
        if (body.check_out_date && !dateRegex.test(body.check_out_date)) {
          return NextResponse.json({ error: 'Format de date de départ invalide' }, { status: 400 })
        }

        const checkIn = new Date(newCheckIn)
        const checkOut = new Date(newCheckOut)

        if (checkOut <= checkIn) {
          return NextResponse.json(
            { error: 'La date de départ doit être postérieure à la date d\'arrivée' },
            { status: 400 }
          )
        }
      }

      // If room changed, verify new room belongs to hotel
      if (roomChanged) {
        const { data: newRoom } = await adminClient
          .from('rooms')
          .select('id, price_per_night')
          .eq('id', body.room_id)
          .eq('hotel_id', hotelId)
          .maybeSingle()

        if (!newRoom) {
          return NextResponse.json(
            { error: 'Chambre introuvable ou n\'appartient pas à votre hôtel' },
            { status: 404 }
          )
        }
      }

      // If customer changed, verify new customer belongs to hotel
      if (body.customer_id && body.customer_id !== existing.customer_id) {
        const { data: newCustomer } = await adminClient
          .from('customers')
          .select('id')
          .eq('id', body.customer_id)
          .eq('hotel_id', hotelId)
          .maybeSingle()

        if (!newCustomer) {
          return NextResponse.json(
            { error: 'Client introuvable ou n\'appartient pas à votre hôtel' },
            { status: 404 }
          )
        }
        updateData.customer_id = body.customer_id
      }

      // Check for date overlap if dates or room changed
      if (datesChanged || roomChanged) {
        const { data: conflictingReservations } = await adminClient
          .from('reservations')
          .select('id, check_in_date, check_out_date, status, customers(first_name, last_name)')
          .eq('room_id', newRoomId)
          .not('status', 'in', '(cancelled,checked_out)')
          .neq('id', id) // Exclude current reservation
          .lt('check_in_date', newCheckOut)
          .gt('check_out_date', newCheckIn)

        if (conflictingReservations && conflictingReservations.length > 0) {
          const conflict = conflictingReservations[0]
          const customerName = conflict.customers
            ? `${(conflict.customers as Record<string, unknown>).first_name} ${(conflict.customers as Record<string, unknown>).last_name}`
            : 'Inconnu'

          return NextResponse.json(
            {
              error: 'La chambre est déjà réservée pour cette période',
              conflict: {
                id: conflict.id,
                check_in_date: conflict.check_in_date,
                check_out_date: conflict.check_out_date,
                status: conflict.status,
                customer: customerName,
              },
            },
            { status: 409 }
          )
        }
      }

      // Recalculate total_price if dates or room changed
      if (datesChanged || roomChanged) {
        const checkIn = new Date(newCheckIn)
        const checkOut = new Date(newCheckOut)
        const diffTime = checkOut.getTime() - checkIn.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        // Fetch room price (use new room price if room changed)
        let pricePerNight = (existing.rooms as Record<string, unknown>)?.price_per_night as number
        if (roomChanged) {
          const { data: newRoom } = await adminClient
            .from('rooms')
            .select('price_per_night')
            .eq('id', body.room_id)
            .eq('hotel_id', hotelId)
            .single()
          pricePerNight = newRoom?.price_per_night ?? pricePerNight
        }

        updateData.total_price = pricePerNight * diffDays
        updateData.check_in_date = newCheckIn
        updateData.check_out_date = newCheckOut
        if (roomChanged) {
          updateData.room_id = body.room_id
        }
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
      }

      updateData.updated_at = new Date().toISOString()

      // Update reservation
      const { data: reservation, error: updateError } = await adminClient
        .from('reservations')
        .update(updateData)
        .eq('id', id)
        .select('*, customers(*), rooms(id, room_number, room_type, price_per_night, status)')
        .single()

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      // Audit log
      await logAudit({
        hotel_id: hotelId,
        profile_id: user.id,
        action: 'update',
        entity_type: 'reservation',
        entity_id: id,
        old_values: {
          check_in_date: existing.check_in_date,
          check_out_date: existing.check_out_date,
          customer_id: existing.customer_id,
          room_id: existing.room_id,
          total_price: existing.total_price,
        },
        new_values: updateData,
      })

      return NextResponse.json({ reservation })
    }

    // Unknown action
    return NextResponse.json(
      { error: 'Action non reconnue. Actions autorisées : check_in, check_out, cancel, update' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Owner reservation PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
