-- ============================================================
-- OGOU_Hôtel — Expenses Module Migration
-- ============================================================
-- Creates: expense_categories, expenses tables + RLS policies
-- ============================================================

-- ─── Expense Categories ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'operating'
    CHECK (type IN ('operating', 'payroll', 'maintenance', 'supply', 'utility', 'marketing', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(hotel_id, name)
);

-- ─── Expenses ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT
    CHECK (payment_method IS NULL OR payment_method IN ('OM', 'MTN', 'Wave', 'Espèces', 'Chèque', 'Carte', 'Virement')),
  receipt_url TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_expenses_hotel_id ON public.expenses(hotel_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expense_categories_hotel_id ON public.expense_categories(hotel_id);

-- ─── RLS Policies ───────────────────────────────────────────
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Expense categories: hotel members can read, owner/manager can write
CREATE POLICY "expense_categories_read" ON public.expense_categories
  FOR SELECT USING (
    hotel_id IN (
      SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "expense_categories_write" ON public.expense_categories
  FOR ALL USING (
    hotel_id IN (
      SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('owner', 'manager')
    )
  );

-- Expenses: hotel members can read, owner/manager can write
CREATE POLICY "expenses_read" ON public.expenses
  FOR SELECT USING (
    hotel_id IN (
      SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "expenses_write" ON public.expenses
  FOR ALL USING (
    hotel_id IN (
      SELECT p.hotel_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('owner', 'manager')
    )
  );

-- ─── Auto-update updated_at trigger ─────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS expenses_updated_at ON public.expenses;
CREATE TRIGGER expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Seed default expense categories for existing hotels ─────
-- (will be created per hotel when the owner first visits the tab)
