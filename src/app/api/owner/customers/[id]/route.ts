import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateIdentityDocument, mimeToExtension, type AllowedMimeType } from '@/lib/file-validation'

// mimeToExtension is now imported from @/lib/file-validation

/**
 * PATCH /api/owner/customers/[id]
 * Update a customer's info. If a new identity_document_file is provided,
 * upload it and replace the old one.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json()
    const adminClient = createAdminClient()

    // ─── Verify customer belongs to this hotel ────────────────
    const { data: existingCustomer } = await adminClient
      .from('customers')
      .select('id')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existingCustomer) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    // ─── Build update object ──────────────────────────────────
    const updateData: Record<string, unknown> = {}

    if (body.first_name !== undefined) updateData.first_name = body.first_name.trim()
    if (body.last_name !== undefined) updateData.last_name = body.last_name.trim()
    if (body.email !== undefined) {
      if (body.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(body.email.trim())) {
          return NextResponse.json({ error: 'Adresse e-mail invalide' }, { status: 400 })
        }
      }
      updateData.email = body.email?.trim() || null
    }
    if (body.phone !== undefined) updateData.phone = body.phone.trim()
    if (body.identity_document_type !== undefined) {
      const validDocTypes = ['CNI', 'Passeport', 'Attestation']
      if (body.identity_document_type && !validDocTypes.includes(body.identity_document_type)) {
        return NextResponse.json(
          { error: `Type de document invalide. Types autorisés : ${validDocTypes.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.identity_document_type = body.identity_document_type || null
    }
    if (body.identity_document_number !== undefined) {
      updateData.identity_document_number = body.identity_document_number?.trim() || null
    }

    // ─── Handle identity document upload ──────────────────────
    if (body.identity_document_file && body.identity_document_mime_type) {
      // SECURITY: Validate file size and real MIME type server-side
      const fileValidation = validateIdentityDocument(
        body.identity_document_file,
        body.identity_document_mime_type
      )

      if (!fileValidation.valid) {
        return NextResponse.json(
          { error: fileValidation.error },
          { status: 400 }
        )
      }

      const ext = mimeToExtension(fileValidation.detectedMimeType!) || 'jpg'
      const filePath = `${hotelId}/${id}_cni.${ext}`
      const buffer = Buffer.from(body.identity_document_file, 'base64')

      const { error: uploadError } = await adminClient.storage
        .from('customer-documents')
        .upload(filePath, buffer, {
          contentType: fileValidation.detectedMimeType!,
          upsert: true,
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        return NextResponse.json(
          { error: 'Erreur lors du téléchargement du document' },
          { status: 500 }
        )
      }

      // If the old document path is different, delete the old file
      // Try to get old path (column may not exist yet)
      try {
        const { data: oldCustomer } = await adminClient
          .from('customers')
          .select('identity_document_path')
          .eq('id', id)
          .single()
        
        const oldPath = oldCustomer?.identity_document_path
        if (oldPath && oldPath !== filePath) {
          await adminClient.storage
            .from('customer-documents')
            .remove([oldPath])
        }
      } catch {
        // Column may not exist yet - skip old document cleanup
      }

      updateData.identity_document_path = filePath
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
    }

    // ─── Update customer record ───────────────────────────────
    const { data: customer, error: updateError } = await adminClient
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .select('id, hotel_id, first_name, last_name, email, phone, identity_document_type, identity_document_number, created_at, updated_at')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // ─── Generate signed URL if document exists ───────────────
    const docPath = updateData.identity_document_path as string | null
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
    })
  } catch (error) {
    console.error('Owner customers PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/owner/customers/[id]
 * Delete a customer. Checks that no active reservations exist first.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    if (!['owner', 'manager'].includes(role)) {
      return NextResponse.json({ error: 'Accès refusé. Seuls le propriétaire et le manager peuvent supprimer des clients.' }, { status: 403 })
    }

    const { id } = await params
    const adminClient = createAdminClient()

    // ─── Verify customer belongs to this hotel ────────────────
    const { data: existingCustomer } = await adminClient
      .from('customers')
      .select('id')
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .maybeSingle()

    if (!existingCustomer) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    // ─── Check for active reservations ────────────────────────
    const { count: activeReservations } = await adminClient
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', id)
      .in('status', ['pending', 'confirmed', 'checked_in'])

    if ((activeReservations ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Impossible de supprimer ce client : il a des réservations actives' },
        { status: 403 }
      )
    }

    // ─── Delete identity document from storage (try if column exists) ──
    // Try to get the document path - if column doesn't exist, skip silently
    try {
      const { data: customerWithDoc } = await adminClient
        .from('customers')
        .select('identity_document_path')
        .eq('id', id)
        .single()
      
      if (customerWithDoc?.identity_document_path) {
        await adminClient.storage
          .from('customer-documents')
          .remove([customerWithDoc.identity_document_path])
      }
    } catch {
      // Column may not exist yet - skip document cleanup
    }

    // ─── Delete customer record ───────────────────────────────
    const { error: deleteError } = await adminClient
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('hotel_id', hotelId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Owner customers DELETE error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
