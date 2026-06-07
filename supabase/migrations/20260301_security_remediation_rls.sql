-- =========================================================
-- HÔTELCI - Correctif de Sécurité #1 : Renforcement RLS
-- Date: 2026-03-01
-- Objet:WITH CHECK sur UPDATE, isolation invoices/menu_items/notifications
-- =========================================================

-- ─────────────────────────────────────────────────────────────
-- 1. INVOICES : Ajout WITH CHECK sur la politique UPDATE
-- ─────────────────────────────────────────────────────────────
-- AVANT : UPDATE n'avait que USING → un owner pouvait déplacer
--         une facture vers un autre hotel_id après modification.
-- APRÈS : WITH CHECK garantit que la ligne modifiée reste dans
--         le périmètre de l'hôtel de l'utilisateur.

DROP POLICY IF EXISTS "Users can update invoices of own hotel" ON public.invoices;
CREATE POLICY "Users can update invoices of own hotel"
ON public.invoices FOR UPDATE
USING (
  hotel_id = (
    SELECT p.hotel_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  hotel_id = (
    SELECT p.hotel_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- Ajout politique DELETE manquante sur invoices
DROP POLICY IF EXISTS "Users can delete invoices of own hotel" ON public.invoices;
CREATE POLICY "Users can delete invoices of own hotel"
ON public.invoices FOR DELETE
USING (
  hotel_id = (
    SELECT p.hotel_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- ─────────────────────────────────────────────────────────────
-- 2. INVOICE_ITEMS : Ajout politique UPDATE et DELETE
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update invoice items of own hotel" ON public.invoice_items;
CREATE POLICY "Users can update invoice items of own hotel"
ON public.invoice_items FOR UPDATE
USING (
  invoice_id IN (
    SELECT i.id FROM public.invoices i
    WHERE i.hotel_id = (
      SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  )
)
WITH CHECK (
  invoice_id IN (
    SELECT i.id FROM public.invoices i
    WHERE i.hotel_id = (
      SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can delete invoice items of own hotel" ON public.invoice_items;
CREATE POLICY "Users can delete invoice items of own hotel"
ON public.invoice_items FOR DELETE
USING (
  invoice_id IN (
    SELECT i.id FROM public.invoices i
    WHERE i.hotel_id = (
      SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  )
);

-- ─────────────────────────────────────────────────────────────
-- 3. MENU_ITEMS : Création complète des politiques RLS
-- ─────────────────────────────────────────────────────────────
-- La table menu_items était créée sans aucune politique RLS !

-- Activer RLS
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- SELECT : lecture pour les employés de l'hôtel
DROP POLICY IF EXISTS "Users can read menu items of own hotel" ON public.menu_items;
CREATE POLICY "Users can read menu items of own hotel"
ON public.menu_items FOR SELECT
USING (
  hotel_id = (
    SELECT p.hotel_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- INSERT : création pour les employés de l'hôtel
DROP POLICY IF EXISTS "Users can insert menu items for own hotel" ON public.menu_items;
CREATE POLICY "Users can insert menu items for own hotel"
ON public.menu_items FOR INSERT
WITH CHECK (
  hotel_id = (
    SELECT p.hotel_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- UPDATE : modification pour les employés de l'hôtel (avec WITH CHECK)
DROP POLICY IF EXISTS "Users can update menu items of own hotel" ON public.menu_items;
CREATE POLICY "Users can update menu items of own hotel"
ON public.menu_items FOR UPDATE
USING (
  hotel_id = (
    SELECT p.hotel_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  hotel_id = (
    SELECT p.hotel_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- DELETE : suppression pour les employés de l'hôtel
DROP POLICY IF EXISTS "Users can delete menu items of own hotel" ON public.menu_items;
CREATE POLICY "Users can delete menu items of own hotel"
ON public.menu_items FOR DELETE
USING (
  hotel_id = (
    SELECT p.hotel_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- ─────────────────────────────────────────────────────────────
-- 4. NOTIFICATIONS : Correction politique INSERT critique
-- ─────────────────────────────────────────────────────────────
-- AVANT : OR auth.uid() IS NULL → permettait à tout utilisateur
--         non authentifié d'insérer des notifications !
-- APRÈS : Seul un utilisateur authentifié de l'hôtel peut insérer

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications for own hotel"
ON public.notifications FOR INSERT
WITH CHECK (
  hotel_id = (
    SELECT p.hotel_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- Ajout WITH CHECK sur la politique UPDATE existante
DROP POLICY IF EXISTS "Users can update notifications of own hotel" ON public.notifications;
CREATE POLICY "Users can update notifications of own hotel"
ON public.notifications FOR UPDATE
USING (
  hotel_id = (
    SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  hotel_id = (
    SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

-- Ajout politique DELETE manquante sur notifications
DROP POLICY IF EXISTS "Users can delete notifications of own hotel" ON public.notifications;
CREATE POLICY "Users can delete notifications of own hotel"
ON public.notifications FOR DELETE
USING (
  hotel_id = (
    SELECT p.hotel_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);
