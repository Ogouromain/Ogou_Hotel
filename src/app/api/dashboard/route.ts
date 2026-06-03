import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hotelId = searchParams.get('hotel_id')

    const supabase = createAdminClient()

    // Get various stats for the dashboard
    const [
      hotelsResult,
      roomsResult,
      reservationsResult,
      customersResult,
      plansResult,
    ] = await Promise.all([
      hotelId 
        ? supabase.from('hotels').select('*').eq('id', hotelId).single()
        : supabase.from('hotels').select('*'),
      hotelId
        ? supabase.from('rooms').select('*').eq('hotel_id', hotelId)
        : Promise.resolve({ data: [], error: null }),
      hotelId
        ? supabase.from('reservations').select('*').eq('hotel_id', hotelId)
        : Promise.resolve({ data: [], error: null }),
      hotelId
        ? supabase.from('customers').select('*').eq('hotel_id', hotelId)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('subscription_plans').select('*'),
    ])

    const hotels = hotelsResult.data ? (Array.isArray(hotelsResult.data) ? hotelsResult.data : [hotelsResult.data]) : []
    const rooms = roomsResult.data || []
    const reservations = reservationsResult.data || []
    const customers = customersResult.data || []
    const plans = plansResult.data || []

    // Calculate stats
    const availableRooms = rooms.filter((r: { status: string }) => r.status === 'available').length
    const occupiedRooms = rooms.filter((r: { status: string }) => r.status === 'occupied').length
    const activeReservations = reservations.filter((r: { status: string }) => ['pending', 'confirmed', 'checked_in'].includes(r.status)).length
    const totalRevenue = reservations.reduce((sum: number, r: { total_price: number }) => sum + Number(r.total_price || 0), 0)

    return NextResponse.json({
      stats: {
        totalHotels: hotels.length,
        totalRooms: rooms.length,
        availableRooms,
        occupiedRooms,
        totalReservations: reservations.length,
        activeReservations,
        totalCustomers: customers.length,
        totalRevenue,
      },
      hotels,
      rooms,
      reservations,
      customers,
      plans,
    })
  } catch (error) {
    console.error('Dashboard GET error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
