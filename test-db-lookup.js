import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY 
);

async function checkOrder() {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id, razorpay_order_id, status')
    .eq('razorpay_order_id', 'order_SMm5VmcxSvg2zl');
  
  console.log("DB lookup error?", error);
  console.log("Returned Data?", data);
}

checkOrder();
