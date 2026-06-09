import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const READ_ROLES = ['owner', 'manager', 'receptionist', 'restaurant_staff']
const WRITE_ROLES = ['owner', 'manager', 'receptionist', 'restaurant_staff']

/**
 * GET /api/owner/restaurant/orders
 * List all orders for the hotel, with order items joined.
 * Optional filter: ?status=pending
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }
    let query = adminClient
      .from('restaurant_orders')
      .select('*, restaurant_order_items(*)')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })

    if (statusFilter) {
      const validStatuses = ['pending', 'preparing', 'served', 'paid', 'cancelled']
      if (!validStatuses.includes(statusFilter)) {
        return NextResponse.json(
          { error: `Statut invalide. Statuts valides : ${validStatuses.join(', ')}` },
          { status: 400 }
        )
      }
      query = query.eq('status', statusFilter)
    }

    const { data: orders, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('Restaurant orders GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/owner/restaurant/orders
 * Create a new order with items.
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
      return NextResponse.json({ error: 'Accès non autorisé. Seuls le propriétaire, le manager et le réceptionniste peuvent créer des commandes.' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const body = await request.json()
    const { table_number, room_id, items } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'La commande doit contenir au moins un article' },
        { status: 400 }
      )
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item.item_name || !item.quantity || !item.unit_price) {
        return NextResponse.json(
          { error: `Article ${i + 1} : nom, quantité et prix unitaire sont requis` },
          { status: 400 }
        )
      }
      if (item.quantity <= 0) {
        return NextResponse.json(
          { error: `Article ${i + 1} : la quantité doit être positive` },
          { status: 400 }
        )
      }
      if (item.unit_price <= 0) {
        return NextResponse.json(
          { error: `Article ${i + 1} : le prix unitaire doit être positif` },
          { status: 400 }
        )
      }
    }

    // Calculate total amount
    const totalAmount = items.reduce(
      (sum: number, item: { quantity: number; unit_price: number }) =>
        sum + item.quantity * item.unit_price,
      0
    )

    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }

    // Insert order
    const { data: order, error: orderError } = await adminClient
      .from('restaurant_orders')
      .insert({
        hotel_id: hotelId,
        table_number: table_number || null,
        room_id: room_id || null,
        total_amount: totalAmount,
        status: 'pending',
      })
      .select()
      .single()

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    // Insert order items
    const orderItems = items.map((item: { item_name: string; quantity: number; unit_price: number }) => ({
      order_id: order.id,
      item_name: item.item_name.trim(),
      quantity: item.quantity,
      unit_price: item.unit_price,
    }))

    const { data: insertedItems, error: itemsError } = await adminClient
      .from('restaurant_order_items')
      .insert(orderItems)
      .select()

    if (itemsError) {
      // Cleanup: delete the order if items failed
      await adminClient.from('restaurant_orders').delete().eq('id', order.id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    return NextResponse.json(
      { order, items: insertedItems },
      { status: 201 }
    )
  } catch (error) {
    console.error('Restaurant orders POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
