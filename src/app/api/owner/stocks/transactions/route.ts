import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/owner/stocks/transactions
 * List all stock transactions for the hotel, with stock item name joined.
 * Optional filters: ?stock_item_id=, ?type=in|out
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

    const { searchParams } = new URL(request.url)
    const stockItemId = searchParams.get('stock_item_id')
    const typeFilter = searchParams.get('type')

    if (typeFilter && !['in', 'out'].includes(typeFilter)) {
      return NextResponse.json(
        { error: 'Type invalide. Types valides : in, out' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()
    let query = adminClient
      .from('stock_transactions')
      .select('*, stock_items(name)')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })

    if (stockItemId) {
      query = query.eq('stock_item_id', stockItemId)
    }
    if (typeFilter) {
      query = query.eq('type', typeFilter)
    }

    const { data: transactions, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Flatten the stock_items join for cleaner response
    const enriched = (transactions || []).map(tx => ({
      ...tx,
      stock_item_name: tx.stock_items?.name || null,
      stock_items: undefined,
    }))

    return NextResponse.json({ transactions: enriched })
  } catch (error) {
    console.error('Stock transactions GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/owner/stocks/transactions
 * Create a new stock transaction.
 * The actual quantity update will happen via PostgreSQL trigger (process_stock_transaction).
 * Fallback: if trigger doesn't exist, manually update the quantity.
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { stock_item_id, type, quantity, reason } = body

    if (!stock_item_id || !type || !quantity || !reason) {
      return NextResponse.json(
        { error: 'L\'article de stock, le type, la quantité et la raison sont requis' },
        { status: 400 }
      )
    }

    if (!['in', 'out'].includes(type)) {
      return NextResponse.json(
        { error: 'Le type doit être "in" (entrée) ou "out" (sortie)' },
        { status: 400 }
      )
    }

    const quantityNum = parseFloat(quantity)
    if (isNaN(quantityNum) || quantityNum <= 0) {
      return NextResponse.json(
        { error: 'La quantité doit être un nombre positif' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Verify stock item exists and belongs to this hotel
    const { data: stockItem } = await adminClient
      .from('stock_items')
      .select('id, name, quantity')
      .eq('id', stock_item_id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!stockItem) {
      return NextResponse.json({ error: 'Article de stock introuvable' }, { status: 404 })
    }

    // For 'out' transactions, verify sufficient stock
    if (type === 'out' && stockItem.quantity < quantityNum) {
      return NextResponse.json(
        { error: `Stock insuffisant. Stock actuel : ${stockItem.quantity} ${stockItem.name}` },
        { status: 400 }
      )
    }

    // Insert transaction
    const { data: transaction, error } = await adminClient
      .from('stock_transactions')
      .insert({
        hotel_id: hotelId,
        stock_item_id,
        type,
        quantity: quantityNum,
        reason: reason.trim(),
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fallback: manually update stock quantity if trigger didn't fire
    // Read the stock item again to check if trigger updated it
    const { data: updatedItem } = await adminClient
      .from('stock_items')
      .select('quantity')
      .eq('id', stock_item_id)
      .single()

    if (updatedItem) {
      const expectedQty = type === 'in'
        ? stockItem.quantity + quantityNum
        : stockItem.quantity - quantityNum

      // If trigger didn't update the quantity (still the old value), do it manually
      if (updatedItem.quantity === stockItem.quantity) {
        const newQuantity = type === 'in'
          ? stockItem.quantity + quantityNum
          : stockItem.quantity - quantityNum

        await adminClient
          .from('stock_items')
          .update({ quantity: Math.max(0, newQuantity) })
          .eq('id', stock_item_id)
      }
    }

    // Return transaction with item name
    return NextResponse.json({
      transaction: {
        ...transaction,
        stock_item_name: stockItem.name,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Stock transactions POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
