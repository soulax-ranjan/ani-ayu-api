-- Migration: Add FIRSTBUY10 coupon
-- Run this in your Supabase SQL Editor

INSERT INTO coupons (
    code,
    description,
    discount_type,
    discount_value,
    max_discount_amount,
    min_order_amount,
    max_uses_per_user,
    valid_from,
    valid_until,
    is_active
) VALUES (
    'FIRSTBUY10',
    '10% off on your first purchase',
    'percentage',
    10,
    1000, -- Maximum discount of 1000 (Adjust if needed)
    0,    -- No minimum order amount (Adjust if needed)
    1,    -- Can only be used once per user
    NOW(),
    NOW() + INTERVAL '1 year', -- Valid for 1 year
    true
)
ON CONFLICT (code) DO UPDATE SET
    discount_type = EXCLUDED.discount_type,
    discount_value = EXCLUDED.discount_value,
    max_discount_amount = EXCLUDED.max_discount_amount,
    min_order_amount = EXCLUDED.min_order_amount,
    max_uses_per_user = EXCLUDED.max_uses_per_user,
    is_active = true;
