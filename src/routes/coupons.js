import fp from 'fastify-plugin'
import { supabaseAdmin, TABLES, handleSupabaseError } from '../lib/supabase.js'

async function couponRoutes(fastify, options) {
    const { z } = await import('zod')

    const verifyCouponSchema = z.object({
        code: z.string().min(1).max(50),
        orderAmount: z.number().positive()
    })

    // POST /coupons/verify - Verify and calculate discount for a coupon
    fastify.post('/coupons/verify', {
        preHandler: [fastify.authenticateOptional],
        schema: {
            tags: ['Coupons'],
            description: 'Verify a coupon code and calculate discount',
            body: {
                type: 'object',
                required: ['code', 'orderAmount'],
                properties: {
                    code: { type: 'string', description: 'Coupon code to verify' },
                    orderAmount: { type: 'number', description: 'Total order amount before discount' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        valid: { type: 'boolean' },
                        coupon: { type: 'object', additionalProperties: true },
                        discount: { type: 'number' },
                        finalAmount: { type: 'number' },
                        message: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { code, orderAmount } = verifyCouponSchema.parse(request.body)
            const userId = request.user?.sub
            const guestId = request.headers['x-guest-id']

            if (!userId && !guestId) {
                return reply.status(400).send({
                    valid: false,
                    error: 'No session found',
                    message: 'Please provide user session'
                })
            }

            // 1. Fetch coupon
            const { data: coupon, error: couponError } = await supabaseAdmin
                .from('coupons')
                .select('*')
                .eq('code', code.toUpperCase())
                .eq('is_active', true)
                .single()

            if (couponError || !coupon) {
                return {
                    valid: false,
                    message: 'Invalid coupon code'
                }
            }

            // 2. Check validity period
            const now = new Date()
            const validFrom = new Date(coupon.valid_from)
            const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null

            if (now < validFrom) {
                return {
                    valid: false,
                    message: 'Coupon is not yet valid'
                }
            }

            if (validUntil && now > validUntil) {
                return {
                    valid: false,
                    message: 'Coupon has expired'
                }
            }

            // 3. Check minimum order amount
            if (orderAmount < coupon.min_order_amount) {
                return {
                    valid: false,
                    message: `Minimum order amount is ₹${coupon.min_order_amount}`
                }
            }

            // 4. Check total usage limit
            if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
                return {
                    valid: false,
                    message: 'Coupon usage limit reached'
                }
            }

            // 5. Check per-user usage limit
            let usageQuery = supabaseAdmin
                .from('coupon_usage')
                .select('id', { count: 'exact', head: true })
                .eq('coupon_id', coupon.id)

            if (userId) {
                usageQuery = usageQuery.eq('user_id', userId)
            } else {
                usageQuery = usageQuery.eq('guest_id', guestId)
            }

            const { count: userUsageCount } = await usageQuery

            if (userUsageCount >= coupon.max_uses_per_user) {
                return {
                    valid: false,
                    message: 'You have already used this coupon'
                }
            }

            // 6. Calculate discount
            let discountAmount = 0

            if (coupon.discount_type === 'percentage') {
                discountAmount = (orderAmount * coupon.discount_value) / 100

                // Apply max discount cap if set
                if (coupon.max_discount_amount && discountAmount > coupon.max_discount_amount) {
                    discountAmount = coupon.max_discount_amount
                }
            } else if (coupon.discount_type === 'fixed') {
                discountAmount = coupon.discount_value
            }

            // Ensure discount doesn't exceed order amount
            if (discountAmount > orderAmount) {
                discountAmount = orderAmount
            }

            const finalAmount = orderAmount - discountAmount

            // 7. Return success response
            return {
                valid: true,
                coupon: {
                    id: coupon.id,
                    code: coupon.code,
                    description: coupon.description,
                    discount_type: coupon.discount_type,
                    discount_value: coupon.discount_value
                },
                discount: Math.round(discountAmount * 100) / 100,
                finalAmount: Math.round(finalAmount * 100) / 100,
                message: `Coupon applied! You saved ₹${Math.round(discountAmount)}`
            }

        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.status(400).send({
                    valid: false,
                    error: 'Validation Error',
                    message: 'Invalid request data',
                    details: error.errors
                })
            }
            console.error('Coupon verification error:', error)
            return reply.status(500).send({
                valid: false,
                error: 'Internal Server Error',
                message: 'Failed to verify coupon'
            })
        }
    })

    // GET /coupons - Get all active coupons (optional, for displaying available coupons)
    fastify.get('/coupons', {
        schema: {
            tags: ['Coupons'],
            description: 'Get all active coupons',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        coupons: {
                            type: 'array',
                            items: { type: 'object' }
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const now = new Date().toISOString()

            const { data: coupons, error } = await supabaseAdmin
                .from('coupons')
                .select('code, description, discount_type, discount_value, max_discount_amount, min_order_amount, valid_until')
                .eq('is_active', true)
                .lte('valid_from', now)
                .or(`valid_until.is.null,valid_until.gte.${now}`)
                .order('created_at', { ascending: false })

            if (error) {
                return handleSupabaseError(error, reply)
            }

            return {
                coupons: coupons || []
            }

        } catch (error) {
            console.error('Get coupons error:', error)
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Failed to fetch coupons'
            })
        }
    })

    // GET /coupons/:code - Get specific coupon details
    fastify.get('/coupons/:code', {
        schema: {
            tags: ['Coupons'],
            description: 'Get details of a specific coupon',
            params: {
                type: 'object',
                properties: {
                    code: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { code } = request.params

            const { data: coupon, error } = await supabaseAdmin
                .from('coupons')
                .select('code, description, discount_type, discount_value, max_discount_amount, min_order_amount, valid_from, valid_until, is_active')
                .eq('code', code.toUpperCase())
                .single()

            if (error || !coupon) {
                return reply.status(404).send({
                    error: 'Not Found',
                    message: 'Coupon not found'
                })
            }

            return {
                coupon
            }

        } catch (error) {
            console.error('Get coupon error:', error)
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Failed to fetch coupon'
            })
        }
    })

    // Internal function to apply coupon to order (called from checkout)
    fastify.decorate('applyCouponToOrder', async (couponCode, orderId, userId, guestId, orderAmount) => {
        try {
            // Fetch coupon
            const { data: coupon, error: couponError } = await supabaseAdmin
                .from('coupons')
                .select('*')
                .eq('code', couponCode.toUpperCase())
                .eq('is_active', true)
                .single()

            if (couponError || !coupon) {
                return { success: false, error: 'Invalid coupon' }
            }

            // Calculate discount (same logic as verify)
            let discountAmount = 0

            if (coupon.discount_type === 'percentage') {
                discountAmount = (orderAmount * coupon.discount_value) / 100
                if (coupon.max_discount_amount && discountAmount > coupon.max_discount_amount) {
                    discountAmount = coupon.max_discount_amount
                }
            } else {
                discountAmount = coupon.discount_value
            }

            if (discountAmount > orderAmount) {
                discountAmount = orderAmount
            }

            // Record coupon usage
            const { error: usageError } = await supabaseAdmin
                .from('coupon_usage')
                .insert({
                    coupon_id: coupon.id,
                    user_id: userId || null,
                    guest_id: userId ? null : guestId,
                    order_id: orderId,
                    discount_amount: discountAmount,
                    order_amount: orderAmount
                })

            if (usageError) {
                console.error('Failed to record coupon usage:', usageError)
                return { success: false, error: 'Failed to apply coupon' }
            }

            // Increment coupon usage count
            await supabaseAdmin
                .from('coupons')
                .update({ current_uses: coupon.current_uses + 1 })
                .eq('id', coupon.id)

            return {
                success: true,
                discount: Math.round(discountAmount * 100) / 100
            }

        } catch (error) {
            console.error('Apply coupon error:', error)
            return { success: false, error: 'Failed to apply coupon' }
        }
    })
}

export default fp(couponRoutes)
