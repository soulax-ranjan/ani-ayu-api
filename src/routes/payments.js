import fp from 'fastify-plugin'
import { supabaseAdmin, TABLES, handleSupabaseError } from '../lib/supabase.js'
import crypto from 'node:crypto'
import Razorpay from 'razorpay'

async function paymentRoutes(fastify, options) {
  const { z } = await import('zod')

  // Initialize Razorpay instance
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  })

  // Schema for payment verification
  const verifySchema = z.object({
    razorpay_order_id: z.string(),
    razorpay_payment_id: z.string(),
    razorpay_signature: z.string()
  })

  // POST /payments/create-order - Create Razorpay order
  fastify.post('/payments/create-order', {
    schema: {
      tags: ['Payments'],
      description: 'Create a Razorpay order for payment',
      body: {
        type: 'object',
        required: ['orderId', 'amount'],
        properties: {
          orderId: { type: 'string', format: 'uuid' },
          amount: { type: 'number', description: 'Amount in INR' },
          currency: { type: 'string', default: 'INR' },
          receipt: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            razorpayOrderId: { type: 'string' },
            amount: { type: 'number' },
            currency: { type: 'string' },
            key: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { orderId, amount, currency = 'INR', receipt } = request.body

      // Verify order exists and get details
      const { data: order, error: orderError } = await supabaseAdmin
        .from(TABLES.ORDERS)
        .select('id, total_amount, status')
        .eq('id', orderId)
        .single()

      if (orderError || !order) {
        return reply.status(404).send({
          error: 'Order Not Found',
          message: 'Invalid order ID'
        })
      }

      // Verify amount matches
      if (Math.abs(order.total_amount - amount) > 0.01) {
        return reply.status(400).send({
          error: 'Amount Mismatch',
          message: 'Order amount does not match'
        })
      }

      // Create Razorpay order
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(amount * 100), // Convert to paise
        currency: currency,
        receipt: receipt || orderId,
        notes: {
          order_id: orderId
        }
      })

      // Store payment record
      const { error: paymentError } = await supabaseAdmin
        .from(TABLES.PAYMENTS)
        .insert({
          order_id: orderId,
          razorpay_order_id: razorpayOrder.id,
          amount: amount,
          currency: currency,
          status: 'pending',
          razorpay_data: razorpayOrder
        })

      if (paymentError) {
        console.error('Failed to create payment record:', paymentError)
        // Continue anyway as Razorpay order is created
      }

      // Update order with razorpay_order_id
      await supabaseAdmin
        .from(TABLES.ORDERS)
        .update({ razorpay_order_id: razorpayOrder.id })
        .eq('id', orderId)

      return {
        success: true,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key: process.env.RAZORPAY_KEY_ID
      }

    } catch (error) {
      console.error('Create Razorpay order error:', error)
      return reply.status(500).send({
        error: 'Payment Creation Failed',
        message: error.message || 'Failed to create payment order'
      })
    }
  })

  // POST /payments/verify - Verify Razorpay Payment
  fastify.post('/payments/verify', {
    schema: {
      tags: ['Payments'],
      description: 'Verify Razorpay payment signature and update order status',
      body: {
        type: 'object',
        required: ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'],
        properties: {
          razorpay_order_id: { type: 'string' },
          razorpay_payment_id: { type: 'string' },
          razorpay_signature: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            orderId: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = verifySchema.parse(request.body)

      // 1. Fetch the payment record by razorpay_order_id
      const { data: paymentRecord, error: paymentFetchError } = await supabaseAdmin
        .from(TABLES.PAYMENTS)
        .select('*')
        .eq('razorpay_order_id', razorpay_order_id)
        .single()

      if (paymentFetchError || !paymentRecord) {
        return reply.status(404).send({
          error: 'Payment Not Found',
          message: 'Invalid Razorpay Order ID'
        })
      }

      if (paymentRecord.status === 'captured') {
        return {
          success: true,
          message: 'Payment already verified',
          orderId: paymentRecord.order_id
        }
      }

      // 2. Verify Signature
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex')

      if (generatedSignature !== razorpay_signature) {
        // Log failed verification attempt
        await supabaseAdmin
          .from(TABLES.PAYMENTS)
          .update({
            status: 'failed',
            error_code: 'SIGNATURE_MISMATCH',
            error_description: 'Payment signature verification failed',
            failed_at: new Date().toISOString()
          })
          .eq('id', paymentRecord.id)

        return reply.status(400).send({
          error: 'Invalid Signature',
          message: 'Payment verification failed'
        })
      }

      // 3. Fetch payment details from Razorpay
      let paymentDetails
      try {
        paymentDetails = await razorpay.payments.fetch(razorpay_payment_id)
      } catch (error) {
        console.error('Failed to fetch payment details:', error)
        paymentDetails = null
      }

      // 4. Update Payment Status
      const { error: updatePaymentError } = await supabaseAdmin
        .from(TABLES.PAYMENTS)
        .update({
          razorpay_payment_id: razorpay_payment_id,
          razorpay_signature: razorpay_signature,
          status: 'captured',
          method: paymentDetails?.method || null,
          razorpay_data: paymentDetails || paymentRecord.razorpay_data,
          captured_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentRecord.id)

      if (updatePaymentError) {
        console.error('Failed to update payment:', updatePaymentError)
        return handleSupabaseError(updatePaymentError, reply)
      }

      // 5. Finalize Order: Insert Order Items and Clear Cart
      const { data: order, error: orderFetchError } = await supabaseAdmin
        .from(TABLES.ORDERS)
        .select('*, cart_snapshot')
        .eq('id', paymentRecord.order_id)
        .single()

      if (orderFetchError || !order) {
        console.error('Failed to fetch order:', orderFetchError)
        return reply.status(404).send({ error: 'Order not found' })
      }

      // Insert order items from cart snapshot
      if (order.cart_snapshot && Array.isArray(order.cart_snapshot)) {
        const orderItems = order.cart_snapshot.map(item => ({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price_at_purchase: item.price_at_purchase,
          size: item.size,
          color: item.color
        }))

        const { error: itemsInsertError } = await supabaseAdmin
          .from('order_items')
          .insert(orderItems)

        if (itemsInsertError) {
          console.error('Failed to insert order items:', itemsInsertError)
          // Continue anyway - we can manually fix this
        }

        // Clear cart items
        const cartItemIds = order.cart_snapshot.map(item => item.cart_item_id).filter(Boolean)
        if (cartItemIds.length > 0) {
          const { error: clearCartError } = await supabaseAdmin
            .from(TABLES.CART_ITEMS)
            .delete()
            .in('id', cartItemIds)

          if (clearCartError) {
            console.error('Failed to clear cart:', clearCartError)
            // Continue anyway
          }
        }
      }

      // 6. Update Order Status
      const { error: updateOrderError } = await supabaseAdmin
        .from(TABLES.ORDERS)
        .update({
          payment_status: 'paid',
          status: 'confirmed', // Move from pending to confirmed
          cart_snapshot: null, // Clear snapshot after processing
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentRecord.order_id)

      if (updateOrderError) {
        console.error('Failed to update order status after payment', updateOrderError)
        // This is a critical error - payment succeeded but order update failed
        // You may want to implement a retry mechanism or alert system here
      }

      return {
        success: true,
        message: 'Payment verified successfully',
        orderId: paymentRecord.order_id
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid payment data',
          details: error.errors
        })
      }
      console.error('Payment verification error:', error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Payment verification failed'
      })
    }
  })

  // POST /payments/webhook - Razorpay Webhook Handler
  fastify.post('/payments/webhook', {
    schema: {
      tags: ['Payments'],
      description: 'Handle Razorpay webhook events',
      hide: true // Hide from Swagger docs as it's for Razorpay only
    }
  }, async (request, reply) => {
    try {
      const webhookSignature = request.headers['x-razorpay-signature']
      const webhookBody = JSON.stringify(request.body)

      // Verify webhook signature
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(webhookBody)
        .digest('hex')

      const isValidSignature = expectedSignature === webhookSignature

      // Log webhook event
      const { data: webhookEvent, error: webhookError } = await supabaseAdmin
        .from('webhook_events')
        .insert({
          event_id: request.body.event,
          event_type: request.body.event,
          entity_type: request.body.payload?.payment?.entity || 'unknown',
          entity_id: request.body.payload?.payment?.id || request.body.payload?.order?.id || 'unknown',
          payload: request.body,
          signature: webhookSignature,
          verified: isValidSignature
        })
        .select()
        .single()

      if (webhookError) {
        console.error('Failed to log webhook event:', webhookError)
      }

      if (!isValidSignature) {
        console.error('Invalid webhook signature')
        return reply.status(400).send({ error: 'Invalid signature' })
      }

      // Process webhook event
      const event = request.body.event
      const payload = request.body.payload

      switch (event) {
        case 'payment.authorized':
          await handlePaymentAuthorized(payload.payment.entity)
          break

        case 'payment.captured':
          await handlePaymentCaptured(payload.payment.entity)
          break

        case 'payment.failed':
          await handlePaymentFailed(payload.payment.entity)
          break

        case 'order.paid':
          await handleOrderPaid(payload.order.entity)
          break

        default:
          console.log(`Unhandled webhook event: ${event}`)
      }

      // Mark webhook as processed
      if (webhookEvent) {
        await supabaseAdmin
          .from('webhook_events')
          .update({
            processed: true,
            processed_at: new Date().toISOString()
          })
          .eq('id', webhookEvent.id)
      }

      return { success: true }

    } catch (error) {
      console.error('Webhook processing error:', error)
      return reply.status(500).send({ error: 'Webhook processing failed' })
    }
  })

  // GET /payments/order/:orderId - Get payment details for an order
  fastify.get('/payments/order/:orderId', {
    schema: {
      tags: ['Payments'],
      description: 'Get payment details for a specific order',
      params: {
        type: 'object',
        properties: {
          orderId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { orderId } = request.params

      const { data: payments, error } = await supabaseAdmin
        .from(TABLES.PAYMENTS)
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })

      if (error) {
        return handleSupabaseError(error, reply)
      }

      return {
        success: true,
        payments: payments || []
      }

    } catch (error) {
      console.error('Get payment details error:', error)
      return reply.status(500).send({ error: 'Internal Server Error' })
    }
  })

  // Helper function: Handle payment.authorized event
  async function handlePaymentAuthorized(payment) {
    try {
      await supabaseAdmin
        .from(TABLES.PAYMENTS)
        .update({
          status: 'authorized',
          razorpay_payment_id: payment.id,
          method: payment.method,
          razorpay_data: payment,
          authorized_at: new Date().toISOString()
        })
        .eq('razorpay_order_id', payment.order_id)

      console.log(`Payment authorized: ${payment.id}`)
    } catch (error) {
      console.error('Error handling payment.authorized:', error)
    }
  }

  // Helper function: Handle payment.captured event
  async function handlePaymentCaptured(payment) {
    try {
      const { data: paymentRecord } = await supabaseAdmin
        .from(TABLES.PAYMENTS)
        .update({
          status: 'captured',
          razorpay_payment_id: payment.id,
          method: payment.method,
          razorpay_data: payment,
          captured_at: new Date().toISOString()
        })
        .eq('razorpay_order_id', payment.order_id)
        .select()
        .single()

      if (paymentRecord) {
        // Update order status
        await supabaseAdmin
          .from(TABLES.ORDERS)
          .update({
            payment_status: 'paid',
            status: 'confirmed'
          })
          .eq('id', paymentRecord.order_id)
      }

      console.log(`Payment captured: ${payment.id}`)
    } catch (error) {
      console.error('Error handling payment.captured:', error)
    }
  }

  // Helper function: Handle payment.failed event
  async function handlePaymentFailed(payment) {
    try {
      const { data: paymentRecord } = await supabaseAdmin
        .from(TABLES.PAYMENTS)
        .update({
          status: 'failed',
          razorpay_payment_id: payment.id,
          method: payment.method,
          error_code: payment.error_code,
          error_description: payment.error_description,
          error_source: payment.error_source,
          error_step: payment.error_step,
          error_reason: payment.error_reason,
          razorpay_data: payment,
          failed_at: new Date().toISOString()
        })
        .eq('razorpay_order_id', payment.order_id)
        .select()
        .single()

      if (paymentRecord) {
        // Update order status
        await supabaseAdmin
          .from(TABLES.ORDERS)
          .update({
            payment_status: 'failed',
            status: 'cancelled'
          })
          .eq('id', paymentRecord.order_id)
      }

      console.log(`Payment failed: ${payment.id}`)
    } catch (error) {
      console.error('Error handling payment.failed:', error)
    }
  }

  // Helper function: Handle order.paid event
  async function handleOrderPaid(order) {
    try {
      await supabaseAdmin
        .from(TABLES.ORDERS)
        .update({
          payment_status: 'paid',
          status: 'confirmed'
        })
        .eq('razorpay_order_id', order.id)

      console.log(`Order paid: ${order.id}`)
    } catch (error) {
      console.error('Error handling order.paid:', error)
    }
  }
}

export default fp(paymentRoutes)
