import { supabaseAdmin, TABLES, handleSupabaseError } from '../lib/supabase.js'

async function productRoutes(fastify, options) {
  console.log('📦 Products route handler called')
  
  // Add route logging for debugging
  fastify.addHook('onRoute', (routeOptions) => {
    console.log(`🔗 Route added: ${routeOptions.method} ${routeOptions.url}`)
  })
  
  const { z } = await import('zod')

  // Validation schemas
  const querySchema = z.object({
    category: z.string().optional(),
    minPrice: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? Number(val) : val).optional(),
    maxPrice: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? Number(val) : val).optional(),
    size: z.string().optional(),
    inStock: z.union([z.string(), z.boolean()]).transform(val => typeof val === 'string' ? val === 'true' : val).optional(),
    featured: z.union([z.string(), z.boolean()]).transform(val => typeof val === 'string' ? val === 'true' : val).optional(),
    search: z.string().optional(),
    sort: z.enum(['price-asc', 'price-desc', 'name', 'rating', 'newest']).optional(),
    limit: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? Number(val) : val).optional(),
    offset: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? Number(val) : val).default(0)
  })

  // GET /api/products - Get all products with filtering and sorting
  console.log('📦 Registering GET /products route')
  fastify.get('/products', {
    schema: {
      tags: ['Products'],
      description: 'Get all products with optional filtering and sorting',
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Filter by category slug' },
          minPrice: { type: 'number', description: 'Minimum price filter' },
          maxPrice: { type: 'number', description: 'Maximum price filter' },
          size: { type: 'string', description: 'Filter by available size' },
          inStock: { type: 'boolean', description: 'Filter by stock status' },
          featured: { type: 'boolean', description: 'Filter featured products' },
          search: { type: 'string', description: 'Search in product name and description' },
          sort: { 
            type: 'string', 
            enum: ['price-asc', 'price-desc', 'name', 'rating', 'newest'],
            description: 'Sort products' 
          },
          limit: { type: 'number', description: 'Number of products to return (optional, returns all if not specified)' },
          offset: { type: 'number', default: 0, description: 'Number of products to skip' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Handle empty query params gracefully
      const query = request.query || {}
      
      // Parse and validate query params only if they exist
      let parsedQuery = {}
      try {
        parsedQuery = querySchema.parse(query)
      } catch (validationError) {
        // If validation fails, use default values
        parsedQuery = {
          offset: 0,
          // All other fields will be undefined
        }
      }
      
      // Build Supabase query with enhanced fields
      let supabaseQuery = supabaseAdmin.from(TABLES.PRODUCTS).select(`
        id,
        name,
        slug,
        description,
        short_description,
        price,
        original_price,
        discount_percent,
        currency,
        image_url,
        images,
        video_url,
        sizes,
        colors,
        category_id,
        material,
        occasion,
        age_range,
        features,
        in_stock,
        featured,
        rating,
        review_count,
        created_at,
        updated_at,
        sku,
        barcode,
        brand,
        tags,
        specifications,
        stock_quantity,
        low_stock_threshold,
        shipping_weight,
        dimensions,
        return_policy,
        warranty,
        meta_title,
        meta_description,
        meta_keywords,
        status,
        customizable
      `)

      // Apply filters to Supabase query
      if (parsedQuery.category) {
        supabaseQuery = supabaseQuery.eq('category_id', parsedQuery.category)
      }

      if (parsedQuery.minPrice !== undefined) {
        supabaseQuery = supabaseQuery.gte('price', parsedQuery.minPrice)
      }

      if (parsedQuery.maxPrice !== undefined) {
        supabaseQuery = supabaseQuery.lte('price', parsedQuery.maxPrice)
      }

      if (parsedQuery.inStock !== undefined) {
        supabaseQuery = supabaseQuery.eq('in_stock', parsedQuery.inStock)
      }

      if (parsedQuery.featured !== undefined) {
        supabaseQuery = supabaseQuery.eq('featured', parsedQuery.featured)
      }

      if (parsedQuery.search) {
        supabaseQuery = supabaseQuery.or(`name.ilike.%${parsedQuery.search}%,description.ilike.%${parsedQuery.search}%`)
      }

      if (parsedQuery.size) {
        supabaseQuery = supabaseQuery.contains('sizes', [parsedQuery.size])
      }

      // Apply sorting
      switch (parsedQuery.sort) {
        case 'price-asc':
          supabaseQuery = supabaseQuery.order('price', { ascending: true })
          break
        case 'price-desc':
          supabaseQuery = supabaseQuery.order('price', { ascending: false })
          break
        case 'name':
          supabaseQuery = supabaseQuery.order('name', { ascending: true })
          break
        case 'rating':
          supabaseQuery = supabaseQuery.order('rating', { ascending: false })
          break
        case 'newest':
          supabaseQuery = supabaseQuery.order('created_at', { ascending: false })
          break
        default:
          // Default sort by featured first, then by rating
          supabaseQuery = supabaseQuery.order('featured', { ascending: false })
          supabaseQuery = supabaseQuery.order('rating', { ascending: false })
      }

      // Apply pagination only if limit is specified
      if (parsedQuery.limit) {
        supabaseQuery = supabaseQuery.range(parsedQuery.offset, parsedQuery.offset + parsedQuery.limit - 1)
      }

      const { data: products, error, count } = await supabaseQuery

      if (error) {
        const supabaseError = handleSupabaseError(error)
        return reply.status(500).send(supabaseError)
      }

      // Get total count for pagination
      const { count: totalCount } = await supabaseAdmin
        .from(TABLES.PRODUCTS)
        .select('*', { count: 'exact', head: true })

      const totalPages = parsedQuery.limit ? Math.ceil((totalCount || 0) / parsedQuery.limit) : 1
      const currentPage = parsedQuery.limit ? Math.floor(parsedQuery.offset / parsedQuery.limit) + 1 : 1

      return {
        products: products || [],
        pagination: {
          page: currentPage,
          limit: parsedQuery.limit || totalCount || 0,
          total: totalCount || 0,
          totalPages,
          hasNext: currentPage < totalPages,
          hasPrev: currentPage > 1
        },
        filters: {
          category: parsedQuery.category,
          minPrice: parsedQuery.minPrice,
          maxPrice: parsedQuery.maxPrice,
          sort: parsedQuery.sort
        }
      }
    } catch (error) {
      console.error('Products route error:', error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch products'
      })
    }
  })

  // GET /api/products/:id - Get single product by ID
  fastify.get('/products/:id', {
    schema: {
      tags: ['Products'],
      description: 'Get a single product by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params

    const { data: product, error } = await supabaseAdmin
      .from(TABLES.PRODUCTS)
      .select(`
        id,
        name,
        slug,
        description,
        short_description,
        price,
        original_price,
        discount_percent,
        currency,
        image_url,
        images,
        video_url,
        sizes,
        colors,
        category_id,
        material,
        occasion,
        age_range,
        features,
        in_stock,
        featured,
        rating,
        review_count,
        created_at,
        updated_at,
        sku,
        barcode,
        brand,
        tags,
        specifications,
        stock_quantity,
        low_stock_threshold,
        shipping_weight,
        dimensions,
        return_policy,
        warranty,
        meta_title,
        meta_description,
        meta_keywords,
        status,
        customizable
      `)
      .eq('id', id)
      .single()

    if (error) {
      return handleSupabaseError(error, reply)
    }

    if (!product) {
      return reply.status(404).send({
        error: 'Product Not Found',
        message: `Product with ID '${id}' not found`
      })
    }

    return product
  })

  // GET /api/products/category/:category - Get products by category
  fastify.get('/products/category/:category', {
    schema: {
      tags: ['Products'],
      description: 'Get products by category slug',
      params: {
        type: 'object',
        properties: {
          category: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 50 },
          offset: { type: 'number', default: 0 }
        }
      }
    }
  }, async (request, reply) => {
    const { category } = request.params
    const { limit = 50, offset = 0 } = request.query

    const { data: products, error } = await supabaseAdmin
      .from(TABLES.PRODUCTS)
      .select(`
        *,
        categories!inner(name, slug)
      `)
      .eq('categories.slug', category)
      .range(offset, offset + limit - 1)

    if (error) {
      const supabaseError = handleSupabaseError(error)
      return reply.status(500).send(supabaseError)
    }

    return {
      products: products || [],
      total: products?.length || 0,
      offset,
      limit,
      category
    }
  })

  // GET /api/products/:id/related - Get related products
  fastify.get('/products/:id/related', {
    schema: {
      tags: ['Products'],
      description: 'Get products related to a specific product',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 4 }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params
    const { limit = 4 } = request.query

    // First get the current product to know its category
    const { data: product, error: productError } = await supabaseAdmin
      .from(TABLES.PRODUCTS)
      .select('category_id')
      .eq('id', id)
      .single()

    if (productError || !product) {
      return reply.status(404).send({
        error: 'Product Not Found',
        message: `Product with ID '${id}' not found`
      })
    }

    // Get related products from same category
    const { data: relatedProducts, error } = await supabaseAdmin
      .from(TABLES.PRODUCTS)
      .select(`
        *,
        categories(name, slug)
      `)
      .eq('category_id', product.category_id)
      .neq('id', id)
      .order('rating', { ascending: false })
      .limit(limit)

    if (error) {
      const supabaseError = handleSupabaseError(error)
      return reply.status(500).send(supabaseError)
    }

    return {
      products: relatedProducts || [],
      total: relatedProducts?.length || 0
    }
  })
}

export default productRoutes
