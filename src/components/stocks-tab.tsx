'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Package,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  ShoppingCart,
  Search,
  X,
  ArrowRightLeft,
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Alert, AlertDescription } from '@/components/ui/alert'

// ─── Types ───────────────────────────────────────────────────────────────────

interface StocksTabProps {
  onRefresh?: () => void
}

interface StockItem {
  id: string
  name: string
  quantity: number
  unit: string
  min_threshold: number
  created_at: string
  updated_at: string
}

interface StockTransaction {
  id: string
  stock_item_id: string
  type: string
  quantity: number
  reason: string | null
  created_at: string
  stock_items?: {
    name: string
  } | null
}

type SubTab = 'inventory' | 'transactions'

const STOCK_UNITS = [
  { value: 'kg', label: 'kg' },
  { value: 'L', label: 'L' },
  { value: 'unite', label: 'Unité' },
  { value: 'lot', label: 'Lot' },
  { value: 'bouteille', label: 'Bouteille' },
  { value: 'sac', label: 'Sac' },
  { value: 'carton', label: 'Carton' },
  { value: 'rouleau', label: 'Rouleau' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

function getUnitLabel(unit: string): string {
  return STOCK_UNITS.find(u => u.value === unit)?.label || unit
}

function getStockStatusBadge(item: StockItem) {
  if (item.quantity === 0) {
    return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Rupture</Badge>
  }
  if (item.quantity <= item.min_threshold) {
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Stock bas</Badge>
  }
  return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">OK</Badge>
}

function getTransactionTypeBadge(type: string) {
  if (type === 'in') {
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Entrée</Badge>
  }
  return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Sortie</Badge>
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StocksTab({ onRefresh }: StocksTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('inventory')
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [transactions, setTransactions] = useState<StockTransaction[]>([])
  const [loading, setLoading] = useState(true)

  // Stock item dialog
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Item form
  const [formName, setFormName] = useState('')
  const [formQuantity, setFormQuantity] = useState('')
  const [formUnit, setFormUnit] = useState('')
  const [formMinThreshold, setFormMinThreshold] = useState('')

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<StockItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Quick transaction dialog
  const [quickTransOpen, setQuickTransOpen] = useState(false)
  const [quickTransItem, setQuickTransItem] = useState<StockItem | null>(null)
  const [quickTransType, setQuickTransType] = useState<'in' | 'out'>('in')
  const [quickTransQty, setQuickTransQty] = useState('')
  const [quickTransReason, setQuickTransReason] = useState('')
  const [quickTransSubmitting, setQuickTransSubmitting] = useState(false)

  // Full transaction dialog
  const [transDialogOpen, setTransDialogOpen] = useState(false)
  const [transItemId, setTransItemId] = useState('')
  const [transType, setTransType] = useState<'in' | 'out'>('in')
  const [transQty, setTransQty] = useState('')
  const [transReason, setTransReason] = useState('')
  const [transSubmitting, setTransSubmitting] = useState(false)

  // Transaction filters
  const [transFilterType, setTransFilterType] = useState<'all' | 'in' | 'out'>('all')
  const [transFilterItem, setTransFilterItem] = useState('all')

  // ─── Fetch data ───────────────────────────────────────────────────────
  const fetchStockItems = useCallback(async () => {
    try {
      const res = await fetch('/api/owner/stocks/items')
      if (res.ok) {
        const data = await res.json()
        setStockItems(data.items || [])
      }
    } catch {
      toast.error('Erreur lors du chargement du stock')
    }
  }, [])

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/owner/stocks/transactions')
      if (res.ok) {
        const data = await res.json()
        setTransactions(data.transactions || [])
      }
    } catch {
      toast.error('Erreur lors du chargement des mouvements')
    }
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchStockItems(), fetchTransactions()])
    setLoading(false)
  }, [fetchStockItems, fetchTransactions])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ─── Low stock alerts ─────────────────────────────────────────────────
  const lowStockItems = stockItems.filter(i => i.quantity <= i.min_threshold)

  // ─── Item form helpers ────────────────────────────────────────────────
  function resetItemForm() {
    setFormName('')
    setFormQuantity('')
    setFormUnit('')
    setFormMinThreshold('')
  }

  function openCreateItemDialog() {
    resetItemForm()
    setEditMode(false)
    setSelectedItem(null)
    setItemDialogOpen(true)
  }

  function openEditItemDialog(item: StockItem) {
    setEditMode(true)
    setSelectedItem(item)
    setFormName(item.name)
    setFormQuantity(item.quantity.toString())
    setFormUnit(item.unit)
    setFormMinThreshold(item.min_threshold.toString())
    setItemDialogOpen(true)
  }

  // ─── Item submit ──────────────────────────────────────────────────────
  async function handleItemSubmit() {
    if (!formName.trim() || !formUnit || formQuantity === '' || formMinThreshold === '') {
      toast.error('Tous les champs sont requis')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: formName.trim(),
        quantity: parseFloat(formQuantity),
        unit: formUnit,
        min_threshold: parseFloat(formMinThreshold),
      }

      let res: Response
      if (editMode && selectedItem) {
        res = await fetch(`/api/owner/stocks/items/${selectedItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/owner/stocks/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        toast.success(editMode ? `« ${formName} » modifié` : `« ${formName} » ajouté au stock`)
        setItemDialogOpen(false)
        resetItemForm()
        fetchStockItems()
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

  // ─── Delete item ──────────────────────────────────────────────────────
  async function handleDeleteItem() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/owner/stocks/items/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success(`« ${deleteTarget.name} » supprimé du stock`)
        setDeleteDialogOpen(false)
        setDeleteTarget(null)
        fetchStockItems()
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

  // ─── Quick transaction ────────────────────────────────────────────────
  function openQuickTransaction(item: StockItem, type: 'in' | 'out') {
    setQuickTransItem(item)
    setQuickTransType(type)
    setQuickTransQty('')
    setQuickTransReason('')
    setQuickTransOpen(true)
  }

  async function handleQuickTransaction() {
    if (!quickTransItem || !quickTransQty || parseFloat(quickTransQty) <= 0) {
      toast.error('Quantité requise')
      return
    }

    setQuickTransSubmitting(true)
    try {
      const res = await fetch('/api/owner/stocks/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_item_id: quickTransItem.id,
          type: quickTransType,
          quantity: parseFloat(quickTransQty),
          reason: quickTransReason.trim() || null,
        }),
      })

      if (res.ok) {
        toast.success(
          quickTransType === 'in'
            ? `Entrée de ${quickTransQty} ${getUnitLabel(quickTransItem.unit)} pour « ${quickTransItem.name} »`
            : `Sortie de ${quickTransQty} ${getUnitLabel(quickTransItem.unit)} pour « ${quickTransItem.name} »`
        )
        setQuickTransOpen(false)
        fetchStockItems()
        fetchTransactions()
        onRefresh?.()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de l\'opération')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setQuickTransSubmitting(false)
    }
  }

  // ─── Full transaction dialog ──────────────────────────────────────────
  function openTransDialog() {
    setTransItemId('')
    setTransType('in')
    setTransQty('')
    setTransReason('')
    setTransDialogOpen(true)
  }

  async function handleTransSubmit() {
    if (!transItemId || !transQty || parseFloat(transQty) <= 0) {
      toast.error('Article et quantité sont requis')
      return
    }

    setTransSubmitting(true)
    try {
      const res = await fetch('/api/owner/stocks/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_item_id: transItemId,
          type: transType,
          quantity: parseFloat(transQty),
          reason: transReason.trim() || null,
        }),
      })

      if (res.ok) {
        const itemName = stockItems.find(i => i.id === transItemId)?.name || 'Article'
        toast.success(
          transType === 'in'
            ? `Entrée de stock enregistrée pour « ${itemName} »`
            : `Sortie de stock enregistrée pour « ${itemName} »`
        )
        setTransDialogOpen(false)
        fetchStockItems()
        fetchTransactions()
        onRefresh?.()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de l\'opération')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setTransSubmitting(false)
    }
  }

  // ─── Filtered transactions ────────────────────────────────────────────
  const filteredTransactions = transactions.filter(t => {
    if (transFilterType !== 'all' && t.type !== transFilterType) return false
    if (transFilterItem !== 'all' && t.stock_item_id !== transFilterItem) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Package className="h-6 w-6 text-amber-600" /> Stocks</h2>
          <p className="text-muted-foreground">
            {stockItems.length} article{stockItems.length !== 1 ? 's' : ''} en stock • {lowStockItems.length} alerte{lowStockItems.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchAll(); onRefresh?.() }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Low stock alerts */}
      {lowStockItems.length > 0 && (
        <div className="space-y-2">
          {lowStockItems.map((item) => (
            <Alert key={item.id} className={`border ${item.quantity === 0 ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
              <AlertTriangle className={`h-4 w-4 ${item.quantity === 0 ? 'text-red-600' : 'text-amber-600'}`} />
              <AlertDescription className={`flex items-center justify-between ${item.quantity === 0 ? 'text-red-800' : 'text-amber-800'}`}>
                <span>
                  <strong>« {item.name} »</strong> — {item.quantity === 0 ? 'Rupture de stock !' : `Stock bas : ${item.quantity} ${getUnitLabel(item.unit)} (seuil : ${item.min_threshold})`}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className={`h-7 text-xs ${item.quantity === 0 ? 'border-red-300 text-red-700 hover:bg-red-100' : 'border-amber-300 text-amber-700 hover:bg-amber-100'}`}
                  onClick={() => openQuickTransaction(item, 'in')}
                >
                  <ShoppingCart className="h-3 w-3 mr-1" />
                  Commander
                </Button>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Sub-tabs */}
      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as SubTab)}>
        <TabsList className="bg-amber-50 border border-amber-200/60">
          <TabsTrigger value="inventory" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white flex items-center gap-1.5">
            <Package className="h-4 w-4" /> Inventaire
          </TabsTrigger>
          <TabsTrigger value="transactions" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white flex items-center gap-1.5">
            <ArrowRightLeft className="h-4 w-4" /> Mouvements
          </TabsTrigger>
        </TabsList>

        {/* ─── Inventory Sub-tab ───────────────────────────────────────── */}
        <TabsContent value="inventory" className="space-y-4 mt-4">
          <div className="flex items-center justify-end">
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              onClick={openCreateItemDialog}
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un article
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
              ) : stockItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-400 mb-3">
                    <Package className="h-7 w-7" />
                  </div>
                  <p className="text-muted-foreground">Aucun article en stock</p>
                  <p className="text-xs text-muted-foreground mt-1">Ajoutez vos premiers articles pour suivre le stock</p>
                  <Button
                    className="mt-4 bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={openCreateItemDialog}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un article
                  </Button>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Article</TableHead>
                        <TableHead>Quantité</TableHead>
                        <TableHead className="hidden sm:table-cell">Unité</TableHead>
                        <TableHead className="hidden md:table-cell">Seuil min.</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-sm">{item.name}</TableCell>
                          <TableCell>
                            <span className={`font-semibold text-sm ${item.quantity === 0 ? 'text-red-600' : item.quantity <= item.min_threshold ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {item.quantity}
                            </span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                            {getUnitLabel(item.unit)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {item.min_threshold}
                          </TableCell>
                          <TableCell>{getStockStatusBadge(item)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                                onClick={() => openQuickTransaction(item, 'in')}
                                title="Entrée de stock"
                              >
                                <ArrowDownCircle className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => openQuickTransaction(item, 'out')}
                                title="Sortie de stock"
                              >
                                <ArrowUpCircle className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEditItemDialog(item)}
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

        {/* ─── Transactions Sub-tab ────────────────────────────────────── */}
        <TabsContent value="transactions" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Type :</Label>
              <Select value={transFilterType} onValueChange={(v) => setTransFilterType(v as 'all' | 'in' | 'out')}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="in">Entrées</SelectItem>
                  <SelectItem value="out">Sorties</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Article :</Label>
              <Select value={transFilterItem} onValueChange={setTransFilterItem}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les articles</SelectItem>
                  {stockItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1" />
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              size="sm"
              onClick={openTransDialog}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouveau mouvement
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
              ) : filteredTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-400 mb-3">
                    <Package className="h-7 w-7" />
                  </div>
                  <p className="text-muted-foreground">Aucun mouvement de stock</p>
                  <p className="text-xs text-muted-foreground mt-1">Enregistrez vos premières entrées et sorties</p>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Article</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Quantité</TableHead>
                        <TableHead className="hidden md:table-cell">Motif</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((trans) => (
                        <TableRow key={trans.id}>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(parseISO(trans.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {trans.stock_items?.name || 'Article inconnu'}
                          </TableCell>
                          <TableCell>{getTransactionTypeBadge(trans.type)}</TableCell>
                          <TableCell className="font-semibold text-sm">
                            <span className={trans.type === 'in' ? 'text-emerald-600' : 'text-red-600'}>
                              {trans.type === 'in' ? '+' : '-'}{trans.quantity}
                            </span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {trans.reason || '—'}
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

      {/* ─── Item Create/Edit Dialog ───────────────────────────────────── */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editMode ? (
                <><Pencil className="h-5 w-5 text-amber-600" /> Modifier l&apos;article</>
              ) : (
                <><Plus className="h-5 w-5 text-amber-600" /> Nouvel article</>
              )}
            </DialogTitle>
            <DialogDescription>
              {editMode ? 'Modifiez les informations de l\'article' : 'Ajoutez un nouvel article au stock'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="stock-name">Nom *</Label>
              <Input
                id="stock-name"
                placeholder="Nom de l'article"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock-qty">Quantité initiale *</Label>
                <Input
                  id="stock-qty"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={formQuantity}
                  onChange={(e) => setFormQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock-unit">Unité *</Label>
                <Select value={formUnit} onValueChange={setFormUnit}>
                  <SelectTrigger id="stock-unit">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {STOCK_UNITS.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock-threshold">Seuil minimum *</Label>
              <Input
                id="stock-threshold"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={formMinThreshold}
                onChange={(e) => setFormMinThreshold(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Alerte quand la quantité est en dessous de ce seuil</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              disabled={submitting}
              onClick={handleItemSubmit}
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
              Êtes-vous sûr de vouloir supprimer <strong>« {deleteTarget?.name} »</strong> du stock ?
              Cette action est irréversible. Les mouvements associés seront conservés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeleteItem}
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

      {/* ─── Quick Transaction Dialog ──────────────────────────────────── */}
      <Dialog open={quickTransOpen} onOpenChange={setQuickTransOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {quickTransType === 'in' ? (
                <><ArrowDownCircle className="h-5 w-5 text-emerald-600" /> Entrée de stock</>
              ) : (
                <><ArrowUpCircle className="h-5 w-5 text-red-600" /> Sortie de stock</>
              )}
            </DialogTitle>
            <DialogDescription>
              {quickTransItem && `${quickTransItem.name} — Stock actuel : ${quickTransItem.quantity} ${getUnitLabel(quickTransItem.unit)}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quick-qty">Quantité *</Label>
              <Input
                id="quick-qty"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0"
                value={quickTransQty}
                onChange={(e) => setQuickTransQty(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-reason">Motif</Label>
              <Textarea
                id="quick-reason"
                placeholder="Raison de cette opération (optionnel)"
                value={quickTransReason}
                onChange={(e) => setQuickTransReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickTransOpen(false)} disabled={quickTransSubmitting}>
              Annuler
            </Button>
            <Button
              className={quickTransType === 'in'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'}
              disabled={quickTransSubmitting}
              onClick={handleQuickTransaction}
            >
              {quickTransSubmitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enregistrement...</>
              ) : quickTransType === 'in' ? (
                <><ArrowDownCircle className="h-4 w-4 mr-2" /> Enregistrer l&apos;entrée</>
              ) : (
                <><ArrowUpCircle className="h-4 w-4 mr-2" /> Enregistrer la sortie</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Full Transaction Dialog ───────────────────────────────────── */}
      <Dialog open={transDialogOpen} onOpenChange={setTransDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-amber-600" />
              Nouveau mouvement de stock
            </DialogTitle>
            <DialogDescription>
              Enregistrez une entrée ou une sortie de stock
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="trans-item">Article *</Label>
              <Select value={transItemId} onValueChange={setTransItemId}>
                <SelectTrigger id="trans-item">
                  <SelectValue placeholder="Sélectionner un article" />
                </SelectTrigger>
                <SelectContent>
                  {stockItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.quantity} {getUnitLabel(item.unit)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="trans-type">Type *</Label>
                <Select value={transType} onValueChange={(v) => setTransType(v as 'in' | 'out')}>
                  <SelectTrigger id="trans-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Entrée</SelectItem>
                    <SelectItem value="out">Sortie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="trans-qty">Quantité *</Label>
                <Input
                  id="trans-qty"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0"
                  value={transQty}
                  onChange={(e) => setTransQty(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trans-reason">Motif</Label>
              <Textarea
                id="trans-reason"
                placeholder="Raison de cette opération (optionnel)"
                value={transReason}
                onChange={(e) => setTransReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTransDialogOpen(false)} disabled={transSubmitting}>
              Annuler
            </Button>
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              disabled={transSubmitting}
              onClick={handleTransSubmit}
            >
              {transSubmitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enregistrement...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Enregistrer</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
