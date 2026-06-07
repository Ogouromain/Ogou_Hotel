-- =========================================================
-- OGOU_HÔTEL - Étape 8 + Invoices Module
-- Notifications, Analytics, Realtime & Factures
-- IDEMPOTENT: Peut être exécuté plusieurs fois sans erreur
-- =========================================================

-- ==================== 8a. NOTIFICATIONS TABLE ====================
DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM ('reservation', 'order', 'stock', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
);

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (
  hotel_id = (
    SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()
  )
  OR auth.uid() IS NULL  -- Allow triggers (system) to insert
);

-- ==================== 8b. AUTO-NOTIFICATION TRIGGERS ====================

-- Trigger: Notify on reservation status change
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

-- Trigger: Notify on restaurant order status change
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

-- Trigger: Notify on stock item below minimum threshold
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

DROP POLICY IF EXISTS "Users can update invoices of own hotel" ON public.invoices;
CREATE POLICY "Users can update invoices of own hotel"
ON public.invoices FOR UPDATE
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

-- Add invoices to Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;

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
EXECUTE FUNCTION public.notify_new_invoice();
