'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  format, parseISO, differenceInMinutes, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isSameDay, isToday, addMonths, subMonths,
  isWithinInterval,
} from 'date-fns'
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
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
  UtensilsCrossed,
  Phone,
  User,
  FileText,
  Monitor,
  Mic,
  Presentation,
  ScreenShare,
  Volume2,
  Wifi,
  ClipboardList,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'

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
  // Champs planification événement
  event_name: string | null
  event_type: string | null
  attendees_count: number | null
  catering_required: boolean
  equipment_needs: string | null
  setup_notes: string | null
  contact_name: string | null
  contact_phone: string | null
  created_at: string
  updated_at: string
  conference_room_name?: string | null
  customer_name?: string | null
}

type SubTab = 'rooms' | 'bookings' | 'calendar'
type BookingFilterStatus = 'all' | 'confirmed' | 'cancelled' | 'completed'

// ─── Constantes ──────────────────────────────────────────────────────────────

const ROOM_STATUSES = [
  { value: 'available', label: 'Disponible' },
  { value: 'occupied', label: 'Occupée' },
  { value: 'maintenance', label: 'Maintenance' },
]

const EVENT_TYPES = [
  { value: 'seminar', label: 'Séminaire', color: 'bg-blue-500' },
  { value: 'workshop', label: 'Atelier', color: 'bg-emerald-500' },
  { value: 'wedding', label: 'Mariage', color: 'bg-pink-500' },
  { value: 'corporate_meeting', label: 'Réunion d\'entreprise', color: 'bg-amber-500' },
  { value: 'birthday', label: 'Anniversaire', color: 'bg-purple-500' },
  { value: 'conference', label: 'Conférence', color: 'bg-cyan-500' },
  { value: 'other', label: 'Autre', color: 'bg-gray-500' },
]

const EQUIPMENT_OPTIONS = [
  { value: 'projector', label: 'Vidéoprojecteur', icon: Monitor },
  { value: 'microphone', label: 'Micro', icon: Mic },
  { value: 'whiteboard', label: 'Tableau blanc', icon: Presentation },
  { value: 'screen', label: 'Écran', icon: ScreenShare },
  { value: 'sound_system', label: 'Sonorisation', icon: Volume2 },
  { value: 'wifi', label: 'WiFi', icon: Wifi },
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

function getEventTypeColor(eventType: string | null): string {
  const found = EVENT_TYPES.find(e => e.value === eventType)
  return found?.color || 'bg-gray-400'
}

function getEventTypeLabel(eventType: string | null): string {
  const found = EVENT_TYPES.find(e => e.value === eventType)
  return found?.label || 'Non défini'
}

function getEquipmentLabel(value: string): string {
  const found = EQUIPMENT_OPTIONS.find(e => e.value === value)
  return found?.label || value
}

// Jours de la semaine en français pour le calendrier
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

// ─── Component ───────────────────────────────────────────────────────────────

export function ConferenceTab({ onRefresh }: ConferenceTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('bookings')
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
  // Champs planification événement
  const [bookingEventName, setBookingEventName] = useState('')
  const [bookingEventType, setBookingEventType] = useState('')
  const [bookingAttendeesCount, setBookingAttendeesCount] = useState('')
  const [bookingCateringRequired, setBookingCateringRequired] = useState(false)
  const [bookingEquipmentNeeds, setBookingEquipmentNeeds] = useState<string[]>([])
  const [bookingSetupNotes, setBookingSetupNotes] = useState('')
  const [bookingContactName, setBookingContactName] = useState('')
  const [bookingContactPhone, setBookingContactPhone] = useState('')

  // Booking filters
  const [bookingFilterStatus, setBookingFilterStatus] = useState<BookingFilterStatus>('all')
  const [bookingFilterRoom, setBookingFilterRoom] = useState('all')

  // Calendrier
  const [calendarMonth, setCalendarMonth] = useState(new Date())

  // Détails événement (Sheet)
  const [selectedBooking, setSelectedBooking] = useState<ConferenceBooking | null>(null)
  const [detailSheetOpen, setDetailSheetOpen] = useState(false)

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

  // ─── Dashboard Summary ────────────────────────────────────────────────
  const dashboardStats = useMemo(() => {
    const today = new Date()
    const todayStr = format(today, 'yyyy-MM-dd')

    // Événements aujourd'hui
    const eventsToday = bookings.filter(b => {
      if (b.status !== 'confirmed') return false
      const start = format(parseISO(b.start_time), 'yyyy-MM-dd')
      const end = format(parseISO(b.end_time), 'yyyy-MM-dd')
      return start <= todayStr && end >= todayStr
    })

    // Événements cette semaine (lundi-dimanche)
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    const eventsThisWeek = bookings.filter(b => {
      if (b.status !== 'confirmed') return false
      const bStart = parseISO(b.start_time)
      const bEnd = parseISO(b.end_time)
      return bStart <= endOfWeek && bEnd >= startOfWeek
    })

    // Revenu ce mois
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()
    const revenueThisMonth = bookings
      .filter(b => {
        const bDate = parseISO(b.created_at)
        return bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear && b.status !== 'cancelled'
      })
      .reduce((sum, b) => sum + (b.total_price || 0), 0)

    return {
      eventsToday: eventsToday.length,
      eventsThisWeek: eventsThisWeek.length,
      revenueThisMonth,
      activeBookings: bookings.filter(b => b.status === 'confirmed').length,
    }
  }, [bookings])

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
  function resetBookingForm() {
    setBookingRoomId('')
    setBookingCustomerId('')
    setBookingStartTime('')
    setBookingEndTime('')
    setBookingEventName('')
    setBookingEventType('')
    setBookingAttendeesCount('')
    setBookingCateringRequired(false)
    setBookingEquipmentNeeds([])
    setBookingSetupNotes('')
    setBookingContactName('')
    setBookingContactPhone('')
  }

  function openBookingDialog() {
    resetBookingForm()
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
      toast.error('La salle, le client, l\'heure de début et l\'heure de fin sont requis')
      return
    }
    if (!bookingEventName.trim()) {
      toast.error('Le nom de l\'événement est requis')
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
          event_name: bookingEventName.trim(),
          event_type: bookingEventType || null,
          attendees_count: bookingAttendeesCount ? parseInt(bookingAttendeesCount) : null,
          catering_required: bookingCateringRequired,
          equipment_needs: bookingEquipmentNeeds.length > 0 ? bookingEquipmentNeeds.join(',') : null,
          setup_notes: bookingSetupNotes.trim() || null,
          contact_name: bookingContactName.trim() || null,
          contact_phone: bookingContactPhone.trim() || null,
        }),
      })

      if (res.ok) {
        toast.success('Réservation créée avec succès')
        setBookingDialogOpen(false)
        resetBookingForm()
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

  // ─── Booking status change ────────────────────────────────────────────
  async function handleBookingStatusChange(bookingId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/owner/conference-bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        const statusLabel = newStatus === 'cancelled' ? 'annulée' : newStatus === 'completed' ? 'terminée' : newStatus
        toast.success(`Réservation ${statusLabel}`)
        fetchBookings()
        onRefresh?.()
        // Mettre à jour le détail si ouvert
        if (selectedBooking?.id === bookingId) {
          setSelectedBooking(prev => prev ? { ...prev, status: newStatus } : null)
        }
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors du changement de statut')
      }
    } catch {
      toast.error('Erreur de connexion')
    }
  }

  // ─── Ouvrir le détail ─────────────────────────────────────────────────
  function openBookingDetail(booking: ConferenceBooking) {
    setSelectedBooking(booking)
    setDetailSheetOpen(true)
  }

  // ─── Toggle equipment checkbox ────────────────────────────────────────
  function toggleEquipment(value: string) {
    setBookingEquipmentNeeds(prev =>
      prev.includes(value) ? prev.filter(e => e !== value) : [...prev, value]
    )
  }

  // ─── Filtered bookings ────────────────────────────────────────────────
  const filteredBookings = bookings.filter(b => {
    if (bookingFilterStatus !== 'all' && b.status !== bookingFilterStatus) return false
    if (bookingFilterRoom !== 'all' && b.conference_room_id !== bookingFilterRoom) return false
    return true
  })

  // ─── Calendar helpers ─────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth)
    const monthEnd = endOfMonth(calendarMonth)
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

    // Jour de la semaine du premier jour (0=dimanche, ajuster pour lundi=0)
    const firstDayOfWeek = (getDay(monthStart) + 6) % 7

    // Remplir les jours avant le début du mois
    const prefix: (Date | null)[] = Array(firstDayOfWeek).fill(null)

    return [...prefix, ...daysInMonth]
  }, [calendarMonth])

  function getBookingsForDay(day: Date): ConferenceBooking[] {
    const dayStr = format(day, 'yyyy-MM-dd')
    return bookings.filter(b => {
      const startStr = format(parseISO(b.start_time), 'yyyy-MM-dd')
      const endStr = format(parseISO(b.end_time), 'yyyy-MM-dd')
      return startStr <= dayStr && endStr >= dayStr
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Dashboard Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <CalendarDays className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Aujourd&apos;hui</p>
                <p className="text-2xl font-bold text-amber-700">{dashboardStats.eventsToday}</p>
                <p className="text-xs text-muted-foreground">événement{dashboardStats.eventsToday !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <PartyPopper className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cette semaine</p>
                <p className="text-2xl font-bold text-emerald-700">{dashboardStats.eventsThisWeek}</p>
                <p className="text-xs text-muted-foreground">à venir</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-sky-200/60 bg-gradient-to-br from-sky-50 to-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100">
                <CheckCircle2 className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Réservations</p>
                <p className="text-2xl font-bold text-sky-700">{dashboardStats.activeBookings}</p>
                <p className="text-xs text-muted-foreground">actives</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-violet-200/60 bg-gradient-to-br from-violet-50 to-purple-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                <DollarSign className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Revenu mois</p>
                <p className="text-lg font-bold text-violet-700">{formatFCFA(dashboardStats.revenueThisMonth)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Building2 className="h-6 w-6 text-amber-600" /> Salles de Conférence</h2>
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
          <TabsTrigger value="rooms" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white flex items-center gap-1.5">
            <Building2 className="h-4 w-4" /> Salles
          </TabsTrigger>
          <TabsTrigger value="bookings" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4" /> Réservations
          </TabsTrigger>
          <TabsTrigger value="calendar" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white flex items-center gap-1.5">
            <CalendarIcon className="h-4 w-4" /> Calendrier
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
                        <TableHead>Événement</TableHead>
                        <TableHead>Salle</TableHead>
                        <TableHead className="hidden md:table-cell">Client</TableHead>
                        <TableHead>Début</TableHead>
                        <TableHead className="hidden sm:table-cell">Durée</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBookings.map((booking) => (
                        <TableRow
                          key={booking.id}
                          className="cursor-pointer hover:bg-amber-50/50"
                          onClick={() => openBookingDetail(booking)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`h-2.5 w-2.5 rounded-full ${getEventTypeColor(booking.event_type)}`} />
                              <div>
                                <p className="font-medium text-sm">{booking.event_name || 'Sans nom'}</p>
                                <p className="text-xs text-muted-foreground">{getEventTypeLabel(booking.event_type)}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {booking.conference_room_name || 'Salle inconnue'}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {booking.customer_name || 'Client inconnu'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(parseISO(booking.start_time), 'dd/MM HH:mm', { locale: fr })}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
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
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleBookingStatusChange(booking.id, 'cancelled')
                                }}
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

        {/* ─── Calendar Sub-tab ────────────────────────────────────────── */}
        <TabsContent value="calendar" className="space-y-4 mt-4">
          <Card className="border-amber-200/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setCalendarMonth(prev => subMonths(prev, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-lg font-bold capitalize">
                  {format(calendarMonth, 'MMMM yyyy', { locale: fr })}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setCalendarMonth(prev => addMonths(prev, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* En-têtes jours de la semaine */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map(day => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Jours du calendrier */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  if (!day) {
                    return <div key={`empty-${idx}`} className="h-24 lg:h-28" />
                  }

                  const dayBookings = getBookingsForDay(day)
                  const todayHighlight = isToday(day)

                  return (
                    <div
                      key={day.toISOString()}
                      className={`h-24 lg:h-28 border rounded-md p-1 transition-colors ${
                        todayHighlight
                          ? 'border-amber-400 bg-amber-50/50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`text-xs font-medium mb-1 ${
                        todayHighlight ? 'text-amber-700 font-bold' : 'text-muted-foreground'
                      }`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-0.5 max-h-[calc(100%-20px)] overflow-y-auto">
                        {dayBookings.slice(0, 3).map(booking => (
                          <button
                            key={booking.id}
                            className={`w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded ${getEventTypeColor(booking.event_type)} text-white truncate cursor-pointer hover:opacity-80`}
                            onClick={() => openBookingDetail(booking)}
                            title={booking.event_name || 'Sans nom'}
                          >
                            {booking.event_name || 'Sans nom'}
                          </button>
                        ))}
                        {dayBookings.length > 3 && (
                          <p className="text-[10px] text-muted-foreground text-center">
                            +{dayBookings.length - 3} de plus
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Légende des couleurs */}
              <div className="flex items-center gap-4 mt-4 flex-wrap">
                {EVENT_TYPES.map(et => (
                  <div key={et.value} className="flex items-center gap-1.5">
                    <div className={`h-3 w-3 rounded-full ${et.color}`} />
                    <span className="text-xs text-muted-foreground">{et.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Room Create/Edit Dialog ───────────────────────────────────── */}
      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent className="sm:max-w-lg">
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

      {/* ─── Enhanced Booking Dialog ─────────────────────────────────────── */}
      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-amber-600" />
              Nouvelle réservation d&apos;événement
            </DialogTitle>
            <DialogDescription>
              Planifiez un événement dans une salle de conférence
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* ─── Informations de base ─────────────────────── */}
            <div>
              <h4 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Informations de réservation
              </h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
            </div>

            <Separator />

            {/* ─── Planification de l'événement ─────────────── */}
            <div>
              <h4 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
                <PartyPopper className="h-4 w-4" />
                Planification de l&apos;événement
              </h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="event-name">Nom de l&apos;événement *</Label>
                    <Input
                      id="event-name"
                      placeholder="Ex : Séminaire Annuel"
                      value={bookingEventName}
                      onChange={(e) => setBookingEventName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-type">Type d&apos;événement</Label>
                    <Select value={bookingEventType} onValueChange={setBookingEventType}>
                      <SelectTrigger id="event-type">
                        <SelectValue placeholder="Sélectionner un type" />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map((et) => (
                          <SelectItem key={et.value} value={et.value}>
                            <span className="flex items-center gap-2">
                              <span className={`inline-block h-2 w-2 rounded-full ${et.color}`} />
                              {et.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="attendees-count">Nombre de participants</Label>
                  <Input
                    id="attendees-count"
                    type="number"
                    min="1"
                    placeholder="0"
                    value={bookingAttendeesCount}
                    onChange={(e) => setBookingAttendeesCount(e.target.value)}
                  />
                </div>

                {/* Traiteur */}
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <Switch
                    id="catering"
                    checked={bookingCateringRequired}
                    onCheckedChange={setBookingCateringRequired}
                  />
                  <Label htmlFor="catering" className="flex items-center gap-2 cursor-pointer">
                    <UtensilsCrossed className="h-4 w-4 text-amber-500" />
                    Service de traiteur requis
                  </Label>
                </div>

                {/* Équipement */}
                <div className="space-y-2">
                  <Label>Besoins en équipement</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {EQUIPMENT_OPTIONS.map(eq => (
                      <label
                        key={eq.value}
                        className={`flex items-center gap-2 rounded-md border p-2 cursor-pointer transition-colors text-sm ${
                          bookingEquipmentNeeds.includes(eq.value)
                            ? 'border-amber-400 bg-amber-50 text-amber-800'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Checkbox
                          checked={bookingEquipmentNeeds.includes(eq.value)}
                          onCheckedChange={() => toggleEquipment(eq.value)}
                          className="pointer-events-none"
                        />
                        <eq.icon className="h-3.5 w-3.5" />
                        {eq.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Notes d'installation */}
                <div className="space-y-2">
                  <Label htmlFor="setup-notes">Instructions d&apos;installation</Label>
                  <Textarea
                    id="setup-notes"
                    placeholder="Configuration de la salle, besoins spéciaux..."
                    value={bookingSetupNotes}
                    onChange={(e) => setBookingSetupNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* ─── Contact ─────────────────────────────────── */}
            <div>
              <h4 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Contact de l&apos;événement
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Nom du contact</Label>
                  <Input
                    id="contact-name"
                    placeholder="Personne responsable"
                    value={bookingContactName}
                    onChange={(e) => setBookingContactName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Téléphone du contact</Label>
                  <Input
                    id="contact-phone"
                    placeholder="+225 XX XX XX XX"
                    value={bookingContactPhone}
                    onChange={(e) => setBookingContactPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>
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

      {/* ─── Event Details Sheet ──────────────────────────────────────── */}
      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedBooking && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${getEventTypeColor(selectedBooking.event_type)}`} />
                  {selectedBooking.event_name || 'Réservation sans nom'}
                </SheetTitle>
                <SheetDescription>
                  {getEventTypeLabel(selectedBooking.event_type)} • {selectedBooking.conference_room_name}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6">
                {/* Statut et actions rapides */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Statut</span>
                    {getBookingStatusBadge(selectedBooking.status)}
                  </div>
                  {selectedBooking.status === 'confirmed' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => {
                          handleBookingStatusChange(selectedBooking.id, 'completed')
                          setSelectedBooking(prev => prev ? { ...prev, status: 'completed' } : null)
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Terminer
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => {
                          handleBookingStatusChange(selectedBooking.id, 'cancelled')
                          setSelectedBooking(prev => prev ? { ...prev, status: 'cancelled' } : null)
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Annuler
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Informations de réservation */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Réservation
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Salle</p>
                      <p className="font-medium">{selectedBooking.conference_room_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Client</p>
                      <p className="font-medium">{selectedBooking.customer_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Début</p>
                      <p className="font-medium">{format(parseISO(selectedBooking.start_time), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Fin</p>
                      <p className="font-medium">{format(parseISO(selectedBooking.end_time), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Durée</p>
                      <p className="font-medium flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(selectedBooking.start_time, selectedBooking.end_time)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Montant</p>
                      <p className="font-semibold text-amber-700">{formatFCFA(selectedBooking.total_price)}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Détails de l'événement */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                    <PartyPopper className="h-4 w-4" />
                    Événement
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <div className="flex items-center gap-1.5">
                        <div className={`h-2.5 w-2.5 rounded-full ${getEventTypeColor(selectedBooking.event_type)}`} />
                        <p className="font-medium">{getEventTypeLabel(selectedBooking.event_type)}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Participants</p>
                      <p className="font-medium flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {selectedBooking.attendees_count || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Traiteur */}
                  <div className="flex items-center gap-2 rounded-md border p-2.5">
                    <UtensilsCrossed className={`h-4 w-4 ${selectedBooking.catering_required ? 'text-amber-500' : 'text-gray-400'}`} />
                    <span className="text-sm">Traiteur</span>
                    <Badge variant={selectedBooking.catering_required ? 'default' : 'secondary'} className="ml-auto">
                      {selectedBooking.catering_required ? 'Requis' : 'Non requis'}
                    </Badge>
                  </div>

                  {/* Équipement */}
                  {selectedBooking.equipment_needs && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Équipement demandé
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedBooking.equipment_needs.split(',').map(eq => (
                          <Badge key={eq} variant="outline" className="text-xs">
                            {getEquipmentLabel(eq.trim())}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes d'installation */}
                  {selectedBooking.setup_notes && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Instructions d&apos;installation</p>
                      <p className="text-sm bg-gray-50 rounded-md p-2">{selectedBooking.setup_notes}</p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Contact */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Contact
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Nom</p>
                      <p className="font-medium">{selectedBooking.contact_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Téléphone</p>
                      <p className="font-medium">{selectedBooking.contact_phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {selectedBooking.contact_phone}
                        </span>
                      ) : '—'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
