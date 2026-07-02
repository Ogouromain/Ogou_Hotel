'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Activity,
  RefreshCw,
  Loader2,
  Filter,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  BarChart3,
  CalendarDays,
  Shield,
  Eye,
  ChevronUp,
  FileText,
  BookOpen,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActivityLogTabProps {
  onRefresh?: () => void
}

interface ProfileInfo {
  first_name: string
  last_name: string
  role: string
}

interface AuditLogEntry {
  id: string
  hotel_id: string
  profile_id: string
  action: string
  entity_type: string
  entity_id: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: string
  profiles: ProfileInfo
}

interface EmployeeSummary {
  profile_id: string
  first_name: string
  last_name: string
  role: string
  action_count: number
  actions_breakdown: Record<string, number>
}

interface SummaryData {
  total_actions: number
  actions_by_type: Record<string, number>
  employees: EmployeeSummary[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  check_in: 'Check-in',
  check_out: 'Check-out',
  cancel: 'Annulation',
  create: 'Création',
  update: 'Modification',
  walk_in: 'Enregistrement direct',
  reset_password: 'Réinitialisation mot de passe',
}

const ACTION_DESCRIPTIONS: Record<string, string> = {
  check_in: 'Check-in effectué',
  check_out: 'Check-out effectué',
  cancel: 'Annulation effectuée',
  create: 'Création effectuée',
  update: 'Modification effectuée',
  walk_in: 'Enregistrement direct effectué',
  reset_password: 'Mot de passe réinitialisé',
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  reservation: 'Réservation',
  customer: 'Client',
  invoice: 'Facture',
  room: 'Chambre',
  employee: 'Employé',
}

const ROLE_BADGE_CLASSES: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-700 border-amber-200',
  manager: 'bg-purple-100 text-purple-700 border-purple-200',
  receptionist: 'bg-sky-100 text-sky-700 border-sky-200',
  housekeeper: 'bg-teal-100 text-teal-700 border-teal-200',
  restaurant_staff: 'bg-orange-100 text-orange-700 border-orange-200',
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  manager: 'Manager',
  receptionist: 'Réceptionniste',
  housekeeper: 'Ménage',
  restaurant_staff: 'Restaurant',
}

const ACTION_TYPE_COLORS: Record<string, string> = {
  check_in: 'bg-emerald-500',
  check_out: 'bg-sky-500',
  cancel: 'bg-red-500',
  create: 'bg-amber-500',
  update: 'bg-purple-500',
  walk_in: 'bg-teal-500',
  reset_password: 'bg-orange-500',
}

const ACTION_BADGE_CLASSES: Record<string, string> = {
  check_in: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  check_out: 'bg-sky-100 text-sky-700 border-sky-200',
  cancel: 'bg-red-100 text-red-700 border-red-200',
  create: 'bg-amber-100 text-amber-700 border-amber-200',
  update: 'bg-purple-100 text-purple-700 border-purple-200',
  walk_in: 'bg-teal-100 text-teal-700 border-teal-200',
  reset_password: 'bg-orange-100 text-orange-700 border-orange-200',
}

const PAGE_SIZE = 50

// ─── Helper Functions ────────────────────────────────────────────────────────

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action
}

function getActionDescription(action: string, entityType: string): string {
  const entityLabel = ENTITY_TYPE_LABELS[entityType] || entityType
  const actionDesc = ACTION_DESCRIPTIONS[action]
  if (actionDesc && entityLabel) {
    return `${entityLabel} — ${actionDesc.toLowerCase()}`
  }
  if (actionDesc) return actionDesc
  return `${getActionLabel(action)} — ${entityLabel}`
}

function getRoleBadgeClass(role: string): string {
  return ROLE_BADGE_CLASSES[role] || 'bg-gray-100 text-gray-700 border-gray-200'
}

function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] || role
}

function getActionBadgeClass(action: string): string {
  return ACTION_BADGE_CLASSES[action] || 'bg-gray-100 text-gray-700 border-gray-200'
}

function getActionBarColor(action: string): string {
  return ACTION_TYPE_COLORS[action] || 'bg-gray-400'
}

function formatRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: fr })
  } catch {
    return dateStr
  }
}

function formatExactTime(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy à HH:mm', { locale: fr })
  } catch {
    return dateStr
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    status: 'Statut',
    first_name: 'Prénom',
    last_name: 'Nom',
    phone: 'Téléphone',
    email: 'Email',
    room_number: 'Numéro de chambre',
    room_type: 'Type de chambre',
    price_per_night: 'Prix/nuit',
    check_in_date: "Date d'arrivée",
    check_out_date: 'Date de départ',
    total_price: 'Prix total',
    identity_document_type: "Type de document",
    identity_document_number: 'Numéro de document',
    password: 'Mot de passe',
  }
  return labels[field] || field
}

function getDateForPeriod(period: string): { date_from: string; date_to: string } {
  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')

  switch (period) {
    case 'today':
      return { date_from: today, date_to: today }
    case '7days': {
      const from = new Date(now)
      from.setDate(from.getDate() - 6)
      return { date_from: format(from, 'yyyy-MM-dd'), date_to: today }
    }
    case '30days': {
      const from = new Date(now)
      from.setDate(from.getDate() - 29)
      return { date_from: format(from, 'yyyy-MM-dd'), date_to: today }
    }
    default:
      return { date_from: '', date_to: '' }
  }
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge className={`${getRoleBadgeClass(role)} hover:opacity-90 text-[10px] px-1.5 py-0`}>
      {getRoleLabel(role)}
    </Badge>
  )
}

function ActionBadge({ action }: { action: string }) {
  return (
    <Badge className={`${getActionBadgeClass(action)} hover:opacity-90 text-[10px] px-1.5 py-0`}>
      {getActionLabel(action)}
    </Badge>
  )
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function ActivityLogSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>

      {/* Filter bar */}
      <Card className="border-amber-200/40">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-20" />
          </div>
        </CardContent>
      </Card>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-amber-200/40">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <Card className="border-amber-200/40">
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-5 w-32" />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
          <Card className="border-amber-200/40">
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-5 w-40" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Diff Sub-Component ───────────────────────────────────────────────

function DetailDiff({
  oldValues,
  newValues,
}: {
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
}) {
  if (!oldValues && !newValues) {
    return (
      <p className="text-xs text-muted-foreground italic p-2">
        Aucun détail de modification disponible
      </p>
    )
  }

  // For create actions, just show the new values
  if (!oldValues && newValues) {
    return (
      <div className="space-y-1 p-2">
        <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide mb-1">
          Valeurs créées
        </p>
        {Object.entries(newValues).map(([key, val]) => (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground min-w-[100px] truncate">{getFieldLabel(key)}</span>
            <span className="font-medium text-emerald-800 truncate">{formatValue(val)}</span>
          </div>
        ))}
      </div>
    )
  }

  // For delete actions, just show old values
  if (oldValues && !newValues) {
    return (
      <div className="space-y-1 p-2">
        <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide mb-1">
          Valeurs supprimées
        </p>
        {Object.entries(oldValues).map(([key, val]) => (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground min-w-[100px] truncate">{getFieldLabel(key)}</span>
            <span className="font-medium text-red-800 line-through truncate">{formatValue(val)}</span>
          </div>
        ))}
      </div>
    )
  }

  // For update actions, show diff
  const allKeys = Array.from(
    new Set([...Object.keys(oldValues || {}), ...Object.keys(newValues || {})])
  )

  return (
    <div className="space-y-1 p-2">
      <p className="text-[10px] font-semibold text-purple-700 uppercase tracking-wide mb-1">
        Modifications
      </p>
      {allKeys.map((key) => {
        const oldVal = formatValue((oldValues as Record<string, unknown>)?.[key])
        const newVal = formatValue((newValues as Record<string, unknown>)?.[key])
        const changed = oldVal !== newVal

        return (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground min-w-[100px] truncate">{getFieldLabel(key)}</span>
            {changed ? (
              <>
                <span className="text-red-600 line-through truncate max-w-[120px]" title={oldVal}>
                  {oldVal}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium text-emerald-700 truncate max-w-[120px]" title={newVal}>
                  {newVal}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground truncate">{oldVal}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Log Entry Sub-Component ─────────────────────────────────────────────────

function LogEntry({ log }: { log: AuditLogEntry }) {
  const [open, setOpen] = useState(false)
  const hasDetails = log.old_values || log.new_values

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-amber-200/40 bg-white hover:bg-amber-50/30 transition-colors">
        <div className="flex items-start gap-3 p-3 sm:p-4">
          {/* Avatar */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
            {log.profiles?.first_name?.charAt(0) || '?'}{log.profiles?.last_name?.charAt(0) || ''}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-sm text-amber-900">
                {log.profiles?.first_name} {log.profiles?.last_name}
              </span>
              <RoleBadge role={log.profiles?.role || ''} />
              <ActionBadge action={log.action} />
            </div>
            <p className="text-sm text-muted-foreground">
              {getActionDescription(log.action, log.entity_type)}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-default">
                    {formatRelativeTime(log.created_at)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {formatExactTime(log.created_at)}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Expand button */}
          {hasDetails && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="shrink-0 text-amber-600 hover:text-amber-800 h-7 w-7 p-0">
                {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          )}
        </div>

        {/* Expanded details */}
        {hasDetails && (
          <CollapsibleContent>
            <div className="border-t border-amber-200/30 bg-amber-50/20">
              <DetailDiff oldValues={log.old_values} newValues={log.new_values} />
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ActivityLogTab({ onRefresh }: ActivityLogTabProps) {
  // ─── State ────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)

  // Filters
  const [filterAction, setFilterAction] = useState<string>('')
  const [filterEmployee, setFilterEmployee] = useState<string>('')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')
  const [activePeriod, setActivePeriod] = useState<string>('30days')

  // ─── Fetch logs ───────────────────────────────────────────────────────
  const fetchLogs = useCallback(async (newOffset = 0) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(newOffset))
      if (filterAction) params.set('action', filterAction)
      if (filterEmployee) params.set('profile_id', filterEmployee)
      if (filterDateFrom) params.set('date_from', filterDateFrom)
      if (filterDateTo) params.set('date_to', filterDateTo)

      const res = await fetch(`/api/owner/activity-log?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setTotal(data.total || 0)
        setOffset(newOffset)
      } else {
        const errData = await res.json().catch(() => ({}))
        toast.error(errData.error || 'Erreur lors du chargement des logs')
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }, [filterAction, filterEmployee, filterDateFrom, filterDateTo])

  // ─── Fetch summary ────────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('summary', 'true')
      if (filterDateFrom) params.set('date_from', filterDateFrom)
      if (filterDateTo) params.set('date_to', filterDateTo)

      const res = await fetch(`/api/owner/activity-log?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setSummary(data.summary || null)
      } else {
        const errData = await res.json().catch(() => ({}))
        toast.error(errData.error || 'Erreur lors du chargement du résumé')
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setSummaryLoading(false)
    }
  }, [filterDateFrom, filterDateTo])

  // ─── Initial fetch ────────────────────────────────────────────────────
  const initialFetchRef = useRef(false)
  useEffect(() => {
    if (!initialFetchRef.current) {
      initialFetchRef.current = true
      // Set initial date range for 30 days
      const { date_from, date_to } = getDateForPeriod('30days')
      setFilterDateFrom(date_from)
      setFilterDateTo(date_to)
    }
  }, [])

  // Re-fetch when date filters are set from initial load
  const datesInitializedRef = useRef(false)
  useEffect(() => {
    if (filterDateFrom && filterDateTo && !datesInitializedRef.current) {
      datesInitializedRef.current = true
      fetchLogs(0)
      fetchSummary()
    }
  }, [filterDateFrom, filterDateTo, fetchLogs, fetchSummary])

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleFilter = useCallback(() => {
    fetchLogs(0)
    fetchSummary()
  }, [fetchLogs, fetchSummary])

  const handleReset = useCallback(() => {
    setFilterAction('')
    setFilterEmployee('')
    const { date_from, date_to } = getDateForPeriod('30days')
    setFilterDateFrom(date_from)
    setFilterDateTo(date_to)
    setActivePeriod('30days')
  }, [])

  const handlePeriodChange = useCallback((period: string) => {
    setActivePeriod(period)
    const { date_from, date_to } = getDateForPeriod(period)
    setFilterDateFrom(date_from)
    setFilterDateTo(date_to)
  }, [])

  const handleRefresh = useCallback(() => {
    fetchLogs(offset)
    fetchSummary()
    onRefresh?.()
  }, [fetchLogs, fetchSummary, offset, onRefresh])

  // ─── Pagination ───────────────────────────────────────────────────────
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasNext = offset + PAGE_SIZE < total
  const hasPrev = offset > 0

  // ─── Loading skeleton ────────────────────────────────────────────────
  if (loading && logs.length === 0 && !datesInitializedRef.current) {
    return <ActivityLogSkeleton />
  }

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><BookOpen className="h-6 w-6 text-amber-600" /> Journal d&apos;activité</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Suivi des actions effectuées par votre équipe
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* ─── Filter Bar ─────────────────────────────────────────────────── */}
      <Card className="border-amber-200/40">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">Filtres</span>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            {/* Action type */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Type d&apos;action</Label>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue placeholder="Tous les types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {Object.entries(ACTION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employee */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Employé</Label>
              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger className="w-[180px] h-9 text-sm">
                  <SelectValue placeholder="Tous les employés" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les employés</SelectItem>
                  {summary?.employees?.map((emp) => (
                    <SelectItem key={emp.profile_id} value={emp.profile_id}>
                      {emp.first_name} {emp.last_name} ({getRoleLabel(emp.role)})
                    </SelectItem>
                  )) || (
                    <SelectItem value="none" disabled>Chargement...</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Date from */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Du</Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-[140px] h-9 text-sm"
              />
            </div>

            {/* Date to */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Au</Label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-[140px] h-9 text-sm"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-9 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-sm"
                onClick={handleFilter}
                disabled={loading}
              >
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                Filtrer
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-amber-200 text-amber-700 hover:bg-amber-50"
                onClick={handleReset}
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Réinitialiser
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Main Content: Log + Summary ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Left: Activity Log ──────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-amber-200/40">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-5 w-5 text-amber-600" />
                  Historique des actions
                  <Badge variant="secondary" className="text-[10px]">
                    {total} entrée{total !== 1 ? 's' : ''}
                  </Badge>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3 p-3">
                      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-400 mb-3">
                    <FileText className="h-7 w-7" />
                  </div>
                  <p className="text-muted-foreground">Aucune activité enregistrée</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Les actions de votre équipe apparaîtront ici
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-amber-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {logs.map((log) => (
                      <LogEntry key={log.id} log={log} />
                    ))}
                  </div>

                  {/* Pagination */}
                  {total > PAGE_SIZE && (
                    <div className="flex items-center justify-between pt-4 border-t border-amber-200/30 mt-4">
                      <p className="text-xs text-muted-foreground">
                        Page {currentPage} sur {totalPages} • {total} entrée{total !== 1 ? 's' : ''}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-amber-200 text-amber-700 hover:bg-amber-50"
                          onClick={() => fetchLogs(offset - PAGE_SIZE)}
                          disabled={!hasPrev || loading}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Précédent
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-amber-200 text-amber-700 hover:bg-amber-50"
                          onClick={() => fetchLogs(offset + PAGE_SIZE)}
                          disabled={!hasNext || loading}
                        >
                          Suivant
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Right: Summary Panel ────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Period selector */}
          <Card className="border-amber-200/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4 text-amber-600" />
                Période
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'today', label: "Aujourd'hui" },
                  { key: '7days', label: '7 derniers jours' },
                  { key: '30days', label: '30 derniers jours' },
                  { key: 'all', label: 'Tout' },
                ].map((period) => (
                  <Button
                    key={period.key}
                    variant={activePeriod === period.key ? 'default' : 'outline'}
                    size="sm"
                    className={`h-8 text-xs ${
                      activePeriod === period.key
                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0'
                        : 'border-amber-200 text-amber-700 hover:bg-amber-50'
                    }`}
                    onClick={() => handlePeriodChange(period.key)}
                  >
                    {period.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Actions by type */}
          <Card className="border-amber-200/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4 text-amber-600" />
                Actions par type
              </CardTitle>
              {summary && (
                <CardDescription className="text-xs">
                  {summary.total_actions} action{summary.total_actions !== 1 ? 's' : ''} au total
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {summaryLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : summary && Object.keys(summary.actions_by_type).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(summary.actions_by_type)
                    .sort(([, a], [, b]) => b - a)
                    .map(([action, count]) => {
                      const pct = summary.total_actions > 0
                        ? Math.round((count / summary.total_actions) * 100)
                        : 0
                      return (
                        <div key={action} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`h-2.5 w-2.5 rounded-full ${getActionBarColor(action)}`} />
                              <span className="text-sm font-medium">{getActionLabel(action)}</span>
                            </div>
                            <span className="text-sm font-semibold text-amber-800">{count}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-amber-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${getActionBarColor(action)} transition-all duration-500`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">Aucune donnée</p>
              )}
            </CardContent>
          </Card>

          {/* Activity by employee */}
          <Card className="border-amber-200/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-amber-600" />
                Activité par employé
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {summaryLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : summary && summary.employees.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-amber-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                  {summary.employees.map((emp, idx) => {
                    const maxCount = summary.employees[0]?.action_count || 1
                    const pct = Math.round((emp.action_count / maxCount) * 100)
                    return (
                      <div
                        key={emp.profile_id}
                        className="rounded-lg border border-amber-200/30 bg-white p-3 hover:bg-amber-50/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-amber-900 truncate">
                                {emp.first_name} {emp.last_name}
                              </p>
                            </div>
                            <RoleBadge role={emp.role} />
                          </div>
                          <span className="text-sm font-semibold text-amber-800 shrink-0 ml-2">
                            {emp.action_count}
                          </span>
                        </div>
                        {/* Bar visualization */}
                        <div className="h-1.5 rounded-full bg-amber-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">Aucun employé actif</p>
              )}
            </CardContent>
          </Card>

          {/* Legend / Info */}
          <Card className="border-amber-200/40 bg-gradient-to-br from-amber-50/50 to-orange-50/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <Eye className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-amber-800">Supervision propriétaire</p>
                  <p className="text-[11px] text-amber-600 mt-0.5">
                    Ce journal enregistre toutes les actions effectuées par les membres de votre équipe pour garantir la transparence et la traçabilité.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
