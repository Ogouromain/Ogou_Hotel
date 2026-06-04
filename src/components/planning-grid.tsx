'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  format,
  eachDayOfInterval,
  isSameDay,
  isToday,
  parseISO,
  isBefore,
  isAfter,
  isWithinInterval,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LayoutGrid,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlanningGridProps {
  rooms: Array<{
    id: string
    room_number: string
    room_type: string
    status: string
    price_per_night: number
  }>
  reservations: Array<{
    id: string
    room_id: string
    customer_id: string
    check_in_date: string
    check_out_date: string
    status: string
    total_price: number
    customers: {
      id: string
      first_name: string
      last_name: string
    } | null
    rooms: {
      id: string
      room_number: string
    } | null
  }>
  onCreateReservation: (roomId: string, date: string) => void
  onViewReservation: (reservationId: string) => void
}

type ViewMode = 'week' | 'month'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_SHORT_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function getReservationBlockStyle(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-400 text-amber-950 hover:bg-amber-500'
    case 'confirmed':
      return 'bg-sky-400 text-sky-950 hover:bg-sky-500'
    case 'checked_in':
      return 'bg-emerald-500 text-white hover:bg-emerald-600'
    case 'checked_out':
      return 'bg-gray-300 text-gray-700 hover:bg-gray-400'
    case 'cancelled':
      return 'bg-red-400 text-red-950 hover:bg-red-500 line-through'
    default:
      return 'bg-gray-200 text-gray-700'
  }
}

function getRoomStatusDot(status: string): string {
  switch (status) {
    case 'available':
      return 'bg-emerald-400'
    case 'occupied':
      return 'bg-red-400'
    case 'cleaning':
      return 'bg-amber-400'
    case 'maintenance':
      return 'bg-gray-400'
    default:
      return 'bg-gray-300'
  }
}

function getRoomStatusLabel(status: string): string {
  switch (status) {
    case 'available':
      return 'Disponible'
    case 'occupied':
      return 'Occupée'
    case 'cleaning':
      return 'Nettoyage'
    case 'maintenance':
      return 'Maintenance'
    default:
      return status
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PlanningGrid({
  rooms,
  reservations,
  onCreateReservation,
  onViewReservation,
}: PlanningGridProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('week')

  // Compute days in the current view
  const days = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      return eachDayOfInterval({ start, end: addDays(start, 6) })
    }
    // Month view
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    // Start from the Monday of the week containing the 1st
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    // End on the Sunday of the week containing the last day
    const calEnd = addDays(startOfWeek(monthEnd, { weekStartsOn: 1 }), 6)
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [currentDate, viewMode])

  const cellWidth = viewMode === 'week' ? 44 : 30
  const rowHeight = 44

  // Group reservations by room_id
  const reservationsByRoom = useMemo(() => {
    const map = new Map<string, PlanningGridProps['reservations']>()
    for (const res of reservations) {
      const list = map.get(res.room_id) || []
      list.push(res)
      map.set(res.room_id, list)
    }
    return map
  }, [reservations])

  // Get reservations that overlap with the current view for a specific room
  const getReservationsForRoom = useCallback(
    (roomId: string) => {
      const roomRes = reservationsByRoom.get(roomId) || []
      const viewStart = days[0]
      const viewEnd = days[days.length - 1]

      return roomRes.filter((res) => {
        const checkIn = parseISO(res.check_in_date)
        const checkOut = parseISO(res.check_out_date)
        // Overlap: reservation intersects with the view period
        return (
          !isBefore(checkOut, viewStart) && !isAfter(checkIn, viewEnd)
        )
      })
    },
    [days, reservationsByRoom]
  )

  // Calculate block position for a reservation
  const getBlockPosition = useCallback(
    (res: PlanningGridProps['reservations'][0]) => {
      const checkIn = parseISO(res.check_in_date)
      const checkOut = parseISO(res.check_out_date)
      const viewStart = days[0]

      // Find start index: the first day of the reservation visible in view
      const effectiveStart = isBefore(checkIn, viewStart) ? viewStart : checkIn
      const startIdx = days.findIndex((d) => isSameDay(d, effectiveStart))

      // Find end index: the last day of the reservation visible in view
      // A reservation from Jan 5 to Jan 8 means check-in Jan 5, check-out Jan 8
      // The guest stays nights of Jan 5, 6, 7 — so the block spans Jan 5, 6, 7
      // The checkout day (Jan 8) is NOT a stay day, but we show it as the boundary
      const dayBeforeCheckout = addDays(checkOut, -1)
      const viewEnd = days[days.length - 1]
      const effectiveEnd = isAfter(dayBeforeCheckout, viewEnd)
        ? viewEnd
        : dayBeforeCheckout
      const endIdx = days.findIndex((d) => isSameDay(d, effectiveEnd))

      if (startIdx < 0 || endIdx < 0) return null

      const span = endIdx - startIdx + 1
      return {
        left: startIdx * cellWidth,
        width: span * cellWidth - 2, // -2 for gap between blocks
        span,
        startIdx,
      }
    },
    [days, cellWidth]
  )

  // Navigation
  const goToPrevious = () => {
    setCurrentDate((d) =>
      viewMode === 'week' ? subWeeks(d, 1) : addDays(d, -30)
    )
  }
  const goToNext = () => {
    setCurrentDate((d) =>
      viewMode === 'week' ? addWeeks(d, 1) : addDays(d, 30)
    )
  }
  const goToToday = () => setCurrentDate(new Date())

  // Label for the current period
  const periodLabel = useMemo(() => {
    if (viewMode === 'week') {
      const start = days[0]
      const end = days[days.length - 1]
      if (start.getMonth() === end.getMonth()) {
        return format(start, 'MMMM yyyy', { locale: fr })
      }
      return `${format(start, 'MMM', { locale: fr })} — ${format(end, 'MMM yyyy', { locale: fr })}`
    }
    return format(currentDate, 'MMMM yyyy', { locale: fr })
  }, [days, viewMode, currentDate])

  // Format date for callback
  const formatDateStr = (date: Date) => format(date, 'yyyy-MM-dd')

  return (
    <div className="flex flex-col h-full">
      {/* ─── Navigation Bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 px-2 py-2 border-b bg-white shrink-0">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={goToToday}>
            <CalendarDays className="h-3.5 w-3.5 mr-1" />
            Aujourd&apos;hui
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold capitalize ml-2 min-w-[160px]">
            {periodLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === 'week' ? 'default' : 'outline'}
            size="sm"
            className={`h-8 ${viewMode === 'week' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
            onClick={() => setViewMode('week')}
          >
            <LayoutGrid className="h-3.5 w-3.5 mr-1" />
            Semaine
          </Button>
          <Button
            variant={viewMode === 'month' ? 'default' : 'outline'}
            size="sm"
            className={`h-8 ${viewMode === 'month' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
            onClick={() => setViewMode('month')}
          >
            <CalendarDays className="h-3.5 w-3.5 mr-1" />
            Mois
          </Button>
        </div>
      </div>

      {/* ─── Legend ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b bg-gray-50/50 text-xs text-muted-foreground shrink-0 flex-wrap">
        <span className="font-medium">Légende :</span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-400" /> En attente
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-sky-400" /> Confirmée
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" /> Enregistré
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-gray-300" /> Terminé
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-400" /> Annulée
        </span>
      </div>

      {/* ─── Grid ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max">
          {/* ── Header Row ──────────────────────────────────────────────── */}
          <div className="flex sticky top-0 z-20 bg-white shadow-sm border-b">
            {/* Room label header */}
            <div
              className="sticky left-0 z-30 bg-white border-r border-b shrink-0 flex items-center justify-center font-semibold text-xs text-muted-foreground px-2"
              style={{ width: 130, height: rowHeight * 2 }}
            >
              Chambre
            </div>
            {/* Day headers - two rows: day number + day name */}
            <div className="flex flex-col">
              {/* Day numbers row */}
              <div className="flex">
                {days.map((day) => {
                  const today = isToday(day)
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6
                  return (
                    <div
                      key={`num-${day.toISOString()}`}
                      className={`shrink-0 flex items-end justify-center pb-0.5 text-xs font-semibold border-b ${
                        today
                          ? 'bg-amber-50 text-amber-700'
                          : isWeekend
                            ? 'bg-gray-50 text-gray-500'
                            : 'text-gray-700'
                      }`}
                      style={{ width: cellWidth, height: rowHeight }}
                    >
                      <span
                        className={`inline-flex items-center justify-center rounded-full ${
                          today ? 'bg-amber-500 text-white w-6 h-6' : ''
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                    </div>
                  )
                })}
              </div>
              {/* Day names row */}
              <div className="flex">
                {days.map((day) => {
                  const today = isToday(day)
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6
                  const dayIdx = (day.getDay() + 6) % 7 // Mon=0, Sun=6
                  return (
                    <div
                      key={`name-${day.toISOString()}`}
                      className={`shrink-0 flex items-center justify-center text-[10px] font-medium border-b ${
                        today
                          ? 'bg-amber-50/70 text-amber-600'
                          : isWeekend
                            ? 'bg-gray-50/70 text-gray-400'
                            : 'text-gray-400'
                      }`}
                      style={{ width: cellWidth, height: rowHeight / 2 }}
                    >
                      {DAY_SHORT_NAMES[dayIdx]}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Room Rows ───────────────────────────────────────────────── */}
          {rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <LayoutGrid className="h-10 w-10 mb-2 text-gray-300" />
              <p className="text-sm">Aucune chambre configurée</p>
              <p className="text-xs">Ajoutez des chambres pour voir le planning</p>
            </div>
          ) : (
            rooms.map((room) => {
              const roomReservations = getReservationsForRoom(room.id)
              // Track which day indices are covered by a reservation block
              const coveredDays = new Set<number>()

              return (
                <div key={room.id} className="flex relative border-b border-gray-100 hover:bg-gray-50/30">
                  {/* Room label */}
                  <div
                    className="sticky left-0 z-10 bg-white border-r shrink-0 flex items-center px-2 gap-1.5"
                    style={{ width: 130, height: rowHeight }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={`shrink-0 w-2.5 h-2.5 rounded-full ${getRoomStatusDot(room.status)}`}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        {getRoomStatusLabel(room.status)}
                      </TooltipContent>
                    </Tooltip>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                        {room.room_number}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate leading-tight">
                        {room.room_type}
                      </p>
                    </div>
                  </div>

                  {/* Day cells */}
                  <div className="relative flex" style={{ height: rowHeight }}>
                    {/* Empty cells for each day */}
                    {days.map((day, dayIdx) => {
                      const today = isToday(day)
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6

                      // Check if this day is covered by a reservation
                      const isCovered = roomReservations.some((res) => {
                        const checkIn = parseISO(res.check_in_date)
                        const checkOut = parseISO(res.check_out_date)
                        const dayBeforeCheckout = addDays(checkOut, -1)
                        return (
                          isWithinInterval(day, {
                            start: checkIn,
                            end: dayBeforeCheckout,
                          }) || isSameDay(day, checkIn) || isSameDay(day, dayBeforeCheckout)
                        )
                      })

                      return (
                        <div
                          key={dayIdx}
                          className={`shrink-0 border-r border-gray-100 transition-colors ${
                            today
                              ? 'bg-amber-50/50'
                              : isWeekend
                                ? 'bg-gray-50/30'
                                : ''
                          } ${
                            !isCovered
                              ? 'cursor-pointer hover:bg-amber-100/50'
                              : ''
                          }`}
                          style={{ width: cellWidth, height: rowHeight }}
                          onClick={() => {
                            if (!isCovered) {
                              onCreateReservation(room.id, formatDateStr(day))
                            }
                          }}
                        >
                          {!isCovered && (
                            <div className="w-full h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <Plus className="h-3 w-3 text-amber-400" />
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Reservation blocks overlaid */}
                    {roomReservations.map((res) => {
                      const pos = getBlockPosition(res)
                      if (!pos) return null

                      // Mark these days as covered
                      for (let i = pos.startIdx; i < pos.startIdx + pos.span; i++) {
                        coveredDays.add(i)
                      }

                      const customerName = res.customers?.last_name || '???'

                      return (
                        <Tooltip key={res.id}>
                          <TooltipTrigger asChild>
                            <button
                              className={`absolute top-1 rounded-md px-1.5 text-[11px] font-medium truncate cursor-pointer transition-all shadow-sm ${getReservationBlockStyle(res.status)}`}
                              style={{
                                left: pos.left + 1,
                                width: pos.width,
                                height: rowHeight - 8,
                                lineHeight: `${rowHeight - 8}px`,
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                onViewReservation(res.id)
                              }}
                            >
                              {pos.span >= 2 || cellWidth >= 40
                                ? customerName
                                : ''}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-[200px]">
                            <span className="font-semibold">{res.customers?.first_name} {res.customers?.last_name}</span>
                            <br />
                            {format(parseISO(res.check_in_date), 'dd/MM')} → {format(parseISO(res.check_out_date), 'dd/MM')}
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ─── Summary Footer ──────────────────────────────────────────────── */}
      {rooms.length > 0 && (
        <div className="flex items-center gap-4 px-3 py-2 border-t bg-white text-xs text-muted-foreground shrink-0">
          <span>{rooms.length} chambre{rooms.length > 1 ? 's' : ''}</span>
          <span>•</span>
          <span>{reservations.length} réservation{reservations.length > 1 ? 's' : ''}</span>
          <span>•</span>
          <span>
            {rooms.filter((r) => r.status === 'available').length} disponible{rooms.filter((r) => r.status === 'available').length > 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  )
}
