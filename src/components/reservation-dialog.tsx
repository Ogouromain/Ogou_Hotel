'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { differenceInDays, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Search,
  UserPlus,
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Upload,
  X,
  FileText,
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReservationCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rooms: Array<{
    id: string
    room_number: string
    room_type: string
    status: string
    price_per_night: number
  }>
  preselectedRoomId?: string | null
  preselectedDate?: string | null // YYYY-MM-DD
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ReservationCreationDialog({
  open,
  onOpenChange,
  rooms,
  preselectedRoomId,
  preselectedDate,
  onSuccess,
}: ReservationCreationDialogProps) {
  const [step, setStep] = useState(1)

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
  const [newDocFile, setNewDocFile] = useState<File | null>(null)
  const [newDocPreview, setNewDocPreview] = useState<string | null>(null)

  // Step 2: Reservation details
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [checkInDate, setCheckInDate] = useState('')
  const [checkOutDate, setCheckOutDate] = useState('')

  // Step 3: Submit
  const [submitting, setSubmitting] = useState(false)

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Reset form on dialog open/close ──────────────────────────────────
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
      setNewDocFile(null)
      setNewDocPreview(null)
      setSubmitting(false)

      // Preselect room if provided
      if (preselectedRoomId) {
        setSelectedRoomId(preselectedRoomId)
      } else {
        setSelectedRoomId('')
      }

      // Preselect date if provided
      if (preselectedDate) {
        setCheckInDate(preselectedDate)
        setCheckOutDate('')
      } else {
        setCheckInDate('')
        setCheckOutDate('')
      }
    }
  }, [open, preselectedRoomId, preselectedDate])

  // ─── Debounced search ─────────────────────────────────────────────────
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

  // ─── File handler ─────────────────────────────────────────────────────
  async function handleDocFileChange(file: File | null) {
    setNewDocFile(file)
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => setNewDocPreview(e.target?.result as string)
        reader.readAsDataURL(file)
      } else {
        setNewDocPreview(null)
      }
    } else {
      setNewDocPreview(null)
    }
  }

  // ─── Price calculation ────────────────────────────────────────────────
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId)
  const numberOfNights =
    checkInDate && checkOutDate ? differenceInDays(parseISO(checkOutDate), parseISO(checkInDate)) : 0
  const totalPrice = selectedRoom && numberOfNights > 0 ? selectedRoom.price_per_night * numberOfNights : 0

  // ─── Step validation ──────────────────────────────────────────────────
  const isNewCustomerValid =
    newFirstName.trim() && newLastName.trim() && newPhone.trim()

  const isStep1Valid = selectedCustomer !== null || (showNewCustomerForm && isNewCustomerValid)

  const isStep2Valid =
    selectedRoomId && checkInDate && checkOutDate && numberOfNights > 0

  // ─── Submit ───────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true)
    try {
      let customerId = selectedCustomer?.id

      // If new customer, create first
      if (!customerId && showNewCustomerForm) {
        const customerPayload: Record<string, unknown> = {
          first_name: newFirstName.trim(),
          last_name: newLastName.trim(),
          phone: newPhone.trim(),
          email: newEmail.trim() || null,
          identity_document_type: newDocType || null,
          identity_document_number: newDocNumber.trim() || null,
        }

        if (newDocFile) {
          const base64 = await fileToBase64(newDocFile)
          customerPayload.identity_document_file = base64
          customerPayload.identity_document_mime_type = newDocFile.type
        }

        const customerRes = await fetch('/api/owner/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customerPayload),
        })

        if (!customerRes.ok) {
          const data = await customerRes.json()
          toast.error(data.error || 'Erreur lors de la création du client')
          setSubmitting(false)
          return
        }

        const customerData = await customerRes.json()
        customerId = customerData.customer.id
      }

      if (!customerId) {
        toast.error('Aucun client sélectionné')
        setSubmitting(false)
        return
      }

      // Create reservation
      const reservationRes = await fetch('/api/owner/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          room_id: selectedRoomId,
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
        }),
      })

      if (reservationRes.status === 409) {
        const data = await reservationRes.json()
        toast.error(data.error || 'Conflit de réservation')
        if (data.conflict) {
          toast.error(
            `Conflit avec la réservation de ${data.conflict.customer} du ${formatDateShort(data.conflict.check_in_date)} au ${formatDateShort(data.conflict.check_out_date)}`
          )
        }
        setSubmitting(false)
        return
      }

      if (!reservationRes.ok) {
        const data = await reservationRes.json()
        toast.error(data.error || 'Erreur lors de la création de la réservation')
        setSubmitting(false)
        return
      }

      toast.success('Réservation créée avec succès !')
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

  // ─── Available rooms for select ───────────────────────────────────────
  const availableRooms = rooms.filter(
    (r) => r.status === 'available' || r.id === preselectedRoomId
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📅 Nouvelle Réservation
          </DialogTitle>
          <DialogDescription>Créez une réservation en 3 étapes</DialogDescription>
        </DialogHeader>

        {/* ─── Step Indicator ────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-0 py-4">
          {[
            { num: 1, label: 'Client' },
            { num: 2, label: 'Détails' },
            { num: 3, label: 'Validation' },
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all ${
                    step > s.num
                      ? 'bg-emerald-500 text-white'
                      : step === s.num
                        ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step > s.num ? <CheckCircle2 className="h-5 w-5" /> : s.num}
                </div>
                <span className={`text-[10px] mt-1 font-medium ${step >= s.num ? 'text-amber-700' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
              {idx < 2 && (
                <div className={`w-12 sm:w-20 h-0.5 mx-1 mb-4 transition-colors ${step > s.num ? 'bg-emerald-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <Separator />

        {/* ─── Step 1: Choix du Client ───────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            {/* Nouveau Client button */}
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Choix du Client</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-amber-200 text-amber-700 hover:bg-amber-50"
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
              <div className="rounded-lg border-2 border-amber-200 bg-amber-50/50 p-4 space-y-3">
                <p className="text-sm font-medium text-amber-800 flex items-center gap-1">
                  <UserPlus className="h-4 w-4" />
                  Nouveau client
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="new-first-name" className="text-xs">Prénom *</Label>
                    <Input
                      id="new-first-name"
                      placeholder="Prénom"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-last-name" className="text-xs">Nom *</Label>
                    <Input
                      id="new-last-name"
                      placeholder="Nom"
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="new-phone" className="text-xs">Téléphone *</Label>
                    <Input
                      id="new-phone"
                      placeholder="+225 XX XX XX XX"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-email" className="text-xs">Email</Label>
                    <Input
                      id="new-email"
                      type="email"
                      placeholder="email@exemple.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="new-doc-type" className="text-xs">Type de document</Label>
                    <Select value={newDocType} onValueChange={setNewDocType}>
                      <SelectTrigger id="new-doc-type">
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
                    <Label htmlFor="new-doc-number" className="text-xs">N° Document</Label>
                    <Input
                      id="new-doc-number"
                      placeholder="Numéro du document"
                      value={newDocNumber}
                      onChange={(e) => setNewDocNumber(e.target.value)}
                    />
                  </div>
                </div>
                {/* Document upload */}
                <div className="space-y-1">
                  <Label className="text-xs">Pièce d&apos;identité</Label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer">
                      <div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-white px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 transition-colors">
                        <Upload className="h-4 w-4" />
                        {newDocFile ? newDocFile.name : 'Télécharger un fichier'}
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null
                          handleDocFileChange(file)
                        }}
                      />
                    </label>
                    {newDocFile && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-500"
                        onClick={() => handleDocFileChange(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {newDocPreview && (
                    <div className="mt-2 inline-block">
                      <img
                        src={newDocPreview}
                        alt="Aperçu du document"
                        className="h-20 rounded border border-amber-200 object-cover"
                      />
                    </div>
                  )}
                  {newDocFile && !newDocFile.type.startsWith('image/') && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                      <FileText className="h-4 w-4" />
                      {newDocFile.name}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Search bar */}
            {!showNewCustomerForm && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher un client par nom, téléphone..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-amber-500" />
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
                      className={`w-full text-left rounded-lg border p-3 transition-all hover:border-amber-300 ${
                        selectedCustomer?.id === customer.id
                          ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-500/20'
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
                            <span className="flex items-center gap-1">📱 {customer.phone}</span>
                            {customer.email && <span className="flex items-center gap-1">✉️ {customer.email}</span>}
                          </div>
                        </div>
                        {selectedCustomer?.id === customer.id && (
                          <CheckCircle2 className="h-5 w-5 text-amber-500 shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {!searchQuery && !searchResults.length && (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    Tapez un nom ou numéro de téléphone pour rechercher un client
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* ─── Step 2: Détails de la Réservation ─────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <Label className="text-base font-semibold">Détails de la Réservation</Label>

            {/* Room selection */}
            <div className="space-y-1.5">
              <Label htmlFor="room-select">Chambre *</Label>
              <Select
                value={selectedRoomId}
                onValueChange={setSelectedRoomId}
                disabled={!!preselectedRoomId}
              >
                <SelectTrigger id="room-select">
                  <SelectValue placeholder="Sélectionner une chambre" />
                </SelectTrigger>
                <SelectContent>
                  {availableRooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      <span className="flex items-center gap-2">
                        <span className="font-mono font-semibold">N°{room.room_number}</span>
                        <span className="text-muted-foreground">— {room.room_type}</span>
                        <span className="text-amber-600 font-medium">{formatFCFA(room.price_per_night)}/nuit</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {preselectedRoomId && selectedRoom && (
                <p className="text-xs text-muted-foreground">
                  Chambre prédéfinie : N°{selectedRoom.room_number} — {selectedRoom.room_type}
                </p>
              )}
            </div>

            {/* Date selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="check-in">Date d&apos;arrivée *</Label>
                <Input
                  id="check-in"
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="check-out">Date de départ *</Label>
                <Input
                  id="check-out"
                  type="date"
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  min={checkInDate || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            {/* Price calculation */}
            {selectedRoom && checkInDate && checkOutDate && numberOfNights > 0 && (
              <div className="rounded-lg border-2 border-amber-200 bg-amber-50/50 p-4 space-y-2">
                <p className="text-sm font-medium text-amber-800 mb-2">Calcul du prix</p>
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
                  <span className="text-base font-bold text-amber-900">Total</span>
                  <span className="text-xl font-bold text-amber-700">{formatFCFA(totalPrice)}</span>
                </div>
              </div>
            )}

            {checkInDate && checkOutDate && numberOfNights <= 0 && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                La date de départ doit être postérieure à la date d&apos;arrivée
              </p>
            )}
          </div>
        )}

        {/* ─── Step 3: Validation ────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <Label className="text-base font-semibold">Récapitulatif de la Réservation</Label>

            <div className="rounded-lg border bg-white divide-y">
              {/* Client info */}
              <div className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Client</p>
                {selectedCustomer ? (
                  <div>
                    <p className="font-medium">
                      {selectedCustomer.first_name} {selectedCustomer.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">📱 {selectedCustomer.phone}</p>
                    {selectedCustomer.email && (
                      <p className="text-sm text-muted-foreground">✉️ {selectedCustomer.email}</p>
                    )}
                  </div>
                ) : showNewCustomerForm ? (
                  <div>
                    <p className="font-medium">
                      {newFirstName} {newLastName}
                    </p>
                    <p className="text-sm text-muted-foreground">📱 {newPhone}</p>
                    {newEmail && <p className="text-sm text-muted-foreground">✉️ {newEmail}</p>}
                    <Badge className="mt-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-[10px]">
                      Nouveau client
                    </Badge>
                  </div>
                ) : null}
              </div>

              {/* Room info */}
              <div className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Chambre</p>
                {selectedRoom && (
                  <div>
                    <p className="font-medium">
                      N°{selectedRoom.room_number} — {selectedRoom.room_type}
                    </p>
                    <p className="text-sm text-muted-foreground">{formatFCFA(selectedRoom.price_per_night)}/nuit</p>
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Dates</p>
                <p className="font-medium">
                  {checkInDate && formatDateShort(checkInDate)} → {checkOutDate && formatDateShort(checkOutDate)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {numberOfNights} nuit{numberOfNights > 1 ? 's' : ''}
                </p>
              </div>

              {/* Total */}
              <div className="p-4 bg-amber-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-amber-900">Montant Total</span>
                  <span className="text-2xl font-bold text-amber-700">{formatFCFA(totalPrice)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Footer Buttons ────────────────────────────────────────────── */}
        <DialogFooter className="flex-row items-center justify-between gap-2 pt-2">
          {step > 1 ? (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={submitting}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Précédent
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
          )}

          {step < 3 ? (
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              disabled={step === 1 ? !isStep1Valid : !isStep2Valid}
              onClick={() => setStep(step + 1)}
            >
              Suivant
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmer la Réservation
                </>
              )}
            </Button>
          )}
        </DialogFooter>

      </DialogContent>
    </Dialog>
  )
}
