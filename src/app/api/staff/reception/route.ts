import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = ['receptionist', 'manager', 'owner']

/**
 * GET /api/staff/reception
 * Today's check-ins, check-outs, and expired stays.
 * Returns: { check_ins: [...], check_outs: [...], expired_stays: [...] } with reservation + customer + room info.
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

    // Expired stays: checked_in reservations where check_out_date < today (guest overstayed)
    const { data: expiredStays, error: expiredError } = await adminClient
      .from('reservations')
      .select('*, customers(first_name, last_name, phone, email), rooms(room_number, room_type, price_per_night)')
      .eq('hotel_id', hotelId)
      .eq('status', 'checked_in')
      .lt('check_out_date', todayStr)

    if (expiredError) {
      console.error('Expired stays fetch error in reception:', expiredError)
      // Don't fail the whole request, just return empty
    }

    return NextResponse.json({
      checkIns: checkIns || [],
      checkOuts: checkOuts || [],
      expiredStays: expiredStays || [],
      today: todayStr,
    })
  } catch (error) {
    console.error('Staff reception GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
