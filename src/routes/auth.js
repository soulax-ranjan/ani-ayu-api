import fp from 'fastify-plugin'
import { supabase, supabaseAdmin, handleSupabaseError } from '../lib/supabase.js'

async function authRoutes(fastify, options) {
  const { z } = await import('zod')

  // Validation schemas
  const signUpSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional()
  })

  const signInSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
  })

  const resetPasswordSchema = z.object({
    email: z.string().email()
  })

  // POST /api/auth/signup - Register new user
  fastify.post('/auth/signup', {
    schema: {
      tags: ['Authentication'],
      description: 'Register a new user account',
      body: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phone: { type: 'string' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: { type: 'object' },
            session: { type: 'object' }
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
      const userData = signUpSchema.parse(request.body)

      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            first_name: userData.firstName,
            last_name: userData.lastName,
            phone: userData.phone
          }
        }
      })

      if (error) {
        const supabaseError = handleSupabaseError(error)
        return reply.status(400).send(supabaseError)
      }

      reply.status(201)
      return {
        success: true,
        user: data.user,
        session: data.session,
        message: 'Account created successfully. Please check your email for verification.'
      }
    } catch (validationError) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: validationError.message
      })
    }
  })

  // POST /api/auth/signin - Sign in user
  fastify.post('/auth/signin', {
    schema: {
      tags: ['Authentication'],
      description: 'Sign in user with email and password',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: { type: 'object' },
            session: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const credentials = signInSchema.parse(request.body)

      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      })

      if (error) {
        const supabaseError = handleSupabaseError(error)
        return reply.status(401).send(supabaseError)
      }

      return {
        success: true,
        user: data.user,
        session: data.session
      }
    } catch (validationError) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: validationError.message
      })
    }
  })

  // POST /api/auth/signout - Sign out user
  fastify.post('/auth/signout', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Authentication'],
      description: 'Sign out current user',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      const supabaseError = handleSupabaseError(error)
      return reply.status(400).send(supabaseError)
    }

    return {
      success: true,
      message: 'Signed out successfully'
    }
  })

  // POST /api/auth/refresh - Refresh session
  fastify.post('/auth/refresh', {
    schema: {
      tags: ['Authentication'],
      description: 'Refresh user session',
      body: {
        type: 'object',
        required: ['refresh_token'],
        properties: {
          refresh_token: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { refresh_token } = request.body

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token
    })

    if (error) {
      const supabaseError = handleSupabaseError(error)
      return reply.status(401).send(supabaseError)
    }

    return {
      success: true,
      session: data.session
    }
  })

  // POST /api/auth/reset-password - Send password reset email
  fastify.post('/auth/reset-password', {
    schema: {
      tags: ['Authentication'],
      description: 'Send password reset email',
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email } = resetPasswordSchema.parse(request.body)

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.FRONTEND_URL}/reset-password`
      })

      if (error) {
        const supabaseError = handleSupabaseError(error)
        return reply.status(400).send(supabaseError)
      }

      return {
        success: true,
        message: 'Password reset email sent'
      }
    } catch (validationError) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: validationError.message
      })
    }
  })

  // POST /api/auth/update-password - Update user password
  fastify.post('/auth/update-password', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Authentication'],
      description: 'Update user password',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['password'],
        properties: {
          password: { type: 'string', minLength: 6 }
        }
      }
    }
  }, async (request, reply) => {
    const { password } = request.body

    const { error } = await supabase.auth.updateUser({
      password: password
    })

    if (error) {
      const supabaseError = handleSupabaseError(error)
      return reply.status(400).send(supabaseError)
    }

    return {
      success: true,
      message: 'Password updated successfully'
    }
  })

  // GET /api/auth/user - Get current user
  fastify.get('/auth/user', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Authentication'],
      description: 'Get current authenticated user',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    return {
      user: request.user
    }
  })

  // PUT /api/auth/user - Update user profile
  fastify.put('/auth/user', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Authentication'],
      description: 'Update user profile',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phone: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const updates = request.body

    const { data, error } = await supabase.auth.updateUser({
      data: {
        first_name: updates.firstName,
        last_name: updates.lastName,
        phone: updates.phone
      }
    })

    if (error) {
      const supabaseError = handleSupabaseError(error)
      return reply.status(400).send(supabaseError)
    }

    return {
      success: true,
      user: data.user
    }
  })
}

export default fp(authRoutes)
