'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, parseISO, differenceInMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Building2,
  Users,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CalendarDays,
  XCircle,
  DollarSign,
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConferenceTabProps {
  onRefresh?: () => void
}

interface ConferenceRoom {
  id: string
  name: string
  capacity: number
  price_per_hour: number
  status: string
  created_at: string
  updated_at: string
}

interface CustomerOption {
  id: string
  first_name: string
  last_name: string
  phone: string
}

interface ConferenceBooking {
  id: string
  conference_room_id: string
  customer_id: string
  start_time: string
  end_time: string
  total_price: number
  status: string
  created_at: string
  updated_at: string
  conference_rooms?: {
    name: string
    price_per_hour: number
  } | null
  customers?: {
    first_name: string
    last_name: string
  } | null
}

type SubTab = 'rooms' | 'bookings'
type BookingFilterStatus = 'all' | 'confirmed' | 'cancelled' | 'completed'

const ROOM_STATUSES = [
  { value: 'available', label: 'Disponible' },
  { value: 'occupied', label: 'Occupée' },
  { value: 'maintenance', label: 'Maintenance' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

function getRoomStatusBadge(status: string) {
  switch (status) {
    case 'available':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Disponible</Badge>
    case 'occupied':
      return <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100">Occupée</Badge>
    case 'maintenance':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Maintenance</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function getBookingStatusBadge(status: string) {
  switch (status) {
    case 'confirmed':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Confirmée</Badge>
    case 'cancelled':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Annulée</Badge>
    case 'completed':
      return <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">Terminée</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function formatDuration(startTime: string, endTime: string): string {
  const start = parseISO(startTime)
  const end = parseISO(endTime)
  const totalMinutes = differenceInMinutes(end, start)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}min`
  if (minutes === 0) return `${hours}h`
  return `${hours}h${minutes}min`
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ConferenceTab({ onRefresh }: ConferenceTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('rooms')
  const [rooms, setRooms] = useState<ConferenceRoom[]>([])
  const [bookings, setBookings] = useState<ConferenceBooking[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [loading, setLoading] = useState(true)

  // Room dialog
  const [roomDialogOpen, setRoomDialogOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<ConferenceRoom | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Room form
  const [formName, setFormName] = useState('')
  const [formCapacity, setFormCapacity] = useState('')
  const [formPricePerHour, setFormPricePerHour] = useState('')
  const [formStatus, setFormStatus] = useState('available')

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ConferenceRoom | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Booking dialog
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [bookingRoomId, setBookingRoomId] = useState('')
  const [bookingCustomerId, setBookingCustomerId] = useState('')
  const [bookingStartTime, setBookingStartTime] = useState('')
  const [bookingEndTime, setBookingEndTime] = useState('')

  // Booking filters
  const [bookingFilterStatus, setBookingFilterStatus] = useState<BookingFilterStatus>('all')
  const [bookingFilterRoom, setBookingFilterRoom] = useState('all')

  // ─── Fetch data ───────────────────────────────────────────────────────
  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/owner/conference-rooms')
      if (res.ok) {
        const data = await res.json()
        setRooms(data.rooms || data.conferenceRooms || [])
      }
    } catch {
      toast.error('Erreur lors du chargement des salles')
    }
  }, [])

  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch('/api/owner/conference-bookings')
      if (res.ok) {
        const data = await res.json()
        setBookings(data.bookings || [])
      }
    } catch {
      toast.error('Erreur lors du chargement des réservations')
    }
  }, [])

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/owner/customers')
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers || [])
      }
    } catch {
      // Silent fail for customers - not critical
    }
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchRooms(), fetchBookings(), fetchCustomers()])
    setLoading(false)
  }, [fetchRooms, fetchBookings, fetchCustomers])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ─── Room form helpers ────────────────────────────────────────────────
  function resetRoomForm() {
    setFormName('')
    setFormCapacity('')
    setFormPricePerHour('')
    setFormStatus('available')
  }

  function openCreateRoomDialog() {
    resetRoomForm()
    setEditMode(false)
    setSelectedRoom(null)
    setRoomDialogOpen(true)
  }

  function openEditRoomDialog(room: ConferenceRoom) {
    setEditMode(true)
    setSelectedRoom(room)
    setFormName(room.name)
    setFormCapacity(room.capacity.toString())
    setFormPricePerHour(room.price_per_hour.toString())
    setFormStatus(room.status)
    setRoomDialogOpen(true)
  }

  // ─── Room submit ──────────────────────────────────────────────────────
  async function handleRoomSubmit() {
    if (!formName.trim() || !formCapacity || !formPricePerHour) {
      toast.error('Nom, capacité et prix/heure sont requis')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: formName.trim(),
        capacity: parseInt(formCapacity),
        price_per_hour: parseFloat(formPricePerHour),
        status: formStatus,
      }

      let res: Response
      if (editMode && selectedRoom) {
        res = await fetch(`/api/owner/conference-rooms/${selectedRoom.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/owner/conference-rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        toast.success(editMode ? `Salle « ${formName} » modifiée` : `Salle « ${formName} » ajoutée`)
        setRoomDialogOpen(false)
        resetRoomForm()
        fetchRooms()
        onRefresh?.()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de l\'enregistrement')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Delete room ──────────────────────────────────────────────────────
  async function handleDeleteRoom() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/owner/conference-rooms/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success(`Salle « ${deleteTarget.name} » supprimée`)
        setDeleteDialogOpen(false)
        setDeleteTarget(null)
        fetchRooms()
        onRefresh?.()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setDeleting(false)
    }
  }

  // ─── Booking helpers ──────────────────────────────────────────────────
  function openBookingDialog() {
    setBookingRoomId('')
    setBookingCustomerId('')
    setBookingStartTime('')
    setBookingEndTime('')
    setBookingDialogOpen(true)
  }

  const bookingTotalPrice = useCallback(() => {
    if (!bookingRoomId || !bookingStartTime || !bookingEndTime) return 0
    const room = rooms.find(r => r.id === bookingRoomId)
    if (!room) return 0
    const start = parseISO(bookingStartTime)
    const end = parseISO(bookingEndTime)
    const hours = differenceInMinutes(end, start) / 60
    if (hours <= 0) return 0
    return Math.round(hours * room.price_per_hour)
  }, [bookingRoomId, bookingStartTime, bookingEndTime, rooms])

  async function handleCreateBooking() {
    if (!bookingRoomId || !bookingCustomerId || !bookingStartTime || !bookingEndTime) {
      toast.error('Tous les champs sont requis')
      return
    }

    const start = parseISO(bookingStartTime)
    const end = parseISO(bookingEndTime)
    if (end <= start) {
      toast.error('L\'heure de fin doit être après l\'heure de début')
      return
    }

    setBookingSubmitting(true)
    try {
      const res = await fetch('/api/owner/conference-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conference_room_id: bookingRoomId,
          customer_id: bookingCustomerId,
          start_time: bookingStartTime,
          end_time: bookingEndTime,
        }),
      })

      if (res.ok) {
        toast.success('Réservation créée avec succès')
        setBookingDialogOpen(false)
        fetchBookings()
        onRefresh?.()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la création')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setBookingSubmitting(false)
    }
  }

  // ─── Cancel booking ──────────────────────────────────────────────────
  async function handleCancelBooking(bookingId: string) {
    try {
      const res = await fetch(`/api/owner/conference-bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })

      if (res.ok) {
        toast.success('Réservation annulée')
        fetchBookings()
        onRefresh?.()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de l\'annulation')
      }
    } catch {
      toast.error('Erreur de connexion')
    }
  }

  // ─── Filtered bookings ────────────────────────────────────────────────
  const filteredBookings = bookings.filter(b => {
    if (bookingFilterStatus !== 'all' && b.status !== bookingFilterStatus) return false
    if (bookingFilterRoom !== 'all' && b.conference_room_id !== bookingFilterRoom) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">🏢 Salles de Conférence</h2>
          <p className="text-muted-foreground">
            {rooms.length} salle{rooms.length !== 1 ? 's' : ''} • {bookings.filter(b => b.status === 'confirmed').length} réservation{bookings.filter(b => b.status === 'confirmed').length !== 1 ? 's' : ''} active{bookings.filter(b => b.status === 'confirmed').length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchAll(); onRefresh?.() }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Sub-tabs */}
      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as SubTab)}>
        <TabsList className="bg-amber-50 border border-amber-200/60">
          <TabsTrigger value="rooms" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            🏢 Salles
          </TabsTrigger>
          <TabsTrigger value="bookings" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            📋 Réservations
          </TabsTrigger>
        </TabsList>

        {/* ─── Rooms Sub-tab ───────────────────────────────────────────── */}
        <TabsContent value="rooms" className="space-y-4 mt-4">
          <div className="flex items-center justify-end">
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              onClick={openCreateRoomDialog}
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une salle
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-400 mb-3">
                <Building2 className="h-7 w-7" />
              </div>
              <p className="text-muted-foreground">Aucune salle de conférence</p>
              <p className="text-xs text-muted-foreground mt-1">Ajoutez vos premières salles</p>
              <Button
                className="mt-4 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={openCreateRoomDialog}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une salle
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room) => (
                <Card key={room.id} className="border-amber-200/60 transition-all hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-base truncate">{room.name}</h4>
                      </div>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEditRoomDialog(room)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-700"
                          onClick={() => {
                            setDeleteTarget(room)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4 text-amber-500" />
                        <span><strong>{room.capacity}</strong> personnes</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="h-4 w-4 text-amber-500" />
                        <span className="font-semibold text-amber-700">{formatFCFA(room.price_per_hour)}/heure</span>
                      </div>
                      <div className="pt-1">
                        {getRoomStatusBadge(room.status)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Bookings Sub-tab ────────────────────────────────────────── */}
        <TabsContent value="bookings" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Statut :</Label>
              <Select value={bookingFilterStatus} onValueChange={(v) => setBookingFilterStatus(v as BookingFilterStatus)}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="confirmed">Confirmées</SelectItem>
                  <SelectItem value="cancelled">Annulées</SelectItem>
                  <SelectItem value="completed">Terminées</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Salle :</Label>
              <Select value={bookingFilterRoom} onValueChange={setBookingFilterRoom}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les salles</SelectItem>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1" />
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              size="sm"
              onClick={openBookingDialog}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle réservation
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-400 mb-3">
                    <CalendarDays className="h-7 w-7" />
                  </div>
                  <p className="text-muted-foreground">Aucune réservation trouvée</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {bookingFilterStatus !== 'all' || bookingFilterRoom !== 'all'
                      ? 'Modifiez les filtres pour voir plus de résultats'
                      : 'Créez votre première réservation'}
                  </p>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Salle</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Début</TableHead>
                        <TableHead className="hidden sm:table-cell">Fin</TableHead>
                        <TableHead className="hidden md:table-cell">Durée</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-medium text-sm">
                            {booking.conference_rooms?.name || 'Salle inconnue'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {booking.customers
                              ? `${booking.customers.first_name} ${booking.customers.last_name}`
                              : 'Client inconnu'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(parseISO(booking.start_time), 'dd/MM/yyyy HH:mm', { locale: fr })}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                            {format(parseISO(booking.end_time), 'dd/MM/yyyy HH:mm', { locale: fr })}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(booking.start_time, booking.end_time)}
                            </span>
                          </TableCell>
                          <TableCell className="font-semibold text-sm text-amber-700">
                            {formatFCFA(booking.total_price)}
                          </TableCell>
                          <TableCell>{getBookingStatusBadge(booking.status)}</TableCell>
                          <TableCell className="text-right">
                            {booking.status === 'confirmed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-red-500 hover:text-red-700"
                                onClick={() => handleCancelBooking(booking.id)}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Annuler
                              </Button>
                            )}
                            {(booking.status === 'cancelled' || booking.status === 'completed') && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Room Create/Edit Dialog ───────────────────────────────────── */}
      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editMode ? (
                <><Pencil className="h-5 w-5 text-amber-600" /> Modifier la salle</>
              ) : (
                <><Plus className="h-5 w-5 text-amber-600" /> Nouvelle salle</>
              )}
            </DialogTitle>
            <DialogDescription>
              {editMode ? 'Modifiez les informations de la salle' : 'Ajoutez une nouvelle salle de conférence'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="room-name">Nom *</Label>
              <Input
                id="room-name"
                placeholder="Nom de la salle"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="room-capacity">Capacité *</Label>
                <Input
                  id="room-capacity"
                  type="number"
                  min="1"
                  placeholder="0"
                  value={formCapacity}
                  onChange={(e) => setFormCapacity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-price">Prix/heure (FCFA) *</Label>
                <Input
                  id="room-price"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formPricePerHour}
                  onChange={(e) => setFormPricePerHour(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="room-status">Statut</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger id="room-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRoomDialogOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              disabled={submitting}
              onClick={handleRoomSubmit}
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enregistrement...</>
              ) : editMode ? (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Enregistrer</>
              ) : (
                <><Plus className="h-4 w-4 mr-2" /> Ajouter</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ───────────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirmer la suppression
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la salle <strong>« {deleteTarget?.name} »</strong> ?
              Cette action est irréversible. Les réservations associées seront conservées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeleteRoom}
              disabled={deleting}
            >
              {deleting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Suppression...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" /> Supprimer</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Create Booking Dialog ─────────────────────────────────────── */}
      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-amber-600" />
              Nouvelle réservation
            </DialogTitle>
            <DialogDescription>
              Réservez une salle de conférence pour un client
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="booking-room">Salle *</Label>
              <Select value={bookingRoomId} onValueChange={setBookingRoomId}>
                <SelectTrigger id="booking-room">
                  <SelectValue placeholder="Sélectionner une salle" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.filter(r => r.status === 'available').map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name} ({room.capacity} pers. — {formatFCFA(room.price_per_hour)}/h)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="booking-customer">Client *</Label>
              <Select value={bookingCustomerId} onValueChange={setBookingCustomerId}>
                <SelectTrigger id="booking-customer">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((cust) => (
                    <SelectItem key={cust.id} value={cust.id}>
                      {cust.first_name} {cust.last_name} — {cust.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="booking-start">Début *</Label>
                <Input
                  id="booking-start"
                  type="datetime-local"
                  value={bookingStartTime}
                  onChange={(e) => setBookingStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="booking-end">Fin *</Label>
                <Input
                  id="booking-end"
                  type="datetime-local"
                  value={bookingEndTime}
                  onChange={(e) => setBookingEndTime(e.target.value)}
                />
              </div>
            </div>

            {/* Auto-calculated total */}
            {bookingTotalPrice() > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Prix estimé</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(bookingStartTime, bookingEndTime)} × {formatFCFA(rooms.find(r => r.id === bookingRoomId)?.price_per_hour || 0)}/h
                    </p>
                  </div>
                  <span className="font-bold text-lg text-amber-700">{formatFCFA(bookingTotalPrice())}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingDialogOpen(false)} disabled={bookingSubmitting}>
              Annuler
            </Button>
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              disabled={bookingSubmitting}
              onClick={handleCreateBooking}
            >
              {bookingSubmitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Création...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirmer la réservation</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
