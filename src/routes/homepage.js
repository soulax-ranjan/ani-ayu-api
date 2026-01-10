import fp from 'fastify-plugin'
import { supabaseAdmin, TABLES } from '../lib/supabase.js'

async function homepageRoutes(fastify, options) {
  // Check if Supabase is configured
  const useSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'your-supabase-url'
  // Configuration
  const API_BASE_URL = `http://localhost:${process.env.PORT || 3002}/api`
  const COMMON_IMAGE_URL = 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp'

  // Homepage banners route - fetch from database only
  fastify.get('/homepage/banners', async (request, reply) => {
    try {
      const { data: banners, error } = await supabaseAdmin
        .from('homepage_banners')
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
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching banners:', error);
        throw error;
      }

      // Transform database format to API format
      const transformedBanners = banners.map(banner => ({
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
      }));

      return { banners: transformedBanners };
    } catch (error) {
      console.error('Database error:', error);
      return reply.status(500).send({
        error: 'Database Error',
        message: 'Failed to fetch banners from database'
      });
    }
  })

  fastify.get('/homepage/best-sellers', async (request, reply) => {
    try {
      const { data: products, error } = await supabaseAdmin
        .from('products')
        .select(`
          id,
          name,
          price,
          original_price,
          image_url,
          rating,
          review_count,
          featured
        `)
        .eq('featured', true)
        .order('rating', { ascending: false })
        .order('review_count', { ascending: false })
        .limit(6);

      if (error) {
        console.error('Error fetching best sellers:', error);
        throw error;
      }

      const bestSellers = products.map((product, index) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        originalPrice: product.original_price,
        image: product.image_url,
        rating: product.rating,
        reviewCount: product.review_count,
        salesCount: Math.floor(product.rating * product.review_count * 10),
        rank: index + 1
      }));

      return { bestSellers };
    } catch (error) {
      console.error('Database error:', error);
      return reply.status(500).send({
        error: 'Database Error',
        message: 'Failed to fetch best sellers from database'
      });
    }
  })

  // Get top picks only
  fastify.get('/homepage/top-picks', {
    schema: {
      tags: ['homepage'],
      summary: 'Get top picks products',
      description: 'Returns curated top picks for homepage',
      response: {
        200: {
          type: 'object',
          properties: {
            topPicks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  price: { type: 'number' },
                  originalPrice: { type: 'number' },
                  image: { type: 'string' },
                  rating: { type: 'number' },
                  reviewCount: { type: 'number' },
                  badge: { type: 'string' },
                  description: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async function (request, reply) {
    try {
      if (useSupabase) {
        // Fetch top picks from products API
        const topPicksResponse = await fetch(`${API_BASE_URL}/products?limit=4`)
        if (topPicksResponse.ok) {
          const result = await topPicksResponse.json()
          const products = result.products || []
          if (products.length === 0) {
            return { topPicks: [], message: "No top picks found", placeholder: "/assets/placeholders/ph-card-4x5.svg" }
          }
          const topPicks = products.map(product => ({
            id: product.id,
            name: product.name,
            price: product.price,
            originalPrice: product.original_price || product.price * 1.25,
            image: product.image_url || '/assets/placeholders/ph-card-4x5.svg',
            rating: product.rating || 4.5,
            reviewCount: product.review_count || 25,
            badge: 'Top Pick',
            description: product.description || `Beautiful ${product.name}`
          }))
          return { topPicks }
        } else {
          return { topPicks: [], message: "Failed to fetch top picks from API", placeholder: "/assets/placeholders/ph-card-4x5.svg" }
        }
      } else {
        return { topPicks: [], message: "Database not configured", placeholder: "/assets/placeholders/ph-card-4x5.svg" }
      }
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch top picks', message: error.message })
    }
  });

  // Get best sellers only (only one definition should exist)

}

export default homepageRoutes;

