import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/owner/customers/signed-url?path={storage_path}
 * Generate a signed URL for a customer identity document.
 * Verifies the path belongs to the user's hotel.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const role = user.app_metadata?.role
    if (!['owner', 'manager', 'receptionist'].includes(role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path')

    if (!path) {
      return NextResponse.json({ error: 'Le paramètre "path" est requis' }, { status: 400 })
    }

    // ─── Security: verify path starts with user's hotel_id ─────
    if (!path.startsWith(`${hotelId}/`)) {
      return NextResponse.json({ error: 'Accès refusé à ce document' }, { status: 403 })
    }

    // ─── Generate signed URL with 5-minute expiry ─────────────
    const adminClient = createAdminClient()
    const { data, error } = await adminClient.storage
      .from('customer-documents')
      .createSignedUrl(path, 300) // 300 seconds = 5 minutes

    if (error) {
      console.error('Signed URL generation error:', error)
      return NextResponse.json(
        { error: 'Erreur lors de la génération du lien signé' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: data.signedUrl })
  } catch (error) {
    console.error('Owner customers signed-url GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
