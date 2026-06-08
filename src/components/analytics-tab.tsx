'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  BarChart3,
  TrendingUp,
  Bed,
  Calendar,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Users,
  Utensils,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Download,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

import { RealtimeIndicator } from '@/components/realtime-indicator'
import { useRealtimeSafe } from '@/lib/realtime-context'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnalyticsTabProps {
  onRefresh?: () => void
}

interface AnalyticsData {
  total_rooms: number
  occupied_rooms: number
  occupancy_rate: number
  total_revenue_month: number
  total_revenue_year: number
  pending_reservations: number
  checked_in_reservations: number
  adr: number
  revpar: number
  restaurant_revenue_month: number
  conference_revenue_month: number
}

interface StockAlert {
  id: string
  name: string
  quantity: number
  unit: string
  min_threshold: number
}

interface ReservationAlert {
  id: string
  customer_name: string
  room_number: string
  check_in_date: string
  status: string
}

interface MonthlyRevenuePoint {
  month: string
  revenue: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

function formatCompactFCFA(amount: number): string {
  if (amount >= 1_000_000) {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(amount / 1_000_000) + ' M FCFA'
  }
  if (amount >= 1_000) {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount / 1_000) + ' k FCFA'
  }
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

const MONTHS_FR = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
  'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
]

function generatePlaceholderMonthlyData(): MonthlyRevenuePoint[] {
  const now = new Date()
  const data: MonthlyRevenuePoint[] = []
  for (let i = 5; i >= 0; i--) {
    const monthIndex = (now.getMonth() - i + 12) % 12
    data.push({
      month: MONTHS_FR[monthIndex],
      revenue: Math.round(800_000 + Math.random() * 2_500_000),
    })
  }
  return data
}

// ─── Chart Config ────────────────────────────────────────────────────────────

const revenueChartConfig: ChartConfig = {
  revenue: {
    label: 'Revenu',
    color: 'hsl(38, 92%, 50%)',
  },
}

// ─── KPI Card Sub-component ─────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendLabel,
  gradient,
  iconBg,
}: {
  title: string
  value: string
  subtitle?: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  gradient: string
  iconBg: string
}) {
  return (
    <Card className="border-amber-200/50 overflow-hidden relative">
      {/* Subtle gradient accent at top */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${gradient}`} />
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
            <p className="text-xl sm:text-2xl font-bold tracking-tight truncate">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
          <div className={`flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
            {icon}
          </div>
        </div>
        {trend && trendLabel && (
          <div className="mt-2 flex items-center gap-1">
            {trend === 'up' && <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />}
            {trend === 'down' && <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />}
            <span className={`text-xs font-medium ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground'}`}>
              {trendLabel}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="border-amber-200/50">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-7 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-10 w-10 rounded-xl" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart skeleton */}
      <Card className="border-amber-200/50">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-36" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>

      {/* Alerts skeleton */}
      <Card className="border-amber-200/50">
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AnalyticsTab({ onRefresh }: AnalyticsTabProps) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([])
  const [reservationAlerts, setReservationAlerts] = useState<ReservationAlert[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyRevenuePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ─── Real-time ────────────────────────────────────────────────────────
  const { recentChanges, markRefreshed } = useRealtimeSafe()
  const prevChangeCountRef = useRef(0)

  // ─── Fetch analytics data ─────────────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/owner/analytics')
      if (res.ok) {
        const json = await res.json()
        // Handle both flat response and legacy nested { analytics: {...} } format
        const flat = json.analytics || json
        setData(flat)

        // Process stock alerts from response (if provided)
        if (flat.stock_alerts) {
          setStockAlerts(flat.stock_alerts)
        }

        // Process reservation alerts from response (if provided)
        if (flat.reservation_alerts) {
          setReservationAlerts(flat.reservation_alerts)
        }

        // Process monthly revenue data from response (if provided)
        if (flat.monthly_revenue && Array.isArray(flat.monthly_revenue)) {
          setMonthlyData(flat.monthly_revenue)
        } else {
          // Generate placeholder monthly data for the chart
          setMonthlyData(generatePlaceholderMonthlyData())
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        setError(errData.error || 'Erreur lors du chargement des analyses')
        // Still generate placeholder chart data
        setMonthlyData(generatePlaceholderMonthlyData())
      }
    } catch {
      setError('Erreur de connexion au serveur')
      setMonthlyData(generatePlaceholderMonthlyData())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // ─── React to real-time changes ───────────────────────────────────────
  useEffect(() => {
    if (recentChanges.length > prevChangeCountRef.current && prevChangeCountRef.current > 0) {
      const latestChange = recentChanges[0]
      if (latestChange.table === 'rooms' || latestChange.table === 'reservations') {
        const timer = setTimeout(() => {
          fetchAnalytics()
          markRefreshed()
          onRefresh?.()
        }, 600)
        return () => clearTimeout(timer)
      }
    }
    prevChangeCountRef.current = recentChanges.length
  }, [recentChanges.length, fetchAnalytics, markRefreshed, onRefresh])

  // ─── Handle manual refresh ────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    fetchAnalytics()
    onRefresh?.()
  }, [fetchAnalytics, onRefresh])

  // ─── Export analytics to CSV ───────────────────────────────────────────
  const handleExportAnalytics = useCallback(() => {
    if (!data) return

    const rows = [
      { metric: 'Chambres totales', value: String(data.total_rooms), period: 'Actuel' },
      { metric: 'Chambres occupées', value: String(data.occupied_rooms), period: 'Actuel' },
      { metric: 'Taux d\'occupation (%)', value: data.occupancy_rate.toFixed(1), period: 'Actuel' },
      { metric: 'Revenu mensuel (FCFA)', value: String(data.total_revenue_month), period: 'Ce mois-ci' },
      { metric: 'Revenu annuel (FCFA)', value: String(data.total_revenue_year), period: 'Cette année' },
      { metric: 'Réservations en attente', value: String(data.pending_reservations), period: 'Actuel' },
      { metric: 'Clients enregistrés', value: String(data.checked_in_reservations), period: 'Actuel' },
      { metric: 'ADR - Prix moyen/jour (FCFA)', value: String(data.adr), period: 'Cette année' },
      { metric: 'RevPAR (FCFA)', value: String(data.revpar), period: 'Cette année' },
      { metric: 'Revenu restaurant (FCFA)', value: String(data.restaurant_revenue_month), period: 'Ce mois-ci' },
      { metric: 'Revenu conférence (FCFA)', value: String(data.conference_revenue_month), period: 'Ce mois-ci' },
    ]

    const BOM = '\uFEFF'
    const sep = ';'
    const header = `"Indicateur"${sep}"Valeur"${sep}"Période"`
    const csvRows = rows.map(r => `"${r.metric}"${sep}"${r.value}"${sep}"${r.period}"`)
    const csv = BOM + header + '\n' + csvRows.join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `analyses_ogou_hotel_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Analyses exportées en CSV')
  }, [data])

  // ─── Loading state ────────────────────────────────────────────────────
  if (loading && !data) {
    return <AnalyticsSkeleton />
  }

  // ─── Error state ──────────────────────────────────────────────────────
  if (error && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">📊 Analyses</h2>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  // ─── Derived values ───────────────────────────────────────────────────
  const occupancyRate = data?.occupancy_rate ?? 0
  const occupancyColor =
    occupancyRate >= 80 ? 'text-emerald-600' :
    occupancyRate >= 50 ? 'text-amber-600' :
    'text-red-600'

  const occupancyBarColor =
    occupancyRate >= 80 ? '[&>div]:bg-emerald-500' :
    occupancyRate >= 50 ? '[&>div]:bg-amber-500' :
    '[&>div]:bg-red-500'

  const totalAlerts = stockAlerts.length + reservationAlerts.length

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">📊 Analyses</h2>
            <RealtimeIndicator />
          </div>
          <p className="text-muted-foreground text-sm">
            Vue d&apos;ensemble des performances de votre hôtel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAnalytics}
            disabled={loading || !data}
          >
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
          {totalAlerts > 0 && (
            <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 gap-1">
              <AlertTriangle className="h-3 w-3" />
              {totalAlerts} alerte{totalAlerts !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* ─── KPI Cards — Occupancy ──────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
          <Bed className="h-4 w-4 text-amber-600" />
          Occupation
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            title="Chambres totales"
            value={String(data?.total_rooms ?? '—')}
            icon={<Bed className="h-5 w-5 text-amber-600" />}
            gradient="bg-gradient-to-r from-amber-400 to-amber-500"
            iconBg="bg-amber-50 text-amber-600"
          />
          <KpiCard
            title="Chambres occupées"
            value={String(data?.occupied_rooms ?? '—')}
            subtitle={data ? `${data.total_rooms - data.occupied_rooms} disponibles` : undefined}
            icon={<Users className="h-5 w-5 text-orange-600" />}
            gradient="bg-gradient-to-r from-orange-400 to-orange-500"
            iconBg="bg-orange-50 text-orange-600"
          />
          <Card className="border-amber-200/50 overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-600" />
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Taux d&apos;occupation</p>
                  <p className={`text-xl sm:text-2xl font-bold tracking-tight ${occupancyColor}`}>
                    {occupancyRate.toFixed(1)}%
                  </p>
                  <Progress value={occupancyRate} className={`h-2 mt-2 ${occupancyBarColor}`} />
                </div>
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-50">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── KPI Cards — Revenue ─────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-amber-600" />
          Revenus
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard
            title="Revenu mensuel"
            value={data ? formatCompactFCFA(data.total_revenue_month) : '—'}
            subtitle={data ? formatFCFA(data.total_revenue_month) : undefined}
            icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
            trend="up"
            trendLabel="Ce mois-ci"
            gradient="bg-gradient-to-r from-emerald-400 to-emerald-500"
            iconBg="bg-emerald-50 text-emerald-600"
          />
          <KpiCard
            title="Revenu annuel"
            value={data ? formatCompactFCFA(data.total_revenue_year) : '—'}
            subtitle={data ? formatFCFA(data.total_revenue_year) : undefined}
            icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
            trend="up"
            trendLabel="Cette année"
            gradient="bg-gradient-to-r from-emerald-500 to-teal-500"
            iconBg="bg-emerald-50 text-emerald-600"
          />
        </div>
      </div>

      {/* ─── KPI Cards — Performance Metrics ─────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-amber-600" />
          Indicateurs de performance
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            title="ADR (Prix moyen/jour)"
            value={data ? formatCompactFCFA(data.adr) : '—'}
            subtitle={data ? formatFCFA(data.adr) : undefined}
            icon={<BarChart3 className="h-5 w-5 text-amber-600" />}
            gradient="bg-gradient-to-r from-amber-400 to-orange-400"
            iconBg="bg-amber-50 text-amber-600"
          />
          <KpiCard
            title="RevPAR"
            value={data ? formatCompactFCFA(data.revpar) : '—'}
            subtitle={data ? formatFCFA(data.revpar) : undefined}
            icon={<TrendingUp className="h-5 w-5 text-orange-600" />}
            gradient="bg-gradient-to-r from-orange-400 to-amber-400"
            iconBg="bg-orange-50 text-orange-600"
          />
          <KpiCard
            title="Réservations en attente"
            value={String(data?.pending_reservations ?? '—')}
            subtitle="À confirmer"
            icon={<Calendar className="h-5 w-5 text-amber-600" />}
            gradient="bg-gradient-to-r from-amber-400 to-yellow-400"
            iconBg="bg-amber-50 text-amber-600"
          />
          <KpiCard
            title="Clients enregistrés"
            value={String(data?.checked_in_reservations ?? '—')}
            subtitle="Actuellement à l'hôtel"
            icon={<Users className="h-5 w-5 text-emerald-600" />}
            gradient="bg-gradient-to-r from-emerald-400 to-green-400"
            iconBg="bg-emerald-50 text-emerald-600"
          />
        </div>
      </div>

      {/* ─── KPI Cards — Extra Revenue ───────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
          <Utensils className="h-4 w-4 text-amber-600" />
          Revenus annexes
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard
            title="Revenu restaurant (mois)"
            value={data ? formatCompactFCFA(data.restaurant_revenue_month) : '—'}
            subtitle={data ? formatFCFA(data.restaurant_revenue_month) : undefined}
            icon={<Utensils className="h-5 w-5 text-orange-600" />}
            trend="up"
            trendLabel="Ce mois-ci"
            gradient="bg-gradient-to-r from-orange-400 to-amber-400"
            iconBg="bg-orange-50 text-orange-600"
          />
          <KpiCard
            title="Revenu conférence (mois)"
            value={data ? formatCompactFCFA(data.conference_revenue_month) : '—'}
            subtitle={data ? formatFCFA(data.conference_revenue_month) : undefined}
            icon={<Building2 className="h-5 w-5 text-amber-600" />}
            trend="up"
            trendLabel="Ce mois-ci"
            gradient="bg-gradient-to-r from-amber-400 to-yellow-400"
            iconBg="bg-amber-50 text-amber-600"
          />
        </div>
      </div>

      {/* ─── Revenue Breakdown Chart ─────────────────────────────────────── */}
      <Card className="border-amber-200/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-amber-600" />
            Revenus mensuels
          </CardTitle>
          <CardDescription>
            Évolution des revenus sur les 6 derniers mois
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyData.length > 0 ? (
            <ChartContainer config={revenueChartConfig} className="h-64 w-full">
              <BarChart data={monthlyData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-xs"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-xs"
                  tickFormatter={(val: number) => {
                    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
                    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`
                    return String(val)
                  }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatFCFA(Number(value))}
                    />
                  }
                />
                <Bar
                  dataKey="revenue"
                  fill="var(--color-revenue)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={56}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              Aucune donnée de revenu disponible
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Alerts Section ──────────────────────────────────────────────── */}
      {(stockAlerts.length > 0 || reservationAlerts.length > 0) && (
        <Card className="border-red-200/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-red-800">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Alertes &amp; Attention requise
              <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 ml-1">
                {totalAlerts}
              </Badge>
            </CardTitle>
            <CardDescription>
              Éléments nécessitant votre attention immédiate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Stock alerts */}
              {stockAlerts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Stock sous seuil minimum
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {stockAlerts.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border border-red-200/60 bg-red-50/50 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-red-900 truncate">{item.name}</p>
                          <p className="text-xs text-red-600">
                            Seuil minimum : {item.min_threshold} {item.unit}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50 shrink-0 ml-2">
                          {item.quantity} / {item.min_threshold} {item.unit}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reservation alerts */}
              {reservationAlerts.length > 0 && (
                <div>
                  {stockAlerts.length > 0 && <Separator className="my-2" />}
                  <h4 className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Réservations nécessitant une attention
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {reservationAlerts.map((res) => (
                      <div
                        key={res.id}
                        className="flex items-center justify-between rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-amber-900 truncate">
                            {res.customer_name} — Chambre {res.room_number}
                          </p>
                          <p className="text-xs text-amber-600">
                            Arrivée : {new Date(res.check_in_date).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 shrink-0 ml-2">
                          {res.status === 'pending' ? 'En attente' : res.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── No Alerts Banner ────────────────────────────────────────────── */}
      {stockAlerts.length === 0 && reservationAlerts.length === 0 && data && (
        <Card className="border-emerald-200/60 bg-gradient-to-r from-emerald-50/50 to-green-50/50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <AlertTriangle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-800">Tout est en ordre</p>
                <p className="text-xs text-emerald-600">
                  Aucune alerte en cours — stocks à niveau et réservations à jour
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
