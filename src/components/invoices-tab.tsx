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
  FileSpreadsheet,
  FileDown,
  RotateCcw,
  Ban,
  Hotel,
  Building2,
  MapPin,
  Phone,
  Mail,
  Quote,
  CalendarDays,
  Link2,
  Stamp,
  BedDouble,
  CircleDollarSign,
  Clock,
} from 'lucide-react'
import Image from 'next/image'

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

import type { Invoice, InvoiceItem, InvoiceStatus, PaymentMethod } from '@/lib/types'
import { downloadCSV, INVOICE_EXPORT_COLUMNS, type InvoiceExportRow } from '@/lib/export-utils'

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
  { value: 'pending', label: 'En attente' },
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
    case 'pending':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">En attente</Badge>
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
  const [formInvoiceStatus, setFormInvoiceStatus] = useState<'paid' | 'pending'>('paid')
  const [formNotes, setFormNotes] = useState('')

  // Status change dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [statusChangeTarget, setStatusChangeTarget] = useState<'refund' | 'cancelled' | null>(null)
  const [statusChanging, setStatusChanging] = useState(false)

  // Mark as paid dialog
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false)
  const [markPaidPaymentMethod, setMarkPaidPaymentMethod] = useState<PaymentMethod>('Espèces')
  const [markPaidLoading, setMarkPaidLoading] = useState(false)

  // Export state
  const [exporting, setExporting] = useState(false)

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
          status: formInvoiceStatus,
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
  async function handleStatusChange(targetStatus?: 'refund' | 'cancelled' | 'paid') {
    const target = targetStatus || statusChangeTarget
    if (!selectedInvoice || !target) return
    setStatusChanging(true)
    try {
      const body: Record<string, unknown> = { status: target }
      if (target === 'paid') {
        body.payment_method = markPaidPaymentMethod
      }

      const res = await fetch(`/api/owner/invoices/${selectedInvoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const data = await res.json()
        const label = target === 'refund' ? 'remboursée' : target === 'paid' ? 'marquée comme payée' : 'annulée'
        toast.success(`Facture ${selectedInvoice.invoice_number} ${label}`)
        setSelectedInvoice({
          ...selectedInvoice,
          status: target,
          receipt_number: data.invoice?.receipt_number || selectedInvoice.receipt_number,
          paid_at: data.invoice?.paid_at || selectedInvoice.paid_at,
          payment_method: target === 'paid' ? markPaidPaymentMethod : selectedInvoice.payment_method,
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
      setMarkPaidDialogOpen(false)
      setMarkPaidLoading(false)
    }
  }

  // ─── Print PDF (A4) via server ───────────────────────────────────────
  function handlePrintA4(invoice: Invoice) {
    const url = `/api/owner/invoices/pdf/${invoice.id}?format=a4`
    const printWindow = window.open(url, '_blank')
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print()
      }
    }
  }

  // ─── Print Thermal Receipt (80mm) via server ──────────────────────────
  function handlePrintThermal(invoice: Invoice) {
    const url = `/api/owner/invoices/pdf/${invoice.id}?format=thermal`
    const printWindow = window.open(url, '_blank')
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print()
      }
    }
  }

  // ─── Download PDF (opens A4 view, user can Save as PDF) ──────────────
  function handleDownloadPDF(invoice: Invoice) {
    window.open(`/api/owner/invoices/pdf/${invoice.id}?format=a4`, '_blank')
  }

  // ─── Download Receipt (for paid invoices) ───────────────────────────
  function handleDownloadReceipt(invoice: Invoice) {
    window.open(`/api/owner/invoices/pdf/${invoice.id}?format=a4&type=receipt`, '_blank')
  }

  // ─── Export CSV (server-side) ─────────────────────────────────────────
  async function handleExportCSV() {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (paymentFilter && paymentFilter !== 'all') params.set('payment_method', paymentFilter)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      if (searchQuery.trim()) params.set('search', searchQuery.trim())

      const res = await fetch(`/api/owner/invoices/export?${params.toString()}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `factures_ogou_hotel_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        toast.success(`${invoices.length} factures exportées en CSV`)
      } else {
        toast.error('Erreur lors de l\'export CSV')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setExporting(false)
    }
  }

  // ─── Quick client-side CSV (for current view) ─────────────────────────
  function handleQuickExportCSV() {
    if (invoices.length === 0) {
      toast.error('Aucune facture à exporter')
      return
    }

    const exportData: InvoiceExportRow[] = invoices.map((inv) => {
      const customer = inv.customers as Record<string, unknown> | null
      return {
        invoice_number: inv.invoice_number,
        customer_name: customer ? `${customer.first_name} ${customer.last_name}` : 'N/A',
        customer_phone: customer ? String(customer.phone || '') : '',
        subtotal: inv.subtotal,
        tourist_tax: inv.tourist_tax,
        vat: inv.vat,
        total_amount: inv.total_amount,
        payment_method: inv.payment_method,
        status: inv.status,
        created_at: inv.created_at,
        reservation_id: inv.reservation_id,
        items_count: inv.invoice_items?.length || 0,
      }
    })

    downloadCSV(exportData, INVOICE_EXPORT_COLUMNS, `factures_ogou_hotel_${new Date().toISOString().split('T')[0]}.csv`)
    toast.success(`${invoices.length} factures exportées`)
  }

  // ─── Summary calculations ─────────────────────────────────────────────
  const totalRevenue = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.total_amount), 0)
  const pendingRevenue = invoices
    .filter(i => i.status === 'pending')
    .reduce((sum, i) => sum + Number(i.total_amount), 0)
  const totalRefund = invoices
    .filter(i => i.status === 'refund')
    .reduce((sum, i) => sum + Number(i.total_amount), 0)
  const paidCount = invoices.filter(i => i.status === 'paid').length
  const pendingCount = invoices.filter(i => i.status === 'pending').length

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Receipt className="h-6 w-6 text-amber-600" />
              Gestion des Factures
            </h2>
            <p className="text-muted-foreground">
              {invoices.length} facture{invoices.length !== 1 ? 's' : ''} · {paidCount} payée{paidCount !== 1 ? 's' : ''}{pendingCount > 0 ? ` · ${pendingCount} en attente` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchInvoices()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>

            {/* Export dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={exporting || invoices.length === 0}>
                  {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Exporter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleQuickExportCSV}>
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />
                  Export rapide CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV}>
                  <FileDown className="h-4 w-4 mr-2 text-blue-600" />
                  Export CSV complet
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              onClick={openCreateDialog}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle Facture
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {invoices.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-emerald-600">Total Payé</p>
                    <p className="text-lg font-bold text-emerald-700">{formatFCFA(totalRevenue)}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50/50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-amber-600">En attente ({pendingCount})</p>
                    <p className="text-lg font-bold text-amber-700">{formatFCFA(pendingRevenue)}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-orange-200/60 bg-gradient-to-br from-orange-50/50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-orange-600">Total Remboursé</p>
                    <p className="text-lg font-bold text-orange-700">{formatFCFA(totalRefund)}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                    <RotateCcw className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50/50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-amber-600">Net à percevoir</p>
                    <p className="text-lg font-bold text-amber-700">{formatFCFA(totalRevenue - totalRefund)}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                    <Receipt className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="N° facture ou client..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>

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

              <div>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="Du"
                  className="text-sm"
                />
              </div>

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
                              <div className="flex items-center justify-end gap-0.5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        openDetail(invoice)
                                      }}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Voir</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handlePrintA4(invoice)
                                      }}
                                    >
                                      <Printer className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Imprimer A4</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDownloadPDF(invoice)
                                      }}
                                    >
                                      <FileDown className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Télécharger PDF</TooltipContent>
                                </Tooltip>
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

        {/* ─── Detail Sheet ──────────────────────────────────────────────── */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent className="w-full sm:max-w-3xl overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
            <SheetHeader className="pb-2">
              <SheetTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-600" />
                Facture N° {selectedInvoice?.invoice_number || ''}
              </SheetTitle>
            </SheetHeader>

            {detailLoading ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : selectedInvoice ? (
              <div className="space-y-4 pb-8">
                {/* ── Professional Invoice Document ──────────────────────── */}
                <div className="bg-white rounded-lg shadow-xl border border-gray-200/60 relative overflow-hidden print:shadow-none print:border-gray-300">

                  {/* ── Status Watermark ──────────────────────────────── */}
                  {(selectedInvoice.status === 'cancelled' || selectedInvoice.status === 'refund') && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none select-none">
                      <span
                        className={`text-7xl sm:text-9xl font-black uppercase tracking-[0.25em] opacity-[0.06] ${
                          selectedInvoice.status === 'cancelled' ? 'text-red-600' : 'text-orange-600'
                        }`}
                        style={{ transform: 'rotate(-22deg)', display: 'inline-block' }}
                      >
                        {selectedInvoice.status === 'cancelled' ? 'ANNULÉE' : 'REMBOURSÉE'}
                      </span>
                    </div>
                  )}

                  {/* ═══════════════════════════════════════════════════════
                      INVOICE HEADER — Hotel branding + Invoice metadata
                      ═══════════════════════════════════════════════════════ */}
                  <div className="relative bg-gradient-to-br from-amber-50 via-white to-orange-50/30 px-6 sm:px-10 pt-7 pb-6">
                    {/* Decorative top-right corner accent */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-100/40 to-transparent rounded-bl-full" />

                    <div className="relative flex flex-col sm:flex-row items-start justify-between gap-5">
                      {/* Left: Hotel Branding */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-3.5">
                          <Image src="/logo.svg" alt="OGOU_Hôtel" height={56} width={56} className="object-contain" />
                          <div>
                            <h3 className="text-2xl font-extrabold bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent tracking-tight leading-none">OGOU_Hôtel</h3>
                            <p className="text-[11px] text-amber-600 font-bold tracking-[0.18em] uppercase mt-0.5">Hôtellerie &amp; Restauration</p>
                          </div>
                        </div>
                        <div className="space-y-1.5 pl-[68px]">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                            <span>Abidjan, Côte d&apos;Ivoire</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                            <span>+225 01 02 03 04 05</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Mail className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                            <span>contact@ogouhotel.ci</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Invoice metadata */}
                      <div className="text-right space-y-3 min-w-[180px]">
                        <div>
                          <p className="text-3xl sm:text-4xl font-black tracking-[0.12em] text-amber-700/80 uppercase leading-none">FACTURE</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-amber-200/50 px-4 py-3 shadow-sm space-y-2">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">N°</span>
                            <span className="text-sm font-bold text-gray-800">{selectedInvoice.invoice_number}</span>
                          </div>
                          <div className="h-px bg-amber-100" />
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Date</span>
                            <span className="text-xs font-semibold text-gray-600">{formatDateFR(selectedInvoice.created_at)}</span>
                          </div>
                          <div className="h-px bg-amber-100" />
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Statut</span>
                            {selectedInvoice.status === 'paid' ? (
                              <Badge className="bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-500 px-2.5 py-0.5 text-xs font-bold">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Payée
                              </Badge>
                            ) : selectedInvoice.status === 'pending' ? (
                              <Badge className="bg-amber-500 text-white border-amber-500 hover:bg-amber-500 px-2.5 py-0.5 text-xs font-bold">
                                <Clock className="h-3 w-3 mr-1" />
                                En attente
                              </Badge>
                            ) : selectedInvoice.status === 'refund' ? (
                              <Badge className="bg-orange-500 text-white border-orange-500 hover:bg-orange-500 px-2.5 py-0.5 text-xs font-bold">
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Remboursée
                              </Badge>
                            ) : selectedInvoice.status === 'cancelled' ? (
                              <Badge className="bg-red-500 text-white border-red-500 hover:bg-red-500 px-2.5 py-0.5 text-xs font-bold">
                                <Ban className="h-3 w-3 mr-1" />
                                Annulée
                              </Badge>
                            ) : (
                              getStatusBadge(selectedInvoice.status)
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Gradient separator bar */}
                  <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400" />

                  {/* ═══════════════════════════════════════════════════════
                      CLIENT & PAYMENT INFO
                      ═══════════════════════════════════════════════════════ */}
                  <div className="px-6 sm:px-10 py-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Client info */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100">
                          <Stamp className="h-3.5 w-3.5 text-amber-700" />
                        </div>
                        <p className="text-[11px] font-black text-amber-700 uppercase tracking-[0.15em]">Facturé à</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-2">
                        {selectedInvoice.customers ? (
                          <>
                            <p className="font-bold text-gray-900 text-base leading-tight">
                              {(selectedInvoice.customers as Record<string, unknown>).first_name} {(selectedInvoice.customers as Record<string, unknown>).last_name}
                            </p>
                            {(selectedInvoice.customers as Record<string, unknown>).phone && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                                <span>{String((selectedInvoice.customers as Record<string, unknown>).phone)}</span>
                              </div>
                            )}
                            {(selectedInvoice.customers as Record<string, unknown>).email && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                                <span>{String((selectedInvoice.customers as Record<string, unknown>).email)}</span>
                              </div>
                            )}
                            {(selectedInvoice.customers as Record<string, unknown>).identity_document_number && (
                              <div className="flex items-center gap-2 text-xs text-gray-400 mt-1 pt-1.5 border-t border-gray-200/60">
                                <span className="font-medium">Pièce d&apos;identité :</span>
                                <span>{String((selectedInvoice.customers as Record<string, unknown>).identity_document_number)}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-gray-400 italic">Client non renseigné</p>
                        )}
                      </div>
                    </div>

                    {/* Payment & Reservation info */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100">
                          <CircleDollarSign className="h-3.5 w-3.5 text-amber-700" />
                        </div>
                        <p className="text-[11px] font-black text-amber-700 uppercase tracking-[0.15em]">Mode de paiement</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-3">
                        <div className="flex items-center gap-2.5">
                          {getPaymentMethodBadge(selectedInvoice.payment_method)}
                          <span className="text-sm font-semibold text-gray-800">{getPaymentMethodLabel(selectedInvoice.payment_method)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span>Émise le {formatDateFR(selectedInvoice.created_at)}</span>
                        </div>

                        {/* Reservation details */}
                        {selectedInvoice.reservation_id && (() => {
                          const reservation = selectedInvoice.reservations as Record<string, unknown> | null
                          return (
                            <div className="pt-3 mt-1 border-t border-gray-200/80 space-y-2.5">
                              <div className="flex items-center gap-2">
                                <div className="flex h-5 w-5 items-center justify-center rounded bg-orange-100">
                                  <BedDouble className="h-3 w-3 text-orange-700" />
                                </div>
                                <p className="text-[10px] font-black text-orange-700 uppercase tracking-[0.15em]">Séjour</p>
                              </div>
                              {reservation?.rooms && (
                                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                  <Hotel className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                                  <span>Chambre {(reservation.rooms as Record<string, unknown>).room_number}</span>
                                  <span className="text-gray-300">·</span>
                                  <span className="font-normal text-gray-500">{(reservation.rooms as Record<string, unknown>).room_type}</span>
                                </div>
                              )}
                              {reservation?.check_in_date && (
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="rounded-md bg-emerald-50 border border-emerald-100 px-3 py-2 text-center">
                                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Arrivée</p>
                                    <p className="text-xs font-bold text-emerald-800 mt-0.5">{formatDateShort(reservation.check_in_date as string)}</p>
                                  </div>
                                  <div className="rounded-md bg-orange-50 border border-orange-100 px-3 py-2 text-center">
                                    <p className="text-[9px] font-bold text-orange-600 uppercase tracking-wider">Départ</p>
                                    <p className="text-xs font-bold text-orange-800 mt-0.5">{formatDateShort(reservation.check_out_date as string)}</p>
                                  </div>
                                </div>
                              )}
                              {!reservation && (
                                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                  <Link2 className="h-3 w-3 shrink-0" />
                                  <span>Liée à une réservation</span>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* ═══════════════════════════════════════════════════════
                      ITEMIZED BILLING TABLE
                      ═══════════════════════════════════════════════════════ */}
                  <div className="px-6 sm:px-10 pb-6">
                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-600 hover:to-orange-600">
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.14em] text-white py-3.5 pl-4">Désignation</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.14em] text-white text-center w-[72px] py-3.5">Nuits</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.14em] text-white text-right w-[130px] py-3.5">Prix unitaire</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.14em] text-white text-right w-[130px] py-3.5 pr-4">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(selectedInvoice.invoice_items || []).map((item, idx) => (
                            <TableRow
                              key={item.id}
                              className={`border-b border-gray-100 ${idx % 2 === 1 ? 'bg-amber-50/20' : 'bg-white'} hover:bg-amber-50/40`}
                            >
                              <TableCell className="text-sm text-gray-800 font-medium py-3.5 pl-4">{item.description}</TableCell>
                              <TableCell className="text-sm text-center text-gray-600 py-3.5 tabular-nums">{item.quantity}</TableCell>
                              <TableCell className="text-sm text-right text-gray-500 py-3.5 tabular-nums">{formatFCFA(item.unit_price)}</TableCell>
                              <TableCell className="text-sm text-right font-bold text-gray-900 py-3.5 pr-4 tabular-nums">{formatFCFA(item.total)}</TableCell>
                            </TableRow>
                          ))}
                          {/* Empty state if no items */}
                          {(!selectedInvoice.invoice_items || selectedInvoice.invoice_items.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-sm text-gray-400 py-6 italic">
                                Aucun article facturé
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* ═══════════════════════════════════════════════════════
                      TOTALS SECTION
                      ═══════════════════════════════════════════════════════ */}
                  <div className="px-6 sm:px-10 pb-6">
                    <div className="flex justify-end">
                      <div className="w-full sm:w-[340px] space-y-0">
                        {/* Subtotal */}
                        <div className="flex justify-between items-center py-2.5 px-4 border-b border-gray-100">
                          <span className="text-sm text-gray-500">Sous-total HT</span>
                          <span className="text-sm font-semibold text-gray-700 tabular-nums">{formatFCFA(selectedInvoice.subtotal)}</span>
                        </div>
                        {/* Tourist tax */}
                        {Number(selectedInvoice.tourist_tax) > 0 && (
                          <div className="flex justify-between items-center py-2.5 px-4 border-b border-gray-100">
                            <span className="text-sm text-gray-500">Taxe de séjour</span>
                            <span className="text-sm font-semibold text-gray-700 tabular-nums">{formatFCFA(selectedInvoice.tourist_tax)}</span>
                          </div>
                        )}
                        {/* VAT */}
                        {Number(selectedInvoice.vat) > 0 && (
                          <div className="flex justify-between items-center py-2.5 px-4 border-b border-gray-100">
                            <span className="text-sm text-gray-500">TVA (18%)</span>
                            <span className="text-sm font-semibold text-gray-700 tabular-nums">{formatFCFA(selectedInvoice.vat)}</span>
                          </div>
                        )}
                        {/* Grand Total */}
                        <div className="mt-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-4 shadow-lg shadow-amber-500/25 flex justify-between items-center">
                          <span className="text-base font-extrabold text-white tracking-wide uppercase">Total TTC</span>
                          <span className="text-xl sm:text-2xl font-black text-white tabular-nums tracking-tight">{formatFCFA(selectedInvoice.total_amount)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ═══════════════════════════════════════════════════════
                      NOTES SECTION
                      ═══════════════════════════════════════════════════════ */}
                  {selectedInvoice.notes && (
                    <div className="px-6 sm:px-10 pb-6">
                      <div className="rounded-lg border border-amber-200/60 bg-gradient-to-r from-amber-50/50 to-orange-50/30 p-4 flex gap-3">
                        <Quote className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.15em] mb-1">Notes</p>
                          <p className="text-sm text-gray-600 leading-relaxed">{selectedInvoice.notes}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ═══════════════════════════════════════════════════════
                      PROFESSIONAL FOOTER
                      ═══════════════════════════════════════════════════════ */}
                  <div className="border-t-2 border-amber-200/40 bg-gradient-to-b from-gray-50/50 to-gray-100/30 px-6 sm:px-10 py-5">
                    <div className="space-y-3">
                      {/* Hotel legal info row */}
                      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-amber-500" />
                          <span className="font-bold text-gray-700">OGOU_Hôtel</span>
                        </div>
                        <span className="text-gray-300">•</span>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-amber-500" />
                          <span>Abidjan, Côte d&apos;Ivoire</span>
                        </div>
                        <span className="text-gray-300">•</span>
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-amber-500" />
                          <span>+225 01 02 03 04 05</span>
                        </div>
                        <span className="text-gray-300">•</span>
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-amber-500" />
                          <span>contact@ogouhotel.ci</span>
                        </div>
                      </div>

                      {/* Banking & legal */}
                      <div className="text-center space-y-1">
                        <p className="text-[10px] text-gray-400 tracking-wide">
                          N° CC : CI-ABJ-2024-001 · Compte Bancaire : CI00 XXXX XXXX XXXX · BIC : OGOUCCIAB
                        </p>
                      </div>

                      {/* Thank you message */}
                      <div className="text-center pt-1">
                        <Separator className="max-w-[100px] mx-auto bg-gradient-to-r from-transparent via-amber-300 to-transparent h-px" />
                        <p className="text-xs font-bold text-amber-600 tracking-widest uppercase mt-2">
                          Merci pour votre confiance
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5 italic">
                          Nous espérons vous revoir bientôt
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Action Buttons (outside paper) ──────────────────── */}
                <div className="space-y-3">
                  {/* Primary actions */}
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      className="w-full justify-center h-11 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20 font-semibold"
                      onClick={() => handlePrintA4(selectedInvoice)}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Imprimer A4
                    </Button>
                    <Button
                      className="w-full justify-center h-11 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20 font-semibold"
                      onClick={() => handlePrintThermal(selectedInvoice)}
                    >
                      <Receipt className="h-4 w-4 mr-2" />
                      Ticket 80mm
                    </Button>
                  </div>

                  {/* Secondary action */}
                  <Button
                    variant="outline"
                    className="w-full justify-center h-10 border-amber-200 text-amber-700 hover:bg-amber-50 font-medium"
                    onClick={() => handleDownloadPDF(selectedInvoice)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger PDF
                  </Button>

                  {/* Danger zone */}
                  {(selectedInvoice.status === 'paid' || selectedInvoice.status === 'pending') && (
                    <>
                      {selectedInvoice.status === 'pending' && (
                        <>
                          <Separator className="bg-emerald-100" />
                          <Button
                            className="w-full justify-center h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                            onClick={() => {
                              setMarkPaidPaymentMethod(selectedInvoice.payment_method)
                              setMarkPaidDialogOpen(true)
                            }}
                            disabled={statusChanging}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Marquer comme Payée
                          </Button>
                        </>
                      )}

                      {/* Download Receipt for paid invoices */}
                      {selectedInvoice.status === 'paid' && selectedInvoice.receipt_number && (
                        <>
                          <Separator className="bg-emerald-100" />
                          <Button
                            className="w-full justify-center h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                            onClick={() => handleDownloadReceipt(selectedInvoice)}
                          >
                            <Receipt className="h-4 w-4 mr-2" />
                            Télécharger le Reçu ({selectedInvoice.receipt_number})
                          </Button>
                        </>
                      )}
                      <Separator className="bg-red-100" />
                      <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest text-center">Zone de danger</p>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant="outline"
                          className="w-full justify-center h-10 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200 font-medium"
                          onClick={() => {
                            setStatusChangeTarget('refund')
                            setStatusDialogOpen(true)
                          }}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Rembourser
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-center h-10 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 font-medium"
                          onClick={() => {
                            setStatusChangeTarget('cancelled')
                            setStatusDialogOpen(true)
                          }}
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          Annuler
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </SheetContent>
        </Sheet>

        {/* ─── Create Invoice Dialog ────────────────────────────────────────── */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                  <Plus className="h-4 w-4 text-amber-600" />
                </div>
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

              {/* Invoice Status */}
              <div className="space-y-2">
                <Label>Statut de la facture *</Label>
                <Select value={formInvoiceStatus} onValueChange={(v) => setFormInvoiceStatus(v as 'paid' | 'pending')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Payée
                      </span>
                    </SelectItem>
                    <SelectItem value="pending">
                      <span className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                        En attente de paiement
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes (optionnel)</Label>
                <Textarea
                  placeholder="Notes internes ou observations..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Total Preview */}
              <div className="bg-amber-50/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total HT</span>
                  <span>{formatFCFA(subtotal)}</span>
                </div>
                {formTouristTax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxe de séjour</span>
                    <span>{formatFCFA(formTouristTax)}</span>
                  </div>
                )}
                {vat > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TVA (18%)</span>
                    <span>{formatFCFA(vat)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold text-amber-700">
                  <span>Total TTC</span>
                  <span>{formatFCFA(totalTTC)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleCreateInvoice}
                disabled={submitting}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Créer la facture
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Status Change AlertDialog ──────────────────────────────────── */}
        <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${statusChangeTarget === 'cancelled' ? 'bg-red-100' : 'bg-orange-100'}`}>
                  {statusChangeTarget === 'cancelled' ? <Ban className="h-4 w-4 text-red-600" /> : <RotateCcw className="h-4 w-4 text-orange-600" />}
                </div>
                {statusChangeTarget === 'refund' ? 'Rembourser la facture' : 'Annuler la facture'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {statusChangeTarget === 'refund'
                  ? `Êtes-vous sûr de vouloir marquer la facture ${selectedInvoice?.invoice_number} comme remboursée ? Cette action est irréversible.`
                  : `Êtes-vous sûr de vouloir annuler la facture ${selectedInvoice?.invoice_number} ? Cette action est irréversible.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className={`rounded-lg border p-3 flex items-start gap-2 ${statusChangeTarget === 'cancelled' ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'}`}>
              <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${statusChangeTarget === 'cancelled' ? 'text-red-600' : 'text-orange-600'}`} />
              <p className={`text-xs ${statusChangeTarget === 'cancelled' ? 'text-red-800' : 'text-orange-800'}`}>
                {statusChangeTarget === 'refund'
                  ? 'Le remboursement sera enregistré et un reçu de remboursement pourra être généré.'
                  : 'La facture sera marquée comme annulée et ne pourra plus être modifiée.'}
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleStatusChange}
                className={statusChangeTarget === 'cancelled' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}
              >
                {statusChanging ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Confirmer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ─── Mark as Paid Dialog ───────────────────────────────────────── */}
        <Dialog open={markPaidDialogOpen} onOpenChange={setMarkPaidDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                Marquer comme Payée
              </DialogTitle>
              <DialogDescription>
                Facture {selectedInvoice?.invoice_number} — {selectedInvoice ? formatFCFA(selectedInvoice.total_amount) : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-gray-50 p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Montant</span>
                  <span className="font-bold text-lg">{selectedInvoice ? formatFCFA(selectedInvoice.total_amount) : ''}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Facture</span>
                  <span>{selectedInvoice?.invoice_number}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Mode de paiement</Label>
                <Select value={markPaidPaymentMethod} onValueChange={(v) => setMarkPaidPaymentMethod(v as PaymentMethod)}>
                  <SelectTrigger>
                    <SelectValue />
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
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 flex items-start gap-2">
                <Receipt className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>Un reçu (REC-YYYY-XXXX) sera automatiquement généré.</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMarkPaidDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleStatusChange('paid')}
                disabled={markPaidLoading}
              >
                {markPaidLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Confirmer le paiement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
