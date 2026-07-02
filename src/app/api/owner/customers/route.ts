import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateIdentityDocument, mimeToExtension, type AllowedMimeType } from '@/lib/file-validation'
import { logAudit } from '@/lib/audit'
import { isDemoMode, DEMO_CUSTOMERS } from '@/lib/demo-data'

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
    // Mode démo : retourner les clients en mémoire
    if (isDemoMode()) {
      const { searchParams } = new URL(request.url)
      const search = searchParams.get('search')?.trim()
      let results = [...DEMO_CUSTOMERS]
      if (search) {
        const s = search.toLowerCase()
        results = results.filter(c =>
          c.first_name.toLowerCase().includes(s) ||
          c.last_name.toLowerCase().includes(s) ||
          c.phone.includes(s) ||
          (c.email && c.email.toLowerCase().includes(s))
        )
      }
      return NextResponse.json({ customers: results })
    }

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

    // Try selecting with all optional columns first; fall back without them if they don't exist yet
    let selectFields = 'id, hotel_id, first_name, last_name, email, phone, identity_document_type, identity_document_number, identity_document_path, notes, created_at, updated_at'
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

    // If optional columns (identity_document_path, notes) don't exist yet, retry without them
    if (error && error.message && (error.message.includes('identity_document_path') || error.message.includes('notes'))) {
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
      notes,
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

    // ─── Check for duplicate customer (same phone in same hotel) ──
    const { data: existingCustomer } = await adminClient
      .from('customers')
      .select('id, first_name, last_name, phone')
      .eq('hotel_id', hotelId)
      .eq('phone', phone.trim())
      .maybeSingle()

    if (existingCustomer) {
      return NextResponse.json(
        {
          error: `Un client avec ce numéro de téléphone existe déjà : ${(existingCustomer as Record<string, unknown>).first_name} ${(existingCustomer as Record<string, unknown>).last_name}`,
          existing_customer_id: (existingCustomer as Record<string, unknown>).id,
        },
        { status: 409 }
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
    // Build insert object — only include columns that exist in the schema.
    // 'notes' and 'identity_document_path' may not exist yet on older DBs,
    // so we try with them first and fall back without.
    const selectFields = 'id, hotel_id, first_name, last_name, email, phone, identity_document_type, identity_document_number, created_at, updated_at'
    const insertData: Record<string, unknown> = {
      hotel_id: hotelId,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email?.trim() || null,
      phone: phone.trim(),
      identity_document_type: identity_document_type || null,
      identity_document_number: identity_document_number?.trim() || null,
      notes: notes?.trim() || null,
    }

    let { data: customer, error: insertError } = await adminClient
      .from('customers')
      .insert(insertData)
      .select(selectFields)
      .single()

    // If 'notes' column doesn't exist yet, retry without it
    if (insertError && insertError.message && insertError.message.includes('notes')) {
      delete insertData.notes
      const retry = await adminClient
        .from('customers')
        .insert(insertData)
        .select(selectFields)
        .single()
      customer = retry.data
      insertError = retry.error
    }

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

    // ─── Audit log ─────────────────────────────────────────────
    await logAudit({
      hotel_id: hotelId,
      profile_id: user.id,
      action: 'create',
      entity_type: 'customer',
      entity_id: (customer as Record<string, unknown>).id as string,
      new_values: {
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        phone: phone.trim(),
        email: email?.trim() || null,
        identity_document_type: identity_document_type || null,
      },
    })

    return NextResponse.json({
      customer,
      signed_url: signedUrl,
    }, { status: 201 })
  } catch (error) {
    console.error('Owner customers POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
