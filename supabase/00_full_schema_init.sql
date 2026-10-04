-- ============================================================
-- HONESTY STORE 2 - Complete Production Database Initialization
-- Independent Production Instance
-- Run this ONCE in your new Supabase Project SQL Editor:
-- Dashboard > SQL Editor > New Query > Paste & Run
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    reference_name TEXT,
    variant TEXT,
    category TEXT DEFAULT 'Snacks',
    location_id TEXT DEFAULT 'main_store',
    price NUMERIC NOT NULL CHECK (price >= 0),
    purchase_price NUMERIC,
    selling_price NUMERIC,
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    expected_stock INT NOT NULL DEFAULT 0,
    physical_stock INT NOT NULL DEFAULT 0,
    low_stock_threshold INT DEFAULT 5,
    image_url TEXT,
    storage_path TEXT,
    is_active BOOLEAN DEFAULT true,
    is_available BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_location ON public.products(location_id);

-- 2. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_number TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    item_count INT DEFAULT 1,
    items JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'PENDING',
    payment_status TEXT DEFAULT 'PENDING',
    order_status TEXT DEFAULT 'PENDING',
    payment_method TEXT DEFAULT 'Cashfree UPI',
    payment_gateway TEXT DEFAULT 'Cashfree',
    payment_reference TEXT,
    cashfree_order_id TEXT,
    cashfree_payment_id TEXT,
    paid_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_phone_status ON public.orders(customer_phone, status);

-- 3. ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    product_name_snapshot TEXT NOT NULL,
    product_category_snapshot TEXT,
    unit_price NUMERIC NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    item_total NUMERIC NOT NULL,
    location_id TEXT DEFAULT 'main_store',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

-- 4. STOCK AUDITS TABLE
CREATE TABLE IF NOT EXISTS public.stock_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
    expected_units INT NOT NULL,
    physical_units INT NOT NULL,
    discrepancy INT NOT NULL,
    shrinkage_value NUMERIC NOT NULL DEFAULT 0,
    audit_note TEXT,
    audited_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_audits_product_id ON public.stock_audits(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_audits_created_at ON public.stock_audits(created_at DESC);

-- 5. COMMUNITY METRICS TABLE
CREATE TABLE IF NOT EXISTS public.community_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE UNIQUE DEFAULT CURRENT_DATE,
    sales_today NUMERIC DEFAULT 0,
    store_visits BIGINT DEFAULT 0,
    completed_payments BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. STORE VISITS TABLE
CREATE TABLE IF NOT EXISTS public.store_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id TEXT NOT NULL,
    session_id TEXT,
    visited_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_visits_visitor_id ON public.store_visits(visitor_id);
CREATE INDEX IF NOT EXISTS idx_store_visits_visited_at ON public.store_visits(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_visits_visitor_time ON public.store_visits(visitor_id, visited_at DESC);

-- 7. ADMIN USERS TABLE
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. HELPER FUNCTIONS

-- Admin verification function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE lower(email) = lower(auth.jwt() ->> 'email')
       OR (user_id IS NOT NULL AND user_id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Atomic inventory deduction with row locks (prevents oversell and race conditions)
CREATE OR REPLACE FUNCTION public.deduct_inventory(p_items JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  v_item JSONB;
  v_prod_id TEXT;
  v_qty INT;
  v_curr_stock INT;
  v_updated_rows INT;
BEGIN
  -- Phase 1: Lock rows and verify sufficient stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := v_item->>'id';
    v_qty := GREATEST(1, COALESCE((v_item->>'qty')::INT, 1));
    
    SELECT stock INTO v_curr_stock 
    FROM public.products 
    WHERE id = v_prod_id 
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found in catalog', v_prod_id;
    END IF;

    IF v_curr_stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for product % (Available: %, Requested: %)', 
        v_prod_id, v_curr_stock, v_qty;
    END IF;
  END LOOP;

  -- Phase 2: Decrement stock atomically
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
      AND stock >= v_qty;
    
    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    IF v_updated_rows = 0 THEN
      RAISE EXCEPTION 'Stock deduction failed for product % - concurrent purchase detected', v_prod_id;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 30-minute session debounced visit recording
CREATE OR REPLACE FUNCTION public.record_store_visit(p_visitor_id TEXT, p_session_id TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_last_visit TIMESTAMPTZ;
  v_recorded BOOLEAN := false;
  v_total_visits BIGINT;
  v_unique_visitors BIGINT;
  v_today_visits BIGINT;
BEGIN
  IF p_visitor_id IS NULL OR trim(p_visitor_id) = '' THEN
    RAISE EXCEPTION 'visitor_id is required';
  END IF;

  SELECT MAX(visited_at) INTO v_last_visit
  FROM public.store_visits
  WHERE visitor_id = p_visitor_id;

  IF v_last_visit IS NULL OR v_last_visit < (NOW() - INTERVAL '30 minutes') THEN
    INSERT INTO public.store_visits (visitor_id, session_id, visited_at)
    VALUES (p_visitor_id, p_session_id, NOW());
    v_recorded := true;

    BEGIN
      INSERT INTO public.community_metrics (date, store_visits, sales_today, completed_payments)
      VALUES (CURRENT_DATE, 1, 0, 0)
      ON CONFLICT (date) DO UPDATE
      SET store_visits = COALESCE(public.community_metrics.store_visits, 0) + 1;
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT visitor_id)
  INTO v_total_visits, v_unique_visitors
  FROM public.store_visits;

  SELECT COUNT(*)
  INTO v_today_visits
  FROM public.store_visits
  WHERE visited_at >= CURRENT_DATE;

  RETURN jsonb_build_object(
    'recorded', v_recorded,
    'total_visits', COALESCE(v_total_visits, 0),
    'unique_visitors', COALESCE(v_unique_visitors, 0),
    'today_visits', COALESCE(v_today_visits, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Visit metrics summary
CREATE OR REPLACE FUNCTION public.get_visit_metrics()
RETURNS JSONB AS $$
DECLARE
  v_total_visits BIGINT;
  v_unique_visitors BIGINT;
  v_today_visits BIGINT;
  v_today_uniques BIGINT;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT visitor_id)
  INTO v_total_visits, v_unique_visitors
  FROM public.store_visits;

  SELECT COUNT(*), COUNT(DISTINCT visitor_id)
  INTO v_today_visits, v_today_uniques
  FROM public.store_visits
  WHERE visited_at >= CURRENT_DATE;

  RETURN jsonb_build_object(
    'total_visits', COALESCE(v_total_visits, 0),
    'unique_visitors', COALESCE(v_unique_visitors, 0),
    'today_visits', COALESCE(v_today_visits, 0),
    'today_uniques', COALESCE(v_today_uniques, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reconcile pending orders helper
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
  WHERE (o.status = 'PENDING' OR o.payment_status = 'PENDING')
    AND o.created_at < NOW() - MAKE_INTERVAL(mins => p_minutes_old)
  ORDER BY o.created_at ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Permissions for stored functions
GRANT EXECUTE ON FUNCTION public.deduct_inventory(JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_store_visit(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_visit_metrics() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_stale_pending_orders(INT) TO service_role;

-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Products: Everyone can read active products; Admins/Service-role full control
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admin write products" ON public.products FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Orders: Authenticated or anonymous can create orders during checkout
CREATE POLICY "Public insert orders" ON public.orders FOR INSERT WITH CHECK (true);
-- Customers see only their own orders; Admins see all
CREATE POLICY "Customers view own orders" ON public.orders FOR SELECT USING (
  (auth.uid() IS NOT NULL AND user_id = auth.uid()) 
  OR public.is_admin()
);
CREATE POLICY "Admin update orders" ON public.orders FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Order Items
CREATE POLICY "Public insert order_items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "View order_items" ON public.order_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_items.order_id 
      AND ((auth.uid() IS NOT NULL AND o.user_id = auth.uid()) OR public.is_admin())
  )
);

-- Stock Audits
CREATE POLICY "Admins view audits" ON public.stock_audits FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins insert audits" ON public.stock_audits FOR INSERT WITH CHECK (public.is_admin());

-- Community Metrics
CREATE POLICY "Public read community_metrics" ON public.community_metrics FOR SELECT USING (true);
CREATE POLICY "Admin update community_metrics" ON public.community_metrics FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Store Visits
CREATE POLICY "Public insert store_visits" ON public.store_visits FOR INSERT WITH CHECK (true);
CREATE POLICY "Public view store_visits" ON public.store_visits FOR SELECT USING (true);

-- Admin Users
CREATE POLICY "Admins view admin_users" ON public.admin_users FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins manage admin_users" ON public.admin_users FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 10. STORAGE BUCKET FOR PRODUCT IMAGES
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
CREATE POLICY "Admins can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
CREATE POLICY "Admins can update product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;
CREATE POLICY "Admins can delete product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images');

-- 11. SUPABASE REALTIME CONFIGURATION
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_metrics') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_metrics;
  END IF;
END $$;

-- 12. CLEAN STARTER CATALOG SEED DATA
INSERT INTO public.products (id, name, reference_name, variant, category, price, purchase_price, selling_price, stock, expected_stock, physical_stock, low_stock_threshold, image_url, is_active, is_available, description)
VALUES
  ('lays', 'Lays', 'LAYS RS 5', 'Classic Potato Chips (₹5)', 'Chips', 5, 4.38, 5, 100, 100, 100, 10, 'assets/lays.jpg', true, true, 'Classic salted crispy potato chips.'),
  ('bournvita_biscuit', 'Bournvita Biscuit', 'BOURNVITA BISCUIT [10]', 'Malted Chocolate Cookies (₹10)', 'Biscuits', 10, 8.50, 10, 40, 40, 40, 5, 'assets/bournvita.jpg', true, true, 'Wholesome malted chocolate cookies.'),
  ('chocos', 'Chocos', 'CHOCOS RS 10', 'Chocolate Cereal Snack (₹10)', 'Biscuits', 10, 8.60, 10, 35, 35, 35, 5, 'assets/chocos.jpg', true, true, 'Crunchy chocolate flavoured snack.'),
  ('dailee_mango', 'Dailee Mango', 'DAILEE [MANGO 12]', 'Mango Drink (12 Pack)', 'Drinks', 10, 7.00, 10, 30, 30, 30, 5, 'assets/dailee_mango.jpg', true, true, 'Refreshing mango fruit juice drink.'),
  ('munch', 'Munch', 'MUNCH RS 10', 'Chocolate Coated Wafer Bar', 'Chocolates', 10, 8.50, 10, 50, 50, 50, 5, 'assets/munch.jpg', true, true, 'Crispy chocolate wafer bar.'),
  ('oreo', 'Oreo', 'OREO RS 10', 'Vanilla Creme Cookies (₹10)', 'Biscuits', 10, 8.86, 10, 45, 45, 45, 8, 'assets/oreo.jpg', true, true, 'Rich chocolate cookies with sweet vanilla creme.'),
  ('snickers', 'Snickers', 'SNICKERS [10]', 'Peanut & Caramel (₹10)', 'Chocolates', 10, 7.88, 10, 40, 40, 40, 5, 'assets/snickers.jpg', true, true, 'Caramel, nougat and peanuts wrapped in chocolate.')
ON CONFLICT (id) DO NOTHING;

-- Initialize Today's Community Metrics
INSERT INTO public.community_metrics (date, sales_today, store_visits, completed_payments)
VALUES (CURRENT_DATE, 0, 0, 0)
ON CONFLICT (date) DO NOTHING;
