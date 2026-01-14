
-- Add section column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS section INTEGER DEFAULT 0;
