'use client'

import { useState } from 'react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  User,
  Mail,
  Phone,
  CreditCard,
  FileText,
  Calendar,
  Clock,
  Bed,
  LogIn,
  LogOut,
  XCircle,
  Loader2,
  ExternalLink,
  Shield,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReservationDetailSheetProps {
  reservation: {
    id: string
    hotel_id: string
    customer_id: string
    room_id: string
    check_in_date: string
    check_out_date: string
    total_price: number
    status: string
    created_at: string
    customers: {
      id: string
      first_name: string
      last_name: string
      email: string | null
      phone: string
      identity_document_type: string | null
      identity_document_number: string | null
      identity_document_path: string | null
    } | null
    rooms: {
      id: string
      room_number: string
      room_type: string
      price_per_night: number
      status: string
    } | null
  } | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction: (action: string, reservationId: string) => Promise<void>
  onRefresh: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

function formatDateFR(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'EEEE dd MMMM yyyy', { locale: fr })
  } catch {
    return dateStr
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
          En attente
        </Badge>
      )
    case 'confirmed':
      return (
        <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100">
          Confirmée
        </Badge>
      )
    case 'checked_in':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
          Enregistré
        </Badge>
      )
    case 'checked_out':
      return (
        <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">
          Terminé
        </Badge>
      )
    case 'cancelled':
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
          Annulée
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'En attente'
    case 'confirmed':
      return 'Confirmée'
    case 'checked_in':
      return 'Enregistré (Check-In effectué)'
    case 'checked_out':
      return 'Terminé (Check-Out effectué)'
    case 'cancelled':
      return 'Annulée'
    default:
      return status
  }
}

function getDocumentTypeLabel(type: string | null): string {
  if (!type) return 'Document'
  switch (type.toLowerCase()) {
    case 'cni':
    case 'carte_nationale':
      return 'Carte Nationale d\'Identité'
    case 'passport':
    case 'passeport':
      return 'Passeport'
    case 'permis':
    case 'permis_de_conduire':
      return 'Permis de Conduire'
    case 'attestation':
      return 'Attestation d\'identité'
    default:
      return type
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ReservationDetailSheet({
  reservation,
  open,
  onOpenChange,
  onAction,
  onRefresh,
}: ReservationDetailSheetProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [docLoading, setDocLoading] = useState(false)

  if (!reservation) return null

  const customer = reservation.customers
  const room = reservation.rooms
  const checkIn = parseISO(reservation.check_in_date)
  const checkOut = parseISO(reservation.check_out_date)
  const nights = differenceInDays(checkOut, checkIn)
  const status = reservation.status

  async function handleAction(action: string) {
    setActionLoading(action)
    try {
      await onAction(action, reservation.id)
      toast.success(
        action === 'check_in'
          ? 'Arrivée validée avec succès !'
          : action === 'check_out'
            ? 'Départ validé avec succès !'
            : 'Réservation annulée.'
      )
      onRefresh()
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Une erreur est survenue'
      )
    } finally {
      setActionLoading(null)
    }
  }

  async function handleViewDocument() {
    if (!customer?.identity_document_path) return
    setDocLoading(true)
    try {
      const res = await fetch(
        `/api/owner/customers/signed-url?path=${encodeURIComponent(customer.identity_document_path)}`
      )
      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          window.open(data.url, '_blank')
        } else {
          toast.error('Impossible de générer le lien du document')
        }
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de l\'accès au document')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setDocLoading(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center gap-2 text-lg">
              Détail de la Réservation
            </SheetTitle>
            <SheetDescription>
              Réservation #{reservation.id.slice(0, 8).toUpperCase()}
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-6 space-y-5">
            {/* ── Status Badge ──────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Statut</span>
              {getStatusBadge(status)}
            </div>

            <Separator />

            {/* ── Customer Section ───────────────────────────────────────── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Client
              </h3>
              {customer ? (
                <div className="space-y-2">
                  <p className="text-lg font-bold text-gray-900">
                    {customer.first_name} {customer.last_name}
                  </p>
                  <div className="space-y-1.5 text-sm">
                    {customer.email && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{customer.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span>{customer.phone}</span>
                    </div>
                    {customer.identity_document_type && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Shield className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span>
                          {getDocumentTypeLabel(customer.identity_document_type)}
                          {customer.identity_document_number && (
                            <span className="ml-1 font-mono text-xs">
                              n°{customer.identity_document_number}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                  {customer.identity_document_path && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1 text-xs"
                      onClick={handleViewDocument}
                      disabled={docLoading}
                    >
                      {docLoading ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <ExternalLink className="h-3 w-3 mr-1" />
                      )}
                      Voir la pièce d&apos;identité
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Informations client non disponibles
                </p>
              )}
            </div>

            <Separator />

            {/* ── Stay Section ───────────────────────────────────────────── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Bed className="h-3.5 w-3.5" />
                Séjour
              </h3>
              <div className="space-y-2">
                {room && (
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 shrink-0">
                      <Bed className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        Chambre {room.room_number}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {room.room_type} — {formatFCFA(room.price_per_night)}/nuit
                      </p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="rounded-lg border p-2.5 bg-green-50/50 border-green-200/50">
                    <div className="flex items-center gap-1.5 text-green-700 text-xs font-medium mb-1">
                      <LogIn className="h-3 w-3" />
                      Arrivée
                    </div>
                    <p className="text-sm font-semibold text-gray-900 capitalize">
                      {formatDateFR(reservation.check_in_date)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-2.5 bg-orange-50/50 border-orange-200/50">
                    <div className="flex items-center gap-1.5 text-orange-700 text-xs font-medium mb-1">
                      <LogOut className="h-3 w-3" />
                      Départ
                    </div>
                    <p className="text-sm font-semibold text-gray-900 capitalize">
                      {formatDateFR(reservation.check_out_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm px-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Durée
                  </span>
                  <span className="font-semibold">
                    {nights} nuit{nights > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Pricing Section ────────────────────────────────────────── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" />
                Tarification
              </h3>
              <div className="rounded-lg border bg-gray-50/50 p-3 space-y-2">
                {room && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Prix par nuit
                    </span>
                    <span>{formatFCFA(room.price_per_night)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Nombre de nuits
                  </span>
                  <span>{nights}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-amber-700">
                    {formatFCFA(reservation.total_price)}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Creation Date ──────────────────────────────────────────── */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Créée le
              </span>
              <span>{formatDateFR(reservation.created_at)}</span>
            </div>

            <Separator />

            {/* ── Action Buttons ─────────────────────────────────────────── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Actions
              </h3>

              {status === 'checked_out' || status === 'cancelled' ? (
                <div className="rounded-lg border bg-gray-50 p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Aucune action disponible
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Statut : {getStatusLabel(status)}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Check-In Button */}
                  {(status === 'pending' || status === 'confirmed') && (
                    <Button
                      className="w-full h-12 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20"
                      disabled={actionLoading !== null}
                      onClick={() => handleAction('check_in')}
                    >
                      {actionLoading === 'check_in' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <LogIn className="h-4 w-4 mr-2" />
                      )}
                      Valider l&apos;Arrivée (Check-In)
                    </Button>
                  )}

                  {/* Check-Out Button */}
                  {status === 'checked_in' && (
                    <Button
                      className="w-full h-12 text-sm font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-500/20"
                      disabled={actionLoading !== null}
                      onClick={() => handleAction('check_out')}
                    >
                      {actionLoading === 'check_out' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <LogOut className="h-4 w-4 mr-2" />
                      )}
                      Valider le Départ (Check-Out & Ménage requis)
                    </Button>
                  )}

                  {/* Cancel Button */}
                  {(status === 'pending' || status === 'confirmed') && (
                    <Button
                      variant="outline"
                      className="w-full h-10 text-sm font-medium text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                      disabled={actionLoading !== null}
                      onClick={() => setCancelDialogOpen(true)}
                    >
                      {actionLoading === 'cancel' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      Annuler la réservation
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Cancel Confirmation Dialog ──────────────────────────────────────── */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler la réservation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La réservation de{' '}
              <strong>
                {customer?.first_name} {customer?.last_name}
              </strong>{' '}
              (Chambre {room?.room_number}, du {format(checkIn, 'dd/MM/yyyy')} au{' '}
              {format(checkOut, 'dd/MM/yyyy')}) sera annulée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Non, garder la réservation</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                setCancelDialogOpen(false)
                handleAction('cancel')
              }}
            >
              Oui, annuler
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
