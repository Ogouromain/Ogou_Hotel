import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateSetupKey } from '@/lib/setup-auth'

/**
 * POST /api/setup/step7
 * Executes Step 7 database migrations:
 * 1. Create menu_items table (if not exists)
 * 2. Create stock transaction trigger (auto-deduct/add)
 * 3. Add indexes for new tables
 */
export async function POST(request: NextRequest) {
  const authError = validateSetupKey(request)
  if (authError) return authError

  try {
    const adminClient = createAdminClient()

    // 1. Check if menu_items table exists
    const { error: menuCheckError } = await adminClient
      .from('menu_items')
      .select('id')
      .limit(1)

    const menuTableExists = !menuCheckError || !menuCheckError.message.includes('does not exist')

    // 2. Check if conference_bookings table exists
    const { error: confCheckError } = await adminClient
      .from('conference_bookings')
      .select('id')
      .limit(1)

    const confBookingsExists = !confCheckError || !confCheckError.message.includes('does not exist')

    // 3. Check if stock_transactions table exists
    const { error: stockTransCheckError } = await adminClient
      .from('stock_transactions')
      .select('id')
      .limit(1)

    const stockTransTableExists = !stockTransCheckError || !stockTransCheckError.message.includes('does not exist')

    // Return the SQL that needs to be executed in Supabase SQL Editor
    const sqlCommands: string[] = []

    if (!menuTableExists) {
      sqlCommands.push(
        '-- 1. Table des Articles du Menu Restaurant',
        `CREATE TABLE public.menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'Autre',
    description TEXT,
    price NUMERIC(12, 2) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (hotel_id, name)
);`,
        'CREATE INDEX idx_menu_items_hotel_id ON public.menu_items(hotel_id);',
        'CREATE INDEX idx_menu_items_category ON public.menu_items(category);',
        '',
        '-- RLS pour menu_items',
        'ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;',
        '',
        `DROP POLICY IF EXISTS "Users can read menu items of own hotel" ON public.menu_items;`,
        `CREATE POLICY "Users can read menu items of own hotel" ON public.menu_items FOR SELECT USING (hotel_id = (SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()));`,
        '',
        `DROP POLICY IF EXISTS "Users can insert menu items for own hotel" ON public.menu_items;`,
        `CREATE POLICY "Users can insert menu items for own hotel" ON public.menu_items FOR INSERT WITH CHECK (hotel_id = (SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()));`,
        '',
        `DROP POLICY IF EXISTS "Users can update menu items of own hotel" ON public.menu_items;`,
        `CREATE POLICY "Users can update menu items of own hotel" ON public.menu_items FOR UPDATE USING (hotel_id = (SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid())) WITH CHECK (hotel_id = (SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()));`,
        '',
        `DROP POLICY IF EXISTS "Users can delete menu items of own hotel" ON public.menu_items;`,
        `CREATE POLICY "Users can delete menu items of own hotel" ON public.menu_items FOR DELETE USING (hotel_id = (SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()));`
      )
    } else {
      // Even if table exists, ensure RLS is enabled and policies are in place
      sqlCommands.push(
        '',
        '-- Sécurisation RLS pour menu_items (table existante)',
        'ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;',
        '',
        `DROP POLICY IF EXISTS "Users can read menu items of own hotel" ON public.menu_items;`,
        `CREATE POLICY "Users can read menu items of own hotel" ON public.menu_items FOR SELECT USING (hotel_id = (SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()));`,
        '',
        `DROP POLICY IF EXISTS "Users can insert menu items for own hotel" ON public.menu_items;`,
        `CREATE POLICY "Users can insert menu items for own hotel" ON public.menu_items FOR INSERT WITH CHECK (hotel_id = (SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()));`,
        '',
        `DROP POLICY IF EXISTS "Users can update menu items of own hotel" ON public.menu_items;`,
        `CREATE POLICY "Users can update menu items of own hotel" ON public.menu_items FOR UPDATE USING (hotel_id = (SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid())) WITH CHECK (hotel_id = (SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()));`,
        '',
        `DROP POLICY IF EXISTS "Users can delete menu items of own hotel" ON public.menu_items;`,
        `CREATE POLICY "Users can delete menu items of own hotel" ON public.menu_items FOR DELETE USING (hotel_id = (SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()));`
      )
    }

    // Always include the trigger (it uses CREATE OR REPLACE, so it's idempotent)
    sqlCommands.push(
      '',
      '-- 2. Trigger pour déduire automatiquement le stock lors d\'une transaction de sortie',
      `CREATE OR REPLACE FUNCTION public.process_stock_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type = 'out' THEN
        IF (SELECT quantity FROM public.stock_items WHERE id = NEW.stock_item_id) < NEW.quantity THEN
            RAISE EXCEPTION 'Quantité en stock insuffisante pour effectuer cette sortie.';
        END IF;
        UPDATE public.stock_items
        SET quantity = quantity - NEW.quantity
        WHERE id = NEW.stock_item_id;
    ELSIF NEW.type = 'in' THEN
        UPDATE public.stock_items
        SET quantity = quantity + NEW.quantity
        WHERE id = NEW.stock_item_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`,
      '',
      `DROP TRIGGER IF EXISTS trigger_process_stock_transaction ON public.stock_transactions;
CREATE TRIGGER trigger_process_stock_transaction
AFTER INSERT ON public.stock_transactions
FOR EACH ROW EXECUTE FUNCTION public.process_stock_transaction();`,
      '',
      '-- 3. Index pour les nouvelles tables',
      'CREATE INDEX IF NOT EXISTS idx_conference_bookings_hotel_id ON public.conference_bookings(hotel_id);',
      'CREATE INDEX IF NOT EXISTS idx_conference_bookings_room_id ON public.conference_bookings(conference_room_id);',
      'CREATE INDEX IF NOT EXISTS idx_restaurant_orders_hotel_id ON public.restaurant_orders(hotel_id);',
      'CREATE INDEX IF NOT EXISTS idx_stock_transactions_hotel_id ON public.stock_transactions(hotel_id);',
      'CREATE INDEX IF NOT EXISTS idx_stock_transactions_item_id ON public.stock_transactions(stock_item_id);'
    )

    return NextResponse.json({
      menu_table_exists: menuTableExists,
      conf_bookings_exists: confBookingsExists,
      stock_trans_table_exists: stockTransTableExists,
      sql_to_execute: sqlCommands.join('\n'),
      message: menuTableExists
        ? 'Étape 7 : Exécutez le SQL pour le trigger de stock dans le Supabase SQL Editor.'
        : 'Étape 7 : Exécutez le SQL complet (menu_items + trigger) dans le Supabase SQL Editor.',
    })
  } catch (error) {
    console.error('Step 7 setup error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

/**
 * GET /api/setup/step7
 * Check Step 7 setup status.
 */
export async function GET(request: NextRequest) {
  const authError = validateSetupKey(request)
  if (authError) return authError

  try {
    const adminClient = createAdminClient()

    const { error: menuCheckError } = await adminClient
      .from('menu_items')
      .select('id')
      .limit(1)

    const menuTableExists = !menuCheckError || !menuCheckError.message.includes('does not exist')

    const { error: stockCheckError } = await adminClient
      .from('stock_transactions')
      .select('id')
      .limit(1)

    const stockTransTableExists = !stockCheckError || !stockCheckError.message.includes('does not exist')

    const { error: confCheckError } = await adminClient
      .from('conference_bookings')
      .select('id')
      .limit(1)

    const confBookingsExists = !confCheckError || !confCheckError.message.includes('does not exist')

    return NextResponse.json({
      ready: menuTableExists && stockTransTableExists && confBookingsExists,
      menu_table_exists: menuTableExists,
      stock_transactions_exists: stockTransTableExists,
      conference_bookings_exists: confBookingsExists,
    })
  } catch (error) {
    console.error('Step 7 check error:', error)
    return NextResponse.json({ ready: false, error: String(error) }, { status: 500 })
  }
}
