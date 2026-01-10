-- Comprehensive dummy data population script for Ani & Ayu e-commerce
-- Run this to populate the database with rich dummy data using the common image URL

-- Use the common image URL from Supabase Storage
-- https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp

-- Clear existing data
DELETE FROM public.homepage_banners;
DELETE FROM public.testimonials;
DELETE FROM public.products;
DELETE FROM public.categories;

-- Insert categories with the common image
INSERT INTO public.categories (id, name, slug, description, image_url, featured) VALUES
('11111111-1111-1111-1111-111111111111', 'Boys', 'boys', 'Traditional ethnic wear for boys aged 2-14 years', 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp', true),
('22222222-2222-2222-2222-222222222222', 'Girls', 'girls', 'Beautiful ethnic wear for girls aged 2-14 years', 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp', true),
('33333333-3333-3333-3333-333333333333', 'Festive', 'festive', 'Special occasion wear for festivals and celebrations', 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp', true),
('44444444-4444-4444-4444-444444444444', 'Wedding', 'wedding', 'Premium wedding and formal wear collection', 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp', true),
('55555555-5555-5555-5555-555555555555', 'Casual', 'casual', 'Comfortable everyday ethnic wear', 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp', false);

-- Insert comprehensive homepage banners
INSERT INTO public.homepage_banners (
  id, title, subtitle, description, image_url, cta_text, cta_link, 
  background_color, text_color, featured, display_order, active
) VALUES
('00000001-0001-0001-0001-000000000001', 'Festive Collection 2024', 'Beautiful Traditional Wear', 
 'Discover our latest collection of premium ethnic wear for your little ones', 
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp', 'Shop Now', '/products?category=festive',
 '#FF6B6B', '#FFFFFF', true, 1, true),
('00000001-0001-0001-0001-000000000002', 'Wedding Special', 'Make Every Moment Magical', 
 'Elegant wedding wear collection for special occasions', 
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp', 'Explore Collection', '/products?category=wedding',
 '#4ECDC4', '#FFFFFF', true, 2, true),
('00000001-0001-0001-0001-000000000003', 'Twin Sets', 'Perfect for Siblings', 
 'Coordinated outfits for your little ones to look adorable together', 
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp', 'View Twins Collection', '/products?category=twins',
 '#45B7D1', '#FFFFFF', true, 3, true);

-- Insert comprehensive product catalog
INSERT INTO public.products (
  id, name, slug, description, category_id, price, original_price, 
  image_url, images, rating, review_count, sizes, colors, material, 
  occasion, age_range, features, in_stock, featured
) VALUES

-- BOYS COLLECTION
('b001', 'Royal Blue Silk Kurta Set', 'royal-blue-silk-kurta-set', 
 'Elegant royal blue silk kurta with matching pajama. Perfect for festivals and special occasions.',
 '11111111-1111-1111-1111-111111111111', 1899.00, 2499.00,
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp',
 '["https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp"]'::jsonb,
 4.8, 145,
 '["XS", "S", "M", "L"]'::jsonb,
 '["Royal Blue", "Gold"]'::jsonb,
 'Pure Silk', 'Festival, Wedding', '3-8 years',
 '["Comfortable cotton lining", "Easy care machine washable", "Matching pajama included", "Gold thread embroidery", "Breathable fabric"]'::jsonb,
 true, true),

('b002', 'Traditional Maroon Dhoti Set', 'traditional-maroon-dhoti-set',
 'Classic maroon dhoti kurta set with traditional prints. Ideal for cultural events and festivals.',
 '11111111-1111-1111-1111-111111111111', 1599.00, 1999.00,
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp',
 '["https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp"]'::jsonb,
 4.6, 89,
 '["S", "M", "L", "XL"]'::jsonb,
 '["Maroon", "Gold"]'::jsonb,
 'Cotton Blend', 'Cultural Events, Festival', '4-10 years',
 '["Traditional dhoti style", "Comfortable fit", "Machine washable", "Authentic design", "Durable fabric"]'::jsonb,
 true, false),

('b003', 'Cream Nehru Jacket Set', 'cream-nehru-jacket-set',
 'Sophisticated cream colored Nehru jacket with kurta and churidar. Perfect for formal occasions.',
 '11111111-1111-1111-1111-111111111111', 2299.00, 2899.00,
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp',
 '["https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp"]'::jsonb,
 4.9, 76,
 '["M", "L", "XL"]'::jsonb,
 '["Cream", "Beige"]'::jsonb,
 'Cotton Silk', 'Wedding, Formal', '5-12 years',
 '["Nehru collar jacket", "Matching kurta and churidar", "Premium fabric", "Elegant buttons", "Comfortable fit"]'::jsonb,
 true, true),

('b004', 'Golden Silk Sherwani', 'golden-silk-sherwani',
 'Luxurious golden silk sherwani with intricate embroidery. Perfect for weddings and grand celebrations.',
 '11111111-1111-1111-1111-111111111111', 3499.00, 4299.00,
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp',
 '["https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp"]'::jsonb,
 4.7, 54,
 '["L", "XL"]'::jsonb,
 '["Golden", "Cream"]'::jsonb,
 'Pure Silk', 'Wedding, Special Events', '6-14 years',
 '["Hand embroidered details", "Premium silk fabric", "Traditional cut", "Matching pajama", "Luxury finish"]'::jsonb,
 true, true),

('b005', 'Orange Cotton Kurta', 'orange-cotton-kurta',
 'Bright orange cotton kurta for everyday wear. Comfortable and stylish for casual occasions.',
 '11111111-1111-1111-1111-111111111111', 899.00, 1199.00,
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp',
 '["https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp"]'::jsonb,
 4.4, 132,
 '["XS", "S", "M", "L"]'::jsonb,
 '["Orange", "Yellow"]'::jsonb,
 'Pure Cotton', 'Casual, Daily Wear', '2-8 years',
 '["Soft cotton fabric", "Easy to wear", "Machine washable", "Vibrant colors", "Comfortable fit"]'::jsonb,
 true, false),

-- GIRLS COLLECTION
('g001', 'Pink Princess Lehenga', 'pink-princess-lehenga',
 'Beautiful pink lehenga with golden work. Perfect for little princesses on special occasions.',
 '22222222-2222-2222-2222-222222222222', 2799.00, 3499.00,
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp',
 '["https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp"]'::jsonb,
 4.9, 268,
 '["XS", "S", "M", "L", "XL"]'::jsonb,
 '["Pink", "Gold"]'::jsonb,
 'Georgette', 'Wedding, Festival', '3-12 years',
 '["Heavy golden embroidery", "Comfortable inner lining", "Matching dupatta", "Princess style cut", "Premium fabric quality"]'::jsonb,
 true, true),

('g002', 'Purple Anarkali Dress', 'purple-anarkali-dress',
 'Elegant purple Anarkali with floral prints. Flowing design perfect for festivals and parties.',
 '22222222-2222-2222-2222-222222222222', 1999.00, 2599.00,
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp',
 '["https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp"]'::jsonb,
 4.7, 187,
 '["S", "M", "L", "XL"]'::jsonb,
 '["Purple", "Lavender"]'::jsonb,
 'Cotton Silk', 'Festival, Party', '4-10 years',
 '["Flowy Anarkali design", "Comfortable fabric", "Beautiful prints", "Easy to wear", "Matching leggings"]'::jsonb,
 true, true),

('g003', 'Red Traditional Saree', 'red-traditional-saree',
 'Pre-stitched red saree for little girls. Easy to wear with beautiful golden border.',
 '22222222-2222-2222-2222-222222222222', 1699.00, 2199.00,
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp',
 '["https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp"]'::jsonb,
 4.5, 95,
 '["M", "L", "XL"]'::jsonb,
 '["Red", "Gold"]'::jsonb,
 'Chiffon', 'Cultural Events, Festival', '6-14 years',
 '["Pre-stitched design", "Easy to drape", "Golden border", "Matching blouse", "Traditional look"]'::jsonb,
 true, false),

('g004', 'Turquoise Gharara Set', 'turquoise-gharara-set',
 'Traditional turquoise gharara with heavy embroidery. Perfect for weddings and special occasions.',
 '22222222-2222-2222-2222-222222222222', 2499.00, 3199.00,
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp',
 '["https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp"]'::jsonb,
 4.8, 124,
 '["S", "M", "L", "XL"]'::jsonb,
 '["Turquoise", "Silver"]'::jsonb,
 'Net', 'Wedding, Reception', '5-12 years',
 '["Traditional gharara style", "Heavy embroidery work", "Matching dupatta", "Comfortable fit", "Premium finishing"]'::jsonb,
 true, true),

('g005', 'Yellow Cotton Kurti', 'yellow-cotton-kurti',
 'Bright yellow cotton kurti with block prints. Perfect for casual and festive wear.',
 '22222222-2222-2222-2222-222222222222', 799.00, 1099.00,
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp',
 '["https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp"]'::jsonb,
 4.3, 203,
 '["XS", "S", "M", "L"]'::jsonb,
 '["Yellow", "Orange"]'::jsonb,
 'Cotton', 'Casual, Festival', '3-10 years',
 '["Block print design", "Soft cotton fabric", "Comfortable wear", "Machine washable", "Vibrant colors"]'::jsonb,
 true, false),

-- FESTIVE COLLECTION
('f001', 'Twin Set - Royal Blue & Pink', 'twin-set-royal-blue-pink',
 'Matching brother-sister set in royal blue and pink. Perfect for festivals and family functions.',
 '33333333-3333-3333-3333-333333333333', 3799.00, 4999.00,
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp',
 '["https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp"]'::jsonb,
 4.9, 133,
 '["XS", "S", "M", "L", "XL"]'::jsonb,
 '["Royal Blue", "Pink", "Gold"]'::jsonb,
 'Silk Blend', 'Festival, Family Functions', '3-12 years',
 '["Matching sibling sets", "Coordinated designs", "Premium fabric", "Traditional patterns", "Complete outfit"]'::jsonb,
 true, true),

('f002', 'Diwali Special Gold Set', 'diwali-special-gold-set',
 'Sparkling gold outfit perfect for Diwali celebrations. Features traditional motifs and comfortable fit.',
 '33333333-3333-3333-3333-333333333333', 2299.00, 2899.00,
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp',
 '["https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp"]'::jsonb,
 4.7, 178,
 '["XS", "S", "M", "L"]'::jsonb,
 '["Gold", "Maroon"]'::jsonb,
 'Brocade', 'Diwali, Festival', '2-10 years',
 '["Diwali special design", "Glittery fabric", "Traditional motifs", "Comfortable fit", "Festival perfect"]'::jsonb,
 true, true),

('f003', 'Navratri Chaniya Choli', 'navratri-chaniya-choli',
 'Colorful chaniya choli for Navratri celebrations. Twirl-friendly design with mirror work.',
 '33333333-3333-3333-3333-333333333333', 1899.00, 2399.00,
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp',
 '["https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp"]'::jsonb,
 4.6, 156,
 '["S", "M", "L", "XL"]'::jsonb,
 '["Multi-color", "Bright Colors"]'::jsonb,
 'Cotton', 'Navratri, Garba', '4-12 years',
 '["Traditional chaniya choli", "Mirror work details", "Twirl-friendly design", "Vibrant colors", "Dance-ready fit"]'::jsonb,
 true, true),

-- WEDDING COLLECTION
('w001', 'Emerald Wedding Lehenga', 'emerald-wedding-lehenga',
 'Stunning emerald green wedding lehenga with heavy embroidery work. Perfect for grand celebrations.',
 '44444444-4444-4444-4444-444444444444', 4599.00, 5999.00,
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp',
 '["https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp"]'::jsonb,
 4.8, 67,
 '["S", "M", "L", "XL"]'::jsonb,
 '["Emerald", "Gold"]'::jsonb,
 'Heavy Silk', 'Wedding, Reception', '6-14 years',
 '["Heavy embroidery work", "Premium silk fabric", "Fully lined", "Matching blouse and dupatta", "Luxury finish"]'::jsonb,
 true, true),

('w002', 'Ivory Sherwani Set', 'ivory-sherwani-set',
 'Premium ivory sherwani with golden embroidery. Perfect for wedding ceremonies.',
 '44444444-4444-4444-4444-444444444444', 3999.00, 4799.00,
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp',
 '["https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp"]'::jsonb,
 4.9, 43,
 '["M", "L", "XL"]'::jsonb,
 '["Ivory", "Gold"]'::jsonb,
 'Silk Brocade', 'Wedding, Reception', '8-16 years',
 '["Golden thread embroidery", "Premium brocade fabric", "Traditional cut", "Matching churidar", "Wedding perfect"]'::jsonb,
 true, true),

-- CASUAL COLLECTION
('c001', 'Blue Denim Kurta', 'blue-denim-kurta',
 'Modern denim kurta with traditional touch. Perfect for casual outings and everyday wear.',
 '55555555-5555-5555-5555-555555555555', 1299.00, 1699.00,
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp',
 '["https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp"]'::jsonb,
 4.5, 89,
 '["S", "M", "L", "XL"]'::jsonb,
 '["Blue", "Indigo"]'::jsonb,
 'Denim', 'Casual, Daily Wear', '4-12 years',
 '["Modern denim fabric", "Traditional kurta cut", "Comfortable fit", "Easy maintenance", "Versatile styling"]'::jsonb,
 true, false),

('c002', 'Cotton Palazzo Set', 'cotton-palazzo-set',
 'Comfortable cotton palazzo set with printed kurta. Perfect for daily wear and play.',
 '55555555-5555-5555-5555-555555555555', 999.00, 1299.00,
 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp',
 '["https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp"]'::jsonb,
 4.4, 156,
 '["XS", "S", "M", "L"]'::jsonb,
 '["White", "Blue"]'::jsonb,
 'Pure Cotton', 'Casual, Play Time', '3-10 years',
 '["Soft cotton fabric", "Comfortable palazzo", "Easy to wear", "Machine washable", "Play-friendly"]'::jsonb,
 true, false);

-- Insert comprehensive testimonials
INSERT INTO public.testimonials (
  id, customer_name, customer_location, rating, review_text, 
  product_id, product_name, customer_image, review_date, verified, featured, active
) VALUES
('00000002-0002-0002-0002-000000000001', 'Priya Sharma', 'Mumbai, Maharashtra', 5, 
 'Absolutely beautiful collection! The quality is amazing and my daughter loves her new lehenga. Perfect for our family wedding.',
 'g001', 'Pink Princess Lehenga', 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp', '2024-08-15', true, true, true),
('00000002-0002-0002-0002-000000000002', 'Rajesh Kumar', 'Delhi, NCR', 5,
 'Excellent quality kurta set for my son. The fabric is premium and the fit is perfect. Highly recommended!',
 'b001', 'Royal Blue Silk Kurta', 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp', '2024-08-12', true, true, true),
('00000002-0002-0002-0002-000000000003', 'Anita Patel', 'Ahmedabad, Gujarat', 5,
 'The twin set is gorgeous! Both my kids looked adorable at the festival. Great quality and beautiful designs.',
 'f001', 'Twin Set - Royal Blue & Pink', 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp', '2024-08-10', true, true, true),
('00000002-0002-0002-0002-000000000004', 'Meera Reddy', 'Hyderabad, Telangana', 4,
 'Beautiful ethnic wear collection. Fast delivery and excellent customer service. Will definitely shop again!',
 'g002', 'Green Anarkali Dress', 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp', '2024-08-08', true, false, true),
('00000002-0002-0002-0002-000000000005', 'Vikram Gupta', 'Pune, Maharashtra', 5,
 'Amazing quality sherwani! My son looked like a prince at the wedding. The embroidery work is exquisite.',
 'b004', 'Golden Silk Sherwani', 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp', '2024-07-28', true, true, true),
('00000002-0002-0002-0002-000000000006', 'Kavya Nair', 'Kochi, Kerala', 5,
 'Loved the gharara set! The fabric quality and embroidery work exceeded expectations. Perfect for special occasions.',
 'g004', 'Turquoise Gharara Set', 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp', '2024-07-20', true, true, true),
('00000002-0002-0002-0002-000000000007', 'Ashish Verma', 'Lucknow, Uttar Pradesh', 4,
 'Good collection with traditional designs. The Nehru jacket set was perfect for the family function.',
 'b003', 'Cream Nehru Jacket Set', 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp', '2024-07-15', true, false, true),
('00000002-0002-0002-0002-000000000008', 'Sneha Joshi', 'Indore, Madhya Pradesh', 5,
 'Fantastic Diwali collection! The golden outfit sparkled beautifully. My daughter felt like a star.',
 'f002', 'Diwali Special Gold Set', 'https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp', '2024-07-10', true, true, true);

-- Set some products as best sellers by updating review counts and ratings
UPDATE public.products SET 
  featured = true,
  review_count = CASE 
    WHEN id = 'b001' THEN 289 
    WHEN id = 'g001' THEN 245
    WHEN id = 'f001' THEN 198
    WHEN id = 'g004' THEN 167
    WHEN id = 'b004' THEN 143
    WHEN id = 'f002' THEN 128
    ELSE review_count
  END,
  rating = CASE 
    WHEN id = 'b001' THEN 4.8
    WHEN id = 'g001' THEN 4.9
    WHEN id = 'f001' THEN 4.9
    WHEN id = 'g004' THEN 4.7
    WHEN id = 'b004' THEN 4.6
    WHEN id = 'f002' THEN 4.5
    ELSE rating
  END
WHERE id IN ('b001', 'g001', 'f001', 'g004', 'b004', 'f002');

-- Create a view for business stats (this will be used by the API)
CREATE OR REPLACE VIEW public.business_stats AS
SELECT 
  COUNT(DISTINCT CASE WHEN o.status != 'cancelled' THEN o.customer_email END) as total_customers,
  COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.customer_email END) as happy_customers,
  COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as products_delivered,
  50 as cities_covered, -- Static value for now
  ROUND(AVG(p.rating), 1) as average_rating
FROM public.products p
CROSS JOIN (
  -- Dummy orders data for stats calculation
  SELECT 'delivered' as status, 'customer1@example.com' as customer_email
  UNION ALL SELECT 'delivered', 'customer2@example.com'
  UNION ALL SELECT 'delivered', 'customer3@example.com'
  UNION ALL SELECT 'pending', 'customer4@example.com'
) o;

-- Grant necessary permissions
GRANT SELECT ON public.homepage_banners TO anon, authenticated;
GRANT SELECT ON public.testimonials TO anon, authenticated;
GRANT SELECT ON public.products TO anon, authenticated;
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.business_stats TO anon, authenticated;