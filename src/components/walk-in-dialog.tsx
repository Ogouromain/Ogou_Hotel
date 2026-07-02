'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Search,
  UserPlus,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Bed,
  DoorOpen,
  X,
  FileText,
  CreditCard,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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

import { Checkbox } from '@/components/ui/checkbox'

interface WalkInDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rooms: Array<{
    id: string
    room_number: string
    room_type: string
    status: string
    price_per_night: number
  }>
  onSuccess: () => void
}

interface CustomerSearchResult {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WalkInDialog({
  open,
  onOpenChange,
  rooms,
  onSuccess,
}: WalkInDialogProps) {
  const [step, setStep] = useState(1) // 1 = Client, 2 = Chambre & Date

  // Step 1: Customer selection
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null)
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newDocType, setNewDocType] = useState('')
  const [newDocNumber, setNewDocNumber] = useState('')

  // Step 2: Room + checkout date
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [checkOutDate, setCheckOutDate] = useState('')

  // Invoice options
  const [generateInvoice, setGenerateInvoice] = useState(true)
  const [paymentMethod, setPaymentMethod] = useState('Espèces')
  const [invoiceStatus, setInvoiceStatus] = useState<'paid' | 'pending'>('paid')

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [generatedInvoiceId, setGeneratedInvoiceId] = useState<string | null>(null)

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Reset form on dialog open/close ──────────────────────────────
  useEffect(() => {
    if (open) {
      setStep(1)
      setSearchQuery('')
      setSearchResults([])
      setSelectedCustomer(null)
      setShowNewCustomerForm(false)
      setNewFirstName('')
      setNewLastName('')
      setNewPhone('')
      setNewEmail('')
      setNewDocType('')
      setNewDocNumber('')
      setSelectedRoomId('')
      setCheckOutDate('')
      setSubmitting(false)
      setGenerateInvoice(true)
      setPaymentMethod('Espèces')
      setInvoiceStatus('paid')
      setGeneratedInvoiceId(null)
    }
  }, [open])

  // ─── Debounced search ─────────────────────────────────────────────
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (!value.trim()) {
      setSearchResults([])
      return
    }

    setSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/owner/customers?search=${encodeURIComponent(value.trim())}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.customers || [])
        }
      } catch {
        toast.error('Erreur lors de la recherche')
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [])

  // ─── Price calculation ────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId)
  const numberOfNights =
    checkOutDate ? Math.ceil((new Date(checkOutDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0
  const totalPrice = selectedRoom && numberOfNights > 0 ? selectedRoom.price_per_night * numberOfNights : 0

  // ─── Available rooms (only available + cleaning) ──────────────────
  const availableRooms = rooms.filter(
    (r) => r.status === 'available' || r.status === 'cleaning'
  )

  // ─── Step validation ──────────────────────────────────────────────
  const isNewCustomerValid =
    newFirstName.trim() && newLastName.trim() && newPhone.trim()

  const isStep1Valid = selectedCustomer !== null || (showNewCustomerForm && isNewCustomerValid)

  const isStep2Valid =
    selectedRoomId && checkOutDate && numberOfNights > 0

  // ─── Submit ───────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        room_id: selectedRoomId,
        check_out_date: checkOutDate,
        generate_invoice: generateInvoice,
        payment_method: paymentMethod,
        invoice_status: invoiceStatus,
      }

      if (selectedCustomer) {
        payload.customer_id = selectedCustomer.id
      } else if (showNewCustomerForm) {
        payload.first_name = newFirstName.trim()
        payload.last_name = newLastName.trim()
        payload.phone = newPhone.trim()
        payload.email = newEmail.trim() || null
        payload.identity_document_type = newDocType || null
        payload.identity_document_number = newDocNumber.trim() || null
      }

      const res = await fetch('/api/owner/reservations/walk-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.status === 409) {
        const data = await res.json()
        toast.error(data.error || 'Conflit de réservation')
        setSubmitting(false)
        return
      }

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de l\'enregistrement')
        setSubmitting(false)
        return
      }

      const customerName = selectedCustomer
        ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
        : `${newFirstName} ${newLastName}`
      const roomNumber = selectedRoom?.room_number || ''

      const data = await res.json()

      if (generateInvoice && data.invoice) {
        setGeneratedInvoiceId(data.invoice.id)
        toast.success(`${customerName} enregistré(e) en chambre ${roomNumber} ! Facture ${data.invoice.invoice_number} créée.`, {
          duration: 6000,
        })
      } else {
        toast.success(`${customerName} enregistré(e) en chambre ${roomNumber} !`)
      }

      onSuccess()
      onOpenChange(false)
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  function formatDateShort(dateStr: string): string {
    try {
      return format(parseISO(dateStr), 'dd MMM yyyy', { locale: fr })
    } catch {
      return dateStr
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
              <DoorOpen className="h-4 w-4 text-emerald-600" />
            </div>
            Enregistrement Direct (Walk-In)
          </DialogTitle>
          <DialogDescription>
            Client sans réservation — enregistrement et attribution de chambre immédiats
          </DialogDescription>
        </DialogHeader>

        {/* ─── Step Indicator ────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-0 py-3">
          {[
            { num: 1, label: 'Client' },
            { num: 2, label: 'Chambre' },
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all ${
                    step > s.num
                      ? 'bg-emerald-500 text-white'
                      : step === s.num
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step > s.num ? <CheckCircle2 className="h-5 w-5" /> : s.num}
                </div>
                <span className={`text-[10px] mt-1 font-medium ${step >= s.num ? 'text-emerald-700' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
              {idx < 1 && (
                <div className={`w-16 sm:w-24 h-0.5 mx-2 mb-4 transition-colors ${step > s.num ? 'bg-emerald-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* ─── Walk-in badge ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
          <Bed className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-xs text-emerald-700">
            Arrivée : <strong>Aujourd&apos;hui ({formatDateShort(today)})</strong> — Check-in automatique
          </span>
        </div>

        <Separator />

        {/* ─── Step 1: Client ────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            {/* Nouveau Client button */}
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Informations du Client</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={() => {
                  setShowNewCustomerForm(!showNewCustomerForm)
                  if (!showNewCustomerForm) {
                    setSelectedCustomer(null)
                  }
                }}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Nouveau Client
              </Button>
            </div>

            {/* New Customer Form */}
            {showNewCustomerForm && (
              <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                <p className="text-sm font-medium text-emerald-800 flex items-center gap-1">
                  <UserPlus className="h-4 w-4" />
                  Nouveau client
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="walkin-first-name" className="text-xs">Prénom *</Label>
                    <Input
                      id="walkin-first-name"
                      placeholder="Prénom"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="walkin-last-name" className="text-xs">Nom *</Label>
                    <Input
                      id="walkin-last-name"
                      placeholder="Nom"
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="walkin-phone" className="text-xs">Téléphone *</Label>
                    <Input
                      id="walkin-phone"
                      placeholder="+225 XX XX XX XX"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="walkin-email" className="text-xs">Email</Label>
                    <Input
                      id="walkin-email"
                      type="email"
                      placeholder="email@exemple.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="walkin-doc-type" className="text-xs">Type de document</Label>
                    <Select value={newDocType} onValueChange={setNewDocType}>
                      <SelectTrigger id="walkin-doc-type">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CNI">CNI</SelectItem>
                        <SelectItem value="Passeport">Passeport</SelectItem>
                        <SelectItem value="Attestation">Attestation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="walkin-doc-number" className="text-xs">N° Document</Label>
                    <Input
                      id="walkin-doc-number"
                      placeholder="Numéro du document"
                      value={newDocNumber}
                      onChange={(e) => setNewDocNumber(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Search bar for existing customer */}
            {!showNewCustomerForm && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher un client existant par nom, téléphone..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-emerald-500" />
                  )}
                </div>

                {/* Search results */}
                <div className="space-y-2 max-h-64 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-gray-50 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                  {searchQuery && !searching && searchResults.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      Aucun client trouvé. Créez un nouveau client.
                    </p>
                  )}
                  {searchResults.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      className={`w-full text-left rounded-lg border p-3 transition-all hover:border-emerald-300 ${
                        selectedCustomer?.id === customer.id
                          ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20'
                          : 'border-gray-200 bg-white'
                      }`}
                      onClick={() => {
                        setSelectedCustomer(customer)
                        setShowNewCustomerForm(false)
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">
                            {customer.first_name} {customer.last_name}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span>📱 {customer.phone}</span>
                            {customer.email && <span>✉️ {customer.email}</span>}
                          </div>
                        </div>
                        {selectedCustomer?.id === customer.id && (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                  {!searchQuery && !searchResults.length && (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      Tapez un nom ou numéro de téléphone pour rechercher un client
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── Step 2: Chambre & Date de départ ──────────────────────── */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <Label className="text-base font-semibold">Chambre & Date de départ</Label>

            {/* Room selection */}
            <div className="space-y-1.5">
              <Label htmlFor="walkin-room-select">Chambre disponible *</Label>
              <Select
                value={selectedRoomId}
                onValueChange={setSelectedRoomId}
              >
                <SelectTrigger id="walkin-room-select">
                  <SelectValue placeholder="Sélectionner une chambre" />
                </SelectTrigger>
                <SelectContent>
                  {availableRooms.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Aucune chambre disponible
                    </SelectItem>
                  ) : (
                    availableRooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        <span className="flex items-center gap-2">
                          <span className="font-mono font-semibold">N°{room.room_number}</span>
                          <span className="text-muted-foreground">— {room.room_type}</span>
                          <span className="text-emerald-600 font-medium">{formatFCFA(room.price_per_night)}/nuit</span>
                          {room.status === 'cleaning' && (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] ml-1">
                              Nettoyage
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {availableRooms.length === 0 && (
                <p className="text-xs text-red-500">Aucune chambre disponible pour le moment</p>
              )}
            </div>

            {/* Check-out date */}
            <div className="space-y-1.5">
              <Label htmlFor="walkin-check-out">Date de départ *</Label>
              <Input
                id="walkin-check-out"
                type="date"
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
              />
            </div>

            {/* Summary card */}
            {selectedRoom && checkOutDate && numberOfNights > 0 && (
              <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                <p className="text-sm font-medium text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Résumé de l&apos;enregistrement
                </p>

                {/* Client info */}
                <div className="flex items-start gap-3 bg-white rounded-lg p-3 border border-emerald-100">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold shrink-0">
                    {selectedCustomer
                      ? `${selectedCustomer.first_name.charAt(0)}${selectedCustomer.last_name.charAt(0)}`
                      : `${newFirstName.charAt(0)}${newLastName.charAt(0)}`
                    }
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {selectedCustomer
                        ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
                        : `${newFirstName} ${newLastName}`
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">
                      📱 {selectedCustomer?.phone || newPhone}
                    </p>
                    {selectedCustomer?.email && (
                      <p className="text-xs text-muted-foreground">✉️ {selectedCustomer.email}</p>
                    )}
                    {!selectedCustomer && newEmail && (
                      <p className="text-xs text-muted-foreground">✉️ {newEmail}</p>
                    )}
                    {!selectedCustomer && (
                      <Badge className="mt-1 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px]">
                        Nouveau client
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Room info */}
                <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-emerald-100">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-700 shrink-0">
                    <Bed className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      Chambre N°{selectedRoom.room_number} — {selectedRoom.room_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFCFA(selectedRoom.price_per_night)}/nuit
                    </p>
                  </div>
                </div>

                {/* Dates */}
                <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-emerald-100">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 shrink-0">
                    <DoorOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {formatDateShort(today)} → {formatDateShort(checkOutDate)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {numberOfNights} nuit{numberOfNights > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Price calculation */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Prix par nuit</span>
                    <span>{formatFCFA(selectedRoom.price_per_night)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Nombre de nuits</span>
                    <span>{numberOfNights} nuit{numberOfNights > 1 ? 's' : ''}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-emerald-900">Montant Total</span>
                    <span className="text-xl font-bold text-emerald-700">{formatFCFA(totalPrice)}</span>
                  </div>
                </div>

                {/* Status indicator */}
                <div className="flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-medium text-emerald-800">
                    Le client sera immédiatement enregistré (check-in) et la chambre marquée occupée
                  </span>
                </div>

                <Separator />

                {/* Invoice Options */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="generate-invoice"
                      checked={generateInvoice}
                      onCheckedChange={(checked) => setGenerateInvoice(checked === true)}
                    />
                    <Label htmlFor="generate-invoice" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-amber-600" />
                      Générer une facture automatiquement
                    </Label>
                  </div>

                  {generateInvoice && (
                    <div className="space-y-3 pl-6 border-l-2 border-amber-200">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Mode de paiement</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Espèces">💵 Espèces</SelectItem>
                            <SelectItem value="OM">📱 Orange Money</SelectItem>
                            <SelectItem value="MTN">📱 MTN Money</SelectItem>
                            <SelectItem value="Wave">📱 Wave</SelectItem>
                            <SelectItem value="Carte">💳 Carte bancaire</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Statut de la facture</Label>
                        <Select value={invoiceStatus} onValueChange={(v) => setInvoiceStatus(v as 'paid' | 'pending')}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="paid">
                              <span className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                Payée (le client paie maintenant)
                              </span>
                            </SelectItem>
                            <SelectItem value="pending">
                              <span className="flex items-center gap-2">
                                <CreditCard className="h-3.5 w-3.5 text-amber-600" />
                                En attente (à payer plus tard)
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {checkOutDate && numberOfNights <= 0 && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                La date de départ doit être postérieure à demain
              </p>
            )}
          </div>
        )}

        {/* ─── Footer Buttons ────────────────────────────────────────── */}
        <DialogFooter className="flex-row items-center justify-between gap-2 pt-2">
          {step > 1 ? (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={submitting}
            >
              Précédent
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
          )}

          {step < 2 ? (
            <Button
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20"
              disabled={!isStep1Valid}
              onClick={() => setStep(step + 1)}
            >
              Suivant
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20"
              disabled={!isStep2Valid || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <DoorOpen className="h-4 w-4 mr-2" />
                  Enregistrer le Client
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
