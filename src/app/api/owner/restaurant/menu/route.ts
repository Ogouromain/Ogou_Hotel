import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const READ_ROLES = ['owner', 'manager', 'receptionist', 'restaurant_staff']
const WRITE_ROLES = ['owner', 'manager']

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

    const role = user.app_metadata?.role
    if (!WRITE_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé. Seuls le propriétaire et le manager peuvent créer des articles.' }, { status: 403 })
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

    const CATEGORY_MAP: Record<string, string> = {
      'entree': 'Entrée',
      'plat_principal': 'Plat principal',
      'dessert': 'Dessert',
      'boisson': 'Boisson',
      'aperitif': 'Apéritif',
      'autre': 'Autre',
      'Entrée': 'Entrée',
      'Plat principal': 'Plat principal',
      'Dessert': 'Dessert',
      'Boisson': 'Boisson',
      'Apéritif': 'Apéritif',
      'Autre': 'Autre',
    }
    const normalizedCategory = CATEGORY_MAP[category]
    if (!normalizedCategory) {
      return NextResponse.json(
        { error: `Catégorie invalide. Catégories valides : ${Object.values(CATEGORY_MAP).filter((v, i, a) => a.indexOf(v) === i).join(', ')}` },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }

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
        category: normalizedCategory,
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
