import fp from 'fastify-plugin'

async function orderRoutes(fastify, options) {
  const { z } = await import('zod')

  // In-memory orders storage (in production, use database)
  const orders = new Map()

  // Validation schemas
  const createOrderSchema = z.object({
    sessionId: z.string(),
    customerInfo: z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().min(10),
    }),
    shippingAddress: z.object({
      street: z.string().min(1),
      city: z.string().min(1),
      state: z.string().min(1),
      postalCode: z.string().min(6),
      country: z.string().default('India')
    }),
    billingAddress: z.object({
      street: z.string().min(1),
      city: z.string().min(1),
      state: z.string().min(1),
      postalCode: z.string().min(6),
      country: z.string().default('India')
    }).optional(),
    items: z.array(z.object({
      productId: z.string(),
      size: z.string(),
      quantity: z.number().min(1),
      price: z.number()
    })),
    totals: z.object({
      subtotal: z.number(),
      shipping: z.number(),
      tax: z.number(),
      total: z.number()
    })
  })

  // Helper function to generate order ID
  const generateOrderId = () => {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substr(2, 5)
    return `AN${timestamp}${random}`.toUpperCase()
  }

  // POST /api/orders - Create new order
  fastify.post('/orders', {
    schema: {
      tags: ['Orders'],
      description: 'Create a new order',
      body: {
        type: 'object',
        required: ['sessionId', 'customerInfo', 'shippingAddress', 'items', 'totals'],
        properties: {
          sessionId: { type: 'string' },
          customerInfo: {
            type: 'object',
            required: ['firstName', 'lastName', 'email', 'phone'],
            properties: {
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              email: { type: 'string', format: 'email' },
              phone: { type: 'string' }
            }
          },
          shippingAddress: {
            type: 'object',
            required: ['street', 'city', 'state', 'postalCode'],
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              state: { type: 'string' },
              postalCode: { type: 'string' },
              country: { type: 'string', default: 'India' }
            }
          },
          billingAddress: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              state: { type: 'string' },
              postalCode: { type: 'string' },
              country: { type: 'string' }
            }
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['productId', 'size', 'quantity', 'price'],
              properties: {
                productId: { type: 'string' },
                size: { type: 'string' },
                quantity: { type: 'number' },
                price: { type: 'number' }
              }
            }
          },
          totals: {
            type: 'object',
            required: ['subtotal', 'shipping', 'tax', 'total'],
            properties: {
              subtotal: { type: 'number' },
              shipping: { type: 'number' },
              tax: { type: 'number' },
              total: { type: 'number' }
            }
          }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            order: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const orderData = createOrderSchema.parse(request.body)
    
    const orderId = generateOrderId()
    const order = {
      id: orderId,
      ...orderData,
      status: 'pending',
      paymentStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
    }

    orders.set(orderId, order)

    reply.status(201)
    return {
      success: true,
      order
    }
  })

  // GET /api/orders/:id - Get order by ID
  fastify.get('/orders/:id', {
    schema: {
      tags: ['Orders'],
      description: 'Get order by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: { type: 'object' },
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
    const { id } = request.params
    const order = orders.get(id)

    if (!order) {
      return reply.status(404).send({
        error: 'Order Not Found',
        message: `Order with ID '${id}' not found`
      })
    }

    return order
  })

  // PUT /api/orders/:id/status - Update order status
  fastify.put('/orders/:id/status', {
    schema: {
      tags: ['Orders'],
      description: 'Update order status',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
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
    const { id } = request.params
    const { status } = request.body

    const order = orders.get(id)
    if (!order) {
      return reply.status(404).send({
        error: 'Order Not Found',
        message: `Order with ID '${id}' not found`
      })
    }

    order.status = status
    order.updatedAt = new Date().toISOString()

    // Update payment status if order is confirmed
    if (status === 'confirmed') {
      order.paymentStatus = 'paid'
    }

    orders.set(id, order)

    return {
      success: true,
      order
    }
  })

  // GET /api/orders - Get all orders (for admin)
  fastify.get('/orders', {
    schema: {
      tags: ['Orders'],
      description: 'Get all orders with optional filtering',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          paymentStatus: { type: 'string' },
          limit: { type: 'number', default: 50 },
          offset: { type: 'number', default: 0 }
        }
      }
    }
  }, async (request, reply) => {
    const { status, paymentStatus, limit = 50, offset = 0 } = request.query
    
    let allOrders = Array.from(orders.values())

    // Apply filters
    if (status) {
      allOrders = allOrders.filter(order => order.status === status)
    }

    if (paymentStatus) {
      allOrders = allOrders.filter(order => order.paymentStatus === paymentStatus)
    }

    // Sort by creation date (newest first)
    allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    // Apply pagination
    const total = allOrders.length
    const paginatedOrders = allOrders.slice(offset, offset + limit)

    return {
      orders: paginatedOrders,
      total,
      offset,
      limit
    }
  })
}

export default fp(orderRoutes)
