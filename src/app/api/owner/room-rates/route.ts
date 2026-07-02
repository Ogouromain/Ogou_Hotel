import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoMode, DEMO_ROOM_RATES } from '@/lib/demo-data'

const ALLOWED_ROLES_GET = ['owner', 'manager', 'receptionist']
const ALLOWED_ROLES_POST = ['owner', 'manager']

/**
 * GET /api/owner/room-rates
 * List all seasonal rates for the hotel, optionally filtered by room_id.
 * Query params: room_id (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Demo mode: return in-memory room rates
    if (isDemoMode()) {
      const { searchParams } = new URL(request.url)
      const roomId = searchParams.get('room_id')

      let rates = [...DEMO_ROOM_RATES]
      if (roomId) {
        rates = rates.filter(r => r.room_id === roomId)
      }
      return NextResponse.json({ rates })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!ALLOWED_ROLES_GET.includes(role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('room_id')

    const adminClient = createAdminClient()
    let query = adminClient
      .from('room_rates')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('priority', { ascending: false })

    if (roomId) {
      query = query.eq('room_id', roomId)
    }

    const { data: rates, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ rates })
  } catch (error) {
    console.error('Room rates GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/owner/room-rates
 * Create a new seasonal rate for a room.
 */
export async function POST(request: NextRequest) {
  try {
    // Demo mode: not supported
    if (isDemoMode()) {
      return NextResponse.json({ error: 'Création de tarif saisonnier non supportée en mode démo' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!ALLOWED_ROLES_POST.includes(role)) {
      return NextResponse.json({ error: 'Seul le propriétaire ou le manager peut ajouter des tarifs saisonniers' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const body = await request.json()
    const { room_id, name, price_per_night, start_date, end_date, priority } = body

    // ─── Validate required fields ──────────────────────────────
    if (!room_id || !name || !price_per_night || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'Chambre, nom, prix par nuit, date de début et date de fin sont requis' },
        { status: 400 }
      )
    }

    // ─── Validate price ────────────────────────────────────────
    const price = parseFloat(price_per_night)
    if (isNaN(price) || price <= 0) {
      return NextResponse.json(
        { error: 'Le prix par nuit doit être un nombre positif' },
        { status: 400 }
      )
    }

    // ─── Validate date format ──────────────────────────────────
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(start_date) || !dateRegex.test(end_date)) {
      return NextResponse.json(
        { error: 'Format de date invalide. Utilisez YYYY-MM-DD' },
        { status: 400 }
      )
    }

    const startDate = new Date(start_date)
    const endDate = new Date(end_date)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Dates invalides' }, { status: 400 })
    }

    if (endDate <= startDate) {
      return NextResponse.json(
        { error: 'La date de fin doit être postérieure à la date de début' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // ─── Verify room belongs to this hotel ─────────────────────
    const { data: room } = await adminClient
      .from('rooms')
      .select('id, room_number')
      .eq('id', room_id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!room) {
      return NextResponse.json(
        { error: 'Chambre introuvable ou n\'appartient pas à votre hôtel' },
        { status: 404 }
      )
    }

    // ─── Create the rate ───────────────────────────────────────
    const { data: rate, error } = await adminClient
      .from('room_rates')
      .insert({
        hotel_id: hotelId,
        room_id,
        name: name.trim(),
        price_per_night: price,
        start_date,
        end_date,
        priority: priority || 0,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ rate }, { status: 201 })
  } catch (error) {
    console.error('Room rates POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
