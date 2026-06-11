import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoMode, DEMO_ROOMS } from '@/lib/demo-data'

const ALLOWED_ROLES = ['housekeeper', 'manager', 'owner']

/**
 * GET /api/staff/housekeeping
 * Returns ALL rooms for the housekeeper's hotel with housekeeping stats.
 * Housekeeper needs to see rooms in all statuses to manage cleaning workflow:
 *   - cleaning: rooms that need to be cleaned (priority)
 *   - available: rooms that are clean and ready
 *   - occupied: rooms currently in use (read-only)
 *   - maintenance: rooms under repair (may need cleaning after repair)
 */
export async function GET() {
  try {
    // Demo mode: return mock data
    if (isDemoMode()) {
      const allRooms = DEMO_ROOMS.map(r => ({
        id: r.id,
        room_number: r.room_number,
        room_type: r.room_type,
        price_per_night: r.price_per_night,
        status: r.status,
        hotel_id: r.hotel_id,
      }))

      const stats = {
        total: allRooms.length,
        cleaning: allRooms.filter(r => r.status === 'cleaning').length,
        maintenance: allRooms.filter(r => r.status === 'maintenance').length,
        available: allRooms.filter(r => r.status === 'available').length,
        occupied: allRooms.filter(r => r.status === 'occupied').length,
      }

      return NextResponse.json({ rooms: allRooms, stats })
    }

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

    // Get ALL rooms for this hotel
    const { data: rooms, error: roomsError } = await adminClient
      .from('rooms')
      .select('id, room_number, room_type, price_per_night, status, hotel_id')
      .eq('hotel_id', hotelId)
      .order('room_number', { ascending: true })

    if (roomsError) {
      return NextResponse.json({ error: roomsError.message }, { status: 500 })
    }

    // Compute stats from rooms
    const allRooms = rooms || []
    const stats = {
      total: allRooms.length,
      cleaning: allRooms.filter(r => r.status === 'cleaning').length,
      maintenance: allRooms.filter(r => r.status === 'maintenance').length,
      available: allRooms.filter(r => r.status === 'available').length,
      occupied: allRooms.filter(r => r.status === 'occupied').length,
    }

    return NextResponse.json({
      rooms: allRooms,
      stats,
    })
  } catch (error) {
    console.error('Staff housekeeping GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
