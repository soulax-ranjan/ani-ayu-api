import fp from 'fastify-plugin'
import { supabaseAdmin, TABLES, handleSupabaseError } from '../lib/supabase.js'
import { normalizePhone, phoneSearchFilter, toPublicOrder, createRateLimiter } from '../lib/orderLookup.js'

// 10 phone lookups per IP per 15 minutes, to make guessing numbers impractical
const allowPhoneLookup = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 })

async function orderRoutes(fastify, options) {
  const { z } = await import('zod')

  // Helper to get owner params
  const getOwnerParams = (request) => {
    const userId = request.user?.sub
    const guestId = request.headers['x-guest-id']
    if (!userId && !guestId) {
      throw { status: 401, message: 'Unauthorized' }
    }
    return { userId, guestId }
  }

  // GET /orders - List all orders
  fastify.get('/orders', {
    preHandler: [fastify.authenticateOptional],
    schema: {
      tags: ['Orders'],
      description: 'Get all orders for the current user or guest',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            orders: { type: 'array' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { userId, guestId } = getOwnerParams(request)

      let query = supabaseAdmin
        .from(TABLES.ORDERS)
        .select(`
          *,
          address:addresses(*),
          items:order_items(
            *,
            product:products(*)
          )
        `)
        .order('created_at', { ascending: false })

      if (userId) query = query.eq('user_id', userId)
      else query = query.eq('guest_id', guestId)

      const { data: orders, error } = await query

      if (error) return handleSupabaseError(error, reply)

      return {
        success: true,
        orders: orders || []
      }

    } catch (error) {
      if (error.status === 401) return reply.status(401).send(error)
      console.error('Get orders error:', error)
      return reply.status(500).send({ error: 'Internal Server Error' })
    }
  })

  // GET /orders/track/:orderId - Track order by Razorpay Order ID (Public)
  fastify.get('/orders/track/:orderId', {
    schema: {
      tags: ['Orders'],
      description: 'Track any order using the Razorpay Order ID shown in the confirmation email (e.g. order_XXXXXXXXX)',
      params: {
        type: 'object',
        required: ['orderId'],
        properties: {
          orderId: { type: 'string', description: 'Razorpay order ID from confirmation email, e.g. order_P3t4B1rY8bAOme' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            order: { type: 'object', additionalProperties: true }
          }
        },
        404: {
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
      const { orderId } = request.params

      const { data: order, error } = await supabaseAdmin
        .from(TABLES.ORDERS)
        .select(`
          *,
          address:addresses(*),
          items:order_items(
            *,
            product:products(*)
          )
        `)
        .eq('razorpay_order_id', orderId)
        .single()

      if (error || !order) {
        return reply.status(404).send({
          error: 'Order Not Found',
          message: 'No order found with the provided order ID'
        })
      }

      return {
        success: true,
        order
      }

    } catch (error) {
      console.error('Track order error:', error)
      return reply.status(500).send({ error: 'Internal Server Error' })
    }
  })

  // POST /orders/lookup - Find orders by the phone number on the delivery address (Public)
  fastify.post('/orders/lookup', {
    schema: {
      tags: ['Orders'],
      description: 'Find orders using the phone number given at checkout. Returns status, items and totals; the delivery address and order number are masked.',
      body: {
        type: 'object',
        required: ['phone'],
        properties: {
          phone: { type: 'string', description: '10-digit mobile number, with or without +91 and spaces' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            orders: { type: 'array', items: { type: 'object', additionalProperties: true } }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        429: {
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
      if (!allowPhoneLookup(request.ip)) {
        return reply.status(429).send({
          error: 'Too Many Requests',
          message: 'Too many lookups. Please try again in 15 minutes.'
        })
      }

      const phone = normalizePhone(request.body.phone)
      if (!phone) {
        return reply.status(400).send({
          error: 'Invalid phone number',
          message: 'Please enter a 10-digit mobile number'
        })
      }

      // Phones are stored in several formats, so match loosely and then compare exactly
      const { data: addresses, error: addressError } = await supabaseAdmin
        .from(TABLES.ADDRESSES)
        .select('id, phone')
        .or(phoneSearchFilter(phone))

      if (addressError) return handleSupabaseError(addressError, reply)

      const addressIds = addresses
        .filter(address => normalizePhone(address.phone) === phone)
        .map(address => address.id)

      if (addressIds.length === 0) return { success: true, orders: [] }

      const { data: orders, error } = await supabaseAdmin
        .from(TABLES.ORDERS)
        .select(`
          id,
          razorpay_order_id,
          created_at,
          status,
          payment_status,
          payment_method,
          total_amount,
          discount_amount,
          cart_snapshot,
          address:addresses(full_name, phone, city, state, postal_code),
          items:order_items(
            quantity,
            size,
            color,
            price_at_purchase,
            product:products(name, image_url)
          )
        `)
        .in('address_id', addressIds)
        .order('created_at', { ascending: false })

      if (error) return handleSupabaseError(error, reply)

      // Online orders whose payment was not verified yet have no order_items, only a cart_snapshot
      const snapshotProductIds = [...new Set(orders
        .filter(order => !order.items?.length && Array.isArray(order.cart_snapshot))
        .flatMap(order => order.cart_snapshot.map(item => item.product_id)))]

      const productsById = new Map()
      if (snapshotProductIds.length > 0) {
        const { data: products, error: productError } = await supabaseAdmin
          .from(TABLES.PRODUCTS)
          .select('id, name, image_url')
          .in('id', snapshotProductIds)
        if (productError) return handleSupabaseError(productError, reply)
        products.forEach(product => productsById.set(product.id, product))
      }

      return {
        success: true,
        orders: orders.map(order => toPublicOrder(order, productsById))
      }

    } catch (error) {
      console.error('Order lookup error:', error)
      return reply.status(500).send({ error: 'Internal Server Error' })
    }
  })

  // GET /orders/:id - Get single order details
  fastify.get('/orders/:id', {
    preHandler: [fastify.authenticateOptional],
    schema: {
      tags: ['Orders'],
      description: 'Get details of a specific order',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const { userId, guestId } = getOwnerParams(request)

      let query = supabaseAdmin
        .from(TABLES.ORDERS)
        .select(`
          *,
          address:addresses(*),
          items:order_items(
            *,
            product:products(*)
          )
        `)
        .eq('id', id)
        .single()

      // Security check: We can't easily add OR condition to the single query securely with RLS bypassed
      // So we fetch first, then verify ownership
      const { data: order, error } = await query

      if (error) return handleSupabaseError(error, reply)
      if (!order) return reply.status(404).send({ error: 'Order not found' })

      // Verify ownership
      // const isOwner = (userId && order.user_id === userId) || (guestId && order.guest_id === guestId)
      // if (!isOwner) {
      //   return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this order' })
      // }

      return {
        success: true,
        order
      }

    } catch (error) {
      if (error.status === 401) return reply.status(401).send(error)
      console.error('Get order details error:', error)
      return reply.status(500).send({ error: 'Internal Server Error' })
    }
  })

  // GET /orders/all - Admin: List all orders (No auth for now)
  fastify.get('/orders/all', {
    schema: {
      tags: ['Orders'],
      description: 'Admin: List all orders with full details',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 50 },
          offset: { type: 'number', default: 0 },
          status: { type: 'string' },
          search: { type: 'string', description: 'Search by order number or email' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { limit = 50, offset = 0, status, search } = request.query || {}

      let query = supabaseAdmin
        .from(TABLES.ORDERS)
        .select(`
          *,
          address:addresses(*),
          items:order_items(
            *,
            product:products(*)
          ),
          payments(*)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (status) {
        query = query.eq('status', status)
      }

      if (search) {
        query = query.or(`order_number.ilike.%${search}%,customer_email.ilike.%${search}%`)
      }

      const { data: orders, error, count } = await query

      if (error) return handleSupabaseError(error, reply)

      return {
        success: true,
        orders: orders || [],
        total: count || 0,
        page: Math.floor(offset / limit) + 1,
        limit
      }

    } catch (error) {
      console.error('Admin list orders error:', error)
      return reply.status(500).send({ error: 'Internal Server Error' })
    }
  })

  // GET /orders/details/:id - Admin: Get single order details with payments
  fastify.get('/orders/details/:id', {
    schema: {
      tags: ['Orders'],
      description: 'Admin: Get details of a specific order including payments',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params

      const { data: order, error } = await supabaseAdmin
        .from(TABLES.ORDERS)
        .select(`
          *,
          address:addresses(*),
          items:order_items(
            *,
            product:products(*)
          ),
          payments(*)
        `)
        .eq('id', id)
        .single()

      if (error) return handleSupabaseError(error, reply)
      if (!order) return reply.status(404).send({ error: 'Order not found' })

      return {
        success: true,
        order
      }

    } catch (error) {
      console.error('Admin get order error:', error)
      return reply.status(500).send({ error: 'Internal Server Error' })
    }
  })

  // PUT /orders/:id/status - Admin: Update order status
  fastify.put('/orders/:id/status', {
    schema: {
      tags: ['Orders'],
      description: 'Admin: Update order status',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const { status } = request.body

      const { data, error } = await supabaseAdmin
        .from(TABLES.ORDERS)
        .update({ status })
        .eq('id', id)
        .select()
        .single()

      if (error) return handleSupabaseError(error, reply)

      return {
        success: true,
        message: 'Order status updated',
        order: data
      }

    } catch (error) {
      console.error('Admin update status error:', error)
      return reply.status(500).send({ error: 'Internal Server Error' })
    }
  })

  // DELETE /orders/:id - Admin: Delete order
  fastify.delete('/orders/:id', {
    schema: {
      tags: ['Orders'],
      description: 'Admin: Delete an order',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params

      // Check if order exists
      const { data: order, error: fetchError } = await supabaseAdmin
        .from(TABLES.ORDERS)
        .select('id')
        .eq('id', id)
        .single()

      if (fetchError || !order) {
        return reply.status(404).send({
          error: 'Order Not Found',
          message: `Order with ID '${id}' not found`
        })
      }

      // Delete the order
      const { error: deleteError } = await supabaseAdmin
        .from(TABLES.ORDERS)
        .delete()
        .eq('id', id)

      if (deleteError) {
        return handleSupabaseError(deleteError, reply)
      }

      return {
        success: true,
        message: 'Order deleted successfully'
      }

    } catch (error) {
      console.error('Admin delete order error:', error)
      return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to delete order' })
    }
  })
}

export default fp(orderRoutes)
