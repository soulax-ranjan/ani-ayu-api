import fp from 'fastify-plugin'

async function categoryRoutes(fastify, options) {
  // Static categories data
  const categories = [
    {
      id: 'boys',
      name: 'Boys',
      description: 'Traditional ethnic wear for boys',
      image: '/assets/categories/boys.jpg',
      featured: true
    },
    {
      id: 'girls',
      name: 'Girls',
      description: 'Beautiful ethnic wear for girls',
      image: '/assets/categories/girls.jpg',
      featured: true
    },
    {
      id: 'casual',
      name: 'Casual',
      description: 'Comfortable everyday ethnic wear',
      image: '/assets/categories/casual.jpg',
      featured: false
    },
    {
      id: 'wedding',
      name: 'Wedding',
      description: 'Premium wedding collection',
      image: '/assets/categories/wedding.jpg',
      featured: false
    }
  ]

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
                  description: { type: 'string' },
                  image: { type: 'string' },
                  featured: { type: 'boolean' }
                }
              }
            },
            total: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { featured } = request.query
    
    let filteredCategories = categories
    if (featured !== undefined) {
      filteredCategories = categories.filter(cat => cat.featured === featured)
    }

    return {
      categories: filteredCategories,
      total: filteredCategories.length
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
            description: { type: 'string' },
            image: { type: 'string' },
            featured: { type: 'boolean' }
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
    const category = categories.find(cat => cat.id === id)

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
