'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  FileText,
  Download,
  Printer,
  Plus,
  Search,
  Filter,
  Receipt,
  CreditCard,
  X,
  RefreshCw,
  Loader2,
  Eye,
  ArrowUpDown,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import type { Invoice, InvoiceItem, InvoiceStatus, PaymentMethod } from '@/lib/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface InvoicesTabProps {
  onRefresh: () => void
}

interface CustomerOption {
  id: string
  first_name: string
  last_name: string
  phone: string
}

interface ReservationOption {
  id: string
  check_in_date: string
  check_out_date: string
  rooms?: { room_number: string; room_type: string } | null
  customers?: { first_name: string; last_name: string } | null
}

interface InvoiceFormLine {
  description: string
  quantity: number
  unit_price: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous' },
  { value: 'paid', label: 'Payée' },
  { value: 'refund', label: 'Remboursée' },
  { value: 'cancelled', label: 'Annulée' },
] as const

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'OM', label: 'Orange Money' },
  { value: 'MTN', label: 'MTN Money' },
  { value: 'Wave', label: 'Wave' },
  { value: 'Espèces', label: 'Espèces' },
  { value: 'Chèque', label: 'Chèque' },
  { value: 'Carte', label: 'Carte bancaire' },
]

const VAT_RATE = 0.18 // 18% Côte d'Ivoire

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

function formatDateFR(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatDateShort(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function getStatusBadge(status: InvoiceStatus) {
  switch (status) {
    case 'paid':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Payée</Badge>
    case 'refund':
      return <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100">Remboursée</Badge>
    case 'cancelled':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Annulée</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function getPaymentMethodBadge(method: PaymentMethod) {
  switch (method) {
    case 'OM':
      return <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100 text-[10px]">OM</Badge>
    case 'MTN':
      return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100 text-[10px]">MTN</Badge>
    case 'Wave':
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 text-[10px]">Wave</Badge>
    case 'Espèces':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px]">Espèces</Badge>
    case 'Chèque':
      return <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100 text-[10px]">Chèque</Badge>
    case 'Carte':
      return <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100 text-[10px]">Carte</Badge>
    default:
      return <Badge variant="secondary" className="text-[10px]">{method}</Badge>
  }
}

function getPaymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_OPTIONS.find(m => m.value === method)?.label ?? method
}

// ─── Component ───────────────────────────────────────────────────────────────

export function InvoicesTab({ onRefresh }: InvoicesTabProps) {
  // ─── State ──────────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Detail sheet
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [reservations, setReservations] = useState<ReservationOption[]>([])
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formReservationId, setFormReservationId] = useState('')
  const [formLines, setFormLines] = useState<InvoiceFormLine[]>([
    { description: '', quantity: 1, unit_price: 0 },
  ])
  const [formTouristTax, setFormTouristTax] = useState(0)
  const [formVatEnabled, setFormVatEnabled] = useState(true)
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod | ''>('')
  const [formNotes, setFormNotes] = useState('')

  // Status change dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [statusChangeTarget, setStatusChangeTarget] = useState<'refund' | 'cancelled' | null>(null)
  const [statusChanging, setStatusChanging] = useState(false)

  // ─── Fetch invoices ────────────────────────────────────────────────────
  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery.trim()) params.set('search', searchQuery.trim())
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (paymentFilter && paymentFilter !== 'all') params.set('payment_method', paymentFilter)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)

      const res = await fetch(`/api/owner/invoices?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.invoices || [])
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Erreur lors du chargement des factures')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, statusFilter, paymentFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  // ─── Debounced search ──────────────────────────────────────────────────
  function handleSearchChange(value: string) {
    setSearchQuery(value)
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    if (!value.trim()) {
      fetchInvoices()
    }
  }

  // ─── Fetch customers for form ─────────────────────────────────────────
  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/owner/customers')
      if (res.ok) {
        const data = await res.json()
        setCustomers(
          (data.customers || []).map((c: Record<string, unknown>) => ({
            id: c.id as string,
            first_name: c.first_name as string,
            last_name: c.last_name as string,
            phone: c.phone as string,
          }))
        )
      }
    } catch {
      // silently fail
    }
  }, [])

  // ─── Fetch reservations for form ──────────────────────────────────────
  const fetchReservations = useCallback(async () => {
    try {
      const res = await fetch('/api/owner/reservations?status=checked_out')
      if (res.ok) {
        const data = await res.json()
        setReservations(data.reservations || [])
      }
    } catch {
      // silently fail
    }
  }, [])

  // ─── Open create dialog ───────────────────────────────────────────────
  function openCreateDialog() {
    resetForm()
    setCreateOpen(true)
    fetchCustomers()
    fetchReservations()
  }

  // ─── Form helpers ─────────────────────────────────────────────────────
  function resetForm() {
    setFormCustomerId('')
    setFormReservationId('')
    setFormLines([{ description: '', quantity: 1, unit_price: 0 }])
    setFormTouristTax(0)
    setFormVatEnabled(true)
    setFormPaymentMethod('')
    setFormNotes('')
  }

  // ─── Line item management ─────────────────────────────────────────────
  function addLine() {
    setFormLines([...formLines, { description: '', quantity: 1, unit_price: 0 }])
  }

  function removeLine(index: number) {
    if (formLines.length <= 1) return
    setFormLines(formLines.filter((_, i) => i !== index))
  }

  function updateLine(index: number, field: keyof InvoiceFormLine, value: string | number) {
    const updated = [...formLines]
    updated[index] = { ...updated[index], [field]: value }
    setFormLines(updated)
  }

  // ─── Auto-calculations ────────────────────────────────────────────────
  const subtotal = formLines.reduce(
    (sum, line) => sum + line.quantity * line.unit_price,
    0
  )
  const vat = formVatEnabled ? Math.round(subtotal * VAT_RATE) : 0
  const totalTTC = subtotal + formTouristTax + vat

  // ─── Submit create invoice ────────────────────────────────────────────
  async function handleCreateInvoice() {
    if (!formCustomerId) {
      toast.error('Veuillez sélectionner un client')
      return
    }
    if (!formPaymentMethod) {
      toast.error('Veuillez sélectionner un mode de paiement')
      return
    }
    const validLines = formLines.filter(l => l.description.trim() && l.quantity > 0 && l.unit_price > 0)
    if (validLines.length === 0) {
      toast.error('Ajoutez au moins une ligne de facture valide')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/owner/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: formCustomerId,
          reservation_id: formReservationId || null,
          items: validLines.map(l => ({
            description: l.description.trim(),
            quantity: l.quantity,
            unit_price: l.unit_price,
          })),
          tourist_tax: formTouristTax,
          vat_rate: formVatEnabled ? VAT_RATE : 0,
          payment_method: formPaymentMethod,
          notes: formNotes.trim() || null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(`Facture ${data.invoice?.invoice_number || ''} créée avec succès`)
        setCreateOpen(false)
        resetForm()
        fetchInvoices()
        onRefresh()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Erreur lors de la création de la facture')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Open detail view ─────────────────────────────────────────────────
  async function openDetail(invoice: Invoice) {
    setSelectedInvoice(invoice)
    setDetailOpen(true)

    // Fetch full detail with items if not already loaded
    if (!invoice.invoice_items || invoice.invoice_items.length === 0) {
      setDetailLoading(true)
      try {
        const res = await fetch(`/api/owner/invoices/${invoice.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.invoice) {
            setSelectedInvoice(data.invoice)
          }
        }
      } catch {
        // use existing data
      } finally {
        setDetailLoading(false)
      }
    }
  }

  // ─── Status change ────────────────────────────────────────────────────
  async function handleStatusChange() {
    if (!selectedInvoice || !statusChangeTarget) return
    setStatusChanging(true)
    try {
      const res = await fetch(`/api/owner/invoices/${selectedInvoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusChangeTarget }),
      })

      if (res.ok) {
        const label = statusChangeTarget === 'refund' ? 'remboursée' : 'annulée'
        toast.success(`Facture ${selectedInvoice.invoice_number} ${label}`)
        setSelectedInvoice({
          ...selectedInvoice,
          status: statusChangeTarget,
        })
        fetchInvoices()
        onRefresh()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Erreur lors du changement de statut')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setStatusChanging(false)
      setStatusDialogOpen(false)
      setStatusChangeTarget(null)
    }
  }

  // ─── Print PDF (A4) ──────────────────────────────────────────────────
  function printPDF(invoice: Invoice) {
    const items = invoice.invoice_items || []
    const customerName = invoice.customers
      ? `${(invoice.customers as Record<string, unknown>).first_name} ${(invoice.customers as Record<string, unknown>).last_name}`
      : 'N/A'
    const customerPhone = invoice.customers
      ? (invoice.customers as Record<string, unknown>).phone || ''
      : ''

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture ${invoice.invoice_number}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a1a; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #d97706; padding-bottom: 20px; }
    .hotel-info h1 { font-size: 22px; color: #92400e; font-weight: 700; }
    .hotel-info p { color: #555; margin-top: 4px; }
    .invoice-title { text-align: right; }
    .invoice-title h2 { font-size: 28px; color: #d97706; text-transform: uppercase; letter-spacing: 2px; }
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
      <h1>HôtelCI</h1>
      <p>Votre établissement</p>
      <p>Abidjan, Côte d'Ivoire</p>
    </div>
    <div class="invoice-title">
      <h2>Facture</h2>
      <p>N° ${invoice.invoice_number}</p>
      <p>${formatDateFR(invoice.created_at)}</p>
      <span class="status-badge status-${invoice.status}">${
        invoice.status === 'paid' ? 'PAYÉE' : invoice.status === 'refund' ? 'REMBOURSÉE' : 'ANNULÉE'
      }</span>
    </div>
  </div>
  <div class="sections">
    <div class="section">
      <h3>Client</h3>
      <p><strong>${customerName}</strong></p>
      ${customerPhone ? `<p>Tél : ${customerPhone}</p>` : ''}
    </div>
    <div class="section" style="text-align: right;">
      <h3>Informations</h3>
      <p>Mode : ${getPaymentMethodLabel(invoice.payment_method)}</p>
      ${invoice.reservation_id ? '<p>Liée à une réservation</p>' : ''}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:center;width:80px;">Qté</th>
        <th style="text-align:right;width:120px;">Prix unitaire</th>
        <th style="text-align:right;width:120px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${items
        .map(
          (item) => `<tr>
        <td>${item.description}</td>
        <td style="text-align:center;">${item.quantity}</td>
        <td style="text-align:right;">${formatFCFA(item.unit_price)}</td>
        <td style="text-align:right;">${formatFCFA(item.total)}</td>
      </tr>`
        )
        .join('')}
    </tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Sous-total HT</span><span>${formatFCFA(invoice.subtotal)}</span></div>
    ${invoice.tourist_tax > 0 ? `<div class="row"><span>Taxe de séjour</span><span>${formatFCFA(invoice.tourist_tax)}</span></div>` : ''}
    ${invoice.vat > 0 ? `<div class="row"><span>TVA (18%)</span><span>${formatFCFA(invoice.vat)}</span></div>` : ''}
    <div class="row total-final"><span>Total TTC</span><span>${formatFCFA(invoice.total_amount)}</span></div>
  </div>
  <div class="payment-info">
    <span>Mode de paiement :</span> ${getPaymentMethodLabel(invoice.payment_method)}
  </div>
  ${invoice.notes ? `<div class="notes">${invoice.notes}</div>` : ''}
  <div class="footer">
    Merci de votre confiance — HôtelCI
  </div>
</body>
</html>`

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.onload = () => {
        printWindow.print()
      }
    }
  }

  // ─── Print Thermal Receipt (80mm) ─────────────────────────────────────
  function printThermal(invoice: Invoice) {
    const items = invoice.invoice_items || []
    const customerName = invoice.customers
      ? `${(invoice.customers as Record<string, unknown>).first_name} ${(invoice.customers as Record<string, unknown>).last_name}`
      : 'N/A'

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Reçu ${invoice.invoice_number}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; width: 80mm; padding: 5mm; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .separator { border-top: 1px dashed #555; margin: 6px 0; }
    .hotel-name { font-size: 16px; font-weight: bold; }
    .invoice-num { font-size: 13px; font-weight: bold; margin-top: 4px; }
    .line-item { display: flex; justify-content: space-between; margin: 3px 0; }
    .line-desc { font-size: 10px; margin-top: 1px; }
    .total-row { display: flex; justify-content: space-between; margin: 2px 0; font-weight: bold; }
    .grand-total { font-size: 14px; border-top: 2px solid #000; padding-top: 6px; margin-top: 6px; }
    .footer { margin-top: 10px; text-align: center; font-size: 10px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="center">
    <div class="hotel-name">HôtelCI</div>
    <div>Abidjan, Côte d'Ivoire</div>
    <div style="margin-top:2px;">━━━━━━━━━━━━━━━━━━━━</div>
    <div class="invoice-num">FACTURE</div>
    <div>N° ${invoice.invoice_number}</div>
    <div>${formatDateShort(invoice.created_at)}</div>
  </div>
  <div class="separator"></div>
  <div><span class="bold">Client :</span> ${customerName}</div>
  <div class="separator"></div>
  ${items
    .map(
      (item) => `<div class="line-item">
    <span>${item.description}</span>
    <span>${formatFCFA(item.total)}</span>
  </div>
  <div class="line-desc">${item.quantity} x ${formatFCFA(item.unit_price)}</div>`
    )
    .join('')}
  <div class="separator"></div>
  <div class="total-row"><span>Sous-total</span><span>${formatFCFA(invoice.subtotal)}</span></div>
  ${invoice.tourist_tax > 0 ? `<div class="total-row"><span>Taxe séjour</span><span>${formatFCFA(invoice.tourist_tax)}</span></div>` : ''}
  ${invoice.vat > 0 ? `<div class="total-row"><span>TVA 18%</span><span>${formatFCFA(invoice.vat)}</span></div>` : ''}
  <div class="total-row grand-total"><span>TOTAL TTC</span><span>${formatFCFA(invoice.total_amount)}</span></div>
  <div class="separator"></div>
  <div><span class="bold">Paiement :</span> ${getPaymentMethodLabel(invoice.payment_method)}</div>
  ${invoice.notes ? `<div class="separator"></div><div style="font-size:10px;font-style:italic;">${invoice.notes}</div>` : ''}
  <div class="separator"></div>
  <div class="footer">
    Merci de votre confiance<br/>— HôtelCI —
  </div>
</body>
</html>`

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.onload = () => {
        printWindow.print()
      }
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6 text-amber-600" />
            Gestion des Factures
          </h2>
          <p className="text-muted-foreground">
            {invoices.length} facture{invoices.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchInvoices()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
            onClick={openCreateDialog}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle Facture
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="N° facture ou client..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2 text-gray-400" />
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Payment method filter */}
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger>
                <CreditCard className="h-4 w-4 mr-2 text-gray-400" />
                <SelectValue placeholder="Paiement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les modes</SelectItem>
                {PAYMENT_METHOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date from */}
            <div>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="Du"
                className="text-sm"
              />
            </div>

            {/* Date to */}
            <div>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="Au"
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-400 mb-3">
                <FileText className="h-7 w-7" />
              </div>
              <p className="text-muted-foreground">Aucune facture trouvée</p>
              <p className="text-xs text-muted-foreground mt-1">Créez votre première facture pour commencer</p>
              <Button
                className="mt-4 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={openCreateDialog}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle Facture
              </Button>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">N° Facture</TableHead>
                      <TableHead className="whitespace-nowrap">Client</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Montant TTC</TableHead>
                      <TableHead className="whitespace-nowrap hidden md:table-cell">Mode Paiement</TableHead>
                      <TableHead className="whitespace-nowrap">Statut</TableHead>
                      <TableHead className="whitespace-nowrap hidden lg:table-cell">Date</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => {
                      const customerName = invoice.customers
                        ? `${(invoice.customers as Record<string, unknown>).first_name} ${(invoice.customers as Record<string, unknown>).last_name}`
                        : '—'
                      return (
                        <TableRow
                          key={invoice.id}
                          className="cursor-pointer hover:bg-amber-50/50"
                          onClick={() => openDetail(invoice)}
                        >
                          <TableCell className="font-medium whitespace-nowrap">
                            {invoice.invoice_number}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{customerName}</TableCell>
                          <TableCell className="text-right font-medium whitespace-nowrap">
                            {formatFCFA(invoice.total_amount)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {getPaymentMethodBadge(invoice.payment_method)}
                          </TableCell>
                          <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                          <TableCell className="hidden lg:table-cell whitespace-nowrap text-sm text-muted-foreground">
                            {formatDateShort(invoice.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openDetail(invoice)
                                }}
                                title="Voir les détails"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ─── Create Invoice Dialog ────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-amber-600" />
              Nouvelle Facture
            </DialogTitle>
            <DialogDescription>
              Créez une facture pour un client
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Customer and Reservation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.first_name} {c.last_name} ({c.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Réservation (optionnel)</Label>
                <Select value={formReservationId} onValueChange={setFormReservationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aucune réservation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune réservation</SelectItem>
                    {reservations.map((r) => {
                      const roomNum = r.rooms?.room_number || '?'
                      return (
                        <SelectItem key={r.id} value={r.id}>
                          Ch. {roomNum} — {formatDateShort(r.check_in_date)} au {formatDateShort(r.check_out_date)}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Invoice Lines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Lignes de facture *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                  onClick={addLine}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Ajouter ligne
                </Button>
              </div>

              {formLines.map((line, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    {index === 0 && <Label className="text-[10px] text-muted-foreground">Description</Label>}
                    <Input
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => updateLine(index, 'description', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="w-20">
                    {index === 0 && <Label className="text-[10px] text-muted-foreground">Qté</Label>}
                    <Input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(index, 'quantity', parseInt(e.target.value) || 0)}
                      className="text-sm"
                    />
                  </div>
                  <div className="w-32">
                    {index === 0 && <Label className="text-[10px] text-muted-foreground">Prix unit. (FCFA)</Label>}
                    <Input
                      type="number"
                      min={0}
                      value={line.unit_price || ''}
                      onChange={(e) => updateLine(index, 'unit_price', parseInt(e.target.value) || 0)}
                      className="text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div className="w-28 text-right text-sm font-medium py-2">
                    {formatFCFA(line.quantity * line.unit_price)}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-red-400 hover:text-red-600"
                    onClick={() => removeLine(index)}
                    disabled={formLines.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Separator />

            {/* Tax and VAT */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Taxe de séjour (FCFA)</Label>
                <Input
                  type="number"
                  min={0}
                  value={formTouristTax || ''}
                  onChange={(e) => setFormTouristTax(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>TVA</Label>
                <Select
                  value={formVatEnabled ? '18' : '0'}
                  onValueChange={(v) => setFormVatEnabled(v === '18')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="18">18 % (Côte d&apos;Ivoire)</SelectItem>
                    <SelectItem value="0">Exonéré (0 %)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Mode de paiement *</Label>
              <Select value={formPaymentMethod} onValueChange={(v) => setFormPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un mode" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Notes ou observations..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
              />
            </div>

            <Separator />

            {/* Summary */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-amber-900 mb-2">Résumé financier</h4>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sous-total HT</span>
                <span className="font-medium">{formatFCFA(subtotal)}</span>
              </div>
              {formTouristTax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxe de séjour</span>
                  <span className="font-medium">{formatFCFA(formTouristTax)}</span>
                </div>
              )}
              {vat > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA (18 %)</span>
                  <span className="font-medium">{formatFCFA(vat)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold text-amber-900">
                <span>Total TTC</span>
                <span>{formatFCFA(totalTTC)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              disabled={submitting}
              onClick={handleCreateInvoice}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Créer la Facture
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Invoice Detail Sheet ─────────────────────────────────────────── */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
          <SheetHeader className="pr-6">
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600" />
              Détail de la Facture
            </SheetTitle>
            <SheetDescription>
              {selectedInvoice?.invoice_number}
            </SheetDescription>
          </SheetHeader>

          {detailLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : selectedInvoice ? (
            <div className="space-y-5 px-4 pb-6">
              {/* Header info */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold text-gray-900">{selectedInvoice.invoice_number}</p>
                  <p className="text-sm text-muted-foreground">{formatDateFR(selectedInvoice.created_at)}</p>
                </div>
                {getStatusBadge(selectedInvoice.status)}
              </div>

              <Separator />

              {/* Hotel info */}
              <div className="rounded-lg bg-amber-50/50 border border-amber-200/60 p-3">
                <p className="text-sm font-semibold text-amber-900">HôtelCI</p>
                <p className="text-xs text-amber-700">Abidjan, Côte d'Ivoire</p>
              </div>

              {/* Customer info */}
              {selectedInvoice.customers && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Client</p>
                  <p className="font-medium">
                    {(selectedInvoice.customers as Record<string, unknown>).first_name} {(selectedInvoice.customers as Record<string, unknown>).last_name}
                  </p>
                  {(selectedInvoice.customers as Record<string, unknown>).phone && (
                    <p className="text-sm text-muted-foreground">
                      {(selectedInvoice.customers as Record<string, unknown>).phone as string}
                    </p>
                  )}
                  {(selectedInvoice.customers as Record<string, unknown>).email && (
                    <p className="text-sm text-muted-foreground">
                      {(selectedInvoice.customers as Record<string, unknown>).email as string}
                    </p>
                  )}
                </div>
              )}

              {/* Line items */}
              {(selectedInvoice.invoice_items || []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Articles</p>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[11px]">Description</TableHead>
                          <TableHead className="text-[11px] text-center w-12">Qté</TableHead>
                          <TableHead className="text-[11px] text-right w-24">P.U.</TableHead>
                          <TableHead className="text-[11px] text-right w-24">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedInvoice.invoice_items || []).map((item: InvoiceItem) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-sm py-2">{item.description}</TableCell>
                            <TableCell className="text-sm text-center py-2">{item.quantity}</TableCell>
                            <TableCell className="text-sm text-right py-2">{formatFCFA(item.unit_price)}</TableCell>
                            <TableCell className="text-sm text-right font-medium py-2">{formatFCFA(item.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Financial summary */}
              <div className="rounded-lg border border-amber-200/60 bg-amber-50/30 p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Résumé financier</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total HT</span>
                  <span>{formatFCFA(selectedInvoice.subtotal)}</span>
                </div>
                {selectedInvoice.tourist_tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxe de séjour</span>
                    <span>{formatFCFA(selectedInvoice.tourist_tax)}</span>
                  </div>
                )}
                {selectedInvoice.vat > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TVA (18 %)</span>
                    <span>{formatFCFA(selectedInvoice.vat)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold text-amber-900">
                  <span>Total TTC</span>
                  <span>{formatFCFA(selectedInvoice.total_amount)}</span>
                </div>
              </div>

              {/* Payment method */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Mode de paiement</span>
                {getPaymentMethodBadge(selectedInvoice.payment_method)}
              </div>

              {/* Notes */}
              {selectedInvoice.notes && (
                <div className="rounded-lg bg-gray-50 border p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{selectedInvoice.notes}</p>
                </div>
              )}

              <Separator />

              {/* Action buttons */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                  onClick={() => printPDF(selectedInvoice)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger PDF
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                  onClick={() => printThermal(selectedInvoice)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimer Reçu Thermique
                </Button>
                {selectedInvoice.status === 'paid' && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full border-orange-200 text-orange-700 hover:bg-orange-50"
                      onClick={() => {
                        setStatusChangeTarget('refund')
                        setStatusDialogOpen(true)
                      }}
                    >
                      <Receipt className="h-4 w-4 mr-2" />
                      Rembourser
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setStatusChangeTarget('cancelled')
                        setStatusDialogOpen(true)
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Annuler
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              Aucune facture sélectionnée
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ─── Status Change Confirmation ────────────────────────────────────── */}
      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmer le changement de statut
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir{' '}
              <strong>
                {statusChangeTarget === 'refund' ? 'rembourser' : 'annuler'}
              </strong>{' '}
              la facture <strong>{selectedInvoice?.invoice_number}</strong> ?
              {statusChangeTarget === 'refund' && ' Le montant sera marqué comme remboursé.'}
              {statusChangeTarget === 'cancelled' && ' La facture sera marquée comme annulée.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusChanging}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className={
                statusChangeTarget === 'refund'
                  ? 'bg-orange-600 hover:bg-orange-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }
              onClick={handleStatusChange}
              disabled={statusChanging}
            >
              {statusChanging ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : statusChangeTarget === 'refund' ? (
                'Confirmer le remboursement'
              ) : (
                'Confirmer l\'annulation'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
