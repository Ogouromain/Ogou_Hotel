import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const READ_ROLES = ['owner', 'manager', 'receptionist']
const WRITE_ROLES = ['owner', 'manager']

/**
 * GET /api/owner/expenses/categories
 * List all expense categories for the hotel.
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

    // Check if categories exist, if not seed defaults
    const { data: categories } = await adminClient
      .from('expense_categories')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('name', { ascending: true })

    if (!categories || categories.length === 0) {
      // Seed default categories
      const defaults = [
        { hotel_id: hotelId, name: 'Alimentation & Boissons', type: 'supply' },
        { hotel_id: hotelId, name: 'Électricité', type: 'utility' },
        { hotel_id: hotelId, name: 'Eau', type: 'utility' },
        { hotel_id: hotelId, name: 'Internet & Téléphone', type: 'utility' },
        { hotel_id: hotelId, name: 'Salaires & Primes', type: 'payroll' },
        { hotel_id: hotelId, name: 'Entretien & Réparations', type: 'maintenance' },
        { hotel_id: hotelId, name: 'Fournitures de bureau', type: 'operating' },
        { hotel_id: hotelId, name: 'Marketing & Publicité', type: 'marketing' },
        { hotel_id: hotelId, name: 'Transport', type: 'operating' },
        { hotel_id: hotelId, name: 'Assurances', type: 'operating' },
        { hotel_id: hotelId, name: 'Loyer & Charges', type: 'operating' },
        { hotel_id: hotelId, name: 'Autres dépenses', type: 'other' },
      ]

      const { data: seeded, error: seedError } = await adminClient
        .from('expense_categories')
        .insert(defaults)
        .select()

      if (seedError) {
        console.error('Failed to seed expense categories:', seedError)
      }

      return NextResponse.json({ categories: seeded || [] })
    }

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Expense categories GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/owner/expenses/categories
 * Create a new expense category.
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
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const body = await request.json()
    const { name, type } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Le nom de la catégorie est requis' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }

    // Check uniqueness
    const { data: existing } = await adminClient
      .from('expense_categories')
      .select('id')
      .eq('hotel_id', hotelId)
      .eq('name', name.trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: `Une catégorie "${name.trim()}" existe déjà` }, { status: 409 })
    }

    const { data: category, error } = await adminClient
      .from('expense_categories')
      .insert({
        hotel_id: hotelId,
        name: name.trim(),
        type: type || 'other',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    console.error('Expense categories POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
