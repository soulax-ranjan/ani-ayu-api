-- Add size_chart column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS size_chart JSONB DEFAULT '{}'::jsonb;

-- Create index for performance (just in case we query by it later)
CREATE INDEX IF NOT EXISTS idx_products_size_chart ON public.products USING GIN(size_chart);

-- Update the view to include the new column
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
