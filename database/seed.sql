-- Database seeding script for Ani & Ayu e-commerce
-- Run this after creating the main schema

-- First, delete existing categories if any (to avoid UUID conflicts)
DELETE FROM public.categories WHERE slug IN ('boys', 'girls', 'festive', 'casual', 'wedding');

-- Insert categories with specific UUIDs
INSERT INTO public.categories (id, name, slug, description, image_url, featured) VALUES
('11111111-1111-1111-1111-111111111111', 'Boys', 'boys', 'Traditional ethnic wear for boys aged 2-14 years', '/assets/categories/boys.jpg', true),
('22222222-2222-2222-2222-222222222222', 'Girls', 'girls', 'Beautiful ethnic wear for girls aged 2-14 years', '/assets/categories/girls.jpg', true),
('33333333-3333-3333-3333-333333333333', 'Festive', 'festive', 'Special occasion wear for festivals and celebrations', '/assets/categories/festive.jpg', true),
('44444444-4444-4444-4444-444444444444', 'Casual', 'casual', 'Comfortable everyday ethnic wear', '/assets/categories/casual.jpg', false),
('55555555-5555-5555-5555-555555555555', 'Wedding', 'wedding', 'Premium wedding and formal wear collection', '/assets/categories/wedding.jpg', false);

-- Create homepage banners table if not exists
CREATE TABLE IF NOT EXISTS public.homepage_banners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  description TEXT,
  image_url VARCHAR(500) NOT NULL,
  cta_text VARCHAR(100),
  cta_link VARCHAR(500),
  background_color VARCHAR(20) DEFAULT '#FFFFFF',
  text_color VARCHAR(20) DEFAULT '#000000',
  featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create testimonials table if not exists
CREATE TABLE IF NOT EXISTS public.testimonials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  customer_location VARCHAR(255),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  review_text TEXT NOT NULL,
  product_id VARCHAR(255),
  product_name VARCHAR(255),
  customer_image VARCHAR(500),
  review_date DATE DEFAULT CURRENT_DATE,
  verified BOOLEAN DEFAULT false,
  featured BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert homepage banners
INSERT INTO public.homepage_banners (
  id, title, subtitle, description, image_url, cta_text, cta_link, 
  background_color, text_color, featured, display_order
) VALUES
('00000001-0001-0001-0001-000000000001', 'Festive Collection 2024', 'Traditional wear for your little ones', 
 'Discover our exquisite collection of ethnic wear designed specially for children', 
 '/assets/designs/design-1.jpg', 'Shop Now', '/products?category=festive',
 '#FFF8E1', '#8B4513', true, 1),
('00000001-0001-0001-0001-000000000002', 'New Arrivals', 'Latest designs just in', 
 'Fresh styles for the upcoming season', 
 '/assets/designs/design-2.jpg', 'Explore', '/products?sort=newest',
 '#F3E5F5', '#4A148C', true, 2),
('00000001-0001-0001-0001-000000000003', 'Wedding Collection', 'Premium ethnic wear', 
 'Perfect outfits for special occasions and celebrations', 
 '/assets/designs/design-3.jpg', 'View Collection', '/products?category=wedding',
 '#E8F5E8', '#2E7D32', false, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  cta_text = EXCLUDED.cta_text,
  cta_link = EXCLUDED.cta_link,
  background_color = EXCLUDED.background_color,
  text_color = EXCLUDED.text_color,
  featured = EXCLUDED.featured,
  display_order = EXCLUDED.display_order;

-- Insert testimonials
INSERT INTO public.testimonials (
  id, customer_name, customer_location, rating, review_text, 
  product_id, product_name, customer_image, review_date, verified, featured
) VALUES
('00000002-0002-0002-0002-000000000001', 'Priya Sharma', 'Mumbai', 5, 
 'Absolutely beautiful outfits! My daughter looked like a princess in the pink lehenga. The quality is outstanding and the fit is perfect.',
 'a0000001-a001-a001-a001-000000000001', 'Pink Princess Lehenga', '/assets/placeholders/ph-hero-1.png', '2024-08-15', true, true),
('00000002-0002-0002-0002-000000000002', 'Rajesh Kumar', 'Delhi', 5,
 'Fantastic quality kurta set for my son. The fabric is premium and the embroidery work is exquisite. Highly recommended for festive occasions.',
 'b0000001-b001-b001-b001-000000000001', 'Royal Blue Silk Kurta Set', '/assets/placeholders/ph-hero-2.jpg', '2024-08-10', true, true),
('00000002-0002-0002-0002-000000000003', 'Meera Patel', 'Ahmedabad', 5,
 'Love the twin set! Both my kids looked adorable at the family function. The coordinated design is perfect for sibling photos.',
 'f0000001-f001-f001-f001-000000000001', 'Twin Set - Royal Blue & Pink', '/assets/placeholders/ph-hero.svg', '2024-08-05', true, true),
('00000002-0002-0002-0002-000000000004', 'Anita Singh', 'Bangalore', 4,
 'Great collection and fast delivery. The gharara set exceeded expectations. My daughter felt special wearing it to the wedding.',
 'a0000001-a001-a001-a001-000000000004', 'Turquoise Gharara Set', '/assets/placeholders/ph-hero-1.png', '2024-07-28', true, false),
('00000002-0002-0002-0002-000000000005', 'Vikram Gupta', 'Pune', 5,
 'Excellent craftsmanship on the sherwani. The golden embroidery is detailed and beautiful. Perfect for special occasions.',
 'b0000001-b001-b001-b001-000000000004', 'Golden Silk Sherwani', '/assets/placeholders/ph-hero-2.jpg', '2024-07-20', true, true),
('00000002-0002-0002-0002-000000000006', 'Kavya Reddy', 'Hyderabad', 5,
 'Amazing Anarkali dress! The purple color is vibrant and the fabric quality is top-notch. My daughter loves wearing it.',
 'a0000001-a001-a001-a001-000000000002', 'Purple Anarkali Dress', '/assets/placeholders/ph-hero.svg', '2024-07-15', true, false)
ON CONFLICT (id) DO UPDATE SET
  customer_name = EXCLUDED.customer_name,
  customer_location = EXCLUDED.customer_location,
  rating = EXCLUDED.rating,
  review_text = EXCLUDED.review_text,
  product_id = EXCLUDED.product_id,
  product_name = EXCLUDED.product_name,
  customer_image = EXCLUDED.customer_image,
  review_date = EXCLUDED.review_date,
  verified = EXCLUDED.verified,
  featured = EXCLUDED.featured;

-- Insert sample products
INSERT INTO public.products (
  id, name, slug, description, category_id, price, original_price, 
  image_url, images, rating, review_count, sizes, colors, material, 
  occasion, age_range, features, in_stock, featured
) VALUES

-- BOYS COLLECTION
('b0000001-b001-b001-b001-000000000001', 'Royal Blue Silk Kurta Set', 'royal-blue-silk-kurta-set', 
 'Elegant royal blue silk kurta with matching pajama. Perfect for festivals and special occasions. Features intricate gold thread work on collar and cuffs.',
 '11111111-1111-1111-1111-111111111111', 1899.00, 2499.00,
 '/assets/placeholders/ph-card-4x5.svg',
 '["/assets/placeholders/ph-card-4x5.svg", "/assets/placeholders/1_4.webp"]'::jsonb,
 4.8, 45,
 '["XS", "S", "M", "L"]'::jsonb,
 '["Royal Blue", "Gold"]'::jsonb,
 'Pure Silk', 'Festival, Wedding', '3-8 years',
 '["Comfortable cotton lining", "Easy care machine washable", "Matching pajama included", "Gold thread embroidery", "Breathable fabric"]'::jsonb,
 true, true),

('b0000001-b001-b001-b001-000000000002', 'Traditional Maroon Dhoti Set', 'traditional-maroon-dhoti-set',
 'Classic maroon dhoti kurta set with traditional prints. Ideal for cultural events and festivals.',
 '11111111-1111-1111-1111-111111111111', 1599.00, 1999.00,
 '/assets/placeholders/ph-card-4x5.svg',
 '["/assets/placeholders/ph-card-4x5.svg"]'::jsonb,
 4.6, 32,
 '["S", "M", "L", "XL"]'::jsonb,
 '["Maroon", "Gold"]'::jsonb,
 'Cotton Blend', 'Cultural Events, Festival', '4-10 years',
 '["Traditional dhoti style", "Comfortable fit", "Machine washable", "Authentic design", "Durable fabric"]'::jsonb,
 true, false),

('b0000001-b001-b001-b001-000000000003', 'Cream Nehru Jacket Set', 'cream-nehru-jacket-set',
 'Sophisticated cream colored Nehru jacket with kurta and churidar. Perfect for formal occasions.',
 '11111111-1111-1111-1111-111111111111', 2299.00, 2899.00,
 '/assets/placeholders/ph-card-4x5.svg',
 '["/assets/placeholders/ph-card-4x5.svg"]'::jsonb,
 4.9, 28,
 '["M", "L", "XL"]'::jsonb,
 '["Cream", "Beige"]'::jsonb,
 'Cotton Silk', 'Wedding, Formal', '5-12 years',
 '["Nehru collar jacket", "Matching kurta and churidar", "Premium fabric", "Elegant buttons", "Comfortable fit"]'::jsonb,
 true, true),

('b0000001-b001-b001-b001-000000000004', 'Golden Silk Sherwani', 'golden-silk-sherwani',
 'Luxurious golden silk sherwani with intricate embroidery. Perfect for weddings and grand celebrations.',
 '11111111-1111-1111-1111-111111111111', 3499.00, 4299.00,
 '/assets/placeholders/ph-card-4x5.svg',
 '["/assets/placeholders/ph-card-4x5.svg"]'::jsonb,
 4.7, 15,
 '["L", "XL"]'::jsonb,
 '["Golden", "Cream"]'::jsonb,
 'Pure Silk', 'Wedding, Special Events', '6-14 years',
 '["Hand embroidered details", "Premium silk fabric", "Traditional cut", "Matching pajama", "Luxury finish"]'::jsonb,
 true, true),

('b0000001-b001-b001-b001-000000000005', 'Orange Cotton Kurta', 'orange-cotton-kurta',
 'Bright orange cotton kurta for everyday wear. Comfortable and stylish for casual occasions.',
 '11111111-1111-1111-1111-111111111111', 899.00, 1199.00,
 '/assets/placeholders/ph-card-4x5.svg',
 '["/assets/placeholders/ph-card-4x5.svg"]'::jsonb,
 4.4, 52,
 '["XS", "S", "M", "L"]'::jsonb,
 '["Orange", "Yellow"]'::jsonb,
 'Pure Cotton', 'Casual, Daily Wear', '2-8 years',
 '["Soft cotton fabric", "Easy to wear", "Machine washable", "Vibrant colors", "Comfortable fit"]'::jsonb,
 true, false),

-- GIRLS COLLECTION
('a0000001-a001-a001-a001-000000000001', 'Pink Princess Lehenga', 'pink-princess-lehenga',
 'Beautiful pink lehenga with golden work. Perfect for little princesses on special occasions.',
 '22222222-2222-2222-2222-222222222222', 2799.00, 3499.00,
 '/assets/placeholders/ph-card-4x5.svg',
 '["/assets/placeholders/ph-card-4x5.svg", "/assets/placeholders/1_4.webp"]'::jsonb,
 4.9, 68,
 '["XS", "S", "M", "L", "XL"]'::jsonb,
 '["Pink", "Gold"]'::jsonb,
 'Georgette', 'Wedding, Festival', '3-12 years',
 '["Heavy golden embroidery", "Comfortable inner lining", "Matching dupatta", "Princess style cut", "Premium fabric quality"]'::jsonb,
 true, true),

('a0000001-a001-a001-a001-000000000002', 'Purple Anarkali Dress', 'purple-anarkali-dress',
 'Elegant purple Anarkali with floral prints. Flowing design perfect for festivals and parties.',
 '22222222-2222-2222-2222-222222222222', 1999.00, 2599.00,
 '/assets/placeholders/ph-card-4x5.svg',
 '["/assets/placeholders/ph-card-4x5.svg"]'::jsonb,
 4.7, 41,
 '["S", "M", "L", "XL"]'::jsonb,
 '["Purple", "Lavender"]'::jsonb,
 'Cotton Silk', 'Festival, Party', '4-10 years',
 '["Flowy Anarkali design", "Comfortable fabric", "Beautiful prints", "Easy to wear", "Matching leggings"]'::jsonb,
 true, true),

('a0000001-a001-a001-a001-000000000003', 'Red Traditional Saree', 'red-traditional-saree',
 'Pre-stitched red saree for little girls. Easy to wear with beautiful golden border.',
 '22222222-2222-2222-2222-222222222222', 1699.00, 2199.00,
 '/assets/placeholders/ph-card-4x5.svg',
 '["/assets/placeholders/ph-card-4x5.svg"]'::jsonb,
 4.5, 29,
 '["M", "L", "XL"]'::jsonb,
 '["Red", "Gold"]'::jsonb,
 'Chiffon', 'Cultural Events, Festival', '6-14 years',
 '["Pre-stitched design", "Easy to drape", "Golden border", "Matching blouse", "Traditional look"]'::jsonb,
 true, false),

('a0000001-a001-a001-a001-000000000004', 'Turquoise Gharara Set', 'turquoise-gharara-set',
 'Traditional turquoise gharara with heavy embroidery. Perfect for weddings and special occasions.',
 '22222222-2222-2222-2222-222222222222', 2499.00, 3199.00,
 '/assets/placeholders/ph-card-4x5.svg',
 '["/assets/placeholders/ph-card-4x5.svg"]'::jsonb,
 4.8, 22,
 '["S", "M", "L", "XL"]'::jsonb,
 '["Turquoise", "Silver"]'::jsonb,
 'Net', 'Wedding, Reception', '5-12 years',
 '["Traditional gharara style", "Heavy embroidery work", "Matching dupatta", "Comfortable fit", "Premium finishing"]'::jsonb,
 true, true),

('a0000001-a001-a001-a001-000000000005', 'Yellow Cotton Kurti', 'yellow-cotton-kurti',
 'Bright yellow cotton kurti with block prints. Perfect for casual and festive wear.',
 '22222222-2222-2222-2222-222222222222', 799.00, 1099.00,
 '/assets/placeholders/ph-card-4x5.svg',
 '["/assets/placeholders/ph-card-4x5.svg"]'::jsonb,
 4.3, 47,
 '["XS", "S", "M", "L"]'::jsonb,
 '["Yellow", "Orange"]'::jsonb,
 'Cotton', 'Casual, Festival', '3-10 years',
 '["Block print design", "Soft cotton fabric", "Comfortable wear", "Machine washable", "Vibrant colors"]'::jsonb,
 true, false),

-- FESTIVE COLLECTION
('f0000001-f001-f001-f001-000000000001', 'Twin Set - Royal Blue & Pink', 'twin-set-royal-blue-pink',
 'Matching brother-sister set in royal blue and pink. Perfect for festivals and family functions.',
 '33333333-3333-3333-3333-333333333333', 3799.00, 4999.00,
 '/assets/placeholders/ph-card-4x5.svg',
 '["/assets/placeholders/ph-card-4x5.svg"]'::jsonb,
 4.9, 33,
 '["XS", "S", "M", "L", "XL"]'::jsonb,
 '["Royal Blue", "Pink", "Gold"]'::jsonb,
 'Silk Blend', 'Festival, Family Functions', '3-12 years',
 '["Matching sibling sets", "Coordinated designs", "Premium fabric", "Traditional patterns", "Complete outfit"]'::jsonb,
 true, true),

('f0000001-f001-f001-f001-000000000002', 'Diwali Special Gold Set', 'diwali-special-gold-set',
 'Sparkling gold outfit perfect for Diwali celebrations. Features traditional motifs and comfortable fit.',
 '33333333-3333-3333-3333-333333333333', 2299.00, 2899.00,
 '/assets/placeholders/ph-card-4x5.svg',
 '["/assets/placeholders/ph-card-4x5.svg"]'::jsonb,
 4.7, 56,
 '["XS", "S", "M", "L"]'::jsonb,
 '["Gold", "Maroon"]'::jsonb,
 'Brocade', 'Diwali, Festival', '2-10 years',
 '["Diwali special design", "Glittery fabric", "Traditional motifs", "Comfortable fit", "Festival perfect"]'::jsonb,
 true, true),

('f0000001-f001-f001-f001-000000000003', 'Navratri Chaniya Choli', 'navratri-chaniya-choli',
 'Colorful chaniya choli for Navratri celebrations. Twirl-friendly design with mirror work.',
 '33333333-3333-3333-3333-333333333333', 1899.00, 2399.00,
 '/assets/placeholders/ph-card-4x5.svg',
 '["/assets/placeholders/ph-card-4x5.svg"]'::jsonb,
 4.6, 38,
 '["S", "M", "L", "XL"]'::jsonb,
 '["Multi-color", "Bright Colors"]'::jsonb,
 'Cotton', 'Navratri, Garba', '4-12 years',
 '["Traditional chaniya choli", "Mirror work details", "Twirl-friendly design", "Vibrant colors", "Dance-ready fit"]'::jsonb,
 true, true)

ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  original_price = EXCLUDED.original_price,
  image_url = EXCLUDED.image_url,
  images = EXCLUDED.images,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count,
  sizes = EXCLUDED.sizes,
  colors = EXCLUDED.colors,
  material = EXCLUDED.material,
  occasion = EXCLUDED.occasion,
  age_range = EXCLUDED.age_range,
  features = EXCLUDED.features,
  in_stock = EXCLUDED.in_stock,
  featured = EXCLUDED.featured;