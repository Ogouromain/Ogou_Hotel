'use client'

import { useState, useEffect, useCallback } from 'react'
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

type TabId = 'overview' | 'rooms' | 'team' | 'settings'

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

const NAV_ITEMS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Tableau de bord', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'rooms', label: 'Chambres', icon: <Bed className="h-4 w-4" /> },
  { id: 'team', label: 'Équipe', icon: <Users className="h-4 w-4" /> },
  { id: 'settings', label: 'Paramètres', icon: <Settings className="h-4 w-4" /> },
]

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
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0
  const isNearLimit = percentage >= 80
  const isAtLimit = current >= max

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${isAtLimit ? 'text-red-600' : isNearLimit ? 'text-amber-600' : 'text-emerald-600'}`}>
          {current} / {max === 9999 ? '∞' : max}
        </span>
      </div>
      <Progress
        value={max === 9999 ? 0 : percentage}
        className={`h-2 ${isAtLimit ? '[&>div]:bg-red-500' : isNearLimit ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`}
      />
      {isAtLimit && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Limite atteinte — Mettez à niveau votre plan
        </p>
      )}
      {isNearLimit && !isAtLimit && (
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
  const [usage, setUsage] = useState({ rooms: 0, receptionists: 0, managers: 0 })
  const [canAdd, setCanAdd] = useState({ rooms: false, receptionists: false, managers: false })
  const [loading, setLoading] = useState(true)
  const [showSuccessBanner, setShowSuccessBanner] = useState(isNewRegistration ?? false)

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    setLoading(true)
    try {
      const [hotelRes, subRes] = await Promise.all([
        fetch('/api/owner/hotel'),
        fetch('/api/owner/subscription'),
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
    } catch {
      console.error('Failed to fetch owner data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      {/* ─── Sidebar ────────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-amber-200/50 bg-gradient-to-b from-amber-50 to-orange-50 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-amber-200/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
            <Hotel className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-amber-900">HôtelCI</h1>
            <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">Propriétaire</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
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
                    <div>
                      <h1 className="text-lg font-bold text-amber-900">HôtelCI</h1>
                      <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">Propriétaire</p>
                    </div>
                  </div>
                  <nav className="flex-1 px-3 py-4 space-y-1">
                    {NAV_ITEMS.map((item) => (
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
            <span className="font-bold text-amber-900">HôtelCI</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {/* Mobile Navigation */}
        <div className="lg:hidden flex overflow-x-auto gap-1 px-4 py-2 border-b bg-white">
          {NAV_ITEMS.map((item) => (
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

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <OverviewTab
              hotelInfo={hotelInfo}
              subscription={subscription}
              planInfo={planInfo}
              usage={usage}
              loading={loading}
              onNavigateToRooms={() => setActiveTab('rooms')}
              onNavigateToTeam={() => setActiveTab('team')}
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

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({
  hotelInfo,
  subscription,
  planInfo,
  usage,
  loading,
  onNavigateToRooms,
  onNavigateToTeam,
}: {
  hotelInfo: HotelInfo | null
  subscription: SubscriptionInfo | null
  planInfo: PlanInfo | null
  usage: { rooms: number; receptionists: number; managers: number }
  loading: boolean
  onNavigateToRooms: () => void
  onNavigateToTeam: () => void
}) {
  const totalEmployees = usage.receptionists + usage.managers + 1 // +1 for owner

  const statCards = [
    { title: 'Chambres', value: usage.rooms, icon: <Bed className="h-5 w-5" />, color: 'text-amber-600', bg: 'bg-amber-50', max: planInfo?.limits.max_rooms },
    { title: 'Réservations', value: 0, icon: <Calendar className="h-5 w-5" />, color: 'text-orange-600', bg: 'bg-orange-50', max: undefined },
    { title: 'Équipe', value: totalEmployees, icon: <Users className="h-5 w-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50', max: undefined },
    { title: 'Occupation', value: '0%', icon: <BarChart3 className="h-5 w-5" />, color: 'text-rose-600', bg: 'bg-rose-50', max: undefined },
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
          <Card key={card.title}>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-amber-200/60 hover:border-amber-300 transition-colors cursor-pointer" onClick={onNavigateToRooms}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Bed className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Gérer les Chambres</p>
              <p className="text-sm text-muted-foreground">{usage.rooms} chambre{usage.rooms !== 1 ? 's' : ''} configurée{usage.rooms !== 1 ? 's' : ''}</p>
            </div>
            <Plus className="h-5 w-5 text-amber-400" />
          </CardContent>
        </Card>
        <Card className="border-amber-200/60 hover:border-amber-300 transition-colors cursor-pointer" onClick={onNavigateToTeam}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Users className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Gérer l&apos;Équipe</p>
              <p className="text-sm text-muted-foreground">{usage.receptionists + usage.managers} employé{usage.receptionists + usage.managers !== 1 ? 's' : ''}</p>
            </div>
            <UserPlus className="h-5 w-5 text-emerald-400" />
          </CardContent>
        </Card>
      </div>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">🛏️ Gestion des Chambres</h2>
          <p className="text-muted-foreground">
            {usage.rooms} chambre{usage.rooms !== 1 ? 's' : ''} sur {planInfo?.limits.max_rooms === 9999 ? '∞' : planInfo?.limits.max_rooms ?? '—'}
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
          ) : (
            <div className="max-h-[500px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Chambre</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden sm:table-cell">Prix/Nuit</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rooms.map((room) => (
                    <TableRow key={room.id}>
                      <TableCell className="font-mono font-semibold">{room.room_number}</TableCell>
                      <TableCell>{room.room_type}</TableCell>
                      <TableCell className="hidden sm:table-cell">{formatFCFA(room.price_per_night)}</TableCell>
                      <TableCell>{getRoomStatusBadge(room.status)}</TableCell>
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
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeInfo | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Password reveal dialog
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [newEmployeeName, setNewEmployeeName] = useState('')
  const [newEmployeeEmail, setNewEmployeeEmail] = useState('')

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

      {/* Password Reveal Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>✅ Employé ajouté avec succès</DialogTitle>
            <DialogDescription>
              Transmettez ces identifiants à <strong>{newEmployeeName}</strong>. Le mot de passe ne sera plus affiché.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4 space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Email de connexion</p>
                <p className="text-sm font-mono">{newEmployeeEmail || '—'}</p>
              </div>
              <Separator />
              <div className="space-y-1">
                <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Mot de passe généré</p>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-white px-3 py-1.5 text-sm font-mono font-bold text-emerald-800 border border-emerald-200">
                    {generatedPassword}
                  </code>
                  <CopyButton text={`Email: ${newEmployeeEmail}\nMot de passe: ${generatedPassword}`} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setPasswordDialogOpen(false)}>
              <Check className="h-4 w-4 mr-2" />
              J&apos;ai noté les identifiants
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
