-- Add cart_snapshot field to orders table
-- This stores cart items for online payments until payment is verified

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS cart_snapshot JSONB;

COMMENT ON COLUMN public.orders.cart_snapshot IS 'Temporary storage of cart items for online payments, cleared after payment verification';
