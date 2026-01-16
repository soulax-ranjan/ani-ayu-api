import fp from 'fastify-plugin'
import { supabaseAdmin, TABLES, handleSupabaseError } from '../lib/supabase.js'
import crypto from 'node:crypto'

async function paymentRoutes(fastify, options) {
  const { z } = await import('zod')

  // Schema for payment verification
  const verifySchema = z.object({
    razorpayOrderId: z.string(),
    razorpayPaymentId: z.string(),
    razorpaySignature: z.string()
  })

  // POST /payments/verify - Verify Razorpay Payment
  fastify.post('/payments/verify', {
    schema: {
      tags: ['Payments'],
      description: 'Verify Razorpay payment signature and update order status',
      body: {
        type: 'object',
        required: ['razorpayOrderId', 'razorpayPaymentId', 'razorpaySignature'],
        properties: {
          razorpayOrderId: { type: 'string' },
          razorpayPaymentId: { type: 'string' },
          razorpaySignature: { type: 'string' }
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
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = verifySchema.parse(request.body)

      // 1. Fetch the payment record by razorpay_order_id
      const { data: paymentRecord, error: paymentFetchError } = await supabaseAdmin
        .from(TABLES.PAYMENTS)
        .select('*')
        .eq('razorpay_order_id', razorpayOrderId)
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
      // TODO: Replace with actual Razorpay Signature Validation
      // const generatedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      //   .update(razorpayOrderId + "|" + razorpayPaymentId)
      //   .digest('hex');
      //
      // if (generatedSignature !== razorpaySignature) {
      //    return reply.status(400).send({ error: 'Invalid Signature', message: 'Any messsage' })
      // }
      
      // MOCK VERIFICATION for now
      // We will assume any signature that is not 'invalid_signature' is valid for this mock.
      if (razorpaySignature === 'invalid_signature') {
         return reply.status(400).send({
           error: 'Invalid Signature',
           message: 'Payment verification failed'
         })
      }

      // 3. Update Payment Status
      const { error: updatePaymentError } = await supabaseAdmin
        .from(TABLES.PAYMENTS)
        .update({
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: razorpaySignature,
          status: 'captured',
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentRecord.id)

      if (updatePaymentError) return handleSupabaseError(updatePaymentError, reply)

      // 4. Update Order Status
      const { error: updateOrderError } = await supabaseAdmin
        .from(TABLES.ORDERS)
        .update({
          payment_status: 'paid',
          // Optionally move order Status to 'processing' from 'pending'
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentRecord.order_id)

      if (updateOrderError) {
        console.error('Failed to update order status after payment', updateOrderError)
        // This is a critical error state (Payment success but Order status failed), requires manual intervention msg
      }

      return {
        success: true,
        message: 'Payment verified successfully',
        orderId: paymentRecord.order_id
      }

    } catch (error) {
       if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation Error', message: 'Invalid data' })
      }
      console.error('Payment verification error:', error)
      return reply.status(500).send({ error: 'Internal Server Error' })
    }
  })
}

export default fp(paymentRoutes)
