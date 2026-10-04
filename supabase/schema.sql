-- ============================================================
-- HONESTY STORE - AUTHORITATIVE PRODUCTION DATABASE SCHEMA
-- Full Google OAuth, Strict Row-Level Security (RLS), Realtime, and Atomic Inventory
-- Run this script in: Supabase Dashboard > SQL Editor > New Query > Run
-- ============================================================

-- 1. ADMIN USERS TABLE (Server/Database Authority for Admin Role)
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed authorized store admin emails
INSERT INTO public.admin_users (email, role)
VALUES 
  ('godson107111@gmail.com', 'admin'),
  ('mohammedshabeeb923@gmail.com', 'admin'),
  ('shahidkkvl@gmail.com', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Helper function: Checks if authenticated caller has admin privileges
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE (auth.uid() IS NOT NULL AND user_id = auth.uid())
       OR (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. CUSTOMER PROFILES TABLE (Linked directly to auth.users.id)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    role TEXT DEFAULT 'customer',
    trust_score NUMERIC(5, 2) DEFAULT 100.00,
    total_orders INTEGER DEFAULT 0,
    total_spent NUMERIC(10, 2) DEFAULT 0.00,
    pledge_signed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist if table was previously created with older schema
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';
ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;

-- Trigger: Automatically create/update profile when user signs in with Google
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT := 'customer';
BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE LOWER(email) = LOWER(NEW.email)) THEN
    v_role := 'admin';
    UPDATE public.admin_users SET user_id = NEW.id WHERE LOWER(email) = LOWER(NEW.email);
  END IF;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    v_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    role = CASE WHEN v_role = 'admin' THEN 'admin' ELSE public.profiles.role END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    variant TEXT,
    category TEXT NOT NULL DEFAULT 'Chips',
    price NUMERIC(10, 2) NOT NULL,
    selling_price NUMERIC(10, 2),
    stock INTEGER DEFAULT 0,
    expected_stock INTEGER DEFAULT 0,
    physical_stock INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    image_url TEXT,
    storage_path TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS selling_price NUMERIC(10, 2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4. ORDERS TABLE (Strictly linked to auth.users.id)
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_number TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_phone TEXT,
    customer_email TEXT,
    customer_name TEXT,
    customer_identifier TEXT,
    amount NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2),
    discount NUMERIC(10, 2) DEFAULT 0.00,
    total_amount NUMERIC(10, 2),
    item_count INTEGER NOT NULL,
    items JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'FAILED', 'CANCELLED'
    payment_status TEXT DEFAULT 'PENDING',
    payment_method TEXT DEFAULT 'UPI',
    payment_gateway TEXT DEFAULT 'Cashfree',
    payment_reference TEXT,
    cashfree_order_id TEXT,
    cashfree_payment_id TEXT,
    order_status TEXT DEFAULT 'PENDING',
    time_label TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure user_id, customer_email, customer_name, and updated_at exist
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_identifier TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10, 2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PENDING';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'PENDING';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.orders ALTER COLUMN customer_phone DROP NOT NULL;

-- 4b. ORDER ITEMS TABLE (Immutable price & name snapshot for accurate historical reporting)
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

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_category ON public.order_items(product_category_snapshot);
CREATE INDEX IF NOT EXISTS idx_order_items_created_at ON public.order_items(created_at);

-- 5. STOCK AUDIT LOGS (Reconciliation History)
CREATE TABLE IF NOT EXISTS public.stock_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
    expected_units INTEGER NOT NULL,
    physical_units INTEGER NOT NULL,
    discrepancy INTEGER NOT NULL,
    shrinkage_value NUMERIC(10, 2) NOT NULL,
    audit_note TEXT,
    audited_by TEXT DEFAULT 'Admin',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. COMMUNITY METRICS TABLE
CREATE TABLE IF NOT EXISTS public.community_metrics (
    date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
    sales_today NUMERIC(10, 2) DEFAULT 0.00,
    store_visits INTEGER DEFAULT 0,
    completed_payments INTEGER DEFAULT 0,
    pledges_count INTEGER DEFAULT 0
);

-- 7. ATOMIC INVENTORY DEDUCTION (RPC FUNCTION)
-- Prevents race conditions, double deduction, and negative stock
CREATE OR REPLACE FUNCTION public.deduct_inventory(p_items JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  v_item JSONB;
  v_prod_id TEXT;
  v_qty INT;
  v_curr_stock INT;
BEGIN
  -- 1. Check stock with row locks
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
      RAISE EXCEPTION 'Insufficient stock for product % (Available: %, Requested: %)', v_prod_id, v_curr_stock, v_qty;
    END IF;
  END LOOP;

  -- 2. Decrement stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := v_item->>'id';
    v_qty := GREATEST(1, COALESCE((v_item->>'qty')::INT, 1));

    UPDATE public.products
    SET stock = stock - v_qty,
        physical_stock = GREATEST(0, physical_stock - v_qty),
        expected_stock = stock - v_qty,
        updated_at = NOW()
    WHERE id = v_prod_id;
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. STRICT ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_metrics ENABLE ROW LEVEL SECURITY;

-- 8A. ADMIN USERS TABLE POLICIES
DROP POLICY IF EXISTS "Admins can view admin_users" ON public.admin_users;
CREATE POLICY "Admins can view admin_users" 
ON public.admin_users FOR SELECT 
TO authenticated 
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage admin_users" ON public.admin_users;
CREATE POLICY "Admins can manage admin_users" 
ON public.admin_users FOR ALL 
TO authenticated 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

-- 8B. ORDERS TABLE POLICIES (STRICT PER-USER ISOLATION)
-- Drop all legacy open policies
DROP POLICY IF EXISTS "Allow public select orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public insert orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public update orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can read own orders" ON public.orders;
DROP POLICY IF EXISTS "Service role or checkout can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;

-- Customer can ONLY view their own orders; Admins can view all orders
CREATE POLICY "Users can view own orders" 
ON public.orders FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id OR public.is_admin());

-- Customer can ONLY insert orders with their own auth.uid()
CREATE POLICY "Users can create own orders" 
ON public.orders FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Only Admins can update orders
CREATE POLICY "Admins can update orders" 
ON public.orders FOR UPDATE 
TO authenticated 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

-- Only Admins can delete orders
CREATE POLICY "Admins can delete orders" 
ON public.orders FOR DELETE 
TO authenticated 
USING (public.is_admin());

-- 8C. PRODUCTS TABLE POLICIES (PUBLIC VIEW, ADMIN WRITE)
DROP POLICY IF EXISTS "Allow public select products" ON public.products;
DROP POLICY IF EXISTS "Allow public insert products" ON public.products;
DROP POLICY IF EXISTS "Allow public update products" ON public.products;
DROP POLICY IF EXISTS "Allow update stock on products" ON public.products;
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;

-- Public can view active products; Admins can view all
CREATE POLICY "Anyone can view active products" 
ON public.products FOR SELECT 
USING (is_active = true OR public.is_admin());

CREATE POLICY "Admins can insert products" 
ON public.products FOR INSERT 
TO authenticated 
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update products" 
ON public.products FOR UPDATE 
TO authenticated 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete products" 
ON public.products FOR DELETE 
TO authenticated 
USING (public.is_admin());

-- 8D. PROFILES TABLE POLICIES
DROP POLICY IF EXISTS "Allow public select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Customers can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Customers can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id AND role IS NOT DISTINCT FROM (SELECT role FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update any profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

-- 8E. STOCK AUDITS POLICIES
DROP POLICY IF EXISTS "Allow public select stock_audits" ON public.stock_audits;
DROP POLICY IF EXISTS "Allow public insert stock_audits" ON public.stock_audits;
DROP POLICY IF EXISTS "Admins can view stock audits" ON public.stock_audits;
DROP POLICY IF EXISTS "Admins can insert stock audits" ON public.stock_audits;

CREATE POLICY "Admins can view stock audits" 
ON public.stock_audits FOR SELECT 
TO authenticated 
USING (public.is_admin());

CREATE POLICY "Admins can insert stock audits" 
ON public.stock_audits FOR INSERT 
TO authenticated 
WITH CHECK (public.is_admin());

-- 8F. COMMUNITY METRICS POLICIES
DROP POLICY IF EXISTS "Allow public select community_metrics" ON public.community_metrics;
DROP POLICY IF EXISTS "Allow public insert community_metrics" ON public.community_metrics;
DROP POLICY IF EXISTS "Allow public update community_metrics" ON public.community_metrics;
DROP POLICY IF EXISTS "Allow public read community metrics" ON public.community_metrics;
DROP POLICY IF EXISTS "Public read community metrics" ON public.community_metrics;
DROP POLICY IF EXISTS "Admins can update community metrics" ON public.community_metrics;

CREATE POLICY "Public read community metrics" 
ON public.community_metrics FOR SELECT 
USING (true);

CREATE POLICY "Admins can update community metrics" 
ON public.community_metrics FOR ALL 
TO authenticated 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

-- ============================================================
-- 9. ENABLE SUPABASE REALTIME
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'products'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'community_metrics'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.community_metrics;
    END IF;
END $$;

-- 10. ENSURE CORE PRODUCTS ARE SEEDED
INSERT INTO public.products (id, name, variant, category, price, stock, expected_stock, physical_stock, image_url, low_stock_threshold, is_active)
VALUES 
    ('upitest', '₹1 Live UPI Test', 'Gateway Verification Item', 'Chips', 1.00, 99, 99, 99, 'assets/lays.png', 5, true),
    ('lays', 'Lays', 'Classic Potato Chips', 'Chips', 20.00, 18, 18, 15, 'assets/lays.png', 5, true),
    ('oreo', 'Oreo', 'Chocolate Sandwich Cookies', 'Biscuits', 30.00, 3, 3, 3, 'assets/oreo.png', 5, true),
    ('parleg', 'Parle-G', 'Glucose Biscuits', 'Biscuits', 10.00, 25, 25, 25, 'assets/parleg.png', 5, true),
    ('dairymilk', 'Dairy Milk', 'Milk Chocolate Bar', 'Chocolates', 20.00, 0, 0, 0, 'assets/dairymilk.png', 3, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    image_url = EXCLUDED.image_url,
    is_active = true;

-- 11. SUPABASE STORAGE BUCKET: product-images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

-- 12. STORAGE ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
CREATE POLICY "Admins can upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
CREATE POLICY "Admins can update product images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND public.is_admin())
WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;
CREATE POLICY "Admins can delete product images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND public.is_admin());

-- 13. SAFE PRODUCT DELETION HELPER
CREATE OR REPLACE FUNCTION public.can_delete_product(p_product_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_orders BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.orders,
    jsonb_array_elements(items) AS item
    WHERE item->>'id' = p_product_id
  ) INTO v_has_orders;

  RETURN NOT v_has_orders;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

