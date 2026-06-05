'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

interface RealtimeEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: Record<string, unknown>
  old_record?: Record<string, unknown>
}

interface UseRealtimeOptions {
  hotelId: string
  tables?: string[]
  onEvent?: (event: RealtimeEvent) => void
  enabled?: boolean
}

interface UseRealtimeReturn {
  events: RealtimeEvent[]
  connected: boolean
  lastEvent: RealtimeEvent | null
}

/**
 * Hook to subscribe to Supabase Realtime changes for hotel-specific data.
 * Subscribes to INSERT, UPDATE, DELETE events on specified tables.
 */
export function useRealtime({
  hotelId,
  tables = ['reservations', 'restaurant_orders', 'stock_items', 'rooms', 'notifications'],
  onEvent,
  enabled = true,
}: UseRealtimeOptions): UseRealtimeReturn {
  const [events, setEvents] = useState<RealtimeEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null)
  const subscriptionRef = useRef<ReturnType<typeof createSupabaseClient> | null>(null)
  const onEventRef = useRef(onEvent)

  // Keep onEvent ref updated
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  const handleEvent = useCallback((event: RealtimeEvent) => {
    setEvents(prev => [event, ...prev].slice(0, 50)) // Keep last 50 events
    setLastEvent(event)
    onEventRef.current?.(event)
  }, [])

  useEffect(() => {
    if (!enabled || !hotelId) return

    const supabase = createSupabaseClient()

    // Subscribe to each table
    const channels = tables.map(table => {
      const channel = supabase
        .channel(`${table}-changes-${hotelId}`)
        .on(
          'postgres_changes' as const,
          {
            event: '*',
            schema: 'public',
            table,
            filter: `hotel_id=eq.${hotelId}`,
          },
          (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
            const event: RealtimeEvent = {
              type: payload.eventType as RealtimeEvent['type'],
              table,
              record: payload.new || payload.old,
              old_record: payload.old,
            }
            handleEvent(event)
          }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            setConnected(true)
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setConnected(false)
          }
        })

      return channel
    })

    subscriptionRef.current = supabase

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel)
      })
      setConnected(false)
    }
  }, [hotelId, tables, enabled, handleEvent])

  return { events, connected, lastEvent }
}

/**
 * Simplified hook for real-time notifications only
 */
export function useRealtimeNotifications(hotelId: string, enabled = true) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Array<{
    id: string
    type: string
    title: string
    message: string
    created_at: string
    is_read: boolean
  }>>([])

  // Fetch initial notifications
  useEffect(() => {
    if (!enabled || !hotelId) return

    async function fetchNotifications() {
      try {
        const res = await fetch('/api/owner/notifications?limit=20')
        if (res.ok) {
          const data = await res.json()
          setNotifications(data.notifications || [])
          setUnreadCount(data.unread_count || 0)
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err)
      }
    }

    fetchNotifications()

    // Poll every 30 seconds for new notifications
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [hotelId, enabled])

  // Subscribe to realtime updates
  const { lastEvent } = useRealtime({
    hotelId,
    tables: ['notifications', 'reservations', 'restaurant_orders', 'stock_items'],
    onEvent: useCallback((event: RealtimeEvent) => {
      if (event.table === 'notifications') {
        if (event.type === 'INSERT') {
          const notif = {
            id: event.record.id as string,
            type: event.record.type as string,
            title: event.record.title as string,
            message: event.record.message as string,
            created_at: event.record.created_at as string,
            is_read: (event.record.is_read as boolean) || false,
          }
          setNotifications(prev => [notif, ...prev].slice(0, 20))
          setUnreadCount(prev => prev + 1)
        }
      } else {
        // For other tables, generate a synthetic notification
        let title = ''
        let message = ''
        let type = 'info'

        if (event.table === 'reservations') {
          const status = event.record.status as string
          type = 'reservation'
          if (status === 'checked_in') { title = 'Check-in'; message = 'Un client a effectué son check-in' }
          else if (status === 'checked_out') { title = 'Check-out'; message = 'Un client a effectué son check-out' }
          else if (status === 'confirmed') { title = 'Nouvelle réservation'; message = 'Une réservation a été confirmée' }
          else if (status === 'cancelled') { title = 'Annulation'; message = 'Une réservation a été annulée' }
        } else if (event.table === 'restaurant_orders') {
          type = 'restaurant'
          title = 'Commande restaurant'
          message = 'Mise à jour d\'une commande restaurant'
        } else if (event.table === 'stock_items') {
          type = 'stock_alert'
          title = 'Mise à jour stock'
          message = 'Le stock a été mis à jour'
        }

        if (title && event.type !== 'DELETE') {
          setUnreadCount(prev => prev + 1)
          setNotifications(prev => [{
            id: `rt-${Date.now()}`,
            type,
            title,
            message,
            created_at: new Date().toISOString(),
            is_read: false,
          }, ...prev].slice(0, 20))
        }
      }
    }, []),
    enabled,
  })

  // Just to suppress unused variable warning
  void lastEvent

  const markAsRead = useCallback(async (notificationId?: string) => {
    if (notificationId) {
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))

      try {
        await fetch('/api/owner/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification_id: notificationId }),
        })
      } catch {
        // Silent fail
      }
    } else {
      // Mark all as read
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)

      try {
        await fetch('/api/owner/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mark_all_read: true }),
        })
      } catch {
        // Silent fail
      }
    }
  }, [])

  return { notifications, unreadCount, markAsRead }
}
