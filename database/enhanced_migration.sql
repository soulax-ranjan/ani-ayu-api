-- Enhanced Ani & Ayu E-commerce Database Schema Migration
-- Run this in your Supabase SQL Editor

-- First, add new columns to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS sku VARCHAR(100),
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
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS customizable BOOLEAN DEFAULT false;

-- Add constraints after columns are created
ALTER TABLE public.products 
ADD CONSTRAINT IF NOT EXISTS products_sku_unique UNIQUE (sku),
ADD CONSTRAINT IF NOT EXISTS products_status_check CHECK (status IN ('active', 'inactive', 'draft', 'archived'));

-- Generate SKUs for existing products
UPDATE public.products 
SET sku = CONCAT('AY-', UPPER(SUBSTRING(id::text, 1, 8)))
WHERE sku IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_stock_quantity ON public.products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_tags ON public.products USING GIN(tags);

-- Update existing products with enhanced data
UPDATE public.products SET 
  short_description = CASE 
    WHEN LENGTH(description) > 100 THEN SUBSTRING(description, 1, 97) || '...'
    ELSE description
  END,
  brand = 'Ani & Ayu',
  tags = CASE 
    WHEN name ILIKE '%kurta%' THEN '["kurta", "ethnic", "traditional", "kids", "festival"]'::jsonb
    WHEN name ILIKE '%dress%' THEN '["dress", "ethnic", "traditional", "kids", "party"]'::jsonb
    WHEN name ILIKE '%set%' THEN '["set", "ethnic", "traditional", "kids", "complete-outfit"]'::jsonb
    WHEN name ILIKE '%dhoti%' THEN '["dhoti", "ethnic", "traditional", "boys", "festival"]'::jsonb
    WHEN name ILIKE '%lehenga%' THEN '["lehenga", "ethnic", "traditional", "girls", "festival"]'::jsonb
    ELSE '["ethnic", "traditional", "kids", "festive"]'::jsonb
  END,
  specifications = jsonb_build_object(
    'care_instructions', 'Hand wash or dry clean only',
    'fabric_composition', CASE 
      WHEN material = 'Cotton' THEN '100% Cotton'
      WHEN material = 'Silk' THEN '100% Pure Silk'
      WHEN material = 'Cotton Blend' THEN '60% Cotton, 40% Polyester'
      ELSE '100% Cotton'
    END,
    'country_of_origin', 'India',
    'closure_type', CASE 
      WHEN name ILIKE '%kurta%' THEN 'Buttons and ties'
      WHEN name ILIKE '%dress%' THEN 'Side zip'
      WHEN name ILIKE '%dhoti%' THEN 'Elastic waist'
      ELSE 'Buttons and ties'
    END,
    'wash_care', 'Gentle machine wash or hand wash',
    'occasion_suitable', occasion
  ),
  stock_quantity = CASE 
    WHEN RANDOM() < 0.1 THEN 0  -- 10% out of stock
    WHEN RANDOM() < 0.2 THEN FLOOR(RANDOM() * 5) + 1  -- 10% low stock (1-5)
    ELSE FLOOR(RANDOM() * 45) + 10  -- 80% normal stock (10-55)
  END,
  low_stock_threshold = 5,
  shipping_weight = CASE 
    WHEN 'XS' = ANY(ARRAY(SELECT jsonb_array_elements_text(sizes))) THEN 150 + FLOOR(RANDOM() * 50)
    WHEN 'S' = ANY(ARRAY(SELECT jsonb_array_elements_text(sizes))) THEN 200 + FLOOR(RANDOM() * 50)
    WHEN 'M' = ANY(ARRAY(SELECT jsonb_array_elements_text(sizes))) THEN 250 + FLOOR(RANDOM() * 50)
    WHEN 'L' = ANY(ARRAY(SELECT jsonb_array_elements_text(sizes))) THEN 300 + FLOOR(RANDOM() * 50)
    WHEN 'XL' = ANY(ARRAY(SELECT jsonb_array_elements_text(sizes))) THEN 350 + FLOOR(RANDOM() * 50)
    ELSE 275 + FLOOR(RANDOM() * 50)
  END,
  dimensions = jsonb_build_object(
    'length', CASE 
      WHEN age_range LIKE '%0-2%' THEN 35 + FLOOR(RANDOM() * 10)
      WHEN age_range LIKE '%2-4%' THEN 40 + FLOOR(RANDOM() * 10)
      WHEN age_range LIKE '%4-6%' THEN 45 + FLOOR(RANDOM() * 10)
      WHEN age_range LIKE '%6-8%' THEN 50 + FLOOR(RANDOM() * 10)
      WHEN age_range LIKE '%8-10%' THEN 55 + FLOOR(RANDOM() * 10)
      WHEN age_range LIKE '%10-12%' THEN 60 + FLOOR(RANDOM() * 10)
      ELSE 50 + FLOOR(RANDOM() * 20)
    END,
    'width', 35 + FLOOR(RANDOM() * 15),
    'height', 2 + FLOOR(RANDOM() * 3),
    'unit', 'cm'
  ),
  return_policy = '30-day hassle-free return policy. Items must be unworn, unwashed, and in original condition with tags attached.',
  warranty = '6 months warranty against manufacturing defects. Does not cover normal wear and tear.',
  meta_title = name || ' - Premium Kids Ethnic Wear | Ani & Ayu',
  meta_description = 'Shop ' || name || ' at Ani & Ayu. Premium quality traditional ethnic wear for kids aged ' || age_range || '. Fast shipping across India. ' || material || ' fabric.',
  meta_keywords = CASE 
    WHEN name ILIKE '%kurta%' THEN '["kids kurta", "boys ethnic wear", "traditional kurta", "festival wear", "indian kids fashion"]'::jsonb
    WHEN name ILIKE '%dress%' THEN '["kids ethnic dress", "girls traditional dress", "party wear", "festival dress", "indian kids fashion"]'::jsonb
    WHEN name ILIKE '%lehenga%' THEN '["kids lehenga", "girls lehenga", "festival lehenga", "traditional wear", "indian kids fashion"]'::jsonb
    WHEN name ILIKE '%dhoti%' THEN '["kids dhoti", "boys dhoti", "traditional dhoti", "festival wear", "indian kids fashion"]'::jsonb
    ELSE '["kids ethnic wear", "traditional clothing", "festival wear", "indian kids fashion", "premium quality"]'::jsonb
  END,
  customizable = CASE 
    WHEN RANDOM() > 0.7 THEN true 
    ELSE false 
  END,
  discount_percent = CASE 
    WHEN original_price IS NOT NULL AND original_price > price 
    THEN ROUND(((original_price - price) / original_price * 100)::numeric, 2)
    ELSE 0
  END,
  barcode = CONCAT('890', LPAD(FLOOR(RANDOM() * 9999999)::text, 7, '0'), LPAD(FLOOR(RANDOM() * 99)::text, 2, '0'))
WHERE id IS NOT NULL;

-- Create enhanced view with computed fields
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
    THEN ROUND(((p.original_price - p.price) / p.original_price * 100)::numeric, 2)
    ELSE p.discount_percent
  END as calculated_discount_percent,
  CASE 
    WHEN p.stock_quantity = 0 THEN 'out_of_stock'
    WHEN p.stock_quantity <= p.low_stock_threshold THEN 'low_stock'
    ELSE 'in_stock'
  END as stock_status
FROM public.products p
LEFT JOIN public.categories c ON p.category_id = c.id;

-- Grant permissions
GRANT SELECT ON public.products_enhanced TO anon, authenticated;

-- Update RLS policies
DROP POLICY IF EXISTS "Enhanced products are viewable by everyone" ON public.products_enhanced;
CREATE POLICY "Enhanced products are viewable by everyone" 
ON public.products_enhanced FOR SELECT USING (true);

-- Create function to update discount percentage automatically
CREATE OR REPLACE FUNCTION update_discount_percent()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.original_price IS NOT NULL AND NEW.original_price > NEW.price THEN
    NEW.discount_percent = ROUND(((NEW.original_price - NEW.price) / NEW.original_price * 100)::numeric, 2);
  ELSE
    NEW.discount_percent = 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update discount percentage
DROP TRIGGER IF EXISTS trigger_update_discount_percent ON public.products;
CREATE TRIGGER trigger_update_discount_percent
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION update_discount_percent();

-- Verify the migration
SELECT 
  COUNT(*) as total_products,
  COUNT(CASE WHEN sku IS NOT NULL THEN 1 END) as products_with_sku,
  COUNT(CASE WHEN stock_quantity > 0 THEN 1 END) as in_stock_products,
  COUNT(CASE WHEN customizable = true THEN 1 END) as customizable_products,
  AVG(stock_quantity) as avg_stock_quantity
FROM public.products;