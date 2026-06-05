'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  LayoutDashboard,
  Building2,
  Bed,
  CalendarCheck,
  Users,
  UtensilsCrossed,
  Package,
  Presentation,
  CreditCard,
  Key,
  TrendingUp,
  FileText,
  UserCog,
  Hotel,
  LogOut,
  Menu,
  Loader2,
  Plus,
  ChevronDown,
  Clock,
  Hash,
  DollarSign,
  Eye,
  MessageSquare,
  Mail,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardProps {
  profile: {
    id: string
    hotel_id: string | null
    first_name: string
    last_name: string
    role: 'super_admin' | 'owner' | 'manager' | 'receptionist' | 'restaurant_staff' | 'housekeeper'
    phone: string | null
    status: string
  }
  onLogout: () => void
}

interface HotelType {
  id: string
  name: string
  address: string | null
  city: string | null
  phone: string | null
  email: string | null
  status: string
}

interface RoomType {
  id: string
  hotel_id: string
  room_number: string
  room_type: string
  price_per_night: number
  status: string
}

interface ReservationType {
  id: string
  hotel_id: string
  customer_id: string
  room_id: string
  check_in: string
  check_out: string
  total_price: number
  status: string
  customer?: { first_name: string; last_name: string }
  room?: { room_number: string }
}

interface CustomerType {
  id: string
  hotel_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  identity_document_type: string | null
  identity_document_number: string | null
}

interface DashboardStats {
  total_hotels: number
  total_rooms: number
  active_reservations: number
  total_revenue: number
}

type TabId =
  | 'overview'
  | 'hotels'
  | 'rooms'
  | 'reservations'
  | 'customers'
  | 'restaurant'
  | 'stock'
  | 'conference'
  | 'subscriptions'
  | 'codes'
  | 'leads'
  | 'audit'
  | 'users'

interface NavItem {
  id: TabId
  label: string
  icon: React.ReactNode
}

// ─── Navigation Items ────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Tableau de bord', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'hotels', label: 'Hôtels', icon: <Building2 className="h-4 w-4" /> },
  { id: 'rooms', label: 'Chambres', icon: <Bed className="h-4 w-4" /> },
  { id: 'reservations', label: 'Réservations', icon: <CalendarCheck className="h-4 w-4" /> },
  { id: 'customers', label: 'Clients', icon: <Users className="h-4 w-4" /> },
  { id: 'restaurant', label: 'Restaurant', icon: <UtensilsCrossed className="h-4 w-4" /> },
  { id: 'stock', label: 'Stock', icon: <Package className="h-4 w-4" /> },
  { id: 'conference', label: 'Conférence', icon: <Presentation className="h-4 w-4" /> },
  { id: 'subscriptions', label: 'Abonnements', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'codes', label: "Codes d'activation", icon: <Key className="h-4 w-4" /> },
  { id: 'leads', label: 'Leads', icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'audit', label: 'Audit', icon: <FileText className="h-4 w-4" /> },
  { id: 'users', label: 'Utilisateurs', icon: <UserCog className="h-4 w-4" /> },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function getHotelStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Actif</Badge>
    case 'suspended':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Suspendu</Badge>
    case 'inactive':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Inactif</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function getRoomStatusBadge(status: string) {
  switch (status) {
    case 'available':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Disponible</Badge>
    case 'occupied':
      return <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100">Occupée</Badge>
    case 'cleaning':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Nettoyage</Badge>
    case 'maintenance':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Maintenance</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function getReservationStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">En attente</Badge>
    case 'confirmed':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Confirmée</Badge>
    case 'checked_in':
      return <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100">Enregistré</Badge>
    case 'checked_out':
      return <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">Check-out</Badge>
    case 'cancelled':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Annulée</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

// ─── Coming Soon Page ────────────────────────────────────────────────────────

function ComingSoonPage({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center p-8">
      <Card className="w-full max-w-md text-center border-dashed">
        <CardHeader className="pb-2">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            {icon}
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-base">
            Prochainement
          </CardDescription>
          <p className="mt-2 text-sm text-muted-foreground">
            Cette fonctionnalité est en cours de développement et sera bientôt disponible.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Overview Page ───────────────────────────────────────────────────────────

function OverviewPage({ hotelId }: { hotelId: string | null }) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentReservations, setRecentReservations] = useState<ReservationType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const url = hotelId
          ? `/api/dashboard?hotel_id=${hotelId}`
          : '/api/dashboard'
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setStats(data.stats || null)
          setRecentReservations(
            (data.reservations || []).slice(0, 5)
          )
        }
      } catch {
        toast.error('Erreur lors du chargement des données')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [hotelId])

  const statCards = [
    {
      title: 'Total Hôtels',
      value: stats?.total_hotels ?? 0,
      icon: <Building2 className="h-5 w-5" />,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      title: 'Chambres',
      value: stats?.total_rooms ?? 0,
      icon: <Bed className="h-5 w-5" />,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      title: 'Réservations actives',
      value: stats?.active_reservations ?? 0,
      icon: <CalendarCheck className="h-5 w-5" />,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: "Chiffre d'affaires",
      value: formatCurrency(stats?.total_revenue ?? 0),
      icon: <DollarSign className="h-5 w-5" />,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title} className="overflow-hidden">
            <CardContent className="p-6">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${card.bg} ${card.color}`}>
                    {card.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground truncate">{card.title}</p>
                    <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Reservations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            Réservations récentes
          </CardTitle>
          <CardDescription>Les 5 dernières réservations</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : recentReservations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucune réservation trouvée</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Chambre</TableHead>
                    <TableHead>Arrivée</TableHead>
                    <TableHead>Départ</TableHead>
                    <TableHead>Prix total</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentReservations.map((res) => (
                    <TableRow key={res.id}>
                      <TableCell className="font-medium">
                        {res.customer
                          ? `${res.customer.first_name} ${res.customer.last_name}`
                          : '—'}
                      </TableCell>
                      <TableCell>{res.room?.room_number || '—'}</TableCell>
                      <TableCell>{formatDate(res.check_in)}</TableCell>
                      <TableCell>{formatDate(res.check_out)}</TableCell>
                      <TableCell>{formatCurrency(res.total_price)}</TableCell>
                      <TableCell>{getReservationStatusBadge(res.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Hotels Page ─────────────────────────────────────────────────────────────

function HotelsPage() {
  const [hotels, setHotels] = useState<HotelType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    phone: '',
    email: '',
  })

  const fetchHotels = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/hotels')
      if (res.ok) {
        const data = await res.json()
        setHotels(data.hotels || [])
      }
    } catch {
      toast.error('Erreur lors du chargement des hôtels')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHotels()
  }, [fetchHotels])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/hotels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        toast.success('Hôtel ajouté avec succès')
        setForm({ name: '', address: '', city: '', phone: '', email: '' })
        setDialogOpen(false)
        fetchHotels()
      } else {
        const data = await res.json()
        toast.error(data.error || "Erreur lors de l'ajout de l'hôtel")
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Hôtels</h2>
          <p className="text-muted-foreground">Gérez vos établissements</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un hôtel
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un hôtel</DialogTitle>
              <DialogDescription>
                Remplissez les informations du nouvel établissement
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="hotel-name">Nom de l&apos;hôtel</Label>
                  <Input
                    id="hotel-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Hôtel Palm Beach"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hotel-address">Adresse</Label>
                  <Input
                    id="hotel-address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Boulevard VGE, Cocody"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hotel-city">Ville</Label>
                    <Input
                      id="hotel-city"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="Abidjan"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hotel-phone">Téléphone</Label>
                    <Input
                      id="hotel-phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+225 01 02 03 04"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hotel-email">E-mail</Label>
                  <Input
                    id="hotel-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@exemple.ci"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting} className="bg-amber-600 hover:bg-amber-700 text-white">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Enregistrement...
                    </>
                  ) : (
                    'Ajouter'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : hotels.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Aucun hôtel enregistré</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hotels.map((hotel) => (
                    <TableRow key={hotel.id}>
                      <TableCell className="font-medium">{hotel.name}</TableCell>
                      <TableCell>{hotel.city || '—'}</TableCell>
                      <TableCell>{hotel.phone || '—'}</TableCell>
                      <TableCell>{getHotelStatusBadge(hotel.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Rooms Page ──────────────────────────────────────────────────────────────

function RoomsPage({ hotels, selectedHotelId, onHotelChange }: {
  hotels: HotelType[]
  selectedHotelId: string
  onHotelChange: (id: string) => void
}) {
  const [rooms, setRooms] = useState<RoomType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    room_number: '',
    room_type: 'Simple',
    price_per_night: '',
  })

  const fetchRooms = useCallback(async () => {
    if (!selectedHotelId) {
      setRooms([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/rooms?hotel_id=${selectedHotelId}`)
      if (res.ok) {
        const data = await res.json()
        setRooms(data.rooms || [])
      }
    } catch {
      toast.error('Erreur lors du chargement des chambres')
    } finally {
      setLoading(false)
    }
  }, [selectedHotelId])

  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotel_id: selectedHotelId,
          room_number: form.room_number,
          room_type: form.room_type,
          price_per_night: Number(form.price_per_night),
        }),
      })
      if (res.ok) {
        toast.success('Chambre ajoutée avec succès')
        setForm({ room_number: '', room_type: 'Simple', price_per_night: '' })
        setDialogOpen(false)
        fetchRooms()
      } else {
        const data = await res.json()
        toast.error(data.error || "Erreur lors de l'ajout de la chambre")
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Chambres</h2>
          <p className="text-muted-foreground">Gérez les chambres de votre hôtel</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedHotelId} onValueChange={onHotelChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Sélectionner un hôtel" />
            </SelectTrigger>
            <SelectContent>
              {hotels.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={!selectedHotelId}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une chambre
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter une chambre</DialogTitle>
                <DialogDescription>
                  Renseignez les informations de la nouvelle chambre
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="room-number">Numéro de chambre</Label>
                    <Input
                      id="room-number"
                      value={form.room_number}
                      onChange={(e) => setForm({ ...form, room_number: e.target.value })}
                      placeholder="101"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="room-type">Type de chambre</Label>
                    <Select value={form.room_type} onValueChange={(v) => setForm({ ...form, room_type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Simple">Simple</SelectItem>
                        <SelectItem value="Double">Double</SelectItem>
                        <SelectItem value="Suite">Suite</SelectItem>
                        <SelectItem value="Deluxe">Deluxe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="room-price">Prix par nuit (FCFA)</Label>
                    <Input
                      id="room-price"
                      type="number"
                      min="0"
                      value={form.price_per_night}
                      onChange={(e) => setForm({ ...form, price_per_night: e.target.value })}
                      placeholder="25000"
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={submitting} className="bg-amber-600 hover:bg-amber-700 text-white">
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Enregistrement...
                      </>
                    ) : (
                      'Ajouter'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !selectedHotelId ? (
            <p className="text-center text-muted-foreground py-12">
              Sélectionnez un hôtel pour voir les chambres
            </p>
          ) : rooms.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Aucune chambre enregistrée</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Prix/nuit</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rooms.map((room) => (
                    <TableRow key={room.id}>
                      <TableCell className="font-medium">{room.room_number}</TableCell>
                      <TableCell>{room.room_type}</TableCell>
                      <TableCell>{formatCurrency(room.price_per_night)}</TableCell>
                      <TableCell>{getRoomStatusBadge(room.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Reservations Page ───────────────────────────────────────────────────────

function ReservationsPage({ hotels, selectedHotelId, onHotelChange }: {
  hotels: HotelType[]
  selectedHotelId: string
  onHotelChange: (id: string) => void
}) {
  const [reservations, setReservations] = useState<ReservationType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!selectedHotelId) {
        setReservations([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const res = await fetch(`/api/reservations?hotel_id=${selectedHotelId}`)
        if (res.ok) {
          const data = await res.json()
          setReservations(data.reservations || [])
        }
      } catch {
        toast.error('Erreur lors du chargement des réservations')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [selectedHotelId])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Réservations</h2>
          <p className="text-muted-foreground">Suivez les réservations de votre hôtel</p>
        </div>
        <Select value={selectedHotelId} onValueChange={onHotelChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sélectionner un hôtel" />
          </SelectTrigger>
          <SelectContent>
            {hotels.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {h.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !selectedHotelId ? (
            <p className="text-center text-muted-foreground py-12">
              Sélectionnez un hôtel pour voir les réservations
            </p>
          ) : reservations.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Aucune réservation trouvée</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Chambre</TableHead>
                    <TableHead>Arrivée</TableHead>
                    <TableHead>Départ</TableHead>
                    <TableHead>Prix total</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.map((res) => (
                    <TableRow key={res.id}>
                      <TableCell className="font-medium">
                        {res.customer
                          ? `${res.customer.first_name} ${res.customer.last_name}`
                          : '—'}
                      </TableCell>
                      <TableCell>{res.room?.room_number || '—'}</TableCell>
                      <TableCell>{formatDate(res.check_in)}</TableCell>
                      <TableCell>{formatDate(res.check_out)}</TableCell>
                      <TableCell>{formatCurrency(res.total_price)}</TableCell>
                      <TableCell>{getReservationStatusBadge(res.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Customers Page ──────────────────────────────────────────────────────────

function CustomersPage({ hotels, selectedHotelId, onHotelChange }: {
  hotels: HotelType[]
  selectedHotelId: string
  onHotelChange: (id: string) => void
}) {
  const [customers, setCustomers] = useState<CustomerType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    identity_document_type: 'passport',
    identity_document_number: '',
  })

  const fetchCustomers = useCallback(async () => {
    if (!selectedHotelId) {
      setCustomers([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/customers?hotel_id=${selectedHotelId}`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers || [])
      }
    } catch {
      toast.error('Erreur lors du chargement des clients')
    } finally {
      setLoading(false)
    }
  }, [selectedHotelId])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotel_id: selectedHotelId,
          ...form,
        }),
      })
      if (res.ok) {
        toast.success('Client ajouté avec succès')
        setForm({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          identity_document_type: 'passport',
          identity_document_number: '',
        })
        setDialogOpen(false)
        fetchCustomers()
      } else {
        const data = await res.json()
        toast.error(data.error || "Erreur lors de l'ajout du client")
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setSubmitting(false)
    }
  }

  const docTypeLabels: Record<string, string> = {
    passport: 'Passeport',
    national_id: "Carte d'identité",
    driving_license: 'Permis de conduire',
    other: 'Autre',
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Clients</h2>
          <p className="text-muted-foreground">Gérez les informations de vos clients</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedHotelId} onValueChange={onHotelChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Sélectionner un hôtel" />
            </SelectTrigger>
            <SelectContent>
              {hotels.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={!selectedHotelId}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter un client</DialogTitle>
                <DialogDescription>
                  Renseignez les informations du nouveau client
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customer-fname">Prénom</Label>
                      <Input
                        id="customer-fname"
                        value={form.first_name}
                        onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                        placeholder="Amadou"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer-lname">Nom</Label>
                      <Input
                        id="customer-lname"
                        value={form.last_name}
                        onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                        placeholder="Koné"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customer-email">E-mail</Label>
                      <Input
                        id="customer-email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="amadou@email.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer-phone">Téléphone</Label>
                      <Input
                        id="customer-phone"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+225 01 02 03 04"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customer-doc-type">Type de document</Label>
                      <Select
                        value={form.identity_document_type}
                        onValueChange={(v) => setForm({ ...form, identity_document_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="passport">Passeport</SelectItem>
                          <SelectItem value="national_id">Carte d&apos;identité</SelectItem>
                          <SelectItem value="driving_license">Permis de conduire</SelectItem>
                          <SelectItem value="other">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer-doc-num">N° de document</Label>
                      <Input
                        id="customer-doc-num"
                        value={form.identity_document_number}
                        onChange={(e) => setForm({ ...form, identity_document_number: e.target.value })}
                        placeholder="AB1234567"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={submitting} className="bg-amber-600 hover:bg-amber-700 text-white">
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Enregistrement...
                      </>
                    ) : (
                      'Ajouter'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !selectedHotelId ? (
            <p className="text-center text-muted-foreground py-12">
              Sélectionnez un hôtel pour voir les clients
            </p>
          ) : customers.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Aucun client enregistré</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.last_name}</TableCell>
                      <TableCell>{customer.first_name}</TableCell>
                      <TableCell>{customer.email || '—'}</TableCell>
                      <TableCell>{customer.phone || '—'}</TableCell>
                      <TableCell>
                        {customer.identity_document_type
                          ? `${docTypeLabels[customer.identity_document_type] || customer.identity_document_type}${customer.identity_document_number ? ` — ${customer.identity_document_number}` : ''}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Sidebar Content ─────────────────────────────────────────────────────────

function SidebarContent({
  activeTab,
  onTabChange,
  profile,
  onLogout,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  profile: DashboardProps['profile']
  onLogout: () => void
}) {
  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    owner: 'Propriétaire',
    manager: 'Manager',
    receptionist: 'Réceptionniste',
    restaurant_staff: 'Personnel restaurant',
    housekeeper: 'Gouvernante',
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-amber-200/40">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/20">
          <Hotel className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
            HôtelCI
          </h1>
          <p className="text-[10px] text-muted-foreground leading-none">Gestion Hôtelière</p>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-amber-100 text-amber-800 shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span className={isActive ? 'text-amber-600' : ''}>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>
      </ScrollArea>

      <Separator />

      {/* WhatsApp Support Button */}
      <div className="px-4 py-2">
        <a
          href="https://wa.me/2250576103277"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors w-full"
        >
          <MessageSquare className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="truncate">Support WhatsApp</span>
        </a>
        <a
          href="mailto:omouitsi@gmail.com"
          className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors w-full mt-2"
        >
          <Mail className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="truncate">omouitsi@gmail.com</span>
        </a>
      </div>

      {/* User Info */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-sm font-bold">
            {profile.first_name.charAt(0)}{profile.last_name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{profile.first_name} {profile.last_name}</p>
            <p className="text-xs text-muted-foreground truncate">{roleLabels[profile.role] || profile.role}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Déconnexion
        </Button>
      </div>
    </div>
  )
}

// ─── Main Dashboard Component ────────────────────────────────────────────────

export function Dashboard({ profile, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [hotels, setHotels] = useState<HotelType[]>([])
  const [selectedHotelId, setSelectedHotelId] = useState<string>('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [hotelsLoaded, setHotelsLoaded] = useState(false)

  // Fetch hotels list for selectors
  useEffect(() => {
    async function fetchHotels() {
      try {
        const res = await fetch('/api/hotels')
        if (res.ok) {
          const data = await res.json()
          const hotelList = data.hotels || []
          setHotels(hotelList)
          // Auto-select hotel from profile or first hotel
          if (profile.hotel_id && hotelList.some((h: HotelType) => h.id === profile.hotel_id)) {
            setSelectedHotelId(profile.hotel_id)
          } else if (hotelList.length > 0) {
            setSelectedHotelId(hotelList[0].id)
          }
        }
      } catch {
        // Silent fail for initial load
      } finally {
        setHotelsLoaded(true)
      }
    }
    fetchHotels()
  }, [profile.hotel_id])

  function handleTabChange(tab: TabId) {
    setActiveTab(tab)
    setMobileMenuOpen(false)
  }

  function handleHotelChange(id: string) {
    setSelectedHotelId(id)
  }

  const selectedHotel = hotels.find((h) => h.id === selectedHotelId)

  // Render page content based on active tab
  function renderContent() {
    switch (activeTab) {
      case 'overview':
        return <OverviewPage hotelId={selectedHotelId} />
      case 'hotels':
        return <HotelsPage />
      case 'rooms':
        return (
          <RoomsPage
            hotels={hotels}
            selectedHotelId={selectedHotelId}
            onHotelChange={handleHotelChange}
          />
        )
      case 'reservations':
        return (
          <ReservationsPage
            hotels={hotels}
            selectedHotelId={selectedHotelId}
            onHotelChange={handleHotelChange}
          />
        )
      case 'customers':
        return (
          <CustomersPage
            hotels={hotels}
            selectedHotelId={selectedHotelId}
            onHotelChange={handleHotelChange}
          />
        )
      case 'restaurant':
        return <ComingSoonPage title="Restaurant" icon={<UtensilsCrossed className="h-6 w-6" />} />
      case 'stock':
        return <ComingSoonPage title="Stock" icon={<Package className="h-6 w-6" />} />
      case 'conference':
        return <ComingSoonPage title="Conférence" icon={<Presentation className="h-6 w-6" />} />
      case 'subscriptions':
        return <ComingSoonPage title="Abonnements" icon={<CreditCard className="h-6 w-6" />} />
      case 'codes':
        return <ComingSoonPage title="Codes d'activation" icon={<Key className="h-6 w-6" />} />
      case 'leads':
        return <ComingSoonPage title="Leads" icon={<TrendingUp className="h-6 w-6" />} />
      case 'audit':
        return <ComingSoonPage title="Audit" icon={<FileText className="h-6 w-6" />} />
      case 'users':
        return <ComingSoonPage title="Utilisateurs" icon={<UserCog className="h-6 w-6" />} />
      default:
        return <OverviewPage hotelId={selectedHotelId} />
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex lg:w-[280px] lg:flex-col lg:fixed lg:inset-y-0 border-r bg-white shadow-sm">
          <SidebarContent
            activeTab={activeTab}
            onTabChange={handleTabChange}
            profile={profile}
            onLogout={onLogout}
          />
        </aside>

        {/* Mobile Sidebar */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-[280px] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu de navigation</SheetTitle>
            </SheetHeader>
            <SidebarContent
              activeTab={activeTab}
              onTabChange={handleTabChange}
              profile={profile}
              onLogout={onLogout}
            />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <div className="flex flex-1 flex-col lg:pl-[280px]">
          {/* Top Bar */}
          <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-white px-4 sm:px-6 shadow-sm">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Hotel Selector */}
            <div className="flex items-center gap-2 flex-1">
              {hotelsLoaded && hotels.length > 0 && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-amber-600 hidden sm:block" />
                  <Select value={selectedHotelId} onValueChange={handleHotelChange}>
                    <SelectTrigger className="w-[200px] sm:w-[260px]">
                      <SelectValue placeholder="Sélectionner un hôtel" />
                    </SelectTrigger>
                    <SelectContent>
                      {hotels.map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.name} — {h.city || 'N/A'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {hotelsLoaded && hotels.length === 0 && (
                <span className="text-sm text-muted-foreground">Aucun hôtel configuré</span>
              )}
              {!hotelsLoaded && (
                <Skeleton className="h-9 w-[200px]" />
              )}
            </div>

            {/* User Info */}
            <div className="flex items-center gap-3">
              <Separator orientation="vertical" className="h-6 hidden sm:block" />
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                  {profile.first_name.charAt(0)}{profile.last_name.charAt(0)}
                </div>
                <span className="text-sm font-medium">{profile.first_name}</span>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            {renderContent()}
          </main>

          {/* Footer */}
          <footer className="mt-auto border-t bg-white px-4 py-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
              <p>© {new Date().getFullYear()} HôtelCI — Gestion Hôtelière, Côte d&apos;Ivoire</p>
              <div className="flex items-center gap-4">
                <a
                  href="https://wa.me/2250576103277"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-emerald-600 transition-colors"
                >
                  <MessageSquare className="h-3 w-3" />
                  Support
                </a>
                <a
                  href="mailto:omouitsi@gmail.com"
                  className="flex items-center gap-1 hover:text-amber-600 transition-colors"
                >
                  <Mail className="h-3 w-3" />
                  Contact
                </a>
                {selectedHotel && (
                  <p className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {selectedHotel.name} — {selectedHotel.city || 'N/A'}
                  </p>
                )}
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
