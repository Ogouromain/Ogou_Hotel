import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/auth/register/verify-code
 * 
 * Validates an activation code without redeeming it.
 * Returns the plan details if valid.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Le code d\'activation est requis' },
        { status: 400 }
      )
    }

    const normalizedCode = code.trim().toUpperCase()
    const supabase = createAdminClient()

    // Look up the code with plan details
    const { data: codeData, error: codeError } = await supabase
      .from('activation_codes')
      .select(`
        id,
        code,
        status,
        expires_at,
        duration_months,
        plan_id,
        subscription_plans (
          id,
          name,
          price_fcfa
        )
      `)
      .eq('code', normalizedCode)
      .single()

    if (codeError || !codeData) {
      return NextResponse.json(
        { error: 'Code d\'activation introuvable. Veuillez vérifier et réessayer.' },
        { status: 404 }
      )
    }

    // Check status
    if (codeData.status === 'used') {
      return NextResponse.json(
        { error: 'Ce code d\'activation a déjà été utilisé.' },
        { status: 400 }
      )
    }

    if (codeData.status === 'expired') {
      return NextResponse.json(
        { error: 'Ce code d\'activation a expiré.' },
        { status: 400 }
      )
    }

    // Check expiration date
    const expiresAt = new Date(codeData.expires_at)
    const now = new Date()
    if (expiresAt < now) {
      // Mark as expired in the database
      await supabase
        .from('activation_codes')
        .update({ status: 'expired' })
        .eq('id', codeData.id)

      return NextResponse.json(
        { error: 'Ce code d\'activation a expiré.' },
        { status: 400 }
      )
    }

    // Code is valid — return plan info
    const plan = codeData.subscription_plans as unknown as {
      id: string
      name: string
      price_fcfa: number
    }

    return NextResponse.json({
      valid: true,
      code: {
        id: codeData.id,
        code: codeData.code,
        duration_months: codeData.duration_months,
        expires_at: codeData.expires_at,
      },
      plan: {
        id: plan.id,
        name: plan.name,
        price_fcfa: plan.price_fcfa,
      },
    })
  } catch (error) {
    console.error('Verify code error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur lors de la vérification du code' },
      { status: 500 }
    )
  }
}
