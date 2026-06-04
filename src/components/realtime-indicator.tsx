'use client'

import { useState } from 'react'
import { Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useRealtimeSafe } from '@/lib/realtime-context'

// ─── Types ─────────────────────────────────────────────────────────────────

interface RealtimeIndicatorProps {
  /** Show the indicator inline instead of as a badge */
  inline?: boolean
  /** Compact mode - just the dot */
  compact?: boolean
  /** Additional CSS classes */
  className?: string
}

// ─── Component ─────────────────────────────────────────────────────────────

export function RealtimeIndicator({ inline, compact, className = '' }: RealtimeIndicatorProps) {
  const { status, recentChanges, reconnect } = useRealtimeSafe()

  // Derive pulse key directly from change count (no ref, no effect)
  const changeCount = recentChanges.length

  const statusConfig = {
    connecting: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: 'Connexion temps réel...',
      dotColor: 'bg-amber-400',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    connected: {
      icon: <Wifi className="h-3 w-3" />,
      label: 'Temps réel actif',
      dotColor: 'bg-emerald-400',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    disconnected: {
      icon: <WifiOff className="h-3 w-3" />,
      label: 'Temps réel déconnecté',
      dotColor: 'bg-gray-400',
      badgeClass: 'bg-gray-50 text-gray-600 border-gray-200',
    },
    error: {
      icon: <AlertCircle className="h-3 w-3" />,
      label: 'Erreur temps réel — Cliquez pour reconnecter',
      dotColor: 'bg-red-400',
      badgeClass: 'bg-red-50 text-red-600 border-red-200',
    },
  }

  const config = statusConfig[status]

  // Compact mode — just a colored dot
  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`relative inline-flex h-2.5 w-2.5 ${className}`}>
            <span
              className={`absolute inline-flex h-full w-full rounded-full ${config.dotColor} opacity-75 ${
                status === 'connected' ? 'animate-ping' : ''
              }`}
            />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.dotColor}`} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.label}</p>
          {status === 'connected' && changeCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {changeCount} changement{changeCount !== 1 ? 's' : ''} détecté{changeCount !== 1 ? 's' : ''}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    )
  }

  // Inline mode
  if (inline) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs ${className}`}>
        <span className="relative inline-flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${config.dotColor} opacity-75 ${
              status === 'connected' ? 'animate-ping' : ''
            }`}
          />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor}`} />
        </span>
        <span className="text-muted-foreground">{config.label}</span>
      </span>
    )
  }

  // Badge mode (default)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`cursor-pointer gap-1.5 transition-all ${config.badgeClass} ${className}`}
          onClick={status === 'error' || status === 'disconnected' ? reconnect : undefined}
        >
          <span className="relative inline-flex h-1.5 w-1.5">
            <span
              key={changeCount}
              className={`absolute inline-flex h-full w-full rounded-full ${config.dotColor} opacity-75 ${
                status === 'connected' ? 'animate-ping' : ''
              }`}
            />
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${config.dotColor}`} />
          </span>
          {config.icon}
          {status === 'connected' ? 'Live' : status === 'connecting' ? '...' : 'Hors ligne'}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>{config.label}</p>
        {status === 'connected' && changeCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {changeCount} changement{changeCount !== 1 ? 's' : ''} récent{changeCount !== 1 ? 's' : ''}
          </p>
        )}
        {(status === 'error' || status === 'disconnected') && (
          <p className="text-xs text-muted-foreground">Cliquez pour reconnecter</p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

// ─── Data Refresh Pulse Overlay ────────────────────────────────────────────

/**
 * Shows a brief pulse/flash overlay on the page when real-time data changes
 * are detected, giving the user a visual cue that data was just refreshed.
 */
export function RealtimeRefreshPulse() {
  const { lastRefreshedAt } = useRealtimeSafe()

  // If there's a lastRefreshedAt, show the pulse bar briefly
  // Using CSS animation via key instead of effect-driven state
  if (!lastRefreshedAt) return null

  return (
    <div key={lastRefreshedAt} className="pointer-events-none fixed inset-0 z-50">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-60 animate-[fade-out_800ms_ease-out_forwards]" />
    </div>
  )
}
