import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/owner/notifications
 *
 * Fetches all notifications for the authenticated user's hotel,
 * ordered by created_at DESC.
 */
const ALLOWED_ROLES = ['owner', 'manager', 'receptionist']

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

    const { data: notifications, error: fetchError } = await adminClient
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
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
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

    const body = await request.json()
    const { id, markAll } = body
    const adminClient = createAdminClient()

    if (markAll) {
      const { error: updateError } = await adminClient
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
      const { error: updateError } = await adminClient
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
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
