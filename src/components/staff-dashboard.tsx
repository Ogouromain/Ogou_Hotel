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
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Package,
  ClipboardCheck,
  LayoutDashboard,
  ShoppingCart,
  Minus,
  X,
  Wallet,
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
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { ReservationsTab } from '@/components/reservations-tab'
import { CustomersTab } from '@/components/customers-tab'
import { WalkInDialog } from '@/components/walk-in-dialog'
import { ExpiredStayAlert, ExpiredStayBadge } from '@/components/expired-stay-alert'
import dynamic from 'next/dynamic'

const InvoicesTab = dynamic(
  () => import('@/components/invoices-tab').then(mod => ({ default: mod.InvoicesTab })),
  { ssr: false, loading: () => <TabLoadingSkeleton /> }
)

const ExpensesTab = dynamic(
  () => import('@/components/expenses-tab').then(mod => ({ default: mod.ExpensesTab })),
  { ssr: false, loading: () => <TabLoadingSkeleton /> }
)

const NotificationPanel = dynamic(
  () => import('@/components/notification-panel').then(mod => ({ default: mod.NotificationPanel })),
  { ssr: false, loading: () => <TabLoadingSkeleton /> }
)

const RestaurantTab = dynamic(
  () => import('@/components/restaurant-tab').then(mod => ({ default: mod.RestaurantTab })),
  { ssr: false, loading: () => <TabLoadingSkeleton /> }
)

const StocksTab = dynamic(
  () => import('@/components/stocks-tab').then(mod => ({ default: mod.StocksTab })),
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

interface ManagerStats {
  rooms: { total: number; available: number; occupied: number; cleaning: number; maintenance: number }
  todayCheckIns: number
  todayCheckOuts: number
  expiredStays: number
  orders: { pending: number; preparing: number; served: number }
  todayRevenue: number
  activeReservations: number
  totalCustomers: number
}

interface MenuItem {
  id: string
  name: string
  category: string
  description: string | null
  price: number
  is_available: boolean
}

interface StockItem {
  id: string
  name: string
  quantity: number
  unit: string
  min_threshold: number
  low_stock: boolean
}

// ─── Tab Types & Navigation ────────────────────────────────────────────────

type ReceptionistTabId = 'overview' | 'rooms' | 'reservations' | 'customers' | 'invoices' | 'notifications'
type RestaurantStaffTabId = 'overview' | 'orders' | 'menu' | 'stocks' | 'notifications'
type HousekeeperTabId = 'overview' | 'to-clean' | 'rooms' | 'notifications'
type ManagerTabId = 'overview' | 'rooms' | 'reservations' | 'customers' | 'invoices' | 'expenses' | 'restaurant' | 'housekeeping' | 'stocks' | 'notifications'

const RECEPTIONIST_NAV_ITEMS: { id: ReceptionistTabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Accueil', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'rooms', label: 'Chambres', icon: <Bed className="h-4 w-4" /> },
  { id: 'reservations', label: 'Réservations', icon: <Calendar className="h-4 w-4" /> },
  { id: 'customers', label: 'Clients', icon: <Users className="h-4 w-4" /> },
  { id: 'invoices', label: 'Factures', icon: <FileText className="h-4 w-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
]

const RESTAURANT_NAV_ITEMS: { id: RestaurantStaffTabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Accueil', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'orders', label: 'Commandes', icon: <Utensils className="h-4 w-4" /> },
  { id: 'menu', label: 'Menu', icon: <UtensilsCrossed className="h-4 w-4" /> },
  { id: 'stocks', label: 'Stocks', icon: <Package className="h-4 w-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
]

const HOUSEKEEPER_NAV_ITEMS: { id: HousekeeperTabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Accueil', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'to-clean', label: 'À nettoyer', icon: <SprayCan className="h-4 w-4" /> },
  { id: 'rooms', label: 'Toutes les chambres', icon: <Bed className="h-4 w-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
]

const MANAGER_NAV_ITEMS: { id: ManagerTabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Accueil', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'rooms', label: 'Chambres', icon: <Bed className="h-4 w-4" /> },
  { id: 'reservations', label: 'Réservations', icon: <Calendar className="h-4 w-4" /> },
  { id: 'customers', label: 'Clients', icon: <Users className="h-4 w-4" /> },
  { id: 'invoices', label: 'Factures', icon: <FileText className="h-4 w-4" /> },
  { id: 'expenses', label: 'Dépenses', icon: <Wallet className="h-4 w-4" /> },
  { id: 'restaurant', label: 'Restaurant', icon: <Utensils className="h-4 w-4" /> },
  { id: 'housekeeping', label: 'Ménage', icon: <SprayCan className="h-4 w-4" /> },
  { id: 'stocks', label: 'Stocks', icon: <Package className="h-4 w-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
]

const MENU_CATEGORIES = [
  { value: 'entree', label: 'Entrée' },
  { value: 'plat_principal', label: 'Plat principal' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'boisson', label: 'Boisson' },
  { value: 'aperitif', label: 'Apéritif' },
  { value: 'autre', label: 'Autre' },
]

const CATEGORY_ICONS: Record<string, string> = {
  entree: '🥗',
  plat_principal: '🍽️',
  dessert: '🍰',
  boisson: '🥤',
  aperitif: '🍸',
  autre: '🍴',
}

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

function getRoomStatusBadge(status: string) {
  switch (status) {
    case 'available': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs">Disponible</Badge>
    case 'occupied': return <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100 text-xs">Occupée</Badge>
    case 'cleaning': return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs">Nettoyage</Badge>
    case 'maintenance': return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs">Maintenance</Badge>
    default: return <Badge variant="secondary" className="text-xs">{status}</Badge>
  }
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

// ─── Restaurant Staff View (Enhanced Sidebar) ──────────────────────────────────

function RestaurantStaffView({ profile, onLogout }: StaffDashboardProps) {
  const [activeTab, setActiveTab] = useState<RestaurantStaffTabId>('overview')
  const [orders, setOrders] = useState<OrderInfo[]>([])
  const [stats, setStats] = useState<RestaurantStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<'pending' | 'preparing' | 'served'>('pending')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [menuLoading, setMenuLoading] = useState(true)
  const [menuSearch, setMenuSearch] = useState('')
  const [menuToggleLoading, setMenuToggleLoading] = useState<string | null>(null)

  // Stock state
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [stockLoading, setStockLoading] = useState(true)
  const [stockAlerts, setStockAlerts] = useState<StockItem[]>([])

  // Create order state
  const [createOrderOpen, setCreateOrderOpen] = useState(false)
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [orderItems, setOrderItems] = useState<{ menuItemId: string; name: string; price: number; quantity: number }[]>([])
  const [orderTableNumber, setOrderTableNumber] = useState('')
  const [orderType, setOrderType] = useState<'table' | 'room'>('table')
  const [orderSearch, setOrderSearch] = useState('')

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

  const fetchMenu = useCallback(async () => {
    setMenuLoading(true)
    try {
      const res = await fetch('/api/owner/restaurant/menu')
      if (res.ok) {
        const data = await res.json()
        setMenuItems(data.items || data.menu || [])
      }
    } catch {
      toast.error('Erreur lors du chargement du menu')
    } finally {
      setMenuLoading(false)
    }
  }, [])

  const fetchStocks = useCallback(async () => {
    setStockLoading(true)
    try {
      const [itemsRes, alertsRes] = await Promise.all([
        fetch('/api/owner/stocks/items'),
        fetch('/api/owner/stocks/alerts'),
      ])
      if (itemsRes.ok) {
        const data = await itemsRes.json()
        setStockItems(data.items || [])
      }
      if (alertsRes.ok) {
        const data = await alertsRes.json()
        setStockAlerts(data.alerts || [])
      }
    } catch {
      // Silently fail - stock is not critical for restaurant staff
    } finally {
      setStockLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    fetchMenu()
    fetchStocks()
  }, [fetchData, fetchMenu, fetchStocks])

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
        toast.error(data.error || 'Erreur lors de la mise à jour')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleAvailability = async (menuItemId: string, currentAvailability: boolean) => {
    setMenuToggleLoading(menuItemId)
    try {
      const res = await fetch(`/api/staff/menu/${menuItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: !currentAvailability }),
      })
      if (res.ok) {
        toast.success(!currentAvailability ? 'Article marqué disponible' : 'Article marqué indisponible')
        fetchMenu()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setMenuToggleLoading(null)
    }
  }

  const handleCreateOrder = async () => {
    if (orderItems.length === 0) return
    setCreatingOrder(true)
    try {
      const res = await fetch('/api/owner/restaurant/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: orderType === 'table' ? orderTableNumber : null,
          room_id: null,
          items: orderItems.map(item => ({
            item_name: item.name,
            quantity: item.quantity,
            unit_price: item.price,
          })),
        }),
      })
      if (res.ok) {
        toast.success('Commande créée avec succès')
        setCreateOrderOpen(false)
        setOrderItems([])
        setOrderTableNumber('')
        setOrderSearch('')
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la création')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setCreatingOrder(false)
    }
  }

  const addOrderItem = (menuItem: MenuItem) => {
    setOrderItems(prev => {
      const existing = prev.find(i => i.menuItemId === menuItem.id)
      if (existing) {
        return prev.map(i => i.menuItemId === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { menuItemId: menuItem.id, name: menuItem.name, price: menuItem.price, quantity: 1 }]
    })
  }

  const updateOrderItemQuantity = (menuItemId: string, qty: number) => {
    if (qty <= 0) {
      setOrderItems(prev => prev.filter(i => i.menuItemId !== menuItemId))
    } else {
      setOrderItems(prev => prev.map(i => i.menuItemId === menuItemId ? { ...i, quantity: qty } : i))
    }
  }

  const getOrderTotal = () => orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0)

  const fetchAllDataForRefresh = useCallback(async () => {
    await Promise.all([fetchData(), fetchMenu(), fetchStocks()])
  }, [fetchData, fetchMenu, fetchStocks])

  const filteredOrders = orders.filter(o => o.status === activeFilter)

  const filterConfig = [
    { key: 'pending' as const, label: 'En attente', icon: <Clock className="h-4 w-4" />, count: stats?.pending ?? 0, color: 'bg-amber-100 text-amber-800' },
    { key: 'preparing' as const, label: 'En préparation', icon: <Utensils className="h-4 w-4" />, count: stats?.preparing ?? 0, color: 'bg-orange-100 text-orange-800' },
    { key: 'served' as const, label: 'Servies', icon: <CheckCircle2 className="h-4 w-4" />, count: stats?.served ?? 0, color: 'bg-emerald-100 text-emerald-800' },
  ]

  const dailyRevenue = orders.filter(o => o.status === 'served').reduce((sum, o) => sum + o.total_amount, 0)

  const groupedMenu = MENU_CATEGORIES.map(cat => ({
    ...cat,
    items: menuItems.filter(i => i.category === cat.value),
  })).filter(g => g.items.length > 0)

  const filteredMenuItems = menuSearch
    ? menuItems.filter(i => i.name.toLowerCase().includes(menuSearch.toLowerCase()))
    : menuItems

  const filteredGroupedMenu = menuSearch
    ? [{ value: 'search', label: `Résultats (${filteredMenuItems.length})`, items: filteredMenuItems }]
    : groupedMenu

  const availableMenuCount = menuItems.filter(i => i.is_available).length
  const unavailableMenuCount = menuItems.filter(i => !i.is_available).length

  // Available menu items for order creation
  const availableMenuForOrder = menuItems.filter(i => i.is_available)
  const groupedMenuForOrder = MENU_CATEGORIES.map(cat => ({
    ...cat,
    items: availableMenuForOrder.filter(i => i.category === cat.value),
  })).filter(g => g.items.length > 0)
  const filteredMenuForOrder = orderSearch
    ? availableMenuForOrder.filter(i => i.name.toLowerCase().includes(orderSearch.toLowerCase()))
    : []
  const groupedMenuForOrderFiltered = orderSearch
    ? [{ value: 'search', label: `Résultats (${filteredMenuForOrder.length})`, items: filteredMenuForOrder }]
    : groupedMenuForOrder

  // Sidebar
  const sidebarContent = (
    <div className="flex h-full flex-col bg-gradient-to-b from-orange-50 to-amber-50">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-orange-200/50">
        <Image src="/logo.svg" alt="OGOU_Hôtel" height={36} width={36} className="object-contain" />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">OGOU_Hôtel</h1>
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-wider text-orange-600 font-semibold">Restaurant</p>
            <div className="flex h-2 w-2 rounded-full bg-orange-500" />
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {RESTAURANT_NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-orange-100 text-orange-900 shadow-sm'
                  : 'text-orange-800/70 hover:bg-orange-100/50 hover:text-orange-900'
              }`}
            >
              {item.icon}
              <span className="truncate flex-1">{item.label}</span>
              {item.id === 'overview' && <ExpiredStayBadge />}
              {item.id === 'stocks' && stockAlerts.length > 0 && (
                <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] h-5 px-1.5">{stockAlerts.length}</Badge>
              )}
            </button>
          )
        })}
      </nav>
      <div className="px-4 py-2 border-t border-orange-200/50">
        <a href="https://wa.me/2250576103277" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors w-full">
          <MessageSquare className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="truncate">Support WhatsApp</span>
        </a>
        <a href="mailto:omouitsi@gmail.com" className="flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2.5 text-sm font-medium text-orange-700 hover:bg-orange-100 transition-colors w-full mt-2">
          <Mail className="h-4 w-4 text-orange-600 shrink-0" />
          <span className="truncate">Email</span>
        </a>
      </div>
      <div className="border-t border-orange-200/50 px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-200 text-orange-800 text-xs font-bold shrink-0">
            {profile.first_name.charAt(0)}{profile.last_name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-orange-900 truncate">{profile.first_name} {profile.last_name}</p>
            <p className="text-xs text-orange-600 flex items-center gap-1">
              <Shield className="h-3 w-3" />Restaurant
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full border-orange-200 text-orange-700 hover:bg-orange-100 hover:text-orange-900" onClick={onLogout}>
          <LogOut className="h-4 w-4 mr-2" />Déconnexion
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <aside className="hidden lg:flex w-64 flex-col border-r border-orange-200/50 shrink-0">
        {sidebarContent}
      </aside>

      <main className="flex-1 min-w-0">
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b bg-white">
          <div className="flex items-center gap-2">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Image src="/logo.svg" alt="OGOU_Hôtel" height={20} width={20} className="object-contain" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetHeader className="sr-only"><SheetTitle>Navigation</SheetTitle></SheetHeader>
                {sidebarContent}
              </SheetContent>
            </Sheet>
            <span className="font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">OGOU_Hôtel</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout}><LogOut className="h-4 w-4" /></Button>
        </div>

        <div className="lg:hidden flex overflow-x-auto gap-1 px-4 py-2 border-b bg-white">
          {RESTAURANT_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === item.id ? 'bg-orange-100 text-orange-900' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {item.icon}{item.label}
              {item.id === 'overview' && <ExpiredStayBadge />}
              {item.id === 'stocks' && stockAlerts.length > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[9px]">{stockAlerts.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          {/* ── Overview Tab ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-900">Bonjour, {profile.first_name} 👋</h2>
                    <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100 text-xs animate-pulse">
                      <div className="h-2 w-2 rounded-full bg-orange-500 mr-1.5" />En service
                    </Badge>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => { fetchData(); fetchMenu(); fetchStocks() }} disabled={loading} className="border-orange-200 text-orange-700 hover:bg-orange-50">
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Actualiser
                </Button>
              </div>

              <ExpiredStayAlert onCheckOut={async () => {}} onNavigateToReservations={() => {}} />

              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-amber-200/50 bg-gradient-to-br from-amber-50 to-amber-100/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('orders')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between"><Clock className="h-8 w-8 text-amber-600" /><span className="text-3xl font-bold text-amber-700">{stats?.pending ?? 0}</span></div>
                    <p className="text-sm font-medium text-amber-800 mt-2">En attente</p>
                  </CardContent>
                </Card>
                <Card className="border-orange-200/50 bg-gradient-to-br from-orange-50 to-orange-100/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('orders')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between"><Utensils className="h-8 w-8 text-orange-600" /><span className="text-3xl font-bold text-orange-700">{stats?.preparing ?? 0}</span></div>
                    <p className="text-sm font-medium text-orange-800 mt-2">En préparation</p>
                  </CardContent>
                </Card>
                <Card className="border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-emerald-100/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('orders')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between"><CheckCircle2 className="h-8 w-8 text-emerald-600" /><span className="text-3xl font-bold text-emerald-700">{stats?.served ?? 0}</span></div>
                    <p className="text-sm font-medium text-emerald-800 mt-2">Servies</p>
                  </CardContent>
                </Card>
                <Card className="border-green-200/50 bg-gradient-to-br from-green-50 to-green-100/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between"><DollarSign className="h-8 w-8 text-green-600" /><span className="text-xl font-bold text-green-700">{formatFCFA(dailyRevenue)}</span></div>
                    <p className="text-sm font-medium text-green-800 mt-2">Revenu du jour</p>
                  </CardContent>
                </Card>
              </div>

              {/* Second row: Stock alerts + Menu availability */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className={`border-2 cursor-pointer hover:shadow-md transition-shadow ${stockAlerts.length > 0 ? 'border-red-200 bg-gradient-to-br from-red-50 to-red-100/50' : 'border-gray-200 bg-gradient-to-br from-gray-50 to-white'}`} onClick={() => setActiveTab('stocks')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Package className={`h-8 w-8 ${stockAlerts.length > 0 ? 'text-red-600' : 'text-gray-400'}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-700">Alertes stock</p>
                          <p className="text-2xl font-bold text-gray-900">{stockAlerts.length}</p>
                        </div>
                      </div>
                      {stockAlerts.length > 0 && <AlertTriangle className="h-6 w-6 text-red-500 animate-pulse" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {stockAlerts.length > 0 ? `${stockAlerts.length} article(s) en stock faible` : 'Tous les stocks sont OK'}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('menu')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <UtensilsCrossed className="h-8 w-8 text-orange-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">Menu</p>
                          <p className="text-2xl font-bold text-gray-900">{availableMenuCount}<span className="text-sm font-normal text-muted-foreground">/{menuItems.length}</span></p>
                        </div>
                      </div>
                      {unavailableMenuCount > 0 && <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-[10px]">{unavailableMenuCount} indispo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Articles disponibles</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-3">Actions rapides</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card className="border-orange-200/40 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setCreateOrderOpen(true)}>
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <Plus className="h-6 w-6 text-orange-600" />
                      <span className="text-sm font-medium text-orange-900">Nouvelle commande</span>
                    </CardContent>
                  </Card>
                  <Card className="border-amber-200/40 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('orders')}>
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <Utensils className="h-6 w-6 text-amber-600" />
                      <span className="text-sm font-medium text-amber-900">Voir commandes</span>
                    </CardContent>
                  </Card>
                  <Card className="border-emerald-200/40 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('stocks')}>
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <Package className="h-6 w-6 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-900">Voir les stocks</span>
                    </CardContent>
                  </Card>
                  <Card className="border-sky-200/40 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('notifications')}>
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <Bell className="h-6 w-6 text-sky-600" />
                      <span className="text-sm font-medium text-sky-900">Notifications</span>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* ── Orders Tab ── */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Commandes</h2>
                <div className="flex gap-2">
                  <Button className="bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-600/20" onClick={() => setCreateOrderOpen(true)}>
                    <Plus className="h-4 w-4 mr-1.5" />Nouvelle
                  </Button>
                  <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="border-orange-200 text-orange-700 hover:bg-orange-50">
                    <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Actualiser
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {filterConfig.map((filter) => (
                  <button key={filter.key} onClick={() => setActiveFilter(filter.key)} className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition-all ${activeFilter === filter.key ? filter.color + ' shadow-sm' : 'bg-white/60 text-gray-500 border border-gray-200'}`}>
                    {filter.icon}{filter.label}
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${activeFilter === filter.key ? 'bg-white/60' : 'bg-gray-100'}`}>{filter.count}</span>
                  </button>
                ))}
              </div>

              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="border-orange-200/40"><CardContent className="p-4"><div className="space-y-3"><div className="flex justify-between"><Skeleton className="h-5 w-16" /><Skeleton className="h-5 w-24" /></div><Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-32" /><Skeleton className="h-12 w-full" /></div></CardContent></Card>
                ))
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-500 mb-4"><UtensilsCrossed className="h-8 w-8" /></div>
                  <h3 className="text-lg font-semibold text-gray-800">Aucune commande</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activeFilter === 'pending' ? "Aucune commande en attente" : activeFilter === 'preparing' ? "Aucune commande en préparation" : "Aucune commande servie"}
                  </p>
                  <Button className="mt-4 bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setCreateOrderOpen(true)}>
                    <Plus className="h-4 w-4 mr-1.5" />Créer une commande
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredOrders.map((order) => (
                    <Card key={order.id} className="border-orange-200/40 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-gray-900">{getShortOrderId(order.id)}</span>
                              {order.status === 'pending' && <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs">En attente</Badge>}
                              {order.status === 'preparing' && <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100 text-xs">En préparation</Badge>}
                              {order.status === 'served' && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs">Servie</Badge>}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                              {order.room_id ? (<><Bed className="h-3.5 w-3.5" /><span>Chambre</span></>) : (<><Utensils className="h-3.5 w-3.5" /><span>Table {order.table_number || '—'}</span></>)}
                              <span className="mx-1">•</span><Clock className="h-3.5 w-3.5" /><span>{formatTimeAgo(order.created_at)}</span>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-orange-300" />
                        </div>
                        {order.restaurant_order_items && order.restaurant_order_items.length > 0 && (
                          <div className="bg-orange-50/50 rounded-lg p-3 mb-3">
                            <div className="space-y-1.5">
                              {order.restaurant_order_items.map((item) => (
                                <div key={item.id} className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-200/60 text-orange-800 text-xs font-bold">{item.quantity}</span>
                                    <span className="text-gray-700">{item.item_name}</span>
                                  </div>
                                  <span className="text-muted-foreground">{formatFCFA(item.unit_price * item.quantity)}</span>
                                </div>
                              ))}
                            </div>
                            <Separator className="my-2" />
                            <div className="flex items-center justify-between text-sm font-semibold">
                              <span>Total</span><span className="text-orange-800">{formatFCFA(order.total_amount)}</span>
                            </div>
                          </div>
                        )}
                        {order.status === 'pending' && (
                          <Button className="w-full h-12 text-base font-medium rounded-xl bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-600/20" onClick={() => handleOrderStatus(order.id, 'preparing')} disabled={actionLoading === order.id}>
                            {actionLoading === order.id ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <span className="mr-2">🔥</span>}Préparer
                          </Button>
                        )}
                        {order.status === 'preparing' && (
                          <Button className="w-full h-12 text-base font-medium rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20" onClick={() => handleOrderStatus(order.id, 'served')} disabled={actionLoading === order.id}>
                            {actionLoading === order.id ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}Servir
                          </Button>
                        )}
                        {order.status === 'served' && (
                          <div className="flex items-center justify-center gap-2 text-emerald-600 py-1"><CheckCircle2 className="h-5 w-5" /><span className="text-sm font-medium">Commande servie</span></div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Menu Tab (Read-Only + Availability Toggle) ── */}
          {activeTab === 'menu' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Menu</h2>
                <Button variant="outline" size="sm" onClick={fetchMenu} disabled={menuLoading} className="border-orange-200 text-orange-700 hover:bg-orange-50">
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${menuLoading ? 'animate-spin' : ''}`} />Actualiser
                </Button>
              </div>

              {unavailableMenuCount > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-800">{unavailableMenuCount} article(s) actuellement indisponible(s). Vous pouvez modifier la disponibilité avec le commutateur.</p>
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher un plat..." value={menuSearch} onChange={(e) => setMenuSearch(e.target.value)} className="pl-9 border-orange-200 focus:border-orange-400" />
              </div>

              {menuLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-36 w-full" />))}</div>
              ) : menuItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-500 mb-4"><UtensilsCrossed className="h-8 w-8" /></div>
                  <h3 className="text-lg font-semibold text-gray-800">Aucun article au menu</h3>
                  <p className="text-sm text-muted-foreground mt-1">Le menu sera géré par le propriétaire</p>
                </div>
              ) : (
                filteredGroupedMenu.map((group) => (
                  <div key={group.value}>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      {CATEGORY_ICONS[group.value] || '🍴'} {group.label}
                      <Badge variant="secondary" className="text-[10px]">{group.items.length}</Badge>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {group.items.map((item) => (
                        <Card key={item.id} className={`border-orange-200/60 transition-all hover:shadow-md ${!item.is_available ? 'opacity-60' : ''}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm truncate">{item.name}</h4>
                                {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>}
                              </div>
                              <Badge className={`ml-2 shrink-0 text-[10px] ${
                                item.category === 'entree' ? 'bg-green-100 text-green-700 border-green-200' :
                                item.category === 'plat_principal' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                item.category === 'dessert' ? 'bg-pink-100 text-pink-700 border-pink-200' :
                                item.category === 'boisson' ? 'bg-sky-100 text-sky-700 border-sky-200' :
                                item.category === 'aperitif' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                'bg-gray-100 text-gray-700 border-gray-200'
                              }`}>
                                {CATEGORY_ICONS[item.category] || '🍴'} {MENU_CATEGORIES.find(c => c.value === item.category)?.label || item.category}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between mt-3">
                              <span className="font-bold text-orange-700 text-sm">{formatFCFA(item.price)}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{item.is_available ? 'Dispo' : 'Indispo'}</span>
                                <Switch
                                  checked={item.is_available}
                                  onCheckedChange={() => handleToggleAvailability(item.id, item.is_available)}
                                  disabled={menuToggleLoading === item.id}
                                  className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-gray-300"
                                />
                                {menuToggleLoading === item.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" />}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Stocks Tab (Read-Only) ── */}
          {activeTab === 'stocks' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Stocks</h2>
                <Button variant="outline" size="sm" onClick={fetchStocks} disabled={stockLoading} className="border-orange-200 text-orange-700 hover:bg-orange-50">
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${stockLoading ? 'animate-spin' : ''}`} />Actualiser
                </Button>
              </div>

              {stockAlerts.length > 0 && (
                <div className="rounded-xl bg-red-50 border-2 border-red-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <h3 className="text-sm font-bold text-red-800">Alertes stock faible ({stockAlerts.length})</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {stockAlerts.map((alert) => (
                      <div key={alert.id} className="flex items-center justify-between rounded-lg bg-white border border-red-200 px-3 py-2">
                        <span className="text-sm font-medium text-red-900">{alert.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-red-600">{alert.quantity} {alert.unit}</span>
                          <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Seuil: {alert.min_threshold}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-red-600 mt-2">Contactez le propriétaire ou le manager pour réapprovisionner.</p>
                </div>
              )}

              {stockLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-24 w-full" />))}</div>
              ) : stockItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400 mb-4"><Package className="h-8 w-8" /></div>
                  <h3 className="text-lg font-semibold text-gray-800">Aucun article en stock</h3>
                  <p className="text-sm text-muted-foreground mt-1">Les stocks sont gérés par le propriétaire</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {stockItems.map((item) => (
                    <Card key={item.id} className={`border-2 transition-all ${item.low_stock ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-white'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm text-gray-900">{item.name}</span>
                          {item.low_stock ? (
                            <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Faible</Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">OK</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-2xl font-bold text-gray-900">{item.quantity}</span>
                            <span className="text-sm text-muted-foreground ml-1">{item.unit}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Seuil minimum</p>
                            <p className="text-sm font-medium text-gray-700">{item.min_threshold} {item.unit}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Notifications Tab ── */}
          {activeTab === 'notifications' && <NotificationPanel onRefresh={fetchAllDataForRefresh} />}
        </div>
      </main>

      {/* Create Order Dialog */}
      <Dialog open={createOrderOpen} onOpenChange={setCreateOrderOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-orange-600" />Nouvelle commande</DialogTitle>
            <DialogDescription>Ajoutez des articles du menu et validez la commande.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Order type */}
            <div className="flex gap-2">
              <Button variant={orderType === 'table' ? 'default' : 'outline'} size="sm" className={orderType === 'table' ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'border-orange-200 text-orange-700'} onClick={() => setOrderType('table')}>
                                Table
              </Button>
              <Button variant={orderType === 'room' ? 'default' : 'outline'} size="sm" className={orderType === 'room' ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'border-orange-200 text-orange-700'} onClick={() => setOrderType('room')}>
                                Chambre
              </Button>
            </div>
            {orderType === 'table' ? (
              <Input placeholder="Numéro de table" value={orderTableNumber} onChange={(e) => setOrderTableNumber(e.target.value)} className="border-orange-200" />
            ) : (
              <Input placeholder="Numéro de chambre" value={orderTableNumber} onChange={(e) => setOrderTableNumber(e.target.value)} className="border-orange-200" />
            )}

            {/* Search menu items */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher un plat..." value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} className="pl-9 border-orange-200" />
            </div>

            {/* Menu items for selection */}
            <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2 bg-gray-50">
              {(orderSearch ? filteredMenuForOrder : groupedMenuForOrder).length === 0 || (orderSearch && filteredMenuForOrder.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun article disponible</p>
              ) : (orderSearch ? [{ value: 'search', label: 'Résultats', items: filteredMenuForOrder }] : groupedMenuForOrder).map(group => (
                <div key={group.value}>
                  {!orderSearch && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">{CATEGORY_ICONS[group.value] || '🍴'} {group.label}</p>}
                  {group.items.map(item => {
                    const inOrder = orderItems.find(o => o.menuItemId === item.id)
                    return (
                      <button key={item.id} onClick={() => addOrderItem(item)} className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-orange-50 transition-colors">
                        <div className="flex-1 text-left">
                          <span className="font-medium text-gray-900">{item.name}</span>
                          <span className="ml-2 text-muted-foreground">{formatFCFA(item.price)}</span>
                        </div>
                        {inOrder && <Badge className="bg-orange-100 text-orange-700 text-[10px]">x{inOrder.quantity}</Badge>}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Current order items */}
            {orderItems.length > 0 && (
              <div className="space-y-2 border rounded-lg p-3 bg-orange-50/50">
                <p className="text-sm font-semibold text-orange-800">Commande</p>
                {orderItems.map(item => (
                  <div key={item.menuItemId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-7 w-7 border-orange-200" onClick={() => updateOrderItemQuantity(item.menuItemId, item.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                      <span className="text-sm font-bold text-orange-800 min-w-[24px] text-center">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7 border-orange-200" onClick={() => updateOrderItemQuantity(item.menuItemId, item.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                      <span className="text-sm text-gray-700">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-orange-800">{formatFCFA(item.price * item.quantity)}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => updateOrderItemQuantity(item.menuItemId, 0)}><X className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>Total</span>
                  <span className="text-orange-800">{formatFCFA(getOrderTotal())}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOrderOpen(false)}>Annuler</Button>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white shadow-md" disabled={creatingOrder || orderItems.length === 0} onClick={handleCreateOrder}>
              {creatingOrder ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Création...</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Créer ({formatFCFA(getOrderTotal())})</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Housekeeper View (Enhanced Sidebar) ──────────────────────────────────────

function HousekeeperView({ profile, onLogout }: StaffDashboardProps) {
  const [activeTab, setActiveTab] = useState<HousekeeperTabId>('overview')
  const [rooms, setRooms] = useState<RoomInfo[]>([])
  const [stats, setStats] = useState<HousekeepingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [roomFilter, setRoomFilter] = useState<string>('all')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [secondsSinceRefresh, setSecondsSinceRefresh] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/staff/housekeeping')
      if (res.ok) {
        const data = await res.json()
        setRooms(data.rooms || [])
        setStats(data.stats || null)
        setLastRefresh(new Date())
        setSecondsSinceRefresh(0)
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

  // Auto-refresh every 30 seconds to catch new cleaning tasks
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Countdown timer for "last updated" display
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsSinceRefresh(prev => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleRoomStatus = async (roomId: string, newStatus: string, roomNumber: string) => {
    setActionLoading(roomId)
    try {
      const res = await fetch(`/api/staff/room-status/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const statusLabel = newStatus === 'available' ? 'propre ✅' : 'problème détecté 🔧'
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

  const filteredRooms = rooms.filter(r => roomFilter === 'all' || r.status === roomFilter)
  const priorityRooms = rooms.filter(r => r.status === 'cleaning')
  const cleaningRooms = rooms.filter(r => r.status === 'cleaning')
  const maintenanceRooms = rooms.filter(r => r.status === 'maintenance')

  const sidebarContent = (
    <div className="flex h-full flex-col bg-gradient-to-b from-emerald-50 to-green-50">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-emerald-200/50">
        <Image src="/logo.svg" alt="OGOU_Hôtel" height={36} width={36} className="object-contain" />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent">OGOU_Hôtel</h1>
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">Ménage</p>
            <div className="flex h-2 w-2 rounded-full bg-emerald-500" />
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {HOUSEKEEPER_NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-emerald-100 text-emerald-900 shadow-sm'
                  : 'text-emerald-800/70 hover:bg-emerald-100/50 hover:text-emerald-900'
              }`}
            >
              {item.icon}
              <span className="truncate flex-1">{item.label}</span>
              {item.id === 'to-clean' && (stats?.cleaning ?? 0) > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shrink-0">
                  {stats?.cleaning ?? 0}
                </span>
              )}
              {item.id === 'overview' && <ExpiredStayBadge />}
            </button>
          )
        })}
      </nav>
      <div className="px-4 py-2 border-t border-emerald-200/50">
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
      <div className="border-t border-emerald-200/50 px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-200 text-emerald-800 text-xs font-bold shrink-0">
            {profile.first_name.charAt(0)}{profile.last_name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-emerald-900 truncate">{profile.first_name} {profile.last_name}</p>
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Ménage
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900"
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
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-emerald-200/50 shrink-0">
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b bg-white">
          <div className="flex items-center gap-2">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Image src="/logo.svg" alt="OGOU_Hôtel" height={20} width={20} className="object-contain" />
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
          {HOUSEKEEPER_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === item.id
                  ? 'bg-emerald-100 text-emerald-900'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {item.icon}
              {item.label}
              {item.id === 'to-clean' && (stats?.cleaning ?? 0) > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                  {stats?.cleaning ?? 0}
                </span>
              )}
              {item.id === 'overview' && <ExpiredStayBadge />}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-900">Bonjour, {profile.first_name} 👋</h2>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs animate-pulse">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5" />
                      En service
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {lastRefresh && (
                    <span className="text-xs text-gray-400">
                      Mise à jour il y a {secondsSinceRefresh}s
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchData}
                    disabled={loading}
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                    Actualiser
                  </Button>
                </div>
              </div>

              <ExpiredStayAlert
                onCheckOut={async () => {}}
                onNavigateToReservations={() => {}}
              />

              {/* Prominent cleaning alert banner */}
              {(stats?.cleaning ?? 0) > 0 && (
                <div
                  className="rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-50 via-amber-100 to-orange-50 p-5 shadow-lg shadow-amber-200/30 cursor-pointer hover:shadow-xl transition-shadow animate-pulse-subtle"
                  onClick={() => { setActiveTab('to-clean') }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md">
                        <SprayCan className="h-7 w-7" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-amber-900">
                          🔔 {stats?.cleaning} chambre{(stats?.cleaning ?? 0) > 1 ? 's' : ''} à nettoyer !
                        </h3>
                        <p className="text-sm text-amber-700 mt-0.5">
                          Des clients sont partis — nettoyage requis immédiatement
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-amber-700">
                      <span className="text-sm font-semibold hidden sm:inline">Voir les chambres</span>
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-amber-200/50 bg-gradient-to-br from-amber-50 to-amber-100/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveTab('to-clean') }}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">🧹</span>
                      <span className="text-3xl font-bold text-amber-700">{stats?.cleaning ?? 0}</span>
                    </div>
                    <p className="text-sm font-medium text-amber-800 mt-2">À nettoyer</p>
                  </CardContent>
                </Card>
                <Card className="border-red-200/50 bg-gradient-to-br from-red-50 to-red-100/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">🔧</span>
                      <span className="text-3xl font-bold text-red-700">{stats?.maintenance ?? 0}</span>
                    </div>
                    <p className="text-sm font-medium text-red-800 mt-2">En maintenance</p>
                  </CardContent>
                </Card>
                <Card className="border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-emerald-100/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">✅</span>
                      <span className="text-3xl font-bold text-emerald-700">{stats?.available ?? 0}</span>
                    </div>
                    <p className="text-sm font-medium text-emerald-800 mt-2">Propres</p>
                  </CardContent>
                </Card>
                <Card className="border-sky-200/50 bg-gradient-to-br from-sky-50 to-sky-100/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">🛏️</span>
                      <span className="text-3xl font-bold text-sky-700">{stats?.occupied ?? 0}</span>
                    </div>
                    <p className="text-sm font-medium text-sky-800 mt-2">Occupées</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-3">Actions rapides</h3>
                <div className={`grid ${(stats?.cleaning ?? 0) > 0 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'} gap-3`}>
                  {(stats?.cleaning ?? 0) > 0 && (
                    <Card className="border-amber-300/60 bg-gradient-to-br from-amber-50 to-orange-50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveTab('to-clean') }}>
                      <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                        <SprayCan className="h-7 w-7 text-amber-600" />
                        <span className="text-sm font-bold text-amber-900">Chambres à nettoyer</span>
                        <Badge className="bg-amber-200 text-amber-800 border-amber-300 text-xs">{stats?.cleaning} en attente</Badge>
                      </CardContent>
                    </Card>
                  )}
                  <Card className="border-emerald-200/40 cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveTab('rooms'); setRoomFilter('all') }}>
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <Bed className="h-6 w-6 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-900">Toutes les chambres</span>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* ═══ À nettoyer Tab (DEDICATED CLEANING TAB) ═══ */}
          {activeTab === 'to-clean' && (
            <div className="space-y-6">
              {/* Workflow explanation banner */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-600 flex items-start gap-2">
                  <SprayCan className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-gray-700">Workflow :</strong> Quand un client libère une chambre, elle apparaît ici pour nettoyage.
                    Les chambres en maintenance nécessitent d&apos;abord une réparation par le manager avant que vous puissiez les nettoyer.
                  </span>
                </p>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <SprayCan className="h-6 w-6 text-amber-600" />
                    À nettoyer
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Chambres nécessitant un nettoyage après le départ d&apos;un client ou après une réparation
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {lastRefresh && (
                    <span className="text-xs text-gray-400">
                      Mise à jour il y a {secondsSinceRefresh}s
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchData}
                    disabled={loading}
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                    Actualiser
                  </Button>
                </div>
              </div>

              {/* Cleaning count summary */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-xl bg-amber-100 border border-amber-300 px-4 py-2.5">
                  <SprayCan className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-lg font-bold text-amber-800">{cleaningRooms.length}</p>
                    <p className="text-xs text-amber-600">Chambre{cleaningRooms.length > 1 ? 's' : ''} à nettoyer</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-red-100 border border-red-300 px-4 py-2.5">
                  <Wrench className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-lg font-bold text-red-800">{maintenanceRooms.length}</p>
                    <p className="text-xs text-red-600">En maintenance</p>
                  </div>
                </div>
              </div>

              {/* ━━━ NETTOYAGE REQUIS Section ━━━ */}
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}><CardContent className="p-5"><Skeleton className="h-40 w-full" /></CardContent></Card>
                  ))}
                </div>
              ) : cleaningRooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-500 mb-4">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <h3 className="text-xl font-bold text-emerald-800">Tout est propre ! 🎉</h3>
                  <p className="text-sm text-emerald-600 mt-2 max-w-md">
                    Aucune chambre ne nécessite de nettoyage pour le moment.
                    Vous serez notifié dès qu&apos;un client libère une chambre.
                  </p>
                </div>
              ) : (
                <div>
                  {/* Section header: NETTOYAGE REQUIS */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-amber-400" />
                    <div className="flex items-center gap-2 rounded-lg bg-amber-100 border border-amber-300 px-4 py-1.5">
                      <SprayCan className="h-4 w-4 text-amber-600" />
                      <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider">
                        NETTOYAGE REQUIS
                      </h3>
                      <Badge className="bg-amber-500 text-white border-0 text-[10px] px-1.5 py-0 h-5 min-w-[20px] flex items-center justify-center">
                        {cleaningRooms.length}
                      </Badge>
                    </div>
                    <div className="flex-1 h-px bg-amber-400" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cleaningRooms.map((room) => (
                      <Card key={room.id} id={`room-${room.id}`} className="border-2 border-amber-400 bg-gradient-to-b from-amber-50 to-white ring-2 ring-amber-200/50 transition-all hover:shadow-lg shadow-amber-100/50">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xl font-bold text-amber-900">
                              Chambre {room.room_number}
                            </h3>
                            <Badge className="bg-amber-200 text-amber-800 border-amber-300 text-xs animate-pulse">🧹 À nettoyer</Badge>
                          </div>
                          <p className="text-sm text-amber-700 font-medium mb-1">
                            Client parti — nettoyage requis
                          </p>
                          <p className="text-xs text-gray-500 mb-4">{room.room_type} — {formatFCFA(room.price_per_night)}/nuit</p>
                          <div className="space-y-2 pt-3 border-t border-amber-200">
                            <Button
                              className="w-full h-12 text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                              onClick={() => handleRoomStatus(room.id, 'available', room.room_number)}
                              disabled={actionLoading === room.id}
                            >
                              {actionLoading === room.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                              ✅ Chambre propre — Valider
                            </Button>
                            <Button
                              variant="outline"
                              className="w-full h-10 text-xs font-medium rounded-xl border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400"
                              onClick={() => handleRoomStatus(room.id, 'maintenance', room.room_number)}
                              disabled={actionLoading === room.id}
                            >
                              <Wrench className="h-3.5 w-3.5 mr-1.5" />
                              🔧 Problème détecté — Signaler
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* ━━━ EN ATTENTE DE RÉPARATION Section ━━━ */}
              {maintenanceRooms.length > 0 && (
                <div>
                  {/* Visual separator between sections */}
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-red-300" />
                    <div className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-300 px-4 py-1.5">
                      <Wrench className="h-4 w-4 text-red-600" />
                      <h3 className="text-sm font-bold text-red-900 uppercase tracking-wider">
                        EN ATTENTE DE RÉPARATION
                      </h3>
                      <Badge className="bg-red-500 text-white border-0 text-[10px] px-1.5 py-0 h-5 min-w-[20px] flex items-center justify-center">
                        {maintenanceRooms.length}
                      </Badge>
                    </div>
                    <div className="flex-1 h-px bg-red-300" />
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 mb-4">
                    <p className="text-xs text-red-700 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>Attention :</strong> Ces chambres sont en cours de réparation. Vous ne pouvez pas les nettoyer pour le moment.
                        Le manager ou le réceptionniste doit marquer la réparation comme terminée pour que la chambre passe en &quot;À nettoyer&quot;.
                      </span>
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {maintenanceRooms.map((room) => (
                      <Card key={room.id} className="border-2 border-red-300 bg-gradient-to-b from-red-50 to-white opacity-80">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-bold text-red-900">
                              Chambre {room.room_number}
                            </h3>
                            <Badge className="bg-red-200 text-red-800 border-red-300 text-xs">🔧 Maintenance</Badge>
                          </div>
                          <p className="text-sm text-red-700 font-medium mb-1">
                            Réparation en cours
                          </p>
                          <p className="text-xs text-gray-500 mb-3">{room.room_type}</p>
                          <div className="rounded-lg bg-white border border-red-200 p-3">
                            <p className="text-xs text-red-600 flex items-center gap-1.5 font-medium">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              ⏳ Action impossible — réparation requise avant nettoyage
                            </p>
                            <p className="text-[10px] text-red-500 mt-1 pl-5">
                              Vous serez notifié quand la chambre sera prête à être nettoyée
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rooms Tab */}
          {activeTab === 'rooms' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-2xl font-bold text-gray-900">Chambres</h2>
                <div className="flex items-center gap-3">
                  {lastRefresh && (
                    <span className="text-xs text-gray-400">
                      Mise à jour il y a {secondsSinceRefresh}s
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchData}
                    disabled={loading}
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                    Actualiser
                  </Button>
                </div>
              </div>

              {/* Cleaning alert in rooms tab */}
              {priorityRooms.length > 0 && (
                <div
                  className="rounded-xl border-2 border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50 p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setRoomFilter(roomFilter === 'cleaning' ? 'all' : 'cleaning')}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white animate-pulse">
                      <SprayCan className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-amber-900">
                        🔔 {priorityRooms.length} chambre{priorityRooms.length > 1 ? 's' : ''} à nettoyer
                      </span>
                    </div>
                    <Badge className="bg-amber-200 text-amber-800 border-amber-300 text-xs">
                      {roomFilter === 'cleaning' ? 'Filtré' : 'Filtrer'}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Room filter pills */}
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'Toutes', count: rooms.length, activeClass: 'bg-gray-800 text-white', inactiveClass: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
                  { key: 'cleaning', label: '🧹 À nettoyer', count: stats?.cleaning ?? 0, activeClass: 'bg-amber-600 text-white', inactiveClass: 'bg-amber-100 text-amber-800 hover:bg-amber-200' },
                  { key: 'maintenance', label: '🔧 Maintenance', count: stats?.maintenance ?? 0, activeClass: 'bg-red-600 text-white', inactiveClass: 'bg-red-100 text-red-800 hover:bg-red-200' },
                  { key: 'available', label: '✅ Propres', count: stats?.available ?? 0, activeClass: 'bg-emerald-600 text-white', inactiveClass: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' },
                  { key: 'occupied', label: '🛏️ Occupées', count: stats?.occupied ?? 0, activeClass: 'bg-sky-600 text-white', inactiveClass: 'bg-sky-100 text-sky-800 hover:bg-sky-200' },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setRoomFilter(f.key)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                      roomFilter === f.key ? f.activeClass + ' shadow-sm' : f.inactiveClass
                    }`}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i}><CardContent className="p-4"><Skeleton className="h-32 w-full" /></CardContent></Card>
                  ))}
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-500 mb-4">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {roomFilter === 'all' ? 'Aucune chambre' : 'Aucune chambre dans ce statut'}
                  </h3>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRooms.map((room) => {
                    // Cleaning status card — AMBER border, prominent
                    if (room.status === 'cleaning') {
                      return (
                        <Card key={room.id} id={`room-${room.id}`} className="border-2 border-amber-400 bg-gradient-to-b from-amber-50 to-white ring-2 ring-amber-200/50 transition-all hover:shadow-lg shadow-amber-100/50">
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="text-lg font-bold text-amber-900">
                                Chambre {room.room_number}
                              </h3>
                              <Badge className="bg-amber-200 text-amber-800 border-amber-300 text-xs animate-pulse">À nettoyer</Badge>
                            </div>
                            <p className="text-sm text-amber-700 font-medium mb-1">
                              🧹 Chambre {room.room_number} — À nettoyer
                            </p>
                            <p className="text-xs text-amber-600 mb-4">
                              Client parti — nettoyage requis
                            </p>
                            <p className="text-xs text-gray-400 mb-3">{room.room_type}</p>
                            <div className="space-y-2 pt-3 border-t border-amber-200">
                              <Button
                                className="w-full h-12 text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                                onClick={() => handleRoomStatus(room.id, 'available', room.room_number)}
                                disabled={actionLoading === room.id}
                              >
                                {actionLoading === room.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                                ✅ Chambre propre
                              </Button>
                              <Button
                                variant="outline"
                                className="w-full h-10 text-xs font-medium rounded-xl border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400"
                                onClick={() => handleRoomStatus(room.id, 'maintenance', room.room_number)}
                                disabled={actionLoading === room.id}
                              >
                                <Wrench className="h-3.5 w-3.5 mr-1.5" />
                                🔧 Problème détecté
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    }

                    // Maintenance status card — RED border — READ ONLY (housekeeper cannot clean maintenance rooms)
                    if (room.status === 'maintenance') {
                      return (
                        <Card key={room.id} id={`room-${room.id}`} className="border-2 border-red-300 bg-gradient-to-b from-red-50 to-white opacity-80">
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="text-lg font-bold text-red-900">
                                Chambre {room.room_number}
                              </h3>
                              <Badge className="bg-red-200 text-red-800 border-red-300 text-xs">🔧 Maintenance</Badge>
                            </div>
                            <p className="text-sm text-red-700 font-medium mb-1">
                              Réparation en cours
                            </p>
                            <p className="text-xs text-gray-500 mb-3">{room.room_type}</p>
                            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                              <p className="text-xs text-red-700 flex items-center gap-1.5">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                ⏳ En attente de réparation — le manager doit marquer la réparation comme terminée
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    }

                    // Available status card — GREEN border
                    if (room.status === 'available') {
                      return (
                        <Card key={room.id} id={`room-${room.id}`} className="border-2 border-emerald-300 bg-gradient-to-b from-emerald-50 to-white transition-all hover:shadow-md">
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="text-lg font-bold text-emerald-900">
                                Chambre {room.room_number}
                              </h3>
                              <Badge className="bg-emerald-200 text-emerald-800 border-emerald-300 text-xs">✅ Propre</Badge>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">{room.room_type}</p>
                            <div className="mt-3 pt-3 border-t border-emerald-200">
                              <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200">
                                <span className="text-sm font-semibold text-emerald-700">Propre ✅</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    }

                    // Occupied status card — BLUE border
                    if (room.status === 'occupied') {
                      return (
                        <Card key={room.id} id={`room-${room.id}`} className="border-2 border-sky-300 bg-gradient-to-b from-sky-50 to-white transition-all hover:shadow-md">
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="text-lg font-bold text-sky-900">
                                Chambre {room.room_number}
                              </h3>
                              <Badge className="bg-sky-200 text-sky-800 border-sky-300 text-xs">🛏️ Occupée</Badge>
                            </div>
                            <p className="text-xs text-gray-400 mt-2 mb-3">{room.room_type}</p>
                            <div className="mt-1 pt-3 border-t border-sky-200">
                              <div className="space-y-2">
                                <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-sky-50 border border-sky-200">
                                  <Bed className="h-4 w-4 text-sky-600" />
                                  <span className="text-sm font-semibold text-sky-700">Occupée</span>
                                </div>
                                <p className="text-xs text-center text-sky-500 italic">
                                  🛏️ Occupée — en attente de check-out
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    }

                    // Fallback for unknown status
                    return (
                      <Card key={room.id} id={`room-${room.id}`} className="border-2 border-gray-200 bg-gray-50/30 transition-all hover:shadow-md">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xl font-bold text-gray-900">{room.room_number}</span>
                            {getRoomStatusBadge(room.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">{room.room_type}</p>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <NotificationPanel onRefresh={fetchData} />
          )}
        </div>
      </main>
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
                <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100 text-xs">Enregistré</Badge>
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
              {actionLoading === reservation.id ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
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
              {actionLoading === reservation.id ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <DoorOpen className="h-5 w-5 mr-2" />}
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

  const roomStats = {
    total: rooms.length,
    available: rooms.filter(r => r.status === 'available').length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
    cleaning: rooms.filter(r => r.status === 'cleaning').length,
    maintenance: rooms.filter(r => r.status === 'maintenance').length,
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-gradient-to-b from-amber-50 to-orange-50">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-amber-200/50">
        <Image src="/logo.svg" alt="OGOU_Hôtel" height={36} width={36} className="object-contain" />
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
      <aside className="hidden lg:flex w-64 flex-col border-r border-amber-200/50 shrink-0">
        {sidebarContent}
      </aside>

      <main className="flex-1 min-w-0">
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b bg-white">
          <div className="flex items-center gap-2">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Image src="/logo.svg" alt="OGOU_Hôtel" height={20} width={20} className="object-contain" />
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

        <div className="lg:hidden flex overflow-x-auto gap-1 px-4 py-2 border-b bg-white">
          {RECEPTIONIST_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === item.id ? 'bg-amber-100 text-amber-900' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {item.icon}
              {item.label}
              {item.id === 'overview' && <ExpiredStayBadge />}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
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
                <Button variant="outline" size="sm" onClick={fetchAllData} disabled={loading} className="border-amber-200 text-amber-700 hover:bg-amber-50">
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                  Actualiser
                </Button>
              </div>

              <ExpiredStayAlert
                onCheckOut={async (reservationId) => { await handleCheckOut(reservationId, ''); fetchAllData() }}
                onNavigateToReservations={() => setActiveTab('reservations')}
              />

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

              <Card className="border-amber-200/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bed className="h-4 w-4 text-amber-600" />
                    État des chambres
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-emerald-500" /><span className="text-sm text-muted-foreground">{roomStats.available} disponibles</span></div>
                    <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-sky-500" /><span className="text-sm text-muted-foreground">{roomStats.occupied} occupées</span></div>
                    <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-amber-500" /><span className="text-sm text-muted-foreground">{roomStats.cleaning} nettoyage</span></div>
                    <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-red-500" /><span className="text-sm text-muted-foreground">{roomStats.maintenance} maintenance</span></div>
                  </div>
                </CardContent>
              </Card>

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
                          <div><p className="text-sm font-semibold text-emerald-800">{checkIns.length} arrivée{checkIns.length > 1 ? 's' : ''}</p><p className="text-xs text-emerald-600">Check-in à effectuer</p></div>
                        </div>
                      )}
                      {checkOuts.length > 0 && (
                        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                          <DoorOpen className="h-4 w-4 text-amber-600 shrink-0" />
                          <div><p className="text-sm font-semibold text-amber-800">{checkOuts.length} départ{checkOuts.length > 1 ? 's' : ''}</p><p className="text-xs text-amber-600">Check-out à effectuer</p></div>
                        </div>
                      )}
                      {roomStats.cleaning > 0 && (
                        <div className="flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
                          <SprayCan className="h-4 w-4 text-orange-600 shrink-0" />
                          <div><p className="text-sm font-semibold text-orange-800">{roomStats.cleaning} nettoyage</p><p className="text-xs text-orange-600">Chambres à vérifier</p></div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100"><DoorOpen className="h-4 w-4 text-emerald-600" /></div>
                  <h3 className="text-base font-bold text-gray-900">Check-ins du jour</h3>
                  {checkIns.length > 0 && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs">{checkIns.length}</Badge>}
                </div>
                {loading ? (
                  <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => (<Card key={i} className="border-amber-200/40"><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>))}</div>
                ) : checkIns.length === 0 ? (
                  <Card className="border-amber-200/40"><CardContent className="p-6 text-center"><p className="text-sm text-muted-foreground">Aucun check-in prévu aujourd&apos;hui</p></CardContent></Card>
                ) : (
                  <div className="space-y-3">{checkIns.map((res) => renderReservationCard(res, 'check-in'))}</div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100"><DoorOpen className="h-4 w-4 text-amber-600" /></div>
                  <h3 className="text-base font-bold text-gray-900">Check-outs du jour</h3>
                  {checkOuts.length > 0 && <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs">{checkOuts.length}</Badge>}
                </div>
                {loading ? (
                  <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => (<Card key={i} className="border-amber-200/40"><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>))}</div>
                ) : checkOuts.length === 0 ? (
                  <Card className="border-amber-200/40"><CardContent className="p-6 text-center"><p className="text-sm text-muted-foreground">Aucun check-out prévu aujourd&apos;hui</p></CardContent></Card>
                ) : (
                  <div className="space-y-3">{checkOuts.map((res) => renderReservationCard(res, 'check-out'))}</div>
                )}
              </div>

              <Card className="border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 cursor-pointer hover:shadow-lg transition-all" onClick={() => setWalkInOpen(true)}>
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

              <div>
                <h3 className="text-base font-bold text-gray-900 mb-3">Actions rapides</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card className="border-amber-200/40 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('reservations')}>
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2"><Calendar className="h-6 w-6 text-amber-600" /><span className="text-sm font-medium text-amber-900">Nouvelle réservation</span></CardContent>
                  </Card>
                  <Card className="border-emerald-200/40 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setWalkInOpen(true)}>
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2"><DoorOpen className="h-6 w-6 text-emerald-600" /><span className="text-sm font-medium text-emerald-900">Enregistrement direct</span></CardContent>
                  </Card>
                  <Card className="border-sky-200/40 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('rooms')}>
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2"><Bed className="h-6 w-6 text-sky-600" /><span className="text-sm font-medium text-sky-900">Voir chambres</span></CardContent>
                  </Card>
                  <Card className="border-orange-200/40 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('invoices')}>
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2"><FileText className="h-6 w-6 text-orange-600" /><span className="text-sm font-medium text-orange-900">Factures</span></CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rooms' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Chambres</h2>
                <Button variant="outline" size="sm" onClick={fetchAllData} disabled={loading} className="border-amber-200 text-amber-700 hover:bg-amber-50">
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Actualiser
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: `Toutes (${rooms.length})`, activeClass: 'bg-gray-800 text-white', inactiveClass: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
                  { key: 'available', label: `${roomStats.available} disponibles`, activeClass: 'bg-emerald-600 text-white', inactiveClass: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' },
                  { key: 'occupied', label: `${roomStats.occupied} occupées`, activeClass: 'bg-sky-600 text-white', inactiveClass: 'bg-sky-100 text-sky-800 hover:bg-sky-200' },
                  { key: 'cleaning', label: `${roomStats.cleaning} nettoyage`, activeClass: 'bg-amber-600 text-white', inactiveClass: 'bg-amber-100 text-amber-800 hover:bg-amber-200' },
                  { key: 'maintenance', label: `${roomStats.maintenance} maintenance`, activeClass: 'bg-red-600 text-white', inactiveClass: 'bg-red-100 text-red-800 hover:bg-red-200' },
                ].map((f) => (
                  <button key={f.key} onClick={() => setRoomStatusFilter(f.key)} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${roomStatusFilter === f.key ? f.activeClass + ' shadow-sm' : f.inactiveClass}`}>
                    {f.label}
                  </button>
                ))}
              </div>
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => (<Card key={i}><CardContent className="p-4"><Skeleton className="h-32 w-full" /></CardContent></Card>))}</div>
              ) : rooms.filter(r => roomStatusFilter === 'all' || r.status === roomStatusFilter).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-500 mb-4"><Bed className="h-8 w-8" /></div>
                  <h3 className="text-lg font-semibold text-gray-800">Aucune chambre dans ce statut</h3>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {rooms.filter(r => roomStatusFilter === 'all' || r.status === roomStatusFilter).map((room) => {
                    const isActionLoading = roomActionLoading === room.id
                    const statusActions: { status: string; label: string; icon: React.ReactNode; colorClass: string }[] = []
                    if (room.status === 'available') {
                      statusActions.push(
                        { status: 'maintenance', label: 'Mettre en maintenance', icon: <Wrench className="h-3.5 w-3.5" />, colorClass: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200' },
                      )
                    } else if (room.status === 'occupied') {
                      statusActions.push(
                        { status: 'cleaning', label: 'Check-out → Ménage', icon: <LogOut className="h-3.5 w-3.5" />, colorClass: 'bg-sky-100 text-sky-700 hover:bg-sky-200 border-sky-200' },
                      )
                    } else if (room.status === 'maintenance') {
                      statusActions.push(
                        { status: 'cleaning', label: 'Réparation terminée → Ménage', icon: <SprayCan className="h-3.5 w-3.5" />, colorClass: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200' },
                      )
                    }
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
                          {statusActions.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
                              {statusActions.map((action) => (
                                <button key={action.status} onClick={() => handleRoomStatusChange(room.id, action.status)} disabled={isActionLoading} title={action.label} className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50 ${action.colorClass}`}>
                                  {isActionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : action.icon}
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          )}
                          {room.status === 'cleaning' && (
                            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
                              <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1">🧹 En attente de validation par le ménage — vous ne pouvez pas modifier ce statut</span>
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

          {activeTab === 'reservations' && (
            <ReservationsTab rooms={rooms.map((r) => ({ id: r.id, room_number: r.room_number, room_type: r.room_type, status: r.status, price_per_night: r.price_per_night }))} onRefresh={fetchAllData} />
          )}
          {activeTab === 'customers' && <CustomersTab onRefresh={fetchAllData} />}
          {activeTab === 'invoices' && <InvoicesTab onRefresh={fetchAllData} />}
          {activeTab === 'notifications' && <NotificationPanel onRefresh={fetchAllData} />}
        </div>
      </main>

      <WalkInDialog open={walkInOpen} onOpenChange={setWalkInOpen} rooms={rooms.map((r) => ({ id: r.id, room_number: r.room_number, room_type: r.room_type, status: r.status, price_per_night: r.price_per_night }))} onSuccess={fetchAllData} />
    </div>
  )
}

// ─── Manager View (Enhanced Sidebar) ──────────────────────────────────────────

function ManagerView({ profile, onLogout }: StaffDashboardProps) {
  const [activeTab, setActiveTab] = useState<ManagerTabId>('overview')
  const [managerStats, setManagerStats] = useState<ManagerStats | null>(null)
  const [rooms, setRooms] = useState<RoomInfo[]>([])
  const [checkIns, setCheckIns] = useState<ReservationInfo[]>([])
  const [checkOuts, setCheckOuts] = useState<ReservationInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [roomStatusFilter, setRoomStatusFilter] = useState<string>('all')
  const [roomActionLoading, setRoomActionLoading] = useState<string | null>(null)
  const [walkInOpen, setWalkInOpen] = useState(false)
  const [housekeepingRooms, setHousekeepingRooms] = useState<RoomInfo[]>([])
  const [housekeepingStats, setHousekeepingStats] = useState<HousekeepingStats | null>(null)
  const [housekeepingActionLoading, setHousekeepingActionLoading] = useState<string | null>(null)

  const fetchAllData = useCallback(async () => {
    setLoading(true)
    try {
      const [managerRes, roomsRes, receptionRes, housekeepingRes] = await Promise.all([
        fetch('/api/staff/manager'),
        fetch('/api/owner/rooms'),
        fetch('/api/staff/reception'),
        fetch('/api/staff/housekeeping'),
      ])
      if (managerRes.ok) {
        const data = await managerRes.json()
        setManagerStats(data)
      }
      if (roomsRes.ok) {
        const data = await roomsRes.json()
        setRooms(data.rooms || [])
      }
      if (receptionRes.ok) {
        const data = await receptionRes.json()
        setCheckIns(data.checkIns || [])
        setCheckOuts(data.checkOuts || [])
      }
      if (housekeepingRes.ok) {
        const data = await housekeepingRes.json()
        setHousekeepingRooms(data.rooms || [])
        setHousekeepingStats(data.stats || null)
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

  const handleRoomStatusChange = async (roomId: string, newStatus: string) => {
    setRoomActionLoading(roomId)
    try {
      const res = await fetch(`/api/owner/reservations/room-status/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const statusLabels: Record<string, string> = { available: 'Disponible', cleaning: 'Nettoyage', maintenance: 'Maintenance' }
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

  const handleHousekeepingRoomStatus = async (roomId: string, newStatus: string, roomNumber: string) => {
    setHousekeepingActionLoading(roomId)
    try {
      const res = await fetch(`/api/staff/room-status/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const statusLabel = newStatus === 'available' ? 'propre ✅' : newStatus === 'cleaning' ? 'à nettoyer 🧹' : 'en maintenance 🔧'
        toast.success(`Chambre ${roomNumber} marquée ${statusLabel}`)
        fetchAllData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setHousekeepingActionLoading(null)
    }
  }

  const roomStats = {
    total: rooms.length,
    available: rooms.filter(r => r.status === 'available').length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
    cleaning: rooms.filter(r => r.status === 'cleaning').length,
    maintenance: rooms.filter(r => r.status === 'maintenance').length,
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-gradient-to-b from-amber-50 to-orange-50">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-amber-200/50">
        <Image src="/logo.svg" alt="OGOU_Hôtel" height={36} width={36} className="object-contain" />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">OGOU_Hôtel</h1>
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">Manager</p>
            <div className="flex h-2 w-2 rounded-full bg-amber-500" />
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {MANAGER_NAV_ITEMS.map((item) => {
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
              Manager
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
      <aside className="hidden lg:flex w-64 flex-col border-r border-amber-200/50 shrink-0">
        {sidebarContent}
      </aside>

      <main className="flex-1 min-w-0">
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b bg-white">
          <div className="flex items-center gap-2">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Image src="/logo.svg" alt="OGOU_Hôtel" height={20} width={20} className="object-contain" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                {sidebarContent}
              </SheetContent>
            </Sheet>
            <span className="font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">OGOU_Hôtel</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <div className="lg:hidden flex overflow-x-auto gap-1 px-4 py-2 border-b bg-white">
          {MANAGER_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === item.id ? 'bg-amber-100 text-amber-900' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {item.icon}
              {item.label}
              {item.id === 'overview' && <ExpiredStayBadge />}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          {/* Manager Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-900">Bonjour, {profile.first_name} 👋</h2>
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs animate-pulse">
                      <div className="h-2 w-2 rounded-full bg-amber-500 mr-1.5" />
                      En service
                    </Badge>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={fetchAllData} disabled={loading} className="border-amber-200 text-amber-700 hover:bg-amber-50">
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                  Actualiser
                </Button>
              </div>

              <ExpiredStayAlert
                onCheckOut={async (reservationId) => { await handleCheckOut(reservationId, ''); fetchAllData() }}
                onNavigateToReservations={() => setActiveTab('reservations')}
              />

              {/* KPI Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-emerald-100/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('rooms')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Bed className="h-8 w-8 text-emerald-600" />
                      <span className="text-3xl font-bold text-emerald-700">{managerStats?.rooms.available ?? roomStats.available}</span>
                    </div>
                    <p className="text-sm font-medium text-emerald-800 mt-2">Chambres disponibles</p>
                    {roomStats.total > 0 && (
                      <p className="text-xs text-emerald-600 mt-1">{Math.round((managerStats?.rooms.available ?? roomStats.available) / roomStats.total * 100)}% du total</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="border-sky-200/50 bg-gradient-to-br from-sky-50 to-sky-100/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('reservations')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <DoorOpen className="h-8 w-8 text-sky-600" />
                      <span className="text-3xl font-bold text-sky-700">{managerStats?.todayCheckIns ?? checkIns.length}</span>
                    </div>
                    <p className="text-sm font-medium text-sky-800 mt-2">Arrivées aujourd&apos;hui</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-200/50 bg-gradient-to-br from-amber-50 to-amber-100/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('reservations')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <DoorOpen className="h-8 w-8 text-amber-600" />
                      <span className="text-3xl font-bold text-amber-700">{managerStats?.todayCheckOuts ?? checkOuts.length}</span>
                    </div>
                    <p className="text-sm font-medium text-amber-800 mt-2">Départs aujourd&apos;hui</p>
                  </CardContent>
                </Card>
                <Card className="border-red-200/50 bg-gradient-to-br from-red-50 to-red-100/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <AlertTriangle className="h-8 w-8 text-red-600" />
                      <span className="text-3xl font-bold text-red-700">{managerStats?.expiredStays ?? 0}</span>
                    </div>
                    <p className="text-sm font-medium text-red-800 mt-2">Séjours expirés</p>
                  </CardContent>
                </Card>
                <Card className="border-orange-200/50 bg-gradient-to-br from-orange-50 to-orange-100/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('restaurant')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Package className="h-8 w-8 text-orange-600" />
                      <span className="text-3xl font-bold text-orange-700">{(managerStats?.orders.pending ?? 0) + (managerStats?.orders.preparing ?? 0)}</span>
                    </div>
                    <p className="text-sm font-medium text-orange-800 mt-2">Commandes en cours</p>
                  </CardContent>
                </Card>
                <Card className="border-green-200/50 bg-gradient-to-br from-green-50 to-green-100/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <DollarSign className="h-8 w-8 text-green-600" />
                      <span className="text-xl font-bold text-green-700">{formatFCFA(managerStats?.todayRevenue ?? 0)}</span>
                    </div>
                    <p className="text-sm font-medium text-green-800 mt-2">Revenu du jour</p>
                  </CardContent>
                </Card>
                <Card className="border-sky-200/50 bg-gradient-to-br from-sky-50 to-sky-100/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('reservations')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Calendar className="h-8 w-8 text-sky-600" />
                      <span className="text-3xl font-bold text-sky-700">{managerStats?.activeReservations ?? 0}</span>
                    </div>
                    <p className="text-sm font-medium text-sky-800 mt-2">Réservations actives</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-200/50 bg-gradient-to-br from-amber-50 to-amber-100/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('customers')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Users className="h-8 w-8 text-amber-600" />
                      <span className="text-3xl font-bold text-amber-700">{managerStats?.totalCustomers ?? 0}</span>
                    </div>
                    <p className="text-sm font-medium text-amber-800 mt-2">Clients</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-3">Actions rapides</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card className="border-emerald-200/40 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setWalkInOpen(true)}>
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2"><DoorOpen className="h-6 w-6 text-emerald-600" /><span className="text-sm font-medium text-emerald-900">Enregistrement direct</span></CardContent>
                  </Card>
                  <Card className="border-amber-200/40 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('reservations')}>
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2"><Calendar className="h-6 w-6 text-amber-600" /><span className="text-sm font-medium text-amber-900">Réservations</span></CardContent>
                  </Card>
                  <Card className="border-orange-200/40 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('restaurant')}>
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2"><Utensils className="h-6 w-6 text-orange-600" /><span className="text-sm font-medium text-orange-900">Restaurant</span></CardContent>
                  </Card>
                  <Card className="border-emerald-200/40 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('housekeeping')}>
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2"><SprayCan className="h-6 w-6 text-emerald-600" /><span className="text-sm font-medium text-emerald-900">Ménage</span></CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* Rooms Tab */}
          {activeTab === 'rooms' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Chambres</h2>
                <Button variant="outline" size="sm" onClick={fetchAllData} disabled={loading} className="border-amber-200 text-amber-700 hover:bg-amber-50">
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Actualiser
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: `Toutes (${rooms.length})`, activeClass: 'bg-gray-800 text-white', inactiveClass: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
                  { key: 'available', label: `${roomStats.available} disponibles`, activeClass: 'bg-emerald-600 text-white', inactiveClass: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' },
                  { key: 'occupied', label: `${roomStats.occupied} occupées`, activeClass: 'bg-sky-600 text-white', inactiveClass: 'bg-sky-100 text-sky-800 hover:bg-sky-200' },
                  { key: 'cleaning', label: `${roomStats.cleaning} nettoyage`, activeClass: 'bg-amber-600 text-white', inactiveClass: 'bg-amber-100 text-amber-800 hover:bg-amber-200' },
                  { key: 'maintenance', label: `${roomStats.maintenance} maintenance`, activeClass: 'bg-red-600 text-white', inactiveClass: 'bg-red-100 text-red-800 hover:bg-red-200' },
                ].map((f) => (
                  <button key={f.key} onClick={() => setRoomStatusFilter(f.key)} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${roomStatusFilter === f.key ? f.activeClass + ' shadow-sm' : f.inactiveClass}`}>
                    {f.label}
                  </button>
                ))}
              </div>
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => (<Card key={i}><CardContent className="p-4"><Skeleton className="h-32 w-full" /></CardContent></Card>))}</div>
              ) : rooms.filter(r => roomStatusFilter === 'all' || r.status === roomStatusFilter).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-500 mb-4"><Bed className="h-8 w-8" /></div>
                  <h3 className="text-lg font-semibold text-gray-800">Aucune chambre dans ce statut</h3>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {rooms.filter(r => roomStatusFilter === 'all' || r.status === roomStatusFilter).map((room) => {
                    const isActionLoading = roomActionLoading === room.id
                    const statusActions: { status: string; label: string; icon: React.ReactNode; colorClass: string }[] = []
                    if (room.status === 'available') {
                      statusActions.push(
                        { status: 'maintenance', label: 'Mettre en maintenance', icon: <Wrench className="h-3.5 w-3.5" />, colorClass: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200' },
                      )
                    } else if (room.status === 'occupied') {
                      statusActions.push(
                        { status: 'cleaning', label: 'Check-out → Ménage', icon: <LogOut className="h-3.5 w-3.5" />, colorClass: 'bg-sky-100 text-sky-700 hover:bg-sky-200 border-sky-200' },
                      )
                    } else if (room.status === 'cleaning') {
                      statusActions.push(
                        { status: 'available', label: '✅ Valider propre', icon: <CheckCircle2 className="h-3.5 w-3.5" />, colorClass: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200' },
                        { status: 'maintenance', label: '🔧 Problème détecté', icon: <Wrench className="h-3.5 w-3.5" />, colorClass: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200' },
                      )
                    } else if (room.status === 'maintenance') {
                      statusActions.push(
                        { status: 'cleaning', label: '🔧 Réparation terminée → Ménage', icon: <SprayCan className="h-3.5 w-3.5" />, colorClass: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200' },
                      )
                    }
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
                          {statusActions.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
                              {statusActions.map((action) => (
                                <button key={action.status} onClick={() => handleRoomStatusChange(room.id, action.status)} disabled={isActionLoading} title={action.label} className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50 ${action.colorClass}`}>
                                  {isActionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : action.icon}
                                  {action.label}
                                </button>
                              ))}
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

          {activeTab === 'reservations' && (
            <ReservationsTab rooms={rooms.map((r) => ({ id: r.id, room_number: r.room_number, room_type: r.room_type, status: r.status, price_per_night: r.price_per_night }))} onRefresh={fetchAllData} />
          )}
          {activeTab === 'customers' && <CustomersTab onRefresh={fetchAllData} />}
          {activeTab === 'invoices' && <InvoicesTab onRefresh={fetchAllData} />}
          {activeTab === 'expenses' && <ExpensesTab onRefresh={fetchAllData} />}
          {activeTab === 'restaurant' && <RestaurantTab onRefresh={fetchAllData} />}

          {/* Housekeeping Tab */}
          {activeTab === 'housekeeping' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Ménage</h2>
                <Button variant="outline" size="sm" onClick={fetchAllData} disabled={loading} className="border-amber-200 text-amber-700 hover:bg-amber-50">
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Actualiser
                </Button>
              </div>

              {housekeepingStats && (
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 whitespace-nowrap"><SprayCan className="h-3.5 w-3.5" />{housekeepingStats.cleaning} nettoyage</div>
                  <div className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 whitespace-nowrap"><Wrench className="h-3.5 w-3.5" />{housekeepingStats.maintenance} maintenance</div>
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800 whitespace-nowrap"><CheckCircle2 className="h-3.5 w-3.5" />{housekeepingStats.available} propres</div>
                  <div className="flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1.5 text-xs font-medium text-sky-800 whitespace-nowrap"><Bed className="h-3.5 w-3.5" />{housekeepingStats.occupied} occupées</div>
                </div>
              )}

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 4 }).map((_, i) => (<Card key={i}><CardContent className="p-4"><Skeleton className="h-32 w-full" /></CardContent></Card>))}</div>
              ) : housekeepingRooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-500 mb-4"><CheckCircle2 className="h-8 w-8" /></div>
                  <h3 className="text-lg font-semibold text-gray-800">Toutes les chambres sont propres ! 🎉</h3>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {housekeepingRooms.map((room) => (
                    <Card key={room.id} className={`border-2 transition-all hover:shadow-md ${
                      room.status === 'cleaning' ? 'border-amber-200 bg-amber-50/30' :
                      room.status === 'maintenance' ? 'border-red-200 bg-red-50/30' :
                      'border-gray-200 bg-white'
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xl font-bold text-gray-900">{room.room_number}</span>
                          {getRoomStatusBadge(room.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">{room.room_type}</p>
                        <div className="space-y-2 mt-3 pt-3 border-t border-gray-100">
                          {room.status === 'cleaning' && (
                            <>
                              <Button
                                className="w-full h-11 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                                onClick={() => handleHousekeepingRoomStatus(room.id, 'available', room.room_number)}
                                disabled={housekeepingActionLoading === room.id}
                              >
                                {housekeepingActionLoading === room.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                ✅ Chambre propre
                              </Button>
                              <Button
                                variant="outline"
                                className="w-full h-10 text-sm font-medium rounded-xl border-red-200 text-red-700 hover:bg-red-50"
                                onClick={() => handleHousekeepingRoomStatus(room.id, 'maintenance', room.room_number)}
                                disabled={housekeepingActionLoading === room.id}
                              >
                                <Wrench className="h-4 w-4 mr-2" />🔧 Problème détecté
                              </Button>
                            </>
                          )}
                          {room.status === 'maintenance' && (
                            <Button
                              className="w-full h-11 text-sm font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20"
                              onClick={() => handleHousekeepingRoomStatus(room.id, 'cleaning', room.room_number)}
                              disabled={housekeepingActionLoading === room.id}
                            >
                              {housekeepingActionLoading === room.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <SprayCan className="h-4 w-4 mr-2" />}
                              🔧 Réparation terminée → Ménage requis
                            </Button>
                          )}
                          {room.status === 'available' && (
                            <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" />Propre ✅
                            </div>
                          )}
                          {room.status === 'occupied' && (
                            <div className="flex items-center gap-1.5 text-sky-600 text-xs font-medium">
                              <Bed className="h-3.5 w-3.5" />Occupée — check-out requis
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notifications' && <NotificationPanel onRefresh={fetchAllData} />}

          {/* ── Stocks Tab (Full Access for Manager) ── */}
          {activeTab === 'stocks' && <StocksTab onRefresh={fetchAllData} />}
        </div>
      </main>

      <WalkInDialog open={walkInOpen} onOpenChange={setWalkInOpen} rooms={rooms.map((r) => ({ id: r.id, room_number: r.room_number, room_type: r.room_type, status: r.status, price_per_night: r.price_per_night }))} onSuccess={fetchAllData} />
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
