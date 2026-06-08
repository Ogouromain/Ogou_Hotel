-- =========================================================
-- OGOU_HÔTEL - Correctif de Sécurité #1 : Renforcement RLS
-- Date: 2026-03-01 (Updated)
-- Objet: Créer les tables manquantes, WITH CHECK sur UPDATE,
--        isolation invoices/menu_items/notifications
-- IDEMPOTENT: Peut être exécuté plusieurs fois sans erreur
-- =========================================================

-- ─────────────────────────────────────────────────────────────
-- 0. PRÉREQUIS : Créer les tables manquantes si nécessaire
-- ─────────────────────────────────────────────────────────────
-- Ces tables doivent exister AVANT d'appliquer les politiques RLS.
-- Si elles existent déjà, CREATE TABLE IF NOT EXISTS est sans effet.

-- 0a. Table MENU_ITEMS (nécessaire pour le module restaurant)
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'Autre',
    description TEXT,
    price NUMERIC(12, 2) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (hotel_id, name)
);

-- Index pour menu_items
CREATE INDEX IF NOT EXISTS idx_menu_items_hotel_id ON public.menu_items(hotel_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category);

-- 0b. Enum notification_type (nécessaire pour la table notifications)
DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM ('reservation', 'order', 'stock', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 0c. Table NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    type public.notification_type NOT NULL DEFAULT 'system',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index pour notifications
CREATE INDEX IF NOT EXISTS idx_notifications_hotel_id ON public.notifications(hotel_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- 0d. Activer RLS sur les nouvelles tables
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

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

-- SELECT : lecture pour les employés de l'hôtel
DROP POLICY IF EXISTS "Users can read notifications of own hotel" ON public.notifications;
CREATE POLICY "Users can read notifications of own hotel"
ON public.notifications FOR SELECT
USING (
  hotel_id = (
    SELECT p.hotel_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- INSERT : suppression de la vulnérabilité OR auth.uid() IS NULL
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications for own hotel" ON public.notifications;
CREATE POLICY "Users can insert notifications for own hotel"
ON public.notifications FOR INSERT
WITH CHECK (
  hotel_id = (
    SELECT p.hotel_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- UPDATE : ajout WITH CHECK sur la politique existante
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

-- DELETE : ajout politique DELETE manquante sur notifications
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

-- ─────────────────────────────────────────────────────────────
-- 5. REALTIME : Activer le temps réel sur les nouvelles tables
-- ─────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
