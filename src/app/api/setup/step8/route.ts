import { NextRequest, NextResponse } from 'next/server'
import { validateSetupKey } from '@/lib/setup-auth'

/**
 * GET /api/setup/step8
 *
 * Returns the Step 8 SQL migration that needs to be applied to the Supabase database
 * for: Notifications table, Auto-notification triggers, Analytics function, Realtime enablement.
 *
 * These must be run in the Supabase SQL Editor because the JS client cannot execute DDL.
 */
export async function GET(request: NextRequest) {
  const authError = validateSetupKey(request)
  if (authError) return authError
  const sql = `
-- =========================================================
-- HÔTELCI - Étape 8 : Notifications, Analytics & Temps Réel
-- IDEMPOTENT: Peut être exécuté plusieurs fois sans erreur
-- =========================================================

-- 1. Type de notification
DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM ('reservation', 'order', 'stock', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Table des Notifications
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_hotel_id ON public.notifications(hotel_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read notifications of own hotel" ON public.notifications;
CREATE POLICY "Users can read notifications of own hotel"
ON public.notifications FOR SELECT
USING (
  hotel_id = (
    SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert notifications for own hotel" ON public.notifications;
CREATE POLICY "Users can insert notifications for own hotel"
ON public.notifications FOR INSERT
WITH CHECK (
  hotel_id = (
    SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

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

DROP POLICY IF EXISTS "Users can delete notifications of own hotel" ON public.notifications;
CREATE POLICY "Users can delete notifications of own hotel"
ON public.notifications FOR DELETE
USING (
  hotel_id = (
    SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

-- 3. Trigger: Notification sur changement de réservation
CREATE OR REPLACE FUNCTION public.notify_reservation_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (hotel_id, type, title, message, metadata)
    VALUES (
      NEW.hotel_id, 'reservation',
      'Changement de statut de réservation',
      'La réservation ' || NEW.id || ' est passée de "' || OLD.status || '" à "' || NEW.status || '".',
      jsonb_build_object('reservation_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status, 'room_id', NEW.room_id, 'customer_id', NEW.customer_id)
    );
  END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (hotel_id, type, title, message, metadata)
    VALUES (
      NEW.hotel_id, 'reservation',
      'Nouvelle réservation',
      'Une nouvelle réservation a été créée avec le statut "' || NEW.status || '".',
      jsonb_build_object('reservation_id', NEW.id, 'status', NEW.status, 'room_id', NEW.room_id, 'customer_id', NEW.customer_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_reservation_status ON public.reservations;
CREATE TRIGGER trigger_notify_reservation_status
AFTER INSERT OR UPDATE OF status ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.notify_reservation_status_change();

-- 4. Trigger: Notification sur commande restaurant
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (hotel_id, type, title, message, metadata)
    VALUES (
      NEW.hotel_id, 'order',
      'Changement de statut de commande',
      'La commande ' || NEW.id || ' est passée de "' || OLD.status || '" à "' || NEW.status || '".',
      jsonb_build_object('order_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status, 'table_number', NEW.table_number, 'room_id', NEW.room_id)
    );
  END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (hotel_id, type, title, message, metadata)
    VALUES (
      NEW.hotel_id, 'order',
      'Nouvelle commande restaurant',
      'Une nouvelle commande a été créée avec le statut "' || NEW.status || '".',
      jsonb_build_object('order_id', NEW.id, 'status', NEW.status, 'table_number', NEW.table_number, 'room_id', NEW.room_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_order_status ON public.restaurant_orders;
CREATE TRIGGER trigger_notify_order_status
AFTER INSERT OR UPDATE OF status ON public.restaurant_orders
FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_change();

-- 5. Trigger: Alerte stock bas
CREATE OR REPLACE FUNCTION public.notify_stock_below_threshold()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity < NEW.min_threshold THEN
    INSERT INTO public.notifications (hotel_id, type, title, message, metadata)
    VALUES (
      NEW.hotel_id, 'stock',
      'Alerte de stock bas',
      'L''article "' || NEW.name || '" est en dessous du seuil minimum (quantité: ' || NEW.quantity || ', seuil: ' || NEW.min_threshold || ').',
      jsonb_build_object('stock_item_id', NEW.id, 'item_name', NEW.name, 'current_quantity', NEW.quantity, 'min_threshold', NEW.min_threshold, 'unit', NEW.unit)
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

-- 6. Fonction Analytique
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
  SELECT COUNT(*) INTO v_total_rooms FROM public.rooms WHERE hotel_id = p_hotel_id;
  SELECT COUNT(*) INTO v_occupied_rooms FROM public.rooms WHERE hotel_id = p_hotel_id AND status = 'occupied';

  IF v_total_rooms > 0 THEN
    v_occupancy_rate := ROUND((v_occupied_rooms::NUMERIC / v_total_rooms::NUMERIC) * 100, 2);
  ELSE
    v_occupancy_rate := 0;
  END IF;

  SELECT COALESCE(SUM(total_price), 0) INTO v_total_revenue_month
  FROM public.reservations
  WHERE hotel_id = p_hotel_id AND status IN ('checked_out', 'checked_in')
    AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);

  SELECT COALESCE(SUM(total_price), 0) INTO v_total_revenue_year
  FROM public.reservations
  WHERE hotel_id = p_hotel_id AND status IN ('checked_out', 'checked_in')
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);

  SELECT COUNT(*) INTO v_pending_reservations FROM public.reservations WHERE hotel_id = p_hotel_id AND status = 'pending';
  SELECT COUNT(*) INTO v_checked_in_reservations FROM public.reservations WHERE hotel_id = p_hotel_id AND status = 'checked_in';

  SELECT COALESCE(AVG(total_price / GREATEST(EXTRACT(DAY FROM (check_out_date - check_in_date)), 1)), 0)
  INTO v_adr
  FROM public.reservations
  WHERE hotel_id = p_hotel_id AND status IN ('checked_out', 'checked_in')
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);

  v_revpar := ROUND(v_adr * (v_occupancy_rate / 100.0), 2);

  SELECT COALESCE(SUM(total_amount), 0) INTO v_restaurant_revenue_month
  FROM public.restaurant_orders
  WHERE hotel_id = p_hotel_id AND status = 'paid'
    AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);

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

-- 7. Activation Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
`.trim()

  return NextResponse.json({
    message: 'Exécutez ce SQL dans le Supabase SQL Editor pour activer l\'Étape 8 (Notifications, Analytics, Temps Réel).',
    sqlEditorUrl: 'https://supabase.com/dashboard/project/rjgiktswlgfokztwuqup/sql',
    sql,
  })
}
