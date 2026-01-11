import fp from 'fastify-plugin'
import { supabaseAdmin, TABLES, handleSupabaseError } from '../lib/supabase.js'

async function addressRoutes(fastify, options) {
  const { z } = await import('zod')

  // Validation schemas
  const addressSchema = z.object({
    fullName: z.string().min(1),
    phone: z.string().min(10),
    email: z.string().email().optional(), // Added email for guests
    addressLine1: z.string().min(1),
    addressLine2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    country: z.string().min(1),
    postalCode: z.string().min(1),
    isDefault: z.boolean().default(false).optional()
  })

  // Helper to get owner params
  const getOwnerParams = (request) => {
    const userId = request.user?.sub
    const guestId = request.cookies.guest_id
    if (!userId && !guestId) {
       throw { status: 401, message: 'Unauthorized' }
    }
    return { userId, guestId }
  }

  // POST /addresses - Create new address
  fastify.post('/addresses', {
    preHandler: [fastify.authenticateOptional],
    schema: {
      tags: ['Addresses'],
      description: 'Create a new address',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['fullName', 'phone', 'addressLine1', 'city', 'state', 'country', 'postalCode'],
        properties: {
          fullName: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string', format: 'email' },
          addressLine1: { type: 'string' },
          addressLine2: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          country: { type: 'string' },
          postalCode: { type: 'string' },
          isDefault: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const body = addressSchema.parse(request.body)
      const { userId, guestId } = getOwnerParams(request)

      // If set as default, unset other default addresses
      if (body.isDefault) {
        let query = supabaseAdmin
          .from(TABLES.ADDRESSES)
          .update({ is_default: false })
        
        if (userId) query = query.eq('user_id', userId)
        else query = query.eq('guest_id', guestId)
          
        await query
      }

      // Check if this is the first address, if so make it default
      if (body.isDefault === undefined || body.isDefault === false) {
        let query = supabaseAdmin
          .from(TABLES.ADDRESSES)
          .select('*', { count: 'exact', head: true })
        
         if (userId) query = query.eq('user_id', userId)
         else query = query.eq('guest_id', guestId)

        const { count } = await query
        if (count === 0) {
          body.isDefault = true
        }
      }

      const { data, error } = await supabaseAdmin
        .from(TABLES.ADDRESSES)
        .insert({
          user_id: userId || null,
          guest_id: userId ? null : guestId,
          full_name: body.fullName,
          phone: body.phone,
          email: body.email || null,
          address_line1: body.addressLine1,
          address_line2: body.addressLine2,
          city: body.city,
          state: body.state,
          country: body.country,
          postal_code: body.postalCode,
          is_default: body.isDefault
        })
        .select()
        .single()

      if (error) {
        return handleSupabaseError(error, reply)
      }

      return {
        success: true,
        address: data
      }

    } catch (error) {
      if (error.status === 401) return reply.status(401).send(error)
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: error.errors
        })
      }
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create address'
      })
    }
  })

  // GET /addresses - Get all addresses
  fastify.get('/addresses', {
    preHandler: [fastify.authenticateOptional],
    schema: {
      tags: ['Addresses'],
      description: 'Get all user addresses',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { userId, guestId } = getOwnerParams(request)

      let query = supabaseAdmin
        .from(TABLES.ADDRESSES)
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

      if (userId) query = query.eq('user_id', userId)
      else query = query.eq('guest_id', guestId)

      const { data: addresses, error } = await query

      if (error) {
        return handleSupabaseError(error, reply)
      }

      return {
        addresses: addresses || []
      }
    } catch (error) {
        if (error.status === 401) return { addresses: [] }
        return reply.status(500).send(error)
    }
  })

  // PUT /addresses/:id - Update address
  fastify.put('/addresses/:id', {
    preHandler: [fastify.authenticateOptional],
    schema: {
      tags: ['Addresses'],
      description: 'Update an address',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          fullName: { type: 'string' },
          phone: { type: 'string' },
          addressLine1: { type: 'string' },
          addressLine2: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          country: { type: 'string' },
          postalCode: { type: 'string' },
          isDefault: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const { userId, guestId } = getOwnerParams(request)
      const updateSchema = addressSchema.partial()
      const body = updateSchema.parse(request.body)

      // Verify ownership
      let checkQuery = supabaseAdmin
        .from(TABLES.ADDRESSES)
        .select('id')
        .eq('id', id)
      
      if (userId) checkQuery = checkQuery.eq('user_id', userId)
      else checkQuery = checkQuery.eq('guest_id', guestId)

      const { data: existing } = await checkQuery.single()

      if (!existing) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Address not found'
        })
      }

      // Handle default address update
      if (body.isDefault) {
        let unsetQuery = supabaseAdmin
          .from(TABLES.ADDRESSES)
          .update({ is_default: false })
        
        if (userId) unsetQuery = unsetQuery.eq('user_id', userId)
        else unsetQuery = unsetQuery.eq('guest_id', guestId)
        
        await unsetQuery
      }

      const { data, error } = await supabaseAdmin
        .from(TABLES.ADDRESSES)
        .update({
          full_name: body.fullName,
          phone: body.phone,
          address_line1: body.addressLine1,
          address_line2: body.addressLine2,
          city: body.city,
          state: body.state,
          country: body.country,
          postal_code: body.postalCode,
          is_default: body.isDefault
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        return handleSupabaseError(error, reply)
      }

      return {
        success: true,
        address: data
      }

    } catch (error) {
      if (error.status === 401) return reply.status(401).send(error)
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: error.errors
        })
      }
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update address'
      })
    }
  })

  // DELETE /addresses/:id - Delete address
  fastify.delete('/addresses/:id', {
    preHandler: [fastify.authenticateOptional],
    schema: {
      tags: ['Addresses'],
      description: 'Delete an address',
      security: [{ bearerAuth: [] }],
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
        const { userId, guestId } = getOwnerParams(request)

        let query = supabaseAdmin
        .from(TABLES.ADDRESSES)
        .delete()
        .eq('id', id)

        if (userId) query = query.eq('user_id', userId)
        else query = query.eq('guest_id', guestId)

        const { error } = await query

        if (error) {
        return handleSupabaseError(error, reply)
        }

        return {
        success: true,
        message: 'Address deleted successfully'
        }
    } catch (error) {
        if (error.status === 401) return reply.status(401).send(error)
        return reply.status(500).send(error)
    }
  })

  // PATCH /addresses/:id/default - Set as default address
  fastify.patch('/addresses/:id/default', {
    preHandler: [fastify.authenticateOptional],
    schema: {
      tags: ['Addresses'],
      description: 'Set address as default',
      security: [{ bearerAuth: [] }],
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
        const { userId, guestId } = getOwnerParams(request)

        // Verify ownership
        let checkQuery = supabaseAdmin
        .from(TABLES.ADDRESSES)
        .select('id')
        .eq('id', id)

        if (userId) checkQuery = checkQuery.eq('user_id', userId)
        else checkQuery = checkQuery.eq('guest_id', guestId)

        const { data: existing } = await checkQuery.single()

        if (!existing) {
        return reply.status(404).send({
            error: 'Not Found',
            message: 'Address not found'
        })
        }

        // Unset other defaults
        let unsetQuery = supabaseAdmin
        .from(TABLES.ADDRESSES)
        .update({ is_default: false })

        if (userId) unsetQuery = unsetQuery.eq('user_id', userId)
        else unsetQuery = unsetQuery.eq('guest_id', guestId)
        
        await unsetQuery

        // Set new default
        const { data, error } = await supabaseAdmin
        .from(TABLES.ADDRESSES)
        .update({ is_default: true })
        .eq('id', id)
        .select()
        .single()

        if (error) {
        return handleSupabaseError(error, reply)
        }

        return {
        success: true,
        address: data
        }
    }  catch (error) {
        if (error.status === 401) return reply.status(401).send(error)
        return reply.status(500).send(error)
    }
  })
}

export default fp(addressRoutes)
