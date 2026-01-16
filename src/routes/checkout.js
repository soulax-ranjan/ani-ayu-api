import fp from 'fastify-plugin'
import { supabaseAdmin, TABLES, handleSupabaseError } from '../lib/supabase.js'

async function checkoutRoutes(fastify, options) {
  const { z } = await import('zod')

  const checkoutSchema = z.object({
    addressId: z.string().uuid(),
    paymentMethod: z.enum(['cod', 'card', 'upi']).default('cod'),
    cartItemIds: z.array(z.string().uuid()).optional()
  })

  // POST /checkout - Place an order
  fastify.post('/checkout', {
    preHandler: [fastify.authenticateOptional],
    schema: {
      tags: ['Checkout'],
      description: 'Place an order using existing cart and address',
      body: {
        type: 'object',
        required: ['addressId'],
        properties: {
          addressId: { type: 'string', format: 'uuid' },
          paymentMethod: { type: 'string', enum: ['cod', 'card', 'upi'] },
          cartItemIds: { type: 'array', items: { type: 'string', format: 'uuid' } }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { addressId, paymentMethod, cartItemIds } = checkoutSchema.parse(request.body)
      const userId = request.user?.sub
      const guestId = request.cookies.guest_id

      if (!userId && !guestId) {
        return reply.status(400).send({ error: 'No session found' })
      }

      // 1. Get Cart
      let cartQuery = supabaseAdmin.from(TABLES.CARTS).select('id').single()
      if (userId) cartQuery = cartQuery.eq('user_id', userId)
      else cartQuery = cartQuery.eq('guest_id', guestId)
      
      const { data: cart, error: cartError } = await cartQuery
      if (cartError || !cart) {
        return reply.status(400).send({ error: 'Cart is empty' })
      }

      // 2. Get Cart Items with Prices
      let itemsQuery = supabaseAdmin
        .from(TABLES.CART_ITEMS)
        .select(`
          id,
          product_id,
          quantity,
          size,
          color,
          products (
            price
          )
        `)
        .eq('cart_id', cart.id)

      // Filter by specific items if requested
      if (cartItemIds && cartItemIds.length > 0) {
        itemsQuery = itemsQuery.in('id', cartItemIds)
      }

      const { data: items, error: itemsError } = await itemsQuery

      if (itemsError || !items || items.length === 0) {
        return reply.status(400).send({ error: 'No valid items found in cart to checkout' })
      }

      // 3. Calculate Total and Validate Stock
      const totalAmount = items.reduce((sum, item) => sum + (item.products.price * item.quantity), 0)

      // 4. Get Address (and Email for Guest)
      const { data: address, error: addressError } = await supabaseAdmin
        .from(TABLES.ADDRESSES)
        .select('email, id')
        .eq('id', addressId)
        .single()

      if (addressError || !address) {
        return reply.status(400).send({ error: 'Invalid address' })
      }

      // 5. Create Order
      const isOnlinePayment = paymentMethod === 'card' || paymentMethod === 'upi'
      const orderData = {
        user_id: userId || null,
        guest_id: userId ? null : guestId,
        guest_email: request.user?.email || address.email,
        address_id: addressId,
        total_amount: totalAmount,
        status: 'pending',
        payment_status: 'pending' 
      }

      const { data: order, error: orderError } = await supabaseAdmin
        .from(TABLES.ORDERS)
        .insert(orderData)
        .select()
        .single()

      if (orderError) return handleSupabaseError(orderError, reply)

      // 6. Move Items to Order Items
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_purchase: item.products.price,
        size: item.size,
        color: item.color
      }))

      const { error: itemsInsertError } = await supabaseAdmin
        .from('order_items')
        .insert(orderItems)

      if (itemsInsertError) {
        console.error('Failed to insert order items', itemsInsertError)
        return reply.status(500).send({ error: 'Failed to process order items' })
      }

      // 7. Clear Ordered Items from Cart
      let deleteQuery = supabaseAdmin.from(TABLES.CART_ITEMS).delete().eq('cart_id', cart.id)
      
      if (cartItemIds && cartItemIds.length > 0) {
        const processedIds = items.map(i => i.id)
        deleteQuery = deleteQuery.in('id', processedIds)
      }
      
      await deleteQuery

      // 8. Handle Payment Integration (Mock)
      // TODO: Initialize Razorpay instance here
      // const Razorpay = require('razorpay')
      // const razorpay = new Razorpay({ key_id: 'YOUR_KEY_ID', key_secret: 'YOUR_KEY_SECRET' })

      let paymentResponse = {}
      if (isOnlinePayment) {
        // Mock Razorpay Order Creation
        // TODO: Replace with actual Razorpay API call
        // const razorpayOrder = await razorpay.orders.create({
        //   amount: totalAmount * 100, // amount in paise
        //   currency: "INR",
        //   receipt: order.id
        // })
        // const mockRazorpayId = razorpayOrder.id

        const mockRazorpayId = `order_${Math.random().toString(36).substring(7)}`
        
        // Create Payment Record (Idempotency: Ensure your frontend handles not calling checkout twice for same cart actions)
        const { error: paymentError } = await supabaseAdmin
          .from(TABLES.PAYMENTS)
          .insert({
            order_id: order.id,
            razorpay_order_id: mockRazorpayId,
            amount: totalAmount,
            currency: 'INR',
            status: 'pending',
            // method: paymentMethod // 'method' column not strictly in schema but useful if added
          })

        if (paymentError) {
          console.error('Payment record creation failed', paymentError)
          // Ideally revert order here, but for now just log
        }

        paymentResponse = {
          razorpayOrderId: mockRazorpayId,
          amount: totalAmount * 100, // Razorpay expects paise
          currency: 'INR',
          key: 'rzp_test_mock_key' // TODO: Replace with process.env.RAZORPAY_KEY_ID
        }
      }

      return {
        success: true,
        orderId: order.id,
        message: 'Order placed successfully',
        ...paymentResponse
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: error.errors
        })
      }
      console.error('Checkout error:', error)
      return reply.status(500).send({ error: 'Internal Server Error' })
    }
  })
}

export default fp(checkoutRoutes)
