-- ============================================================
-- HONESTY STORE: INITIAL PRODUCT MASTER MIGRATION (Item #27-#40)
-- Based on physical packing slip:
-- Gross: ₹1,914.38 | Adjusted: ₹0.12 | Net: ₹1,914.50
-- ============================================================

-- 1. Ensure all columns exist on public.products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10, 2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS selling_price NUMERIC(10, 2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reference_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Upsert Initial Product Master Records (No duplicate creation, updates matching IDs)
INSERT INTO public.products (
  id,
  name,
  reference_name,
  variant,
  category,
  price,
  purchase_price,
  selling_price,
  stock,
  expected_stock,
  physical_stock,
  low_stock_threshold,
  image_url,
  is_active,
  is_available,
  description,
  updated_at
)
VALUES
  (
    'lays',
    'Lays',
    'LAYS RS 5',
    'Classic Potato Chips (₹5)',
    'Chips',
    5.00,
    4.38,
    5.00,
    110,
    110,
    110,
    10,
    'assets/lays.png',
    true,
    true,
    'Classic salted crispy potato chips. Reference packing slip: LAYS RS 5 @ ₹4.38',
    NOW()
  ),
  (
    'dailee_mango',
    'Dailee Mango',
    'DAILEE [MANGO 12]',
    'Mango Drink (12 Pack)',
    'Beverages',
    10.00,
    7.00,
    10.00,
    22,
    22,
    22,
    5,
    'assets/dailee_mango.svg',
    true,
    true,
    'Refreshing mango fruit juice drink. Reference packing slip: DAILEE [MANGO 12] @ ₹7.00',
    NOW()
  ),
  (
    'oreo',
    'Oreo',
    'OREO RS 10',
    'Vanilla Creme Sandwich Cookies (₹10)',
    'Biscuits',
    10.00,
    8.86,
    10.00,
    44,
    44,
    44,
    8,
    'assets/oreo.png',
    true,
    true,
    'Rich chocolate cookies with sweet vanilla creme. Reference packing slip: OREO RS 10 @ ₹8.86',
    NOW()
  ),
  (
    'munch',
    'Munch',
    'MUNCH RS 10 [BOX]',
    'Chocolate Coated Wafer Box',
    'Chocolates',
    209.00,
    209.00,
    NULL, -- Requires Admin Input for single pack vs box selling price
    1,
    1,
    1,
    1,
    'assets/munch.svg',
    true,
    true,
    'Crispy chocolate wafer box. Reference packing slip: MUNCH RS 10 [BOX] @ ₹209.00. Selling price requires admin confirmation.',
    NOW()
  ),
  (
    'snickers',
    'Snickers',
    'SNICKERS [10] 40PES',
    'Peanut & Caramel Chocolate (₹10)',
    'Chocolates',
    10.00,
    7.88,
    10.00,
    58,
    58,
    58,
    10,
    'assets/snickers.svg',
    true,
    true,
    'Milk chocolate bar packed with roasted peanuts and soft caramel. Reference packing slip: SNICKERS [10] 40PES @ ₹7.88',
    NOW()
  ),
  (
    'bournvita_biscuit',
    'Bournvita Biscuit',
    'BOURNVITA BISCUIT [10]',
    'Malted Chocolate Cookies (₹10)',
    'Biscuits',
    10.00,
    8.50,
    10.00,
    9,
    9,
    9,
    4,
    'assets/bournvita.svg',
    true,
    true,
    'Wholesome malted chocolate cookies. Reference packing slip: BOURNVITA BISCUIT [10] @ ₹8.50',
    NOW()
  ),
  (
    'chocos',
    'Chocos',
    'CHOCOS RS 10',
    'Chocolatey Cereal Snack (₹10)',
    'Snacks',
    10.00,
    8.60,
    10.00,
    17,
    17,
    17,
    5,
    'assets/chocos.svg',
    true,
    true,
    'Crunchy chocolate flavoured snack. Reference packing slip: CHOCOS RS 10 @ ₹8.60',
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  reference_name = EXCLUDED.reference_name,
  variant = EXCLUDED.variant,
  category = EXCLUDED.category,
  price = EXCLUDED.price,
  purchase_price = EXCLUDED.purchase_price,
  selling_price = COALESCE(public.products.selling_price, EXCLUDED.selling_price),
  stock = EXCLUDED.stock,
  expected_stock = EXCLUDED.expected_stock,
  physical_stock = EXCLUDED.physical_stock,
  low_stock_threshold = EXCLUDED.low_stock_threshold,
  image_url = COALESCE(public.products.image_url, EXCLUDED.image_url),
  is_active = true,
  is_available = true,
  description = EXCLUDED.description,
  updated_at = NOW();
