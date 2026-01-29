-- Add missing payment-related columns to orders table
-- Run this in Supabase SQL Editor

-- 1. Add payment_method column
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) 
DEFAULT 'cod' 
CHECK (payment_method IN ('cod', 'card', 'upi', 'netbanking', 'wallet'));

-- 2. Add razorpay_order_id column
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100);

-- 3. Add cart_snapshot column (if not already added)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS cart_snapshot JSONB;

-- 4. Add index for razorpay_order_id
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order 
ON public.orders(razorpay_order_id);

-- 5. Add comments
COMMENT ON COLUMN public.orders.payment_method IS 'Payment method used: cod, card, upi, netbanking, wallet';
COMMENT ON COLUMN public.orders.razorpay_order_id IS 'Razorpay order ID for quick reference';
COMMENT ON COLUMN public.orders.cart_snapshot IS 'Temporary storage of cart items for online payments, cleared after payment verification';

-- 6. Reload schema cache
NOTIFY pgrst, 'reload schema';

-- 7. Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('payment_method', 'razorpay_order_id', 'cart_snapshot')
ORDER BY column_name;
