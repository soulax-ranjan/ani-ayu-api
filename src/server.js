import Fastify from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import multipart from '@fastify/multipart'
import jwt from '@fastify/jwt'
import dotenv from 'dotenv'
import { supabaseAdmin } from './lib/supabase.js'

// Import route handlers
import productRoutes from './routes/products.js'
import cartRoutes from './routes/cart.js'
import categoryRoutes from './routes/categories.js'
import orderRoutes from './routes/orders.js'
import authRoutes from './routes/auth.js'
import homepageRoutes from './routes/homepage.js'
import bannersRoutes from './routes/banners.js'
import uploadRoutes from './routes/upload.js'

// Load environment variables
dotenv.config()

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info'
  }
})

// Register JWT
await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'your-fallback-secret',
  sign: {
    expiresIn: '7d'
  }
})

// JWT Authentication decorator
fastify.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.send(err)
  }
})

// Optional JWT Authentication decorator (doesn't fail if no token)
fastify.decorate('authenticateOptional', async function (request, reply) {
  try {
    await request.jwtVerify()
  } catch (err) {
    // Don't fail, just continue without user
    request.user = null
  }
})

// Register CORS
await fastify.register(cors, {
  origin: [process.env.FRONTEND_URL || 'http://localhost:3000'],
  credentials: true
})

// Register multipart for file uploads
await fastify.register(multipart)

// Register Swagger for API documentation
await fastify.register(swagger, {
  swagger: {
    info: {
      title: 'Ani & Ayu API',
      description: 'E-commerce API for children\'s ethnic wear',
      version: '1.0.0'
    },
    host: `localhost:${process.env.PORT || 3002}`,
    schemes: ['http'],
    consumes: ['application/json'],
    produces: ['application/json'],
    securityDefinitions: {
      bearerAuth: {
        type: 'apiKey',
        name: 'Authorization',
        in: 'header',
        description: 'Enter JWT token in format: Bearer <token>'
      }
    },
    tags: [
      { name: 'Products', description: 'Product related endpoints' },
      { name: 'Cart', description: 'Shopping cart endpoints' },
      { name: 'Categories', description: 'Category related endpoints' },
      { name: 'Orders', description: 'Order management endpoints' },
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Homepage', description: 'Homepage content endpoints' },
      { name: 'Upload', description: 'Image upload endpoints' }
    ]
  }
})

await fastify.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'full',
    deepLinking: false
  }
})

// Health check endpoint
fastify.get('/', async (request, reply) => {
  return { 
    message: 'Ani & Ayu API Server',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString()
  }
})

fastify.get('/health', async (request, reply) => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  }
})

// Test route to verify API routing works
fastify.get('/api/test', async (request, reply) => {
  return { 
    message: 'API routing works!',
    timestamp: new Date().toISOString()
  }
})

// All routes are now handled by their respective plugin files

// Register route handlers
console.log('🔄 Registering auth routes...')
await fastify.register(authRoutes, { prefix: '/api' })
console.log('🔄 Registering products routes...')
await fastify.register(productRoutes, { prefix: '/api' })
console.log('🔄 Registering cart routes...')
await fastify.register(cartRoutes, { prefix: '/api' })
console.log('🔄 Registering category routes...')
await fastify.register(categoryRoutes, { prefix: '/api' })
console.log('🔄 Registering order routes...')
await fastify.register(orderRoutes, { prefix: '/api' })
console.log('🔄 Registering banners routes...')
await fastify.register(bannersRoutes, { prefix: '/api' })
console.log('🔄 Registering homepage routes...')
await fastify.register(homepageRoutes, { prefix: '/api' })
console.log('🔄 Registering upload routes...')
await fastify.register(uploadRoutes, { prefix: '/api' })
console.log('✅ All routes registered successfully!')

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  const { validation, validationContext } = error

  if (validation) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: `Validation failed for ${validationContext}`,
      details: validation
    })
  }

  request.log.error(error)
  
  return reply.status(error.statusCode || 500).send({
    error: error.name || 'Internal Server Error',
    message: error.message || 'An unexpected error occurred'
  })
})

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3002
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'
    
    await fastify.listen({ port, host })
    
    // Debug: Print all registered routes
    console.log('🔍 All registered routes:')
    fastify.printRoutes()
    
    fastify.log.info(`Server running at http://${host}:${port}`)
    fastify.log.info(`API Documentation: http://${host}:${port}/docs`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
