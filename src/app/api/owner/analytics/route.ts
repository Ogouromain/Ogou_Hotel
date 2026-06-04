import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/owner/analytics
 *
 * Returns analytics data for the authenticated owner's hotel
 * by calling the `get_hotel_analytics()` SQL function.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Create admin client and verify Supabase is configured
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase non configuré' },
        { status: 503 }
      )
    }

    // 2. Authenticate via Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // 3. Get the user's profile to extract hotel_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('hotel_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profil introuvable' },
        { status: 404 }
      )
    }

    const hotelId = profile.hotel_id
    if (!hotelId) {
      return NextResponse.json(
        { error: 'Aucun hôtel associé à ce compte' },
        { status: 404 }
      )
    }

    // 4. Call the analytics SQL function
    const { data: analytics, error: analyticsError } = await supabase.rpc(
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
