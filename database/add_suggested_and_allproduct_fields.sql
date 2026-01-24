-- Add suggested and allProduct fields to products table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS "suggested" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "allProduct" BOOLEAN DEFAULT false;

-- Create indexes for performance if these fields are used for filtering
CREATE INDEX IF NOT EXISTS idx_products_suggested ON public.products("suggested");
CREATE INDEX IF NOT EXISTS idx_products_allproduct ON public.products("allProduct");

-- Update the view if it exists (products_enhanced) to include these new columns
-- Note: Views often need to be dropped and recreated or explicitly updated to include new base table columns if 'SELECT *' isn't dynamic in the engine (Postgres views don't auto-update column list if * was used at creation time, usually). 
-- Safest is to explicitly replace the view.

CREATE OR REPLACE VIEW public.products_enhanced AS
SELECT 
  p.*,
  c.name as category_name,
  c.slug as category_slug,
  CASE 
    WHEN p.stock_quantity <= p.low_stock_threshold THEN true 
    ELSE false 
  END as is_low_stock,
  CASE 
    WHEN p.stock_quantity = 0 THEN false 
    ELSE p.in_stock 
  END as is_available,
  CASE 
    WHEN p.original_price IS NOT NULL AND p.original_price > p.price 
    THEN ROUND((p.original_price - p.price) / p.original_price * 100, 2)
    ELSE 0
  END as calculated_discount_percent
FROM public.products p
LEFT JOIN public.categories c ON p.category_id = c.id;

GRANT SELECT ON public.products_enhanced TO anon, authenticated;
