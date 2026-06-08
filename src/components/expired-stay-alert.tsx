'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Clock,
  Bed,
  User,
  DoorOpen,
  CalendarPlus,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Phone,
  Bell,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CustomerInfo {
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
}

interface RoomBrief {
  id: string
  room_number: string
  room_type: string
  price_per_night: number
}

interface ExpiredStay {
  id: string
  hotel_id: string
  customer_id: string
  room_id: string
  check_in_date: string
  check_out_date: string
  total_price: number
  status: string
  customers: CustomerInfo | CustomerInfo[] | null
  rooms: RoomBrief | RoomBrief[] | null
}

interface ExpiredStayAlertProps {
  /** Called when a check-out is performed so the parent can refresh data */
  onCheckOut?: (reservationId: string) => Promise<void>
  /** Called to navigate to reservations tab */
  onNavigateToReservations?: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function getCustomerName(customers: CustomerInfo | CustomerInfo[] | null): string {
  if (!customers) return 'Client inconnu'
  if (Array.isArray(customers)) {
    const c = customers[0]
    return c ? `${c.first_name} ${c.last_name}` : 'Client inconnu'
  }
  return `${customers.first_name} ${customers.last_name}`
}

function getCustomerPhone(customers: CustomerInfo | CustomerInfo[] | null): string | null {
  if (!customers) return null
  if (Array.isArray(customers)) {
    const c = customers[0]
    return c?.phone || null
  }
  return customers.phone
}

function getRoomInfo(rooms: RoomBrief | RoomBrief[] | null): RoomBrief | null {
  if (!rooms) return null
  if (Array.isArray(rooms)) return rooms[0] || null
  return rooms
}

function getDaysOverdue(checkOutDate: string): number {
  const today = new Date()
  const checkOut = new Date(checkOutDate)
  const diffMs = today.getTime() - checkOut.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

function getUrgencyLevel(daysOverdue: number): 'warning' | 'critical' | 'urgent' {
  if (daysOverdue >= 3) return 'urgent'
  if (daysOverdue >= 2) return 'critical'
  return 'warning'
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ExpiredStayAlert({ onCheckOut, onNavigateToReservations }: ExpiredStayAlertProps) {
  const [expiredStays, setExpiredStays] = useState<ExpiredStay[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchExpiredStays = useCallback(async () => {
    try {
      const res = await fetch('/api/owner/alerts/expired-stays')
      if (res.ok) {
        const data = await res.json()
        const stays = data.expiredStays || []
        setExpiredStays(stays)
        setCount(stays.length)
        // If new expired stays appeared, reset dismissed state
        if (stays.length > 0 && dismissed) {
          setDismissed(false)
        }
      }
    } catch {
      // Silent fail — don't block the dashboard
      console.error('Failed to fetch expired stays')
    } finally {
      setLoading(false)
    }
  }, [dismissed])

  useEffect(() => {
    fetchExpiredStays()
  }, [fetchExpiredStays])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    intervalRef.current = setInterval(fetchExpiredStays, 5 * 60 * 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchExpiredStays])

  const handleCheckOut = async (reservationId: string) => {
    setActionLoading(reservationId)
    try {
      const res = await fetch(`/api/owner/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_out' }),
      })
      if (res.ok) {
        toast.success('Check-out effectué — Ménage requis')
        // Remove from local state immediately
        setExpiredStays(prev => prev.filter(s => s.id !== reservationId))
        setCount(prev => prev - 1)
        // Also refresh parent data
        if (onCheckOut) {
          await onCheckOut(reservationId)
        }
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors du check-out')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setActionLoading(null)
    }
  }

  // Don't render anything if loading or no expired stays
  if (loading) return null
  if (count === 0) return null
  if (dismissed) {
    // Show a small badge to re-show
    return (
      <button
        onClick={() => setDismissed(false)}
        className="fixed bottom-20 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600 transition-all animate-pulse"
        title={`${count} séjour(s) expiré(s) — Cliquez pour voir`}
      >
        <Bell className="h-5 w-5" />
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-red-600 text-[10px] font-bold">
          {count > 9 ? '9+' : count}
        </span>
      </button>
    )
  }

  const urgentCount = expiredStays.filter(s => getUrgencyLevel(getDaysOverdue(s.check_out_date)) === 'urgent').length
  const criticalCount = expiredStays.filter(s => getUrgencyLevel(getDaysOverdue(s.check_out_date)) === 'critical').length
  const warningCount = expiredStays.filter(s => getUrgencyLevel(getDaysOverdue(s.check_out_date)) === 'warning').length

  return (
    <div className="mb-6">
      {/* Main Alert Banner */}
      <div className="rounded-xl border-2 border-red-200 bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 overflow-hidden shadow-md">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-red-100 text-red-600 shrink-0 animate-pulse">
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-red-800">
                  Alerte : Séjour(s) expiré(s)
                </h3>
                <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs font-bold">
                  {count} en retard
                </Badge>
              </div>
              <p className="text-sm text-red-700/80 mt-1">
                Des clients occupent toujours leur chambre alors que leur séjour a expiré. 
                Veuillez procéder au check-out ou prolonger le séjour.
              </p>
              {/* Urgency breakdown */}
              <div className="flex flex-wrap gap-2 mt-2">
                {urgentCount > 0 && (
                  <div className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    {urgentCount} urgent(s) (+3 jours)
                  </div>
                )}
                {criticalCount > 0 && (
                  <div className="flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">
                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                    {criticalCount} critique(s) (2 jours)
                  </div>
                )}
                {warningCount > 0 && (
                  <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    {warningCount} attention (1 jour)
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-100"
                onClick={() => setExpanded(!expanded)}
                title={expanded ? 'Réduire' : 'Développer'}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-100"
                onClick={() => setDismissed(true)}
                title="Masquer l'alerte"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Expanded List */}
        {expanded && (
          <>
            <Separator className="bg-red-200/50" />
            <div className="px-4 sm:px-6 py-3 max-h-80 overflow-y-auto">
              <div className="space-y-3">
                {expiredStays.map((stay) => {
                  const daysOverdue = getDaysOverdue(stay.check_out_date)
                  const urgency = getUrgencyLevel(daysOverdue)
                  const customerName = getCustomerName(stay.customers)
                  const customerPhone = getCustomerPhone(stay.customers)
                  const room = getRoomInfo(stay.rooms)

                  const urgencyStyles = {
                    urgent: 'border-red-300 bg-red-50/80',
                    critical: 'border-orange-300 bg-orange-50/80',
                    warning: 'border-amber-300 bg-amber-50/80',
                  }

                  const urgencyBadgeStyles = {
                    urgent: 'bg-red-100 text-red-700 border-red-200',
                    critical: 'bg-orange-100 text-orange-700 border-orange-200',
                    warning: 'bg-amber-100 text-amber-700 border-amber-200',
                  }

                  const urgencyDotColor = {
                    urgent: 'bg-red-500',
                    critical: 'bg-orange-500',
                    warning: 'bg-amber-500',
                  }

                  return (
                    <Card key={stay.id} className={`border ${urgencyStyles[urgency]} shadow-sm`}>
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                          {/* Left: Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`h-2.5 w-2.5 rounded-full ${urgencyDotColor[urgency]} shrink-0`} />
                              <div className="flex items-center gap-1.5">
                                <User className="h-4 w-4 text-gray-500 shrink-0" />
                                <span className="font-semibold text-gray-900 text-sm sm:text-base">{customerName}</span>
                              </div>
                              <Badge className={`${urgencyBadgeStyles[urgency]} text-[10px] font-bold`}>
                                +{daysOverdue} jour(s)
                              </Badge>
                            </div>

                            <div className="mt-2 space-y-1">
                              {room && (
                                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                  <Bed className="h-3.5 w-3.5 shrink-0" />
                                  <span>Chambre {room.room_number} — {room.room_type}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                <Clock className="h-3.5 w-3.5 shrink-0" />
                                <span>Départ prévu : <strong className="text-red-700">{formatDateFR(stay.check_out_date)}</strong></span>
                              </div>
                              {customerPhone && (
                                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                  <Phone className="h-3.5 w-3.5 shrink-0" />
                                  <a
                                    href={`tel:${customerPhone}`}
                                    className="text-emerald-600 hover:text-emerald-800 underline"
                                  >
                                    {customerPhone}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                            <Button
                              className="flex-1 sm:flex-none h-10 sm:h-11 text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-sm"
                              onClick={() => handleCheckOut(stay.id)}
                              disabled={actionLoading === stay.id}
                            >
                              {actionLoading === stay.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                              ) : (
                                <DoorOpen className="h-4 w-4 mr-1.5" />
                              )}
                              Check-out
                            </Button>
                            {onNavigateToReservations && (
                              <Button
                                variant="outline"
                                className="flex-1 sm:flex-none h-10 sm:h-11 text-sm font-medium rounded-lg border-amber-200 text-amber-700 hover:bg-amber-50"
                                onClick={onNavigateToReservations}
                              >
                                <CalendarPlus className="h-4 w-4 mr-1.5" />
                                Prolonger
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Compact Badge for Sidebar ───────────────────────────────────────────────

export function ExpiredStayBadge() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/owner/alerts/expired-stays')
        if (res.ok) {
          const data = await res.json()
          setCount(data.count || 0)
        }
      } catch {
        // Silent
      }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (count === 0) return null

  return (
    <span className="relative ml-1.5">
      <AlertTriangle className="h-4 w-4 text-red-500" />
      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
        {count > 9 ? '9+' : count}
      </span>
    </span>
  )
}
