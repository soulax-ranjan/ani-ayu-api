# Ani & Ayu API

Node.js backend API for the Ani & Ayu e-commerce platform built with Fastify.

## Features

- 🚀 Fast and lightweight with Fastify
- 📝 API documentation with Swagger
- 🛡️ CORS enabled for frontend integration
- 🗄️ Supabase database integration
- 🔐 JWT authentication support
- 📦 Product management APIs
- 🛒 Cart management APIs
- 👤 User management APIs
- 📄 AWS S3 image upload support
- 💳 Razorpay payment integration

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or cloud)

### Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Supabase Configuration (for database)
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# AWS S3 Configuration (for image storage)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_S3_BUCKET_NAME=your-s3-bucket-name

# JWT Configuration
JWT_SECRET=your-jwt-secret-key-here

# Razorpay Configuration
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

See `.env.example` for a complete template.

For detailed AWS S3 setup instructions, see [AWS_S3_SETUP.md](./AWS_S3_SETUP.md).

## API Endpoints

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create new product (admin)
- `PUT /api/products/:id` - Update product (admin)
- `DELETE /api/products/:id` - Delete product (admin)

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/products/category/:category` - Get products by category

### Cart (Session-based)
- `POST /api/cart/add` - Add item to cart
- `GET /api/cart/:sessionId` - Get cart items
- `PUT /api/cart/:sessionId/item/:itemId` - Update cart item
- `DELETE /api/cart/:sessionId/item/:itemId` - Remove cart item
- `DELETE /api/cart/:sessionId` - Clear cart

### Upload (AWS S3)
- `POST /upload/image?type=product` - Upload single image
- `POST /upload/images?type=product` - Upload multiple images
- `DELETE /upload/:fileName?type=product` - Delete image

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order by ID

## Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:3001/docs`
- API Schema: `http://localhost:3001/docs/json`

## Development

```bash
# Development with hot reload
npm run dev

# Production
npm start

# Migrate images from Supabase to S3
npm run migrate-to-s3

# Compress existing images
npm run compress-images
```

## Additional Documentation

- [AWS S3 Setup Guide](./AWS_S3_SETUP.md) - Complete guide for setting up AWS S3
- [Migration Guide](./MIGRATION_GUIDE.md) - How to migrate from Supabase Storage to AWS S3
- [Payment Setup](./PAYMENT_SETUP_SUMMARY.md) - Razorpay integration guide
