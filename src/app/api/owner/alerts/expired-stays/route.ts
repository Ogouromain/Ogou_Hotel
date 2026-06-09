import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = ['owner', 'manager', 'receptionist']

/**
 * GET /api/owner/alerts/expired-stays
 *
 * Detects reservations where the guest's stay has expired:
 * - status = 'checked_in' AND check_out_date < today
 *
 * Returns:
 * - expiredStays: list of overdue reservations with customer/room details
 * - count: total number of expired stays
 * - notificationsCreated: number of new notifications inserted
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Today's date (YYYY-MM-DD) — compare dates only
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    // Find all checked-in reservations where check_out_date < today
    const { data: expiredStays, error: fetchError } = await adminClient
      .from('reservations')
      .select('*, customers(first_name, last_name, phone, email), rooms(room_number, room_type, price_per_night, id)')
      .eq('hotel_id', hotelId)
      .eq('status', 'checked_in')
      .lt('check_out_date', todayStr)

    if (fetchError) {
      console.error('Expired stays fetch error:', fetchError)
      return NextResponse.json(
        { error: 'Erreur lors de la détection des séjours expirés' },
        { status: 500 }
      )
    }

    const expiredList = expiredStays || []

    // Auto-create notifications for each expired stay that doesn't already have one
    let notificationsCreated = 0

    if (expiredList.length > 0) {
      for (const stay of expiredList) {
        // Check if a notification already exists for this expired stay today
        const { data: existingNotif } = await adminClient
          .from('notifications')
          .select('id')
          .eq('hotel_id', hotelId)
          .eq('type', 'expired_stay')
          .eq('metadata->>reservation_id', stay.id)
          .gte('created_at', todayStr)
          .maybeSingle()

        if (!existingNotif) {
          const customerName = stay.customers
            ? (Array.isArray(stay.customers)
              ? `${stay.customers[0]?.first_name || ''} ${stay.customers[0]?.last_name || ''}`.trim()
              : `${stay.customers.first_name || ''} ${stay.customers.last_name || ''}`.trim())
            : 'Client inconnu'

          const roomNumber = stay.rooms
            ? (Array.isArray(stay.rooms) ? stay.rooms[0]?.room_number : stay.rooms.room_number)
            : '—'

          // Calculate days overdue
          const checkOutDate = new Date(stay.check_out_date)
          const diffMs = today.getTime() - checkOutDate.getTime()
          const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24))

          const { error: insertError } = await adminClient
            .from('notifications')
            .insert({
              hotel_id: hotelId,
              type: 'expired_stay',
              title: 'Séjour expiré',
              message: `${customerName} — Chambre ${roomNumber} : séjour expiré depuis ${daysOverdue} jour(s) (départ prévu le ${stay.check_out_date})`,
              metadata: {
                reservation_id: stay.id,
                customer_id: stay.customer_id,
                room_id: stay.room_id,
                room_number: roomNumber,
                customer_name: customerName,
                check_out_date: stay.check_out_date,
                days_overdue: daysOverdue,
              },
              is_read: false,
              created_by: user.id,
            })

          if (!insertError) {
            notificationsCreated++
          } else {
            console.error('Failed to create expired stay notification:', insertError)
          }
        }
      }
    }

    return NextResponse.json({
      expiredStays: expiredList,
      count: expiredList.length,
      notificationsCreated,
      today: todayStr,
    })
  } catch (error) {
    console.error('Expired stays alert error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
