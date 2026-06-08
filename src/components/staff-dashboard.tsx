'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  LogOut,
  RefreshCw,
  CheckCircle2,
  Clock,
  User,
  DoorOpen,
  SprayCan,
  UtensilsCrossed,
  Bed,
  Wrench,
  Loader2,
  ChevronRight,
  Utensils,
  Coffee,
  Wine,
  MessageSquare,
  Mail,
  Calendar,
  Users,
  FileText,
  Bell,
  BarChart3,
  Shield,
  Plus,
  Search,
} from 'lucide-react'
import Image from 'next/image'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'

import { ReservationsTab } from '@/components/reservations-tab'
import { CustomersTab } from '@/components/customers-tab'
import { WalkInDialog } from '@/components/walk-in-dialog'
import { ExpiredStayAlert, ExpiredStayBadge } from '@/components/expired-stay-alert'
import dynamic from 'next/dynamic'

const InvoicesTab = dynamic(
  () => import('@/components/invoices-tab').then(mod => ({ default: mod.InvoicesTab })),
  { ssr: false, loading: () => <TabLoadingSkeleton /> }
)

const NotificationPanel = dynamic(
  () => import('@/components/notification-panel').then(mod => ({ default: mod.NotificationPanel })),
  { ssr: false, loading: () => <TabLoadingSkeleton /> }
)

// ─── Types ───────────────────────────────────────────────────────────────────

interface StaffDashboardProps {
  profile: {
    id: string
    hotel_id: string | null
    first_name: string
    last_name: string
    role: string
    phone: string | null
  }
  onLogout: () => void
}

interface RoomInfo {
  id: string
  hotel_id: string
  room_number: string
  room_type: string
  price_per_night: number
  status: string
  updated_at: string
}

interface HousekeepingStats {
  total: number
  cleaning: number
  maintenance: number
  available: number
  occupied: number
}

interface OrderItem {
  id: string
  order_id: string
  item_name: string
  quantity: number
  unit_price: number
}

interface OrderInfo {
  id: string
  hotel_id: string
  room_id: string | null
  table_number: string | null
  total_amount: number
  status: string
  created_at: string
  restaurant_order_items: OrderItem[]
}

interface RestaurantStats {
  pending: number
  preparing: number
  served: number
}

interface CustomerInfo {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
}

interface RoomBrief {
  id: string
  room_number: string
  room_type: string
  price_per_night: number
  status: string
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
  customers: CustomerInfo | CustomerInfo[] | null
  rooms: RoomBrief | RoomBrief[] | null
}

// ─── Receptionist Tab Type ──────────────────────────────────────────────────

type ReceptionistTabId = 'overview' | 'rooms' | 'reservations' | 'customers' | 'invoices' | 'notifications'

const RECEPTIONIST_NAV_ITEMS: { id: ReceptionistTabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Accueil', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'rooms', label: 'Chambres', icon: <Bed className="h-4 w-4" /> },
  { id: 'reservations', label: 'Réservations', icon: <Calendar className="h-4 w-4" /> },
  { id: 'customers', label: 'Clients', icon: <Users className="h-4 w-4" /> },
  { id: 'invoices', label: 'Factures', icon: <FileText className="h-4 w-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
]

function TabLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
        ))}
      </div>
    </div>
  )
}

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

function formatTimeAgo(dateStr: string): string {
  try {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHour = Math.floor(diffMin / 60)

    if (diffMin < 1) return "À l'instant"
    if (diffMin < 60) return `Il y a ${diffMin} min`
    if (diffHour < 24) return `Il y a ${diffHour}h`
    return formatDateFR(dateStr)
  } catch {
    return dateStr
  }
}

function getShortOrderId(id: string): string {
  return '#' + id.slice(0, 4).toUpperCase()
}

function getCustomerName(customers: CustomerInfo | CustomerInfo[] | null): string {
  if (!customers) return 'Client inconnu'
  if (Array.isArray(customers)) {
    const c = customers[0]
    return c ? `${c.first_name} ${c.last_name}` : 'Client inconnu'
  }
  return `${customers.first_name} ${customers.last_name}`
}

function getRoomInfo(rooms: RoomBrief | RoomBrief[] | null): RoomBrief | null {
  if (!rooms) return null
  if (Array.isArray(rooms)) return rooms[0] || null
  return rooms
}

// ─── Shared Support Footer ──────────────────────────────────────────────────

function StaffFooter({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="sticky bottom-0 bg-white border-t border-amber-200/50 px-4 py-3 space-y-2">
      <div className="flex gap-2">
        <a
          href="https://wa.me/2250576103277"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
        >
          <MessageSquare className="h-4 w-4" />
          WhatsApp
        </a>
        <a
          href="mailto:omouitsi@gmail.com"
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
        >
          <Mail className="h-4 w-4" />
          Email
        </a>
      </div>
      <Button
        variant="outline"
        className="w-full h-12 text-base font-medium rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50"
        onClick={onLogout}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Déconnexion
      </Button>
    </div>
  )
}

// ─── Housekeeper View ────────────────────────────────────────────────────────

function HousekeeperView({ profile, onLogout }: StaffDashboardProps) {
  const [rooms, setRooms] = useState<RoomInfo[]>([])
  const [stats, setStats] = useState<HousekeepingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/staff/housekeeping')
      if (res.ok) {
        const data = await res.json()
        setRooms(data.rooms || [])
        setStats(data.stats || null)
      } else {
        toast.error('Erreur lors du chargement des chambres')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRoomStatus = async (roomId: string, newStatus: string, roomNumber: string) => {
    setActionLoading(roomId)
    try {
      const res = await fetch(`/api/staff/room-status/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        const statusLabel = newStatus === 'available' ? 'propre' : 'en maintenance'
        toast.success(`Chambre ${roomNumber} marquée ${statusLabel}`)
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la mise à jour')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-amber-50 to-orange-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-amber-200/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="OGOU_Hôtel" height={32} width={32} className="object-contain" />
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent">OGOU_Hôtel</h1>
              <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">Ménage</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="border-amber-200 text-amber-700 hover:bg-amber-50"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
        <p className="text-sm text-amber-800/80 mt-1.5">
          Bonjour, {profile.first_name} 👋
        </p>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 whitespace-nowrap">
              <SprayCan className="h-3.5 w-3.5" />
              {stats.cleaning} nettoyage
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 whitespace-nowrap">
              <Wrench className="h-3.5 w-3.5" />
              {stats.maintenance} maintenance
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800 whitespace-nowrap">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {stats.available} disponibles
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1.5 text-xs font-medium text-sky-800 whitespace-nowrap">
              <Bed className="h-3.5 w-3.5" />
              {stats.occupied} occupées
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-amber-200/40">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-500 mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Toutes les chambres sont propres ! 🎉</h3>
            <p className="text-sm text-muted-foreground mt-1">Aucune chambre ne nécessite de nettoyage</p>
          </div>
        ) : (
          rooms.map((room) => (
            <Card key={room.id} className="border-amber-200/40 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-gray-900">{room.room_number}</span>
                      {room.status === 'cleaning' && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs">
                          Nettoyage
                        </Badge>
                      )}
                      {room.status === 'maintenance' && (
                        <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs">
                          Maintenance
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{room.room_type}</p>
                  </div>
                  <Bed className="h-5 w-5 text-amber-400" />
                </div>

                <Separator className="mb-3" />

                <div className="space-y-2">
                  {room.status === 'cleaning' && (
                    <Button
                      className="w-full h-14 text-base font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                      onClick={() => handleRoomStatus(room.id, 'available', room.room_number)}
                      disabled={actionLoading === room.id}
                    >
                      {actionLoading === room.id ? (
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 mr-2" />
                      )}
                      Chambre propre
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full h-12 text-base font-medium rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={() => handleRoomStatus(room.id, 'maintenance', room.room_number)}
                    disabled={actionLoading === room.id || room.status === 'maintenance'}
                  >
                    <Wrench className="h-4 w-4 mr-2" />
                    Maintenance
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Footer */}
      <StaffFooter onLogout={onLogout} />
    </div>
  )
}

// ─── Restaurant Staff View ───────────────────────────────────────────────────

function RestaurantStaffView({ profile, onLogout }: StaffDashboardProps) {
  const [orders, setOrders] = useState<OrderInfo[]>([])
  const [stats, setStats] = useState<RestaurantStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<'pending' | 'preparing' | 'served'>('pending')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/staff/restaurant')
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders || [])
        setStats(data.stats || null)
      } else {
        toast.error('Erreur lors du chargement des commandes')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleOrderStatus = async (orderId: string, newStatus: string) => {
    setActionLoading(orderId)
    try {
      const res = await fetch(`/api/staff/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        const statusLabels: Record<string, string> = {
          preparing: 'en préparation',
          served: 'servie',
        }
        toast.success(`Commande marquée ${statusLabels[newStatus] || newStatus}`)
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la mise à jour')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setActionLoading(null)
    }
  }

  const filteredOrders = orders.filter(o => o.status === activeFilter)

  const filterConfig = [
    { key: 'pending' as const, label: 'En attente', icon: <Clock className="h-4 w-4" />, count: stats?.pending ?? 0, color: 'bg-amber-100 text-amber-800' },
    { key: 'preparing' as const, label: 'En préparation', icon: <Utensils className="h-4 w-4" />, count: stats?.preparing ?? 0, color: 'bg-orange-100 text-orange-800' },
    { key: 'served' as const, label: 'Servies', icon: <CheckCircle2 className="h-4 w-4" />, count: stats?.served ?? 0, color: 'bg-emerald-100 text-emerald-800' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-amber-50 to-orange-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-amber-200/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="OGOU_Hôtel" height={32} width={32} className="object-contain" />
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent">OGOU_Hôtel</h1>
              <p className="text-[10px] uppercase tracking-wider text-orange-600 font-semibold">Restaurant</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="border-amber-200 text-amber-700 hover:bg-amber-50"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
        <p className="text-sm text-amber-800/80 mt-1.5">
          Bonjour, {profile.first_name} 👋
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filterConfig.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition-all ${
                activeFilter === filter.key
                  ? filter.color + ' shadow-sm'
                  : 'bg-white/60 text-gray-500 border border-gray-200'
              }`}
            >
              {filter.icon}
              {filter.label}
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                activeFilter === filter.key ? 'bg-white/60' : 'bg-gray-100'
              }`}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-amber-200/40">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-500 mb-4">
              <UtensilsCrossed className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Aucune commande</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {activeFilter === 'pending' ? "Aucune commande en attente" :
               activeFilter === 'preparing' ? "Aucune commande en préparation" :
               "Aucune commande servie"}
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="border-amber-200/40 shadow-sm">
              <CardContent className="p-4">
                {/* Order Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900">{getShortOrderId(order.id)}</span>
                      {order.status === 'pending' && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs">
                          En attente
                        </Badge>
                      )}
                      {order.status === 'preparing' && (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100 text-xs">
                          En préparation
                        </Badge>
                      )}
                      {order.status === 'served' && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs">
                          Servie
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                      {order.room_id ? (
                        <>
                          <Bed className="h-3.5 w-3.5" />
                          <span>Chambre</span>
                        </>
                      ) : (
                        <>
                          <Utensils className="h-3.5 w-3.5" />
                          <span>Table {order.table_number || '—'}</span>
                        </>
                      )}
                      <span className="mx-1">•</span>
                      <Clock className="h-3.5 w-3.5" />
                      <span>{formatTimeAgo(order.created_at)}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-amber-300" />
                </div>

                {/* Order Items */}
                {order.restaurant_order_items && order.restaurant_order_items.length > 0 && (
                  <div className="bg-amber-50/50 rounded-lg p-3 mb-3">
                    <div className="space-y-1.5">
                      {order.restaurant_order_items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-200/60 text-amber-800 text-xs font-bold">
                              {item.quantity}
                            </span>
                            <span className="text-gray-700">{item.item_name}</span>
                          </div>
                          <span className="text-muted-foreground">{formatFCFA(item.unit_price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>Total</span>
                      <span className="text-amber-800">{formatFCFA(order.total_amount)}</span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {order.status === 'pending' && (
                  <Button
                    className="w-full h-12 text-base font-medium rounded-xl bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-600/20"
                    onClick={() => handleOrderStatus(order.id, 'preparing')}
                    disabled={actionLoading === order.id}
                  >
                    {actionLoading === order.id ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <span className="mr-2">🔥</span>
                    )}
                    Préparer
                  </Button>
                )}
                {order.status === 'preparing' && (
                  <Button
                    className="w-full h-12 text-base font-medium rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                    onClick={() => handleOrderStatus(order.id, 'served')}
                    disabled={actionLoading === order.id}
                  >
                    {actionLoading === order.id ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                    )}
                    Servir
                  </Button>
                )}
                {order.status === 'served' && (
                  <div className="flex items-center justify-center gap-2 text-emerald-600 py-1">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Commande servie</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Footer */}
      <StaffFooter onLogout={onLogout} />
    </div>
  )
}

// ─── Receptionist View (Full Dashboard) ────────────────────────────────────────

function ReceptionistView({ profile, onLogout }: StaffDashboardProps) {
  const [activeTab, setActiveTab] = useState<ReceptionistTabId>('overview')
  const [checkIns, setCheckIns] = useState<ReservationInfo[]>([])
  const [checkOuts, setCheckOuts] = useState<ReservationInfo[]>([])
  const [today, setToday] = useState('')
  const [rooms, setRooms] = useState<RoomInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [roomStatusFilter, setRoomStatusFilter] = useState<string>('all')
  const [roomActionLoading, setRoomActionLoading] = useState<string | null>(null)
  const [walkInOpen, setWalkInOpen] = useState(false)

  const fetchAllData = useCallback(async () => {
    setLoading(true)
    try {
      const [receptionRes, roomsRes] = await Promise.all([
        fetch('/api/staff/reception'),
        fetch('/api/owner/rooms'),
      ])
      if (receptionRes.ok) {
        const data = await receptionRes.json()
        setCheckIns(data.checkIns || [])
        setCheckOuts(data.checkOuts || [])
        setToday(data.today || '')
      }
      if (roomsRes.ok) {
        const data = await roomsRes.json()
        setRooms(data.rooms || [])
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  const handleCheckIn = async (reservationId: string, _roomId: string) => {
    setActionLoading(reservationId)
    try {
      // The reservation API already updates room status to 'occupied' internally
      const res = await fetch(`/api/owner/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_in' }),
      })
      if (res.ok) {
        toast.success('Check-in effectué avec succès')
        fetchAllData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors du check-in')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCheckOut = async (reservationId: string, _roomId: string) => {
    setActionLoading(reservationId)
    try {
      // The reservation API already updates room status to 'cleaning' internally
      const res = await fetch(`/api/owner/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_out' }),
      })
      if (res.ok) {
        toast.success('Check-out effectué — Ménage requis')
        fetchAllData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors du check-out')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setActionLoading(null)
    }
  }

  // Handle room status change (e.g., cleaning → available, available → maintenance)
  const handleRoomStatusChange = async (roomId: string, newStatus: string) => {
    setRoomActionLoading(roomId)
    try {
      const res = await fetch(`/api/owner/reservations/room-status/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const statusLabels: Record<string, string> = {
          available: 'Disponible',
          cleaning: 'Nettoyage',
          maintenance: 'Maintenance',
        }
        toast.success(`Statut changé en "${statusLabels[newStatus] || newStatus}"`)
        fetchAllData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors du changement de statut')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setRoomActionLoading(null)
    }
  }

  const renderReservationCard = (reservation: ReservationInfo, type: 'check-in' | 'check-out') => {
    const customerName = getCustomerName(reservation.customers)
    const room = getRoomInfo(reservation.rooms)
    const isCheckedIn = reservation.status === 'checked_in'
    const isCheckedOut = reservation.status === 'checked_out'

    return (
      <Card key={reservation.id} className="border-amber-200/40 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-amber-500" />
                <span className="text-base font-semibold text-gray-900">{customerName}</span>
              </div>
              {room && (
                <div className="flex items-center gap-1.5 mt-1.5 text-sm text-muted-foreground">
                  <Bed className="h-3.5 w-3.5" />
                  <span>Chambre {room.room_number} — {room.room_type}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  {type === 'check-in'
                    ? `Arrivée : ${formatDateFR(reservation.check_in_date)}`
                    : `Départ : ${formatDateFR(reservation.check_out_date)}`
                  }
                </span>
              </div>
            </div>
            <div className="shrink-0">
              {isCheckedOut ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
              ) : isCheckedIn && type === 'check-out' ? (
                <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100 text-xs">
                  Enregistré
                </Badge>
              ) : isCheckedIn && type === 'check-in' ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
              ) : (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs">
                  {reservation.status === 'pending' ? 'En attente' : 'Confirmée'}
                </Badge>
              )}
            </div>
          </div>
          <Separator className="mb-3" />
          {type === 'check-in' && !isCheckedIn && (
            <Button
              className="w-full h-12 text-base font-medium rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
              onClick={() => handleCheckIn(reservation.id, reservation.room_id)}
              disabled={actionLoading === reservation.id}
            >
              {actionLoading === reservation.id ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-5 w-5 mr-2" />
              )}
              Check-in
            </Button>
          )}
          {type === 'check-in' && isCheckedIn && (
            <div className="flex items-center justify-center gap-2 text-emerald-600 py-1">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Client enregistré</span>
            </div>
          )}
          {type === 'check-out' && isCheckedIn && (
            <Button
              className="w-full h-12 text-base font-medium rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20"
              onClick={() => handleCheckOut(reservation.id, reservation.room_id)}
              disabled={actionLoading === reservation.id}
            >
              {actionLoading === reservation.id ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <DoorOpen className="h-5 w-5 mr-2" />
              )}
              Check-out
            </Button>
          )}
          {type === 'check-out' && isCheckedOut && (
            <div className="flex items-center justify-center gap-2 text-emerald-600 py-1">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Départ effectué</span>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Room stats for overview
  const roomStats = {
    total: rooms.length,
    available: rooms.filter(r => r.status === 'available').length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
    cleaning: rooms.filter(r => r.status === 'cleaning').length,
    maintenance: rooms.filter(r => r.status === 'maintenance').length,
  }

  const getRoomStatusBadge = (status: string) => {
    switch (status) {
      case 'available': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs">Disponible</Badge>
      case 'occupied': return <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100 text-xs">Occupée</Badge>
      case 'cleaning': return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs">Nettoyage</Badge>
      case 'maintenance': return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs">Maintenance</Badge>
      default: return <Badge variant="secondary" className="text-xs">{status}</Badge>
    }
  }

  // ─── Sidebar content (shared between desktop and mobile) ────────────────
  const sidebarContent = (
    <div className="flex h-full flex-col bg-gradient-to-b from-amber-50 to-orange-50">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-amber-200/50">
        <Image src="/logo.png" alt="OGOU_Hôtel" height={36} width={36} className="object-contain" />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent">OGOU_Hôtel</h1>
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">Réceptionniste</p>
            <div className="flex h-2 w-2 rounded-full bg-emerald-500" />
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {RECEPTIONIST_NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-amber-100 text-amber-900 shadow-sm'
                  : 'text-amber-800/70 hover:bg-amber-100/50 hover:text-amber-900'
              }`}
            >
              {item.icon}
              <span className="truncate flex-1">{item.label}</span>
              {item.id === 'overview' && <ExpiredStayBadge />}
            </button>
          )
        })}
      </nav>
      <div className="px-4 py-2 border-t border-amber-200/50">
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
          <span className="truncate">Email</span>
        </a>
      </div>
      <div className="border-t border-amber-200/50 px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200 text-amber-800 text-xs font-bold shrink-0">
            {profile.first_name.charAt(0)}{profile.last_name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-900 truncate">{profile.first_name} {profile.last_name}</p>
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Réceptionniste
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full border-amber-200 text-amber-700 hover:bg-amber-100 hover:text-amber-900"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Déconnexion
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      {/* ─── Desktop Sidebar ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-amber-200/50 shrink-0">
        {sidebarContent}
      </aside>

      {/* ─── Main Content ────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b bg-white">
          <div className="flex items-center gap-2">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Image src="/logo.png" alt="OGOU_Hôtel" height={20} width={20} className="object-contain" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                {sidebarContent}
              </SheetContent>
            </Sheet>
            <span className="font-bold bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent">OGOU_Hôtel</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {/* Mobile Navigation Pills */}
        <div className="lg:hidden flex overflow-x-auto gap-1 px-4 py-2 border-b bg-white">
          {RECEPTIONIST_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === item.id
                  ? 'bg-amber-100 text-amber-900'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {item.icon}
              {item.label}
              {item.id === 'overview' && <ExpiredStayBadge />}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          {/* ─── Overview Tab ──────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-900">Bonjour, {profile.first_name} 👋</h2>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs animate-pulse">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5" />
                      En service
                    </Badge>
                  </div>
                  {today && <p className="text-sm text-muted-foreground mt-1">{formatDateFR(today)}</p>}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchAllData}
                  disabled={loading}
                  className="border-amber-200 text-amber-700 hover:bg-amber-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                  Actualiser
                </Button>
              </div>

              {/* Expired Stay Alerts */}
              <ExpiredStayAlert
                onCheckOut={async (reservationId) => {
                  await handleCheckOut(reservationId, '')
                  fetchAllData()
                }}
                onNavigateToReservations={() => setActiveTab('reservations')}
              />

              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-emerald-100/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('reservations')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <DoorOpen className="h-8 w-8 text-emerald-600" />
                      <span className="text-3xl font-bold text-emerald-700">{checkIns.length}</span>
                    </div>
                    <p className="text-sm font-medium text-emerald-800 mt-2">Arrivées aujourd&apos;hui</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-200/50 bg-gradient-to-br from-amber-50 to-amber-100/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('reservations')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <DoorOpen className="h-8 w-8 text-amber-600" />
                      <span className="text-3xl font-bold text-amber-700">{checkOuts.length}</span>
                    </div>
                    <p className="text-sm font-medium text-amber-800 mt-2">Départs aujourd&apos;hui</p>
                  </CardContent>
                </Card>
                <Card className="border-sky-200/50 bg-gradient-to-br from-sky-50 to-sky-100/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('rooms')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Bed className="h-8 w-8 text-sky-600" />
                      <span className="text-3xl font-bold text-sky-700">{roomStats.occupied}</span>
                    </div>
                    <p className="text-sm font-medium text-sky-800 mt-2">Chambres occupées</p>
                  </CardContent>
                </Card>
                <Card className="border-green-200/50 bg-gradient-to-br from-green-50 to-green-100/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('rooms')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                      <span className="text-3xl font-bold text-green-700">{roomStats.available}</span>
                    </div>
                    <p className="text-sm font-medium text-green-800 mt-2">Chambres disponibles</p>
                  </CardContent>
                </Card>
              </div>

              {/* Room Status Summary */}
              <Card className="border-amber-200/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bed className="h-4 w-4 text-amber-600" />
                    État des chambres
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-emerald-500" />
                      <span className="text-sm text-muted-foreground">{roomStats.available} disponibles</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-sky-500" />
                      <span className="text-sm text-muted-foreground">{roomStats.occupied} occupées</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-amber-500" />
                      <span className="text-sm text-muted-foreground">{roomStats.cleaning} nettoyage</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-red-500" />
                      <span className="text-sm text-muted-foreground">{roomStats.maintenance} maintenance</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Priority Tasks Summary */}
              {(checkIns.length > 0 || checkOuts.length > 0 || roomStats.cleaning > 0) && (
                <Card className="border-amber-300/60 bg-gradient-to-r from-amber-50 to-orange-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                      Tâches prioritaires du jour
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {checkIns.length > 0 && (
                        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                          <DoorOpen className="h-4 w-4 text-emerald-600 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-emerald-800">{checkIns.length} arrivée{checkIns.length > 1 ? 's' : ''}</p>
                            <p className="text-xs text-emerald-600">Check-in à effectuer</p>
                          </div>
                        </div>
                      )}
                      {checkOuts.length > 0 && (
                        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                          <DoorOpen className="h-4 w-4 text-amber-600 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-amber-800">{checkOuts.length} départ{checkOuts.length > 1 ? 's' : ''}</p>
                            <p className="text-xs text-amber-600">Check-out à effectuer</p>
                          </div>
                        </div>
                      )}
                      {roomStats.cleaning > 0 && (
                        <div className="flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
                          <SprayCan className="h-4 w-4 text-orange-600 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-orange-800">{roomStats.cleaning} nettoyage</p>
                            <p className="text-xs text-orange-600">Chambres à vérifier</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Today's Check-ins */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
                    <DoorOpen className="h-4 w-4 text-emerald-600" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900">Check-ins du jour</h3>
                  {checkIns.length > 0 && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs">
                      {checkIns.length}
                    </Badge>
                  )}
                </div>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Card key={i} className="border-amber-200/40">
                        <CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent>
                      </Card>
                    ))}
                  </div>
                ) : checkIns.length === 0 ? (
                  <Card className="border-amber-200/40">
                    <CardContent className="p-6 text-center">
                      <p className="text-sm text-muted-foreground">Aucun check-in prévu aujourd&apos;hui</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {checkIns.map((res) => renderReservationCard(res, 'check-in'))}
                  </div>
                )}
              </div>

              {/* Today's Check-outs */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100">
                    <DoorOpen className="h-4 w-4 text-amber-600" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900">Check-outs du jour</h3>
                  {checkOuts.length > 0 && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs">
                      {checkOuts.length}
                    </Badge>
                  )}
                </div>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Card key={i} className="border-amber-200/40">
                        <CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent>
                      </Card>
                    ))}
                  </div>
                ) : checkOuts.length === 0 ? (
                  <Card className="border-amber-200/40">
                    <CardContent className="p-6 text-center">
                      <p className="text-sm text-muted-foreground">Aucun check-out prévu aujourd&apos;hui</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {checkOuts.map((res) => renderReservationCard(res, 'check-out'))}
                  </div>
                )}
              </div>

              {/* Walk-In Direct Check-In Button */}
              <Card
                className="border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 cursor-pointer hover:shadow-lg transition-all"
                onClick={() => setWalkInOpen(true)}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30">
                    <DoorOpen className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-bold text-emerald-900">Enregistrement Direct</p>
                    <p className="text-sm text-emerald-700">Client sans réservation ? Enregistrez-le et attribuez une chambre immédiatement</p>
                  </div>
                  <Plus className="h-6 w-6 text-emerald-500 shrink-0" />
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-3">Actions rapides</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card
                    className="border-amber-200/40 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setActiveTab('reservations')}
                  >
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <Calendar className="h-6 w-6 text-amber-600" />
                      <span className="text-sm font-medium text-amber-900">Nouvelle réservation</span>
                    </CardContent>
                  </Card>
                  <Card
                    className="border-emerald-200/40 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setWalkInOpen(true)}
                  >
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <DoorOpen className="h-6 w-6 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-900">Enregistrement direct</span>
                    </CardContent>
                  </Card>
                  <Card
                    className="border-sky-200/40 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setActiveTab('rooms')}
                  >
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <Bed className="h-6 w-6 text-sky-600" />
                      <span className="text-sm font-medium text-sky-900">Voir chambres</span>
                    </CardContent>
                  </Card>
                  <Card
                    className="border-orange-200/40 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setActiveTab('invoices')}
                  >
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <FileText className="h-6 w-6 text-orange-600" />
                      <span className="text-sm font-medium text-orange-900">Factures</span>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* ─── Rooms Tab ─────────────────────────────────────────────── */}
          {activeTab === 'rooms' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Chambres</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchAllData}
                  disabled={loading}
                  className="border-amber-200 text-amber-700 hover:bg-amber-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                  Actualiser
                </Button>
              </div>

              {/* Room Status Summary — clickable filter pills */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setRoomStatusFilter('all')}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                    roomStatusFilter === 'all'
                      ? 'bg-gray-800 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Bed className="h-3.5 w-3.5" />
                  Toutes ({rooms.length})
                </button>
                <button
                  onClick={() => setRoomStatusFilter('available')}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                    roomStatusFilter === 'available'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {roomStats.available} disponibles
                </button>
                <button
                  onClick={() => setRoomStatusFilter('occupied')}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                    roomStatusFilter === 'occupied'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-sky-100 text-sky-800 hover:bg-sky-200'
                  }`}
                >
                  <Bed className="h-3.5 w-3.5" />
                  {roomStats.occupied} occupées
                </button>
                <button
                  onClick={() => setRoomStatusFilter('cleaning')}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                    roomStatusFilter === 'cleaning'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  }`}
                >
                  <SprayCan className="h-3.5 w-3.5" />
                  {roomStats.cleaning} nettoyage
                </button>
                <button
                  onClick={() => setRoomStatusFilter('maintenance')}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                    roomStatusFilter === 'maintenance'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-red-100 text-red-800 hover:bg-red-200'
                  }`}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  {roomStats.maintenance} maintenance
                </button>
              </div>

              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i}><CardContent className="p-4"><Skeleton className="h-32 w-full" /></CardContent></Card>
                  ))}
                </div>
              ) : rooms.filter(r => roomStatusFilter === 'all' || r.status === roomStatusFilter).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-500 mb-4">
                    <Bed className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {roomStatusFilter === 'all' ? 'Aucune chambre' : 'Aucune chambre dans ce statut'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {roomStatusFilter === 'all' ? 'Les chambres seront ajoutées par le propriétaire' : 'Modifiez le filtre pour voir d\'autres chambres'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {rooms
                    .filter(r => roomStatusFilter === 'all' || r.status === roomStatusFilter)
                    .map((room) => {
                      const isActionLoading = roomActionLoading === room.id
                      // Determine available status transitions for this room
                      const statusActions: { status: string; label: string; icon: React.ReactNode; colorClass: string }[] = []
                      if (room.status === 'available') {
                        statusActions.push(
                          { status: 'cleaning', label: 'Mettre en nettoyage', icon: <SprayCan className="h-3.5 w-3.5" />, colorClass: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200' },
                          { status: 'maintenance', label: 'Mettre en maintenance', icon: <Wrench className="h-3.5 w-3.5" />, colorClass: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200' },
                        )
                      } else if (room.status === 'cleaning') {
                        statusActions.push(
                          { status: 'available', label: 'Marquer disponible', icon: <CheckCircle2 className="h-3.5 w-3.5" />, colorClass: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200' },
                          { status: 'maintenance', label: 'Mettre en maintenance', icon: <Wrench className="h-3.5 w-3.5" />, colorClass: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200' },
                        )
                      } else if (room.status === 'maintenance') {
                        statusActions.push(
                          { status: 'available', label: 'Marquer disponible', icon: <CheckCircle2 className="h-3.5 w-3.5" />, colorClass: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200' },
                          { status: 'cleaning', label: 'Mettre en nettoyage', icon: <SprayCan className="h-3.5 w-3.5" />, colorClass: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200' },
                        )
                      }
                      // occupied rooms cannot be manually changed — must use check-out

                      return (
                        <Card key={room.id} className={`border-2 transition-all hover:shadow-md ${
                          room.status === 'available' ? 'border-emerald-200 bg-emerald-50/30' :
                          room.status === 'occupied' ? 'border-sky-200 bg-sky-50/30' :
                          room.status === 'cleaning' ? 'border-amber-200 bg-amber-50/30' :
                          'border-red-200 bg-red-50/30'
                        }`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xl font-bold text-gray-900">{room.room_number}</span>
                              {getRoomStatusBadge(room.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">{room.room_type}</p>
                            <p className="text-sm font-medium text-amber-800 mt-1">{formatFCFA(room.price_per_night)}/nuit</p>
                            {/* Status change actions */}
                            {statusActions.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
                                {statusActions.map((action) => (
                                  <button
                                    key={action.status}
                                    onClick={() => handleRoomStatusChange(room.id, action.status)}
                                    disabled={isActionLoading}
                                    title={action.label}
                                    className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50 ${action.colorClass}`}
                                  >
                                    {isActionLoading ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      action.icon
                                    )}
                                    {action.status === 'available' ? 'Disponible' :
                                     action.status === 'cleaning' ? 'Nettoyage' :
                                     'Maintenance'}
                                  </button>
                                ))}
                              </div>
                            )}
                            {room.status === 'occupied' && (
                              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
                                <span className="text-[10px] text-sky-600 font-medium flex items-center gap-1">
                                  <Bed className="h-3 w-3" />
                                  Chambre occupée — check-out requis
                                </span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                </div>
              )}
            </div>
          )}

          {/* ─── Reservations Tab ──────────────────────────────────────── */}
          {activeTab === 'reservations' && (
            <ReservationsTab
              rooms={rooms.map((r) => ({
                id: r.id,
                room_number: r.room_number,
                room_type: r.room_type,
                status: r.status,
                price_per_night: r.price_per_night,
              }))}
              onRefresh={fetchAllData}
            />
          )}

          {/* ─── Customers Tab ─────────────────────────────────────────── */}
          {activeTab === 'customers' && (
            <CustomersTab onRefresh={fetchAllData} />
          )}

          {/* ─── Invoices Tab ──────────────────────────────────────────── */}
          {activeTab === 'invoices' && (
            <InvoicesTab onRefresh={fetchAllData} />
          )}

          {/* ─── Notifications Tab ─────────────────────────────────────── */}
          {activeTab === 'notifications' && (
            <NotificationPanel onRefresh={fetchAllData} />
          )}
        </div>
      </main>

      {/* ─── Walk-In Direct Check-In Dialog ────────────────────────────── */}
      <WalkInDialog
        open={walkInOpen}
        onOpenChange={setWalkInOpen}
        rooms={rooms.map((r) => ({
          id: r.id,
          room_number: r.room_number,
          room_type: r.room_type,
          status: r.status,
          price_per_night: r.price_per_night,
        }))}
        onSuccess={fetchAllData}
      />
    </div>
  )
}

// ─── Manager View (Tabbed Interface) ─────────────────────────────────────────

function ManagerView({ profile, onLogout }: StaffDashboardProps) {
  const [activeTab, setActiveTab] = useState('housekeeping')

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-amber-50 to-orange-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-amber-200/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="OGOU_Hôtel" height={32} width={32} className="object-contain" />
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent">OGOU_Hôtel</h1>
              <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">Manager</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="border-amber-200 text-amber-700 hover:bg-amber-50"
          >
            <LogOut className="h-4 w-4 mr-1.5" />
            Déconnexion
          </Button>
        </div>
        <p className="text-sm text-amber-800/80 mt-1.5">
          Bonjour, {profile.first_name} 👋
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-amber-200/50 px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full h-12 bg-transparent p-0 gap-1">
            <TabsTrigger
              value="housekeeping"
              className="flex-1 h-10 rounded-lg data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900 data-[state=active]:shadow-sm text-xs font-medium"
            >
              🧹 Ménage
            </TabsTrigger>
            <TabsTrigger
              value="restaurant"
              className="flex-1 h-10 rounded-lg data-[state=active]:bg-orange-100 data-[state=active]:text-orange-900 data-[state=active]:shadow-sm text-xs font-medium"
            >
              🍽️ Restaurant
            </TabsTrigger>
            <TabsTrigger
              value="reception"
              className="flex-1 h-10 rounded-lg data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900 data-[state=active]:shadow-sm text-xs font-medium"
            >
              🏨 Réception
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'housekeeping' && (
          <HousekeeperContent profile={profile} />
        )}
        {activeTab === 'restaurant' && (
          <RestaurantContent profile={profile} />
        )}
        {activeTab === 'reception' && (
          <ReceptionContent profile={profile} />
        )}
      </div>
    </div>
  )
}

// ─── Inline Content Components (for Manager tabs, no own header/footer) ──────

function HousekeeperContent({ profile }: { profile: StaffDashboardProps['profile'] }) {
  const [rooms, setRooms] = useState<RoomInfo[]>([])
  const [stats, setStats] = useState<HousekeepingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/staff/housekeeping')
      if (res.ok) {
        const data = await res.json()
        setRooms(data.rooms || [])
        setStats(data.stats || null)
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRoomStatus = async (roomId: string, newStatus: string, roomNumber: string) => {
    setActionLoading(roomId)
    try {
      const res = await fetch(`/api/staff/room-status/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const statusLabel = newStatus === 'available' ? 'propre' : 'en maintenance'
        toast.success(`Chambre ${roomNumber} marquée ${statusLabel}`)
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="p-4 space-y-3">
      {stats && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 whitespace-nowrap">
            <SprayCan className="h-3.5 w-3.5" />{stats.cleaning} nettoyage
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 whitespace-nowrap">
            <Wrench className="h-3.5 w-3.5" />{stats.maintenance} maintenance
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800 whitespace-nowrap">
            <CheckCircle2 className="h-3.5 w-3.5" />{stats.available} dispo.
          </div>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={fetchData}
        disabled={loading}
        className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
      >
        <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
        Actualiser
      </Button>

      {loading ? (
        Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="border-amber-200/40">
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-500 mb-3">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <p className="text-sm text-muted-foreground">Toutes les chambres sont propres ! 🎉</p>
        </div>
      ) : (
        rooms.map((room) => (
          <Card key={room.id} className="border-amber-200/40 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-gray-900">{room.room_number}</span>
                    {room.status === 'cleaning' && (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs">Nettoyage</Badge>
                    )}
                    {room.status === 'maintenance' && (
                      <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs">Maintenance</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{room.room_type}</p>
                </div>
                <Bed className="h-5 w-5 text-amber-400" />
              </div>
              <div className="space-y-2">
                {room.status === 'cleaning' && (
                  <Button
                    className="w-full h-12 text-base font-medium rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleRoomStatus(room.id, 'available', room.room_number)}
                    disabled={actionLoading === room.id}
                  >
                    {actionLoading === room.id ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                    Chambre propre
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full h-10 text-sm font-medium rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50"
                  onClick={() => handleRoomStatus(room.id, 'maintenance', room.room_number)}
                  disabled={actionLoading === room.id || room.status === 'maintenance'}
                >
                  <Wrench className="h-4 w-4 mr-2" />
                  Maintenance
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

function RestaurantContent({ profile }: { profile: StaffDashboardProps['profile'] }) {
  const [orders, setOrders] = useState<OrderInfo[]>([])
  const [stats, setStats] = useState<RestaurantStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<'pending' | 'preparing' | 'served'>('pending')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/staff/restaurant')
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders || [])
        setStats(data.stats || null)
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleOrderStatus = async (orderId: string, newStatus: string) => {
    setActionLoading(orderId)
    try {
      const res = await fetch(`/api/staff/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const statusLabels: Record<string, string> = { preparing: 'en préparation', served: 'servie' }
        toast.success(`Commande marquée ${statusLabels[newStatus] || newStatus}`)
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setActionLoading(null)
    }
  }

  const filteredOrders = orders.filter(o => o.status === activeFilter)

  const filterConfig = [
    { key: 'pending' as const, label: 'En attente', count: stats?.pending ?? 0, color: 'bg-amber-100 text-amber-800' },
    { key: 'preparing' as const, label: 'En préparation', count: stats?.preparing ?? 0, color: 'bg-orange-100 text-orange-800' },
    { key: 'served' as const, label: 'Servies', count: stats?.served ?? 0, color: 'bg-emerald-100 text-emerald-800' },
  ]

  return (
    <div className="p-4 space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filterConfig.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
              activeFilter === filter.key ? filter.color + ' shadow-sm' : 'bg-white/60 text-gray-500 border border-gray-200'
            }`}
          >
            {filter.label}
            <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
              activeFilter === filter.key ? 'bg-white/60' : 'bg-gray-100'
            }`}>
              {filter.count}
            </span>
          </button>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={fetchData}
        disabled={loading}
        className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
      >
        <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
        Actualiser
      </Button>

      {loading ? (
        Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="border-amber-200/40">
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-500 mb-3">
            <UtensilsCrossed className="h-7 w-7" />
          </div>
          <p className="text-sm text-muted-foreground">Aucune commande</p>
        </div>
      ) : (
        filteredOrders.map((order) => (
          <Card key={order.id} className="border-amber-200/40 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="text-lg font-bold text-gray-900">{getShortOrderId(order.id)}</span>
                {order.status === 'pending' && <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs">En attente</Badge>}
                {order.status === 'preparing' && <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100 text-xs">En préparation</Badge>}
                {order.status === 'served' && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs">Servie</Badge>}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                {order.room_id ? (
                  <><Bed className="h-3.5 w-3.5" /><span>Chambre</span></>
                ) : (
                  <><Utensils className="h-3.5 w-3.5" /><span>Table {order.table_number || '—'}</span></>
                )}
                <span className="mx-1">•</span>
                <Clock className="h-3.5 w-3.5" />
                <span>{formatTimeAgo(order.created_at)}</span>
              </div>
              {order.restaurant_order_items && order.restaurant_order_items.length > 0 && (
                <div className="bg-amber-50/50 rounded-lg p-2.5 mb-3">
                  {order.restaurant_order_items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-200/60 text-amber-800 text-[10px] font-bold">{item.quantity}</span>
                        <span className="text-gray-700">{item.item_name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatFCFA(item.unit_price * item.quantity)}</span>
                    </div>
                  ))}
                  <Separator className="my-1.5" />
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>Total</span>
                    <span className="text-amber-800">{formatFCFA(order.total_amount)}</span>
                  </div>
                </div>
              )}
              {order.status === 'pending' && (
                <Button
                  className="w-full h-12 text-base font-medium rounded-xl bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={() => handleOrderStatus(order.id, 'preparing')}
                  disabled={actionLoading === order.id}
                >
                  {actionLoading === order.id ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <span className="mr-2">🔥</span>}
                  Préparer
                </Button>
              )}
              {order.status === 'preparing' && (
                <Button
                  className="w-full h-12 text-base font-medium rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleOrderStatus(order.id, 'served')}
                  disabled={actionLoading === order.id}
                >
                  {actionLoading === order.id ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                  Servir
                </Button>
              )}
              {order.status === 'served' && (
                <div className="flex items-center justify-center gap-2 text-emerald-600 py-1">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">Commande servie</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

function ReceptionContent({ profile }: { profile: StaffDashboardProps['profile'] }) {
  const [checkIns, setCheckIns] = useState<ReservationInfo[]>([])
  const [checkOuts, setCheckOuts] = useState<ReservationInfo[]>([])
  const [today, setToday] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/staff/reception')
      if (res.ok) {
        const data = await res.json()
        setCheckIns(data.checkIns || [])
        setCheckOuts(data.checkOuts || [])
        setToday(data.today || '')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCheckIn = async (reservationId: string, roomId: string) => {
    setActionLoading(reservationId)
    try {
      const res = await fetch(`/api/owner/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_in' }),
      })
      if (res.ok) {
        await fetch(`/api/owner/reservations/room-status/${roomId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'occupied' }),
        })
        toast.success('Check-in effectué')
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCheckOut = async (reservationId: string, roomId: string) => {
    setActionLoading(reservationId)
    try {
      const res = await fetch(`/api/owner/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_out' }),
      })
      if (res.ok) {
        await fetch(`/api/owner/reservations/room-status/${roomId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cleaning' }),
        })
        toast.success('Check-out effectué — Ménage requis')
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setActionLoading(null)
    }
  }

  const renderMiniCard = (reservation: ReservationInfo, type: 'check-in' | 'check-out') => {
    const customerName = getCustomerName(reservation.customers)
    const room = getRoomInfo(reservation.rooms)
    const isCheckedIn = reservation.status === 'checked_in'
    const isCheckedOut = reservation.status === 'checked_out'

    return (
      <Card key={reservation.id} className="border-amber-200/40 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-sm font-semibold text-gray-900">{customerName}</span>
              </div>
              {room && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Bed className="h-3 w-3" />
                  Chambre {room.room_number} — {room.room_type}
                </div>
              )}
            </div>
            {(isCheckedIn && type === 'check-in') || isCheckedOut ? (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
            ) : (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-[10px]">
                {isCheckedIn ? 'Enregistré' : reservation.status === 'pending' ? 'En attente' : 'Confirmée'}
              </Badge>
            )}
          </div>
          <Separator className="mb-2" />
          {type === 'check-in' && !isCheckedIn && (
            <Button
              className="w-full h-10 text-sm font-medium rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => handleCheckIn(reservation.id, reservation.room_id)}
              disabled={actionLoading === reservation.id}
            >
              {actionLoading === reservation.id ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
              Check-in
            </Button>
          )}
          {type === 'check-in' && isCheckedIn && (
            <div className="flex items-center justify-center gap-1.5 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium">Enregistré</span>
            </div>
          )}
          {type === 'check-out' && isCheckedIn && (
            <Button
              className="w-full h-10 text-sm font-medium rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => handleCheckOut(reservation.id, reservation.room_id)}
              disabled={actionLoading === reservation.id}
            >
              {actionLoading === reservation.id ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <DoorOpen className="h-4 w-4 mr-1.5" />}
              Check-out
            </Button>
          )}
          {type === 'check-out' && isCheckedOut && (
            <div className="flex items-center justify-center gap-1.5 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium">Départ effectué</span>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {today && (
        <p className="text-xs text-muted-foreground">{formatDateFR(today)}</p>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={fetchData}
        disabled={loading}
        className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
      >
        <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
        Actualiser
      </Button>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="border-amber-200/40">
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Check-ins */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <DoorOpen className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-bold text-gray-900">Check-ins</span>
              {checkIns.length > 0 && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px]">{checkIns.length}</Badge>
              )}
            </div>
            {checkIns.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Aucun check-in prévu</p>
            ) : (
              <div className="space-y-2">{checkIns.map(r => renderMiniCard(r, 'check-in'))}</div>
            )}
          </div>

          {/* Check-outs */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <DoorOpen className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-bold text-gray-900">Check-outs</span>
              {checkOuts.length > 0 && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-[10px]">{checkOuts.length}</Badge>
              )}
            </div>
            {checkOuts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Aucun check-out prévu</p>
            ) : (
              <div className="space-y-2">{checkOuts.map(r => renderMiniCard(r, 'check-out'))}</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Staff Dashboard ────────────────────────────────────────────────────

export function StaffDashboard({ profile, onLogout }: StaffDashboardProps) {
  switch (profile.role) {
    case 'housekeeper':
      return <HousekeeperView profile={profile} onLogout={onLogout} />
    case 'restaurant_staff':
      return <RestaurantStaffView profile={profile} onLogout={onLogout} />
    case 'receptionist':
      return <ReceptionistView profile={profile} onLogout={onLogout} />
    case 'manager':
      return <ManagerView profile={profile} onLogout={onLogout} />
    default:
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-orange-50">
          <Card className="max-w-sm w-full mx-4 border-amber-200/40">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">Rôle non reconnu</p>
              <Button variant="outline" className="mt-4" onClick={onLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </Button>
            </CardContent>
          </Card>
        </div>
      )
  }
}
