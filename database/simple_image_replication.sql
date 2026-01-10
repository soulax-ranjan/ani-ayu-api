-- Simple script to replicate current product images for gallery testing
-- Run this in your Supabase SQL Editor

-- Method 1: Update all products to have their current image + design assets
UPDATE public.products SET 
  images = jsonb_build_array(
    COALESCE(image_url, 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp'),
    '/assets/designs/design-1.jpg',
    '/assets/designs/design-2.jpg',
    '/assets/designs/design-4.webp'
  )
WHERE images IS NULL OR jsonb_array_length(images) <= 1;

-- Method 2: For products that already have some images, enhance them
UPDATE public.products SET
  images = CASE 
    WHEN jsonb_array_length(images) = 1 THEN 
      images || '"/assets/designs/design-1.jpg"'::jsonb || '"/assets/designs/design-2.jpg"'::jsonb
    ELSE images
  END
WHERE jsonb_array_length(images) = 1;

-- Verify the changes
SELECT 
  id,
  name,
  image_url,
  jsonb_array_length(images) as total_images,
  images->0 as first_image,
  images->1 as second_image,
  images->2 as third_image
FROM public.products
ORDER BY jsonb_array_length(images) DESC, name
LIMIT 10;

-- Show summary
SELECT 
  jsonb_array_length(images) as image_count,
  COUNT(*) as product_count
FROM public.products
GROUP BY jsonb_array_length(images)
ORDER BY image_count;