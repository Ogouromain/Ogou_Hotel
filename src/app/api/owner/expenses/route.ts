import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const READ_ROLES = ['owner', 'manager', 'receptionist']
const WRITE_ROLES = ['owner', 'manager']

/**
 * GET /api/owner/expenses
 * List all expenses for the hotel with optional filters.
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

    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const categoryFilter = searchParams.get('category_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const typeFilter = searchParams.get('type')
    const search = searchParams.get('search')

    let query = adminClient
      .from('expenses')
      .select('*, expense_categories(*), profiles:first_name,last_name')
      .eq('hotel_id', hotelId)
      .order('expense_date', { ascending: false })

    if (categoryFilter) {
      query = query.eq('category_id', categoryFilter)
    }
    if (dateFrom) {
      query = query.gte('expense_date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('expense_date', dateTo)
    }
    if (search) {
      query = query.ilike('description', `%${search}%`)
    }

    const { data: expenses, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also fetch expense categories for this hotel
    const { data: categories } = await adminClient
      .from('expense_categories')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('name', { ascending: true })

    // Compute stats
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]

    const { data: monthExpenses } = await adminClient
      .from('expenses')
      .select('amount')
      .eq('hotel_id', hotelId)
      .gte('expense_date', monthStart)

    const { data: yearExpenses } = await adminClient
      .from('expenses')
      .select('amount, expense_categories(type)')
      .eq('hotel_id', hotelId)
      .gte('expense_date', yearStart)

    const total_expenses_month = monthExpenses?.reduce(
      (sum: number, e: { amount: number }) => sum + (e.amount || 0), 0
    ) ?? 0

    const total_expenses_year = yearExpenses?.reduce(
      (sum: number, e: { amount: number }) => sum + (e.amount || 0), 0
    ) ?? 0

    // Breakdown by category type
    const expensesByType: Record<string, number> = {}
    yearExpenses?.forEach((e: { amount: number; expense_categories: { type: string } | null }) => {
      const type = e.expense_categories?.type || 'other'
      expensesByType[type] = (expensesByType[type] || 0) + e.amount
    })

    // Filter by category type if requested
    let filteredExpenses = expenses || []
    if (typeFilter && typeFilter !== 'all') {
      filteredExpenses = filteredExpenses.filter(
        (e: Record<string, unknown>) => (e.expense_categories as Record<string, string>)?.type === typeFilter
      )
    }

    return NextResponse.json({
      expenses: filteredExpenses,
      categories: categories || [],
      stats: {
        total_expenses_month,
        total_expenses_year,
        expenses_by_type: expensesByType,
      },
    })
  } catch (error) {
    console.error('Expenses GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/owner/expenses
 * Create a new expense.
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
      return NextResponse.json({ error: 'Accès non autorisé. Seuls le propriétaire et le manager peuvent créer des dépenses.' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const body = await request.json()
    const { category_id, amount, description, expense_date, payment_method, receipt_url } = body

    if (!description || !description.trim()) {
      return NextResponse.json({ error: 'La description est requise' }, { status: 400 })
    }
    if (!amount || isNaN(parseInt(amount)) || parseInt(amount) <= 0) {
      return NextResponse.json({ error: 'Le montant doit être un nombre positif' }, { status: 400 })
    }
    if (!expense_date) {
      return NextResponse.json({ error: 'La date de la dépense est requise' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }

    // If category_id is provided, verify it belongs to this hotel
    if (category_id) {
      const { data: cat } = await adminClient
        .from('expense_categories')
        .select('id')
        .eq('id', category_id)
        .eq('hotel_id', hotelId)
        .maybeSingle()

      if (!cat) {
        return NextResponse.json({ error: 'Catégorie invalide' }, { status: 400 })
      }
    }

    const { data: expense, error } = await adminClient
      .from('expenses')
      .insert({
        hotel_id: hotelId,
        category_id: category_id || null,
        amount: parseInt(amount),
        description: description.trim(),
        expense_date,
        payment_method: payment_method || null,
        receipt_url: receipt_url || null,
        created_by: user.id,
      })
      .select('*, expense_categories(*)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ expense }, { status: 201 })
  } catch (error) {
    console.error('Expenses POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
