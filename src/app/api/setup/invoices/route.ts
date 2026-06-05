import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const INVOICES_SQL = `
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
`

/**
 * GET /api/setup/invoices
 * Check if the invoices module tables exist and are properly configured.
 */
export async function GET() {
  try {
    const adminClient = createAdminClient()

    if (!adminClient) {
      return NextResponse.json({
        ready: false,
        error: 'Supabase admin client not configured',
      }, { status: 500 })
    }

    // Check if invoices table exists
    const { error: invoicesError } = await adminClient
      .from('invoices')
      .select('id')
      .limit(1)

    const invoicesTableExists = !invoicesError || invoicesError.code !== 'PGRST205'

    // Check if invoice_items table exists
    const { error: itemsError } = await adminClient
      .from('invoice_items')
      .select('id')
      .limit(1)

    const invoiceItemsTableExists = !itemsError || itemsError.code !== 'PGRST205'

    // If both tables exist, check for invoice_status enum by trying to query with it
    let enumsExist = false
    if (invoicesTableExists) {
      // Try to insert a test query that uses the enum - if it works, enums exist
      const { error: enumError } = await adminClient
        .from('invoices')
        .select('status')
        .limit(1)
      enumsExist = !enumError || !enumError.message?.includes('does not exist')
    }

    const ready = invoicesTableExists && invoiceItemsTableExists && enumsExist

    return NextResponse.json({
      ready,
      invoices_table_exists: invoicesTableExists,
      invoice_items_table_exists: invoiceItemsTableExists,
      enums_exist: enumsExist,
      sql_editor_url: 'https://supabase.com/dashboard/project/rjgiktswlgfokztwuqup/sql/new',
      sql: !ready ? INVOICES_SQL.trim() : null,
      message: ready
        ? 'Invoices module is already configured ✓'
        : 'Invoices tables not found. Execute the SQL in the Supabase SQL Editor to set up the invoices module.',
    })
  } catch (error) {
    console.error('Invoices setup check error:', error)
    return NextResponse.json({ ready: false, error: String(error) }, { status: 500 })
  }
}

/**
 * POST /api/setup/invoices
 * Execute the invoices module SQL using the pg library.
 * Requires the database password to be provided in the request body.
 * 
 * Body: { db_password: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const dbPassword = body.db_password

    if (!dbPassword) {
      return NextResponse.json({
        error: 'Database password required. Provide db_password in the request body.',
        hint: 'You can find your database password in the Supabase Dashboard: Project Settings > Database > Connection string',
        sql_editor_url: 'https://supabase.com/dashboard/project/rjgiktswlgfokztwuqup/sql/new',
        sql: INVOICES_SQL.trim(),
      }, { status: 400 })
    }

    // Use pg library to connect and execute SQL
    const { Client } = await import('pg')
    
    // Try the pooler connection (IPv4 accessible)
    const connectionString = `postgresql://postgres.rjgiktswlgfokztwuqup:${encodeURIComponent(dbPassword)}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`
    
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    })

    await client.connect()

    // Execute the invoices SQL
    await client.query(INVOICES_SQL)

    // Verify the tables were created
    const { rows: invoiceCheck } = await client.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices')"
    )
    const { rows: itemsCheck } = await client.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoice_items')"
    )

    await client.end()

    const invoicesCreated = invoiceCheck[0]?.exists || false
    const itemsCreated = itemsCheck[0]?.exists || false

    return NextResponse.json({
      success: invoicesCreated && itemsCreated,
      invoices_table_created: invoicesCreated,
      invoice_items_table_created: itemsCreated,
      message: invoicesCreated && itemsCreated
        ? 'Invoices module SQL executed successfully ✓'
        : 'SQL executed but tables may not have been created correctly.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Invoices setup execute error:', error)
    
    // Provide helpful error messages
    if (message.includes('not found')) {
      return NextResponse.json({
        error: 'Could not connect to the database. The pooler did not recognize the project. Please verify your database password.',
        hint: 'You can also execute the SQL manually in the Supabase SQL Editor.',
        sql_editor_url: 'https://supabase.com/dashboard/project/rjgiktswlgfokztwuqup/sql/new',
        sql: INVOICES_SQL.trim(),
      }, { status: 500 })
    }

    if (message.includes('ENETUNREACH') || message.includes('ECONNREFUSED')) {
      return NextResponse.json({
        error: 'Could not reach the database server. Network connection blocked.',
        hint: 'Please execute the SQL manually in the Supabase SQL Editor.',
        sql_editor_url: 'https://supabase.com/dashboard/project/rjgiktswlgfokztwuqup/sql/new',
        sql: INVOICES_SQL.trim(),
      }, { status: 500 })
    }

    return NextResponse.json({
      error: `Database execution error: ${message}`,
      hint: 'You can also execute the SQL manually in the Supabase SQL Editor.',
      sql_editor_url: 'https://supabase.com/dashboard/project/rjgiktswlgfokztwuqup/sql/new',
      sql: INVOICES_SQL.trim(),
    }, { status: 500 })
  }
}
