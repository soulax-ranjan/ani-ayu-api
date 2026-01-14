import fp from 'fastify-plugin'
import { supabaseAdmin, TABLES } from '../lib/supabase.js'

async function bannersRoutes(fastify, options) {
  // Get all banners
  fastify.get('/banners', {
    schema: {
      tags: ['banners'],
      summary: 'Get all banners',
      description: 'Returns all active banners with optional filtering',
      querystring: {
        type: 'object',
        properties: {
          featured: { type: 'boolean', description: 'Filter by featured status' },
          active: { type: 'boolean', default: true, description: 'Filter by active status' },
          limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Limit number of results' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            banners: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  subtitle: { type: 'string' },
                  description: { type: 'string' },
                  image: { type: 'string' },
                  ctaText: { type: 'string' },
                  ctaLink: { type: 'string' },
                  backgroundColor: { type: 'string' },
                  textColor: { type: 'string' },
                  featured: { type: 'boolean' },
                  order: { type: 'number' },
                  is_active: { type: 'boolean' },
                  order_index: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { featured, active = true, limit } = request.query

      // Build query for Supabase
      let query = supabaseAdmin
        .from(TABLES.HOMEPAGE_BANNERS)
        .select(`
          id,
          title,
          subtitle,
          description,
          image_url,
          cta_text,
          cta_link,
          background_color,
          text_color,
          featured,
          display_order,
          active
        `)
        .eq('active', active)
        .order('display_order', { ascending: true })

      // Add featured filter if specified
      if (featured !== undefined) {
        query = query.eq('featured', featured)
      }

      // Add limit if specified
      if (limit) {
        query = query.limit(limit)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching banners:', error)
        throw new Error(`Database query failed: ${error.message}`)
      }

      // Transform database format to API format
      const transformedBanners = (data || []).map(banner => ({
        id: banner.id,
        title: banner.title,
        subtitle: banner.subtitle,
        description: banner.description,
        image: banner.image_url,
        ctaText: banner.cta_text,
        ctaLink: banner.cta_link,
        backgroundColor: banner.background_color,
        textColor: banner.text_color,
        featured: banner.featured,
        order: banner.display_order,
        active: banner.active
      }))

      return { banners: transformedBanners }
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to fetch banners',
        message: error.message
      })
    }
  })

  // Get featured banners only (shortcut endpoint)
  fastify.get('/banners/featured', {
    schema: {
      tags: ['banners'],
      summary: 'Get featured banners',
      description: 'Returns only featured banners for homepage carousel',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            banners: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  subtitle: { type: 'string' },
                  description: { type: 'string' },
                  image: { type: 'string' },
                  ctaText: { type: 'string' },
                  ctaLink: { type: 'string' },
                  backgroundColor: { type: 'string' },
                  textColor: { type: 'string' },
                  featured: { type: 'boolean' },
                  order: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { limit = 5 } = request.query

      const { data, error } = await supabaseAdmin
        .from(TABLES.HOMEPAGE_BANNERS)
        .select(`
          id,
          title,
          subtitle,
          description,
          image_url,
          cta_text,
          cta_link,
          background_color,
          text_color,
          featured,
          display_order,
          active
        `)
        .eq('active', true)
        .eq('featured', true)
        .order('display_order', { ascending: true })
        .limit(limit)

      if (error) {
        console.error('Error fetching featured banners:', error)
        throw new Error(`Database query failed: ${error.message}`)
      }

      // Transform database format to API format
      const transformedBanners = (data || []).map(banner => ({
        id: banner.id,
        title: banner.title,
        subtitle: banner.subtitle,
        description: banner.description,
        image: banner.image_url,
        ctaText: banner.cta_text,
        ctaLink: banner.cta_link,
        backgroundColor: banner.background_color,
        textColor: banner.text_color,
        featured: banner.featured,
        order: banner.display_order
      }))

      return { banners: transformedBanners }
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to fetch featured banners',
        message: error.message
      })
    }
  })
  // POST /banners - Create a new banner
  fastify.post('/banners', {
    schema: {
      tags: ['Banners'],
      description: 'Create a new homepage banner',
      body: {
        type: 'object',
        required: ['title', 'image'],
        properties: {
          title: { type: 'string' },
          subtitle: { type: 'string' },
          description: { type: 'string' },
          image: { type: 'string' },
          ctaText: { type: 'string' },
          ctaLink: { type: 'string' },
          backgroundColor: { type: 'string' },
          textColor: { type: 'string' },
          featured: { type: 'boolean', default: false },
          active: { type: 'boolean', default: true },
          order: { type: 'integer', default: 0 }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            banner: { 
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                subtitle: { type: 'string' },
                description: { type: 'string' },
                image: { type: 'string' },
                ctaText: { type: 'string' },
                ctaLink: { type: 'string' },
                backgroundColor: { type: 'string' },
                textColor: { type: 'string' },
                featured: { type: 'boolean' },
                order: { type: 'number' },
                active: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const bannerData = request.body

      const { data: banner, error } = await supabaseAdmin
        .from(TABLES.HOMEPAGE_BANNERS)
        .insert({
          title: bannerData.title,
          subtitle: bannerData.subtitle,
          description: bannerData.description,
          image_url: bannerData.image,
          cta_text: bannerData.ctaText,
          cta_link: bannerData.ctaLink,
          background_color: bannerData.backgroundColor,
          text_color: bannerData.textColor,
          featured: bannerData.featured,
          active: bannerData.active !== undefined ? bannerData.active : true,
          display_order: bannerData.order
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating banner:', error)
        return reply.status(500).send({ 
          error: 'Database error', 
          message: error.message 
        })
      }

      // Transform response
      const transformedBanner = {
        id: banner.id,
        title: banner.title,
        subtitle: banner.subtitle,
        description: banner.description,
        image: banner.image_url,
        ctaText: banner.cta_text,
        ctaLink: banner.cta_link,
        backgroundColor: banner.background_color,
        textColor: banner.text_color,
        featured: banner.featured,
        order: banner.display_order,
        active: banner.active
      }

      console.log('Banner created:', transformedBanner)

      return reply.status(201).send({
        success: true,
        banner: transformedBanner
      })

    } catch (error) {
      console.error('Create banner error:', error)
      return reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  // PUT /banners/:id - Update an existing banner
  fastify.put('/banners/:id', {
    schema: {
      tags: ['Banners'],
      description: 'Update a homepage banner',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          subtitle: { type: 'string' },
          description: { type: 'string' },
          image: { type: 'string' },
          ctaText: { type: 'string' },
          ctaLink: { type: 'string' },
          backgroundColor: { type: 'string' },
          textColor: { type: 'string' },
          featured: { type: 'boolean' },
          active: { type: 'boolean' },
          order: { type: 'integer' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            banner: { 
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                subtitle: { type: 'string' },
                description: { type: 'string' },
                image: { type: 'string' },
                ctaText: { type: 'string' },
                ctaLink: { type: 'string' },
                backgroundColor: { type: 'string' },
                textColor: { type: 'string' },
                featured: { type: 'boolean' },
                order: { type: 'number' },
                active: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const updateData = request.body

      // Prepare Supabase update object (mapping camelCase to snake_case)
      const dbUpdate = {}
      if (updateData.title !== undefined) dbUpdate.title = updateData.title
      if (updateData.subtitle !== undefined) dbUpdate.subtitle = updateData.subtitle
      if (updateData.description !== undefined) dbUpdate.description = updateData.description
      if (updateData.image !== undefined) dbUpdate.image_url = updateData.image
      if (updateData.ctaText !== undefined) dbUpdate.cta_text = updateData.ctaText
      if (updateData.ctaLink !== undefined) dbUpdate.cta_link = updateData.ctaLink
      if (updateData.backgroundColor !== undefined) dbUpdate.background_color = updateData.backgroundColor
      if (updateData.textColor !== undefined) dbUpdate.text_color = updateData.textColor
      if (updateData.featured !== undefined) dbUpdate.featured = updateData.featured
      if (updateData.active !== undefined) dbUpdate.active = updateData.active
      if (updateData.order !== undefined) dbUpdate.display_order = updateData.order
      
      dbUpdate.updated_at = new Date().toISOString()

      const { data: banner, error } = await supabaseAdmin
        .from(TABLES.HOMEPAGE_BANNERS)
        .update(dbUpdate)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating banner:', error)
        return reply.status(500).send({ 
          error: 'Database error', 
          message: error.message 
        })
      }
      
      if (!banner) return reply.status(404).send({ error: 'Banner not found' })

      // Transform response
      const transformedBanner = {
        id: banner.id,
        title: banner.title,
        subtitle: banner.subtitle,
        description: banner.description,
        image: banner.image_url,
        ctaText: banner.cta_text,
        ctaLink: banner.cta_link,
        backgroundColor: banner.background_color,
        textColor: banner.text_color,
        featured: banner.featured,
        order: banner.display_order,
        active: banner.active
      }

      return {
        success: true,
        banner: transformedBanner
      }

    } catch (error) {
      console.error('Update banner error:', error)
      return reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })
}

// export default fp(bannersRoutes, {
//   name: 'banners-routes'
// })
export default bannersRoutes