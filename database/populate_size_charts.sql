-- Update all products with the default size chart values
-- This will overwrite existing size_charts. 
-- If you only want to update empty ones, add: WHERE size_chart IS NULL OR size_chart = '{}'::jsonb

UPDATE public.products
SET size_chart = '{
  "2-3 Years": {
    "enabled": true,
    "top_length": "7.00",
    "chest": "23.00",
    "bottom_length": "21.00",
    "waist": "20.00"
  },
  "3-4 Years": {
    "enabled": true,
    "top_length": "7.00",
    "chest": "23.50",
    "bottom_length": "23.00",
    "waist": "21.00"
  },
  "4-5 Years": {
    "enabled": true,
    "top_length": "8.00",
    "chest": "24.00",
    "bottom_length": "25.00",
    "waist": "22.00"
  },
  "5-6 Years": {
    "enabled": true,
    "top_length": "9.00",
    "chest": "25.00",
    "bottom_length": "26.00",
    "waist": "23.00"
  },
  "6-7 Years": {
    "enabled": true,
    "top_length": "9.00",
    "chest": "26.00",
    "bottom_length": "28.00",
    "waist": "24.00"
  },
  "7-8 Years": {
    "enabled": true,
    "top_length": "10.00",
    "chest": "27.00",
    "bottom_length": "30.00",
    "waist": "25.00"
  },
  "8-9 Years": {
    "enabled": true,
    "top_length": "10.00",
    "chest": "28.50",
    "bottom_length": "32.00",
    "waist": "26.00"
  },
  "9-10 Years": {
    "enabled": true,
    "top_length": "11.00",
    "chest": "30.00",
    "bottom_length": "34.00",
    "waist": "28.00"
  }
}'::jsonb;
