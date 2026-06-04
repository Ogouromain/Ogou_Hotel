-- =========================================================
-- HÔTELCI - Configuration du Bucket de Stockage Privé
-- Stockage sécurisé des pièces d'identité des clients
-- =========================================================

-- 1. Create the storage bucket (must be run via Supabase SQL Editor or API)
-- The bucket is created as PRIVATE (not public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-documents',
  'customer-documents',
  false,
  5242880, -- 5MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- 2. RLS Policy: SELECT - Users can only read files in their hotel's folder
CREATE POLICY "Users can read own hotel documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'customer-documents'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (
    SELECT p.hotel_id::text
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- 3. RLS Policy: INSERT - Users can only upload to their hotel's folder
CREATE POLICY "Users can upload to own hotel folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'customer-documents'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (
    SELECT p.hotel_id::text
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- 4. RLS Policy: DELETE - Users can only delete files in their hotel's folder
CREATE POLICY "Users can delete own hotel documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'customer-documents'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (
    SELECT p.hotel_id::text
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- 5. Add identity_document_path column to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS identity_document_path TEXT;
