'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  UtensilsCrossed,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Search,
  ShoppingCart,
  Clock,
  ChefHat,
  X,
  Minus,
  ArrowRight,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import { ScrollArea } from '@/components/ui/scroll-area'

// ─── Types ───────────────────────────────────────────────────────────────────

interface RestaurantTabProps {
  onRefresh?: () => void
}

interface MenuItem {
  id: string
  name: string
  category: string
  description: string | null
  price: number
  is_available: boolean
  created_at: string
  updated_at: string
}

interface OrderItem {
  id: string
  menu_item_id: string
  menu_item_name?: string
  quantity: number
  unit_price: number
  subtotal: number
}

interface Order {
  id: string
  table_number: string | null
  room_number: string | null
  total_amount: number
  status: string
  created_at: string
  updated_at: string
  items?: OrderItem[]
}

type SubTab = 'menu' | 'orders'
type OrderFilter = 'all' | 'pending' | 'preparing' | 'served' | 'paid' | 'cancelled'

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

function getCategoryBadge(category: string) {
  const icon = CATEGORY_ICONS[category] || '🍴'
  const label = MENU_CATEGORIES.find(c => c.value === category)?.label || category
  const colorMap: Record<string, string> = {
    entree: 'bg-green-100 text-green-700 border-green-200',
    plat_principal: 'bg-amber-100 text-amber-700 border-amber-200',
    dessert: 'bg-pink-100 text-pink-700 border-pink-200',
    boisson: 'bg-sky-100 text-sky-700 border-sky-200',
    aperitif: 'bg-purple-100 text-purple-700 border-purple-200',
    autre: 'bg-gray-100 text-gray-700 border-gray-200',
  }
  return (
    <Badge className={`${colorMap[category] || 'bg-gray-100 text-gray-700'} hover:bg-opacity-90 text-[10px]`}>
      {icon} {label}
    </Badge>
  )
}

function getOrderStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">En attente</Badge>
    case 'preparing':
      return <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100">En préparation</Badge>
    case 'served':
      return <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100">Servie</Badge>
    case 'paid':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Payée</Badge>
    case 'cancelled':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Annulée</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function getOrderStatusLabel(status: string): string {
  switch (status) {
    case 'pending': return 'En attente'
    case 'preparing': return 'En préparation'
    case 'served': return 'Servie'
    case 'paid': return 'Payée'
    case 'cancelled': return 'Annulée'
    default: return status
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RestaurantTab({ onRefresh }: RestaurantTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('menu')
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all')

  // Menu dialog
  const [menuDialogOpen, setMenuDialogOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Menu form
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formAvailable, setFormAvailable] = useState(true)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Order detail sheet
  const [detailSheetOpen, setDetailSheetOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  // Create order dialog
  const [createOrderOpen, setCreateOrderOpen] = useState(false)
  const [orderTableNumber, setOrderTableNumber] = useState('')
  const [orderRoomNumber, setOrderRoomNumber] = useState('')
  const [orderIsRoomService, setOrderIsRoomService] = useState(false)
  const [orderItems, setOrderItems] = useState<Array<{ menuItemId: string; name: string; price: number; quantity: number }>>([])
  const [orderMenuSearch, setOrderMenuSearch] = useState('')
  const [creatingOrder, setCreatingOrder] = useState(false)

  // ─── Fetch data ───────────────────────────────────────────────────────
  const fetchMenu = useCallback(async () => {
    try {
      const res = await fetch('/api/owner/restaurant/menu')
      if (res.ok) {
        const data = await res.json()
        setMenuItems(data.items || data.menu || [])
      }
    } catch {
      toast.error('Erreur lors du chargement du menu')
    }
  }, [])

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/owner/restaurant/orders')
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders || [])
      }
    } catch {
      toast.error('Erreur lors du chargement des commandes')
    }
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchMenu(), fetchOrders()])
    setLoading(false)
  }, [fetchMenu, fetchOrders])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ─── Menu helpers ─────────────────────────────────────────────────────
  function resetMenuForm() {
    setFormName('')
    setFormCategory('')
    setFormDescription('')
    setFormPrice('')
    setFormAvailable(true)
  }

  function openCreateMenuDialog() {
    resetMenuForm()
    setEditMode(false)
    setSelectedItem(null)
    setMenuDialogOpen(true)
  }

  function openEditMenuDialog(item: MenuItem) {
    setEditMode(true)
    setSelectedItem(item)
    setFormName(item.name)
    setFormCategory(item.category)
    setFormDescription(item.description || '')
    setFormPrice(item.price.toString())
    setFormAvailable(item.is_available)
    setMenuDialogOpen(true)
  }

  // ─── Menu submit ──────────────────────────────────────────────────────
  async function handleMenuSubmit() {
    if (!formName.trim() || !formCategory || !formPrice) {
      toast.error('Nom, catégorie et prix sont requis')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: formName.trim(),
        category: formCategory,
        description: formDescription.trim() || null,
        price: parseFloat(formPrice),
        is_available: formAvailable,
      }

      let res: Response
      if (editMode && selectedItem) {
        res = await fetch(`/api/owner/restaurant/menu/${selectedItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/owner/restaurant/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        toast.success(editMode ? `« ${formName} » modifié` : `« ${formName} » ajouté au menu`)
        setMenuDialogOpen(false)
        resetMenuForm()
        fetchMenu()
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

  // ─── Toggle availability ──────────────────────────────────────────────
  async function toggleAvailability(item: MenuItem) {
    try {
      const res = await fetch(`/api/owner/restaurant/menu/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: !item.is_available }),
      })

      if (res.ok) {
        toast.success(item.is_available ? `« ${item.name} » marqué indisponible` : `« ${item.name} » marqué disponible`)
        fetchMenu()
      } else {
        toast.error('Erreur lors de la modification')
      }
    } catch {
      toast.error('Erreur de connexion')
    }
  }

  // ─── Delete menu item ─────────────────────────────────────────────────
  async function handleDeleteMenu() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/owner/restaurant/menu/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success(`« ${deleteTarget.name} » supprimé du menu`)
        setDeleteDialogOpen(false)
        setDeleteTarget(null)
        fetchMenu()
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

  // ─── Order helpers ────────────────────────────────────────────────────
  function openOrderDetail(order: Order) {
    setSelectedOrder(order)
    setDetailSheetOpen(true)
  }

  async function handleOrderAction(orderId: string, action: string) {
    try {
      const res = await fetch(`/api/owner/restaurant/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      if (res.ok) {
        const actionLabels: Record<string, string> = {
          prepare: 'en préparation',
          serve: 'servie',
          pay: 'payée',
          cancel: 'annulée',
        }
        toast.success(`Commande ${actionLabels[action] || 'mise à jour'}`)
        fetchOrders()
        onRefresh?.()
        // Close detail sheet if viewing this order
        if (selectedOrder?.id === orderId) {
          setDetailSheetOpen(false)
        }
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de l\'action')
      }
    } catch {
      toast.error('Erreur de connexion')
    }
  }

  // ─── Create order helpers ─────────────────────────────────────────────
  function openCreateOrderDialog() {
    setOrderTableNumber('')
    setOrderRoomNumber('')
    setOrderIsRoomService(false)
    setOrderItems([])
    setOrderMenuSearch('')
    setCreateOrderOpen(true)
  }

  function addOrderItem(menuItem: MenuItem) {
    const existing = orderItems.find(i => i.menuItemId === menuItem.id)
    if (existing) {
      setOrderItems(orderItems.map(i =>
        i.menuItemId === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i
      ))
    } else {
      setOrderItems([...orderItems, {
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: 1,
      }])
    }
  }

  function updateOrderItemQuantity(menuItemId: string, quantity: number) {
    if (quantity <= 0) {
      setOrderItems(orderItems.filter(i => i.menuItemId !== menuItemId))
    } else {
      setOrderItems(orderItems.map(i =>
        i.menuItemId === menuItemId ? { ...i, quantity } : i
      ))
    }
  }

  function getOrderTotal() {
    return orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
  }

  const availableMenuForOrder = menuItems.filter(i =>
    i.is_available && (orderMenuSearch ? i.name.toLowerCase().includes(orderMenuSearch.toLowerCase()) : true)
  )

  async function handleCreateOrder() {
    if (orderItems.length === 0) {
      toast.error('Ajoutez au moins un article')
      return
    }
    if (!orderIsRoomService && !orderTableNumber.trim()) {
      toast.error('Indiquez le numéro de table')
      return
    }
    if (orderIsRoomService && !orderRoomNumber.trim()) {
      toast.error('Indiquez le numéro de chambre')
      return
    }

    setCreatingOrder(true)
    try {
      const payload = {
        table_number: orderIsRoomService ? null : orderTableNumber.trim(),
        room_number: orderIsRoomService ? orderRoomNumber.trim() : null,
        items: orderItems.map(i => ({
          menu_item_id: i.menuItemId,
          quantity: i.quantity,
        })),
      }

      const res = await fetch('/api/owner/restaurant/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast.success('Commande créée avec succès')
        setCreateOrderOpen(false)
        fetchOrders()
        onRefresh?.()
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

  // ─── Grouped menu items ───────────────────────────────────────────────
  const groupedMenu = MENU_CATEGORIES.map(cat => ({
    ...cat,
    items: menuItems.filter(i => i.category === cat.value),
  })).filter(g => g.items.length > 0)

  const filteredOrders = orders.filter(o =>
    orderFilter === 'all' || o.status === orderFilter
  )

  const orderStats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    served: orders.filter(o => o.status === 'served').length,
    paid: orders.filter(o => o.status === 'paid').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">🍽️ Restaurant</h2>
          <p className="text-muted-foreground">
            {menuItems.length} article{menuItems.length !== 1 ? 's' : ''} au menu • {orderStats.pending} commande{orderStats.pending !== 1 ? 's' : ''} en attente
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
          <TabsTrigger value="menu" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            🍴 Menu
          </TabsTrigger>
          <TabsTrigger value="orders" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            📋 Commandes
            {orderStats.pending > 0 && (
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white text-[10px]">
                {orderStats.pending}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── Menu Sub-tab ──────────────────────────────────────────── */}
        <TabsContent value="menu" className="space-y-6 mt-4">
          <div className="flex items-center justify-end">
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              onClick={openCreateMenuDialog}
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter au menu
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full" />
              ))}
            </div>
          ) : menuItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-400 mb-3">
                <UtensilsCrossed className="h-7 w-7" />
              </div>
              <p className="text-muted-foreground">Aucun article au menu</p>
              <p className="text-xs text-muted-foreground mt-1">Ajoutez vos premiers plats et boissons</p>
              <Button
                className="mt-4 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={openCreateMenuDialog}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter au menu
              </Button>
            </div>
          ) : (
            groupedMenu.map((group) => (
              <div key={group.value}>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  {CATEGORY_ICONS[group.value]} {group.label}
                  <Badge variant="secondary" className="text-[10px]">{group.items.length}</Badge>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.items.map((item) => (
                    <Card
                      key={item.id}
                      className={`border-amber-200/60 transition-all hover:shadow-md ${!item.is_available ? 'opacity-60' : ''}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm truncate">{item.name}</h4>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 ml-2 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditMenuDialog(item)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700"
                              onClick={() => {
                                setDeleteTarget(item)
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <span className="font-bold text-amber-700 text-sm">{formatFCFA(item.price)}</span>
                          <div className="flex items-center gap-2">
                            {!item.is_available && (
                              <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-[10px]">Indisponible</Badge>
                            )}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground">Dispo</span>
                              <Switch
                                checked={item.is_available}
                                onCheckedChange={() => toggleAvailability(item)}
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* ─── Orders Sub-tab ────────────────────────────────────────── */}
        <TabsContent value="orders" className="space-y-4 mt-4">
          {/* Status filter buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {([
              { key: 'all', label: 'Toutes', count: orderStats.total },
              { key: 'pending', label: 'En attente', count: orderStats.pending },
              { key: 'preparing', label: 'En préparation', count: orderStats.preparing },
              { key: 'served', label: 'Servies', count: orderStats.served },
              { key: 'paid', label: 'Payées', count: orderStats.paid },
            ] as const).map((f) => (
              <Button
                key={f.key}
                variant={orderFilter === f.key ? 'default' : 'outline'}
                size="sm"
                className={`h-8 text-xs ${orderFilter === f.key ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'border-amber-200 text-amber-700'}`}
                onClick={() => setOrderFilter(f.key as OrderFilter)}
              >
                {f.label}
                {f.count > 0 && (
                  <Badge className="ml-1.5 h-4 min-w-[16px] p-0 flex items-center justify-center bg-white/20 text-[10px]">
                    {f.count}
                  </Badge>
                )}
              </Button>
            ))}
            <div className="flex-1" />
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              size="sm"
              onClick={openCreateOrderDialog}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle commande
            </Button>
          </div>

          {/* Orders table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-400 mb-3">
                    <ShoppingCart className="h-7 w-7" />
                  </div>
                  <p className="text-muted-foreground">Aucune commande trouvée</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {orderFilter !== 'all' ? 'Modifiez le filtre' : 'Créez votre première commande'}
                  </p>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Commande</TableHead>
                        <TableHead>Table / Chambre</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="hidden sm:table-cell">Heure</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <TableRow
                          key={order.id}
                          className="cursor-pointer hover:bg-amber-50/50"
                          onClick={() => openOrderDetail(order)}
                        >
                          <TableCell>
                            <span className="font-mono font-semibold text-sm">
                              #{order.id.slice(0, 8).toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell>
                            {order.table_number ? (
                              <span className="flex items-center gap-1.5 text-sm">
                                <UtensilsCrossed className="h-3.5 w-3.5 text-amber-500" />
                                Table {order.table_number}
                              </span>
                            ) : order.room_number ? (
                              <span className="flex items-center gap-1.5 text-sm">
                                <Clock className="h-3.5 w-3.5 text-sky-500" />
                                Ch. {order.room_number}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {formatFCFA(order.total_amount)}
                          </TableCell>
                          <TableCell>{getOrderStatusBadge(order.status)}</TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                            {format(parseISO(order.created_at), 'HH:mm', { locale: fr })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              {order.status === 'pending' && (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-sky-600 hover:bg-sky-700 text-white"
                                  onClick={() => handleOrderAction(order.id, 'prepare')}
                                >
                                  <ChefHat className="h-3 w-3 mr-1" />
                                  Préparer
                                </Button>
                              )}
                              {order.status === 'preparing' && (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                                  onClick={() => handleOrderAction(order.id, 'serve')}
                                >
                                  Préparer → Servir
                                </Button>
                              )}
                              {order.status === 'served' && (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => handleOrderAction(order.id, 'pay')}
                                >
                                  Encaisser
                                </Button>
                              )}
                              {order.status !== 'cancelled' && order.status !== 'paid' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-red-500 hover:text-red-700"
                                  onClick={() => handleOrderAction(order.id, 'cancel')}
                                >
                                  Annuler
                                </Button>
                              )}
                            </div>
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

      {/* ─── Menu Create/Edit Dialog ──────────────────────────────────── */}
      <Dialog open={menuDialogOpen} onOpenChange={setMenuDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editMode ? (
                <><Pencil className="h-5 w-5 text-amber-600" /> Modifier l&apos;article</>
              ) : (
                <><Plus className="h-5 w-5 text-amber-600" /> Nouvel article</>
              )}
            </DialogTitle>
            <DialogDescription>
              {editMode ? 'Modifiez les informations de l\'article' : 'Ajoutez un nouvel article au menu'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="menu-name">Nom *</Label>
              <Input
                id="menu-name"
                placeholder="Nom du plat ou de la boisson"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="menu-category">Catégorie *</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger id="menu-category">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {MENU_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {CATEGORY_ICONS[cat.value]} {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="menu-price">Prix (FCFA) *</Label>
                <Input
                  id="menu-price"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="menu-desc">Description</Label>
              <Textarea
                id="menu-desc"
                placeholder="Description de l'article (optionnel)"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="menu-available"
                checked={formAvailable}
                onCheckedChange={setFormAvailable}
              />
              <Label htmlFor="menu-available">Disponible</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMenuDialogOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              disabled={submitting}
              onClick={handleMenuSubmit}
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

      {/* ─── Delete Confirmation ──────────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirmer la suppression
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>« {deleteTarget?.name} »</strong> du menu ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeleteMenu}
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

      {/* ─── Order Detail Sheet ───────────────────────────────────────── */}
      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-amber-600" />
              Commande #{selectedOrder?.id?.slice(0, 8).toUpperCase()}
            </SheetTitle>
          </SheetHeader>

          {selectedOrder && (
            <div className="mt-6 space-y-6">
              {/* Order info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Table / Chambre</p>
                  <p className="font-medium text-sm">
                    {selectedOrder.table_number
                      ? `Table ${selectedOrder.table_number}`
                      : selectedOrder.room_number
                        ? `Chambre ${selectedOrder.room_number}`
                        : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Statut</p>
                  {getOrderStatusBadge(selectedOrder.status)}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Heure</p>
                  <p className="font-medium text-sm">
                    {format(parseISO(selectedOrder.created_at), 'HH:mm', { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-bold text-amber-700">{formatFCFA(selectedOrder.total_amount)}</p>
                </div>
              </div>

              <Separator />

              {/* Order items */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Articles commandés</h4>
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  <div className="space-y-2">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.menu_item_name || `Article #${item.menu_item_id?.slice(0, 8)}`}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFCFA(item.unit_price)} × {item.quantity}
                          </p>
                        </div>
                        <span className="font-semibold text-amber-700 ml-2">{formatFCFA(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Détails non disponibles</p>
                )}
              </div>

              <Separator />

              {/* Actions */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold mb-3">Actions</h4>
                <div className="flex flex-col gap-2">
                  {selectedOrder.status === 'pending' && (
                    <Button
                      className="w-full bg-sky-600 hover:bg-sky-700 text-white"
                      onClick={() => handleOrderAction(selectedOrder.id, 'prepare')}
                    >
                      <ChefHat className="h-4 w-4 mr-2" />
                      Préparer la commande
                    </Button>
                  )}
                  {selectedOrder.status === 'preparing' && (
                    <Button
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => handleOrderAction(selectedOrder.id, 'serve')}
                    >
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Marquer comme servie
                    </Button>
                  )}
                  {selectedOrder.status === 'served' && (
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleOrderAction(selectedOrder.id, 'pay')}
                    >
                      Encaisser la commande
                    </Button>
                  )}
                  {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'paid' && (
                    <Button
                      variant="outline"
                      className="w-full border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => handleOrderAction(selectedOrder.id, 'cancel')}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Annuler la commande
                    </Button>
                  )}
                  {(selectedOrder.status === 'paid' || selectedOrder.status === 'cancelled') && (
                    <p className="text-center text-sm text-muted-foreground py-4">Aucune action disponible</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ─── Create Order Dialog ──────────────────────────────────────── */}
      <Dialog open={createOrderOpen} onOpenChange={setCreateOrderOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-amber-600" />
              Nouvelle commande
            </DialogTitle>
            <DialogDescription>
              Créez une commande pour une table ou un service en chambre
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Table/Room selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  id="room-service"
                  checked={orderIsRoomService}
                  onCheckedChange={setOrderIsRoomService}
                />
                <Label htmlFor="room-service">Service en chambre</Label>
              </div>

              {orderIsRoomService ? (
                <div className="space-y-2">
                  <Label htmlFor="room-num">Numéro de chambre *</Label>
                  <Input
                    id="room-num"
                    placeholder="Ex: 101"
                    value={orderRoomNumber}
                    onChange={(e) => setOrderRoomNumber(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="table-num">Numéro de table *</Label>
                  <Input
                    id="table-num"
                    placeholder="Ex: 5"
                    value={orderTableNumber}
                    onChange={(e) => setOrderTableNumber(e.target.value)}
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Menu item search */}
            <div className="space-y-3">
              <Label>Articles</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher un article..."
                  className="pl-9"
                  value={orderMenuSearch}
                  onChange={(e) => setOrderMenuSearch(e.target.value)}
                />
              </div>

              {/* Available items */}
              <div className="max-h-40 overflow-y-auto border rounded-lg [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                {availableMenuForOrder.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 text-center">Aucun article disponible</p>
                ) : (
                  availableMenuForOrder.map((item) => (
                    <button
                      key={item.id}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-amber-50 text-left border-b last:border-0 transition-colors"
                      onClick={() => addOrderItem(item)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getCategoryBadge(item.category)}
                        <span className="text-sm truncate">{item.name}</span>
                      </div>
                      <span className="text-sm font-medium text-amber-700 shrink-0 ml-2">{formatFCFA(item.price)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Selected items */}
            {orderItems.length > 0 && (
              <div className="space-y-2">
                <Label>Articles sélectionnés</Label>
                {orderItems.map((item) => (
                  <div key={item.menuItemId} className="flex items-center gap-3 rounded-lg border border-amber-200/60 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFCFA(item.price)} / unité</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateOrderItemQuantity(item.menuItemId, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-bold w-8 text-center">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateOrderItemQuantity(item.menuItemId, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-bold text-amber-700 min-w-[80px] text-right">
                        {formatFCFA(item.price * item.quantity)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500"
                        onClick={() => updateOrderItemQuantity(item.menuItemId, 0)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Separator />

                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="font-semibold text-sm">Total</span>
                  <span className="font-bold text-amber-700">{formatFCFA(getOrderTotal())}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOrderOpen(false)} disabled={creatingOrder}>
              Annuler
            </Button>
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              disabled={creatingOrder || orderItems.length === 0}
              onClick={handleCreateOrder}
            >
              {creatingOrder ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Création...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Créer la commande ({formatFCFA(getOrderTotal())})</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
