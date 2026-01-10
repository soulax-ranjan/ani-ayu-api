-- Update products with multiple images for testing the image gallery
-- This script replicates the current product image to create a multi-image gallery
-- Run this in your Supabase SQL Editor

-- Update ALL products to have multiple images by replicating their current image_url
-- and adding some design variations
UPDATE public.products SET 
  images = jsonb_build_array(
    image_url,  -- Keep the original image as first image
    -- Add some design variations
    CASE 
      WHEN RANDOM() > 0.5 THEN '/assets/designs/design-1.jpg'
      ELSE '/assets/designs/design-2.jpg'
    END,
    CASE 
      WHEN RANDOM() > 0.5 THEN '/assets/designs/design-4.webp'
      ELSE '/assets/designs/design-5.webp'
    END,
    -- Sometimes add a third variation
    CASE 
      WHEN RANDOM() > 0.7 THEN '/assets/designs/design-3.webp'
      ELSE image_url  -- Fallback to original image
    END
  )
WHERE image_url IS NOT NULL;

-- For products that might not have an image_url, ensure they have at least the designs
UPDATE public.products SET 
  images = jsonb_build_array(
    'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp',
    '/assets/designs/design-1.jpg',
    '/assets/designs/design-2.jpg'
  )
WHERE image_url IS NULL OR images IS NULL;

-- Alternative: Update specific products with their current image replicated
-- This ensures each product has 3-4 images including their original

-- Boys products
UPDATE public.products SET 
  images = jsonb_build_array(
    image_url,
    '/assets/designs/design-1.jpg',
    '/assets/designs/design-4.webp',
    image_url  -- Repeat original for demonstration
  )
WHERE category_id = '11111111-1111-1111-1111-111111111111'  -- Boys category
AND image_url IS NOT NULL;

-- Girls products  
UPDATE public.products SET 
  images = jsonb_build_array(
    image_url,
    '/assets/designs/design-2.jpg',
    '/assets/designs/design-5.webp',
    '/assets/designs/design-3.webp'
  )
WHERE category_id = '22222222-2222-2222-2222-222222222222'  -- Girls category
AND image_url IS NOT NULL;

-- Festive products
UPDATE public.products SET 
  images = jsonb_build_array(
    image_url,
    '/assets/designs/design-1.jpg',
    '/assets/designs/design-2.jpg',
    '/assets/designs/design-4.webp',
    '/assets/designs/design-5.webp'
  )
WHERE category_id = '33333333-3333-3333-3333-333333333333'  -- Festive category
AND image_url IS NOT NULL;

-- Verify the update - check which products now have multiple images
SELECT 
  id, 
  name, 
  image_url,
  jsonb_array_length(images) as image_count, 
  images 
FROM public.products 
WHERE jsonb_array_length(images) > 1
ORDER BY jsonb_array_length(images) DESC, name;

-- Count total products with multiple images
SELECT 
  COUNT(*) as total_products,
  COUNT(CASE WHEN jsonb_array_length(images) > 1 THEN 1 END) as products_with_multiple_images,
  ROUND(
    COUNT(CASE WHEN jsonb_array_length(images) > 1 THEN 1 END) * 100.0 / COUNT(*), 
    2
  ) as percentage_with_multiple_images
FROM public.products;