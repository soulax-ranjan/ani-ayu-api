-- Quick Test: Add multiple images to just a few products for immediate testing
-- Run this in your Supabase SQL Editor

-- Test with first few products only
UPDATE public.products SET 
  images = jsonb_build_array(
    COALESCE(image_url, 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp'),
    '/assets/designs/design-1.jpg',
    '/assets/designs/design-2.jpg',
    '/assets/designs/design-4.webp',
    '/assets/designs/design-5.webp'
  )
WHERE id IN (
  SELECT id FROM public.products LIMIT 5
);

-- Quick verification
SELECT 
  id,
  name,
  jsonb_array_length(images) as image_count,
  images
FROM public.products 
WHERE jsonb_array_length(images) > 1
LIMIT 5;