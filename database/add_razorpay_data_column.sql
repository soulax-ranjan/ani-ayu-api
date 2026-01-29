-- Complete payments table migration - Add all missing columns
-- Run this in Supabase SQL Editor

-- Add razorpay_data column (stores complete Razorpay response)
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS razorpay_data JSONB;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

-- Verify column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments' 
AND column_name = 'razorpay_data';
