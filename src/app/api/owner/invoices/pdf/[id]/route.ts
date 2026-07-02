import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoMode, DEMO_INVOICES } from '@/lib/demo-data'

const ALLOWED_ROLES = ['owner', 'manager', 'receptionist']

/**
 * GET /api/owner/invoices/pdf/[id]
 * Generate a server-rendered HTML invoice for PDF download/print.
 * Returns HTML that the browser can print as PDF.
 * Query param: format=a4|thermal (default: a4)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'a4'
    const isReceipt = searchParams.get('type') === 'receipt'

    // ─── Demo mode ──────────────────────────────────────────────
    if (isDemoMode()) {
      const invoice = DEMO_INVOICES.find(i => i.id === id)
      if (!invoice) {
        return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
      }

      const hotelName = 'Hôtel OGOU Palace'
      const hotelAddress = '12 Boulevard Latrille, Cocody'
      const hotelCity = 'Abidjan'
      const hotelPhone = '+225 05 76 10 32 77'
      const hotelEmail = 'contact@ogou-hotel.ci'

      const items = invoice.invoice_items || []
      const customer = invoice.customers
      const customerName = customer ? `${customer.first_name} ${customer.last_name}` : 'N/A'
      const customerPhone = customer?.phone || ''

      const PAYMENT_LABELS: Record<string, string> = {
        'OM': 'Orange Money', 'MTN': 'MTN Money', 'Wave': 'Wave',
        'Espèces': 'Espèces', 'Chèque': 'Chèque', 'Carte': 'Carte bancaire',
      }

      function fmtFCFA(n: number): string {
        return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
      }

      function fmtDate(d: string): string {
        try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) } catch { return d }
      }

      function fmtDateShort(d: string): string {
        try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) } catch { return d }
      }

      const paymentLabel = PAYMENT_LABELS[String(invoice.payment_method)] || String(invoice.payment_method)
      const docTitle = isReceipt ? 'REÇU' : 'FACTURE'
      const docNumber = isReceipt ? (invoice.receipt_number || invoice.invoice_number) : invoice.invoice_number
      const statusLabel = invoice.status === 'paid' ? 'PAYÉE' : invoice.status === 'refund' ? 'REMBOURSÉE' : 'ANNULÉE'

      const reservation = invoice.reservations

      let html: string
      if (format === 'thermal') {
        html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${docTitle} ${docNumber}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; width: 80mm; padding: 5mm; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .separator { border-top: 1px dashed #555; margin: 6px 0; }
    .hotel-name { font-size: 16px; font-weight: bold; }
    .doc-num { font-size: 13px; font-weight: bold; margin-top: 4px; }
    .line-item { display: flex; justify-content: space-between; margin: 3px 0; }
    .line-desc { font-size: 10px; margin-top: 1px; color: #444; }
    .total-row { display: flex; justify-content: space-between; margin: 2px 0; font-weight: bold; }
    .grand-total { font-size: 14px; border-top: 2px solid #000; padding-top: 6px; margin-top: 6px; }
    .footer { margin-top: 10px; text-align: center; font-size: 10px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="center">
    <div class="hotel-name">${hotelName}</div>
    <div>${hotelCity}, Côte d'Ivoire</div>
    ${hotelPhone ? `<div>${hotelPhone}</div>` : ''}
    <div style="margin-top:2px;">━━━━━━━━━━━━━━━━━━━━</div>
    <div class="doc-num">${docTitle}</div>
    <div>N\u00b0 ${docNumber}</div>
    <div>${fmtDateShort(String(invoice.created_at))}</div>
    ${isReceipt && invoice.paid_at ? `<div>Paiement: ${fmtDateShort(invoice.paid_at)}</div>` : ''}
  </div>
  <div class="separator"></div>
  <div><span class="bold">Client :</span> ${customerName}</div>
  ${customerPhone ? `<div><span class="bold">T\u00e9l :</span> ${customerPhone}</div>` : ''}
  ${reservation ? `<div><span class="bold">Chambre :</span> ${reservation.rooms?.room_number || '-'}</div>` : ''}
  <div class="separator"></div>
  ${items.map((item: { description: string; total: number; quantity: number; unit_price: number }) => `<div class="line-item">
    <span>${item.description}</span>
    <span>${fmtFCFA(Number(item.total))}</span>
  </div>
  <div class="line-desc">${item.quantity} x ${fmtFCFA(Number(item.unit_price))}</div>`).join('')}
  <div class="separator"></div>
  <div class="total-row"><span>Sous-total</span><span>${fmtFCFA(Number(invoice.subtotal))}</span></div>
  ${Number(invoice.tourist_tax) > 0 ? `<div class="total-row"><span>Taxe s\u00e9jour</span><span>${fmtFCFA(Number(invoice.tourist_tax))}</span></div>` : ''}
  ${Number(invoice.vat) > 0 ? `<div class="total-row"><span>TVA 18%</span><span>${fmtFCFA(Number(invoice.vat))}</span></div>` : ''}
  <div class="total-row grand-total"><span>TOTAL TTC</span><span>${fmtFCFA(Number(invoice.total_amount))}</span></div>
  <div class="separator"></div>
  <div><span class="bold">Paiement :</span> ${paymentLabel}</div>
  ${invoice.notes ? `<div class="separator"></div><div style="font-size:10px;font-style:italic;">${invoice.notes}</div>` : ''}
  <div class="separator"></div>
  <div class="footer">
    Merci de votre confiance<br/>\u2014 ${hotelName} \u2014
  </div>
</body>
</html>`
      } else {
        html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${docTitle} ${docNumber}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a1a; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid ${isReceipt ? '#059669' : '#d97706'}; padding-bottom: 20px; }
    .hotel-info h1 { font-size: 22px; color: ${isReceipt ? '#047857' : '#92400e'}; font-weight: 700; }
    .hotel-info p { color: #555; margin-top: 4px; font-size: 11px; }
    .doc-title { text-align: right; }
    .doc-title h2 { font-size: 28px; color: ${isReceipt ? '#059669' : '#d97706'}; text-transform: uppercase; letter-spacing: 2px; }
    .doc-title p { color: #777; margin-top: 4px; font-size: 13px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 600; font-size: 11px; margin-top: 8px; }
    .status-paid { background: #d1fae5; color: #065f46; }
    .status-refund { background: #ffedd5; color: #9a3412; }
    .status-cancelled { background: #fee2e2; color: #991b1b; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .sections { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .section { flex: 1; }
    .section h3 { font-size: 11px; text-transform: uppercase; color: ${isReceipt ? '#047857' : '#92400e'}; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid ${isReceipt ? '#6ee7b7' : '#fbbf24'}; padding-bottom: 4px; }
    .section p { color: #444; margin: 3px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
    thead th { background: ${isReceipt ? '#ecfdf5' : '#fffbeb'}; color: ${isReceipt ? '#047857' : '#92400e'}; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid ${isReceipt ? '#059669' : '#d97706'}; }
    thead th:last-child { text-align: right; }
    tbody td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
    tbody td:last-child { text-align: right; font-weight: 500; }
    tbody tr:nth-child(even) { background: ${isReceipt ? '#f0fdf4' : '#fffbeb'}; }
    .totals { margin-left: auto; width: 300px; }
    .totals .row { display: flex; justify-content: space-between; padding: 6px 0; }
    .totals .total-final { border-top: 2px solid ${isReceipt ? '#059669' : '#d97706'}; padding-top: 10px; margin-top: 6px; font-size: 16px; font-weight: 700; color: ${isReceipt ? '#047857' : '#92400e'}; }
    .footer { margin-top: 40px; text-align: center; color: ${isReceipt ? '#047857' : '#92400e'}; font-size: 11px; border-top: 1px solid ${isReceipt ? '#6ee7b7' : '#fbbf24'}; padding-top: 15px; }
    .payment-info { margin-top: 15px; padding: 10px; background: ${isReceipt ? '#ecfdf5' : '#fffbeb'}; border-radius: 6px; border-left: 3px solid ${isReceipt ? '#059669' : '#d97706'}; }
    .payment-info span { font-weight: 600; color: ${isReceipt ? '#047857' : '#92400e'}; }
    .notes { margin-top: 15px; padding: 10px; background: #f9fafb; border-radius: 6px; font-style: italic; color: #555; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="hotel-info">
      <h1>${hotelName}</h1>
      ${hotelAddress ? `<p>${hotelAddress}</p>` : ''}
      <p>${hotelCity}, C\u00f4te d'Ivoire</p>
      ${hotelPhone ? `<p>T\u00e9l : ${hotelPhone}</p>` : ''}
      ${hotelEmail ? `<p>${hotelEmail}</p>` : ''}
    </div>
    <div class="doc-title">
      <h2>${docTitle}</h2>
      <p>N\u00b0 ${docNumber}</p>
      <p>${fmtDate(String(invoice.created_at))}</p>
      ${isReceipt && invoice.paid_at ? `<p>Date de paiement : ${fmtDate(invoice.paid_at)}</p>` : ''}
      <span class="status-badge status-${invoice.status}">${statusLabel}</span>
    </div>
  </div>
  <div class="sections">
    <div class="section">
      <h3>Client</h3>
      <p><strong>${customerName}</strong></p>
      ${customerPhone ? `<p>T\u00e9l : ${customerPhone}</p>` : ''}
    </div>
    <div class="section" style="text-align: right;">
      <h3>Informations</h3>
      <p>Mode : ${paymentLabel}</p>
      ${reservation ? `<p>Chambre : ${reservation.rooms?.room_number || '-'}</p><p>Arrivée : ${fmtDateShort(reservation.check_in_date)} — Départ : ${fmtDateShort(reservation.check_out_date)}</p>` : ''}
      ${invoice.reservation_id ? '<p>Li\u00e9e \u00e0 une r\u00e9servation</p>' : ''}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:center;width:80px;">Qt\u00e9</th>
        <th style="text-align:right;width:120px;">Prix unitaire</th>
        <th style="text-align:right;width:120px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item: { description: string; quantity: number; unit_price: number; total: number }) => `<tr>
        <td>${item.description}</td>
        <td style="text-align:center;">${item.quantity}</td>
        <td style="text-align:right;">${fmtFCFA(Number(item.unit_price))}</td>
        <td style="text-align:right;">${fmtFCFA(Number(item.total))}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Sous-total HT</span><span>${fmtFCFA(Number(invoice.subtotal))}</span></div>
    ${Number(invoice.tourist_tax) > 0 ? `<div class="row"><span>Taxe de s\u00e9jour</span><span>${fmtFCFA(Number(invoice.tourist_tax))}</span></div>` : ''}
    ${Number(invoice.vat) > 0 ? `<div class="row"><span>TVA (18%)</span><span>${fmtFCFA(Number(invoice.vat))}</span></div>` : ''}
    <div class="row total-final"><span>Total TTC</span><span>${fmtFCFA(Number(invoice.total_amount))}</span></div>
  </div>
  <div class="payment-info">
    <span>Mode de paiement :</span> ${paymentLabel}
    ${isReceipt && invoice.paid_at ? ` &mdash; <span>Pay\u00e9 le :</span> ${fmtDate(invoice.paid_at)}` : ''}
  </div>
  ${invoice.notes ? `<div class="notes">${invoice.notes}</div>` : ''}
  <div class="footer">
    ${hotelName} \u2014 ${hotelCity}, C\u00f4te d'Ivoire<br/>
    Merci de votre confiance
  </div>
</body>
</html>`
      }

      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
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

    // Fetch invoice with all related data
    const { data: invoice, error } = await adminClient
      .from('invoices')
      .select('*, customers(*), reservations(id, check_in_date, check_out_date, rooms(id, room_number, room_type)), invoice_items(*)')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .single()

    if (error || !invoice) {
      return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
    }

    // Fetch hotel info for the invoice header
    const { data: hotel } = await adminClient
      .from('hotels')
      .select('name, address, city, phone, email')
      .eq('id', hotelId)
      .single()

    const hotelName = hotel?.name || 'OGOU_Hôtel'
    const hotelAddress = hotel?.address || ''
    const hotelCity = hotel?.city || 'Abidjan'
    const hotelPhone = hotel?.phone || ''
    const hotelEmail = hotel?.email || ''

    const requestSearchParams = new URL(request.url).searchParams
    const pdfFormat = requestSearchParams.get('format') || 'a4'
    const isReceiptParam = requestSearchParams.get('type') === 'receipt'

    const items = invoice.invoice_items || []
    const customer = invoice.customers as Record<string, unknown> | null
    const customerName = customer ? `${customer.first_name} ${customer.last_name}` : 'N/A'
    const customerPhone = customer ? String(customer.phone || '') : ''

    const PAYMENT_LABELS: Record<string, string> = {
      'OM': 'Orange Money', 'MTN': 'MTN Money', 'Wave': 'Wave',
      'Espèces': 'Espèces', 'Chèque': 'Chèque', 'Carte': 'Carte bancaire',
    }

    function fmtFCFA(n: number): string {
      return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
    }

    function fmtDate(d: string): string {
      try {
        return new Date(d).toLocaleDateString('fr-FR', {
          day: '2-digit', month: 'long', year: 'numeric'
        })
      } catch { return d }
    }

    function fmtDateShort(d: string): string {
      try {
        return new Date(d).toLocaleDateString('fr-FR', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        })
      } catch { return d }
    }

    const statusLabel = invoice.status === 'paid' ? 'PAYÉE' : invoice.status === 'refund' ? 'REMBOURSÉE' : invoice.status === 'pending' ? 'EN ATTENTE' : 'ANNULÉE'
    const paymentLabel = PAYMENT_LABELS[String(invoice.payment_method)] || String(invoice.payment_method)

    // Support receipt format for paid invoices
    const docTitle = isReceiptParam ? 'REÇU' : 'FACTURE'
    const docNumber = isReceiptParam ? (invoice.receipt_number || invoice.invoice_number) : invoice.invoice_number

    let html: string

    if (pdfFormat === 'thermal') {
      html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${docTitle} ${docNumber}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; width: 80mm; padding: 5mm; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .separator { border-top: 1px dashed #555; margin: 6px 0; }
    .hotel-name { font-size: 16px; font-weight: bold; }
    .hotel-city { font-size: 11px; }
    .invoice-num { font-size: 13px; font-weight: bold; margin-top: 4px; }
    .line-item { display: flex; justify-content: space-between; margin: 3px 0; }
    .line-desc { font-size: 10px; margin-top: 1px; color: #444; }
    .total-row { display: flex; justify-content: space-between; margin: 2px 0; font-weight: bold; }
    .grand-total { font-size: 14px; border-top: 2px solid #000; padding-top: 6px; margin-top: 6px; }
    .footer { margin-top: 10px; text-align: center; font-size: 10px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="center">
    <div class="hotel-name">${hotelName}</div>
    <div class="hotel-city">${hotelCity}, Côte d'Ivoire</div>
    ${hotelPhone ? `<div>${hotelPhone}</div>` : ''}
    <div style="margin-top:2px;">━━━━━━━━━━━━━━━━━━━━</div>
    <div class="invoice-num">${docTitle}</div>
    <div>N\u00b0 ${docNumber}</div>
    <div>${fmtDateShort(String(invoice.created_at))}</div>
  </div>
  <div class="separator"></div>
  <div><span class="bold">Client :</span> ${customerName}</div>
  ${customerPhone ? `<div><span class="bold">T\u00e9l :</span> ${customerPhone}</div>` : ''}
  <div class="separator"></div>
  ${items.map((item: Record<string, unknown>) => `<div class="line-item">
    <span>${item.description}</span>
    <span>${fmtFCFA(Number(item.total))}</span>
  </div>
  <div class="line-desc">${item.quantity} x ${fmtFCFA(Number(item.unit_price))}</div>`).join('')}
  <div class="separator"></div>
  <div class="total-row"><span>Sous-total</span><span>${fmtFCFA(Number(invoice.subtotal))}</span></div>
  ${Number(invoice.tourist_tax) > 0 ? `<div class="total-row"><span>Taxe s\u00e9jour</span><span>${fmtFCFA(Number(invoice.tourist_tax))}</span></div>` : ''}
  ${Number(invoice.vat) > 0 ? `<div class="total-row"><span>TVA 18%</span><span>${fmtFCFA(Number(invoice.vat))}</span></div>` : ''}
  <div class="total-row grand-total"><span>TOTAL TTC</span><span>${fmtFCFA(Number(invoice.total_amount))}</span></div>
  <div class="separator"></div>
  <div><span class="bold">Paiement :</span> ${paymentLabel}</div>
  ${invoice.notes ? `<div class="separator"></div><div style="font-size:10px;font-style:italic;">${invoice.notes}</div>` : ''}
  <div class="separator"></div>
  <div class="footer">
    Merci de votre confiance<br/>\u2014 ${hotelName} \u2014<br/>
    <span style="font-size:9px;">H\u00f4telCI \u00b7 Gestion H\u00f4teli\u00e8re</span>
  </div>
</body>
</html>`
    } else {
      html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${docTitle} ${docNumber}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a1a; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid ${isReceiptParam ? '#059669' : '#d97706'}; padding-bottom: 20px; }
    .hotel-info h1 { font-size: 22px; color: ${isReceiptParam ? '#047857' : '#92400e'}; font-weight: 700; }
    .hotel-info p { color: #555; margin-top: 4px; font-size: 11px; }
    .invoice-title { text-align: right; }
    .invoice-title h2 { font-size: 28px; color: ${isReceiptParam ? '#059669' : '#d97706'}; text-transform: uppercase; letter-spacing: 2px; }
    .invoice-title p { color: #777; margin-top: 4px; font-size: 13px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 600; font-size: 11px; margin-top: 8px; }
    .status-paid { background: #d1fae5; color: #065f46; }
    .status-refund { background: #ffedd5; color: #9a3412; }
    .status-cancelled { background: #fee2e2; color: #991b1b; }
    .sections { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .section { flex: 1; }
    .section h3 { font-size: 11px; text-transform: uppercase; color: #92400e; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #fbbf24; padding-bottom: 4px; }
    .section p { color: #444; margin: 3px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
    thead th { background: #fffbeb; color: #92400e; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #d97706; }
    thead th:last-child { text-align: right; }
    tbody td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
    tbody td:last-child { text-align: right; font-weight: 500; }
    tbody tr:nth-child(even) { background: #fffbeb; }
    .totals { margin-left: auto; width: 300px; }
    .totals .row { display: flex; justify-content: space-between; padding: 6px 0; }
    .totals .total-final { border-top: 2px solid #d97706; padding-top: 10px; margin-top: 6px; font-size: 16px; font-weight: 700; color: #92400e; }
    .footer { margin-top: 40px; text-align: center; color: #92400e; font-size: 11px; border-top: 1px solid #fbbf24; padding-top: 15px; }
    .payment-info { margin-top: 15px; padding: 10px; background: #fffbeb; border-radius: 6px; border-left: 3px solid #d97706; }
    .payment-info span { font-weight: 600; color: #92400e; }
    .notes { margin-top: 15px; padding: 10px; background: #f9fafb; border-radius: 6px; font-style: italic; color: #555; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="hotel-info">
      <h1>${hotelName}</h1>
      ${hotelAddress ? `<p>${hotelAddress}</p>` : ''}
      <p>${hotelCity}, C\u00f4te d'Ivoire</p>
      ${hotelPhone ? `<p>T\u00e9l : ${hotelPhone}</p>` : ''}
      ${hotelEmail ? `<p>${hotelEmail}</p>` : ''}
    </div>
    <div class="invoice-title">
      <h2>${docTitle}</h2>
      <p>N\u00b0 ${docNumber}</p>
      <p>${fmtDate(String(invoice.created_at))}</p>
      ${isReceiptParam && invoice.paid_at ? `<p>Date de paiement : ${fmtDate(String(invoice.paid_at))}</p>` : ''}
      <span class="status-badge status-${invoice.status}">${statusLabel}</span>
    </div>
  </div>
  <div class="sections">
    <div class="section">
      <h3>Client</h3>
      <p><strong>${customerName}</strong></p>
      ${customerPhone ? `<p>T\u00e9l : ${customerPhone}</p>` : ''}
    </div>
    <div class="section" style="text-align: right;">
      <h3>Informations</h3>
      <p>Mode : ${paymentLabel}</p>
      ${invoice.reservation_id ? '<p>Li\u00e9e \u00e0 une r\u00e9servation</p>' : ''}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:center;width:80px;">Qt\u00e9</th>
        <th style="text-align:right;width:120px;">Prix unitaire</th>
        <th style="text-align:right;width:120px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item: Record<string, unknown>) => `<tr>
        <td>${item.description}</td>
        <td style="text-align:center;">${item.quantity}</td>
        <td style="text-align:right;">${fmtFCFA(Number(item.unit_price))}</td>
        <td style="text-align:right;">${fmtFCFA(Number(item.total))}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Sous-total HT</span><span>${fmtFCFA(Number(invoice.subtotal))}</span></div>
    ${Number(invoice.tourist_tax) > 0 ? `<div class="row"><span>Taxe de s\u00e9jour</span><span>${fmtFCFA(Number(invoice.tourist_tax))}</span></div>` : ''}
    ${Number(invoice.vat) > 0 ? `<div class="row"><span>TVA (18%)</span><span>${fmtFCFA(Number(invoice.vat))}</span></div>` : ''}
    <div class="row total-final"><span>Total TTC</span><span>${fmtFCFA(Number(invoice.total_amount))}</span></div>
  </div>
  <div class="payment-info">
    <span>Mode de paiement :</span> ${paymentLabel}
  </div>
  ${invoice.notes ? `<div class="notes">${invoice.notes}</div>` : ''}
  <div class="footer">
    ${hotelName} \u2014 ${hotelCity}, C\u00f4te d'Ivoire<br/>
    Merci de votre confiance \u2014 H\u00f4telCI \u00b7 Gestion H\u00f4teli\u00e8re
  </div>
</body>
</html>`
    }

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Invoice PDF generation error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
