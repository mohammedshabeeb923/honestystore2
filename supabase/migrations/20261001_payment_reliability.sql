-- ============================================================
-- HONESTY STORE - Payment Reliability Migration (Self-Healing)
-- Date: 2026-10-01
-- Purpose: Ensure all order columns exist, add paid_at timestamp, indexes, and atomic inventory
-- Run in: Supabase Dashboard > SQL Editor > New Query > Run
-- ============================================================

-- 1. Ensure all order tracking columns exist on public.orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_identifier TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10, 2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PENDING';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'PENDING';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'UPI';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'Cashfree';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cashfree_order_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cashfree_payment_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Add performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);

-- 3. Improved atomic inventory deduction with row locks and negative stock prevention
CREATE OR REPLACE FUNCTION public.deduct_inventory(p_items JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  v_item JSONB;
  v_prod_id TEXT;
  v_qty INT;
  v_curr_stock INT;
  v_updated_rows INT;
BEGIN
  -- Phase 1: Check all stock levels with row locks (prevents concurrent oversell)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := v_item->>'id';
    v_qty := GREATEST(1, COALESCE((v_item->>'qty')::INT, 1));
    
    SELECT stock INTO v_curr_stock 
    FROM public.products 
    WHERE id = v_prod_id 
    FOR UPDATE;  -- Row-level lock prevents concurrent reads

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found in catalog', v_prod_id;
    END IF;

    IF v_curr_stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for product % (Available: %, Requested: %)', 
        v_prod_id, v_curr_stock, v_qty;
    END IF;
  END LOOP;

  -- Phase 2: Atomically decrement stock for all items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := v_item->>'id';
    v_qty := GREATEST(1, COALESCE((v_item->>'qty')::INT, 1));

    UPDATE public.products
    SET 
      stock = GREATEST(0, stock - v_qty),
      physical_stock = GREATEST(0, physical_stock - v_qty),
      expected_stock = GREATEST(0, stock - v_qty),
      updated_at = NOW()
    WHERE id = v_prod_id
      AND stock >= v_qty;  -- Double-check: prevents negative stock even under race conditions
    
    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    IF v_updated_rows = 0 THEN
      RAISE EXCEPTION 'Stock deduction failed for product % - concurrent purchase may have exhausted stock', v_prod_id;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Permissions for deduct_inventory
GRANT EXECUTE ON FUNCTION public.deduct_inventory(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_inventory(JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.deduct_inventory(JSONB) TO authenticated;

-- 5. Helper function to find pending orders older than N minutes (for server reconciliation)
CREATE OR REPLACE FUNCTION public.get_stale_pending_orders(p_minutes_old INT DEFAULT 5)
RETURNS TABLE(
  id TEXT,
  order_number TEXT,
  amount NUMERIC,
  created_at TIMESTAMPTZ,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id, o.order_number, o.amount, o.created_at,
    o.customer_name, o.customer_email, o.customer_phone
  FROM public.orders o
  WHERE (o.status = 'PENDING' OR COALESCE(o.payment_status, 'PENDING') = 'PENDING')
    AND o.created_at < NOW() - MAKE_INTERVAL(mins => p_minutes_old)
  ORDER BY o.created_at ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_stale_pending_orders(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_stale_pending_orders(INT) TO anon;
