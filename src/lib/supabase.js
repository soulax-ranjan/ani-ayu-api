import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Require Supabase configuration - no mock data
const isSupabaseConfigured = supabaseUrl && 
  supabaseAnonKey && 
  supabaseServiceKey && 
  !supabaseUrl.includes('placeholder')

if (!isSupabaseConfigured) {
  console.error('❌ Supabase configuration is required. Please set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in your .env file.')
  process.exit(1)
}

// Client for authenticated users (respects RLS policies)
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side operations (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export { supabase, supabaseAdmin }

// Database table names
export const TABLES = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  USERS: 'users',
  CARTS: 'carts',
  CART_ITEMS: 'cart_items',
  ADDRESSES: 'addresses',
  ORDERS: 'orders',
  ORDER_ITEMS: 'order_items',
  HOMEPAGE_BANNERS: 'homepage_banners',
  TESTIMONIALS: 'testimonials'
}

// Helper function to handle Supabase errors
export const handleSupabaseError = (error) => {
  if (error) {
    console.error('Supabase error:', error)
    return {
      error: error.code || 'DATABASE_ERROR',
      message: error.message || 'An unexpected database error occurred'
    }
  }
  return null
}
