-- Add fields to support best-sellers functionality
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS sales_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS best_seller_rank INTEGER;