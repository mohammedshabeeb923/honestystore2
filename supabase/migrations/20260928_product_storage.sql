-- ============================================================
-- HONESTY STORE - MIGRATION: PRODUCT MANAGEMENT & SUPABASE STORAGE
-- Run in Supabase SQL Editor:
-- Dashboard > SQL Editor > New Query > Paste & Run
-- ============================================================

-- 1. EXTEND PRODUCTS TABLE WITH DESCRIPTION, SELLING PRICE & STORAGE PATH
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS selling_price NUMERIC(10, 2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Update any existing null selling_price to default to price
UPDATE public.products
SET selling_price = price
WHERE selling_price IS NULL;

-- 2. CREATE PRODUCT-IMAGES STORAGE BUCKET
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

-- 3. STORAGE ROW LEVEL SECURITY (RLS) POLICIES
-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy 1: Anyone (customers, mobile app, visitors) can view product images
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Policy 2: Only authenticated administrators can upload product images
DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
CREATE POLICY "Admins can upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images' 
  AND public.is_admin()
);

-- Policy 3: Only authenticated administrators can update/replace product images
DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
CREATE POLICY "Admins can update product images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images' 
  AND public.is_admin()
)
WITH CHECK (
  bucket_id = 'product-images' 
  AND public.is_admin()
);

-- Policy 4: Only authenticated administrators can delete product images
DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;
CREATE POLICY "Admins can delete product images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images' 
  AND public.is_admin()
);

-- 4. HELPER FUNCTION: CHECK IF PRODUCT HAS ORDERS (FOR SAFE DELETION)
CREATE OR REPLACE FUNCTION public.can_delete_product(p_product_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_orders BOOLEAN;
BEGIN
  -- Check if product exists in any JSON items array in orders
  SELECT EXISTS (
    SELECT 1 FROM public.orders,
    jsonb_array_elements(items) AS item
    WHERE item->>'id' = p_product_id
  ) INTO v_has_orders;

  -- Return true if no orders reference this product
  RETURN NOT v_has_orders;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
