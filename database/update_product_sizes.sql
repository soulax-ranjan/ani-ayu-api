-- Update all products with age-based sizes
-- Run this in Supabase SQL Editor

-- Update all products to have the age-based sizes
UPDATE public.products
SET sizes = '["2-3 Years", "4-5 Years", "6-7 Years", "8-9 Years", "10-12 Years", "13-14 Years"]'::jsonb
WHERE sizes IS NULL OR sizes = '[]'::jsonb OR sizes = 'null'::jsonb;

-- If you want to update ALL products regardless of existing sizes:
-- UPDATE public.products
-- SET sizes = '["2-3 Years", "4-5 Years", "6-7 Years", "8-9 Years", "10-12 Years", "13-14 Years"]'::jsonb;

-- Verify the update
SELECT id, name, sizes 
FROM public.products 
LIMIT 10;

-- Count products with sizes
SELECT 
  COUNT(*) as total_products,
  COUNT(CASE WHEN sizes IS NOT NULL AND sizes != '[]'::jsonb THEN 1 END) as products_with_sizes
FROM public.products;
