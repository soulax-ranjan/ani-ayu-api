-- Enhanced Ani & Ayu E-commerce Database Schema
-- Run this in your Supabase SQL Editor to add new fields

-- Add new columns to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS sku VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS barcode VARCHAR(100),
ADD COLUMN IF NOT EXISTS short_description TEXT,
ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS brand VARCHAR(100),
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS shipping_weight DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS dimensions JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS return_policy TEXT,
ADD COLUMN IF NOT EXISTS warranty TEXT,
ADD COLUMN IF NOT EXISTS meta_title VARCHAR(200),
ADD COLUMN IF NOT EXISTS meta_description TEXT,
ADD COLUMN IF NOT EXISTS meta_keywords JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft', 'archived')),
ADD COLUMN IF NOT EXISTS customizable BOOLEAN DEFAULT false;

-- Update existing products to have SKUs if they don't
UPDATE public.products 
SET sku = CONCAT('AY-', UPPER(SUBSTRING(id::text, 1, 8)))
WHERE sku IS NULL;

-- Create additional indexes for new fields
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_stock_quantity ON public.products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_tags ON public.products USING GIN(tags);

-- Add some sample enhanced data
UPDATE public.products SET 
  short_description = CASE 
    WHEN LENGTH(description) > 100 THEN SUBSTRING(description, 1, 100) || '...'
    ELSE description
  END,
  brand = 'Ani & Ayu',
  tags = '["ethnic", "traditional", "kids", "festive"]'::jsonb,
  specifications = jsonb_build_object(
    'care_instructions', 'Hand wash or dry clean only',
    'fabric_composition', '100% Cotton',
    'country_of_origin', 'India',
    'closure_type', 'Buttons and ties'
  ),
  stock_quantity = FLOOR(RANDOM() * 50) + 10,
  low_stock_threshold = 5,
  shipping_weight = CASE 
    WHEN 'S' = ANY(ARRAY(SELECT jsonb_array_elements_text(sizes))) THEN 200
    WHEN 'M' = ANY(ARRAY(SELECT jsonb_array_elements_text(sizes))) THEN 250
    WHEN 'L' = ANY(ARRAY(SELECT jsonb_array_elements_text(sizes))) THEN 300
    ELSE 275
  END,
  dimensions = jsonb_build_object(
    'length', 50 + FLOOR(RANDOM() * 20),
    'width', 40 + FLOOR(RANDOM() * 15),
    'height', 2 + FLOOR(RANDOM() * 3),
    'unit', 'cm'
  ),
  return_policy = '30-day return policy. Items must be unworn and in original condition.',
  warranty = '6 months warranty against manufacturing defects',
  meta_title = name || ' - Traditional Kids Ethnic Wear | Ani & Ayu',
  meta_description = 'Shop ' || name || ' at Ani & Ayu. Premium quality traditional ethnic wear for kids. Fast shipping across India.',
  meta_keywords = '["kids ethnic wear", "traditional clothing", "festival wear", "indian kids fashion"]'::jsonb,
  customizable = CASE WHEN RANDOM() > 0.7 THEN true ELSE false END,
  discount_percent = CASE 
    WHEN original_price IS NOT NULL AND original_price > price 
    THEN ROUND((original_price - price) / original_price * 100, 2)
    ELSE 0
  END
WHERE id IS NOT NULL;

-- Create a view for enhanced product data with computed fields
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

-- Grant permissions for the view
GRANT SELECT ON public.products_enhanced TO anon, authenticated;

-- Create RLS policy for the view
CREATE POLICY "Enhanced products are viewable by everyone" ON public.products_enhanced
    FOR SELECT USING (true);