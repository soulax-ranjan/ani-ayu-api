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
}

// export default fp(bannersRoutes, {
//   name: 'banners-routes'
// })
export default bannersRoutes