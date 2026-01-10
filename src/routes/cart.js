import fp from 'fastify-plugin'
import { supabaseAdmin, TABLES } from '../lib/supabase.js'

async function cartRoutes(fastify, options) {
  const { z } = await import('zod')

  // Check if Supabase is configured
  const useSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'your-supabase-url'
  
  // In-memory cart storage (fallback when Supabase not configured)
  const memoryCart = new Map()

  // Validation schemas
  const addToCartSchema = z.object({
    sessionId: z.string(),
    productId: z.string(),
    size: z.string(),
    quantity: z.number().min(1).max(10),
    price: z.number()
  })

  const updateCartSchema = z.object({
    quantity: z.number().min(0).max(10)
  })

  const updateCartItemSchema = z.object({
    quantity: z.number().min(0).max(10)
  })

  // Helper function to get or create cart
  const getCart = (sessionId) => {
    if (!carts.has(sessionId)) {
      carts.set(sessionId, {
        sessionId,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }
    return carts.get(sessionId)
  }

  // POST /api/cart/add - Add item to cart
  fastify.post('/cart/add', {
    schema: {
      tags: ['Cart'],
      description: 'Add item to cart',
      body: {
        type: 'object',
        required: ['sessionId', 'productId', 'size', 'quantity', 'price'],
        properties: {
          sessionId: { type: 'string' },
          productId: { type: 'string' },
          size: { type: 'string' },
          quantity: { type: 'number', minimum: 1, maximum: 10 },
          price: { type: 'number' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            cart: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const data = addToCartSchema.parse(request.body)
    const cart = getCart(data.sessionId)

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.productId === data.productId && item.size === data.size
    )

    if (existingItemIndex >= 0) {
      // Update quantity of existing item
      cart.items[existingItemIndex].quantity += data.quantity
      cart.items[existingItemIndex].updatedAt = new Date().toISOString()
    } else {
      // Add new item to cart
      cart.items.push({
        id: `${data.productId}-${data.size}-${Date.now()}`,
        productId: data.productId,
        size: data.size,
        quantity: data.quantity,
        price: data.price,
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }

    cart.updatedAt = new Date().toISOString()

    return {
      success: true,
      cart
    }
  })

    // Get cart items
  fastify.get('/cart/:sessionId', {
    schema: {
      tags: ['cart'],
      summary: 'Get cart items',
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' }
        },
        required: ['sessionId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  productId: { type: 'string' },
                  name: { type: 'string' },
                  price: { type: 'number' },
                  size: { type: 'string' },
                  quantity: { type: 'number' },
                  image: { type: 'string' },
                  total: { type: 'number' }
                }
              }
            },
            totalItems: { type: 'number' },
            totalAmount: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { sessionId } = request.params
    
    try {
      let cartItems = []
      
      if (useSupabase) {
        // Get cart items from Supabase with product details
        const { data, error } = await supabaseAdmin
          .from(TABLES.CART_ITEMS)
          .select(`
            id,
            product_id,
            size,
            quantity,
            price,
            products:product_id (
              name,
              images
            )
          `)
          .eq('session_id', sessionId)
        
        if (error) throw error
        
        cartItems = data.map(item => ({
          id: item.id,
          productId: item.product_id,
          name: item.products?.name || 'Unknown Product',
          price: item.price,
          size: item.size,
          quantity: item.quantity,
          image: item.products?.images?.[0] || '/api/placeholder/400/400',
          total: item.price * item.quantity
        }))
      } else {
        cartItems = memoryCart.get(sessionId) || []
      }
      
      const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)
      const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      
      return {
        items: cartItems,
        totalItems,
        totalAmount
      }
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to fetch cart',
        message: error.message
      })
    }
  })

  // PUT /api/cart/:sessionId/item/:itemId - Update cart item quantity
  fastify.put('/cart/:sessionId/item/:itemId', {
    schema: {
      tags: ['Cart'],
      description: 'Update cart item quantity',
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          itemId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['quantity'],
        properties: {
          quantity: { type: 'number', minimum: 0, maximum: 10 }
        }
      }
    }
  }, async (request, reply) => {
    const { sessionId, itemId } = request.params
    const { quantity } = updateCartItemSchema.parse(request.body)

    const cart = getCart(sessionId)
    const itemIndex = cart.items.findIndex(item => item.id === itemId)

    if (itemIndex === -1) {
      return reply.status(404).send({
        error: 'Item Not Found',
        message: `Cart item with ID '${itemId}' not found`
      })
    }

    if (quantity === 0) {
      // Remove item if quantity is 0
      cart.items.splice(itemIndex, 1)
    } else {
      // Update quantity
      cart.items[itemIndex].quantity = quantity
      cart.items[itemIndex].updatedAt = new Date().toISOString()
    }

    cart.updatedAt = new Date().toISOString()

    const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0)
    const totalValue = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)

    return {
      success: true,
      cart,
      totalItems,
      totalValue
    }
  })

  // DELETE /api/cart/:sessionId/item/:itemId - Remove item from cart
  fastify.delete('/cart/:sessionId/item/:itemId', {
    schema: {
      tags: ['Cart'],
      description: 'Remove item from cart',
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          itemId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { sessionId, itemId } = request.params
    const cart = getCart(sessionId)

    const itemIndex = cart.items.findIndex(item => item.id === itemId)
    if (itemIndex === -1) {
      return reply.status(404).send({
        error: 'Item Not Found',
        message: `Cart item with ID '${itemId}' not found`
      })
    }

    cart.items.splice(itemIndex, 1)
    cart.updatedAt = new Date().toISOString()

    return {
      success: true,
      message: 'Item removed from cart',
      cart
    }
  })

  // DELETE /api/cart/:sessionId - Clear entire cart
  fastify.delete('/cart/:sessionId', {
    schema: {
      tags: ['Cart'],
      description: 'Clear entire cart',
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { sessionId } = request.params
    
    if (carts.has(sessionId)) {
      carts.delete(sessionId)
    }

    return {
      success: true,
      message: 'Cart cleared successfully'
    }
  })

  // GET /api/cart/:sessionId/summary - Get cart summary
  fastify.get('/cart/:sessionId/summary', {
    schema: {
      tags: ['Cart'],
      description: 'Get cart summary with totals',
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { sessionId } = request.params
    const cart = getCart(sessionId)

    const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0)
    const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const shipping = subtotal >= 2000 ? 0 : 150 // Free shipping over ₹2000
    const tax = Math.round(subtotal * 0.18) // 18% GST
    const total = subtotal + shipping + tax

    return {
      sessionId,
      totalItems,
      subtotal,
      shipping,
      tax,
      total,
      freeShippingEligible: subtotal >= 2000,
      freeShippingRemaining: subtotal < 2000 ? 2000 - subtotal : 0
    }
  })
}

export default fp(cartRoutes)
