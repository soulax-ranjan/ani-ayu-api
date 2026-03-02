-- Coupon/Promo Code System
-- Run this in Supabase SQL Editor

-- Create Coupons Table
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Coupon Details
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    
    -- Discount Configuration
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
    max_discount_amount DECIMAL(10,2), -- For percentage discounts, cap the max discount
    
    -- Usage Limits
    min_order_amount DECIMAL(10,2) DEFAULT 0,
    max_uses INTEGER, -- NULL means unlimited
    max_uses_per_user INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    
    -- Validity Period
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Applicable Products/Categories (NULL means all)
    applicable_categories JSONB, -- Array of category IDs
    applicable_products JSONB, -- Array of product IDs
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Coupon Usage Tracking Table
CREATE TABLE IF NOT EXISTS public.coupon_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coupon_id UUID REFERENCES public.coupons(id) ON DELETE CASCADE NOT NULL,
    
    -- User Information
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    guest_id VARCHAR(100),
    
    -- Order Information
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    
    -- Discount Applied
    discount_amount DECIMAL(10,2) NOT NULL,
    order_amount DECIMAL(10,2) NOT NULL,
    
    -- Timestamps
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure user can't use same coupon multiple times (if restricted)
    UNIQUE(coupon_id, user_id),
    UNIQUE(coupon_id, guest_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_valid_from ON public.coupons(valid_from);
CREATE INDEX IF NOT EXISTS idx_coupons_valid_until ON public.coupons(valid_until);

CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon ON public.coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user ON public.coupon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_guest ON public.coupon_usage(guest_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_order ON public.coupon_usage(order_id);

-- Enable Row Level Security
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Coupons
-- Everyone can view active coupons
CREATE POLICY "Active coupons are viewable by everyone" ON public.coupons
    FOR SELECT USING (is_active = true);

-- Only service role can manage coupons
CREATE POLICY "Service role can manage coupons" ON public.coupons
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for Coupon Usage
-- Users can view their own coupon usage
CREATE POLICY "Users can view own coupon usage" ON public.coupon_usage
    FOR SELECT USING (
        auth.uid() = user_id OR 
        guest_id IS NOT NULL
    );

-- Service role can manage all coupon usage
CREATE POLICY "Service role can manage coupon usage" ON public.coupon_usage
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create updated_at trigger
CREATE TRIGGER handle_coupons_updated_at BEFORE UPDATE ON public.coupons
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add discount_amount and coupon_code to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;

-- Create index for coupon_code in orders
CREATE INDEX IF NOT EXISTS idx_orders_coupon_code ON public.orders(coupon_code);

-- Insert sample coupons
INSERT INTO public.coupons (code, description, discount_type, discount_value, max_discount_amount, min_order_amount, max_uses, valid_until) VALUES
('WELCOME10', 'Welcome discount - 10% off', 'percentage', 10, 500, 1000, NULL, NOW() + INTERVAL '30 days'),
('FLAT200', 'Flat ₹200 off on orders above ₹2000', 'fixed', 200, NULL, 2000, NULL, NOW() + INTERVAL '30 days'),
('FIRST500', 'First order - ₹500 off', 'fixed', 500, NULL, 2000, 1000, NOW() + INTERVAL '30 days'),
('SAVE20', '20% off - Max ₹1000 discount', 'percentage', 20, 1000, 1500, NULL, NOW() + INTERVAL '30 days')
ON CONFLICT (code) DO NOTHING;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE public.coupons IS 'Stores coupon/promo codes with discount rules';
COMMENT ON TABLE public.coupon_usage IS 'Tracks coupon usage by users';
