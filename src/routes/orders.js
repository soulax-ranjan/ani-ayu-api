import fp from 'fastify-plugin'
import { supabaseAdmin, TABLES, handleSupabaseError } from '../lib/supabase.js'

async function orderRoutes(fastify, options) {
  const { z } = await import('zod')

  // Helper to get owner params
  const getOwnerParams = (request) => {
    const userId = request.user?.sub
    const guestId = request.cookies.guest_id
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

  // POST /orders/track - Track order by Email and Phone (Public)
  fastify.post('/orders/track', {
    schema: {
      tags: ['Orders'],
      description: 'Track guest orders using Email and Phone',
      body: {
        type: 'object',
        required: ['email', 'phone'],
        properties: {
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' }
        }
      },
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
      const { email, phone } = request.body

      // Find orders where guest_email matches AND the associated address has the matching phone
      // We use !inner on address to ensure the filter applies
      const { data: orders, error } = await supabaseAdmin
        .from(TABLES.ORDERS)
        .select(`
          *,
          address:addresses!inner(*),
          items:order_items(
            *,
            product:products(*)
          )
        `)
        .eq('guest_email', email)
        .eq('address.phone', phone)
        .order('created_at', { ascending: false })

      if (error) return handleSupabaseError(error, reply)

      return {
        success: true,
        orders: orders || []
      }

    } catch (error) {
      console.error('Track order error:', error)
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
      const isOwner = (userId && order.user_id === userId) || (guestId && order.guest_id === guestId)
      if (!isOwner) {
        return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this order' })
      }

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
}

export default fp(orderRoutes)
