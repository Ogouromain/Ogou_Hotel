import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * PATCH /api/owner/notifications/[id]
 *
 * Updates a specific notification (e.g., mark as read).
 * Body: { is_read?: boolean }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const adminClient = createAdminClient()

    // Build update object
    const updateData: Record<string, unknown> = {}
    if (body.is_read !== undefined) {
      updateData.is_read = body.is_read
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
    }

    // Update the notification, ensuring it belongs to the user's hotel
    const { error: updateError } = await adminClient
      .from('notifications')
      .update(updateData)
      .eq('id', id)
      .eq('hotel_id', hotelId)

    if (updateError) {
      console.error('Notification update error:', updateError)
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Owner notification PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/owner/notifications/[id]
 *
 * Deletes a specific notification.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 403 })
    }

    const { id } = await params
    const adminClient = createAdminClient()

    const { error: deleteError } = await adminClient
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('hotel_id', hotelId)

    if (deleteError) {
      console.error('Notification delete error:', deleteError)
      return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Owner notification DELETE error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
