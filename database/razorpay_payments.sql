-- Razorpay Payments Table Migration
-- Run this in your Supabase SQL Editor

-- Create Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    
    -- Razorpay IDs
    razorpay_order_id VARCHAR(100) UNIQUE NOT NULL,
    razorpay_payment_id VARCHAR(100) UNIQUE,
    razorpay_signature VARCHAR(255),
    
    -- Payment Details
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'captured', 'failed', 'refunded')),
    method VARCHAR(50), -- card, netbanking, upi, wallet, etc.
    
    -- Additional Razorpay Data
    razorpay_data JSONB, -- Store complete Razorpay response
    error_code VARCHAR(100),
    error_description TEXT,
    error_source VARCHAR(100),
    error_step VARCHAR(100),
    error_reason VARCHAR(255),
    
    -- Refund Information
    refund_id VARCHAR(100),
    refund_amount DECIMAL(10,2),
    refund_status VARCHAR(20),
    refunded_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    authorized_at TIMESTAMP WITH TIME ZONE,
    captured_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE
);

-- Create Webhook Events Table (for tracking all Razorpay webhooks)
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id VARCHAR(100) UNIQUE NOT NULL, -- Razorpay event ID
    event_type VARCHAR(100) NOT NULL, -- payment.captured, payment.failed, etc.
    entity_type VARCHAR(50) NOT NULL, -- payment, order, refund, etc.
    entity_id VARCHAR(100) NOT NULL, -- Razorpay entity ID
    
    -- Webhook Data
    payload JSONB NOT NULL, -- Complete webhook payload
    signature VARCHAR(255) NOT NULL,
    verified BOOLEAN DEFAULT false,
    
    -- Processing Status
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order ON public.payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment ON public.payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_entity_id ON public.webhook_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events(created_at);

-- Enable Row Level Security
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Payments
-- Users can only view payments for their own orders
CREATE POLICY "Users can view own payments" ON public.payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders 
            WHERE orders.id = payments.order_id 
            AND (orders.user_id = auth.uid() OR orders.session_id IS NOT NULL)
        )
    );

-- Only service role can insert/update payments (backend only)
CREATE POLICY "Service role can manage payments" ON public.payments
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for Webhook Events
-- Only service role can access webhook events
CREATE POLICY "Service role can manage webhook events" ON public.webhook_events
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create updated_at trigger for payments
CREATE TRIGGER handle_payments_updated_at BEFORE UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_webhook_events_updated_at BEFORE UPDATE ON public.webhook_events
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add payment_method to orders table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'payment_method'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN payment_method VARCHAR(20) DEFAULT 'cod' 
        CHECK (payment_method IN ('cod', 'card', 'upi', 'netbanking', 'wallet'));
    END IF;
END $$;

-- Add razorpay_order_id to orders table for quick reference
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'razorpay_order_id'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN razorpay_order_id VARCHAR(100);
        
        CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order ON public.orders(razorpay_order_id);
    END IF;
END $$;

COMMENT ON TABLE public.payments IS 'Stores all payment transactions from Razorpay';
COMMENT ON TABLE public.webhook_events IS 'Logs all webhook events received from Razorpay for audit and debugging';
