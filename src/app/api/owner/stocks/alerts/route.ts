import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const READ_ROLES = ['owner', 'manager', 'restaurant_staff']

/**
 * GET /api/owner/stocks/alerts
 * Return stock items where quantity <= min_threshold (low stock alerts).
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!READ_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé. Seuls le propriétaire et le manager peuvent voir les alertes de stock.' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }

    // Fetch all stock items and filter for low stock
    // Note: Supabase REST API doesn't support column-to-column comparison in filters,
    // so we fetch all and filter in application code
    const { data: items, error } = await adminClient
      .from('stock_items')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('quantity', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const alerts = (items || [])
      .filter(item => item.quantity <= item.min_threshold)
      .map(item => ({
        ...item,
        low_stock: true,
        deficit: item.min_threshold - item.quantity,
      }))

    return NextResponse.json({ alerts })
  } catch (error) {
    console.error('Stock alerts GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
