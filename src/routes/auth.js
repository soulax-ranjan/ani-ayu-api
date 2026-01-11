import fp from 'fastify-plugin'
import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import { supabaseAdmin, TABLES, handleSupabaseError } from '../lib/supabase.js'

async function authRoutes(fastify, options) {
  const { z } = await import('zod')

  // Validation schemas
  const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: z.string().optional()
  })

  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
  })

  // Helper to merge carts
  const mergeCarts = async (userId, guestId) => {
    if (!guestId) return

    // Get guest cart
    const { data: guestCart } = await supabaseAdmin
      .from(TABLES.CARTS)
      .select('id, cart_items(*)')
      .eq('guest_id', guestId)
      .single()

    if (!guestCart) return

    // Get or create user cart
    let { data: userCart } = await supabaseAdmin
      .from(TABLES.CARTS)
      .select('id')
      .eq('user_id', userId)
      .single()

    if (!userCart) {
      const { data: newCart } = await supabaseAdmin
        .from(TABLES.CARTS)
        .insert({ user_id: userId })
        .select()
        .single()
      userCart = newCart
    }

    // Merge items
    if (guestCart.cart_items && guestCart.cart_items.length > 0) {
      for (const item of guestCart.cart_items) {
        let query = supabaseAdmin
          .from(TABLES.CART_ITEMS)
          .select('id, quantity')
          .eq('cart_id', userCart.id)
          .eq('product_id', item.product_id)

        if (item.size) query = query.eq('size', item.size)
        else query = query.is('size', null)

        if (item.color) query = query.eq('color', item.color)
        else query = query.is('color', null)

        const { data: existingItem } = await query.single()

        if (existingItem) {
          // Keep higher quantity rule
          if (item.quantity > existingItem.quantity) {
            await supabaseAdmin
              .from(TABLES.CART_ITEMS)
              .update({ quantity: item.quantity })
              .eq('id', existingItem.id)
          }
        } else {
          // Add missing item
          await supabaseAdmin
            .from(TABLES.CART_ITEMS)
            .insert({
              cart_id: userCart.id,
              product_id: item.product_id,
              quantity: item.quantity,
              size: item.size,
              color: item.color
            })
        }
      }
    }

    // Delete guest cart
    await supabaseAdmin
      .from(TABLES.CARTS)
      .delete()
      .eq('id', guestCart.id)
  }

  // POST /auth/register
  fastify.post('/auth/register', {
    schema: {
      tags: ['Authentication'],
      description: 'Register a new user',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phone: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email, password, firstName, lastName, phone } = registerSchema.parse(request.body)

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10)

      // Create user
      const { data: user, error } = await supabaseAdmin
        .from(TABLES.USERS)
        .insert({
          email,
          password_hash: passwordHash,
          first_name: firstName,
          last_name: lastName,
          phone
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') { // Unique violation
          return reply.status(409).send({
            error: 'Conflict',
            message: 'Email already registered'
          })
        }
        return handleSupabaseError(error, reply)
      }

      // Merge guest cart if exists
      const guestId = request.cookies.guest_id
      if (guestId) {
        await mergeCarts(user.id, guestId)
        reply.clearCookie('guest_id')
      }

      // Generate JWT
      const token = fastify.jwt.sign({ sub: user.id, email: user.email, role: user.role })

      return {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        }
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: error.errors
        })
      }
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Registration failed'
      })
    }
  })

  // POST /auth/login
  fastify.post('/auth/login', {
    schema: {
      tags: ['Authentication'],
      description: 'Login user',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email, password } = loginSchema.parse(request.body)

      // Get user
      const { data: user, error } = await supabaseAdmin
        .from(TABLES.USERS)
        .select('*')
        .eq('email', email)
        .single()

      if (error || !user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid email or password'
        })
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash)
      if (!validPassword) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid email or password'
        })
      }

      // Merge guest cart if exists
      const guestId = request.cookies.guest_id
      if (guestId) {
        await mergeCarts(user.id, guestId)
        reply.clearCookie('guest_id')
      }

      // Generate JWT
      const token = fastify.jwt.sign({ sub: user.id, email: user.email, role: user.role })

      return {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        }
      }
    } catch (error) {
       if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: error.errors
        })
      }
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Login failed'
      })
    }
  })

  // POST /guest/session
  fastify.post('/guest/session', {
    schema: {
      tags: ['Guest'],
      description: 'Start a guest session'
    }
  }, async (request, reply) => {
    // Logic handled by middleware if used, or explicitly here
    // But since we want to be explicit as per request
    const guestId = crypto.randomUUID()
    
    reply.setCookie('guest_id', guestId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })

    return {
      success: true,
      guestId
    }
  })

  // POST /auth/logout
  fastify.post('/auth/logout', {
    schema: {
      tags: ['Authentication'],
      description: 'Logout user'
    }
  }, async (request, reply) => {
    reply.clearCookie('guest_id')
    return {
      success: true,
      message: 'Logged out successfully'
    }
  })
}

export default fp(authRoutes)
