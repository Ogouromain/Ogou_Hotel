import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateIdentityDocument, mimeToExtension, type AllowedMimeType } from '@/lib/file-validation'

// ─── Helper: upload identity document to Supabase Storage ──────────
async function uploadIdentityDocument(
  adminClient: ReturnType<typeof createAdminClient>,
  hotelId: string,
  customerId: string,
  fileData: string, // base64 encoded
  mimeType: string
): Promise<{ path: string } | null> {
  try {
    const ext = mimeToExtension(mimeType as AllowedMimeType) || 'jpg'
    const filePath = `${hotelId}/${customerId}_cni.${ext}`

    // Decode base64
    const buffer = Buffer.from(fileData, 'base64')

    const { error } = await adminClient.storage
      .from('customer-documents')
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true, // overwrite if re-uploading
      })

    if (error) {
      console.error('Storage upload error:', error)
      return null
    }

    return { path: filePath }
  } catch (error) {
    console.error('uploadIdentityDocument error:', error)
    return null
  }
}

/**
 * GET /api/owner/customers
 * List all customers for the owner's hotel.
 * Optional query param: search (filters by first_name, last_name, phone, email)
 */
export async function GET(request: NextRequest) {
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

    const role = user.app_metadata?.role
    if (!['owner', 'manager', 'receptionist'].includes(role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const adminClient = createAdminClient()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim()

    // Try selecting with identity_document_path first; fall back without it if column doesn't exist yet
    let selectFields = 'id, hotel_id, first_name, last_name, email, phone, identity_document_type, identity_document_number, identity_document_path, created_at, updated_at'
    let query = adminClient
      .from('customers')
      .select(selectFields)
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })

    // Apply search filter if provided
    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
      )
    }

    let { data: customers, error } = await query

    // If identity_document_path column doesn't exist yet, retry without it
    if (error && error.message && error.message.includes('identity_document_path')) {
      selectFields = 'id, hotel_id, first_name, last_name, email, phone, identity_document_type, identity_document_number, created_at, updated_at'
      let retryQuery = adminClient
        .from('customers')
        .select(selectFields)
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false })

      // Re-apply search filter on retry
      if (search) {
        retryQuery = retryQuery.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
        )
      }

      const retryResult = await retryQuery
      customers = retryResult.data
      error = retryResult.error
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ customers })
  } catch (error) {
    console.error('Owner customers GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/owner/customers
 * Create a new customer with optional identity document upload.
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

    const role = user.app_metadata?.role
    if (!['owner', 'manager', 'receptionist'].includes(role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json()
    const {
      first_name,
      last_name,
      email,
      phone,
      identity_document_type,
      identity_document_number,
      identity_document_file, // base64 encoded file data
      identity_document_mime_type, // e.g. 'image/jpeg'
    } = body

    // ─── Validate required fields ──────────────────────────────
    if (!first_name || !last_name || !phone) {
      return NextResponse.json(
        { error: 'Prénom, nom et téléphone sont requis' },
        { status: 400 }
      )
    }

    // Validate identity_document_type if provided
    const validDocTypes = ['CNI', 'Passeport', 'Attestation']
    if (identity_document_type && !validDocTypes.includes(identity_document_type)) {
      return NextResponse.json(
        { error: `Type de document invalide. Types autorisés : ${validDocTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json({ error: 'Adresse e-mail invalide' }, { status: 400 })
      }
    }

    const adminClient = createAdminClient()

    // ─── Insert customer record ───────────────────────────────
    // Use select without identity_document_path in case column doesn't exist yet
    const selectFields = 'id, hotel_id, first_name, last_name, email, phone, identity_document_type, identity_document_number, created_at, updated_at'
    const { data: customer, error: insertError } = await adminClient
      .from('customers')
      .insert({
        hotel_id: hotelId,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email?.trim() || null,
        phone: phone.trim(),
        identity_document_type: identity_document_type || null,
        identity_document_number: identity_document_number?.trim() || null,
      })
      .select(selectFields)
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: `Erreur lors de la création du client : ${insertError.message}` },
        { status: 500 }
      )
    }

    // ─── Upload identity document if provided ─────────────────
    if (identity_document_file && identity_document_mime_type && customer) {
      // SECURITY: Validate file size and real MIME type server-side
      const fileValidation = validateIdentityDocument(
        identity_document_file,
        identity_document_mime_type
      )

      if (!fileValidation.valid) {
        // Delete the customer we just created since the document is invalid
        await adminClient.from('customers').delete().eq('id', customer.id)
        return NextResponse.json(
          { error: fileValidation.error },
          { status: 400 }
        )
      }

      const result = await uploadIdentityDocument(
        adminClient,
        hotelId,
        customer.id,
        identity_document_file,
        fileValidation.detectedMimeType!
      )

      if (result) {
        // Try to update customer with document path (column may not exist yet)
        const { error: updatePathError } = await adminClient
          .from('customers')
          .update({ identity_document_path: result.path })
          .eq('id', customer.id)

        if (updatePathError) {
          console.error('Failed to update customer document path:', updatePathError)
        } else {
          // Add path to response object if update succeeded
          (customer as Record<string, unknown>).identity_document_path = result.path
        }
      }
    }

    // ─── Generate signed URL if document exists ───────────────
    const docPath = (customer as Record<string, unknown>)?.identity_document_path as string | null
    let signedUrl: string | null = null
    if (docPath) {
      const { data: urlData } = await adminClient.storage
        .from('customer-documents')
        .createSignedUrl(docPath, 300) // 5 minutes

      signedUrl = urlData?.signedUrl || null
    }

    return NextResponse.json({
      customer,
      signed_url: signedUrl,
    }, { status: 201 })
  } catch (error) {
    console.error('Owner customers POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
