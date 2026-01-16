import fp from 'fastify-plugin'
import { supabaseAdmin, TABLES, handleSupabaseError } from '../lib/supabase.js'

async function cartRoutes(fastify, options) {
  const { z } = await import('zod')

  // Validation schemas
  const addToCartSchema = z.object({
    productId: z.string().uuid(),
    quantity: z.number().min(1).default(1),
    size: z.string().optional(),
    color: z.string().optional()
  })

  const updateCartItemSchema = z.object({
    quantity: z.number().min(0)
  })

  // Helper to get active cart
  const getActiveCart = async (request) => {
    const userId = request.user?.sub
    const guestId = request.headers['x-guest-id']

    if (!userId && !guestId) {
      throw { status: 400, message: 'No session identifier' }
    }

    let query = supabaseAdmin.from(TABLES.CARTS).select('id')

    if (userId) {
      query = query.eq('user_id', userId)
    } else {
      query = query.eq('guest_id', guestId)
    }

    let { data: cart, error } = await query.single()

    if (!cart && !error) {
      // Create new cart
      const { data: newCart, error: createError } = await supabaseAdmin
        .from(TABLES.CARTS)
        .insert(userId ? { user_id: userId } : { guest_id: guestId })
        .select()
        .single()
      
      if (createError) throw createError
      cart = newCart
    } else if (error && error.code !== 'PGRST116') {
      throw error
    }

    if (!cart) {
         const { data: newCart, error: createError } = await supabaseAdmin
        .from(TABLES.CARTS)
        .insert(userId ? { user_id: userId } : { guest_id: guestId })
        .select()
        .single()
         if (createError) throw createError
         cart = newCart
    }

    return cart
  }

  // POST /cart/add
  fastify.post('/cart/add', {
    preHandler: [fastify.authenticateOptional],
    schema: {
      tags: ['Cart'],
      description: 'Add item to cart',
      body: {
        type: 'object',
        required: ['productId'],
        properties: {
          productId: { type: 'string', format: 'uuid' },
          quantity: { type: 'number', minimum: 1 },
          size: { type: 'string' },
          color: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { productId, quantity, size, color } = addToCartSchema.parse(request.body)
      const cart = await getActiveCart(request)

      // Check existing item
      let query = supabaseAdmin
        .from(TABLES.CART_ITEMS)
        .select('id, quantity')
        .eq('cart_id', cart.id)
        .eq('product_id', productId)

      if (size) query = query.eq('size', size)
      else query = query.is('size', null)

      if (color) query = query.eq('color', color)
      else query = query.is('color', null)

      const { data: existingItem } = await query.single()

      let result
      if (existingItem) {
        // Update quantity
        const { data, error } = await supabaseAdmin
          .from(TABLES.CART_ITEMS)
          .update({ quantity: existingItem.quantity + quantity })
          .eq('id', existingItem.id)
          .select()
          .single()
        if (error) throw error
        result = data
      } else {
        // Insert new item
        const { data, error } = await supabaseAdmin
          .from(TABLES.CART_ITEMS)
          .insert({
            cart_id: cart.id,
            product_id: productId,
            quantity: quantity,
            size: size || null,
            color: color || null
          })
          .select()
          .single()
        if (error) throw error
        result = data
      }

      return {
        success: true,
        item: result
      }
    } catch (error) {
       if (error.status === 400) return reply.status(400).send(error)
       console.error('Add to cart error:', error)
       if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: error.errors
        })
      }
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to add item to cart'
      })
    }
  })

  // GET /cart
  fastify.get('/cart', {
    preHandler: [fastify.authenticateOptional],
    schema: {
      tags: ['Cart'],
      description: 'Get current cart'
    }
  }, async (request, reply) => {
    try {
      const cart = await getActiveCart(request)

      const { data: items, error } = await supabaseAdmin
        .from(TABLES.CART_ITEMS)
        .select(`
          id,
          quantity,
          size,
          color,
          product:products (
            id,
            name,
            price,
            image_url,
            slug
          )
        `)
        .eq('cart_id', cart.id)

      if (error) throw error

      // Calculate totals
      const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * (item.product?.price || 0)), 0)

      return {
        id: cart.id,
        items: items.map(item => ({
          id: item.id,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
          product: item.product,
          total: item.quantity * (item.product?.price || 0)
        })),
        summary: {
          totalItems,
          subtotal
        }
      }

    } catch (error) {
      if (error.status === 400) {
         return { items: [], summary: { totalItems: 0, subtotal: 0 } }
      }
      console.error('Get cart error:', error)
      return reply.status(500).send({ error: 'Internal Server Error' })
    }
  })

  // DELETE /cart/item/:id
  fastify.delete('/cart/item/:id', {
    preHandler: [fastify.authenticateOptional],
    schema: {
      tags: ['Cart'],
      description: 'Remove item from cart',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const cart = await getActiveCart(request)

      const { error } = await supabaseAdmin
        .from(TABLES.CART_ITEMS)
        .delete()
        .eq('id', id)
        .eq('cart_id', cart.id) // Ensure ownership

      if (error) throw error

      return { success: true, message: 'Item removed' }
    } catch (error) {
      console.error('Delete cart item error:', error)
      return reply.status(500).send({ error: 'Internal Server Error' })
    }
  })
}

export default fp(cartRoutes)
