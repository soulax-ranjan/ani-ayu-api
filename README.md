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

# Run tests
npm test
```

## Image Optimization

### New uploads
`POST /upload/image` and `POST /upload/images` convert images before saving them to S3
(`src/lib/imageProcessing.js`):

- WebP, quality 80, max 1600px on the longest side (never upscaled)
- EXIF rotation applied, metadata stripped
- Transparency kept only if the image actually uses it
- WebP/JPEG files under 400 KB and within 1600px are stored as-is
- Stored with `Cache-Control: public, max-age=31536000, immutable` under a new timestamped key

### Migrating existing images (`scripts/migrate-images-to-webp.js`)
Converts files in S3 over 400 KB or wider/taller than 1600px, writing `<same key>.webp`
next to each original (originals are never deleted or overwritten), then updates
`products.image_url`, `products.images`, `homepage_banners.image_url` and `categories.image_url`.
Orders and cart items are not touched. Uses the S3 and Supabase credentials from `.env`.

```bash
# 1. Dry run (default, read-only): lists every file to convert with current and new size,
#    and every row that would change
npm run migrate-images-to-webp | tee image-migration-dry-run.log

# 2. Execute: writes WebP files, saves a row backup to backups/image-migration-<timestamp>.json,
#    then updates each row with its own UPDATE statement
npm run migrate-images-to-webp -- --execute | tee image-migration-execute.log

# 3. Rollback (if needed): restores the URL columns from the backup file
npm run migrate-images-to-webp -- --rollback backups/image-migration-<timestamp>.json
```

Notes:
- Safe to re-run: rows already pointing at `.webp` are skipped, and existing `.webp` files are reused, not rewritten.
- A row is only updated (or rolled back) if its `image_url` still has the value the script expects,
  so edits made in the admin panel meanwhile are not overwritten. Those rows are reported as failures.
- Failures are logged and the run continues; the exit code is 1 if anything failed.
- Rollback leaves the `.webp` files in S3. They are unreferenced and harmless.

## Additional Documentation

- [AWS S3 Setup Guide](./AWS_S3_SETUP.md) - Complete guide for setting up AWS S3
- [Migration Guide](./MIGRATION_GUIDE.md) - How to migrate from Supabase Storage to AWS S3
- [Payment Setup](./PAYMENT_SETUP_SUMMARY.md) - Razorpay integration guide
