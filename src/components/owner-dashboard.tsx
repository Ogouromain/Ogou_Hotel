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
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

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

type TabId = 'overview' | 'rooms' | 'reservations' | 'customers' | 'settings'

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

// ─── Navigation ──────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Tableau de bord', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'rooms', label: 'Chambres', icon: <Bed className="h-4 w-4" /> },
  { id: 'reservations', label: 'Réservations', icon: <Calendar className="h-4 w-4" /> },
  { id: 'customers', label: 'Clients', icon: <Users className="h-4 w-4" /> },
  { id: 'settings', label: 'Paramètres', icon: <Settings className="h-4 w-4" /> },
]

// ─── Component ───────────────────────────────────────────────────────────────

export function OwnerDashboard({ profile, onLogout, isNewRegistration }: OwnerDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [hotelInfo, setHotelInfo] = useState<HotelInfo | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSuccessBanner, setShowSuccessBanner] = useState(isNewRegistration ?? false)

  // Fetch hotel and subscription info
  const fetchHotelData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/owner/hotel')
      if (res.ok) {
        const data = await res.json()
        if (data.hotel) {
          setHotelInfo(data.hotel)
        }
        if (data.subscription) {
          setSubscription(data.subscription)
        }
      } else {
        console.error('Failed to fetch hotel data:', data?.error)
      }
    } catch {
      console.error('Failed to fetch hotel data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHotelData()
  }, [fetchHotelData])

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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
              <Hotel className="h-4 w-4 text-white" />
            </div>
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
            <div className="mb-6 rounded-xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-6 dark:from-emerald-950/30 dark:to-green-950/30 dark:border-emerald-900/50">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-emerald-800 dark:text-emerald-300">
                    Félicitations, votre hôtel a été configuré avec succès !
                  </h2>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                    Votre espace est prêt. Vous pouvez commencer à configurer vos chambres et gérer vos réservations.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100"
                  onClick={() => setShowSuccessBanner(false)}
                >
                  ✕
                </Button>
              </div>
            </div>
          )}

          {/* Hotel & Subscription Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Hotel Info Card */}
            <Card className="border-amber-200/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-5 w-5 text-amber-600" />
                  Informations de l&apos;Hôtel
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-40" />
                  </div>
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

            {/* Subscription Info Card */}
            <Card className="border-amber-200/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-5 w-5 text-amber-600" />
                  Abonnement
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                ) : subscription ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xl font-bold text-gray-900">Plan {subscription.plan_name}</p>
                        <p className="text-sm text-muted-foreground">{formatFCFA(subscription.plan_price)}/mois</p>
                      </div>
                      {getSubscriptionStatusBadge(subscription.status)}
                    </div>
                    <Separator />
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="h-4 w-4 text-amber-500 shrink-0" />
                        <span>
                          {subscription.starts_at
                            ? `Début : ${formatDateFR(subscription.starts_at)}`
                            : 'Date de début non disponible'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                        <span>
                          {subscription.ends_at
                            ? `Expire le : ${formatDateFR(subscription.ends_at)}`
                            : 'Date de fin non disponible'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Informations d&apos;abonnement non disponibles</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold tracking-tight">📊 Tableau de Bord</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { title: 'Chambres', value: '0', icon: <Bed className="h-5 w-5" />, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { title: 'Réservations', value: '0', icon: <Calendar className="h-5 w-5" />, color: 'text-orange-600', bg: 'bg-orange-50' },
                  { title: 'Clients', value: '0', icon: <Users className="h-5 w-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { title: 'Occupation', value: '0%', icon: <BarChart3 className="h-5 w-5" />, color: 'text-rose-600', bg: 'bg-rose-50' },
                ].map((card) => (
                  <Card key={card.title}>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${card.bg} ${card.color}`}>
                          {card.icon}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                          <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-600" />
                    Bienvenue sur HôtelCI
                  </CardTitle>
                  <CardDescription>
                    Commencez par ajouter vos chambres pour recevoir des réservations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-400 mb-3">
                      <Bed className="h-6 w-6" />
                    </div>
                    <p className="text-sm text-muted-foreground">Aucune chambre configurée</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ajoutez vos chambres dans l&apos;onglet « Chambres » pour commencer
                    </p>
                    <Button
                      className="mt-4 bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() => setActiveTab('rooms')}
                    >
                      <Bed className="h-4 w-4 mr-2" />
                      Ajouter des chambres
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'rooms' && (
            <Card>
              <CardHeader>
                <CardTitle>🛏️ Gestion des Chambres</CardTitle>
                <CardDescription>Cette fonctionnalité sera disponible prochainement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-400 mb-3">
                    <Bed className="h-7 w-7" />
                  </div>
                  <p className="text-muted-foreground">Module en cours de développement</p>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'reservations' && (
            <Card>
              <CardHeader>
                <CardTitle>📅 Réservations</CardTitle>
                <CardDescription>Cette fonctionnalité sera disponible prochainement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-400 mb-3">
                    <Calendar className="h-7 w-7" />
                  </div>
                  <p className="text-muted-foreground">Module en cours de développement</p>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'customers' && (
            <Card>
              <CardHeader>
                <CardTitle>👥 Clients</CardTitle>
                <CardDescription>Cette fonctionnalité sera disponible prochainement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-400 mb-3">
                    <Users className="h-7 w-7" />
                  </div>
                  <p className="text-muted-foreground">Module en cours de développement</p>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'settings' && (
            <Card>
              <CardHeader>
                <CardTitle>⚙️ Paramètres</CardTitle>
                <CardDescription>Configuration de votre établissement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-400 mb-3">
                    <Settings className="h-7 w-7" />
                  </div>
                  <p className="text-muted-foreground">Module en cours de développement</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
