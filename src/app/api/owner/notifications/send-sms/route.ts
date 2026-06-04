import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/owner/notifications/send-sms
 *
 * Sends an SMS or WhatsApp notification (simulation).
 * Body: { to: string, message: string, channel: 'sms' | 'whatsapp' }
 *
 * Currently logs the message and returns success.
 * No actual SMS gateway integration yet.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Create admin client and verify Supabase is configured
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase non configuré' },
        { status: 503 }
      )
    }

    // 2. Authenticate via Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // 3. Parse and validate request body
    const body = await request.json()
    const { to, message, channel } = body

    if (!to || typeof to !== 'string') {
      return NextResponse.json(
        { error: 'Numéro de destinataire requis' },
        { status: 400 }
      )
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message requis' },
        { status: 400 }
      )
    }

    if (channel !== 'sms' && channel !== 'whatsapp') {
      return NextResponse.json(
        { error: 'Canal invalide. Utilisez "sms" ou "whatsapp"' },
        { status: 400 }
      )
    }

    // 4. Simulate sending the message (log it for now)
    console.log(
      `[SMS Simulation] Channel: ${channel}, To: ${to}, Message: ${message}`
    )

    return NextResponse.json({
      success: true,
      message: 'Message envoyé (simulation)',
    })
  } catch (error) {
    console.error('Owner notifications send-sms POST error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
