import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

// Verify super_admin role
async function verifySuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { authorized: false, error: 'Non authentifié' }
  const role = user.app_metadata?.role
  if (role !== 'super_admin') return { authorized: false, error: 'Accès refusé : rôle super_admin requis' }
  return { authorized: true, userId: user.id }
}

// Generate a unique code in format HTL-XXXX-XXXX-2026
function generateActivationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Exclude confusing chars: I,O,0,1
  const bytes = crypto.randomBytes(8)
  let part1 = ''
  let part2 = ''
  for (let i = 0; i < 4; i++) {
    part1 += chars[bytes[i] % chars.length]
    part2 += chars[bytes[i + 4] % chars.length]
  }
  const year = new Date().getFullYear()
  return `HTL-${part1}-${part2}-${year}`
}

export async function GET() {
  try {
    const auth = await verifySuperAdmin()
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 403 })
    }

    const supabase = createAdminClient()

    const { data: codes, error } = await supabase
      .from('activation_codes')
      .select('*, subscription_plans(name, price_fcfa)')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get hotel names for used codes
    const usedHotelIds = codes
      ?.filter((c) => c.used_by_hotel_id)
      .map((c) => c.used_by_hotel_id) || []

    let hotelMap: Record<string, string> = {}
    if (usedHotelIds.length > 0) {
      const { data: hotels } = await supabase
        .from('hotels')
        .select('id, name')
        .in('id', usedHotelIds)
      if (hotels) {
        for (const h of hotels) {
          hotelMap[h.id] = h.name
        }
      }
    }

    const formattedCodes = (codes || []).map((code) => ({
      id: code.id,
      code: code.code,
      plan_id: code.plan_id,
      plan_name: (code.subscription_plans as unknown as { name: string; price_fcfa: number } | null)?.name || '—',
      plan_price: (code.subscription_plans as unknown as { name: string; price_fcfa: number } | null)?.price_fcfa || 0,
      duration_months: code.duration_months,
      status: code.status,
      used_by_hotel_name: code.used_by_hotel_id ? (hotelMap[code.used_by_hotel_id] || null) : null,
      expires_at: code.expires_at,
      created_at: code.created_at,
      used_at: code.used_at,
    }))

    return NextResponse.json({ codes: formattedCodes })
  } catch (error) {
    console.error('Error fetching activation codes:', error)
    return NextResponse.json(
      { error: 'Erreur lors du chargement des codes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifySuperAdmin()
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 403 })
    }

    const body = await request.json()
    const { planId, durationMonths } = body

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan d\'abonnement requis' },
        { status: 400 }
      )
    }

    const duration = durationMonths || 1
    if (![1, 3, 6, 12].includes(duration)) {
      return NextResponse.json(
        { error: 'Durée invalide (1, 3, 6 ou 12 mois)' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Verify plan exists
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, name, price_fcfa')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan d\'abonnement introuvable' },
        { status: 404 }
      )
    }

    // Generate a unique code (retry up to 10 times if collision)
    let code = ''
    let inserted = false
    let newCodeData = null

    for (let attempt = 0; attempt < 10; attempt++) {
      code = generateActivationCode()

      // Check uniqueness
      const { data: existing } = await supabase
        .from('activation_codes')
        .select('id')
        .eq('code', code)
        .single()

      if (existing) continue // Collision, try again

      // Calculate expiry date (30 days from now)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      const { data, error: insertError } = await supabase
        .from('activation_codes')
        .insert({
          code,
          plan_id: planId,
          duration_months: duration,
          status: 'unused',
          created_by: auth.userId,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single()

      if (insertError) {
        // If unique constraint violation, retry
        if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
          continue
        }
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      inserted = true
      newCodeData = data
      break
    }

    if (!inserted || !newCodeData) {
      return NextResponse.json(
        { error: 'Impossible de générer un code unique' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      code: {
        id: newCodeData.id,
        code: newCodeData.code,
        plan_name: plan.name,
        plan_price: plan.price_fcfa,
        duration_months: newCodeData.duration_months,
        status: newCodeData.status,
        expires_at: newCodeData.expires_at,
        created_at: newCodeData.created_at,
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error generating activation code:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du code' },
      { status: 500 }
    )
  }
}
