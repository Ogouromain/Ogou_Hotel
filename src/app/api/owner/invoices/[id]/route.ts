import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'

const ALLOWED_ROLES_GET = ['owner', 'manager', 'receptionist']
const ALLOWED_ROLES_PATCH = ['owner', 'manager'] // receptionist cannot modify invoices
const VALID_STATUSES = ['refund', 'cancelled'] as const

/**
 * GET /api/owner/invoices/[id]
 * Fetch a single invoice with full details.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!ALLOWED_ROLES_GET.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const { id } = await params
    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 })
    }

    const { data: invoice, error } = await adminClient
      .from('invoices')
      .select('*, customers(*), reservations(id, check_in_date, check_out_date, rooms(id, room_number, room_type)), invoice_items(*)')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .single()

    if (error || !invoice) {
      return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
    }

    return NextResponse.json({ invoice })
  } catch (error) {
    console.error('Owner invoice GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PATCH /api/owner/invoices/[id]
 * Update invoice status (to 'refund' or 'cancelled') and/or notes.
 * Only owner and manager can modify invoices. Financial amounts are immutable.
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
    if (!ALLOWED_ROLES_PATCH.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé. Seuls le propriétaire et le gestionnaire peuvent modifier les factures.' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const { id } = await params
    const body = await request.json()
    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 })
    }

    // ─── Fetch existing invoice ────────────────────────────────
    const { data: existing, error: fetchError } = await adminClient
      .from('invoices')
      .select('*')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
    }

    // ─── Build update payload (only status and notes allowed) ──
    const updateData: Record<string, unknown> = {}
    const oldValues: Record<string, unknown> = {}

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { error: `Statut invalide. Seuls les statuts suivants sont autorisés : ${VALID_STATUSES.join(', ')}` },
          { status: 400 }
        )
      }

      // Cannot change from cancelled or refund back to paid
      if (existing.status === 'cancelled') {
        return NextResponse.json(
          { error: 'Impossible de modifier une facture annulée' },
          { status: 400 }
        )
      }

      if (existing.status === 'refund' && body.status === 'refund') {
        return NextResponse.json(
          { error: 'La facture est déjà en statut remboursé' },
          { status: 400 }
        )
      }

      oldValues.status = existing.status
      updateData.status = body.status
    }

    if (body.notes !== undefined) {
      if (typeof body.notes !== 'string') {
        return NextResponse.json(
          { error: 'Les notes doivent être une chaîne de caractères' },
          { status: 400 }
        )
      }
      oldValues.notes = existing.notes
      updateData.notes = body.notes.trim() || null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Aucune donnée à mettre à jour. Seuls le statut et les notes sont modifiables.' },
        { status: 400 }
      )
    }

    updateData.updated_at = new Date().toISOString()

    // ─── Update invoice ────────────────────────────────────────
    const { data: invoice, error: updateError } = await adminClient
      .from('invoices')
      .update(updateData)
      .eq('id', id)
      .select('*, customers(id, first_name, last_name, phone), reservations(id, check_in_date, check_out_date, rooms(id, room_number, room_type)), invoice_items(*)')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // ─── Audit log ─────────────────────────────────────────────
    await logAudit({
      hotel_id: hotelId,
      profile_id: user.id,
      action: 'update',
      entity_type: 'invoice',
      entity_id: id,
      old_values: oldValues,
      new_values: updateData,
    })

    return NextResponse.json({ invoice })
  } catch (error) {
    console.error('Owner invoice PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
