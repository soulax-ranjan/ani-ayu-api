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
      const guestId = request.headers['x-guest-id']

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

      // 5. Create Order (with cart snapshot for online payments)
      const isOnlinePayment = paymentMethod === 'card' || paymentMethod === 'upi'

      // Store cart items as JSON for online payments (to be processed after verification)
      const cartSnapshot = items.map(item => ({
        cart_item_id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_purchase: item.products.price,
        size: item.size,
        color: item.color
      }))

      const orderData = {
        user_id: userId || null,
        guest_id: userId ? null : guestId,
        guest_email: request.user?.email || address.email,
        address_id: addressId,
        total_amount: totalAmount,
        status: 'pending',
        payment_status: 'pending',
        payment_method: paymentMethod,
        // Store cart snapshot for online payments
        cart_snapshot: isOnlinePayment ? cartSnapshot : null
      }

      const { data: order, error: orderError } = await supabaseAdmin
        .from(TABLES.ORDERS)
        .insert(orderData)
        .select()
        .single()

      if (orderError) return handleSupabaseError(orderError, reply)

      // For COD: Finalize order immediately (insert items, clear cart)
      if (!isOnlinePayment) {
        // 6. Insert Order Items
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

        // 7. Clear Cart Items
        let deleteQuery = supabaseAdmin.from(TABLES.CART_ITEMS).delete().eq('cart_id', cart.id)

        if (cartItemIds && cartItemIds.length > 0) {
          const processedIds = items.map(i => i.id)
          deleteQuery = deleteQuery.in('id', processedIds)
        }

        await deleteQuery

        // 8. Mark COD order as confirmed
        await supabaseAdmin
          .from(TABLES.ORDERS)
          .update({
            payment_status: 'pending',
            status: 'confirmed',
            cart_snapshot: null // Clear snapshot after processing
          })
          .eq('id', order.id)
      }

      // 9. Handle Payment Response
      let paymentResponse = {}

      if (isOnlinePayment) {
        // For online payments: Create Razorpay order automatically
        try {
          const Razorpay = (await import('razorpay')).default
          const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
          })

          // Create Razorpay order
          const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(totalAmount * 100), // Convert to paise
            currency: 'INR',
            receipt: order.id,
            notes: {
              order_id: order.id
            }
          })

          // Store payment record
          const { error: paymentError } = await supabaseAdmin
            .from(TABLES.PAYMENTS)
            .insert({
              order_id: order.id,
              razorpay_order_id: razorpayOrder.id,
              amount: totalAmount,
              currency: 'INR',
              status: 'pending',
              razorpay_data: razorpayOrder
            })

          if (paymentError) {
            console.error('Failed to create payment record:', paymentError)
          }

          // Update order with razorpay_order_id
          await supabaseAdmin
            .from(TABLES.ORDERS)
            .update({ razorpay_order_id: razorpayOrder.id })
            .eq('id', order.id)

          // Return Razorpay order details
          paymentResponse = {
            requiresPayment: true,
            orderId: order.id,
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount, // Amount in paise
            currency: razorpayOrder.currency,
            key: process.env.RAZORPAY_KEY_ID,
            paymentMethod: paymentMethod,
            message: 'Razorpay order created. Complete payment to finalize.'
          }
        } catch (error) {
          console.error('Failed to create Razorpay order:', error)
          return reply.status(500).send({
            error: 'Payment Initialization Failed',
            message: 'Failed to create payment order. Please try again.'
          })
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
