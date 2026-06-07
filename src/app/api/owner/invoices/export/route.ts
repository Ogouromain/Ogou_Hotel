import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = ['owner', 'manager', 'receptionist']

/**
 * GET /api/owner/invoices/export
 * Export invoices as CSV file for the owner's hotel.
 * Query params: status, search, date_from, date_to, payment_method, format (csv)
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')?.trim()
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const paymentMethod = searchParams.get('payment_method')

    let query = adminClient
      .from('invoices')
      .select('*, customers(id, first_name, last_name, phone), invoice_items(id)')
      .eq('hotel_id', hotelId)

    if (status) query = query.eq('status', status)
    if (paymentMethod) query = query.eq('payment_method', paymentMethod)
    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59')
    if (search) {
      query = query.or(`invoice_number.ilike.%${search}%,customers.first_name.ilike.%${search}%,customers.last_name.ilike.%${search}%`)
    }

    query = query.order('created_at', { ascending: false })

    const { data: invoices, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Generate CSV
    const BOM = '\uFEFF'
    const sep = ';'

    const PAYMENT_LABELS: Record<string, string> = {
      'OM': 'Orange Money',
      'MTN': 'MTN Money',
      'Wave': 'Wave',
      'Espèces': 'Espèces',
      'Chèque': 'Chèque',
      'Carte': 'Carte bancaire',
    }
    const STATUS_LABELS: Record<string, string> = {
      'paid': 'Payée',
      'refund': 'Remboursée',
      'cancelled': 'Annulée',
    }

    function fmtFCFA(n: number): string {
      return new Intl.NumberFormat('fr-FR').format(n)
    }

    function fmtDate(d: string): string {
      try { return new Date(d).toLocaleDateString('fr-FR') } catch { return d }
    }

    const header = [
      'N° Facture', 'Client', 'Téléphone', 'Sous-total HT (FCFA)',
      'Taxe de séjour (FCFA)', 'TVA 18% (FCFA)', 'Total TTC (FCFA)',
      'Mode de paiement', 'Statut', 'Date de création', 'Nb Articles'
    ].map(h => `"${h}"`).join(sep)

    const rows = (invoices || []).map((inv: Record<string, unknown>) => {
      const customer = inv.customers as Record<string, unknown> | null
      const items = inv.invoice_items as unknown[] | null
      const customerName = customer ? `${customer.first_name} ${customer.last_name}` : 'N/A'
      const customerPhone = customer ? String(customer.phone || '') : ''

      return [
        `"${inv.invoice_number}"`,
        `"${customerName}"`,
        `"${customerPhone}"`,
        `"${fmtFCFA(Number(inv.subtotal) || 0)}"`,
        `"${fmtFCFA(Number(inv.tourist_tax) || 0)}"`,
        `"${fmtFCFA(Number(inv.vat) || 0)}"`,
        `"${fmtFCFA(Number(inv.total_amount) || 0)}"`,
        `"${PAYMENT_LABELS[String(inv.payment_method)] || String(inv.payment_method)}"`,
        `"${STATUS_LABELS[String(inv.status)] || String(inv.status)}"`,
        `"${fmtDate(String(inv.created_at))}"`,
        `"${items?.length || 0}"`,
      ].join(sep)
    })

    const csv = BOM + header + '\n' + rows.join('\n')

    // Generate filename with current date
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const filename = `factures_ogou_hotel_${dateStr}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Invoice export error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
