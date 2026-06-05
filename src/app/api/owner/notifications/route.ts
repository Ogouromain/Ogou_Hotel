import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/owner/notifications
 *
 * Fetches all notifications for the authenticated user's hotel,
 * ordered by created_at DESC.
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
      .select('hotel_id')
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

    // 4. Fetch notifications for the hotel, newest first
    const { data: notifications, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('Notifications fetch error:', fetchError)
      return NextResponse.json(
        { error: 'Erreur lors du chargement des notifications' },
        { status: 500 }
      )
    }

    return NextResponse.json({ notifications: notifications ?? [] })
  } catch (error) {
    console.error('Owner notifications GET error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/owner/notifications
 *
 * Marks notification(s) as read.
 * Body: { id?: string, markAll?: boolean }
 *   - If markAll is true, marks all notifications for the hotel as read.
 *   - If id is provided, marks that specific notification as read.
 */
export async function PATCH(request: NextRequest) {
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
      .select('hotel_id')
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

    // 4. Parse request body
    const body = await request.json()
    const { id, markAll } = body

    if (markAll) {
      // Mark all notifications for the hotel as read
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('hotel_id', hotelId)
        .eq('is_read', false)

      if (updateError) {
        console.error('Mark all notifications error:', updateError)
        return NextResponse.json(
          { error: 'Erreur lors de la mise à jour des notifications' },
          { status: 500 }
        )
      }
    } else if (id) {
      // Mark a specific notification as read
      // Verify the notification belongs to this hotel
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('hotel_id', hotelId)

      if (updateError) {
        console.error('Mark notification error:', updateError)
        return NextResponse.json(
          { error: 'Erreur lors de la mise à jour de la notification' },
          { status: 500 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Paramètre manquant : fournir id ou markAll' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Owner notifications PATCH error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
