import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { isDemoMode, DEMO_INVOICES } from '@/lib/demo-data'

const ALLOWED_ROLES = ['owner', 'manager', 'receptionist']
const VALID_STATUSES = ['paid', 'pending', 'refund', 'cancelled'] as const
const VALID_PAYMENT_METHODS = ['OM', 'MTN', 'Wave', 'Espèces', 'Chèque', 'Carte'] as const

/**
 * GET /api/owner/invoices
 * List all invoices for the owner's hotel with optional filters.
 * Query params: status, search, date_from, date_to, payment_method
 */
export async function GET(request: NextRequest) {
  try {
    // ─── Demo mode ──────────────────────────────────────────────
    if (isDemoMode()) {
      const { searchParams } = new URL(request.url)
      const status = searchParams.get('status')
      const search = searchParams.get('search')?.trim()

      let results = [...DEMO_INVOICES]

      if (status) {
        results = results.filter(i => i.status === status)
      }
      if (search) {
        const q = search.toLowerCase()
        results = results.filter(i =>
          i.invoice_number.toLowerCase().includes(q) ||
          (i.customers && `${i.customers.first_name} ${i.customers.last_name}`.toLowerCase().includes(q))
        )
      }

      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      return NextResponse.json({ invoices: results })
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
    if (!adminClient) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')?.trim()
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const paymentMethod = searchParams.get('payment_method')

    let query = adminClient
      .from('invoices')
      .select('*, customers(id, first_name, last_name, phone), reservations(id, check_in_date, check_out_date, room_id), invoice_items(*)')
      .eq('hotel_id', hotelId)

    // Filter by status
    if (status) {
      if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
        return NextResponse.json(
          { error: `Statut invalide. Statuts autorisés : ${VALID_STATUSES.join(', ')}` },
          { status: 400 }
        )
      }
      query = query.eq('status', status)
    }

    // Filter by payment method
    if (paymentMethod) {
      if (!VALID_PAYMENT_METHODS.includes(paymentMethod as typeof VALID_PAYMENT_METHODS[number])) {
        return NextResponse.json(
          { error: `Méthode de paiement invalide. Méthodes autorisées : ${VALID_PAYMENT_METHODS.join(', ')}` },
          { status: 400 }
        )
      }
      query = query.eq('payment_method', paymentMethod)
    }

    // Filter by date range on created_at
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo + 'T23:59:59')
    }

    // Search by invoice_number or customer name
    if (search) {
      query = query.or(`invoice_number.ilike.%${search}%,customers.first_name.ilike.%${search}%,customers.last_name.ilike.%${search}%`)
    }

    query = query.order('created_at', { ascending: false })

    const { data: invoices, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ invoices })
  } catch (error) {
    console.error('Owner invoices GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/owner/invoices
 * Create a new invoice with auto invoice number generation and financial calculations.
 */
export async function POST(request: NextRequest) {
  try {
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
    if (!adminClient) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 })
    }

    const body = await request.json()
    const {
      customer_id,
      payment_method,
      items,
      reservation_id,
      tourist_tax = 0,
      vat_rate = 0.18,
      notes,
      status: invoiceStatus = 'paid',
    } = body

    // ─── Validate required fields ──────────────────────────────
    if (!customer_id) {
      return NextResponse.json(
        { error: 'L\'identifiant client est requis' },
        { status: 400 }
      )
    }

    if (!payment_method) {
      return NextResponse.json(
        { error: 'La méthode de paiement est requise' },
        { status: 400 }
      )
    }

    // Validate invoice status
    const allowedCreationStatuses = ['paid', 'pending'] as const
    if (!allowedCreationStatuses.includes(invoiceStatus)) {
      return NextResponse.json(
        { error: `Statut de facture invalide à la création. Statuts autorisés : ${allowedCreationStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    if (!VALID_PAYMENT_METHODS.includes(payment_method)) {
      return NextResponse.json(
        { error: `Méthode de paiement invalide. Méthodes autorisées : ${VALID_PAYMENT_METHODS.join(', ')}` },
        { status: 400 }
      )
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Au moins un article est requis' },
        { status: 400 }
      )
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item.description || typeof item.description !== 'string' || !item.description.trim()) {
        return NextResponse.json(
          { error: `L'article ${i + 1} doit avoir une description` },
          { status: 400 }
        )
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        return NextResponse.json(
          { error: `L'article ${i + 1} doit avoir une quantité positive` },
          { status: 400 }
        )
      }
      if (typeof item.unit_price !== 'number' || item.unit_price < 0) {
        return NextResponse.json(
          { error: `L'article ${i + 1} doit avoir un prix unitaire valide` },
          { status: 400 }
        )
      }
    }

    // Validate vat_rate
    if (typeof vat_rate !== 'number' || vat_rate < 0 || vat_rate > 1) {
      return NextResponse.json(
        { error: 'Le taux de TVA doit être entre 0 et 1' },
        { status: 400 }
      )
    }

    // Validate tourist_tax
    if (typeof tourist_tax !== 'number' || tourist_tax < 0) {
      return NextResponse.json(
        { error: 'La taxe touristique doit être un montant positif' },
        { status: 400 }
      )
    }

    // ─── Verify customer belongs to this hotel ─────────────────
    const { data: customer } = await adminClient
      .from('customers')
      .select('id, first_name, last_name')
      .eq('id', customer_id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!customer) {
      return NextResponse.json(
        { error: 'Client introuvable ou n\'appartient pas à votre hôtel' },
        { status: 404 }
      )
    }

    // ─── Verify reservation belongs to this hotel (if provided) ─
    if (reservation_id) {
      const { data: reservation } = await adminClient
        .from('reservations')
        .select('id')
        .eq('id', reservation_id)
        .eq('hotel_id', hotelId)
        .maybeSingle()

      if (!reservation) {
        return NextResponse.json(
          { error: 'Réservation introuvable ou n\'appartient pas à votre hôtel' },
          { status: 404 }
        )
      }

      // ─── Check for existing invoice for this reservation ───────
      const { data: existingInvoice } = await adminClient
        .from('invoices')
        .select('id, invoice_number')
        .eq('reservation_id', reservation_id)
        .eq('hotel_id', hotelId)
        .neq('status', 'cancelled')
        .maybeSingle()

      if (existingInvoice) {
        return NextResponse.json(
          { error: `Une facture (${(existingInvoice as Record<string, unknown>).invoice_number}) existe déjà pour cette réservation. Modifiez la facture existante plutôt que d'en créer une nouvelle.` },
          { status: 409 }
        )
      }
    }

    // ─── Calculate financials ──────────────────────────────────
    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; unit_price: number }) =>
        sum + item.quantity * item.unit_price,
      0
    )
    const vat = subtotal * vat_rate
    const totalAmount = subtotal + tourist_tax + vat

    // ─── Auto-generate invoice number ─────────────────────────
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `FACT-${year}-${month}-`

    // Find the last invoice number for this hotel/month
    const { data: lastInvoice } = await adminClient
      .from('invoices')
      .select('invoice_number')
      .eq('hotel_id', hotelId)
      .like('invoice_number', `${prefix}%`)
      .order('invoice_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    let nextCounter = 1
    if (lastInvoice?.invoice_number) {
      const lastCounterStr = lastInvoice.invoice_number.substring(prefix.length)
      const lastCounter = parseInt(lastCounterStr, 10)
      if (!isNaN(lastCounter)) {
        nextCounter = lastCounter + 1
      }
    }

    const invoiceNumber = `${prefix}${String(nextCounter).padStart(4, '0')}`

    // ─── Insert invoice ────────────────────────────────────────
    const { data: invoice, error: insertError } = await adminClient
      .from('invoices')
      .insert({
        hotel_id: hotelId,
        invoice_number: invoiceNumber,
        customer_id,
        reservation_id: reservation_id || null,
        subtotal,
        tourist_tax,
        vat,
        total_amount: totalAmount,
        payment_method,
        status: invoiceStatus,
        notes: notes?.trim() || null,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: `Erreur lors de la création de la facture : ${insertError.message}` },
        { status: 500 }
      )
    }

    // ─── Insert invoice items ──────────────────────────────────
    const invoiceItems = items.map(
      (item: { description: string; quantity: number; unit_price: number }) => ({
        invoice_id: invoice.id,
        description: item.description.trim(),
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.quantity * item.unit_price,
      })
    )

    const { data: insertedItems, error: itemsError } = await adminClient
      .from('invoice_items')
      .insert(invoiceItems)
      .select()

    if (itemsError) {
      // Attempt to clean up the invoice if items fail
      await adminClient.from('invoices').delete().eq('id', invoice.id)
      return NextResponse.json(
        { error: `Erreur lors de l'ajout des articles : ${itemsError.message}` },
        { status: 500 }
      )
    }

    // ─── Fetch complete invoice with relations ─────────────────
    const { data: fullInvoice } = await adminClient
      .from('invoices')
      .select('*, customers(id, first_name, last_name, phone), reservations(id, check_in_date, check_out_date, room_id), invoice_items(*)')
      .eq('id', invoice.id)
      .single()

    // ─── Audit log ─────────────────────────────────────────────
    await logAudit({
      hotel_id: hotelId,
      profile_id: user.id,
      action: 'create',
      entity_type: 'invoice',
      entity_id: invoice.id,
      new_values: {
        invoice_number: invoiceNumber,
        customer_id,
        reservation_id: reservation_id || null,
        subtotal,
        tourist_tax,
        vat,
        total_amount: totalAmount,
        payment_method,
        status: 'paid',
        items_count: items.length,
      },
    })

    return NextResponse.json(
      { invoice: fullInvoice || { ...invoice, invoice_items: insertedItems } },
      { status: 201 }
    )
  } catch (error) {
    console.error('Owner invoices POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
