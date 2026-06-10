import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const WRITE_ROLES = ['owner', 'manager']

/**
 * PATCH /api/owner/expenses/[id]
 * Update an expense (amount, description, category, date, payment method).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!WRITE_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }

    // Verify expense belongs to hotel
    const { data: existing } = await adminClient
      .from('expenses')
      .select('id')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Dépense introuvable' }, { status: 404 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}

    if (body.description !== undefined) {
      if (!body.description.trim()) {
        return NextResponse.json({ error: 'La description ne peut pas être vide' }, { status: 400 })
      }
      updates.description = body.description.trim()
    }
    if (body.amount !== undefined) {
      const amount = parseInt(body.amount)
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Le montant doit être un nombre positif' }, { status: 400 })
      }
      updates.amount = amount
    }
    if (body.category_id !== undefined) {
      updates.category_id = body.category_id || null
    }
    if (body.expense_date !== undefined) {
      updates.expense_date = body.expense_date
    }
    if (body.payment_method !== undefined) {
      updates.payment_method = body.payment_method || null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucune modification fournie' }, { status: 400 })
    }

    const { data: expense, error } = await adminClient
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .select('*, expense_categories(*)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ expense })
  } catch (error) {
    console.error('Expenses PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/owner/expenses/[id]
 * Delete an expense.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!WRITE_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }

    // Verify expense belongs to hotel
    const { data: existing } = await adminClient
      .from('expenses')
      .select('id, description')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Dépense introuvable' }, { status: 404 })
    }

    const { error } = await adminClient
      .from('expenses')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Expenses DELETE error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
