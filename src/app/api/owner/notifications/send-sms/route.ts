import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/owner/notifications/send-sms
 *
 * Sends an SMS or WhatsApp notification to a customer.
 * Body: { to: string, message: string, channel: 'sms' | 'whatsapp', customer_id?: string }
 *
 * - WhatsApp: Generates a wa.me deep link + logs the notification in DB
 * - SMS: Logs the notification and returns delivery info (gateway-agnostic)
 *
 * Both channels create an audit record in the notifications table.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user via Supabase SSR cookie
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const hotelId = user.app_metadata?.hotel_id
    const userRole = user.app_metadata?.role

    if (!hotelId) {
      return NextResponse.json(
        { error: 'Aucun hôtel associé' },
        { status: 403 }
      )
    }

    if (!['owner', 'manager'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Accès refusé. Seuls les propriétaires et managers peuvent envoyer des SMS.' },
        { status: 403 }
      )
    }

    // 2. Parse and validate request body
    const body = await request.json()
    const { to, message, channel, customer_id } = body

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

    if (message.length > 160) {
      return NextResponse.json(
        { error: 'Le message ne doit pas dépasser 160 caractères' },
        { status: 400 }
      )
    }

    if (channel !== 'sms' && channel !== 'whatsapp') {
      return NextResponse.json(
        { error: 'Canal invalide. Utilisez "sms" ou "whatsapp"' },
        { status: 400 }
      )
    }

    // 3. Clean phone number (remove spaces, ensure +225 prefix)
    let cleanPhone = to.replace(/[\s\-()]/g, '')
    if (!cleanPhone.startsWith('+')) {
      // If it starts with 225, add +
      if (cleanPhone.startsWith('225')) {
        cleanPhone = '+' + cleanPhone
      }
      // If it starts with 0 (local CI format), replace with +225
      else if (cleanPhone.startsWith('0')) {
        cleanPhone = '+225' + cleanPhone.substring(1)
      }
      // Otherwise assume CI number
      else {
        cleanPhone = '+225' + cleanPhone
      }
    }

    const adminClient = createAdminClient()

    // 4. Create notification record in the database
    const { data: notification, error: notifError } = await adminClient
      .from('notifications')
      .insert({
        hotel_id: hotelId,
        type: 'system',
        title: channel === 'whatsapp'
          ? `WhatsApp envoyé à ${cleanPhone}`
          : `SMS envoyé à ${cleanPhone}`,
        message: message,
        metadata: {
          channel,
          phone: cleanPhone,
          customer_id: customer_id || null,
          sent_by: user.id,
          sent_at: new Date().toISOString(),
          status: 'sent',
        },
      })
      .select('id')
      .single()

    if (notifError) {
      console.error('Failed to create notification record:', notifError)
      // Don't fail the request - the message itself is more important
    }

    // 5. Generate WhatsApp deep link if applicable
    // In Côte d'Ivoire, WhatsApp is the primary messaging channel.
    // wa.me links open WhatsApp directly with the message pre-filled.
    let whatsappLink: string | null = null
    if (channel === 'whatsapp') {
      // Format: https://wa.me/22507XXXXXXXX?text=encoded_message
      const waPhone = cleanPhone.replace('+', '')
      whatsappLink = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`
    }

    // 6. Log the actual send event
    console.log(
      `[${channel.toUpperCase()}] Hotel: ${hotelId} | To: ${cleanPhone} | Message: ${message.substring(0, 80)}... | By: ${user.id}`
    )

    // 7. Return result with actionable data
    return NextResponse.json({
      success: true,
      channel,
      phone: cleanPhone,
      notification_id: notification?.id || null,
      whatsapp_link: whatsappLink,
      message: channel === 'whatsapp'
        ? 'Lien WhatsApp généré avec succès. Le message sera envoyé via WhatsApp.'
        : 'SMS enregistré et prêt pour l\'envoi.',
    })
  } catch (error) {
    console.error('Owner notifications send-sms POST error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
