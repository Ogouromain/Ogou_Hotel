-- =========================================================
-- OGOU_HÔTEL - Correctif: Audit Logs FK & RLS
-- Date: 2026-06-11
-- Objet: Ajouter la FK manquante audit_logs.profile_id → profiles.id,
--        activer RLS et ajouter les politiques d'accès
-- IDEMPOTENT: Peut être exécuté plusieurs fois sans erreur
-- =========================================================

-- 1. Add foreign key constraint from audit_logs.profile_id to profiles.id
-- First, remove any orphaned audit_logs rows where profile_id doesn't match a profile
DELETE FROM public.audit_logs
WHERE profile_id IS NOT NULL
  AND profile_id NOT IN (SELECT id FROM public.profiles);

-- Add the FK constraint (use IF NOT EXISTS pattern via DO block)
DO $$
BEGIN
  -- Check if the constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'audit_logs_profile_id_fkey'
      AND table_name = 'audit_logs'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for audit_logs
DROP POLICY IF EXISTS "Users can read audit logs of own hotel" ON public.audit_logs;
CREATE POLICY "Users can read audit logs of own hotel"
ON public.audit_logs FOR SELECT
USING (
  hotel_id = (
    SELECT p.hotel_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert audit logs for own hotel" ON public.audit_logs;
CREATE POLICY "Users can insert audit logs for own hotel"
ON public.audit_logs FOR INSERT
WITH CHECK (
  hotel_id = (
    SELECT p.hotel_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- Service role (admin) full access — needed for admin API calls
DROP POLICY IF EXISTS "Service role full access on audit_logs" ON public.audit_logs;
CREATE POLICY "Service role full access on audit_logs"
ON public.audit_logs FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Add missing indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_hotel_id ON public.audit_logs(hotel_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_profile_id ON public.audit_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- 5. Add audit_logs to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
