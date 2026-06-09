import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const READ_ROLES = ['owner', 'manager', 'receptionist']
const WRITE_ROLES = ['owner', 'manager']

/**
 * GET /api/owner/stocks/items
 * List all stock items for the hotel, with a low_stock computed field.
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
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }
    const { data: items, error } = await adminClient
      .from('stock_items')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Add low_stock computed field
    const enriched = (items || []).map(item => ({
      ...item,
      low_stock: item.quantity <= item.min_threshold,
    }))

    return NextResponse.json({ items: enriched })
  } catch (error) {
    console.error('Stock items GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/owner/stocks/items
 * Create a new stock item.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!WRITE_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé. Seuls le propriétaire et le manager peuvent créer des articles de stock.' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const body = await request.json()
    const { name, quantity, unit, min_threshold } = body

    if (!name || quantity === undefined || !unit) {
      return NextResponse.json(
        { error: 'Le nom, la quantité et l\'unité sont requis' },
        { status: 400 }
      )
    }

    const quantityNum = parseFloat(quantity)
    if (isNaN(quantityNum) || quantityNum < 0) {
      return NextResponse.json(
        { error: 'La quantité doit être un nombre positif ou nul' },
        { status: 400 }
      )
    }

    const threshold = min_threshold !== undefined ? parseInt(min_threshold) : 5
    if (isNaN(threshold) || threshold < 0) {
      return NextResponse.json(
        { error: 'Le seuil minimum doit être un nombre positif ou nul' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }

    // Check uniqueness: (hotel_id, name)
    const { data: existing } = await adminClient
      .from('stock_items')
      .select('id')
      .eq('hotel_id', hotelId)
      .eq('name', name.trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: `Un article de stock nommé "${name.trim()}" existe déjà` },
        { status: 409 }
      )
    }

    const { data: item, error } = await adminClient
      .from('stock_items')
      .insert({
        hotel_id: hotelId,
        name: name.trim(),
        quantity: quantityNum,
        unit: unit.trim(),
        min_threshold: threshold,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `Un article de stock nommé "${name.trim()}" existe déjà` },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      item: {
        ...item,
        low_stock: item.quantity <= item.min_threshold,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Stock items POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
