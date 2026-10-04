-- ============================================================
-- HONESTY STORE - MASTER DATABASE MIGRATION & RLS CONFIGURATION
-- Run this script in your Supabase SQL Editor:
-- Supabase Dashboard > SQL Editor > New Query > Paste & Run
-- ============================================================

-- 1. SEED AUTHORIZED STORE ADMINISTRATORS
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.admin_users (email, role)
VALUES 
  ('godson107111@gmail.com', 'admin'),
  ('mohammedshabeeb923@gmail.com', 'admin'),
  ('shahidkkvl@gmail.com', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Link any existing auth accounts
UPDATE public.admin_users a
SET user_id = u.id
FROM auth.users u
WHERE LOWER(a.email) = LOWER(u.email) AND a.user_id IS NULL;

-- 2. ENSURE ALL PRODUCT COLUMNS EXIST
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10, 2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS selling_price NUMERIC(10, 2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reference_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 3. PRODUCTS TABLE POLICIES (Unrestricted for store operations)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public select products" ON public.products;
DROP POLICY IF EXISTS "Allow public insert products" ON public.products;
DROP POLICY IF EXISTS "Allow public update products" ON public.products;
DROP POLICY IF EXISTS "Allow public delete products" ON public.products;
DROP POLICY IF EXISTS "Allow update stock on products" ON public.products;
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;

CREATE POLICY "Allow public select products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public insert products" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update products" ON public.products FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete products" ON public.products FOR DELETE USING (true);

-- 4. ORDERS TABLE POLICIES (Full sync for customer and admin)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public select orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public insert orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public update orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can read own orders" ON public.orders;
DROP POLICY IF EXISTS "Service role or checkout can insert orders" ON public.orders;

CREATE POLICY "Allow public select orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update orders" ON public.orders FOR UPDATE USING (true) WITH CHECK (true);

-- 5. PROFILES TABLE POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Customers can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Customers can update own profile" ON public.profiles;

CREATE POLICY "Allow public select profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update profiles" ON public.profiles FOR UPDATE USING (true) WITH CHECK (true);

-- 6. STOCK AUDITS TABLE POLICIES
ALTER TABLE public.stock_audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public select stock_audits" ON public.stock_audits;
DROP POLICY IF EXISTS "Allow public insert stock_audits" ON public.stock_audits;

CREATE POLICY "Allow public select stock_audits" ON public.stock_audits FOR SELECT USING (true);
CREATE POLICY "Allow public insert stock_audits" ON public.stock_audits FOR INSERT WITH CHECK (true);

-- 7. COMMUNITY METRICS TABLE POLICIES
ALTER TABLE public.community_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public select community_metrics" ON public.community_metrics;
DROP POLICY IF EXISTS "Allow public insert community_metrics" ON public.community_metrics;
DROP POLICY IF EXISTS "Allow public update community_metrics" ON public.community_metrics;
DROP POLICY IF EXISTS "Allow public read community metrics" ON public.community_metrics;

CREATE POLICY "Allow public select community_metrics" ON public.community_metrics FOR SELECT USING (true);
CREATE POLICY "Allow public insert community_metrics" ON public.community_metrics FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update community_metrics" ON public.community_metrics FOR UPDATE USING (true) WITH CHECK (true);

-- 8. GRANT PERMISSIONS TO ROLES
GRANT ALL ON public.products TO anon, authenticated, service_role;
GRANT ALL ON public.orders TO anon, authenticated, service_role;
GRANT ALL ON public.profiles TO anon, authenticated, service_role;
GRANT ALL ON public.stock_audits TO anon, authenticated, service_role;
GRANT ALL ON public.community_metrics TO anon, authenticated, service_role;
GRANT ALL ON public.admin_users TO anon, authenticated, service_role;

-- 9. ENABLE REALTIME REPLICATION FOR LIVE MULTI-DEVICE SYNC
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
