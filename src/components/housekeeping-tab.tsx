'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Sparkles,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Play,
  SkipForward,
  Trash2,
  StickyNote,
  User,
  Calendar,
  Filter,
  X,
  ChevronDown,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

// ─── Types ────────────────────────────────────────────────────

interface HousekeepingTask {
  id: string
  hotel_id: string
  room_id: string
  assigned_to: string | null
  task_type: 'checkout_cleaning' | 'deep_cleaning' | 'maintenance_cleaning' | 'inspection'
  priority: 'urgent' | 'high' | 'normal' | 'low'
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  notes: string | null
  due_date: string
  completed_at: string | null
  created_at: string
  rooms?: { id: string; room_number: string; room_type: string; status: string }
  profiles?: { id: string; first_name: string; last_name: string } | null
}

interface RoomInfo {
  id: string
  room_number: string
  room_type: string
  status: string
}

interface EmployeeInfo {
  id: string
  first_name: string
  last_name: string
  role: string
}

// ─── Helpers ──────────────────────────────────────────────────

const TASK_TYPE_LABELS: Record<string, string> = {
  checkout_cleaning: 'Ménage départ',
  deep_cleaning: 'Grand nettoyage',
  maintenance_cleaning: 'Nettoyage maintenance',
  inspection: 'Inspection',
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  high: 'Haute',
  normal: 'Normale',
  low: 'Basse',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminé',
  skipped: 'Ignoré',
}

function getTaskTypeBadge(type: string) {
  switch (type) {
    case 'checkout_cleaning':
      return <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100 text-xs">Ménage départ</Badge>
    case 'deep_cleaning':
      return <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100 text-xs">Grand nettoyage</Badge>
    case 'maintenance_cleaning':
      return <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100 text-xs">Nettoyage maintenance</Badge>
    case 'inspection':
      return <Badge className="bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-100 text-xs">Inspection</Badge>
    default:
      return <Badge variant="secondary" className="text-xs">{type}</Badge>
  }
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'urgent':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs">Urgent</Badge>
    case 'high':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs">Haute</Badge>
    case 'normal':
      return <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100 text-xs">Normale</Badge>
    case 'low':
      return <Badge className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100 text-xs">Basse</Badge>
    default:
      return <Badge variant="secondary" className="text-xs">{priority}</Badge>
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs">En attente</Badge>
    case 'in_progress':
      return <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100 text-xs">En cours</Badge>
    case 'completed':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs">Terminé</Badge>
    case 'skipped':
      return <Badge className="bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100 text-xs">Ignoré</Badge>
    default:
      return <Badge variant="secondary" className="text-xs">{status}</Badge>
  }
}

function formatDateFR(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
    })
  } catch {
    return dateStr
  }
}

// ─── Component ────────────────────────────────────────────────

export function HousekeepingTab({ onRefresh }: { onRefresh: () => void }) {
  const [tasks, setTasks] = useState<HousekeepingTask[]>([])
  const [rooms, setRooms] = useState<RoomInfo[]>([])
  const [employees, setEmployees] = useState<EmployeeInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Filtres
  const [dateFilter, setDateFilter] = useState<string>('today')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [assignedFilter, setAssignedFilter] = useState<string>('all')

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [notesSheetOpen, setNotesSheetOpen] = useState(false)
  const [assignSheetOpen, setAssignSheetOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<HousekeepingTask | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Create form state
  const [formRoomId, setFormRoomId] = useState('')
  const [formTaskType, setFormTaskType] = useState('checkout_cleaning')
  const [formPriority, setFormPriority] = useState('normal')
  const [formAssignedTo, setFormAssignedTo] = useState('')
  const [formDueDate, setFormDueDate] = useState(new Date().toISOString().split('T')[0])
  const [formNotes, setFormNotes] = useState('')

  // Notes editing
  const [editNotes, setEditNotes] = useState('')

  // ─── Date helper ──────────────────────────────────────────
  function getDateFilterValue(): string {
    const today = new Date()
    switch (dateFilter) {
      case 'today':
        return today.toISOString().split('T')[0]
      case 'tomorrow': {
        const d = new Date(today)
        d.setDate(d.getDate() + 1)
        return d.toISOString().split('T')[0]
      }
      case 'week': {
        // Retourner la date de début de semaine pour le filtre
        const d = new Date(today)
        d.setDate(d.getDate() + 7)
        return d.toISOString().split('T')[0]
      }
      default:
        return today.toISOString().split('T')[0]
    }
  }

  // ─── Fetch data ───────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFilter !== 'all') {
        params.set('date', getDateFilterValue())
      }
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (assignedFilter !== 'all') params.set('assigned_to', assignedFilter)

      const res = await fetch(`/api/owner/housekeeping?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data.tasks || [])
      } else {
        toast.error('Erreur lors du chargement des tâches')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [dateFilter, statusFilter, assignedFilter])

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/owner/rooms')
      if (res.ok) {
        const data = await res.json()
        setRooms(data.rooms || [])
      }
    } catch {
      // Silently fail
    }
  }, [])

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/owner/employees')
      if (res.ok) {
        const data = await res.json()
        // Filtrer uniquement les housekeepers
        const housekeepers = (data.employees || []).filter(
          (e: EmployeeInfo) => e.role === 'housekeeper' && e.status !== 'suspended'
        )
        setEmployees(housekeepers)
      }
    } catch {
      // En mode démo, utiliser des données fictives
      setEmployees([
        { id: 'demo-hk-001', first_name: 'Awa', last_name: 'Traoré', role: 'housekeeper' },
        { id: 'demo-hk-002', first_name: 'Mamadou', last_name: 'Diabaté', role: 'housekeeper' },
      ])
    }
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [dateFilter, statusFilter, assignedFilter])

  useEffect(() => {
    fetchRooms()
    fetchEmployees()
  }, [])

  // ─── Stats ────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]
  const pendingCount = tasks.filter(t => t.status === 'pending').length
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length
  const completedTodayCount = tasks.filter(t => t.status === 'completed' && t.due_date === today).length
  const overdueCount = tasks.filter(t => t.status === 'pending' && t.due_date < today).length

  // ─── Actions ──────────────────────────────────────────────
  const handleStatusChange = async (taskId: string, newStatus: string) => {
    setActionLoading(taskId)
    try {
      const res = await fetch(`/api/owner/housekeeping/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const statusLabel = STATUS_LABELS[newStatus] || newStatus
        toast.success(`Tâche marquée "${statusLabel}"`)
        fetchTasks()
        onRefresh()
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

  const handleDelete = async (taskId: string) => {
    if (!confirm('Supprimer cette tâche ?')) return
    setActionLoading(taskId)
    try {
      const res = await fetch(`/api/owner/housekeeping/${taskId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Tâche supprimée')
        fetchTasks()
        onRefresh()
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setActionLoading(null)
    }
  }

  const handleAssign = async (taskId: string, assignedTo: string) => {
    setActionLoading(taskId)
    try {
      const res = await fetch(`/api/owner/housekeeping/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: assignedTo || null }),
      })
      if (res.ok) {
        const hk = employees.find(e => e.id === assignedTo)
        toast.success(assignedTo ? `Tâche assignée à ${hk?.first_name} ${hk?.last_name}` : 'Tâche désassignée')
        fetchTasks()
      } else {
        toast.error('Erreur lors de l\'assignation')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setActionLoading(null)
      setAssignSheetOpen(false)
    }
  }

  const handleSaveNotes = async (taskId: string, notes: string) => {
    setActionLoading(taskId)
    try {
      const res = await fetch(`/api/owner/housekeeping/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (res.ok) {
        toast.success('Notes mises à jour')
        fetchTasks()
      } else {
        toast.error('Erreur lors de la mise à jour')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setActionLoading(null)
      setNotesSheetOpen(false)
    }
  }

  const handleCreateTask = async () => {
    if (!formRoomId || !formDueDate) {
      toast.error('Chambre et date d\'échéance sont requises')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/owner/housekeeping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: formRoomId,
          task_type: formTaskType,
          priority: formPriority,
          assigned_to: formAssignedTo || null,
          due_date: formDueDate,
          notes: formNotes || null,
        }),
      })
      if (res.ok) {
        toast.success('Tâche de ménage créée')
        setCreateDialogOpen(false)
        resetForm()
        fetchTasks()
        onRefresh()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la création')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setFormRoomId('')
    setFormTaskType('checkout_cleaning')
    setFormPriority('normal')
    setFormAssignedTo('')
    setFormDueDate(new Date().toISOString().split('T')[0])
    setFormNotes('')
  }

  // Filtrer les tâches par priorité (côté client)
  const filteredTasks = tasks.filter(t => {
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    return true
  })

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ─── En-tête ──────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-amber-500" />
            Planification du Ménage
          </h2>
          <p className="text-sm text-gray-500 mt-1">Gérez les tâches de ménage et d&apos;inspection de votre hôtel</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchTasks(); onRefresh() }}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nouvelle tâche
          </Button>
        </div>
      </div>

      {/* ─── Tableau de bord récapitulatif ─────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-amber-200/50 bg-gradient-to-br from-amber-50 to-amber-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Clock className="h-5 w-5 text-amber-500" />
              <span className="text-3xl font-bold text-amber-700">{pendingCount}</span>
            </div>
            <p className="text-sm font-medium text-amber-800 mt-2">En attente</p>
          </CardContent>
        </Card>
        <Card className="border-sky-200/50 bg-gradient-to-br from-sky-50 to-sky-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Loader2 className="h-5 w-5 text-sky-500" />
              <span className="text-3xl font-bold text-sky-700">{inProgressCount}</span>
            </div>
            <p className="text-sm font-medium text-sky-800 mt-2">En cours</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-emerald-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span className="text-3xl font-bold text-emerald-700">{completedTodayCount}</span>
            </div>
            <p className="text-sm font-medium text-emerald-800 mt-2">Terminé aujourd&apos;hui</p>
          </CardContent>
        </Card>
        <Card className="border-red-200/50 bg-gradient-to-br from-red-50 to-red-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-3xl font-bold text-red-700">{overdueCount}</span>
            </div>
            <p className="text-sm font-medium text-red-800 mt-2">En retard</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Filtres ──────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filtres</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Date</Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Aujourd&apos;hui</SelectItem>
                  <SelectItem value="tomorrow">Demain</SelectItem>
                  <SelectItem value="week">Cette semaine</SelectItem>
                  <SelectItem value="all">Toutes les dates</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Statut</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="completed">Terminé</SelectItem>
                  <SelectItem value="skipped">Ignoré</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Priorité</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="normal">Normale</SelectItem>
                  <SelectItem value="low">Basse</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Assigné à</Label>
              <Select value={assignedFilter} onValueChange={setAssignedFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="unassigned">Non assigné</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Liste des tâches ──────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Sparkles className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Aucune tâche de ménage trouvée</p>
            <p className="text-sm text-gray-400 mt-1">
              Créez une nouvelle tâche ou modifiez les filtres
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chambre</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Priorité</TableHead>
                      <TableHead>Assigné à</TableHead>
                      <TableHead>Échéance</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTasks.map(task => (
                      <TableRow key={task.id} className={task.status === 'completed' ? 'opacity-60' : ''}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{task.rooms?.room_number || '—'}</span>
                            <span className="text-xs text-gray-400">{task.rooms?.room_type || ''}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getTaskTypeBadge(task.task_type)}</TableCell>
                        <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                        <TableCell>
                          {task.profiles ? (
                            <span className="text-sm">{task.profiles.first_name} {task.profiles.last_name}</span>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Non assigné</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{formatDateFR(task.due_date)}</span>
                          {task.due_date < today && task.status === 'pending' && (
                            <span className="text-xs text-red-500 ml-1">(En retard)</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(task.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {task.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-sky-600 hover:text-sky-700 hover:bg-sky-50"
                                onClick={() => handleStatusChange(task.id, 'in_progress')}
                                disabled={actionLoading === task.id}
                                title="Démarrer"
                              >
                                {actionLoading === task.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                              </Button>
                            )}
                            {task.status === 'in_progress' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => handleStatusChange(task.id, 'completed')}
                                disabled={actionLoading === task.id}
                                title="Terminer"
                              >
                                {actionLoading === task.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              </Button>
                            )}
                            {(task.status === 'pending' || task.status === 'in_progress') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                onClick={() => handleStatusChange(task.id, 'skipped')}
                                disabled={actionLoading === task.id}
                                title="Ignorer"
                              >
                                <SkipForward className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                              onClick={() => {
                                setSelectedTask(task)
                                setAssignSheetOpen(true)
                              }}
                              title="Assigner"
                            >
                              <User className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                              onClick={() => {
                                setSelectedTask(task)
                                setEditNotes(task.notes || '')
                                setNotesSheetOpen(true)
                              }}
                              title="Notes"
                            >
                              <StickyNote className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleDelete(task.id)}
                              disabled={actionLoading === task.id}
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredTasks.map(task => (
              <Card key={task.id} className={`${task.status === 'completed' ? 'opacity-60' : ''} ${task.priority === 'urgent' ? 'border-red-300' : task.priority === 'high' ? 'border-amber-300' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{task.rooms?.room_number || '—'}</span>
                      {getTaskTypeBadge(task.task_type)}
                    </div>
                    {getStatusBadge(task.status)}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    {getPriorityBadge(task.priority)}
                    <span className="text-xs text-gray-400">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      {formatDateFR(task.due_date)}
                      {task.due_date < today && task.status === 'pending' && (
                        <span className="text-red-500 ml-1">(En retard)</span>
                      )}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mb-3">
                    {task.profiles ? (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {task.profiles.first_name} {task.profiles.last_name}
                      </span>
                    ) : (
                      <span className="italic">Non assigné</span>
                    )}
                  </div>
                  {task.notes && (
                    <p className="text-xs text-gray-500 mb-3 bg-gray-50 rounded p-2">{task.notes}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {task.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 text-sky-600 border-sky-200 hover:bg-sky-50"
                        onClick={() => handleStatusChange(task.id, 'in_progress')}
                        disabled={actionLoading === task.id}
                      >
                        {actionLoading === task.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                        Démarrer
                      </Button>
                    )}
                    {task.status === 'in_progress' && (
                      <Button
                        size="sm"
                        className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleStatusChange(task.id, 'completed')}
                        disabled={actionLoading === task.id}
                      >
                        {actionLoading === task.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                        Terminer
                      </Button>
                    )}
                    {(task.status === 'pending' || task.status === 'in_progress') && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 text-gray-500 border-gray-200"
                        onClick={() => handleStatusChange(task.id, 'skipped')}
                        disabled={actionLoading === task.id}
                      >
                        <SkipForward className="h-4 w-4 mr-1" />
                        Ignorer
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 text-amber-600 border-amber-200 hover:bg-amber-50"
                      onClick={() => {
                        setSelectedTask(task)
                        setAssignSheetOpen(true)
                      }}
                    >
                      <User className="h-4 w-4 mr-1" />
                      Assigner
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 text-gray-400"
                      onClick={() => {
                        setSelectedTask(task)
                        setEditNotes(task.notes || '')
                        setNotesSheetOpen(true)
                      }}
                    >
                      <StickyNote className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ─── Créer une tâche ───────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Nouvelle tâche de ménage
            </DialogTitle>
            <DialogDescription>
              Planifiez une tâche de ménage ou d&apos;inspection
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Chambre *</Label>
              <Select value={formRoomId} onValueChange={setFormRoomId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une chambre" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map(room => (
                    <SelectItem key={room.id} value={room.id}>
                      Chambre {room.room_number} — {room.room_type} ({STATUS_LABELS[room.status] || room.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type de tâche</Label>
              <Select value={formTaskType} onValueChange={setFormTaskType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checkout_cleaning">Ménage départ</SelectItem>
                  <SelectItem value="deep_cleaning">Grand nettoyage</SelectItem>
                  <SelectItem value="maintenance_cleaning">Nettoyage maintenance</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priorité</Label>
              <Select value={formPriority} onValueChange={setFormPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgente</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="normal">Normale</SelectItem>
                  <SelectItem value="low">Basse</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assigner à</Label>
              <Select value={formAssignedTo} onValueChange={setFormAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Non assigné" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Non assigné</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date d&apos;échéance *</Label>
              <Input
                type="date"
                value={formDueDate}
                onChange={e => setFormDueDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Instructions spéciales, détails..."
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateTask} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
              Créer la tâche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Feuille de notes ──────────────────────────────── */}
      <Sheet open={notesSheetOpen} onOpenChange={setNotesSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-amber-500" />
              Notes — Chambre {selectedTask?.rooms?.room_number || ''}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <Textarea
              placeholder="Ajoutez des notes ou instructions..."
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              rows={6}
            />
            <Button
              className="w-full"
              onClick={() => {
                if (selectedTask) handleSaveNotes(selectedTask.id, editNotes)
              }}
              disabled={actionLoading === selectedTask?.id}
            >
              {actionLoading === selectedTask?.id ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Enregistrer
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ─── Feuille d&apos;assignation ──────────────────────── */}
      <Sheet open={assignSheetOpen} onOpenChange={setAssignSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-amber-500" />
              Assigner — Chambre {selectedTask?.rooms?.room_number || ''}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start h-12"
              onClick={() => {
                if (selectedTask) handleAssign(selectedTask.id, '')
              }}
              disabled={actionLoading === selectedTask?.id}
            >
              <X className="h-4 w-4 mr-2 text-gray-400" />
              <span className="text-gray-500 italic">Désassigner</span>
            </Button>
            {employees.map(emp => (
              <Button
                key={emp.id}
                variant={selectedTask?.assigned_to === emp.id ? 'default' : 'outline'}
                className="w-full justify-start h-12"
                onClick={() => {
                  if (selectedTask) handleAssign(selectedTask.id, emp.id)
                }}
                disabled={actionLoading === selectedTask?.id}
              >
                <User className="h-4 w-4 mr-2" />
                {emp.first_name} {emp.last_name}
                {selectedTask?.assigned_to === emp.id && <CheckCircle2 className="h-4 w-4 ml-auto text-emerald-500" />}
              </Button>
            ))}
            {employees.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                Aucun employé de ménage trouvé.
                <br />
                Ajoutez des housekeepers dans l&apos;onglet Équipe.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
