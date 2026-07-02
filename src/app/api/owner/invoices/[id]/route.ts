import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { isDemoMode, DEMO_INVOICES } from '@/lib/demo-data'

const ALLOWED_ROLES_GET = ['owner', 'manager', 'receptionist']
const ALLOWED_ROLES_PATCH = ['owner', 'manager'] // receptionist cannot modify invoices
const VALID_STATUSES = ['paid', 'pending', 'refund', 'cancelled'] as const

/**
 * GET /api/owner/invoices/[id]
 * Fetch a single invoice with full details.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // ─── Demo mode ──────────────────────────────────────────────
    if (isDemoMode()) {
      const invoice = DEMO_INVOICES.find(i => i.id === id)
      if (!invoice) {
        return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
      }
      return NextResponse.json({ invoice })
    }

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
    const { id } = await params
    const body = await request.json()

    // ─── Demo mode ──────────────────────────────────────────────
    if (isDemoMode()) {
      const invoice = DEMO_INVOICES.find(i => i.id === id)
      if (!invoice) {
        return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
      }

      if (body.status !== undefined) {
        if (body.status === 'cancelled' && invoice.status === 'cancelled') {
          return NextResponse.json({ error: 'La facture est déjà annulée' }, { status: 400 })
        }
        if (body.status === 'paid' && invoice.status === 'paid') {
          return NextResponse.json({ error: 'La facture est déjà payée' }, { status: 400 })
        }

        invoice.status = body.status
        invoice.updated_at = new Date().toISOString()

        // Auto-generate receipt when marking as paid
        if (body.status === 'paid' && !invoice.receipt_number) {
          const now = new Date()
          const year = now.getFullYear()
          const month = String(now.getMonth() + 1).padStart(2, '0')
          const recPrefix = `REC-${year}-${month}-`
          const lastRec = DEMO_INVOICES
            .filter(i => i.receipt_number && i.receipt_number.startsWith(recPrefix))
            .sort((a, b) => (b.receipt_number || '').localeCompare(a.receipt_number || ''))[0]
          let recCounter = 1
          if (lastRec?.receipt_number) {
            const lastCounterStr = lastRec.receipt_number.substring(recPrefix.length)
            const lastCounter = parseInt(lastCounterStr, 10)
            if (!isNaN(lastCounter)) {
              recCounter = lastCounter + 1
            }
          }
          invoice.receipt_number = `${recPrefix}${String(recCounter).padStart(4, '0')}`
          invoice.paid_at = new Date().toISOString()
        }

        if (body.payment_method) {
          invoice.payment_method = body.payment_method
        }
      }

      if (body.notes !== undefined) {
        invoice.notes = body.notes?.trim() || null
      }

      return NextResponse.json({ invoice })
    }

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

      // Cannot change from cancelled to anything
      if (existing.status === 'cancelled') {
        return NextResponse.json(
          { error: 'Impossible de modifier une facture annulée' },
          { status: 400 }
        )
      }

      // Cannot change from refund back to paid or pending
      if (existing.status === 'refund' && (body.status === 'paid' || body.status === 'pending')) {
        return NextResponse.json(
          { error: 'Impossible de repasser une facture remboursée en payée ou en attente' },
          { status: 400 }
        )
      }

      // Cannot change from paid back to pending
      if (existing.status === 'paid' && body.status === 'pending') {
        return NextResponse.json(
          { error: 'Impossible de repasser une facture payée en attente' },
          { status: 400 }
        )
      }

      // Already same status
      if (existing.status === body.status) {
        return NextResponse.json(
          { error: `La facture est déjà en statut "${body.status}"` },
          { status: 400 }
        )
      }

      oldValues.status = existing.status
      updateData.status = body.status

      // When marking as paid: generate receipt_number and set paid_at
      if (body.status === 'paid' && existing.status !== 'paid') {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const recPrefix = `REC-${year}-${month}-`

        const { data: lastReceipt } = await adminClient
          .from('invoices')
          .select('receipt_number')
          .eq('hotel_id', hotelId)
          .like('receipt_number', `${recPrefix}%`)
          .order('receipt_number', { ascending: false })
          .limit(1)
          .maybeSingle()

        let recCounter = 1
        if (lastReceipt?.receipt_number) {
          const lastCounterStr = lastReceipt.receipt_number.substring(recPrefix.length)
          const lastCounter = parseInt(lastCounterStr, 10)
          if (!isNaN(lastCounter)) {
            recCounter = lastCounter + 1
          }
        }
        updateData.receipt_number = `${recPrefix}${String(recCounter).padStart(4, '0')}`
        updateData.paid_at = now.toISOString()

        // Allow payment_method change when marking as paid
        if (body.payment_method) {
          const VALID_PAYMENT_METHODS = ['OM', 'MTN', 'Wave', 'Espèces', 'Chèque', 'Carte'] as const
          if (VALID_PAYMENT_METHODS.includes(body.payment_method as typeof VALID_PAYMENT_METHODS[number])) {
            oldValues.payment_method = existing.payment_method
            updateData.payment_method = body.payment_method
          }
        }
      }
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
