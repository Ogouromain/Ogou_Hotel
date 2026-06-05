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
