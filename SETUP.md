# Ani & Ayu API - Supabase Integration Setup

## 🚀 Quick Start with Supabase

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for your project to be ready (usually takes 2-3 minutes)

### 2. Get Your Supabase Credentials

From your Supabase project dashboard:

1. **Settings → API**
   - Copy your `Project URL`
   - Copy your `anon` key  
   - Copy your `service_role` key

2. **Settings → Auth → JWT Settings**
   - Copy your `JWT Secret`

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3001
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# JWT Configuration (from Supabase JWT Settings)
JWT_SECRET=your-supabase-jwt-secret

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### 4. Run Database Schema

In your Supabase project dashboard:

1. Go to **SQL Editor**
2. Create a new query
3. Copy and paste the contents of `database/schema.sql`
4. Click **Run** to create all tables and policies

### 5. Start the API Server

```bash
npm run dev
```

Your API will be available at:
- **API Server**: http://localhost:3001
- **API Documentation**: http://localhost:3001/docs

## 📊 Database Schema

The API uses these main tables:

- **categories** - Product categories (Boys, Girls, Festive, etc.)
- **products** - Product catalog with all details
- **cart_items** - Shopping cart items (per user/session)
- **orders** - Order information
- **order_items** - Individual items within orders

## 🔐 Authentication

The API integrates with Supabase Auth for:

- **User registration** (`POST /api/auth/signup`)
- **User login** (`POST /api/auth/signin`) 
- **Password reset** (`POST /api/auth/reset-password`)
- **JWT token management**

## 🛒 Key API Endpoints

### Products
- `GET /api/products` - List products with filtering/sorting
- `GET /api/products/:id` - Get single product
- `GET /api/products/category/:slug` - Products by category

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/signin` - User login
- `GET /api/auth/user` - Get current user (requires auth)

### Shopping Cart
- `POST /api/cart/add` - Add item to cart
- `GET /api/cart/:sessionId` - Get cart contents
- `PUT /api/cart/:sessionId/item/:itemId` - Update cart item

### Orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order details

## 🔒 Row Level Security (RLS)

The database uses Supabase RLS policies to ensure:

- **Products/Categories**: Public read access
- **Cart Items**: Users can only access their own carts
- **Orders**: Users can only see their own orders
- **Guest Support**: Session-based access for non-authenticated users

## 🚧 Next Steps

1. **Add Product Data**: Insert your product catalog into the `products` table
2. **Configure Auth**: Set up email templates in Supabase Auth settings
3. **File Storage**: Configure Supabase Storage for product images
4. **Payment Integration**: Add payment processor (Stripe, Razorpay)
5. **Admin Panel**: Create admin routes for product/order management

## 📱 Frontend Integration

Update your Next.js frontend to use this API:

```javascript
// Example API call
const response = await fetch('http://localhost:3001/api/products')
const { products } = await response.json()
```

For authentication, use Supabase client in your frontend:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
```
