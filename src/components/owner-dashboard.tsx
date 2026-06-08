'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Hotel,
  LogOut,
  Shield,
  CheckCircle2,
  Calendar,
  CreditCard,
  Building2,
  MapPin,
  Phone,
  Mail,
  Clock,
  Loader2,
  Settings,
  Users,
  Bed,
  BarChart3,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  KeyRound,
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
  Check,
  UserPlus,
  Ban,
  ArrowUpDown,
  Wrench,
  Sparkles,
  Bell,
  FileText,
  MessageSquare,
  UtensilsCrossed,
  Package,
  BookOpen,
  Lock,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  GraduationCap,
  DoorOpen,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  SheetTrigger,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { ReservationsTab } from '@/components/reservations-tab'
import { CustomersTab } from '@/components/customers-tab'

// ─── Dynamic Imports for Heavy Components (30% bundle reduction) ────────────
// These components are loaded asynchronously only when their tab is active,
// significantly reducing the initial JavaScript bundle for mobile networks.
import dynamic from 'next/dynamic'

const AnalyticsTab = dynamic(
  () => import('@/components/analytics-tab').then(mod => ({ default: mod.AnalyticsTab })),
  { ssr: false, loading: () => <TabLoadingSkeleton /> }
)
const NotificationPanel = dynamic(
  () => import('@/components/notification-panel').then(mod => ({ default: mod.NotificationPanel })),
  { ssr: false, loading: () => <TabLoadingSkeleton /> }
)
const InvoicesTab = dynamic(
  () => import('@/components/invoices-tab').then(mod => ({ default: mod.InvoicesTab })),
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
const ConferenceTab = dynamic(
  () => import('@/components/conference-tab').then(mod => ({ default: mod.ConferenceTab })),
  { ssr: false, loading: () => <TabLoadingSkeleton /> }
)
const ActivityLogTab = dynamic(
  () => import('@/components/activity-log-tab').then(mod => ({ default: mod.ActivityLogTab })),
  { ssr: false, loading: () => <TabLoadingSkeleton /> }
)

import { RealtimeIndicator, RealtimeRefreshPulse } from '@/components/realtime-indicator'
import { useRealtimeSafe } from '@/lib/realtime-context'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

// ─── Types ───────────────────────────────────────────────────────────────────

interface OwnerDashboardProps {
  profile: {
    id: string
    hotel_id: string | null
    first_name: string
    last_name: string
    role: string
    phone: string | null
  }
  onLogout: () => void
  isNewRegistration?: boolean
}

interface HotelInfo {
  id: string
  name: string
  city: string
  address: string | null
  phone: string
  email: string | null
  status: string
}

interface SubscriptionInfo {
  id: string
  plan_name: string
  plan_price: number
  starts_at: string
  ends_at: string
  status: string
}

interface PlanLimits {
  max_rooms: number
  max_receptionists: number
  max_managers: number
}

interface PlanInfo {
  id: string
  name: string
  price_fcfa: number
  support_type: string
  limits: PlanLimits
}

interface RoomInfo {
  id: string
  hotel_id: string
  room_number: string
  room_type: string
  price_per_night: number
  status: string
  created_at: string
  updated_at: string
}

interface EmployeeInfo {
  id: string
  first_name: string
  last_name: string
  role: string
  phone: string | null
  status: string
  created_at: string
}

type TabId = 'overview' | 'rooms' | 'reservations' | 'customers' | 'invoices' | 'analytics' | 'activity' | 'notifications' | 'team' | 'settings' | 'restaurant' | 'stocks' | 'conference' | 'formation'

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

function getSubscriptionStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Actif</Badge>
    case 'suspended':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Suspendu</Badge>
    case 'expired':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Expiré</Badge>
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

function getRoleBadge(role: string) {
  switch (role) {
    case 'owner':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Propriétaire</Badge>
    case 'manager':
      return <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100">Manager</Badge>
    case 'receptionist':
      return <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100">Réceptionniste</Badge>
    case 'restaurant_staff':
      return <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100">Restaurant</Badge>
    case 'housekeeper':
      return <Badge className="bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-100">Ménage</Badge>
    default:
      return <Badge variant="secondary">{role}</Badge>
  }
}

function getEmployeeStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Actif</Badge>
    case 'suspended':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Suspendu</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

// ─── Navigation ──────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: TabId; label: string; icon: React.ReactNode; requiredFeature?: FeatureGate }[] = [
  { id: 'overview', label: 'Tableau de bord', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'rooms', label: 'Chambres', icon: <Bed className="h-4 w-4" /> },
  { id: 'reservations', label: 'Réservations', icon: <Calendar className="h-4 w-4" /> },
  { id: 'customers', label: 'Clients', icon: <Users className="h-4 w-4" /> },
  { id: 'invoices', label: 'Factures', icon: <FileText className="h-4 w-4" /> },
  { id: 'analytics', label: 'Analytique', icon: <BarChart3 className="h-4 w-4" />, requiredFeature: 'analytics' },
  { id: 'activity', label: "Journal d'activité", icon: <BookOpen className="h-4 w-4" /> },
  { id: 'restaurant', label: 'Restaurant', icon: <UtensilsCrossed className="h-4 w-4" />, requiredFeature: 'restaurant' },
  { id: 'stocks', label: 'Stocks', icon: <Package className="h-4 w-4" />, requiredFeature: 'stocks' },
  { id: 'conference', label: 'Salles conférence', icon: <Building2 className="h-4 w-4" />, requiredFeature: 'conference' },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
  { id: 'formation', label: 'Formation', icon: <GraduationCap className="h-4 w-4" />, requiredFeature: 'formation' },
  { id: 'team', label: 'Équipe', icon: <UserPlus className="h-4 w-4" /> },
  { id: 'settings', label: 'Paramètres', icon: <Settings className="h-4 w-4" /> },
]

// ─── Feature Gating by Plan ──────────────────────────────────────────────────

type FeatureGate = 'analytics' | 'restaurant' | 'stocks' | 'conference' | 'formation' | 'sms_notifications'

const PLAN_FEATURES: Record<string, FeatureGate[]> = {
  'Basique': [],
  'Standard': ['analytics', 'sms_notifications'],
  'Premium': ['analytics', 'sms_notifications', 'restaurant', 'stocks', 'conference', 'formation'],
}

function hasFeature(planName: string | undefined, feature: FeatureGate): boolean {
  if (!planName) return false
  // Premium includes all features
  if (planName === 'Premium') return true
  return PLAN_FEATURES[planName]?.includes(feature) ?? false
}

const ROOM_TYPES = [
  'Simple', 'Double', 'Twin', 'Suite', 'Junior Suite', 'Familiale', 'Deluxe', 'Standard', 'VIP'
]

const ROOM_STATUSES = [
  { value: 'available', label: 'Disponible' },
  { value: 'occupied', label: 'Occupée' },
  { value: 'cleaning', label: 'Nettoyage' },
  { value: 'maintenance', label: 'Maintenance' },
]

const EMPLOYEE_ROLES = [
  { value: 'manager', label: 'Manager' },
  { value: 'receptionist', label: 'Réceptionniste' },
  { value: 'restaurant_staff', label: 'Personnel Restaurant' },
  { value: 'housekeeper', label: 'Personnel Ménage' },
]

// ─── Copy Button ─────────────────────────────────────────────────────────────

// ─── Loading Skeleton for Dynamic Tabs ──────────────────────────────────────

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

// ─── Copy Button ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Copié !')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Impossible de copier')
    }
  }

  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  )
}

// ─── Limit Indicator ─────────────────────────────────────────────────────────

function LimitIndicator({ current, max, label }: { current: number; max: number; label: string }) {
  const isUnlimited = max === 9999
  const percentage = !isUnlimited && max > 0 ? Math.min((current / max) * 100, 100) : 0
  const isNearLimit = !isUnlimited && max > 0 && percentage >= 80
  const isAtLimit = !isUnlimited && max > 0 && current >= max
  const isNotAvailable = max === 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${isNotAvailable ? 'text-gray-400' : isAtLimit ? 'text-red-600' : isNearLimit ? 'text-amber-600' : isUnlimited ? 'text-emerald-600' : 'text-emerald-600'}`}>
          {isUnlimited ? `${current} / Illimité` : isNotAvailable ? `${current} / 0` : `${current} / ${max}`}
        </span>
      </div>
      <Progress
        value={isUnlimited || isNotAvailable ? 0 : percentage}
        className={`h-2 ${isUnlimited ? '[&>div]:bg-emerald-500' : isNotAvailable ? '[&>div]:bg-gray-300' : isAtLimit ? '[&>div]:bg-red-500' : isNearLimit ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`}
      />
      {isUnlimited && (
        <p className="text-xs text-emerald-600 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Capacité illimitée sur ce plan
        </p>
      )}
      {isNotAvailable && !isUnlimited && (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Non disponible sur ce plan
        </p>
      )}
      {isAtLimit && !isNotAvailable && !isUnlimited && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Limite atteinte — Mettez à niveau votre plan
        </p>
      )}
      {isNearLimit && !isAtLimit && !isNotAvailable && !isUnlimited && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Approche de la limite
        </p>
      )}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function OwnerDashboard({ profile, onLogout, isNewRegistration }: OwnerDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [hotelInfo, setHotelInfo] = useState<HotelInfo | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null)
  const [usage, setUsage] = useState({ rooms: 0, receptionists: 0, managers: 0, reservations: 0, customers: 0 })
  const [canAdd, setCanAdd] = useState({ rooms: false, receptionists: false, managers: false })
  const [roomsList, setRoomsList] = useState<RoomInfo[]>([])
  const [todayCheckIns, setTodayCheckIns] = useState<Record<string, unknown>[]>([])
  const [todayCheckOuts, setTodayCheckOuts] = useState<Record<string, unknown>[]>([])
  const [todayDate, setTodayDate] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showSuccessBanner, setShowSuccessBanner] = useState(isNewRegistration ?? false)

  // ─── Real-time subscription ────────────────────────────────────────────
  const {
    status: realtimeStatus,
    startListening: startRealtimeListening,
    stopListening: stopRealtimeListening,
    recentChanges,
    markRefreshed,
  } = useRealtimeSafe()

  // Ref for fetchAllData to avoid circular deps in debouncedRefresh
  const fetchAllDataRef = useRef<() => void>(() => {})

  // Debounce rapid real-time refreshes (e.g., bulk updates)
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
    }
    refreshTimeoutRef.current = setTimeout(() => {
      fetchAllDataRef.current()
      markRefreshed()
    }, 500) // 500ms debounce
  }, [markRefreshed])

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    setLoading(true)
    try {
      const [hotelRes, subRes, roomsRes, receptionRes] = await Promise.all([
        fetch('/api/owner/hotel'),
        fetch('/api/owner/subscription'),
        fetch('/api/owner/rooms'),
        fetch('/api/staff/reception'),
      ])

      if (hotelRes.ok) {
        const data = await hotelRes.json()
        if (data.hotel) setHotelInfo(data.hotel)
        if (data.subscription) setSubscription(data.subscription)
      }

      if (subRes.ok) {
        const data = await subRes.json()
        if (data.plan) setPlanInfo(data.plan)
        if (data.usage) setUsage(data.usage)
        if (data.canAdd) setCanAdd(data.canAdd)
        // Sync subscription info from the detailed endpoint
        if (data.subscription) setSubscription(data.subscription)
      }

      if (roomsRes.ok) {
        const data = await roomsRes.json()
        if (data.rooms) setRoomsList(data.rooms)
      }

      if (receptionRes.ok) {
        const data = await receptionRes.json()
        if (data.checkIns) setTodayCheckIns(data.checkIns)
        if (data.checkOuts) setTodayCheckOuts(data.checkOuts)
        if (data.today) setTodayDate(data.today)
      }
    } catch {
      console.error('Failed to fetch owner data')
    } finally {
      setLoading(false)
    }
  }, [])

  // Keep ref up-to-date
  useEffect(() => {
    fetchAllDataRef.current = fetchAllData
  }, [fetchAllData])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  // ─── Start real-time listening when profile is loaded ─────────────────
  useEffect(() => {
    if (profile.hotel_id) {
      startRealtimeListening(profile.hotel_id)
    }
    return () => {
      stopRealtimeListening()
    }
  }, [profile.hotel_id, startRealtimeListening, stopRealtimeListening])

  // ─── Filter nav items based on plan features ──────────────────────────
  const visibleNavItems = NAV_ITEMS.filter(item => {
    if (item.requiredFeature && !hasFeature(planInfo?.name, item.requiredFeature)) return false
    return true
  })

  // ─── React to real-time changes (debounced) ──────────────────────────
  const prevChangeCountRef = useRef(0)
  useEffect(() => {
    if (recentChanges.length > prevChangeCountRef.current && prevChangeCountRef.current > 0) {
      // New change detected — trigger a silent data refresh
      const latestChange = recentChanges[0]
      const tableLabel = latestChange.table === 'rooms' ? 'chambre' : 'réservation'
      const actionLabel = latestChange.eventType === 'INSERT' ? 'ajouté'
        : latestChange.eventType === 'UPDATE' ? 'modifié'
        : 'supprimé'

      toast.info(`Temps réel : ${tableLabel} ${actionLabel}`, {
        description: 'Les données sont mises à jour automatiquement',
        duration: 3000,
      })
      debouncedRefresh()
    }
    prevChangeCountRef.current = recentChanges.length
  }, [recentChanges.length, debouncedRefresh])

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      {/* Real-time visual feedback */}
      <RealtimeRefreshPulse />

      {/* ─── Sidebar ────────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-amber-200/50 bg-gradient-to-b from-amber-50 to-orange-50 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-amber-200/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
            <Hotel className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-amber-900">OGOU_Hôtel</h1>
            <div className="flex items-center gap-2">
              <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">Propriétaire</p>
              <RealtimeIndicator compact />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-amber-100 text-amber-900 shadow-sm'
                    : 'text-amber-800/70 hover:bg-amber-100/50 hover:text-amber-900'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Subscription Badge */}
        {planInfo && (
          <div className="px-4 py-3 border-t border-amber-200/50">
            <div className="rounded-lg bg-white/60 border border-amber-200/50 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-700">Plan {planInfo.name}</span>
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-[10px]">
                  {formatFCFA(planInfo.price_fcfa)}/mois
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp Support Button */}
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
            <span className="truncate">omouitsi@gmail.com</span>
          </a>
        </div>

        {/* User Info */}
        <div className="border-t border-amber-200/50 px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200 text-amber-800 text-xs font-bold shrink-0">
              {profile.first_name.charAt(0)}{profile.last_name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-900 truncate">{profile.first_name} {profile.last_name}</p>
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Propriétaire
              </p>
            </div>
            {recentChanges.length > 0 && (
              <button
                onClick={() => setActiveTab('notifications')}
                className="relative shrink-0 ml-1"
                title="Notifications non lues"
              >
                <Bell className="h-4 w-4 text-amber-600 hover:text-amber-800 transition-colors" />
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                  {recentChanges.length > 9 ? '9+' : recentChanges.length}
                </span>
              </button>
            )}
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
      </aside>

      {/* ─── Main Content ───────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b bg-white">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Hotel className="h-4 w-4 text-amber-600" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <div className="flex h-full flex-col bg-gradient-to-b from-amber-50 to-orange-50">
                  <div className="flex items-center gap-3 px-6 py-6 border-b border-amber-200/50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
                      <Hotel className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h1 className="text-lg font-bold text-amber-900">OGOU_Hôtel</h1>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">Propriétaire</p>
                        <RealtimeIndicator compact />
                      </div>
                    </div>
                  </div>
                  <nav className="flex-1 px-3 py-4 space-y-1">
                    {visibleNavItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                          activeTab === item.id
                            ? 'bg-amber-100 text-amber-900 shadow-sm'
                            : 'text-amber-800/70 hover:bg-amber-100/50'
                        }`}
                      >
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </nav>
                  <div className="border-t border-amber-200/50 px-4 py-4">
                    <Button variant="outline" size="sm" className="w-full border-amber-200 text-amber-700" onClick={onLogout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Déconnexion
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <span className="font-bold text-amber-900">OGOU_Hôtel</span>
          </div>
          <div className="flex items-center gap-2">
            <RealtimeIndicator />
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="lg:hidden flex overflow-x-auto gap-1 px-4 py-2 border-b bg-white">
          {visibleNavItems.map((item) => (
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
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          {/* Success Banner */}
          {showSuccessBanner && (
            <div className="mb-6 rounded-xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-emerald-800">
                    Félicitations, votre hôtel a été configuré avec succès !
                  </h2>
                  <p className="text-sm text-emerald-600 mt-1">
                    Votre espace est prêt. Commencez par ajouter vos chambres et configurer votre équipe.
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-800" onClick={() => setShowSuccessBanner(false)}>
                  ✕
                </Button>
              </div>
            </div>
          )}

          {/* Subscription Expiry / Expired Banner */}
          {subscription && (subscription.status === 'expired' || subscription.status === 'suspended') && (
            <div className="mb-6 rounded-xl border-2 border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 shrink-0">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-red-800">
                    Abonnement {subscription.status === 'expired' ? 'expiré' : 'suspendu'}
                  </h2>
                  <p className="text-sm text-red-700 mt-1">
                    Votre plan {planInfo?.name || ''} a expiré le {formatDateFR(subscription.ends_at)}. Certaines fonctionnalités peuvent être limitées.
                  </p>
                  <div className="mt-4 rounded-lg bg-white/80 border border-red-200 p-4">
                    <p className="text-sm font-semibold text-red-800 mb-2">Pour renouveler votre abonnement :</p>
                    <ol className="text-sm text-red-700 space-y-1.5 list-decimal list-inside">
                      <li>Effectuez le paiement via <strong>Orange Money</strong>, <strong>MTN Money</strong> ou <strong>Wave</strong></li>
                      <li>Contactez notre support pour recevoir votre code de renouvellement</li>
                    </ol>
                    <div className="flex flex-col sm:flex-row gap-2 mt-3">
                      <a
                        href="https://wa.me/2250576103277?text=Bonjour%2C%20je%20souhaite%20renouveler%20mon%20abonnement%20H%C3%B4telCI"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                      >
                        <MessageSquare className="h-4 w-4" />
                        WhatsApp : +225 05 76 10 32 77
                      </a>
                      <a
                        href="mailto:omouitsi@gmail.com?subject=Renouvellement%20abonnement%20H%C3%B4telCI"
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
                      >
                        <Mail className="h-4 w-4" />
                        omouitsi@gmail.com
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <OverviewTab
              hotelInfo={hotelInfo}
              subscription={subscription}
              planInfo={planInfo}
              usage={usage}
              loading={loading}
              todayCheckIns={todayCheckIns}
              todayCheckOuts={todayCheckOuts}
              todayDate={todayDate}
              roomsList={roomsList}
              onNavigateToRooms={() => setActiveTab('rooms')}
              onNavigateToTeam={() => setActiveTab('team')}
              onNavigateToReservations={() => setActiveTab('reservations')}
              onNavigateToCustomers={() => setActiveTab('customers')}
              onNavigateToInvoices={() => setActiveTab('invoices')}
              onNavigateToActivity={() => setActiveTab('activity')}
            />
          )}

          {activeTab === 'rooms' && (
            <RoomsTab
              usage={usage}
              planInfo={planInfo}
              canAddRooms={canAdd.rooms}
              onRefresh={fetchAllData}
            />
          )}

          {activeTab === 'reservations' && (
            <ReservationsTab
              rooms={roomsList.map((r) => ({
                id: r.id,
                room_number: r.room_number,
                room_type: r.room_type,
                status: r.status,
                price_per_night: r.price_per_night,
              }))}
              onRefresh={fetchAllData}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersTab onRefresh={fetchAllData} />
          )}

          {activeTab === 'invoices' && (
            <InvoicesTab onRefresh={fetchAllData} />
          )}

          {activeTab === 'analytics' && (
            hasFeature(planInfo?.name, 'analytics')
              ? <AnalyticsTab onRefresh={fetchAllData} />
              : <LockedFeatureCard feature="analytics" planName={planInfo?.name} />
          )}

          {activeTab === 'activity' && (
            <ActivityLogTab onRefresh={fetchAllData} />
          )}

          {activeTab === 'restaurant' && (
            hasFeature(planInfo?.name, 'restaurant')
              ? <RestaurantTab onRefresh={fetchAllData} />
              : <LockedFeatureCard feature="restaurant" planName={planInfo?.name} />
          )}

          {activeTab === 'stocks' && (
            hasFeature(planInfo?.name, 'stocks')
              ? <StocksTab onRefresh={fetchAllData} />
              : <LockedFeatureCard feature="stocks" planName={planInfo?.name} />
          )}

          {activeTab === 'conference' && (
            hasFeature(planInfo?.name, 'conference')
              ? <ConferenceTab onRefresh={fetchAllData} />
              : <LockedFeatureCard feature="conference" planName={planInfo?.name} />
          )}

          {activeTab === 'notifications' && (
            <NotificationPanel onRefresh={fetchAllData} planName={planInfo?.name} />
          )}

          {activeTab === 'formation' && (
            hasFeature(planInfo?.name, 'formation')
              ? <FormationTab />
              : <LockedFeatureCard feature="formation" planName={planInfo?.name} />
          )}

          {activeTab === 'team' && (
            <TeamTab
              usage={usage}
              planInfo={planInfo}
              canAdd={canAdd}
              ownerId={profile.id}
              onRefresh={fetchAllData}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              hotelInfo={hotelInfo}
              onRefresh={fetchAllData}
            />
          )}
        </div>
      </main>
    </div>
  )
}

// ─── Locked Feature Card ────────────────────────────────────────────────────

function LockedFeatureCard({ feature, planName }: { feature: string; planName?: string }) {
  const featureInfo: Record<string, { label: string; description: string; minPlan: string; icon: React.ReactNode }> = {
    analytics: {
      label: 'Analytique',
      description: 'KPIs, graphiques de performance et tableaux de bord avancés',
      minPlan: 'Standard',
      icon: <BarChart3 className="h-8 w-8" />,
    },
    restaurant: {
      label: 'Module Restaurant',
      description: 'Gestion du restaurant, menu, commandes et facturation',
      minPlan: 'Premium',
      icon: <UtensilsCrossed className="h-8 w-8" />,
    },
    stocks: {
      label: 'Module Stocks',
      description: 'Suivi des stocks, alertes de rupture et approvisionnement',
      minPlan: 'Premium',
      icon: <Package className="h-8 w-8" />,
    },
    conference: {
      label: 'Salles de Conférence',
      description: 'Réservation et gestion des salles de réunion et séminaire',
      minPlan: 'Premium',
      icon: <Building2 className="h-8 w-8" />,
    },
    formation: {
      label: 'Formation & Guides',
      description: 'Guides pratiques et formations pour optimiser votre gestion',
      minPlan: 'Premium',
      icon: <GraduationCap className="h-8 w-8" />,
    },
  }

  const info = featureInfo[feature]
  if (!info) return null

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100 text-gray-300 mb-6 relative">
        {info.icon}
        <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Lock className="h-4 w-4" />
        </div>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{info.label}</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-4">{info.description}</p>
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 mb-6">
        Disponible à partir du plan {info.minPlan}
      </Badge>
      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href="https://wa.me/2250576103277?text=Bonjour%2C%20je%20souhaite%20mettre%20%C3%A0%20niveau%20mon%20abonnement%20H%C3%B4telCI"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-3 text-sm font-medium text-white hover:from-amber-600 hover:to-orange-700 transition-colors shadow-md shadow-amber-500/20"
        >
          <MessageSquare className="h-4 w-4" />
          Mettre à niveau
        </a>
        <Button
          variant="outline"
          className="border-amber-200 text-amber-700 hover:bg-amber-50"
          onClick={() => window.location.reload()}
        >
          Voir mon plan actuel
        </Button>
      </div>
      {planName && (
        <p className="text-xs text-muted-foreground mt-4">
          Plan actuel : <strong>{planName}</strong>
        </p>
      )}
    </div>
  )
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({
  hotelInfo,
  subscription,
  planInfo,
  usage,
  loading,
  todayCheckIns,
  todayCheckOuts,
  todayDate,
  roomsList,
  onNavigateToRooms,
  onNavigateToTeam,
  onNavigateToReservations,
  onNavigateToCustomers,
  onNavigateToInvoices,
  onNavigateToActivity,
}: {
  hotelInfo: HotelInfo | null
  subscription: SubscriptionInfo | null
  planInfo: PlanInfo | null
  usage: { rooms: number; receptionists: number; managers: number; reservations: number; customers: number }
  loading: boolean
  todayCheckIns: Record<string, unknown>[]
  todayCheckOuts: Record<string, unknown>[]
  todayDate: string
  roomsList: RoomInfo[]
  onNavigateToRooms: () => void
  onNavigateToTeam: () => void
  onNavigateToReservations?: () => void
  onNavigateToCustomers?: () => void
  onNavigateToInvoices?: () => void
  onNavigateToActivity?: () => void
}) {
  const totalEmployees = usage.receptionists + usage.managers // Only count employees (not owner)

  const statCards = [
    { title: 'Chambres', value: usage.rooms, icon: <Bed className="h-5 w-5" />, color: 'text-amber-600', bg: 'bg-amber-50', max: planInfo?.limits.max_rooms, onClick: onNavigateToRooms },
    { title: 'Réservations', value: usage.reservations, icon: <Calendar className="h-5 w-5" />, color: 'text-orange-600', bg: 'bg-orange-50', max: undefined, onClick: onNavigateToReservations },
    { title: 'Équipe', value: totalEmployees, icon: <Users className="h-5 w-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50', max: undefined, onClick: onNavigateToTeam },
    { title: 'Clients', value: usage.customers, icon: <Users className="h-5 w-5" />, color: 'text-sky-600', bg: 'bg-sky-50', max: undefined, onClick: onNavigateToCustomers },
  ]

  return (
    <div className="space-y-6">
      {/* Hotel & Subscription Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-amber-200/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-amber-600" />
              Informations de l&apos;Hôtel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3"><Skeleton className="h-5 w-48" /><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-40" /></div>
            ) : hotelInfo ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xl font-bold text-gray-900">{hotelInfo.name}</p>
                  <Badge className="mt-1 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                    {hotelInfo.status === 'active' ? 'Actif' : hotelInfo.status}
                  </Badge>
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="h-4 w-4 text-amber-500 shrink-0" />
                    {hotelInfo.city}{hotelInfo.address ? ` — ${hotelInfo.address}` : ''}
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="h-4 w-4 text-amber-500 shrink-0" />
                    {hotelInfo.phone}
                  </div>
                  {hotelInfo.email && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="h-4 w-4 text-amber-500 shrink-0" />
                      {hotelInfo.email}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Informations non disponibles</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-200/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-5 w-5 text-amber-600" />
              Abonnement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3"><Skeleton className="h-5 w-36" /><Skeleton className="h-4 w-48" /><Skeleton className="h-4 w-40" /></div>
            ) : subscription && planInfo ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xl font-bold text-gray-900">Plan {planInfo.name}</p>
                    <p className="text-sm text-muted-foreground">{formatFCFA(planInfo.price_fcfa)}/mois</p>
                  </div>
                  {getSubscriptionStatusBadge(subscription.status)}
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="h-4 w-4 text-amber-500 shrink-0" />
                    <span>Début : {formatDateFR(subscription.starts_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                    <span>Expire le : {formatDateFR(subscription.ends_at)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Informations d&apos;abonnement non disponibles</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title} className={card.onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} onClick={card.onClick}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${card.bg} ${card.color}`}>
                  {card.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-bold tracking-tight">{card.value}{card.max && card.max < 9999 ? <span className="text-sm font-normal text-muted-foreground">/{card.max}</span> : ''}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Opérations du jour */}
      <Card className="border-amber-200/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <DoorOpen className="h-5 w-5 text-amber-600" />
              Opérations du jour
            </CardTitle>
            {todayDate && (
              <Badge variant="outline" className="text-xs text-amber-700 border-amber-200">
                {formatDateFR(todayDate)}
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
            <Eye className="h-3.5 w-3.5" />
            Les opérations quotidiennes sont gérées par le réceptionniste
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <DoorOpen className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-emerald-700">Arrivées aujourd&apos;hui</p>
                  <p className="text-2xl font-bold text-emerald-800">{loading ? '—' : todayCheckIns.length}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <DoorOpen className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-amber-700">Départs aujourd&apos;hui</p>
                  <p className="text-2xl font-bold text-amber-800">{loading ? '—' : todayCheckOuts.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Arrivals list */}
          {todayCheckIns.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <DoorOpen className="h-4 w-4 text-emerald-500" />
                Arrivées prévues
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                {todayCheckIns.map((res) => {
                  const cust = res.customers as Record<string, string> | null
                  const rm = res.rooms as Record<string, string> | null
                  const name = cust ? `${cust.first_name} ${cust.last_name}` : 'Client'
                  const roomNum = rm?.room_number || '—'
                  const status = (res.status as string) || ''
                  const checkInDate = (res.check_in_date as string) || ''
                  return (
                    <div key={res.id as string} className="flex items-center justify-between rounded-md border border-gray-100 bg-white px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-gray-800 truncate">{name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">Ch. {roomNum}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {checkInDate && <span className="text-xs text-muted-foreground">{checkInDate}</span>}
                        {status === 'confirmed' ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px]">Confirmée</Badge>
                        ) : status === 'pending' ? (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-[10px]">En attente</Badge>
                        ) : (
                          <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100 text-[10px]">Enregistré</Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Departures list */}
          {todayCheckOuts.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <DoorOpen className="h-4 w-4 text-amber-500" />
                Départs prévus
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                {todayCheckOuts.map((res) => {
                  const cust = res.customers as Record<string, string> | null
                  const rm = res.rooms as Record<string, string> | null
                  const name = cust ? `${cust.first_name} ${cust.last_name}` : 'Client'
                  const roomNum = rm?.room_number || '—'
                  const checkOutDate = (res.check_out_date as string) || ''
                  return (
                    <div key={res.id as string} className="flex items-center justify-between rounded-md border border-gray-100 bg-white px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-gray-800 truncate">{name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">Ch. {roomNum}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {checkOutDate && <span className="text-xs text-muted-foreground">{checkOutDate}</span>}
                        <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100 text-[10px]">En chambre</Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && todayCheckIns.length === 0 && todayCheckOuts.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <DoorOpen className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Aucune opération prévue aujourd&apos;hui</p>
            </div>
          )}

          <Separator className="my-4" />

          {/* Room status distribution */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <Bed className="h-4 w-4 text-amber-500" />
              État des chambres
            </p>
            {roomsList.length > 0 ? (
              <div className="flex flex-wrap items-center gap-4">
                {(() => {
                  const statusCounts: Record<string, number> = {}
                  roomsList.forEach((r) => {
                    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1
                  })
                  const statusConfig: Record<string, { label: string; dotColor: string; textColor: string }> = {
                    available: { label: 'Disponibles', dotColor: 'bg-emerald-500', textColor: 'text-emerald-700' },
                    occupied: { label: 'Occupées', dotColor: 'bg-sky-500', textColor: 'text-sky-700' },
                    cleaning: { label: 'Nettoyage', dotColor: 'bg-amber-500', textColor: 'text-amber-700' },
                    maintenance: { label: 'Maintenance', dotColor: 'bg-red-500', textColor: 'text-red-700' },
                  }
                  return Object.entries(statusConfig).map(([key, cfg]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${cfg.dotColor}`} />
                      <span className={`text-sm font-medium ${cfg.textColor}`}>{statusCounts[key] || 0}</span>
                      <span className="text-xs text-muted-foreground">{cfg.label}</span>
                    </div>
                  ))
                })()}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Aucune chambre configurée</p>
            )}
          </div>

          {/* Link to reservations tab */}
          {onNavigateToReservations && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={onNavigateToReservations}
                className="text-sm font-medium text-amber-600 hover:text-amber-800 transition-colors flex items-center gap-1.5"
              >
                <Calendar className="h-4 w-4" />
                Voir toutes les réservations
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscription Limits */}
      {planInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-600" />
              Limites de votre Plan
            </CardTitle>
            <CardDescription>Utilisation actuelle vs limites de votre abonnement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <LimitIndicator
                current={usage.rooms}
                max={planInfo.limits.max_rooms}
                label="Chambres"
              />
              <LimitIndicator
                current={usage.receptionists}
                max={planInfo.limits.max_receptionists}
                label="Réceptionnistes"
              />
              <LimitIndicator
                current={usage.managers}
                max={planInfo.limits.max_managers}
                label="Managers"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <Card className="border-amber-200/60 hover:border-amber-300 transition-colors cursor-pointer" onClick={onNavigateToRooms}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Bed className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Chambres</p>
              <p className="text-xs text-muted-foreground">{usage.rooms} configurée{usage.rooms !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200/60 hover:border-orange-300 transition-colors cursor-pointer" onClick={onNavigateToReservations}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Réservations</p>
              <p className="text-xs text-muted-foreground">Planning & check-in/out</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-sky-200/60 hover:border-sky-300 transition-colors cursor-pointer" onClick={onNavigateToCustomers}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Clients</p>
              <p className="text-xs text-muted-foreground">Fiches & documents</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-violet-200/60 hover:border-violet-300 transition-colors cursor-pointer" onClick={onNavigateToInvoices}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Factures</p>
              <p className="text-xs text-muted-foreground">PDF & reçu thermique</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200/60 hover:border-emerald-300 transition-colors cursor-pointer" onClick={onNavigateToTeam}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <UserPlus className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Équipe</p>
              <p className="text-xs text-muted-foreground">{usage.receptionists + usage.managers} employé{usage.receptionists + usage.managers !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transparence & Activité Récente */}
      <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50/30 to-orange-50/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-5 w-5 text-amber-600" />
              Transparence & Activité
            </CardTitle>
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-[10px]">
              Supervision
            </Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            Suivez les actions de votre équipe pour une gestion transparente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
              <p className="text-xs text-emerald-700 font-medium">Check-ins</p>
              <p className="text-lg font-bold text-emerald-800">Aujourd&apos;hui</p>
              <p className="text-sm text-emerald-600">{todayCheckIns.length} prévu{todayCheckIns.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-center">
              <DoorOpen className="h-5 w-5 text-amber-600 mx-auto mb-1" />
              <p className="text-xs text-amber-700 font-medium">Check-outs</p>
              <p className="text-lg font-bold text-amber-800">Aujourd&apos;hui</p>
              <p className="text-sm text-amber-600">{todayCheckOuts.length} prévu{todayCheckOuts.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3 text-center">
              <Users className="h-5 w-5 text-sky-600 mx-auto mb-1" />
              <p className="text-xs text-sky-700 font-medium">Équipe active</p>
              <p className="text-lg font-bold text-sky-800">{totalEmployees}</p>
              <p className="text-sm text-sky-600">employé{totalEmployees !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="rounded-lg border border-amber-200/60 bg-white/60 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-medium text-gray-700">
                  Journal d&apos;activité disponible
                </p>
              </div>
              <button
                onClick={onNavigateToActivity}
                className="text-sm font-medium text-amber-600 hover:text-amber-800 transition-colors flex items-center gap-1"
              >
                Voir le journal
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              Consultez toutes les actions de vos employés : check-ins, réservations, factures, modifications...
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Locked Features — Upgrade Prompt */}
      {planInfo && planInfo.name !== 'Premium' && (
        <Card className="border-amber-200/60 bg-gradient-to-br from-gray-50 to-amber-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-600" />
              Fonctionnalités Premium
            </CardTitle>
            <CardDescription>Débloquez plus de puissance avec un plan supérieur</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {!hasFeature(planInfo.name, 'analytics') && (
                <div className="rounded-lg border border-gray-200 bg-white/60 p-4 relative overflow-hidden">
                  <div className="absolute top-2 right-2">
                    <Lock className="h-4 w-4 text-gray-300" />
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-400 mb-3">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <p className="font-medium text-sm text-gray-700">Analytique</p>
                  <p className="text-xs text-gray-400 mt-1">KPIs & tableaux de bord</p>
                  <Badge className="mt-2 bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-50 text-[10px]">
                    Plan Standard+
                  </Badge>
                </div>
              )}
              {!hasFeature(planInfo.name, 'restaurant') && (
                <div className="rounded-lg border border-gray-200 bg-white/60 p-4 relative overflow-hidden">
                  <div className="absolute top-2 right-2">
                    <Lock className="h-4 w-4 text-gray-300" />
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-400 mb-3">
                    <UtensilsCrossed className="h-5 w-5" />
                  </div>
                  <p className="font-medium text-sm text-gray-700">Restaurant</p>
                  <p className="text-xs text-gray-400 mt-1">Menu, commandes, facturation</p>
                  <Badge className="mt-2 bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-50 text-[10px]">
                    Plan Premium
                  </Badge>
                </div>
              )}
              {!hasFeature(planInfo.name, 'stocks') && (
                <div className="rounded-lg border border-gray-200 bg-white/60 p-4 relative overflow-hidden">
                  <div className="absolute top-2 right-2">
                    <Lock className="h-4 w-4 text-gray-300" />
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-400 mb-3">
                    <Package className="h-5 w-5" />
                  </div>
                  <p className="font-medium text-sm text-gray-700">Stocks</p>
                  <p className="text-xs text-gray-400 mt-1">Suivi & approvisionnement</p>
                  <Badge className="mt-2 bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-50 text-[10px]">
                    Plan Premium
                  </Badge>
                </div>
              )}
              {!hasFeature(planInfo.name, 'conference') && (
                <div className="rounded-lg border border-gray-200 bg-white/60 p-4 relative overflow-hidden">
                  <div className="absolute top-2 right-2">
                    <Lock className="h-4 w-4 text-gray-300" />
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-400 mb-3">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <p className="font-medium text-sm text-gray-700">Salles conférence</p>
                  <p className="text-xs text-gray-400 mt-1">Réservation & séminaires</p>
                  <Badge className="mt-2 bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-50 text-[10px]">
                    Plan Premium
                  </Badge>
                </div>
              )}
              {!hasFeature(planInfo.name, 'formation') && (
                <div className="rounded-lg border border-gray-200 bg-white/60 p-4 relative overflow-hidden">
                  <div className="absolute top-2 right-2">
                    <Lock className="h-4 w-4 text-gray-300" />
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-400 mb-3">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <p className="font-medium text-sm text-gray-700">Formation</p>
                  <p className="text-xs text-gray-400 mt-1">Guides & bonnes pratiques</p>
                  <Badge className="mt-2 bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-50 text-[10px]">
                    Plan Premium
                  </Badge>
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <a
                href="https://wa.me/2250576103277?text=Bonjour%2C%20je%20souhaite%20mettre%20%C3%A0%20niveau%20mon%20abonnement%20H%C3%B4telCI"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-medium text-white hover:from-amber-600 hover:to-orange-700 transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                Mettre à niveau
              </a>
              <p className="text-xs text-muted-foreground">
                Contactez-nous pour passer au plan {planInfo.name === 'Basique' ? 'Standard' : 'Premium'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Formation Tab ────────────────────────────────────────────────────────────

function FormationTab() {
  const guides = [
    {
      id: 'demarrage',
      title: 'Guide de démarrage rapide',
      icon: <BookOpen className="h-5 w-5" />,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      sections: [
        {
          subtitle: 'Premiers pas',
          content: 'Bienvenue dans OGOU_Hôtel ! Commencez par configurer votre hôtel en ajoutant vos chambres et les types de chambres disponibles. Ensuite, ajoutez les membres de votre équipe (réceptionnistes, managers) pour qu\'ils puissent accéder au système.',
        },
        {
          subtitle: 'Configuration initiale',
          content: 'Allez dans Paramètres pour vérifier les informations de votre hôtel (nom, adresse, téléphone). Assurez-vous que ces informations sont correctes car elles apparaîtront sur vos factures et documents.',
        },
        {
          subtitle: 'Ajout des chambres',
          content: 'Depuis l\'onglet Chambres, cliquez sur "Ajouter" pour créer vos premières chambres. Indiquez le numéro, le type (Simple, Double, Suite...) et le prix par nuit. Vous pouvez modifier ces informations à tout moment.',
        },
      ],
    },
    {
      id: 'reservations',
      title: 'Gestion des réservations',
      icon: <Calendar className="h-5 w-5" />,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      sections: [
        {
          subtitle: 'Créer une réservation',
          content: 'Depuis l\'onglet Réservations, cliquez sur "Nouvelle réservation". Sélectionnez le client (ou créez-en un nouveau), choisissez la chambre, les dates d\'arrivée et de départ. Le système calcule automatiquement le montant total.',
        },
        {
          subtitle: 'Check-in et Check-out',
          content: 'Le jour de l\'arrivée, effectuez le check-in depuis la fiche de réservation. Le statut de la chambre passe automatiquement à "Occupée". Au départ, effectuez le check-out : la chambre passe en "Nettoyage" puis redevient "Disponible".',
        },
        {
          subtitle: 'Gestion des conflits',
          content: 'Le système empêche les doubles réservations sur une même chambre pour les mêmes dates. Vérifiez toujours la disponibilité avant de confirmer une réservation.',
        },
      ],
    },
    {
      id: 'restaurant',
      title: 'Module Restaurant',
      icon: <UtensilsCrossed className="h-5 w-5" />,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      sections: [
        {
          subtitle: 'Configuration du menu',
          content: 'Depuis l\'onglet Restaurant, configurez votre carte avec les catégories (Entrées, Plats, Desserts, Boissons). Ajoutez chaque plat avec son prix et sa description.',
        },
        {
          subtitle: 'Gestion des commandes',
          content: 'Les réceptionnistes et le personnel de restaurant peuvent prendre les commandes directement depuis l\'application. Les commandes sont associées à un numéro de chambre ou à une table.',
        },
        {
          subtitle: 'Facturation restaurant',
          content: 'Les consommations du restaurant peuvent être ajoutées à la facture de la chambre du client pour un règlement unique au départ, ou facturées séparément.',
        },
      ],
    },
    {
      id: 'stocks',
      title: 'Module Stocks',
      icon: <Package className="h-5 w-5" />,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      sections: [
        {
          subtitle: 'Inventaire initial',
          content: 'Commencez par créer vos catégories de produits (Boissons, Produits d\'entretien, Linge, Consommables). Puis ajoutez chaque produit avec sa quantité actuelle et son seuil d\'alerte.',
        },
        {
          subtitle: 'Suivi des entrées/sorties',
          content: 'Chaque mouvement de stock est enregistré : réception de marchandises (entrée), consommation ou perte (sortie). L\'historique permet de tracer tous les mouvements.',
        },
        {
          subtitle: 'Alertes de rupture',
          content: 'Le système vous alerte automatiquement quand le stock d\'un produit passe en dessous du seuil défini. Vous pouvez alors commander un réapprovisionnement.',
        },
      ],
    },
    {
      id: 'bonnes-pratiques',
      title: 'Bonnes pratiques',
      icon: <Sparkles className="h-5 w-5" />,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      sections: [
        {
          subtitle: 'Sauvegarde des données',
          content: 'Vos données sont sauvegardées automatiquement sur nos serveurs sécurisés. Nous vous recommandons néanmoins d\'exporter régulièrement vos factures et rapports importants.',
        },
        {
          subtitle: 'Gestion des accès',
          content: 'Attribuez les bons rôles à chaque membre de l\'équipe. Les réceptionnistes n\'ont accès qu\'aux réservations et chambres. Les managers ont un accès plus large. Seul le propriétaire peut gérer l\'abonnement et les paramètres.',
        },
        {
          subtitle: 'Optimisation des revenus',
          content: 'Utilisez le module Analytique pour suivre votre taux d\'occupation et vos revenus. Ajustez vos prix en fonction de la saisonnalité et des événements locaux pour maximiser votre rentabilité.',
        },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
          <GraduationCap className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">Formation & Guides</h2>
          <p className="text-sm text-muted-foreground">Guides pratiques pour maîtriser OGOU_Hôtel</p>
        </div>
      </div>

      <Card className="border-amber-200/60 bg-gradient-to-r from-amber-50 to-orange-50">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-amber-900">Contenu exclusif Premium</p>
              <p className="text-sm text-amber-700 mt-1">
                Ces guides et formations vous accompagnent pour tirer le meilleur parti de toutes les fonctionnalités d&apos;OGOU_Hôtel.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Accordion type="multiple" className="space-y-3">
        {guides.map((guide) => (
          <AccordionItem key={guide.id} value={guide.id} className="border rounded-lg px-0 overflow-hidden">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50/50 transition-colors">
              <div className="flex items-center gap-3 text-left">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${guide.bg} ${guide.color}`}>
                  {guide.icon}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{guide.title}</p>
                  <p className="text-xs text-muted-foreground">{guide.sections.length} sections</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4">
              <div className="space-y-4 pt-2">
                {guide.sections.map((section, idx) => (
                  <div key={idx} className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold shrink-0">
                        {idx + 1}
                      </span>
                      {section.subtitle}
                    </h4>
                    <p className="text-sm text-gray-600 leading-relaxed ml-8">
                      {section.content}
                    </p>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

// ─── Rooms Tab ───────────────────────────────────────────────────────────────

function RoomsTab({
  usage,
  planInfo,
  canAddRooms,
  onRefresh,
}: {
  usage: { rooms: number; receptionists: number; managers: number }
  planInfo: PlanInfo | null
  canAddRooms: boolean
  onRefresh: () => void
}) {
  const [rooms, setRooms] = useState<RoomInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<RoomInfo | null>(null)
  const [roomStatusFilter, setRoomStatusFilter] = useState<string>('all')
  const [quickStatusLoading, setQuickStatusLoading] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [formNumber, setFormNumber] = useState('')
  const [formType, setFormType] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formStatus, setFormStatus] = useState('available')

  const fetchRooms = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/owner/rooms')
      if (res.ok) {
        const data = await res.json()
        setRooms(data.rooms || [])
      }
    } catch {
      toast.error('Erreur lors du chargement des chambres')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  function resetForm() {
    setFormNumber('')
    setFormType('')
    setFormPrice('')
    setFormStatus('available')
  }

  function openEditDialog(room: RoomInfo) {
    setSelectedRoom(room)
    setFormNumber(room.room_number)
    setFormType(room.room_type)
    setFormPrice(room.price_per_night.toString())
    setFormStatus(room.status)
    setEditDialogOpen(true)
  }

  function openDeleteDialog(room: RoomInfo) {
    setSelectedRoom(room)
    setDeleteDialogOpen(true)
  }

  async function handleAddRoom() {
    if (!formNumber || !formType || !formPrice) {
      toast.error('Remplissez tous les champs requis')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/owner/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_number: formNumber,
          room_type: formType,
          price_per_night: parseFloat(formPrice),
          status: formStatus,
        }),
      })

      if (res.ok) {
        toast.success(`Chambre ${formNumber} ajoutée avec succès`)
        setDialogOpen(false)
        resetForm()
        fetchRooms()
        onRefresh()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de l\'ajout')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEditRoom() {
    if (!selectedRoom) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/owner/rooms/${selectedRoom.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_number: formNumber,
          room_type: formType,
          price_per_night: parseFloat(formPrice),
          status: formStatus,
        }),
      })

      if (res.ok) {
        toast.success(`Chambre ${formNumber} modifiée`)
        setEditDialogOpen(false)
        resetForm()
        fetchRooms()
        onRefresh()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la modification')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteRoom() {
    if (!selectedRoom) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/owner/rooms/${selectedRoom.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success(`Chambre ${selectedRoom.room_number} supprimée`)
        setDeleteDialogOpen(false)
        setSelectedRoom(null)
        fetchRooms()
        onRefresh()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleQuickStatusChange(roomId: string, newStatus: string) {
    setQuickStatusLoading(roomId)
    try {
      const res = await fetch(`/api/owner/rooms/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const statusLabels: Record<string, string> = {
          available: 'Disponible',
          occupied: 'Occupée',
          cleaning: 'Nettoyage',
          maintenance: 'Maintenance',
        }
        toast.success(`Statut changé en "${statusLabels[newStatus] || newStatus}"`)
        fetchRooms()
        onRefresh()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors du changement de statut')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setQuickStatusLoading(null)
    }
  }

  const filteredRooms = roomStatusFilter === 'all' ? rooms : rooms.filter(r => r.status === roomStatusFilter)
  const roomCounts = {
    total: rooms.length,
    available: rooms.filter(r => r.status === 'available').length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
    cleaning: rooms.filter(r => r.status === 'cleaning').length,
    maintenance: rooms.filter(r => r.status === 'maintenance').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">🛏️ Gestion des Chambres</h2>
          <p className="text-muted-foreground">
            {usage.rooms} chambre{usage.rooms !== 1 ? 's' : ''} sur {planInfo?.limits.max_rooms === 9999 ? 'Illimité' : planInfo?.limits.max_rooms ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchRooms(); onRefresh() }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
            onClick={() => { resetForm(); setDialogOpen(true) }}
            disabled={!canAddRooms}
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Limit Warning */}
      {!canAddRooms && planInfo && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Vous avez atteint la limite de <strong>{planInfo.limits.max_rooms} chambres</strong> de votre plan {planInfo.name}.
            Mettez à niveau votre abonnement pour ajouter plus de chambres.
          </AlertDescription>
        </Alert>
      )}

      {/* Limit indicator */}
      {planInfo && (
        <Card>
          <CardContent className="p-4">
            <LimitIndicator current={usage.rooms} max={planInfo.limits.max_rooms} label="Capacité de chambres" />
          </CardContent>
        </Card>
      )}

      {/* Room Status Filter */}
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
          Toutes ({roomCounts.total})
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
          {roomCounts.available} Disponibles
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
          {roomCounts.occupied} Occupées
        </button>
        <button
          onClick={() => setRoomStatusFilter('cleaning')}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
            roomStatusFilter === 'cleaning'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {roomCounts.cleaning} Nettoyage
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
          {roomCounts.maintenance} Maintenance
        </button>
      </div>

      {/* Rooms Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-400 mb-3">
                <Bed className="h-7 w-7" />
              </div>
              <p className="text-muted-foreground">Aucune chambre configurée</p>
              <p className="text-xs text-muted-foreground mt-1">Ajoutez vos premières chambres pour commencer</p>
              {canAddRooms && (
                <Button
                  className="mt-4 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => { resetForm(); setDialogOpen(true) }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une chambre
                </Button>
              )}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400 mb-3">
                <Bed className="h-7 w-7" />
              </div>
              <p className="text-muted-foreground">Aucune chambre dans ce statut</p>
              <p className="text-xs text-muted-foreground mt-1">Modifiez le filtre pour voir d'autres chambres</p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Chambre</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden sm:table-cell">Prix/Nuit</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden md:table-cell">Changer statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRooms.map((room) => (
                    <TableRow key={room.id} className={
                      room.status === 'available' ? 'bg-emerald-50/30' :
                      room.status === 'occupied' ? 'bg-sky-50/30' :
                      room.status === 'cleaning' ? 'bg-amber-50/30' :
                      room.status === 'maintenance' ? 'bg-red-50/30' : ''
                    }>
                      <TableCell className="font-mono font-semibold">{room.room_number}</TableCell>
                      <TableCell>{room.room_type}</TableCell>
                      <TableCell className="hidden sm:table-cell">{formatFCFA(room.price_per_night)}</TableCell>
                      <TableCell>{getRoomStatusBadge(room.status)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          {quickStatusLoading === room.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                          ) : (
                            ROOM_STATUSES.filter(s => s.value !== room.status).map((s) => (
                              <button
                                key={s.value}
                                onClick={() => handleQuickStatusChange(room.id, s.value)}
                                title={`Passer en ${s.label}`}
                                className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                                  s.value === 'available' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' :
                                  s.value === 'occupied' ? 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100' :
                                  s.value === 'cleaning' ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' :
                                  'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                                }`}
                              >
                                {s.value === 'available' && <CheckCircle2 className="h-2.5 w-2.5" />}
                                {s.value === 'occupied' && <Bed className="h-2.5 w-2.5" />}
                                {s.value === 'cleaning' && <Sparkles className="h-2.5 w-2.5" />}
                                {s.value === 'maintenance' && <Wrench className="h-2.5 w-2.5" />}
                                {s.label}
                              </button>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(room)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => openDeleteDialog(room)}>
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* Add Room Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une Chambre</DialogTitle>
            <DialogDescription>Configurez une nouvelle chambre dans votre établissement</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="room-number">N° Chambre *</Label>
                <Input id="room-number" placeholder="101" value={formNumber} onChange={(e) => setFormNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-type">Type *</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {ROOM_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="room-price">Prix par Nuit (FCFA) *</Label>
                <Input id="room-price" type="number" placeholder="15000" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-status">Statut</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROOM_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleAddRoom} disabled={submitting || !formNumber || !formType || !formPrice}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Room Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la Chambre</DialogTitle>
            <DialogDescription>Modifiez les informations de la chambre {selectedRoom?.room_number}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>N° Chambre</Label>
                <Input value={formNumber} onChange={(e) => setFormNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROOM_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prix par Nuit (FCFA)</Label>
                <Input type="number" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROOM_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuler</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleEditRoom} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
              Modifier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Room Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la Chambre</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer la chambre <strong>{selectedRoom?.room_number}</strong> ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDeleteRoom} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Team Tab ────────────────────────────────────────────────────────────────

function TeamTab({
  usage,
  planInfo,
  canAdd,
  ownerId,
  onRefresh,
}: {
  usage: { rooms: number; receptionists: number; managers: number }
  planInfo: PlanInfo | null
  canAdd: { rooms: boolean; receptionists: boolean; managers: boolean }
  ownerId: string
  onRefresh: () => void
}) {
  const [employees, setEmployees] = useState<EmployeeInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeInfo | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Password reveal dialog (shared for add & reset)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [newEmployeeName, setNewEmployeeName] = useState('')
  const [newEmployeeEmail, setNewEmployeeEmail] = useState('')
  const [passwordDialogTitle, setPasswordDialogTitle] = useState('✅ Employé ajouté avec succès')
  const [passwordDialogDesc, setPasswordDialogDesc] = useState('')

  // Add form state
  const [addFirstName, setAddFirstName] = useState('')
  const [addLastName, setAddLastName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addRole, setAddRole] = useState('')

  // Edit form state
  const [editRole, setEditRole] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editStatus, setEditStatus] = useState('')

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/owner/employees')
      if (res.ok) {
        const data = await res.json()
        setEmployees(data.employees || [])
      }
    } catch {
      toast.error('Erreur lors du chargement de l\'équipe')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  function resetAddForm() {
    setAddFirstName('')
    setAddLastName('')
    setAddEmail('')
    setAddPhone('')
    setAddRole('')
  }

  // Determine which roles can still be added
  function canAddRole(role: string): boolean {
    if (role === 'receptionist') return canAdd.receptionists
    if (role === 'manager') return canAdd.managers
    return true // restaurant_staff, housekeeper have no limits
  }

  async function handleAddEmployee() {
    if (!addFirstName || !addLastName || !addEmail || !addRole) {
      toast.error('Remplissez tous les champs requis')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/owner/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: addFirstName,
          last_name: addLastName,
          email: addEmail,
          phone: addPhone,
          role: addRole,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setGeneratedPassword(data.generatedPassword)
        setNewEmployeeName(`${addFirstName} ${addLastName}`)
        setNewEmployeeEmail(addEmail.trim().toLowerCase())
        setAddDialogOpen(false)
        setPasswordDialogOpen(true)
        resetAddForm()
        fetchEmployees()
        onRefresh()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de l\'ajout')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  function openEditDialog(employee: EmployeeInfo) {
    setSelectedEmployee(employee)
    setEditRole(employee.role)
    setEditPhone(employee.phone || '')
    setEditStatus(employee.status)
    setEditDialogOpen(true)
  }

  function openDeleteDialog(employee: EmployeeInfo) {
    setSelectedEmployee(employee)
    setDeleteDialogOpen(true)
  }

  function openResetPasswordDialog(employee: EmployeeInfo) {
    setSelectedEmployee(employee)
    setResetPasswordDialogOpen(true)
  }

  async function handleResetPassword() {
    if (!selectedEmployee) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/owner/employees/${selectedEmployee.id}/reset-password`, {
        method: 'POST',
      })

      if (res.ok) {
        const data = await res.json()
        setGeneratedPassword(data.newPassword)
        setNewEmployeeName(`${data.employee.first_name} ${data.employee.last_name}`)
        setNewEmployeeEmail('')
        setPasswordDialogTitle('🔑 Mot de passe réinitialisé')
        setPasswordDialogDesc(
          `Transmettez le nouveau mot de passe à ${data.employee.first_name} ${data.employee.last_name}. L'ancien mot de passe ne fonctionne plus.`
        )
        setResetPasswordDialogOpen(false)
        setPasswordDialogOpen(true)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la réinitialisation')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEditEmployee() {
    if (!selectedEmployee) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/owner/employees/${selectedEmployee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: editRole,
          phone: editPhone || null,
          status: editStatus,
        }),
      })

      if (res.ok) {
        toast.success(`${selectedEmployee.first_name} ${selectedEmployee.last_name} modifié(e)`)
        setEditDialogOpen(false)
        fetchEmployees()
        onRefresh()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la modification')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteEmployee() {
    if (!selectedEmployee) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/owner/employees/${selectedEmployee.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success(`${selectedEmployee.first_name} ${selectedEmployee.last_name} supprimé(e)`)
        setDeleteDialogOpen(false)
        setSelectedEmployee(null)
        fetchEmployees()
        onRefresh()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  const totalTeam = employees.length
  const anyCanAdd = canAdd.receptionists || canAdd.managers // at least one limited role available

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">👥 Gestion de l&apos;Équipe</h2>
          <p className="text-muted-foreground">{totalTeam} membre{totalTeam !== 1 ? 's' : ''} d&apos;équipe</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchEmployees(); onRefresh() }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md"
            onClick={() => { resetAddForm(); setAddDialogOpen(true) }}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Limit Indicators */}
      {planInfo && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <LimitIndicator current={usage.receptionists} max={planInfo.limits.max_receptionists} label="Réceptionnistes" />
            <LimitIndicator current={usage.managers} max={planInfo.limits.max_managers} label="Managers" />
          </CardContent>
        </Card>
      )}

      {/* Team Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-400 mb-3">
                <Users className="h-7 w-7" />
              </div>
              <p className="text-muted-foreground">Aucun membre dans l&apos;équipe</p>
              <p className="text-xs text-muted-foreground mt-1">Ajoutez des réceptionnistes et managers</p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead className="hidden sm:table-cell">Téléphone</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id} className={emp.id === ownerId ? 'bg-amber-50/50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
                            {emp.first_name.charAt(0)}{emp.last_name.charAt(0)}
                          </div>
                          <span className={`font-medium ${emp.id === ownerId ? 'text-amber-800' : ''}`}>
                            {emp.first_name} {emp.last_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(emp.role)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {emp.phone ? (
                          <span className="flex items-center gap-1 text-sm"><Phone className="h-3 w-3" />{emp.phone}</span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>{getEmployeeStatusBadge(emp.status)}</TableCell>
                      <TableCell className="text-right">
                        {emp.id !== ownerId && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                              onClick={() => openResetPasswordDialog(emp)}
                              title="Réinitialiser le mot de passe"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(emp)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => openDeleteDialog(emp)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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

      {/* Add Employee Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un Membre</DialogTitle>
            <DialogDescription>Créez un compte pour un nouvel employé. Un mot de passe sera généré automatiquement.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prénom *</Label>
                <Input placeholder="Jean" value={addFirstName} onChange={(e) => setAddFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input placeholder="Koné" value={addLastName} onChange={(e) => setAddLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" placeholder="jean.kone@hotel.com" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input placeholder="+225 07 00 00 00" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Rôle *</Label>
                <Select value={addRole} onValueChange={setAddRole}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value} disabled={!canAddRole(r.value)}>
                        <div className="flex items-center justify-between gap-2">
                          <span>{r.label}</span>
                          {!canAddRole(r.value) && (
                            <Badge variant="secondary" className="text-[10px]">Limite atteinte</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Annuler</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAddEmployee} disabled={submitting || !addFirstName || !addLastName || !addEmail || !addRole || (addRole ? !canAddRole(addRole) : false)}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reveal Dialog (shared for add & reset) */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{passwordDialogTitle}</DialogTitle>
            <DialogDescription>
              {passwordDialogDesc || <>Transmettez ces identifiants à <strong>{newEmployeeName}</strong>. Le mot de passe ne sera plus affiché.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4 space-y-3">
              {newEmployeeEmail && (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Email de connexion</p>
                    <p className="text-sm font-mono">{newEmployeeEmail || '—'}</p>
                  </div>
                  <Separator />
                </>
              )}
              <div className="space-y-1">
                <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Nouveau mot de passe</p>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-white px-3 py-1.5 text-sm font-mono font-bold text-emerald-800 border border-emerald-200">
                    {generatedPassword}
                  </code>
                  <CopyButton text={newEmployeeEmail ? `Email: ${newEmployeeEmail}\nMot de passe: ${generatedPassword}` : `Mot de passe: ${generatedPassword}`} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setPasswordDialogOpen(false); setPasswordDialogTitle('✅ Employé ajouté avec succès'); setPasswordDialogDesc(''); }}>
              <Check className="h-4 w-4 mr-2" />
              J&apos;ai noté le mot de passe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l&apos;Employé</DialogTitle>
            <DialogDescription>
              Modifier les informations de <strong>{selectedEmployee?.first_name} {selectedEmployee?.last_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rôle</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value} disabled={r.value !== editRole && !canAddRole(r.value)}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="suspended">Suspendu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+225 07 00 00 00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuler</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleEditEmployee} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
              Modifier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Confirmation Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir réinitialiser le mot de passe de <strong>{selectedEmployee?.first_name} {selectedEmployee?.last_name}</strong> ?
              Un nouveau mot de passe sera généré. L&apos;ancien ne fonctionnera plus.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-3">
            <KeyRound className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Attention</p>
              <p className="mt-1">L&apos;employé devra utiliser le nouveau mot de passe pour se connecter. Assurez-vous de lui transmettre.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>Annuler</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleResetPassword} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Réinitialiser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Employee Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l&apos;Employé</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{selectedEmployee?.first_name} {selectedEmployee?.last_name}</strong> ?
              Le compte sera définitivement supprimé.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDeleteEmployee} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Settings Tab ────────────────────────────────────────────────────────────

function SettingsTab({
  hotelInfo,
  onRefresh,
}: {
  hotelInfo: HotelInfo | null
  onRefresh: () => void
}) {
  const [editMode, setEditMode] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formCity, setFormCity] = useState('')

  useEffect(() => {
    if (hotelInfo) {
      setFormName(hotelInfo.name)
      setFormPhone(hotelInfo.phone)
      setFormAddress(hotelInfo.address || '')
      setFormCity(hotelInfo.city)
    }
  }, [hotelInfo])

  async function handleSave() {
    if (!hotelInfo) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/owner/hotel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          phone: formPhone,
          address: formAddress || null,
          city: formCity,
        }),
      })

      if (res.ok) {
        toast.success('Informations mises à jour')
        setEditMode(false)
        onRefresh()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la mise à jour')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  if (!hotelInfo) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Informations non disponibles</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">⚙️ Paramètres</h2>
          <p className="text-muted-foreground">Configuration de votre établissement</p>
        </div>
        {!editMode && (
          <Button variant="outline" onClick={() => setEditMode(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Modifier
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-600" />
            Informations de l&apos;Hôtel
          </CardTitle>
          <CardDescription>Les modifications seront visibles immédiatement</CardDescription>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom de l&apos;établissement</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Ville</Label>
                  <Input value={formCity} onChange={(e) => setFormCity(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={hotelInfo.email || ''} disabled className="bg-gray-50" />
                  <p className="text-xs text-muted-foreground">L&apos;email ne peut pas être modifié ici</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Adresse</Label>
                <Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="Cocody Riviera, Abidjan" />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleSave} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  Enregistrer
                </Button>
                <Button variant="outline" onClick={() => setEditMode(false)} disabled={submitting}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nom</p>
                  <p className="font-medium">{hotelInfo.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ville</p>
                  <p className="font-medium">{hotelInfo.city}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Téléphone</p>
                  <p className="font-medium">{hotelInfo.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{hotelInfo.email || '—'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Adresse</p>
                <p className="font-medium">{hotelInfo.address || '—'}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Statut</p>
                <div className="mt-1">{getSubscriptionStatusBadge(hotelInfo.status)}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SQL Triggers Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-600" />
            Triggers de Sécurité Base de Données
          </CardTitle>
          <CardDescription>
            Validation des limites d&apos;abonnement au niveau PostgreSQL
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="border-sky-200 bg-sky-50 mb-4">
            <Sparkles className="h-4 w-4 text-sky-600" />
            <AlertDescription className="text-sky-800">
              L&apos;application valide déjà les limites côté API. Les triggers PostgreSQL ajoutent une couche de sécurité supplémentaire en base de données.
            </AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground mb-3">
            Pour activer les triggers de validation au niveau base de données, exécutez le SQL disponible à l&apos;endpoint suivant dans le <strong>Supabase SQL Editor</strong> :
          </p>
          <code className="block rounded-lg bg-gray-100 px-4 py-2 text-sm font-mono">
            GET /api/setup/triggers
          </code>
          <p className="text-xs text-muted-foreground mt-2">
            Dashboard → SQL Editor → Collez le SQL retourné → Execute
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
