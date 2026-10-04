-- ============================================================
-- HONESTY STORE MIGRATION: SALES TRACKING, ORDER ITEMS & DRINKS CATEGORY
-- Authoritative schema update for item-level snapshots, payment tracking,
-- and dedicated order_items table with performance indexes.
-- ============================================================

-- 1. Ensure public.orders has all required sales tracking columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_identifier TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10, 2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PENDING';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'PENDING';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Backfill existing orders with consistent values
UPDATE public.orders 
SET total_amount = COALESCE(total_amount, amount),
    subtotal = COALESCE(subtotal, amount),
    payment_status = COALESCE(payment_status, CASE WHEN status IN ('PAID', 'COMPLETED') THEN 'PAID' ELSE status END),
    order_status = COALESCE(order_status, status),
    payment_reference = COALESCE(payment_reference, cashfree_payment_id, cashfree_order_id, id),
    order_number = COALESCE(order_number, 'HS-' || LPAD(SUBSTRING(REGEXP_REPLACE(id, '\D', '', 'g') FROM 1 FOR 6), 6, '0'))
WHERE total_amount IS NULL OR order_number IS NULL OR payment_status IS NULL;

-- 3. Dedicated ORDER_ITEMS table for item-level analytics & immutable price snapshots
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    product_name_snapshot TEXT NOT NULL,
    product_category_snapshot TEXT NOT NULL DEFAULT 'Chips',
    unit_price NUMERIC(10, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    item_total NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Update Dailee Mango / Beverages to Drinks category
UPDATE public.products 
SET category = 'Drinks', updated_at = NOW() 
WHERE id = 'dailee_mango' OR category = 'Beverages';

-- 5. Backfill order_items from historical orders JSONB items
INSERT INTO public.order_items (
    order_id, 
    product_id, 
    product_name_snapshot, 
    product_category_snapshot, 
    unit_price, 
    quantity, 
    item_total, 
    created_at
)
SELECT 
    o.id AS order_id,
    COALESCE(item->>'id', item->>'product_id', 'unknown') AS product_id,
    COALESCE(item->>'name', item->>'product_name_snapshot', 'Item') AS product_name_snapshot,
    CASE 
        WHEN LOWER(COALESCE(item->>'category', item->>'product_category_snapshot', '')) IN ('drinks', 'beverages', 'drink', 'beverage') THEN 'Drinks'
        WHEN LOWER(COALESCE(item->>'category', item->>'product_category_snapshot', '')) IN ('biscuits', 'biscuit') THEN 'Biscuits'
        WHEN LOWER(COALESCE(item->>'category', item->>'product_category_snapshot', '')) IN ('chocolates', 'chocolate') THEN 'Chocolates'
        ELSE COALESCE(item->>'category', item->>'product_category_snapshot', 'Chips')
    END AS product_category_snapshot,
    COALESCE((item->>'unit_price')::NUMERIC, (item->>'price')::NUMERIC, 0.00) AS unit_price,
    GREATEST(1, COALESCE((item->>'quantity')::INT, (item->>'qty')::INT, 1)) AS quantity,
    COALESCE(
        (item->>'item_total')::NUMERIC, 
        (COALESCE((item->>'unit_price')::NUMERIC, (item->>'price')::NUMERIC, 0.00) * GREATEST(1, COALESCE((item->>'quantity')::INT, (item->>'qty')::INT, 1)))
    ) AS item_total,
    o.created_at
FROM public.orders o,
LATERAL jsonb_array_elements(
    CASE 
        WHEN jsonb_typeof(o.items) = 'array' THEN o.items 
        ELSE '[]'::jsonb 
    END
) AS item
WHERE NOT EXISTS (
    SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id
);

-- 6. Performance indexes for fast querying, filtering, and reporting
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_category ON public.order_items(product_category_snapshot);
CREATE INDEX IF NOT EXISTS idx_order_items_created_at ON public.order_items(created_at);

-- 7. Row Level Security for order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own order_items" ON public.order_items;
CREATE POLICY "Users can view own order_items" 
ON public.order_items FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE public.orders.id = public.order_items.order_id 
      AND (public.orders.user_id = auth.uid() OR public.is_admin())
  )
);

DROP POLICY IF EXISTS "Admins can manage order_items" ON public.order_items;
CREATE POLICY "Admins can manage order_items" 
ON public.order_items FOR ALL 
TO authenticated 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "System can insert order_items" ON public.order_items;
CREATE POLICY "System can insert order_items" 
ON public.order_items FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE public.orders.id = public.order_items.order_id 
      AND (public.orders.user_id = auth.uid() OR public.is_admin())
  )
);
