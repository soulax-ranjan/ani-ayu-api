# Ani & Ayu API

Node.js backend API for the Ani & Ayu e-commerce platform built with Fastify.

## Features

- 🚀 Fast and lightweight with Fastify
- 📝 API documentation with Swagger
- 🛡️ CORS enabled for frontend integration
- 🗄️ MongoDB integration ready
- 🔐 JWT authentication support
- 📦 Product management APIs
- 🛒 Cart management APIs
- 👤 User management APIs
- 📄 File upload support

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

```
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/ani-ayu
JWT_SECRET=your-secret-key-here
FRONTEND_URL=http://localhost:3000
```

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
```
