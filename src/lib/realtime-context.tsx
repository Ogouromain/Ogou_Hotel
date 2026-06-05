'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

// ─── Types ─────────────────────────────────────────────────────────────────

type RealtimeStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface RealtimeChangeEvent {
  table: 'rooms' | 'reservations' | 'restaurant_orders' | 'stock_items' | 'notifications' | 'leads'
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Record<string, unknown>
  old: Record<string, unknown>
  timestamp: number
}

interface RealtimeContextValue {
  /** Current connection status */
  status: RealtimeStatus
  /** Recent change events (last 50) */
  recentChanges: RealtimeChangeEvent[]
  /** Whether real-time is enabled */
  isEnabled: boolean
  /** Manually reconnect */
  reconnect: () => void
  /** Start listening for a specific hotel */
  startListening: (hotelId: string) => void
  /** Stop listening */
  stopListening: () => void
  /** Last time data was refreshed via real-time */
  lastRefreshedAt: number | null
  /** Mark that a refresh happened */
  markRefreshed: () => void
}

// ─── Context ───────────────────────────────────────────────────────────────

const RealtimeContext = createContext<RealtimeContextValue | undefined>(undefined)

// ─── Provider ──────────────────────────────────────────────────────────────

interface RealtimeProviderProps {
  children: ReactNode
  /** Whether to enable real-time subscriptions. Defaults to false. */
  enabled?: boolean
}

export function RealtimeProvider({ children, enabled = false }: RealtimeProviderProps) {
  const [status, setStatus] = useState<RealtimeStatus>('disconnected')
  const [recentChanges, setRecentChanges] = useState<RealtimeChangeEvent[]>([])
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const hotelIdRef = useRef<string | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref to hold the latest startListening function for retry callbacks
  const startListeningRef = useRef<(hotelId: string) => void>(() => {})

  const cleanup = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    if (channelRef.current) {
      try {
        channelRef.current.unsubscribe()
      } catch {
        // Ignore
      }
      channelRef.current = null
    }
    setStatus('disconnected')
  }, [])

  const markRefreshed = useCallback(() => {
    setLastRefreshedAt(Date.now())
  }, [])

  const startListening = useCallback((hotelId: string) => {
    if (!hotelId) return

    // If Supabase is not configured, skip real-time
    if (!isSupabaseConfigured()) {
      console.warn('[RealtimeProvider] Supabase non configuré, temps réel désactivé')
      return
    }

    hotelIdRef.current = hotelId
    setIsEnabled(true)

    // Get or create Supabase client
    if (!supabaseRef.current) {
      supabaseRef.current = createClient()
    }
    const supabase = supabaseRef.current

    // Clean up existing channel
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    if (channelRef.current) {
      try {
        channelRef.current.unsubscribe()
      } catch {
        // Ignore
      }
      channelRef.current = null
    }

    setStatus('connecting')

    // Helper to build a change event handler for a given table
    const makeHandler = (
      tableName: RealtimeChangeEvent['table']
    ) =>
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const change: RealtimeChangeEvent = {
          table: tableName,
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          new: payload.new as Record<string, unknown>,
          old: payload.old as Record<string, unknown>,
          timestamp: Date.now(),
        }
        setRecentChanges((prev) => [change, ...prev].slice(0, 50))
      }

    // Create the real-time channel — exactly matching the user's pattern:
    //   .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, handler)
    //   .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, handler)
    //   .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_orders' }, handler)
    //   .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items' }, handler)
    //   .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, handler)
    //   .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, handler)
    // Leads table is included so that when a prospect submits the Landing Page demo form,
    // the Super Admin's "Demandes Commerciales" tab gets an instant real-time notification.
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, makeHandler('rooms'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, makeHandler('reservations'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_orders' }, makeHandler('restaurant_orders'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items' }, makeHandler('stock_items'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, makeHandler('notifications'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, makeHandler('leads'))
      .subscribe((state, err) => {
        if (state === 'SUBSCRIBED') {
          setStatus('connected')
        } else if (state === 'CHANNEL_ERROR') {
          setStatus('error')
          console.error('[RealtimeProvider] Channel error:', err)
        } else if (state === 'TIMED_OUT') {
          setStatus('disconnected')
          console.warn('[RealtimeProvider] Channel timed out, will retry...')
          // Auto-retry after 5 seconds using the ref (avoids circular reference)
          retryTimerRef.current = setTimeout(() => {
            if (hotelIdRef.current) {
              startListeningRef.current(hotelIdRef.current)
            }
          }, 5000)
        } else if (state === 'CLOSED') {
          setStatus('disconnected')
        }
      })

    channelRef.current = channel
  }, [])

  // Keep the ref updated
  useEffect(() => {
    startListeningRef.current = startListening
  }, [startListening])

  const stopListening = useCallback(() => {
    hotelIdRef.current = null
    setIsEnabled(false)
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    if (channelRef.current) {
      try {
        channelRef.current.unsubscribe()
      } catch {
        // Ignore
      }
      channelRef.current = null
    }
    setStatus('disconnected')
  }, [])

  const reconnect = useCallback(() => {
    if (hotelIdRef.current) {
      startListening(hotelIdRef.current)
    }
  }, [startListening])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
      }
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe()
        } catch {
          // Ignore
        }
      }
    }
  }, [])

  const value: RealtimeContextValue = {
    status,
    recentChanges,
    isEnabled,
    reconnect,
    startListening,
    stopListening,
    lastRefreshedAt,
    markRefreshed,
  }

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  )
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useRealtime() {
  const context = useContext(RealtimeContext)
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider')
  }
  return context
}

// ─── Safe hook (returns defaults if no provider) ───────────────────────────

export function useRealtimeSafe() {
  const context = useContext(RealtimeContext)
  return context ?? {
    status: 'disconnected' as RealtimeStatus,
    recentChanges: [] as RealtimeChangeEvent[],
    isEnabled: false,
    reconnect: () => {},
    startListening: (_hotelId: string) => {},
    stopListening: () => {},
    lastRefreshedAt: null as number | null,
    markRefreshed: () => {},
  }
}
