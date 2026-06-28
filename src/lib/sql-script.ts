export const INIT_SQL_SCRIPT = `-- =========================================================
-- OGOU_HÔTEL SaaS - Script d'initialisation Base de Données
-- Système de Gestion Hôtelière Multi-Tenant - Côte d'Ivoire
-- IDEMPOTENT: Can be run multiple times safely
-- =========================================================

-- 1. Activation des extensions requises
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Création des Types Énumérés (Enums) — Idempotent via DO $$ ... EXCEPTION
DO $$ BEGIN
  CREATE TYPE public.hotel_status AS ENUM ('active', 'suspended', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.profile_status AS ENUM ('active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('super_admin', 'owner', 'manager', 'receptionist', 'restaurant_staff', 'housekeeper');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('active', 'suspended', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.activation_code_status AS ENUM ('unused', 'used', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'paid', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.room_status AS ENUM ('available', 'occupied', 'cleaning', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.reservation_status AS ENUM ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('pending', 'preparing', 'served', 'paid', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.stock_transaction_type AS ENUM ('in', 'out');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM ('reservation', 'order', 'stock', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Table des Hôtels
CREATE TABLE IF NOT EXISTS public.hotels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    status public.hotel_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Table des Profils Utilisateurs (liés à auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role public.user_role NOT NULL,
    phone VARCHAR(50),
    status public.profile_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Table des Plans d'Abonnement
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    price_fcfa NUMERIC(12, 2) NOT NULL,
    max_rooms INT NOT NULL,
    max_receptionists INT NOT NULL,
    max_managers INT NOT NULL,
    support_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Table des Abonnements des Hôtels
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE UNIQUE,
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status public.subscription_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Table des Codes d'Activation uniques
CREATE TABLE IF NOT EXISTS public.activation_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
    duration_months INT NOT NULL DEFAULT 1,
    status public.activation_code_status NOT NULL DEFAULT 'unused',
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    used_by_hotel_id UUID REFERENCES public.hotels(id) ON DELETE RESTRICT UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE
);

-- 8. Table des Demandes Commerciales (Leads)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_name VARCHAR(255) NOT NULL,
    prospect_name VARCHAR(255) NOT NULL,
    prospect_email VARCHAR(255) NOT NULL,
    prospect_phone VARCHAR(50) NOT NULL,
    hotel_size_rooms INT NOT NULL,
    status public.lead_status NOT NULL DEFAULT 'new',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Table des Chambres
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    room_number VARCHAR(50) NOT NULL,
    room_type VARCHAR(100) NOT NULL,
    price_per_night NUMERIC(12, 2) NOT NULL,
    status public.room_status NOT NULL DEFAULT 'available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (hotel_id, room_number)
);

-- 10. Table des Clients
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    identity_document_type VARCHAR(100),
    identity_document_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Table des Réservations
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL,
    status public.reservation_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT chk_dates CHECK (check_out_date > check_in_date)
);

-- 12. Table des Salles de Conférence
CREATE TABLE IF NOT EXISTS public.conference_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    capacity INT NOT NULL,
    price_per_hour NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. Table des Réservations de Salles
CREATE TABLE IF NOT EXISTS public.conference_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    conference_room_id UUID NOT NULL REFERENCES public.conference_rooms(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'confirmed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT chk_conf_dates CHECK (end_time > start_time)
);

-- 14. Table des Commandes du Restaurant
CREATE TABLE IF NOT EXISTS public.restaurant_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    table_number VARCHAR(50),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status public.order_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. Détails des Commandes
CREATE TABLE IF NOT EXISTS public.restaurant_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.restaurant_orders(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    CONSTRAINT chk_qty CHECK (quantity > 0)
);

-- 15b. Table des Articles du Menu Restaurant
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

-- 16. Table des Articles en Stock
CREATE TABLE IF NOT EXISTS public.stock_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    unit VARCHAR(50) NOT NULL,
    min_threshold INT NOT NULL DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (hotel_id, name)
);

-- 17. Table des Transactions de Stock
CREATE TABLE IF NOT EXISTS public.stock_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
    type public.stock_transaction_type NOT NULL,
    quantity INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 18. Table d'Audit (Audit Logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_logs
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

DROP POLICY IF EXISTS "Service role full access on audit_logs" ON public.audit_logs;
CREATE POLICY "Service role full access on audit_logs"
ON public.audit_logs FOR ALL
USING (true)
WITH CHECK (true);

-- ==================== INDEX DE PERFORMANCE ====================
CREATE INDEX IF NOT EXISTS idx_profiles_hotel_id ON public.profiles(hotel_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_subscriptions_hotel_id ON public.subscriptions(hotel_id);
CREATE INDEX IF NOT EXISTS idx_activation_codes_code ON public.activation_codes(code);
CREATE INDEX IF NOT EXISTS idx_rooms_hotel_id ON public.rooms(hotel_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);
CREATE INDEX IF NOT EXISTS idx_customers_hotel_id ON public.customers(hotel_id);
CREATE INDEX IF NOT EXISTS idx_reservations_hotel_id_dates ON public.reservations(hotel_id, check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_stock_items_hotel_id ON public.stock_items(hotel_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_hotel_id ON public.menu_items(hotel_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_hotel_id ON public.audit_logs(hotel_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_profile_id ON public.audit_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ==================== SYNC AUTOMATIQUE DES CUSTOM CLAIMS JWT ====================
CREATE OR REPLACE FUNCTION public.sync_profile_metadata_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', NEW.role, 'hotel_id', NEW.hotel_id)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_profile_metadata ON public.profiles;
CREATE TRIGGER trigger_sync_profile_metadata
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_metadata_to_auth();

-- ==================== SEED PLANS D'ABONNEMENT ====================
INSERT INTO public.subscription_plans (name, price_fcfa, max_rooms, max_receptionists, max_managers, support_type)
VALUES
('Basique', 25000.00, 20, 1, 0, 'WhatsApp'),
('Standard', 50000.00, 50, 3, 1, 'Prioritaire'),
('Premium', 95000.00, 9999, 5, 5, 'Dédié 24/7')
ON CONFLICT (name) DO NOTHING;

-- ==================== TRIGGER: VALIDATION DES LIMITES EMPLOYÉS ====================
CREATE OR REPLACE FUNCTION public.check_employee_limits()
RETURNS TRIGGER AS $$
DECLARE
    v_receptionist_count INT;
    v_manager_count INT;
    v_max_receptionists INT;
    v_max_managers INT;
BEGIN
    SELECT sp.max_receptionists, sp.max_managers INTO v_max_receptionists, v_max_managers
    FROM public.subscriptions sub
    JOIN public.subscription_plans sp ON sub.plan_id = sp.id
    WHERE sub.hotel_id = NEW.hotel_id AND sub.status = 'active';

    IF v_max_receptionists IS NULL THEN
        IF NEW.role = 'owner' THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Abonnement actif introuvable pour cet hôtel.';
        END IF;
    END IF;

    IF NEW.role = 'receptionist' THEN
        SELECT COUNT(*) INTO v_receptionist_count
        FROM public.profiles
        WHERE hotel_id = NEW.hotel_id AND role = 'receptionist' AND id <> NEW.id;

        IF v_receptionist_count >= v_max_receptionists THEN
            RAISE EXCEPTION 'Limite de réceptionnistes atteinte (% max) pour votre plan actuel.', v_max_receptionists;
        END IF;
    END IF;

    IF NEW.role = 'manager' THEN
        SELECT COUNT(*) INTO v_manager_count
        FROM public.profiles
        WHERE hotel_id = NEW.hotel_id AND role = 'manager' AND id <> NEW.id;

        IF v_manager_count >= v_max_managers THEN
            RAISE EXCEPTION 'Limite de managers atteinte (% max) pour votre plan actuel.', v_max_managers;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_check_employee_limits ON public.profiles;
CREATE TRIGGER trigger_check_employee_limits
BEFORE INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW
WHEN (NEW.hotel_id IS NOT NULL)
EXECUTE FUNCTION public.check_employee_limits();

-- ==================== TRIGGER: VALIDATION DES LIMITES CHAMBRES ====================
CREATE OR REPLACE FUNCTION public.check_room_limits()
RETURNS TRIGGER AS $$
DECLARE
    v_room_count INT;
    v_max_rooms INT;
BEGIN
    SELECT sp.max_rooms INTO v_max_rooms
    FROM public.subscriptions sub
    JOIN public.subscription_plans sp ON sub.plan_id = sp.id
    WHERE sub.hotel_id = NEW.hotel_id AND sub.status = 'active';

    IF v_max_rooms IS NULL THEN
        RAISE EXCEPTION 'Abonnement actif introuvable pour cet hôtel.';
    END IF;

    SELECT COUNT(*) INTO v_room_count
    FROM public.rooms
    WHERE hotel_id = NEW.hotel_id AND id <> NEW.id;

    IF v_room_count >= v_max_rooms THEN
        RAISE EXCEPTION 'Limite de chambres atteinte (% max) pour votre plan actuel.', v_max_rooms;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_check_room_limits ON public.rooms;
CREATE TRIGGER trigger_check_room_limits
BEFORE INSERT ON public.rooms
FOR EACH ROW
WHEN (NEW.hotel_id IS NOT NULL)
EXECUTE FUNCTION public.check_room_limits();

-- ==================== STOCKAGE PRIVÉ : PIÈCES D'IDENTITÉ CLIENTS ====================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-documents',
  'customer-documents',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can read own hotel documents" ON storage.objects;
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

DROP POLICY IF EXISTS "Users can upload to own hotel folder" ON storage.objects;
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

DROP POLICY IF EXISTS "Users can delete own hotel documents" ON storage.objects;
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

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS identity_document_path TEXT;

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS notes TEXT;

-- ==================== MENU_ITEMS RLS ====================
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

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

-- =========================================================
-- STEP 8: NOTIFICATIONS, AUTO-NOTIFICATION TRIGGERS,
--         ANALYTICS FUNCTION & REALTIME ENABLEMENT
-- =========================================================

-- ==================== 8a. NOTIFICATIONS TABLE ====================
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

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_hotel_id ON public.notifications(hotel_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
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

DROP POLICY IF EXISTS "Users can insert notifications for own hotel" ON public.notifications;
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

-- SECURITÉ: WITH CHECK empêche le déplacement d'une notification vers un autre hôtel
DROP POLICY IF EXISTS "Users can update notifications of own hotel" ON public.notifications;
CREATE POLICY "Users can update notifications of own hotel"
ON public.notifications FOR UPDATE
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

-- SECURITÉ: Politique DELETE manquante ajoutée
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

-- ==================== 8b. AUTO-NOTIFICATION TRIGGERS ====================

-- Trigger: Notify on reservation status change
CREATE OR REPLACE FUNCTION public.notify_reservation_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (hotel_id, type, title, message, metadata)
    VALUES (
      NEW.hotel_id,
      'reservation',
      'Changement de statut de réservation',
      'La réservation ' || NEW.id || ' est passée de "' || OLD.status || '" à "' || NEW.status || '".',
      jsonb_build_object(
        'reservation_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'room_id', NEW.room_id,
        'customer_id', NEW.customer_id
      )
    );
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (hotel_id, type, title, message, metadata)
    VALUES (
      NEW.hotel_id,
      'reservation',
      'Nouvelle réservation',
      'Une nouvelle réservation a été créée avec le statut "' || NEW.status || '".',
      jsonb_build_object(
        'reservation_id', NEW.id,
        'status', NEW.status,
        'room_id', NEW.room_id,
        'customer_id', NEW.customer_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_reservation_status ON public.reservations;
CREATE TRIGGER trigger_notify_reservation_status
AFTER INSERT OR UPDATE OF status ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.notify_reservation_status_change();

-- Trigger: Notify on restaurant order status change
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (hotel_id, type, title, message, metadata)
    VALUES (
      NEW.hotel_id,
      'order',
      'Changement de statut de commande',
      'La commande ' || NEW.id || ' est passée de "' || OLD.status || '" à "' || NEW.status || '".',
      jsonb_build_object(
        'order_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'table_number', NEW.table_number,
        'room_id', NEW.room_id
      )
    );
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (hotel_id, type, title, message, metadata)
    VALUES (
      NEW.hotel_id,
      'order',
      'Nouvelle commande restaurant',
      'Une nouvelle commande a été créée avec le statut "' || NEW.status || '".',
      jsonb_build_object(
        'order_id', NEW.id,
        'status', NEW.status,
        'table_number', NEW.table_number,
        'room_id', NEW.room_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_order_status ON public.restaurant_orders;
CREATE TRIGGER trigger_notify_order_status
AFTER INSERT OR UPDATE OF status ON public.restaurant_orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_status_change();

-- Trigger: Notify on stock item below minimum threshold
CREATE OR REPLACE FUNCTION public.notify_stock_below_threshold()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity < NEW.min_threshold THEN
    INSERT INTO public.notifications (hotel_id, type, title, message, metadata)
    VALUES (
      NEW.hotel_id,
      'stock',
      'Alerte de stock bas',
      'L\\'article "' || NEW.name || '" est en dessous du seuil minimum (quantité: ' || NEW.quantity || ', seuil: ' || NEW.min_threshold || ').',
      jsonb_build_object(
        'stock_item_id', NEW.id,
        'item_name', NEW.name,
        'current_quantity', NEW.quantity,
        'min_threshold', NEW.min_threshold,
        'unit', NEW.unit
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_stock_below_threshold ON public.stock_items;
CREATE TRIGGER trigger_notify_stock_below_threshold
AFTER INSERT OR UPDATE OF quantity ON public.stock_items
FOR EACH ROW
WHEN (NEW.quantity < NEW.min_threshold)
EXECUTE FUNCTION public.notify_stock_below_threshold();

-- ==================== 8c. ANALYTICS FUNCTION ====================
CREATE OR REPLACE FUNCTION public.get_hotel_analytics(p_hotel_id UUID)
RETURNS JSON AS $$
DECLARE
  v_total_rooms INT;
  v_occupied_rooms INT;
  v_occupancy_rate NUMERIC;
  v_total_revenue_month NUMERIC;
  v_total_revenue_year NUMERIC;
  v_pending_reservations INT;
  v_checked_in_reservations INT;
  v_adr NUMERIC;
  v_revpar NUMERIC;
  v_restaurant_revenue_month NUMERIC;
  v_conference_revenue_month NUMERIC;
BEGIN
  -- Total rooms
  SELECT COUNT(*) INTO v_total_rooms
  FROM public.rooms
  WHERE hotel_id = p_hotel_id;

  -- Occupied rooms
  SELECT COUNT(*) INTO v_occupied_rooms
  FROM public.rooms
  WHERE hotel_id = p_hotel_id AND status = 'occupied';

  -- Occupancy rate
  IF v_total_rooms > 0 THEN
    v_occupancy_rate := ROUND((v_occupied_rooms::NUMERIC / v_total_rooms::NUMERIC) * 100, 2);
  ELSE
    v_occupancy_rate := 0;
  END IF;

  -- Total revenue for current month (checked-out reservations)
  SELECT COALESCE(SUM(total_price), 0) INTO v_total_revenue_month
  FROM public.reservations
  WHERE hotel_id = p_hotel_id
    AND status IN ('checked_out', 'checked_in')
    AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);

  -- Total revenue for current year
  SELECT COALESCE(SUM(total_price), 0) INTO v_total_revenue_year
  FROM public.reservations
  WHERE hotel_id = p_hotel_id
    AND status IN ('checked_out', 'checked_in')
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);

  -- Pending reservations
  SELECT COUNT(*) INTO v_pending_reservations
  FROM public.reservations
  WHERE hotel_id = p_hotel_id AND status = 'pending';

  -- Checked-in reservations
  SELECT COUNT(*) INTO v_checked_in_reservations
  FROM public.reservations
  WHERE hotel_id = p_hotel_id AND status = 'checked_in';

  -- Average Daily Rate (ADR)
  SELECT COALESCE(AVG(total_price / GREATEST(EXTRACT(DAY FROM (check_out_date - check_in_date)), 1)), 0)
  INTO v_adr
  FROM public.reservations
  WHERE hotel_id = p_hotel_id
    AND status IN ('checked_out', 'checked_in')
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);

  -- RevPAR = ADR * Occupancy Rate / 100
  v_revpar := ROUND(v_adr * (v_occupancy_rate / 100.0), 2);

  -- Restaurant revenue for current month
  SELECT COALESCE(SUM(total_amount), 0) INTO v_restaurant_revenue_month
  FROM public.restaurant_orders
  WHERE hotel_id = p_hotel_id
    AND status = 'paid'
    AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);

  -- Conference revenue for current month
  SELECT COALESCE(SUM(total_price), 0) INTO v_conference_revenue_month
  FROM public.conference_bookings
  WHERE hotel_id = p_hotel_id
    AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);

  RETURN json_build_object(
    'total_rooms', v_total_rooms,
    'occupied_rooms', v_occupied_rooms,
    'occupancy_rate', v_occupancy_rate,
    'total_revenue_month', v_total_revenue_month,
    'total_revenue_year', v_total_revenue_year,
    'pending_reservations', v_pending_reservations,
    'checked_in_reservations', v_checked_in_reservations,
    'adr', v_adr,
    'revpar', v_revpar,
    'restaurant_revenue_month', v_restaurant_revenue_month,
    'conference_revenue_month', v_conference_revenue_month
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== 8d. SUPABASE REALTIME ENABLEMENT ====================
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;

-- =========================================================
-- INVOICES MODULE: Tables des Factures & Lignes de Facture
-- =========================================================

-- Enum for invoice status
DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('paid', 'refund', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum for payment method
DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('OM', 'MTN', 'Wave', 'Espèces', 'Chèque', 'Carte');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invoices table (immutable financial snapshot)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) NOT NULL,
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tourist_tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    vat NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL,
    payment_method public.payment_method NOT NULL,
    status public.invoice_status NOT NULL DEFAULT 'paid',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(hotel_id, invoice_number)
);

-- Invoice line items (detail of what's billed)
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    description VARCHAR(500) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(12, 2) NOT NULL,
    total NUMERIC(12, 2) NOT NULL,
    CONSTRAINT chk_invoice_item_qty CHECK (quantity > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_hotel_id ON public.invoices(hotel_id);
CREATE INDEX IF NOT EXISTS idx_invoices_reservation_id ON public.invoices(reservation_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);

-- Enable RLS on invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
DROP POLICY IF EXISTS "Users can read invoices of own hotel" ON public.invoices;
CREATE POLICY "Users can read invoices of own hotel"
ON public.invoices FOR SELECT
USING (
  hotel_id = (
    SELECT p.hotel_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert invoices for own hotel" ON public.invoices;
CREATE POLICY "Users can insert invoices for own hotel"
ON public.invoices FOR INSERT
WITH CHECK (
  hotel_id = (
    SELECT p.hotel_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- SECURITÉ: WITH CHECK empêche le déplacement d'une facture vers un autre hôtel
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

-- SECURITÉ: Politique DELETE manquante ajoutée
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

-- RLS Policies for invoice_items
DROP POLICY IF EXISTS "Users can read invoice items of own hotel" ON public.invoice_items;
CREATE POLICY "Users can read invoice items of own hotel"
ON public.invoice_items FOR SELECT
USING (
  invoice_id IN (
    SELECT i.id FROM public.invoices i
    WHERE i.hotel_id = (
      SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can insert invoice items for own hotel" ON public.invoice_items;
CREATE POLICY "Users can insert invoice items for own hotel"
ON public.invoice_items FOR INSERT
WITH CHECK (
  invoice_id IN (
    SELECT i.id FROM public.invoices i
    WHERE i.hotel_id = (
      SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  )
);

-- SECURITÉ: Politiques UPDATE et DELETE manquantes ajoutées
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

-- Add invoices to Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;

-- Trigger: Notify on new invoice
CREATE OR REPLACE FUNCTION public.notify_new_invoice()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (hotel_id, type, title, message, metadata)
  VALUES (
    NEW.hotel_id,
    'system',
    'Nouvelle facture émise',
    'La facture ' || NEW.invoice_number || ' d''un montant de ' || NEW.total_amount || ' FCFA a été créée.',
    jsonb_build_object(
      'invoice_id', NEW.id,
      'invoice_number', NEW.invoice_number,
      'total_amount', NEW.total_amount,
      'status', NEW.status,
      'payment_method', NEW.payment_method
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_new_invoice ON public.invoices;
CREATE TRIGGER trigger_notify_new_invoice
AFTER INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_invoice();`
