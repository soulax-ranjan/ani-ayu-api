-- Migration: Add 'out_of_stock' to products status check constraint
-- Run this in your Supabase SQL Editor

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_status_check;

ALTER TABLE products
  ADD CONSTRAINT products_status_check
  CHECK (status IN ('active', 'inactive', 'draft', 'archived', 'out_of_stock'));
