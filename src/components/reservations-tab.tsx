'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Calendar,
  Plus,
  RefreshCw,
  Loader2,
  List,
  LayoutGrid,
  Bed,
  User,
  Clock,
  ArrowUpDown,
  DoorOpen,
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TooltipProvider } from '@/components/ui/tooltip'

import { PlanningGrid } from '@/components/planning-grid'
import { ReservationCreationDialog } from '@/components/reservation-dialog'
import { ReservationDetailSheet } from '@/components/reservation-detail-sheet'
import { WalkInDialog } from '@/components/walk-in-dialog'
import { useRealtimeSafe } from '@/lib/realtime-context'
import { RealtimeIndicator } from '@/components/realtime-indicator'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReservationsTabProps {
  rooms: Array<{
    id: string
    room_number: string
    room_type: string
    status: string
    price_per_night: number
  }>
  onRefresh?: () => void
}

interface ReservationInfo {
  id: string
  hotel_id: string
  customer_id: string
  room_id: string
  check_in_date: string
  check_out_date: string
  total_price: number
  status: string
  created_at: string
  updated_at: string
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
}

type DisplayMode = 'grid' | 'list'
type FilterStatus = 'all' | 'pending' | 'checked_in' | 'checked_out' | 'cancelled'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">En attente</Badge>
    case 'confirmed':
      return <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100">Confirmée</Badge>
    case 'checked_in':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Enregistré</Badge>
    case 'checked_out':
      return <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">Terminé</Badge>
    case 'cancelled':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Annulée</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending': return 'En attente'
    case 'confirmed': return 'Confirmée'
    case 'checked_in': return 'Enregistré'
    case 'checked_out': return 'Terminé'
    case 'cancelled': return 'Annulée'
    default: return status
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ReservationsTab({ rooms, onRefresh }: ReservationsTabProps) {
  const [reservations, setReservations] = useState<ReservationInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [displayMode, setDisplayMode] = useState<DisplayMode>('grid')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [sortField, setSortField] = useState<'check_in_date' | 'created_at'>('check_in_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [walkInDialogOpen, setWalkInDialogOpen] = useState(false)
  const [preselectedRoomId, setPreselectedRoomId] = useState<string | null>(null)
  const [preselectedDate, setPreselectedDate] = useState<string | null>(null)

  // Detail sheet
  const [detailSheetOpen, setDetailSheetOpen] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<ReservationInfo | null>(null)

  // ─── Real-time subscription ──────────────────────────────────────────────
  const { recentChanges } = useRealtimeSafe()
  const prevChangeCountRef = useRef(0)

  // ─── Fetch reservations ───────────────────────────────────────────────
  const fetchReservations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/owner/reservations')
      if (res.ok) {
        const data = await res.json()
        setReservations(data.reservations || [])
      }
    } catch {
      toast.error('Erreur lors du chargement des réservations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReservations()
  }, [fetchReservations])

  // ─── React to real-time changes ────────────────────────────────────────
  useEffect(() => {
    if (recentChanges.length > prevChangeCountRef.current && prevChangeCountRef.current > 0) {
      // Only refresh if the change is on reservations or rooms table
      const latestChange = recentChanges[0]
      if (latestChange.table === 'reservations' || latestChange.table === 'rooms') {
        // Debounce rapid changes
        const timer = setTimeout(() => {
          fetchReservations()
          onRefresh?.()
        }, 500)
        return () => clearTimeout(timer)
      }
    }
    prevChangeCountRef.current = recentChanges.length
  }, [recentChanges.length, fetchReservations, onRefresh])

  // ─── Filtered & sorted reservations ───────────────────────────────────
  const filteredReservations = reservations
    .filter((r) => filterStatus === 'all' || r.status === filterStatus)
    .sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })

  // ─── Stats ────────────────────────────────────────────────────────────
  const stats = {
    total: reservations.length,
    pending: reservations.filter((r) => r.status === 'pending').length,
    checkedIn: reservations.filter((r) => r.status === 'checked_in').length,
    checkedOut: reservations.filter((r) => r.status === 'checked_out').length,
    cancelled: reservations.filter((r) => r.status === 'cancelled').length,
  }

  // ─── Handlers ─────────────────────────────────────────────────────────
  function handleCreateFromGrid(roomId: string, date: string) {
    setPreselectedRoomId(roomId)
    setPreselectedDate(date)
    setCreateDialogOpen(true)
  }

  function handleViewReservation(reservationId: string) {
    const reservation = reservations.find((r) => r.id === reservationId)
    if (reservation) {
      setSelectedReservation(reservation)
      setDetailSheetOpen(true)
    }
  }

  async function handleReservationAction(action: string, reservationId: string) {
    const res = await fetch(`/api/owner/reservations/${reservationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Erreur lors de l\'action')
    }

    // Refresh data
    await fetchReservations()
    onRefresh?.()
  }

  function toggleSort(field: 'check_in_date' | 'created_at') {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  return (
    <div className="space-y-6">
        {/* ─── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">📅 Réservations</h2>
            <p className="text-muted-foreground">
              {stats.total} réservation{stats.total !== 1 ? 's' : ''} • {stats.pending} en attente • {stats.checkedIn} en cours
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RealtimeIndicator />
            <Button variant="outline" size="sm" onClick={() => { fetchReservations(); onRefresh?.() }} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Button
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20"
              onClick={() => setWalkInDialogOpen(true)}
            >
              <DoorOpen className="h-4 w-4 mr-2" />
              Enregistrement Direct
            </Button>
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              onClick={() => {
                setPreselectedRoomId(null)
                setPreselectedDate(null)
                setCreateDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle Réservation
            </Button>
          </div>
        </div>

        {/* ─── Quick Stats ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'En attente', count: stats.pending, color: 'bg-amber-50 text-amber-700 border-amber-200' },
            { label: 'Enregistrés', count: stats.checkedIn, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { label: 'Terminés', count: stats.checkedOut, color: 'bg-gray-50 text-gray-600 border-gray-200' },
            { label: 'Annulées', count: stats.cancelled, color: 'bg-red-50 text-red-600 border-red-200' },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => setFilterStatus(
                filterStatus === s.label.toLowerCase().replace('é', 'e').replace('è', 'e').replace('enregistrés', 'checked_in').replace('en attente', 'pending').replace('terminés', 'checked_out').replace('annulées', 'cancelled')
                  ? 'all'
                  : s.label === 'En attente' ? 'pending'
                    : s.label === 'Enregistrés' ? 'checked_in'
                      : s.label === 'Terminés' ? 'checked_out'
                        : 'cancelled'
              )}
              className={`rounded-lg border p-3 text-center transition-all hover:shadow-sm ${s.color} ${
                (s.label === 'En attente' && filterStatus === 'pending') ||
                (s.label === 'Enregistrés' && filterStatus === 'checked_in') ||
                (s.label === 'Terminés' && filterStatus === 'checked_out') ||
                (s.label === 'Annulées' && filterStatus === 'cancelled')
                  ? 'ring-2 ring-offset-1 ring-amber-400'
                  : ''
              }`}
            >
              <p className="text-2xl font-bold">{s.count}</p>
              <p className="text-xs font-medium">{s.label}</p>
            </button>
          ))}
        </div>

        {/* ─── View Mode Toggle ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-lg border bg-white p-1">
            <Button
              variant={displayMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              className={`h-8 ${displayMode === 'grid' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
              onClick={() => setDisplayMode('grid')}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1" />
              Planning
            </Button>
            <Button
              variant={displayMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className={`h-8 ${displayMode === 'list' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
              onClick={() => setDisplayMode('list')}
            >
              <List className="h-3.5 w-3.5 mr-1" />
              Liste
            </Button>
          </div>

          {filterStatus !== 'all' && (
            <Button
              variant="ghost"
              size="sm"
              className="text-amber-700"
              onClick={() => setFilterStatus('all')}
            >
              ✕ Effacer le filtre
            </Button>
          )}
        </div>

        {/* ─── Grid View ─────────────────────────────────────────────────── */}
        {displayMode === 'grid' && (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                </div>
              ) : (
                <TooltipProvider>
                  <div className="h-[500px]">
                    <PlanningGrid
                      rooms={rooms}
                      reservations={filteredReservations}
                      onCreateReservation={handleCreateFromGrid}
                      onViewReservation={handleViewReservation}
                    />
                  </div>
                </TooltipProvider>
              )}
            </CardContent>
          </Card>
        )}

        {/* ─── List View ─────────────────────────────────────────────────── */}
        {displayMode === 'list' && (
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredReservations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-400 mb-3">
                    <Calendar className="h-7 w-7" />
                  </div>
                  <p className="text-muted-foreground">Aucune réservation trouvée</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {filterStatus !== 'all'
                      ? 'Modifiez le filtre pour voir plus de réservations'
                      : 'Créez votre première réservation depuis le planning'}
                  </p>
                  {filterStatus === 'all' && (
                    <Button
                      className="mt-4 bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() => {
                        setPreselectedRoomId(null)
                        setPreselectedDate(null)
                        setCreateDialogOpen(true)
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Nouvelle Réservation
                    </Button>
                  )}
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Chambre</TableHead>
                        <TableHead
                          className="cursor-pointer hover:text-amber-700"
                          onClick={() => toggleSort('check_in_date')}
                        >
                          <span className="flex items-center gap-1">
                            Dates
                            <ArrowUpDown className="h-3 w-3" />
                          </span>
                        </TableHead>
                        <TableHead className="hidden sm:table-cell">Durée</TableHead>
                        <TableHead className="hidden md:table-cell">Montant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Détail</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReservations.map((res) => {
                        const checkIn = parseISO(res.check_in_date)
                        const checkOut = parseISO(res.check_out_date)
                        const nights = Math.ceil(
                          (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
                        )

                        return (
                          <TableRow
                            key={res.id}
                            className="cursor-pointer hover:bg-amber-50/50"
                            onClick={() => handleViewReservation(res.id)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold shrink-0">
                                  {res.customers?.first_name?.charAt(0)}{res.customers?.last_name?.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {res.customers?.first_name} {res.customers?.last_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {res.customers?.phone}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Bed className="h-3.5 w-3.5 text-amber-500" />
                                <span className="font-mono font-semibold text-sm">
                                  {res.rooms?.room_number}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <span className="font-medium">
                                  {format(checkIn, 'dd/MM', { locale: fr })}
                                </span>
                                <span className="text-muted-foreground"> → </span>
                                <span className="font-medium">
                                  {format(checkOut, 'dd/MM', { locale: fr })}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {nights} nuit{nights > 1 ? 's' : ''}
                              </span>
                            </TableCell>
                            <TableCell className="hidden md:table-cell font-medium">
                              {formatFCFA(res.total_price)}
                            </TableCell>
                            <TableCell>{getStatusBadge(res.status)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-amber-600 hover:text-amber-800"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleViewReservation(res.id)
                                }}
                              >
                                Voir
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ─── Create Dialog ─────────────────────────────────────────────── */}
        <ReservationCreationDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          rooms={rooms}
          preselectedRoomId={preselectedRoomId}
          preselectedDate={preselectedDate}
          onSuccess={() => {
            fetchReservations()
            onRefresh?.()
          }}
        />

        {/* ─── Walk-In Direct Check-In Dialog ──────────────────────────────── */}
        <WalkInDialog
          open={walkInDialogOpen}
          onOpenChange={setWalkInDialogOpen}
          rooms={rooms}
          onSuccess={() => {
            fetchReservations()
            onRefresh?.()
          }}
        />

        {/* ─── Detail Sheet ──────────────────────────────────────────────── */}
        <ReservationDetailSheet
          reservation={selectedReservation}
          open={detailSheetOpen}
          onOpenChange={setDetailSheetOpen}
          onAction={handleReservationAction}
          onRefresh={() => {
            fetchReservations()
            onRefresh?.()
          }}
        />
    </div>
  )
}
