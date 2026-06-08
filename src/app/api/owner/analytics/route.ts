import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = ['owner', 'manager']

/**
 * GET /api/owner/analytics
 *
 * Returns analytics data for the authenticated owner's hotel
 * by calling the `get_hotel_analytics()` SQL function.
 */
export async function GET() {
  try {
    // 1. Authenticate via cookie-based session (consistent with other routes)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const role = user.app_metadata?.role
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json(
        { error: 'Aucun hôtel associé à ce compte' },
        { status: 404 }
      )
    }

    // 2. Call the analytics SQL function
    const adminClient = createAdminClient()
    const { data: analytics, error: analyticsError } = await adminClient.rpc(
      'get_hotel_analytics',
      { p_hotel_id: hotelId }
    )

    if (analyticsError) {
      console.error('Analytics RPC error:', analyticsError)
      return NextResponse.json(
        { error: 'Erreur lors du chargement des analytiques' },
        { status: 500 }
      )
    }

    return NextResponse.json({ analytics })
  } catch (error) {
    console.error('Owner analytics GET error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
