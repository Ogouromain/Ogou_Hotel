/**
 * OGOU_Hôtel — Export Utilities
 * CSV and data export utilities for the hotel management SaaS.
 * Supports French formatting (FCFA, dates FR) and BOM for Excel compatibility.
 */

// ─── CSV Generation ─────────────────────────────────────────────────────────

/**
 * Generates a CSV string from an array of objects.
 * Adds UTF-8 BOM for proper Excel display of French characters (accents, FCFA).
 */
export function generateCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; label: string; format?: (value: unknown, row: T) => string }[],
  options?: { filename?: string }
): string {
  // UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF'
  const separator = ';'

  // Header row
  const header = columns.map(col => `"${col.label}"`).join(separator)

  // Data rows
  const rows = data.map(row => {
    return columns.map(col => {
      const raw = row[col.key]
      const formatted = col.format ? col.format(raw, row) : String(raw ?? '')
      // Escape double quotes and wrap in quotes
      return `"${formatted.replace(/"/g, '""')}"`
    }).join(separator)
  })

  return BOM + header + '\n' + rows.join('\n')
}

/**
 * Triggers a file download in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Triggers a CSV download.
 */
export function downloadCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; label: string; format?: (value: unknown, row: T) => string }[],
  filename: string
) {
  const csv = generateCSV(data, columns)
  downloadFile(csv, filename)
}

// ─── Invoice-specific Export ────────────────────────────────────────────────

export interface InvoiceExportRow {
  invoice_number: string
  customer_name: string
  customer_phone: string
  subtotal: number
  tourist_tax: number
  vat: number
  total_amount: number
  payment_method: string
  status: string
  created_at: string
  reservation_id: string | null
  items_count: number
}

export const INVOICE_EXPORT_COLUMNS: {
  key: keyof InvoiceExportRow
  label: string
  format?: (value: unknown) => string
}[] = [
  { key: 'invoice_number', label: 'N° Facture' },
  { key: 'customer_name', label: 'Client' },
  { key: 'customer_phone', label: 'Téléphone' },
  { key: 'subtotal', label: 'Sous-total HT (FCFA)', format: (v) => formatNumberFR(Number(v)) },
  { key: 'tourist_tax', label: 'Taxe de séjour (FCFA)', format: (v) => formatNumberFR(Number(v)) },
  { key: 'vat', label: 'TVA 18% (FCFA)', format: (v) => formatNumberFR(Number(v)) },
  { key: 'total_amount', label: 'Total TTC (FCFA)', format: (v) => formatNumberFR(Number(v)) },
  { key: 'payment_method', label: 'Mode de paiement', format: (v) => getPaymentLabel(String(v)) },
  { key: 'status', label: 'Statut', format: (v) => getStatusLabel(String(v)) },
  { key: 'created_at', label: 'Date de création', format: (v) => formatDateFR(String(v)) },
  { key: 'reservation_id', label: 'ID Réservation' },
  { key: 'items_count', label: 'Nombre d\'articles' },
]

// ─── Reservation Export ─────────────────────────────────────────────────────

export interface ReservationExportRow {
  id: string
  customer_name: string
  room_number: string
  room_type: string
  check_in_date: string
  check_out_date: string
  total_price: number
  status: string
  created_at: string
}

export const RESERVATION_EXPORT_COLUMNS: {
  key: keyof ReservationExportRow
  label: string
  format?: (value: unknown) => string
}[] = [
  { key: 'id', label: 'ID Réservation' },
  { key: 'customer_name', label: 'Client' },
  { key: 'room_number', label: 'Chambre' },
  { key: 'room_type', label: 'Type' },
  { key: 'check_in_date', label: 'Date d\'arrivée', format: (v) => formatDateFR(String(v)) },
  { key: 'check_out_date', label: 'Date de départ', format: (v) => formatDateFR(String(v)) },
  { key: 'total_price', label: 'Prix total (FCFA)', format: (v) => formatNumberFR(Number(v)) },
  { key: 'status', label: 'Statut', format: (v) => getReservationStatusLabel(String(v)) },
  { key: 'created_at', label: 'Créée le', format: (v) => formatDateFR(String(v)) },
]

// ─── Customer Export ────────────────────────────────────────────────────────

export interface CustomerExportRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string
  identity_document_type: string | null
  identity_document_number: string | null
  created_at: string
}

export const CUSTOMER_EXPORT_COLUMNS: {
  key: keyof CustomerExportRow
  label: string
  format?: (value: unknown) => string
}[] = [
  { key: 'id', label: 'ID Client' },
  { key: 'first_name', label: 'Prénom' },
  { key: 'last_name', label: 'Nom' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'identity_document_type', label: 'Type document' },
  { key: 'identity_document_number', label: 'N° document' },
  { key: 'created_at', label: 'Créé le', format: (v) => formatDateFR(String(v)) },
]

// ─── Analytics Export ───────────────────────────────────────────────────────

export interface AnalyticsExportRow {
  metric: string
  value: string
  period: string
}

export const ANALYTICS_EXPORT_COLUMNS: {
  key: keyof AnalyticsExportRow
  label: string
}[] = [
  { key: 'metric', label: 'Indicateur' },
  { key: 'value', label: 'Valeur' },
  { key: 'period', label: 'Période' },
]

// ─── Formatting Helpers ─────────────────────────────────────────────────────

export function formatNumberFR(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value)
}

export function formatFCFA(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value) + ' FCFA'
}

export function formatDateFR(dateStr: string): string {
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

const PAYMENT_LABELS: Record<string, string> = {
  'OM': 'Orange Money',
  'MTN': 'MTN Money',
  'Wave': 'Wave',
  'Espèces': 'Espèces',
  'Chèque': 'Chèque',
  'Carte': 'Carte bancaire',
}

function getPaymentLabel(method: string): string {
  return PAYMENT_LABELS[method] || method
}

const STATUS_LABELS: Record<string, string> = {
  'paid': 'Payée',
  'refund': 'Remboursée',
  'cancelled': 'Annulée',
}

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status
}

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  'pending': 'En attente',
  'confirmed': 'Confirmée',
  'checked_in': 'Enregistré',
  'checked_out': 'Départ',
  'cancelled': 'Annulée',
}

function getReservationStatusLabel(status: string): string {
  return RESERVATION_STATUS_LABELS[status] || status
}
