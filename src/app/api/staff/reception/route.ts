import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = ['receptionist', 'manager', 'owner']

/**
 * GET /api/staff/reception
 * Today's check-ins and check-outs.
 * Returns: { check_ins: [...], check_outs: [...] } with reservation + customer + room info.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const hotelId = user.app_metadata?.hotel_id
    const role = user.app_metadata?.role

    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 403 })
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Today's date range
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0] // YYYY-MM-DD

    // Today's check-ins: reservations where check_in_date is today and status is pending or confirmed
    const { data: checkIns, error: checkInError } = await adminClient
      .from('reservations')
      .select('*, customers(first_name, last_name, phone, email), rooms(room_number, room_type, price_per_night)')
      .eq('hotel_id', hotelId)
      .eq('check_in_date', todayStr)
      .in('status', ['pending', 'confirmed'])

    if (checkInError) {
      return NextResponse.json({ error: checkInError.message }, { status: 500 })
    }

    // Today's check-outs: reservations where check_out_date is today and status is checked_in
    const { data: checkOuts, error: checkOutError } = await adminClient
      .from('reservations')
      .select('*, customers(first_name, last_name, phone, email), rooms(room_number, room_type, price_per_night)')
      .eq('hotel_id', hotelId)
      .eq('check_out_date', todayStr)
      .eq('status', 'checked_in')

    if (checkOutError) {
      return NextResponse.json({ error: checkOutError.message }, { status: 500 })
    }

    // Flatten joined data
    const formatReservation = (r: Record<string, unknown>) => ({
      ...r,
      customer_name: r.customers
        ? `${(r.customers as Record<string, string>).first_name} ${(r.customers as Record<string, string>).last_name}`
        : null,
      customer_phone: r.customers ? (r.customers as Record<string, string>).phone : null,
      customer_email: r.customers ? (r.customers as Record<string, string>).email : null,
      room_number: r.rooms ? (r.rooms as Record<string, string>).room_number : null,
      room_type: r.rooms ? (r.rooms as Record<string, string>).room_type : null,
      customers: undefined,
      rooms: undefined,
    })

    return NextResponse.json({
      check_ins: (checkIns || []).map(formatReservation),
      check_outs: (checkOuts || []).map(formatReservation),
      date: todayStr,
    })
  } catch (error) {
    console.error('Staff reception GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
