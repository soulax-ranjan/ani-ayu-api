-- Migration: Change ANIAYU25 to ANIAYU15 and update discount to 15%
-- Run this in your Supabase SQL Editor

UPDATE coupons
SET 
    code = 'ANIAYU15',
    discount_value = 15,
    description = '15% off' -- Optional: Update the description to match
WHERE code = 'ANIAYU25';
