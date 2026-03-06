import 'dotenv/config'
import { supabaseAdmin } from '../src/lib/supabase.js'

async function addCoupon() {
    try {
        const coupon = {
            code: 'FIRSTBUY25',
            description: '25% discount on your first order',
            discount_type: 'percentage',
            discount_value: 25,
            min_order_amount: 0,
            // max_discount_amount: null,
            max_uses_per_user: 999999,
            is_active: true
        }

        const { data, error } = await supabaseAdmin
            .from('coupons')
            .insert([coupon])
            .select()

        if (error) {
            console.error('Error inserting coupon:', error)
            if (error.code === '23505') { // Unique constraint violation
                console.log('Coupon already exists. Updating it instead...')
                const { data: updateData, error: updateError } = await supabaseAdmin
                    .from('coupons')
                    .update(coupon)
                    .eq('code', 'FIRSTBUY25')
                    .select()
                if (updateError) {
                    console.error('Error updating:', updateError)
                } else {
                    console.log('Successfully updated coupon:', updateData)
                }
            }
        } else {
            console.log('Successfully added coupon:', data)
        }
    } catch (err) {
        console.error('Exception:', err)
    }
}

addCoupon()
