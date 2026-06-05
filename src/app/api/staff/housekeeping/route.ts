import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = ['housekeeper', 'manager', 'owner']

/**
 * GET /api/staff/housekeeping
 * List rooms with status 'cleaning' for the housekeeper's hotel.
 * Also returns rooms that are 'available' but might need inspection.
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

    // Get rooms needing cleaning
    const { data: cleaningRooms, error: cleaningError } = await adminClient
      .from('rooms')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('status', 'cleaning')
      .order('room_number', { ascending: true })

    if (cleaningError) {
      return NextResponse.json({ error: cleaningError.message }, { status: 500 })
    }

    // Get available rooms (might need inspection after cleaning)
    const { data: availableRooms, error: availableError } = await adminClient
      .from('rooms')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('status', 'available')
      .order('room_number', { ascending: true })

    if (availableError) {
      return NextResponse.json({ error: availableError.message }, { status: 500 })
    }

    return NextResponse.json({
      cleaning: cleaningRooms || [],
      available: availableRooms || [],
    })
  } catch (error) {
    console.error('Staff housekeeping GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
