import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = ['owner', 'manager']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

/**
 * POST /api/owner/expenses/upload-receipt
 * Upload a receipt file for an expense.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.app_metadata?.role
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const hotelId = user.app_metadata?.hotel_id
    if (!hotelId) {
      return NextResponse.json({ error: 'Aucun hôtel associé' }, { status: 404 })
    }

    const body = await request.json()
    const { file_data, mime_type, file_name } = body

    if (!file_data || !mime_type) {
      return NextResponse.json({ error: 'Fichier et type MIME requis' }, { status: 400 })
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(mime_type)) {
      return NextResponse.json(
        { error: `Type de fichier non autorisé. Types acceptés : ${ALLOWED_MIME_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate file size (base64 is ~33% larger than raw)
    const estimatedSize = (file_data.length * 3) / 4
    if (estimatedSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Fichier trop volumineux (max 5 Mo)' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: 'Service admin non configuré' }, { status: 500 })
    }

    // Generate a unique file path
    const timestamp = Date.now()
    const ext = mime_type === 'application/pdf' ? 'pdf' : mime_type === 'image/png' ? 'png' : 'jpg'
    const filePath = `${hotelId}/receipts/${timestamp}_${file_name?.replace(/[^a-zA-Z0-9.-]/g, '_') || 'receipt'}.${ext}`

    // Decode base64 and upload
    const buffer = Buffer.from(file_data, 'base64')

    const { error: uploadError } = await adminClient.storage
      .from('customer-documents') // Reuse the same bucket for receipts
      .upload(filePath, buffer, {
        contentType: mime_type,
        upsert: true,
      })

    if (uploadError) {
      console.error('Receipt upload error:', uploadError)
      return NextResponse.json({ error: 'Erreur lors du téléchargement du fichier' }, { status: 500 })
    }

    return NextResponse.json({ path: filePath }, { status: 201 })
  } catch (error) {
    console.error('Upload receipt POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
