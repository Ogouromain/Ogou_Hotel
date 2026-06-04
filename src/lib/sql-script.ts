export const INIT_SQL_SCRIPT = `-- =========================================================
-- HÔTELCI SaaS - Script d'initialisation Base de Données
-- Système de Gestion Hôtelière Multi-Tenant - Côte d'Ivoire
-- =========================================================

-- 1. Activation des extensions requises
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Création des Types Énumérés (Enums)
CREATE TYPE public.hotel_status AS ENUM ('active', 'suspended', 'inactive');
CREATE TYPE public.profile_status AS ENUM ('active', 'suspended');
CREATE TYPE public.user_role AS ENUM ('super_admin', 'owner', 'manager', 'receptionist', 'restaurant_staff', 'housekeeper');
CREATE TYPE public.subscription_status AS ENUM ('active', 'suspended', 'expired');
CREATE TYPE public.activation_code_status AS ENUM ('unused', 'used', 'expired');
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'paid', 'cancelled');
CREATE TYPE public.room_status AS ENUM ('available', 'occupied', 'cleaning', 'maintenance');
CREATE TYPE public.reservation_status AS ENUM ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled');
CREATE TYPE public.order_status AS ENUM ('pending', 'preparing', 'served', 'paid', 'cancelled');
CREATE TYPE public.stock_transaction_type AS ENUM ('in', 'out');

-- 3. Table des Hôtels
CREATE TABLE public.hotels (
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
CREATE TABLE public.profiles (
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
CREATE TABLE public.subscription_plans (
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
CREATE TABLE public.subscriptions (
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
CREATE TABLE public.activation_codes (
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
CREATE TABLE public.leads (
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
CREATE TABLE public.rooms (
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
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    identity_document_type VARCHAR(100),
    identity_document_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Table des Réservations
CREATE TABLE public.reservations (
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
CREATE TABLE public.conference_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    capacity INT NOT NULL,
    price_per_hour NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. Table des Réservations de Salles
CREATE TABLE public.conference_bookings (
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
CREATE TABLE public.restaurant_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    table_number VARCHAR(50),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status public.order_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. Détails des Commandes
CREATE TABLE public.restaurant_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.restaurant_orders(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    CONSTRAINT chk_qty CHECK (quantity > 0)
);

-- 16. Table des Articles en Stock
CREATE TABLE public.stock_items (
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
CREATE TABLE public.stock_transactions (
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
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==================== INDEX DE PERFORMANCE ====================
CREATE INDEX idx_profiles_hotel_id ON public.profiles(hotel_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_subscriptions_hotel_id ON public.subscriptions(hotel_id);
CREATE INDEX idx_activation_codes_code ON public.activation_codes(code);
CREATE INDEX idx_rooms_hotel_id ON public.rooms(hotel_id);
CREATE INDEX idx_rooms_status ON public.rooms(status);
CREATE INDEX idx_customers_hotel_id ON public.customers(hotel_id);
CREATE INDEX idx_reservations_hotel_id_dates ON public.reservations(hotel_id, check_in_date, check_out_date);
CREATE INDEX idx_stock_items_hotel_id ON public.stock_items(hotel_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

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
EXECUTE FUNCTION public.check_room_limits();`
