import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/owner/restaurant/menu
 * List all menu items for the hotel, ordered by category then name.
 */
export async function GET() {
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

    const adminClient = createAdminClient()
    const { data: items, error } = await adminClient
      .from('menu_items')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Restaurant menu GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/owner/restaurant/menu
 * Create a new menu item.
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
    const { name, category, description, price, is_available } = body

    if (!name || !category || price === undefined) {
      return NextResponse.json(
        { error: 'Le nom, la catégorie et le prix sont requis' },
        { status: 400 }
      )
    }

    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum <= 0) {
      return NextResponse.json(
        { error: 'Le prix doit être un nombre positif' },
        { status: 400 }
      )
    }

    const validCategories = ['Entrée', 'Plat principal', 'Dessert', 'Boisson', 'Apéritif', 'Autre']
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Catégorie invalide. Catégories valides : ${validCategories.join(', ')}` },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Check uniqueness: (hotel_id, name)
    const { data: existing } = await adminClient
      .from('menu_items')
      .select('id')
      .eq('hotel_id', hotelId)
      .eq('name', name.trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: `Un article nommé "${name.trim()}" existe déjà` },
        { status: 409 }
      )
    }

    const { data: item, error } = await adminClient
      .from('menu_items')
      .insert({
        hotel_id: hotelId,
        name: name.trim(),
        category,
        description: description?.trim() || null,
        price: priceNum,
        is_available: is_available !== undefined ? is_available : true,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `Un article nommé "${name.trim()}" existe déjà` },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('Restaurant menu POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
