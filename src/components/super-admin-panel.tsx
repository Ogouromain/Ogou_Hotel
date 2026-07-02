'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Building2,
  TrendingUp,
  Key,
  DollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  Loader2,
  Plus,
  Copy,
  Check,
  RefreshCw,
  Hotel,
  Phone,
  Mail,
  Shield,
  Ban,
  RotateCcw,
  BellRing,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  MapPin,
  Users,
} from 'lucide-react'
import Image from 'next/image'
import { useRealtimeSafe } from '@/lib/realtime-context'
import { RealtimeIndicator } from '@/components/realtime-indicator'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SuperAdminPanelProps {
  onLogout: () => void
  profile: {
    id: string
    first_name: string
    last_name: string
    role: string
  }
}

interface SuperAdminStats {
  activeHotels: number
  newLeads: number
  unusedCodes: number
  estimatedRevenue: number
}

interface LeadItem {
  id: string
  hotel_name: string
  prospect_name: string
  prospect_email: string
  prospect_phone: string
  hotel_size_rooms: number
  status: 'new' | 'contacted' | 'paid' | 'cancelled'
  created_at: string
}

interface SubscriptionPlanItem {
  id: string
  name: string
  price_fcfa: number
}

interface ActivationCodeItem {
  id: string
  code: string
  plan_id: string
  plan_name: string
  duration_months: number
  status: 'unused' | 'used' | 'expired'
  used_by_hotel_name: string | null
  expires_at: string
  created_at: string
}

interface HotelItem {
  id: string
  name: string
  city: string | null
  phone: string | null
  plan_name: string | null
  plan_price: number | null
  subscription_start: string | null
  subscription_end: string | null
  status: 'active' | 'suspended' | 'inactive'
}

type TabId = 'dashboard' | 'leads' | 'codes' | 'hotels'

interface NavItem {
  id: TabId
  label: string
  icon: React.ReactNode
}

// ─── Navigation ──────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Tableau de Bord', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'leads', label: 'Demandes Commerciales', icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'codes', label: "Codes d'Activation", icon: <Key className="h-4 w-4" /> },
  { id: 'hotels', label: 'Gestion des Hôtels', icon: <Hotel className="h-4 w-4" /> },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

function formatDateFR(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function getLeadStatusBadge(status: string) {
  switch (status) {
    case 'new':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 font-medium">Nouveau</Badge>
    case 'contacted':
      return <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100 font-medium">Contacté</Badge>
    case 'paid':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-medium flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Payé
        </Badge>
      )
    case 'cancelled':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 font-medium">Annulé</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function getCodeStatusBadge(status: string, hotelName: string | null) {
  switch (status) {
    case 'unused':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-medium flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Disponible
        </Badge>
      )
    case 'used':
      return (
        <div className="flex flex-col gap-0.5">
          <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100 font-medium">Utilisé</Badge>
          {hotelName && <span className="text-xs text-muted-foreground truncate max-w-[120px]">{hotelName}</span>}
        </div>
      )
    case 'expired':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 font-medium">Expiré</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function getHotelStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-medium flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Actif
        </Badge>
      )
    case 'suspended':
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 font-medium flex items-center gap-1">
          <Ban className="h-3 w-3" />
          Suspendu
        </Badge>
      )
    case 'inactive':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 font-medium">Inactif</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

// ─── Copy Button ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Copié dans le presse-papier')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Impossible de copier')
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-7 w-7 transition-all duration-300 ${copied ? 'text-emerald-500' : 'text-muted-foreground hover:text-foreground'}`}
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  )
}

// ─── Sidebar Content ─────────────────────────────────────────────────────────

function SidebarContent({
  activeTab,
  onTabChange,
  profile,
  onLogout,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  profile: SuperAdminPanelProps['profile']
  onLogout: () => void
}) {
  return (
    <div className="flex h-full flex-col bg-slate-800">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-700">
        <Image src="/logo.svg" alt="OGOU_Hôtel" height={36} width={36} className="object-contain" />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">OGOU_Hôtel</h1>
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">Super Admin</p>
            <RealtimeIndicator compact />
          </div>
        </div>
      </div>

      {/* Role Indicator */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
          <Shield className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold text-emerald-300">Accès Super Administrateur</span>
          <div className="ml-auto h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="truncate flex-1">{item.label}</span>
              {isActive && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
            </button>
          )
        })}
      </nav>

      {/* Email Support */}
      <div className="px-4 py-2 border-t border-slate-700">
        <a
          href="mailto:omouitsi@gmail.com"
          className="flex items-center gap-2 rounded-lg bg-slate-700/50 border border-slate-600 px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors w-full"
        >
          <Mail className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="truncate">omouitsi@gmail.com</span>
        </a>
      </div>

      {/* User Info */}
      <div className="border-t border-slate-700 px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold shrink-0">
            {profile.first_name.charAt(0)}{profile.last_name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{profile.first_name} {profile.last_name}</p>
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Super Admin
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white transition-all duration-300"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Déconnexion
        </Button>
      </div>
    </div>
  )
}

// ─── Tab 1: Stats Dashboard ──────────────────────────────────────────────────

function StatsTab() {
  const [stats, setStats] = useState<SuperAdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/super-admin/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      } else {
        toast.error('Erreur lors du chargement des statistiques')
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const statCards = [
    {
      title: 'Hôtels Actifs',
      value: stats?.activeHotels ?? 0,
      icon: <Building2 className="h-5 w-5" />,
      bgGradient: 'from-amber-50 to-orange-50',
      gradient: 'from-amber-400 to-orange-500',
      iconBg: 'bg-gradient-to-br from-amber-400 to-orange-500',
    },
    {
      title: 'Demandes en Attente',
      value: stats?.newLeads ?? 0,
      icon: <TrendingUp className="h-5 w-5" />,
      bgGradient: 'from-orange-50 to-amber-50',
      gradient: 'from-orange-400 to-amber-500',
      iconBg: 'bg-gradient-to-br from-orange-400 to-amber-500',
    },
    {
      title: 'Codes Inutilisés',
      value: stats?.unusedCodes ?? 0,
      icon: <Key className="h-5 w-5" />,
      bgGradient: 'from-emerald-50 to-green-50',
      gradient: 'from-emerald-400 to-green-500',
      iconBg: 'bg-gradient-to-br from-emerald-400 to-green-500',
    },
    {
      title: 'Revenu Mensuel Estimé',
      value: formatFCFA(stats?.estimatedRevenue ?? 0),
      icon: <DollarSign className="h-5 w-5" />,
      bgGradient: 'from-rose-50 to-orange-50',
      gradient: 'from-rose-400 to-orange-500',
      iconBg: 'bg-gradient-to-br from-rose-400 to-orange-500',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-sm">
              <LayoutDashboard className="h-4 w-4" />
            </div>
            Tableau de Bord
          </h2>
          <p className="text-muted-foreground mt-1">Vue d&apos;ensemble de la plateforme OGOU_Hôtel</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading} className="transition-all duration-300">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.title}
            className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.bgGradient} border border-white/60 shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-[1.02]`}
          >
            {/* Decorative gradient blob */}
            <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${card.gradient} opacity-10 group-hover:opacity-20 transition-opacity duration-300`} />

            <div className="relative p-5 sm:p-6">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ) : (
                <>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.iconBg} text-white shadow-sm mb-3`}>
                    {card.icon}
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-bold tracking-tight mt-0.5">{card.value}</p>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activities Card */}
      <div className="rounded-2xl border border-amber-200/60 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Dernières Activités</h3>
            <p className="text-sm text-muted-foreground">Activités récentes sur la plateforme</p>
          </div>
        </div>
        <div className="p-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 mb-4">
              <LayoutDashboard className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Aucune activité récente</p>
            <p className="text-xs text-muted-foreground mt-1">Les activités apparaîtront ici au fur et à mesure</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 2: Leads ────────────────────────────────────────────────────────────

function LeadsTab() {
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; leadId: string; leadName: string }>({
    open: false,
    leadId: '',
    leadName: '',
  })

  // ─── Real-time: Auto-refresh leads when a new lead is inserted ──────────
  const { recentChanges } = useRealtimeSafe()
  const prevLeadChangeCountRef = useRef(0)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/super-admin/leads')
      if (res.ok) {
        const data = await res.json()
        setLeads(data.leads || [])
      } else {
        toast.error('Erreur lors du chargement des demandes')
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // React to real-time changes on the leads table
  useEffect(() => {
    const leadChanges = recentChanges.filter(c => c.table === 'leads')
    if (leadChanges.length > prevLeadChangeCountRef.current && prevLeadChangeCountRef.current > 0) {
      const latestChange = leadChanges[0]
      if (latestChange.eventType === 'INSERT') {
        toast.info('Nouvelle demande commerciale !', {
          description: 'Un prospect vient de soumettre une demande de démo.',
          duration: 5000,
        })
      }
      fetchLeads()
    }
    prevLeadChangeCountRef.current = leadChanges.length
  }, [recentChanges, fetchLeads])

  async function handleContactLead(leadId: string) {
    setActionLoading(leadId)
    try {
      const res = await fetch(`/api/super-admin/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'contacted' }),
      })
      if (res.ok) {
        toast.success('Statut mis à jour : Contacté')
        fetchLeads()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la mise à jour')
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleMarkPaid(leadId: string) {
    setActionLoading(leadId)
    try {
      const res = await fetch(`/api/super-admin/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      })
      if (res.ok) {
        toast.success('Statut mis à jour : Payé')
        fetchLeads()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la mise à jour')
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setActionLoading(null)
      setConfirmDialog({ open: false, leadId: '', leadName: '' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-sm">
              <TrendingUp className="h-4 w-4" />
            </div>
            Demandes Commerciales
          </h2>
          <p className="text-muted-foreground mt-1">Gérez les prospects et demandes</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLeads} disabled={loading} className="transition-all duration-300">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 mb-4">
              <TrendingUp className="h-8 w-8 text-orange-300" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Aucune demande commerciale</p>
            <p className="text-xs text-muted-foreground mt-1">Les demandes de démo apparaîtront ici</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="bg-gray-50/80">Nom de l&apos;Hôtel</TableHead>
                  <TableHead className="bg-gray-50/80">Prospect</TableHead>
                  <TableHead className="hidden md:table-cell bg-gray-50/80">Téléphone</TableHead>
                  <TableHead className="hidden lg:table-cell bg-gray-50/80">Taille</TableHead>
                  <TableHead className="bg-gray-50/80">Date</TableHead>
                  <TableHead className="bg-gray-50/80">Statut</TableHead>
                  <TableHead className="text-right bg-gray-50/80">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id} className="transition-colors duration-200 hover:bg-amber-50/50">
                    <TableCell className="font-medium">{lead.hotel_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{lead.prospect_name}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {lead.prospect_email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3" />
                        {lead.prospect_phone}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline" className="text-xs font-normal">
                        {lead.hotel_size_rooms} chambres
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatDateFR(lead.created_at)}</TableCell>
                    <TableCell>{getLeadStatusBadge(lead.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {lead.status === 'new' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs border-orange-200 text-orange-700 hover:bg-orange-50 transition-all duration-300"
                            onClick={() => handleContactLead(lead.id)}
                            disabled={actionLoading === lead.id}
                          >
                            {actionLoading === lead.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Mail className="h-3 w-3 mr-1" />
                            )}
                            Contacter
                          </Button>
                        )}
                        {(lead.status === 'new' || lead.status === 'contacted') && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-all duration-300"
                            onClick={() => setConfirmDialog({ open: true, leadId: lead.id, leadName: lead.hotel_name })}
                            disabled={actionLoading === lead.id}
                          >
                            {actionLoading === lead.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <DollarSign className="h-3 w-3 mr-1" />
                            )}
                            Marquer payé
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
      </div>

      {/* Confirmation Dialog for Mark Paid */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              Confirmer le paiement
            </DialogTitle>
            <DialogDescription>
              Voulez-vous marquer la demande de <strong>{confirmDialog.leadName}</strong> comme payée ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              Un code d&apos;activation devra être généré et communiqué au client après confirmation du paiement.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ ...confirmDialog, open: false })} className="transition-all duration-300">
              Annuler
            </Button>
            <Button
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-sm transition-all duration-300"
              onClick={() => handleMarkPaid(confirmDialog.leadId)}
              disabled={actionLoading === confirmDialog.leadId}
            >
              {actionLoading === confirmDialog.leadId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Traitement...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmer le paiement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Tab 3: Activation Codes ─────────────────────────────────────────────────

function CodesTab() {
  const [codes, setCodes] = useState<ActivationCodeItem[]>([])
  const [plans, setPlans] = useState<SubscriptionPlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('')
  const [selectedDuration, setSelectedDuration] = useState('')
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  const fetchCodes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/super-admin/activation-codes')
      if (res.ok) {
        const data = await res.json()
        setCodes(data.codes || [])
      } else {
        toast.error('Erreur lors du chargement des codes')
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/super-admin/subscription-plans')
      if (res.ok) {
        const data = await res.json()
        setPlans(data.plans || [])
      }
    } catch {
      // silent fail for plans
    }
  }, [])

  useEffect(() => {
    fetchCodes()
    fetchPlans()
  }, [fetchCodes, fetchPlans])

  async function handleGenerateCode() {
    if (!selectedPlan || !selectedDuration) {
      toast.error('Veuillez sélectionner un plan et une durée')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/super-admin/activation-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlan,
          durationMonths: parseInt(selectedDuration),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setGeneratedCode(data.code?.code || null)
        setShowSuccess(true)
        toast.success("Code d'activation généré avec succès")
        fetchCodes()
      } else {
        const data = await res.json()
        toast.error(data.error || "Erreur lors de la génération du code")
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCloseDialog() {
    setDialogOpen(false)
    setGeneratedCode(null)
    setShowSuccess(false)
    setSelectedPlan('')
    setSelectedDuration('')
  }

  const durationOptions = [
    { value: '1', label: '1 mois' },
    { value: '3', label: '3 mois' },
    { value: '6', label: '6 mois' },
    { value: '12', label: '12 mois' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-sm">
              <Key className="h-4 w-4" />
            </div>
            Codes d&apos;Activation
          </h2>
          <p className="text-muted-foreground mt-1">Générez et gérez les codes d&apos;activation</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchCodes} disabled={loading} className="transition-all duration-300">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-sm shadow-amber-500/20 transition-all duration-300"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Générer un Code
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : codes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 mb-4">
              <Key className="h-8 w-8 text-emerald-300" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Aucun code d&apos;activation</p>
            <p className="text-xs text-muted-foreground mt-1">Générez votre premier code en cliquant sur le bouton ci-dessus</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="bg-gray-50/80">Code</TableHead>
                  <TableHead className="bg-gray-50/80">Plan</TableHead>
                  <TableHead className="hidden md:table-cell bg-gray-50/80">Durée</TableHead>
                  <TableHead className="bg-gray-50/80">Statut</TableHead>
                  <TableHead className="hidden lg:table-cell bg-gray-50/80">Expire le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((code) => (
                  <TableRow key={code.id} className="transition-colors duration-200 hover:bg-emerald-50/30">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className={`rounded-lg px-3 py-1.5 text-xs font-mono font-bold ${
                          code.status === 'unused'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : code.status === 'used'
                            ? 'bg-gray-100 text-gray-500 border border-gray-200'
                            : 'bg-red-50 text-red-600 border border-red-200'
                        }`}>
                          {code.code}
                        </code>
                        <CopyButton text={code.code} />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{code.plan_name}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="text-xs font-normal">
                        {code.duration_months} mois
                      </Badge>
                    </TableCell>
                    <TableCell>{getCodeStatusBadge(code.status, code.used_by_hotel_name)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{formatDateFR(code.expires_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Generate Code Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                <Key className="h-4 w-4 text-amber-600" />
              </div>
              Générer un Code d&apos;Activation
            </DialogTitle>
            <DialogDescription>
              Créez un nouveau code d&apos;activation pour un hôtel
            </DialogDescription>
          </DialogHeader>

          {showSuccess && generatedCode ? (
            <div className="py-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-sm">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Code généré avec succès</p>
                  <div className="flex items-center gap-2 justify-center">
                    <code className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-lg font-mono font-bold text-amber-800">
                      {generatedCode}
                    </code>
                    <CopyButton text={generatedCode} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Plan d&apos;Abonnement</label>
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} — {formatFCFA(plan.price_fcfa)}/an
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Durée</label>
                <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une durée" />
                  </SelectTrigger>
                  <SelectContent>
                    {durationOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            {showSuccess ? (
              <Button onClick={handleCloseDialog} className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white transition-all duration-300">
                Fermer
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleCloseDialog} className="transition-all duration-300">
                  Annuler
                </Button>
                <Button
                  className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-sm transition-all duration-300"
                  onClick={handleGenerateCode}
                  disabled={submitting || !selectedPlan || !selectedDuration}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <Key className="h-4 w-4 mr-2" />
                      Générer
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Tab 4: Hotels Management ────────────────────────────────────────────────

function HotelsTab() {
  const [hotels, setHotels] = useState<HotelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    hotelId: string
    hotelName: string
    action: 'suspend' | 'activate'
  }>({ open: false, hotelId: '', hotelName: '', action: 'suspend' })

  const fetchHotels = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/super-admin/hotels')
      if (res.ok) {
        const data = await res.json()
        setHotels(data.hotels || [])
      } else {
        toast.error('Erreur lors du chargement des hôtels')
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHotels()
  }, [fetchHotels])

  async function handleToggleStatus(hotelId: string, currentStatus: string) {
    // Open confirm dialog first
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended'
    const hotel = hotels.find(h => h.id === hotelId)
    setConfirmDialog({
      open: true,
      hotelId,
      hotelName: hotel?.name || '',
      action: newStatus === 'suspended' ? 'suspend' : 'activate',
    })
  }

  async function confirmToggleStatus() {
    setActionLoading(confirmDialog.hotelId)
    const newStatus = confirmDialog.action === 'suspend' ? 'suspended' : 'active'
    try {
      const res = await fetch(`/api/super-admin/hotels/${confirmDialog.hotelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        toast.success(newStatus === 'suspended' ? 'Hôtel suspendu' : 'Hôtel réactivé')
        fetchHotels()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la mise à jour')
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setActionLoading(null)
      setConfirmDialog({ open: false, hotelId: '', hotelName: '', action: 'suspend' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
              <Building2 className="h-4 w-4" />
            </div>
            Gestion des Hôtels
          </h2>
          <p className="text-muted-foreground mt-1">Gérez les hôtels de la plateforme</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHotels} disabled={loading} className="transition-all duration-300">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : hotels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 mb-4">
              <Building2 className="h-8 w-8 text-amber-300" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Aucun hôtel enregistré</p>
            <p className="text-xs text-muted-foreground mt-1">Les hôtels apparaîtront ici après inscription</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="bg-gray-50/80">Nom</TableHead>
                  <TableHead className="hidden md:table-cell bg-gray-50/80">Ville</TableHead>
                  <TableHead className="hidden lg:table-cell bg-gray-50/80">Téléphone</TableHead>
                  <TableHead className="bg-gray-50/80">Plan Actif</TableHead>
                  <TableHead className="hidden xl:table-cell bg-gray-50/80">Période</TableHead>
                  <TableHead className="bg-gray-50/80">Statut</TableHead>
                  <TableHead className="text-right bg-gray-50/80">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hotels.map((hotel) => (
                  <TableRow key={hotel.id} className="transition-colors duration-200 hover:bg-amber-50/30">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          hotel.status === 'active'
                            ? 'bg-emerald-100 text-emerald-600'
                            : hotel.status === 'suspended'
                            ? 'bg-amber-100 text-amber-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          <Hotel className="h-4 w-4" />
                        </div>
                        <span className="font-medium">{hotel.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {hotel.city || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {hotel.phone || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {hotel.plan_name ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{hotel.plan_name}</span>
                          {hotel.plan_price && (
                            <span className="text-xs text-muted-foreground">{formatFCFA(hotel.plan_price)}/an</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Aucun abonnement</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {hotel.subscription_start && hotel.subscription_end ? (
                        <span className="text-xs">
                          {formatDateFR(hotel.subscription_start)} → {formatDateFR(hotel.subscription_end)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{getHotelStatusBadge(hotel.status)}</TableCell>
                    <TableCell className="text-right">
                      {hotel.status === 'suspended' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-all duration-300"
                          onClick={() => handleToggleStatus(hotel.id, hotel.status)}
                          disabled={actionLoading === hotel.id}
                        >
                          {actionLoading === hotel.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3 mr-1" />
                          )}
                          Réactiver
                        </Button>
                      ) : hotel.status === 'active' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs border-amber-200 text-amber-700 hover:bg-amber-50 transition-all duration-300"
                          onClick={() => handleToggleStatus(hotel.id, hotel.status)}
                          disabled={actionLoading === hotel.id}
                        >
                          {actionLoading === hotel.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Ban className="h-3 w-3 mr-1" />
                          )}
                          Suspendre
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Suspend/Activate Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDialog.action === 'suspend' ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                  <Ban className="h-4 w-4 text-red-600" />
                </div>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                  <RotateCcw className="h-4 w-4 text-emerald-600" />
                </div>
              )}
              {confirmDialog.action === 'suspend' ? 'Suspendre l\'hôtel' : 'Réactiver l\'hôtel'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.action === 'suspend'
                ? <>Voulez-vous suspendre l&apos;hôtel <strong>{confirmDialog.hotelName}</strong> ? Les utilisateurs ne pourront plus y accéder.</>
                : <>Voulez-vous réactiver l&apos;hôtel <strong>{confirmDialog.hotelName}</strong> ? Il sera à nouveau accessible.</>
              }
            </DialogDescription>
          </DialogHeader>

          {confirmDialog.action === 'suspend' && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">
                La suspension bloquera l&apos;accès à l&apos;hôtel pour tous les utilisateurs, y compris le propriétaire.
              </p>
            </div>
          )}

          {confirmDialog.action === 'activate' && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-700">
                L&apos;hôtel sera de nouveau accessible et toutes les fonctionnalités seront restaurées.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ ...confirmDialog, open: false })} className="transition-all duration-300">
              Annuler
            </Button>
            <Button
              className={
                confirmDialog.action === 'suspend'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-sm transition-all duration-300'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-sm transition-all duration-300'
              }
              onClick={confirmToggleStatus}
              disabled={actionLoading === confirmDialog.hotelId}
            >
              {actionLoading === confirmDialog.hotelId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Traitement...
                </>
              ) : confirmDialog.action === 'suspend' ? (
                <>
                  <Ban className="h-4 w-4 mr-2" />
                  Confirmer la suspension
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Confirmer la réactivation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Mobile Bottom Navigation ────────────────────────────────────────────────

function MobileBottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}) {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-lg shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <nav className="flex items-center justify-around px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-300 min-w-[60px] ${
                isActive
                  ? 'text-emerald-600 bg-emerald-50'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
                {item.icon}
              </span>
              <span className="text-[10px] font-medium leading-tight truncate w-full text-center">
                {item.label.split(' ')[0]}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function SuperAdminPanel({ onLogout, profile }: SuperAdminPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
    setMobileMenuOpen(false)
  }

  function renderContent() {
    switch (activeTab) {
      case 'dashboard':
        return <StatsTab />
      case 'leads':
        return <LeadsTab />
      case 'codes':
        return <CodesTab />
      case 'hotels':
        return <HotelsTab />
      default:
        return <StatsTab />
    }
  }

  const currentTab = NAV_ITEMS.find((item) => item.id === activeTab)

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex lg:w-[280px] lg:flex-col lg:fixed lg:inset-y-0 z-50 border-r border-slate-700">
          <SidebarContent
            activeTab={activeTab}
            onTabChange={handleTabChange}
            profile={profile}
            onLogout={onLogout}
          />
        </aside>

        {/* Mobile Sidebar */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-[280px] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu de navigation</SheetTitle>
            </SheetHeader>
            <SidebarContent
              activeTab={activeTab}
              onTabChange={handleTabChange}
              profile={profile}
              onLogout={onLogout}
            />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <div className="flex flex-1 flex-col lg:pl-[280px]">
          {/* Top Bar */}
          <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-white px-4 sm:px-6 shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex items-center gap-2 flex-1">
              {currentTab?.icon}
              <h2 className="text-sm font-semibold text-foreground">{currentTab?.label}</h2>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 hidden sm:flex">
                <Shield className="h-3 w-3 mr-1" />
                Super Admin
              </Badge>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8">
            {renderContent()}
          </main>

          {/* Footer */}
          <footer className="mt-auto border-t bg-white px-4 py-4 sm:px-6 hidden lg:block">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
              <p>&copy; {new Date().getFullYear()} OGOU_Hôtel — Gestion Hôtelière, Côte d&apos;Ivoire</p>
              <p className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Panneau Super Admin
              </p>
            </div>
          </footer>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  )
}
