import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateSetupKey } from '@/lib/setup-auth'

/**
 * POST /api/setup/step6
 * Executes Step 6 database migrations:
 * 1. Add identity_document_path column to customers table
 * 2. Create customer-documents storage bucket
 * 3. Set up RLS policies for the bucket
 */
export async function POST(request: NextRequest) {
  const authError = validateSetupKey(request)
  if (authError) return authError
  try {
    const adminClient = createAdminClient()

    // 1. Add identity_document_path column to customers
    // We need to use raw SQL - check if the column exists first by querying
    const { data: customersData, error: customersError } = await adminClient
      .from('customers')
      .select('id')
      .limit(1)

    if (customersError) {
      return NextResponse.json(
        { error: `Erreur d'accès à la table customers: ${customersError.message}` },
        { status: 500 }
      )
    }

    // Try to select the identity_document_path column
    const { error: columnCheckError } = await adminClient
      .from('customers')
      .select('identity_document_path')
      .limit(1)

    let columnAdded = false
    if (columnCheckError && columnCheckError.message.includes('does not exist')) {
      // Column doesn't exist - we need to add it via SQL
      // The Supabase JS client doesn't support DDL, so we'll return SQL for manual execution
      columnAdded = false
    } else {
      columnAdded = true
    }

    // 2. Check/create storage bucket
    const { data: buckets, error: bucketsError } = await adminClient.storage.listBuckets()

    if (bucketsError) {
      return NextResponse.json(
        { error: `Erreur d'accès au stockage: ${bucketsError.message}` },
        { status: 500 }
      )
    }

    let bucketExists = false
    if (buckets) {
      bucketExists = buckets.some((b) => b.id === 'customer-documents')
    }

    // Create bucket if it doesn't exist
    let bucketCreated = false
    if (!bucketExists) {
      const { error: createBucketError } = await adminClient.storage.createBucket(
        'customer-documents',
        {
          public: false,
          fileSizeLimit: 5242880, // 5MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        }
      )

      if (createBucketError) {
        return NextResponse.json(
          { error: `Erreur de création du bucket: ${createBucketError.message}` },
          { status: 500 }
        )
      }
      bucketCreated = true
    }

    // Return status and any SQL that needs manual execution
    return NextResponse.json({
      column_exists: columnAdded,
      bucket_exists: bucketExists || bucketCreated,
      bucket_created: bucketCreated,
      needs_manual_sql: !columnAdded,
      manual_sql: !columnAdded ? [
        '-- Étape 6 : Ajout de la colonne identity_document_path',
        'ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS identity_document_path TEXT;',
        '',
        '-- Politiques RLS pour le bucket customer-documents',
        `CREATE POLICY "Users can read own hotel documents" ON storage.objects FOR SELECT USING (bucket_id = 'customer-documents' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = (SELECT p.hotel_id::text FROM public.profiles p WHERE p.id = auth.uid()));`,
        `CREATE POLICY "Users can upload to own hotel folder" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'customer-documents' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = (SELECT p.hotel_id::text FROM public.profiles p WHERE p.id = auth.uid()));`,
        `CREATE POLICY "Users can delete own hotel documents" ON storage.objects FOR DELETE USING (bucket_id = 'customer-documents' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = (SELECT p.hotel_id::text FROM public.profiles p WHERE p.id = auth.uid()));`,
      ].join('\n') : null,
      message: columnAdded && (bucketExists || bucketCreated)
        ? 'Étape 6 déjà configurée ✓'
        : bucketCreated
          ? 'Bucket créé avec succès. Exécutez le SQL manuel pour la colonne et les politiques RLS.'
          : 'Exécutez le SQL manuel dans le Supabase SQL Editor.',
    })
  } catch (error) {
    console.error('Step 6 setup error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

/**
 * GET /api/setup/step6
 * Check Step 6 setup status.
 */
export async function GET(request: NextRequest) {
  const authError = validateSetupKey(request)
  if (authError) return authError

  try {
    const adminClient = createAdminClient()

    // Check column
    const { error: columnCheckError } = await adminClient
      .from('customers')
      .select('identity_document_path')
      .limit(1)

    const columnExists = !columnCheckError || !columnCheckError.message.includes('does not exist')

    // Check bucket
    const { data: buckets } = await adminClient.storage.listBuckets()
    const bucketExists = buckets ? buckets.some((b) => b.id === 'customer-documents') : false

    return NextResponse.json({
      ready: columnExists && bucketExists,
      column_exists: columnExists,
      bucket_exists: bucketExists,
    })
  } catch (error) {
    console.error('Step 6 check error:', error)
    return NextResponse.json({ ready: false, error: String(error) }, { status: 500 })
  }
}
