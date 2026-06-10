'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Wallet,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  TrendingDown,
  TrendingUp,
  ArrowDownRight,
  X,
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

interface ExpensesTabProps {
  onRefresh?: () => void
}

interface ExpenseCategory {
  id: string
  hotel_id: string
  name: string
  type: string
  created_at: string
}

interface Expense {
  id: string
  hotel_id: string
  category_id: string | null
  amount: number
  description: string
  expense_date: string
  payment_method: string | null
  receipt_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  expense_categories?: ExpenseCategory | null
  profiles?: { first_name: string; last_name: string } | null
}

interface ExpenseStats {
  total_expenses_month: number
  total_expenses_year: number
  expenses_by_type: Record<string, number>
}

type SubTab = 'list' | 'categories'

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_TYPES = [
  { value: 'operating', label: 'Exploitation', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'payroll', label: 'Salaires', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'supply', label: 'Approvisionnement', color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { value: 'utility', label: 'Services publics', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { value: 'marketing', label: 'Marketing', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { value: 'other', label: 'Autres', color: 'bg-gray-100 text-gray-700 border-gray-200' },
]

const PAYMENT_METHOD_OPTIONS = [
  { value: 'OM', label: 'Orange Money' },
  { value: 'MTN', label: 'MTN Money' },
  { value: 'Wave', label: 'Wave' },
  { value: 'Espèces', label: 'Espèces' },
  { value: 'Chèque', label: 'Chèque' },
  { value: 'Carte', label: 'Carte bancaire' },
  { value: 'Virement', label: 'Virement' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

function getCategoryTypeBadge(type: string) {
  const ct = CATEGORY_TYPES.find(c => c.value === type)
  if (!ct) return <Badge variant="secondary">{type}</Badge>
  return <Badge className={`${ct.color} hover:${ct.color}`}>{ct.label}</Badge>
}

function getCategoryTypeLabel(type: string): string {
  return CATEGORY_TYPES.find(c => c.value === type)?.label || type
}

function getPaymentMethodBadge(method: string | null) {
  if (!method) return <span className="text-xs text-muted-foreground">—</span>
  const m = PAYMENT_METHOD_OPTIONS.find(p => p.value === method)
  return <Badge variant="outline" className="text-[10px]">{m?.label || method}</Badge>
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ExpensesTab({ onRefresh }: ExpensesTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('list')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [stats, setStats] = useState<ExpenseStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Expense dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formExpenseDate, setFormExpenseDate] = useState('')
  const [formPaymentMethod, setFormPaymentMethod] = useState('')

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Category dialog
  const [catDialogOpen, setCatDialogOpen] = useState(false)
  const [catFormName, setCatFormName] = useState('')
  const [catFormType, setCatFormType] = useState('other')
  const [catSubmitting, setCatSubmitting] = useState(false)

  // ─── Fetch data ───────────────────────────────────────────────────────
  const fetchExpenses = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (searchQuery.trim()) params.set('search', searchQuery.trim())
      if (categoryFilter && categoryFilter !== 'all') params.set('category_id', categoryFilter)
      if (typeFilter && typeFilter !== 'all') params.set('type', typeFilter)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)

      const res = await fetch(`/api/owner/expenses?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setExpenses(data.expenses || [])
        setCategories(data.categories || [])
        if (data.stats) setStats(data.stats)
      }
    } catch {
      toast.error('Erreur lors du chargement des dépenses')
    }
  }, [searchQuery, categoryFilter, typeFilter, dateFrom, dateTo])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    await fetchExpenses()
    setLoading(false)
  }, [fetchExpenses])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ─── Form helpers ─────────────────────────────────────────────────────
  function resetForm() {
    setFormCategoryId('')
    setFormAmount('')
    setFormDescription('')
    setFormExpenseDate(new Date().toISOString().split('T')[0])
    setFormPaymentMethod('')
  }

  function openCreateDialog() {
    resetForm()
    setEditMode(false)
    setSelectedExpense(null)
    setDialogOpen(true)
  }

  function openEditDialog(expense: Expense) {
    setEditMode(true)
    setSelectedExpense(expense)
    setFormCategoryId(expense.category_id || '')
    setFormAmount(expense.amount.toString())
    setFormDescription(expense.description)
    setFormExpenseDate(expense.expense_date)
    setFormPaymentMethod(expense.payment_method || '')
    setDialogOpen(true)
  }

  // ─── Submit expense ───────────────────────────────────────────────────
  async function handleExpenseSubmit() {
    if (!formDescription.trim()) {
      toast.error('La description est requise')
      return
    }
    if (!formAmount || parseInt(formAmount) <= 0) {
      toast.error('Le montant doit être positif')
      return
    }
    if (!formExpenseDate) {
      toast.error('La date est requise')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        category_id: formCategoryId || null,
        amount: parseInt(formAmount),
        description: formDescription.trim(),
        expense_date: formExpenseDate,
        payment_method: formPaymentMethod || null,
      }

      let res: Response
      if (editMode && selectedExpense) {
        res = await fetch(`/api/owner/expenses/${selectedExpense.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/owner/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        toast.success(editMode ? 'Dépense modifiée' : 'Dépense ajoutée')
        setDialogOpen(false)
        resetForm()
        fetchExpenses()
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

  // ─── Delete expense ───────────────────────────────────────────────────
  async function handleDeleteExpense() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/owner/expenses/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Dépense supprimée')
        setDeleteDialogOpen(false)
        setDeleteTarget(null)
        fetchExpenses()
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

  // ─── Category management ──────────────────────────────────────────────
  function openCatDialog() {
    setCatFormName('')
    setCatFormType('other')
    setCatDialogOpen(true)
  }

  async function handleCatSubmit() {
    if (!catFormName.trim()) {
      toast.error('Le nom de la catégorie est requis')
      return
    }

    setCatSubmitting(true)
    try {
      const res = await fetch('/api/owner/expenses/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: catFormName.trim(), type: catFormType }),
      })

      if (res.ok) {
        toast.success(`Catégorie « ${catFormName.trim()} » créée`)
        setCatDialogOpen(false)
        fetchExpenses()
        onRefresh?.()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la création')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setCatSubmitting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">💸 Suivi des Dépenses</h2>
          <p className="text-muted-foreground">
            {expenses.length} dépense{expenses.length !== 1 ? 's' : ''} enregistrée{expenses.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchAll(); onRefresh?.() }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-red-200/60 bg-gradient-to-br from-red-50/50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-red-600">Dépenses du mois</p>
                  <p className="text-lg font-bold text-red-700">{formatFCFA(stats.total_expenses_month)}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-200/60 bg-gradient-to-br from-orange-50/50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-orange-600">Dépenses de l&apos;année</p>
                  <p className="text-lg font-bold text-orange-700">{formatFCFA(stats.total_expenses_year)}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                  <Wallet className="h-5 w-5 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50/50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-600">Répartition par type</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(stats.expenses_by_type).slice(0, 3).map(([type, amount]) => (
                      <span key={type} className="text-[10px] font-medium text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
                        {getCategoryTypeLabel(type)}: {formatFCFA(amount as number)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                  <ArrowDownRight className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sub-tabs */}
      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as SubTab)}>
        <TabsList className="bg-amber-50 border border-amber-200/60">
          <TabsTrigger value="list" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            📋 Liste des dépenses
          </TabsTrigger>
          <TabsTrigger value="categories" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            🏷️ Catégories
          </TabsTrigger>
        </TabsList>

        {/* ─── Expenses List ─────────────────────────────────────────── */}
        <TabsContent value="list" className="space-y-4 mt-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="relative sm:col-span-2 lg:col-span-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <Filter className="h-4 w-4 mr-2 text-gray-400" />
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les catégories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    {CATEGORY_TYPES.map((ct) => (
                      <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add button */}
          <div className="flex items-center justify-end">
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              onClick={openCreateDialog}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle dépense
            </Button>
          </div>

          {/* Expenses table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : expenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-400 mb-3">
                    <Wallet className="h-7 w-7" />
                  </div>
                  <p className="text-muted-foreground">Aucune dépense enregistrée</p>
                  <p className="text-xs text-muted-foreground mt-1">Commencez par ajouter vos premières dépenses</p>
                  <Button
                    className="mt-4 bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={openCreateDialog}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter une dépense
                  </Button>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="hidden sm:table-cell">Catégorie</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead className="hidden md:table-cell">Paiement</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(parseISO(expense.expense_date), 'dd/MM/yyyy', { locale: fr })}
                          </TableCell>
                          <TableCell className="font-medium text-sm max-w-[200px] truncate">
                            {expense.description}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {expense.expense_categories ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-medium">{expense.expense_categories.name}</span>
                                {getCategoryTypeBadge(expense.expense_categories.type)}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Non catégorisé</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-sm text-red-600">
                              -{formatFCFA(expense.amount)}
                            </span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {getPaymentMethodBadge(expense.payment_method)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEditDialog(expense)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700"
                                onClick={() => {
                                  setDeleteTarget(expense)
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

        {/* ─── Categories Sub-tab ─────────────────────────────────────── */}
        <TabsContent value="categories" className="space-y-4 mt-4">
          <div className="flex items-center justify-end">
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              onClick={openCatDialog}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle catégorie
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
              ) : categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground">Aucune catégorie</p>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="hidden sm:table-cell">Nombre de dépenses</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((cat) => {
                        const count = expenses.filter(e => e.category_id === cat.id).length
                        return (
                          <TableRow key={cat.id}>
                            <TableCell className="font-medium text-sm">{cat.name}</TableCell>
                            <TableCell>{getCategoryTypeBadge(cat.type)}</TableCell>
                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                              {count} dépense{count !== 1 ? 's' : ''}
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
        </TabsContent>
      </Tabs>

      {/* ─── Expense Create/Edit Dialog ───────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editMode ? (
                <><Pencil className="h-5 w-5 text-amber-600" /> Modifier la dépense</>
              ) : (
                <><Plus className="h-5 w-5 text-amber-600" /> Nouvelle dépense</>
              )}
            </DialogTitle>
            <DialogDescription>
              {editMode ? 'Modifiez les informations de la dépense' : 'Enregistrez une nouvelle dépense'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="exp-desc">Description *</Label>
              <Textarea
                id="exp-desc"
                placeholder="Description de la dépense"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="exp-amount">Montant (FCFA) *</Label>
                <Input
                  id="exp-amount"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="0"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-date">Date *</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={formExpenseDate}
                  onChange={(e) => setFormExpenseDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exp-category">Catégorie</Label>
              <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                <SelectTrigger id="exp-category">
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name} ({getCategoryTypeLabel(cat.type)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exp-payment">Mode de paiement</Label>
              <Select value={formPaymentMethod} onValueChange={setFormPaymentMethod}>
                <SelectTrigger id="exp-payment">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.map((pm) => (
                    <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              disabled={submitting}
              onClick={handleExpenseSubmit}
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

      {/* ─── Delete Confirmation ─────────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirmer la suppression
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la dépense <strong>« {deleteTarget?.description} »</strong> de {deleteTarget ? formatFCFA(deleteTarget.amount) : ''} ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeleteExpense}
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

      {/* ─── Category Create Dialog ──────────────────────────────────── */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-amber-600" />
              Nouvelle catégorie
            </DialogTitle>
            <DialogDescription>
              Ajoutez une catégorie de dépense
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nom *</Label>
              <Input
                id="cat-name"
                placeholder="Nom de la catégorie"
                value={catFormName}
                onChange={(e) => setCatFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-type">Type</Label>
              <Select value={catFormType} onValueChange={setCatFormType}>
                <SelectTrigger id="cat-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)} disabled={catSubmitting}>
              Annuler
            </Button>
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              disabled={catSubmitting}
              onClick={handleCatSubmit}
            >
              {catSubmitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Création...</>
              ) : (
                <><Plus className="h-4 w-4 mr-2" /> Créer</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
