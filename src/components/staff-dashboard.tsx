'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Hotel,
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
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
              <SprayCan className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-amber-900">HôtelCI</h1>
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
      <div className="sticky bottom-0 bg-white border-t border-amber-200/50 px-4 py-3">
        <Button
          variant="outline"
          className="w-full h-14 text-base font-medium rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50"
          onClick={onLogout}
        >
          <LogOut className="h-5 w-5 mr-2" />
          Déconnexion
        </Button>
      </div>
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shadow-orange-500/30">
              <UtensilsCrossed className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-amber-900">HôtelCI</h1>
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
      <div className="sticky bottom-0 bg-white border-t border-amber-200/50 px-4 py-3">
        <Button
          variant="outline"
          className="w-full h-14 text-base font-medium rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50"
          onClick={onLogout}
        >
          <LogOut className="h-5 w-5 mr-2" />
          Déconnexion
        </Button>
      </div>
    </div>
  )
}

// ─── Receptionist View ───────────────────────────────────────────────────────

function ReceptionistView({ profile, onLogout }: StaffDashboardProps) {
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
      } else {
        toast.error('Erreur lors du chargement des réservations')
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
      // Check-in the reservation
      const res = await fetch(`/api/owner/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_in' }),
      })

      if (res.ok) {
        // Update room status to occupied
        await fetch(`/api/owner/reservations/room-status/${roomId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'occupied' }),
        })
        toast.success('Check-in effectué avec succès')
        fetchData()
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

  const handleCheckOut = async (reservationId: string, roomId: string) => {
    setActionLoading(reservationId)
    try {
      // Check-out the reservation
      const res = await fetch(`/api/owner/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_out' }),
      })

      if (res.ok) {
        // Update room status to cleaning
        await fetch(`/api/owner/reservations/room-status/${roomId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cleaning' }),
        })
        toast.success('Check-out effectué — Ménage requis')
        fetchData()
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

          {/* Action Button */}
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

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-amber-50 to-orange-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-amber-200/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
              <Hotel className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-amber-900">HôtelCI</h1>
              <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">Réception</p>
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
        {today && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDateFR(today)}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="space-y-6 mt-4">
            <div className="space-y-3">
              <Skeleton className="h-6 w-32" />
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i} className="border-amber-200/40">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Check-ins Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
                  <DoorOpen className="h-4 w-4 text-emerald-600" />
                </div>
                <h2 className="text-base font-bold text-gray-900">
                  Check-ins du jour
                </h2>
                {checkIns.length > 0 && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs">
                    {checkIns.length}
                  </Badge>
                )}
              </div>
              {checkIns.length === 0 ? (
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

            {/* Check-outs Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100">
                  <DoorOpen className="h-4 w-4 text-amber-600" />
                </div>
                <h2 className="text-base font-bold text-gray-900">
                  Check-outs du jour
                </h2>
                {checkOuts.length > 0 && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs">
                    {checkOuts.length}
                  </Badge>
                )}
              </div>
              {checkOuts.length === 0 ? (
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
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-white border-t border-amber-200/50 px-4 py-3">
        <Button
          variant="outline"
          className="w-full h-14 text-base font-medium rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50"
          onClick={onLogout}
        >
          <LogOut className="h-5 w-5 mr-2" />
          Déconnexion
        </Button>
      </div>
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
              <Hotel className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-amber-900">HôtelCI</h1>
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
