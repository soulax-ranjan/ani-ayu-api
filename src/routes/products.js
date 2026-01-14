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

  // POST /api/products - Create a new product
  fastify.post('/products', {
    // Only allow authenticated users to create products
    // onRequest: [fastify.authenticate], 
    schema: {
      tags: ['Products'],
      description: 'Create a new product with all details',
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' },
          short_description: { type: 'string' },
          price: { type: 'number' },
          original_price: { type: 'number' },
          discount_percent: { type: 'number' },
          currency: { type: 'string', default: 'INR' },
          image_url: { type: 'string' },
          images: { type: 'array', items: { type: 'string' } },
          video_url: { type: 'string' },
          sizes: { type: 'array', items: { type: 'string' } },
          colors: { type: 'array', items: { type: 'string' } },
          category_id: { type: 'string', format: 'uuid' },
          material: { type: 'string' },
          occasion: { type: 'string' },
          age_range: { type: 'string' },
          features: { type: 'array', items: { type: 'string' } },
          in_stock: { type: 'boolean' },
          featured: { type: 'boolean' },
          sku: { type: 'string' },
          barcode: { type: 'string' },
          brand: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          specifications: { type: 'object' },
          stock_quantity: { type: 'number' },
          low_stock_threshold: { type: 'number' },
          shipping_weight: { type: 'number' },
          dimensions: { type: 'object' },
          return_policy: { type: 'string' },
          warranty: { type: 'string' },
          meta_title: { type: 'string' },
          meta_description: { type: 'string' },
          meta_keywords: { type: 'string' },
          status: { type: 'string', enum: ['active', 'draft', 'archived'] },
          customizable: { type: 'boolean' },
          section: { type: 'number', default: 0 }
        },
        required: ['name', 'price', 'category_id']
      }
    }
  }, async (request, reply) => {
    try {
      const zBody = z.object({
        name: z.string().min(1),
        slug: z.string().optional(),
        description: z.string().optional(),
        short_description: z.string().optional(),
        price: z.number().min(0),
        original_price: z.number().optional(),
        discount_percent: z.number().optional(),
        currency: z.string().default('INR').optional(),
        image_url: z.string().url().optional(),
        images: z.array(z.string().url()).optional(),
        video_url: z.string().url().optional(),
        sizes: z.array(z.string()).optional(),
        colors: z.array(z.string()).optional(),
        category_id: z.string().uuid(),
        material: z.string().optional(),
        occasion: z.string().optional(),
        age_range: z.string().optional(),
        features: z.array(z.string()).optional(),
        in_stock: z.boolean().default(true).optional(),
        featured: z.boolean().default(false).optional(),
        // stock_quantity: z.number().int().min(0).default(0).optional(), // Removing to match requested fields explicitly
        sku: z.string().optional(),
        barcode: z.string().optional(),
        brand: z.string().optional(),
        tags: z.array(z.string()).optional(),
        specifications: z.record(z.any()).optional(),
        stock_quantity: z.number().int().min(0).optional(),
        low_stock_threshold: z.number().int().min(0).optional(),
        shipping_weight: z.number().min(0).optional(),
        dimensions: z.record(z.any()).optional(),
        return_policy: z.string().optional(),
        warranty: z.string().optional(),
        meta_title: z.string().optional(),
        meta_description: z.string().optional(),
        meta_keywords: z.string().optional(),
        status: z.enum(['active', 'draft', 'archived']).default('active').optional(),
        customizable: z.boolean().default(false).optional(),
        section: z.number().int().min(0).default(0).optional()
      })

      const body = zBody.parse(request.body)

      // Auto-generate slug if not provided
      if (!body.slug && body.name) {
        body.slug = body.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '') + 
          '-' + Math.random().toString(36).substring(2, 7)
      }

      // Insert into database
      const { data, error } = await supabaseAdmin
        .from(TABLES.PRODUCTS)
        .insert([body])
        .select()
        .single()

      if (error) {
        return handleSupabaseError(error, reply)
      }

      reply.code(201).send({
        success: true,
        message: 'Product created successfully',
        product: data
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: error.errors
        })
      }
      
      console.error('Create product error:', error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create product'
      })
    }
  })

  // PUT /api/products/:id - Update a product
  fastify.put('/products/:id', {
    schema: {
      tags: ['Products'],
      description: 'Update an existing product',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' },
          short_description: { type: 'string' },
          price: { type: 'number' },
          original_price: { type: 'number' },
          discount_percent: { type: 'number' },
          currency: { type: 'string' },
          image_url: { type: 'string' },
          images: { type: 'array', items: { type: 'string' } },
          video_url: { type: 'string' },
          sizes: { type: 'array', items: { type: 'string' } },
          colors: { type: 'array', items: { type: 'string' } },
          category_id: { type: 'string', format: 'uuid' },
          material: { type: 'string' },
          occasion: { type: 'string' },
          age_range: { type: 'string' },
          features: { type: 'array', items: { type: 'string' } },
          in_stock: { type: 'boolean' },
          featured: { type: 'boolean' },
          sku: { type: 'string' },
          barcode: { type: 'string' },
          brand: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          specifications: { type: 'object' },
          stock_quantity: { type: 'number' },
          low_stock_threshold: { type: 'number' },
          shipping_weight: { type: 'number' },
          dimensions: { type: 'object' },
          return_policy: { type: 'string' },
          warranty: { type: 'string' },
          meta_title: { type: 'string' },
          meta_description: { type: 'string' },
          meta_keywords: { type: 'string' },
          status: { type: 'string', enum: ['active', 'draft', 'archived'] },
          customizable: { type: 'boolean' },
          section: { type: 'number' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params
      
      const zBody = z.object({
        name: z.string().min(1).optional(),
        slug: z.string().optional(),
        description: z.string().optional(),
        short_description: z.string().optional(),
        price: z.number().min(0).optional(),
        original_price: z.number().optional(),
        discount_percent: z.number().optional(),
        currency: z.string().optional(),
        image_url: z.string().url().optional(),
        images: z.array(z.string().url()).optional(),
        video_url: z.string().url().optional(),
        sizes: z.array(z.string()).optional(),
        colors: z.array(z.string()).optional(),
        category_id: z.string().uuid().optional(),
        material: z.string().optional(),
        occasion: z.string().optional(),
        age_range: z.string().optional(),
        features: z.array(z.string()).optional(),
        in_stock: z.boolean().optional(),
        featured: z.boolean().optional(),
        sku: z.string().optional(),
        barcode: z.string().optional(),
        brand: z.string().optional(),
        tags: z.array(z.string()).optional(),
        specifications: z.record(z.any()).optional(),
        stock_quantity: z.number().int().min(0).optional(),
        low_stock_threshold: z.number().int().min(0).optional(),
        shipping_weight: z.number().min(0).optional(),
        dimensions: z.record(z.any()).optional(),
        return_policy: z.string().optional(),
        warranty: z.string().optional(),
        meta_title: z.string().optional(),
        meta_description: z.string().optional(),
        meta_keywords: z.string().optional(),
        status: z.enum(['active', 'draft', 'archived']).optional(),
        customizable: z.boolean().optional(),
        section: z.number().int().min(0).optional()
      })

      const body = zBody.parse(request.body)

      // If slug is updated, check for uniqueness (excluding current product)
      if (body.slug) {
        const { data: existing } = await supabaseAdmin
          .from(TABLES.PRODUCTS)
          .select('id')
          .eq('slug', body.slug)
          .neq('id', id)
          .single()

        if (existing) {
          // If collision, append random string
          body.slug = `${body.slug}-${Math.random().toString(36).substring(2, 7)}`
        }
      }

      const { data, error } = await supabaseAdmin
        .from(TABLES.PRODUCTS)
        .update(body)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        return handleSupabaseError(error, reply)
      }

      if (!data) {
        return reply.status(404).send({
          error: 'Product Not Found',
          message: `Product with ID '${id}' not found`
        })
      }

      return {
        success: true,
        message: 'Product updated successfully',
        product: data
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: error.errors
        })
      }
      
      console.error('Update product error:', error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update product'
      })
    }
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
        customizable,
        section
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
        customizable,
        section
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

  // DELETE /api/products/:id - Delete product
  fastify.delete('/products/:id', {
    schema: {
      tags: ['Products'],
      description: 'Delete a product',
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
            success: { type: 'boolean' },
            message: { type: 'string' }
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
    try {
      const { id } = request.params

      // Check if product exists
      const { data: product, error: fetchError } = await supabaseAdmin
        .from(TABLES.PRODUCTS)
        .select('id')
        .eq('id', id)
        .single()

      if (fetchError || !product) {
         return reply.status(404).send({
          error: 'Product Not Found',
          message: `Product with ID '${id}' not found`
        })
      }

      // Delete the product
      const { error: deleteError } = await supabaseAdmin
        .from(TABLES.PRODUCTS)
        .delete()
        .eq('id', id)

      if (deleteError) {
        return handleSupabaseError(deleteError, reply)
      }

      return {
        success: true,
        message: 'Product deleted successfully'
      }

    } catch (error) {
       return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete product'
      })
    }
  })
}

export default productRoutes
