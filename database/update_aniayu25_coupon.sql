-- Migration: Rename FIRSTBUY25 to ANIAYU25
-- Run this in your Supabase SQL Editor

UPDATE coupons
SET code = 'ANIAYU25'
WHERE code = 'FIRSTBUY25';
