import { supabaseAdmin, TABLES, handleSupabaseError } from '../lib/supabase.js'
import fp from 'fastify-plugin'

async function categoryRoutes(fastify, options) {
  const { z } = await import('zod')

  // Validation schemas
  const categorySchema = z.object({
    name: z.string().min(1, 'Name is required'),
    slug: z.string().optional(),
    description: z.string().optional(),
    image_url: z.string().url().optional(), // Using image_url to match DB likely convention
    featured: z.boolean().default(false).optional()
  })

  // POST /api/categories - Create a new category
  fastify.post('/categories', {
    schema: {
      tags: ['Categories'],
      description: 'Create a new category',
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' },
          image_url: { type: 'string' },
          featured: { type: 'boolean' }
        },
        required: ['name']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            category: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                slug: { type: 'string' },
                description: { type: 'string' },
                image_url: { type: 'string' },
                featured: { type: 'boolean' },
                created_at: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const body = categorySchema.parse(request.body)

      // Auto-generate slug if not provided
      if (!body.slug) {
        body.slug = body.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '')
      }

      // Check for existing slug
      const { data: existing } = await supabaseAdmin
        .from(TABLES.CATEGORIES)
        .select('id')
        .eq('slug', body.slug)
        .single()

      if (existing) {
        body.slug = `${body.slug}-${Math.floor(Math.random() * 1000)}`
      }

      const { data, error } = await supabaseAdmin
        .from(TABLES.CATEGORIES)
        .insert([body])
        .select()
        .single()

      if (error) {
        return handleSupabaseError(error, reply)
      }

      return reply.code(201).send({
        success: true,
        message: 'Category created successfully',
        category: data
      })

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
        message: 'Failed to create category'
      })
    }
  })

  // GET /api/categories - Get all categories
  fastify.get('/categories', {
    schema: {
      tags: ['Categories'],
      description: 'Get all product categories',
      querystring: {
        type: 'object',
        properties: {
          featured: { type: 'boolean', description: 'Filter featured categories only' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            categories: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  description: { type: 'string' },
                  image_url: { type: 'string' },
                  featured: { type: 'boolean' },
                  created_at: { type: 'string' }
                }
              }
            },
            total: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { featured } = request.query
      
      let query = supabaseAdmin.from(TABLES.CATEGORIES).select('*')
      
      if (featured !== undefined) {
        query = query.eq('featured', featured)
      }

      const { data: categories, error } = await query.order('name')

      if (error) {
        return handleSupabaseError(error, reply)
      }

      return {
        categories: categories || [],
        total: categories?.length || 0
      }
    } catch (error) {
       return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch categories'
      })
    }
  })

  // GET /api/categories/:id - Get single category
  fastify.get('/categories/:id', {
    schema: {
      tags: ['Categories'],
      description: 'Get a single category by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
            image_url: { type: 'string' },
            featured: { type: 'boolean' },
            created_at: { type: 'string' }
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
    const { id } = request.params

    const { data: category, error } = await supabaseAdmin
      .from(TABLES.CATEGORIES)
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return handleSupabaseError(error, reply)
    }

    if (!category) {
      return reply.status(404).send({
        error: 'Category Not Found',
        message: `Category with ID '${id}' not found`
      })
    }

    return category
  })
}

export default fp(categoryRoutes)
