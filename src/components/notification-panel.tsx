'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Bell,
  Calendar,
  UtensilsCrossed,
  Package,
  MessageSquare,
  Send,
  Phone,
  Check,
  CheckCheck,
  Filter,
  Loader2,
  RefreshCw,
  Lock,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { useRealtimeSafe } from '@/lib/realtime-context'
import { RealtimeIndicator } from '@/components/realtime-indicator'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Notification {
  id: string
  hotel_id: string
  type: 'reservation' | 'order' | 'stock' | 'system'
  title: string
  message: string
  metadata: Record<string, unknown> | null
  is_read: boolean
  created_by: string | null
  created_at: string
}

interface NotificationPanelProps {
  onRefresh?: () => void
  planName?: string
}

// ─── SMS Templates ─────────────────────────────────────────────────────────

const SMS_TEMPLATES = [
  {
    id: 'confirmation',
    label: 'Confirmation de réservation',
    message: 'Bonjour, votre réservation a été confirmée. Nous vous attendons avec impatience ! — OGOU_Hôtel',
  },
  {
    id: 'rappel',
    label: 'Rappel check-in',
    message: 'Rappel : votre check-in est prévu aujourd\'hui. Présentez-vous à la réception avec votre pièce d\'identité. — OGOU_Hôtel',
  },
  {
    id: 'commande',
    label: 'Notification de commande',
    message: 'Votre commande a été enregistrée et est en cours de préparation. Merci ! — OGOU_Hôtel',
  },
]

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Returns a relative time string in French, e.g. "il y a 5 minutes" */
function getRelativeTimeFR(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then

  if (diffMs < 0) return "à l'instant"

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return "il y a quelques secondes"
  if (minutes < 60) return `il y a ${minutes} minute${minutes > 1 ? 's' : ''}`
  if (hours < 24) return `il y a ${hours} heure${hours > 1 ? 's' : ''}`
  if (days < 30) return `il y a ${days} jour${days > 1 ? 's' : ''}`

  // Fallback to formatted date
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

/** Returns the icon component for a given notification type */
function getNotificationIcon(type: Notification['type']) {
  switch (type) {
    case 'reservation':
      return <Calendar className="h-4 w-4 text-amber-600" />
    case 'order':
      return <UtensilsCrossed className="h-4 w-4 text-orange-600" />
    case 'stock':
      return <Package className="h-4 w-4 text-emerald-600" />
    case 'system':
      return <Bell className="h-4 w-4 text-sky-600" />
    default:
      return <Bell className="h-4 w-4 text-gray-500" />
  }
}

/** Returns background colour class for the icon container */
function getIconBg(type: Notification['type']) {
  switch (type) {
    case 'reservation':
      return 'bg-amber-50'
    case 'order':
      return 'bg-orange-50'
    case 'stock':
      return 'bg-emerald-50'
    case 'system':
      return 'bg-sky-50'
    default:
      return 'bg-gray-50'
  }
}

/** Maps a notification type to the tab filter value */
function typeToTab(type: Notification['type']): string {
  switch (type) {
    case 'reservation':
      return 'reservations'
    case 'order':
      return 'orders'
    case 'stock':
      return 'stock'
    case 'system':
      return 'system'
    default:
      return 'all'
  }
}

// ─── Component ─────────────────────────────────────────────────────────────

export function NotificationPanel({ onRefresh, planName }: NotificationPanelProps) {
  // ── Determine SMS feature access ──────────────────────────────────────
  const smsEnabled = planName === 'Standard' || planName === 'Premium'
  // ── State ──────────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  // SMS state
  const [smsPhone, setSmsPhone] = useState('')
  const [smsMessage, setSmsMessage] = useState('')
  const [whatsappEnabled, setWhatsappEnabled] = useState(false)
  const [sending, setSending] = useState(false)

  // ── Real-time ──────────────────────────────────────────────────────────
  const { recentChanges, markRefreshed } = useRealtimeSafe()
  const prevChangeCountRef = useRef(0)

  // ── Fetch notifications ────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/owner/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
      }
    } catch {
      console.error('Failed to fetch notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // ── Real-time: auto-refresh on new changes ─────────────────────────────
  useEffect(() => {
    if (recentChanges.length > prevChangeCountRef.current && prevChangeCountRef.current > 0) {
      // New real-time change detected — refresh notifications
      fetchNotifications()
      markRefreshed()

      const latestChange = recentChanges[0]
      const tableLabel =
        latestChange.table === 'rooms' ? 'chambre' :
        latestChange.table === 'reservations' ? 'réservation' :
        latestChange.table

      toast.info(`Nouvelle notification — ${tableLabel}`, {
        description: 'Centre de notifications mis à jour',
        duration: 3000,
      })
    }
    prevChangeCountRef.current = recentChanges.length
  }, [recentChanges.length, fetchNotifications, markRefreshed])

  // ── Derived values ─────────────────────────────────────────────────────
  const unreadCount = notifications.filter((n) => !n.is_read).length

  const filteredNotifications =
    activeTab === 'all'
      ? notifications
      : notifications.filter((n) => typeToTab(n.type) === activeTab)

  // ── Mark single notification as read ───────────────────────────────────
  const markAsRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )

    try {
      await fetch(`/api/owner/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      })
    } catch {
      // Revert on failure
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: false } : n))
      )
      toast.error('Impossible de marquer comme lu')
    }
  }, [])

  // ── Mark all as read ───────────────────────────────────────────────────
  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return

    // Optimistic
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))

    try {
      await Promise.all(
        unreadIds.map((id) =>
          fetch(`/api/owner/notifications/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_read: true }),
          })
        )
      )
      toast.success('Toutes les notifications marquées comme lues')
    } catch {
      toast.error('Impossible de marquer toutes les notifications')
      fetchNotifications() // Re-fetch to get correct state
    }
  }, [notifications, fetchNotifications])

  // ── Send SMS/WhatsApp ──────────────────────────────────────────────────
  const handleSendSms = useCallback(async () => {
    if (!smsPhone.trim()) {
      toast.error('Veuillez entrer un numéro de téléphone')
      return
    }
    if (!smsMessage.trim()) {
      toast.error('Veuillez entrer un message')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/owner/notifications/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sb-access-token') || ''}`,
        },
        body: JSON.stringify({
          to: `+225${smsPhone.replace(/\s/g, '')}`,
          message: smsMessage,
          channel: whatsappEnabled ? 'whatsapp' : 'sms',
        }),
      })

      if (res.ok) {
        const data = await res.json()

        // If WhatsApp, open the deep link so the user can send the message
        if (whatsappEnabled && data.whatsapp_link) {
          window.open(data.whatsapp_link, '_blank')
          toast.success('WhatsApp ouvert — envoyez le message dans l\'application')
        } else {
          toast.success('SMS enregistré avec succès')
        }

        // Refresh notifications to show the new record
        fetchNotifications()
        setSmsPhone('')
        setSmsMessage('')
      } else {
        const data = await res.json()
        toast.error(data.error || "Erreur lors de l'envoi")
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSending(false)
    }
  }, [smsPhone, smsMessage, whatsappEnabled, fetchNotifications])

  // ── Template selection ─────────────────────────────────────────────────
  const handleSelectTemplate = useCallback((template: typeof SMS_TEMPLATES[number]) => {
    setSmsMessage(template.message)
  }, [])

  // ── Tab counts ─────────────────────────────────────────────────────────
  const tabCounts = {
    all: notifications.length,
    reservations: notifications.filter((n) => n.type === 'reservation').length,
    orders: notifications.filter((n) => n.type === 'order').length,
    stock: notifications.filter((n) => n.type === 'stock').length,
    system: notifications.filter((n) => n.type === 'system').length,
  }

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <Bell className="h-5 w-5 text-amber-600" />
            </div>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-gray-900">
              Notifications
            </h2>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
                : 'Toutes les notifications sont lues'}
            </p>
          </div>
          <RealtimeIndicator compact />
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-900"
                onClick={() => {
                  fetchNotifications()
                  onRefresh?.()
                }}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Actualiser les notifications</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-900"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Tout marquer lu
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Marquer toutes les notifications comme lues</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ── Filter Tabs & Notification List ─────────────────────────────── */}
      <Card className="border-amber-200/60">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="h-4 w-4 text-amber-600" />
                Centre de notifications
              </CardTitle>
              <Badge
                variant="secondary"
                className="bg-amber-50 text-amber-700 border-amber-200"
              >
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <TabsList className="mb-4 w-full flex-wrap h-auto gap-1 bg-amber-50/50 p-1">
              <TabsTrigger value="all" className="text-xs data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900">
                Toutes ({tabCounts.all})
              </TabsTrigger>
              <TabsTrigger value="reservations" className="text-xs data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900">
                <Calendar className="h-3 w-3" />
                Réservations ({tabCounts.reservations})
              </TabsTrigger>
              <TabsTrigger value="orders" className="text-xs data-[state=active]:bg-orange-100 data-[state=active]:text-orange-900">
                <UtensilsCrossed className="h-3 w-3" />
                Commandes ({tabCounts.orders})
              </TabsTrigger>
              <TabsTrigger value="stock" className="text-xs data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-900">
                <Package className="h-3 w-3" />
                Stock ({tabCounts.stock})
              </TabsTrigger>
              <TabsTrigger value="system" className="text-xs data-[state=active]:bg-sky-100 data-[state=active]:text-sky-900">
                <Bell className="h-3 w-3" />
                Système ({tabCounts.system})
              </TabsTrigger>
            </TabsList>

            {/* All tabs share the same list rendering, filtered by activeTab */}
            {['all', 'reservations', 'orders', 'stock', 'system'].map((tab) => (
              <TabsContent key={tab} value={tab}>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      Chargement...
                    </span>
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 mb-3">
                      <Bell className="h-7 w-7 text-amber-300" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Aucune notification
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tab === 'all'
                        ? 'Vous êtes à jour !'
                        : 'Aucune notification dans cette catégorie'}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-96">
                    <div className="space-y-1">
                      {filteredNotifications.map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => {
                            if (!notification.is_read) {
                              markAsRead(notification.id)
                            }
                          }}
                          className={`w-full text-left rounded-lg p-3 transition-all hover:bg-amber-50/60 group ${
                            notification.is_read
                              ? 'bg-white'
                              : 'bg-amber-50/40 border border-amber-100'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${getIconBg(
                                notification.type
                              )}`}
                            >
                              {getNotificationIcon(notification.type)}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p
                                  className={`text-sm truncate ${
                                    notification.is_read
                                      ? 'font-medium text-gray-700'
                                      : 'font-semibold text-gray-900'
                                  }`}
                                >
                                  {notification.title}
                                </p>
                                {/* Unread dot */}
                                {!notification.is_read && (
                                  <span className="shrink-0 h-2.5 w-2.5 rounded-full bg-amber-500" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-[10px] text-muted-foreground/70 mt-1">
                                {getRelativeTimeFR(notification.created_at)}
                              </p>
                            </div>

                            {/* Read indicator */}
                            <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              {notification.is_read ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="flex items-center justify-center h-6 w-6">
                                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Notification lue</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-100">
                                      <Check className="h-3.5 w-3.5 text-amber-600" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Cliquer pour marquer comme lu</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            ))}
          </CardContent>
        </Tabs>
      </Card>

      {/* ── SMS / WhatsApp Quick Send ───────────────────────────────────── */}
      <Card className="border-amber-200/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-5 w-5 text-amber-600" />
              Envoi rapide SMS / WhatsApp
            </CardTitle>
            {!smsEnabled && (
              <Badge className="bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100 text-[10px] flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Plan Standard+
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!smsEnabled && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-3">
              <Lock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Fonctionnalité restreinte</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  L&apos;envoi de SMS et WhatsApp est disponible à partir du plan Standard. Contactez-nous pour mettre à niveau votre abonnement.
                </p>
                <a
                  href="https://wa.me/2250576103277?text=Bonjour%2C%20je%20souhaite%20mettre%20%C3%A0%20niveau%20mon%20abonnement%20OGOU_H%C3%B4tel"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2"
                >
                  <MessageSquare className="h-3 w-3" />
                  Mettre à niveau
                </a>
              </div>
            </div>
          )}
          {/* Templates */}
          <div className={smsEnabled ? '' : 'opacity-50 pointer-events-none'}>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Modèles prédéfinis
            </p>
            <div className="flex flex-wrap gap-2">
              {SMS_TEMPLATES.map((template) => (
                <Button
                  key={template.id}
                  variant="outline"
                  size="sm"
                  className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-900 text-xs"
                  onClick={() => handleSelectTemplate(template)}
                  disabled={!smsEnabled}
                >
                  {template.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Phone input */}
          <div className={smsEnabled ? '' : 'opacity-50 pointer-events-none'}>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
              Numéro de téléphone
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 shrink-0">
                +225
              </div>
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="07 XX XX XX XX"
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  className="pl-9 border-amber-200 focus-visible:ring-amber-500/30"
                  disabled={!smsEnabled}
                />
              </div>
            </div>
          </div>

          {/* Message textarea */}
          <div className={smsEnabled ? '' : 'opacity-50 pointer-events-none'}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                Message
              </label>
              <span
                className={`text-xs ${
                  smsMessage.length > 160
                    ? 'text-red-500 font-semibold'
                    : smsMessage.length > 140
                    ? 'text-amber-600'
                    : 'text-muted-foreground'
                }`}
              >
                {smsMessage.length} / 160
              </span>
            </div>
            <Textarea
              placeholder="Tapez votre message ici..."
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              className="border-amber-200 focus-visible:ring-amber-500/30 min-h-[80px] resize-none"
              maxLength={200}
              disabled={!smsEnabled}
            />
          </div>

          {/* WhatsApp toggle & Send */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <div className={`flex items-center gap-3 ${smsEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
              <Switch
                checked={whatsappEnabled}
                onCheckedChange={setWhatsappEnabled}
                disabled={!smsEnabled}
                className={`${
                  whatsappEnabled
                    ? 'data-[state=checked]:bg-emerald-500'
                    : ''
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  whatsappEnabled ? 'text-emerald-700' : 'text-muted-foreground'
                }`}
              >
                WhatsApp
              </span>
              {whatsappEnabled && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px]">
                  Activé
                </Badge>
              )}
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-flex">
                  <Button
                    onClick={handleSendSms}
                    disabled={sending || !smsPhone.trim() || !smsMessage.trim() || !smsEnabled}
                    className={`${
                      whatsappEnabled
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-amber-600 hover:bg-amber-700 text-white'
                    }`}
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Envoi...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        {whatsappEnabled ? 'Envoyer WhatsApp' : 'Envoyer SMS'}
                      </>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {!smsEnabled && (
                <TooltipContent>
                  <p>Disponible à partir du plan Standard</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
