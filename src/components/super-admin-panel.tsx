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
  MessageSquare,
} from 'lucide-react'
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
  emoji: string
}

// ─── Navigation ──────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Tableau de Bord', icon: <LayoutDashboard className="h-4 w-4" />, emoji: '📊' },
  { id: 'leads', label: 'Demandes Commerciales', icon: <TrendingUp className="h-4 w-4" />, emoji: '📋' },
  { id: 'codes', label: "Codes d'Activation", icon: <Key className="h-4 w-4" />, emoji: '🔑' },
  { id: 'hotels', label: 'Gestion des Hôtels', icon: <Hotel className="h-4 w-4" />, emoji: '🏨' },
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
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Nouveau</Badge>
    case 'contacted':
      return <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100">Contacté</Badge>
    case 'paid':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Payé</Badge>
    case 'cancelled':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Annulé</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function getCodeStatusBadge(status: string, hotelName: string | null) {
  switch (status) {
    case 'unused':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Inutilisé</Badge>
    case 'used':
      return (
        <div className="flex flex-col gap-0.5">
          <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">Utilisé</Badge>
          {hotelName && <span className="text-xs text-muted-foreground truncate max-w-[120px]">{hotelName}</span>}
        </div>
      )
    case 'expired':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Expiré</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function getHotelStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Actif</Badge>
    case 'suspended':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Suspendu</Badge>
    case 'inactive':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Inactif</Badge>
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
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
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
    <div className="flex h-full flex-col bg-gradient-to-b from-amber-50 to-orange-50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-amber-200/50">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
          <Hotel className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-amber-900">HôtelCI</h1>
          <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">Super Admin</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-amber-100 text-amber-900 shadow-sm'
                  : 'text-amber-800/70 hover:bg-amber-100/50 hover:text-amber-900'
              }`}
            >
              <span className="text-base">{item.emoji}</span>
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </nav>

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
              Super Admin
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
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      title: 'Demandes en Attente',
      value: stats?.newLeads ?? 0,
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      title: 'Codes Inutilisés',
      value: stats?.unusedCodes ?? 0,
      icon: <Key className="h-5 w-5" />,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: 'Revenu Mensuel Estimé',
      value: formatFCFA(stats?.estimatedRevenue ?? 0),
      icon: <DollarSign className="h-5 w-5" />,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">📊 Tableau de Bord</h2>
          <p className="text-muted-foreground">Vue d&apos;ensemble de la plateforme HôtelCI</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title} className="overflow-hidden">
            <CardContent className="p-6">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${card.bg} ${card.color}`}>
                    {card.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground truncate">{card.title}</p>
                    <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-amber-600" />
            Dernières Activités
          </CardTitle>
          <CardDescription>Activités récentes sur la plateforme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-400 mb-3">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <p className="text-sm text-muted-foreground">Aucune activité récente</p>
            <p className="text-xs text-muted-foreground mt-1">Les activités apparaîtront ici au fur et à mesure</p>
          </div>
        </CardContent>
      </Card>
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
  // When a prospect submits the Landing Page demo form, the leads table
  // gets a new row. The RealtimeProvider detects this change and we
  // auto-refresh the leads list with a toast notification.
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
      // New lead change detected
      const latestChange = leadChanges[0]
      if (latestChange.eventType === 'INSERT') {
        toast.info('🔔 Nouvelle demande commerciale !', {
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
          <h2 className="text-2xl font-bold tracking-tight">📋 Demandes Commerciales</h2>
          <p className="text-muted-foreground">Gérez les prospects et demandes</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLeads} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
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
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-400 mb-3">
                <TrendingUp className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground">Aucune demande commerciale</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom de l&apos;Hôtel</TableHead>
                    <TableHead>Prospect</TableHead>
                    <TableHead className="hidden md:table-cell">Téléphone</TableHead>
                    <TableHead className="hidden lg:table-cell">Taille</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
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
                      <TableCell className="hidden lg:table-cell">{lead.hotel_size_rooms} chambres</TableCell>
                      <TableCell>{formatDateFR(lead.created_at)}</TableCell>
                      <TableCell>{getLeadStatusBadge(lead.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {lead.status === 'new' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs border-sky-200 text-sky-700 hover:bg-sky-50"
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
                              className="h-8 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
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
        </CardContent>
      </Card>

      {/* Confirmation Dialog for Mark Paid */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer le paiement</DialogTitle>
            <DialogDescription>
              Voulez-vous marquer la demande de <strong>{confirmDialog.leadName}</strong> comme payée ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
              Annuler
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => handleMarkPaid(confirmDialog.leadId)}
              disabled={actionLoading === confirmDialog.leadId}
            >
              {actionLoading === confirmDialog.leadId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Traitement...
                </>
              ) : (
                'Confirmer le paiement'
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">🔑 Codes d&apos;Activation</h2>
          <p className="text-muted-foreground">Générez et gérez les codes d&apos;activation</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchCodes} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Générer un Code
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : codes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-400 mb-3">
                <Key className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground">Aucun code d&apos;activation</p>
              <p className="text-xs text-muted-foreground mt-1">Générez votre premier code en cliquant sur le bouton ci-dessus</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="hidden md:table-cell">Durée</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden lg:table-cell">Expire le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {codes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="rounded bg-gray-100 px-2 py-1 text-xs font-mono font-semibold">
                            {code.code}
                          </code>
                          <CopyButton text={code.code} />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{code.plan_name}</TableCell>
                      <TableCell className="hidden md:table-cell">{code.duration_months} mois</TableCell>
                      <TableCell>{getCodeStatusBadge(code.status, code.used_by_hotel_name)}</TableCell>
                      <TableCell className="hidden lg:table-cell">{formatDateFR(code.expires_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Code Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Générer un Code d&apos;Activation</DialogTitle>
            <DialogDescription>
              Créez un nouveau code d&apos;activation pour un hôtel
            </DialogDescription>
          </DialogHeader>

          {showSuccess && generatedCode ? (
            <div className="py-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Check className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Code généré avec succès</p>
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
                        {plan.name} — {formatFCFA(plan.price_fcfa)}/mois
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
              <Button onClick={handleCloseDialog} className="bg-amber-600 hover:bg-amber-700 text-white">
                Fermer
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleCloseDialog}>
                  Annuler
                </Button>
                <Button
                  className="bg-amber-600 hover:bg-amber-700 text-white"
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
    setActionLoading(hotelId)
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended'
    try {
      const res = await fetch(`/api/super-admin/hotels/${hotelId}`, {
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
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">🏨 Gestion des Hôtels</h2>
          <p className="text-muted-foreground">Gérez les hôtels de la plateforme</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHotels} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
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
          ) : hotels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-400 mb-3">
                <Building2 className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground">Aucun hôtel enregistré</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead className="hidden md:table-cell">Ville</TableHead>
                    <TableHead className="hidden lg:table-cell">Téléphone</TableHead>
                    <TableHead>Plan Actif</TableHead>
                    <TableHead className="hidden xl:table-cell">Période</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hotels.map((hotel) => (
                    <TableRow key={hotel.id}>
                      <TableCell className="font-medium">{hotel.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{hotel.city || '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell">{hotel.phone || '—'}</TableCell>
                      <TableCell>
                        {hotel.plan_name ? (
                          <div className="flex flex-col">
                            <span className="text-sm">{hotel.plan_name}</span>
                            {hotel.plan_price && (
                              <span className="text-xs text-muted-foreground">{formatFCFA(hotel.plan_price)}/mois</span>
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
                            className="h-8 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
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
                            className="h-8 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
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
        </CardContent>
      </Card>
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
        <aside className="hidden lg:flex lg:w-[280px] lg:flex-col lg:fixed lg:inset-y-0 z-50">
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
              <span className="text-lg">{currentTab?.emoji}</span>
              <h2 className="text-sm font-semibold text-foreground">{currentTab?.label}</h2>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50">
                <Shield className="h-3 w-3 mr-1" />
                Super Admin
              </Badge>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            {renderContent()}
          </main>

          {/* Footer */}
          <footer className="mt-auto border-t bg-white px-4 py-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
              <p>© {new Date().getFullYear()} HôtelCI — Gestion Hôtelière, Côte d&apos;Ivoire</p>
              <p className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Panneau Super Admin
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
