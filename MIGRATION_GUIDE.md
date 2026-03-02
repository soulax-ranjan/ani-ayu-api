# Migration Guide: Supabase Storage to AWS S3

This guide helps you migrate your existing images from Supabase Storage to AWS S3.

## Overview

The migration involves:
1. Setting up AWS S3 (see AWS_S3_SETUP.md)
2. Migrating existing images
3. Updating database references
4. Testing the new setup
5. Cleaning up old Supabase storage

## Prerequisites

- AWS S3 bucket configured (see AWS_S3_SETUP.md)
- AWS credentials added to `.env` file
- Backup of your database

## Migration Steps

### Step 1: Backup Everything

```bash
# Backup your database
# In Supabase dashboard: Database → Backups → Create backup

# Document all current image URLs
# Run this query in Supabase SQL editor:
SELECT id, image_url, images FROM products;
```

### Step 2: Set Up AWS S3

Follow the complete setup guide in `AWS_S3_SETUP.md`

### Step 3: Test Upload Functionality

Before migrating, test that uploads work:

```bash
# Start your server
npm run dev

# Test upload (in another terminal)
curl -X POST http://localhost:3000/upload/image?type=product \
  -F "file=@test-image.jpg"
```

You should get a response with an S3 URL.

### Step 4: Migration Options

#### Option A: Manual Migration (Small Dataset)

1. Download images from Supabase Storage manually
2. Upload to S3 using the API or AWS Console
3. Update product records with new URLs

#### Option B: Automated Migration Script

Create a migration script `scripts/migrate-to-s3.js`:

```javascript
import { supabaseAdmin } from '../src/lib/supabase.js'
import { uploadToS3, getFolderName } from '../src/lib/s3.js'
import axios from 'axios'

async function migrateImages() {
  console.log('🚀 Starting migration from Supabase to S3...')

  try {
    // Fetch all products
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('id, image_url, images')

    if (error) throw error

    console.log(`Found ${products.length} products to migrate`)

    for (const product of products) {
      console.log(`\nMigrating product ${product.id}...`)
      
      let newImageUrl = product.image_url
      let newImages = product.images || []

      // Migrate main image
      if (product.image_url && product.image_url.includes('supabase')) {
        try {
          const response = await axios.get(product.image_url, { 
            responseType: 'arraybuffer' 
          })
          const buffer = Buffer.from(response.data)
          
          const fileName = `product-${product.id}-main-${Date.now()}.jpg`
          const result = await uploadToS3(
            buffer, 
            fileName, 
            'image/jpeg', 
            'product-images'
          )
          
          newImageUrl = result.url
          console.log(`✅ Migrated main image`)
        } catch (err) {
          console.error(`❌ Failed to migrate main image:`, err.message)
        }
      }

      // Migrate additional images
      if (Array.isArray(product.images) && product.images.length > 0) {
        const migratedImages = []
        
        for (let i = 0; i < product.images.length; i++) {
          const imageUrl = product.images[i]
          
          if (imageUrl && imageUrl.includes('supabase')) {
            try {
              const response = await axios.get(imageUrl, { 
                responseType: 'arraybuffer' 
              })
              const buffer = Buffer.from(response.data)
              
              const fileName = `product-${product.id}-${i}-${Date.now()}.jpg`
              const result = await uploadToS3(
                buffer, 
                fileName, 
                'image/jpeg', 
                'product-images'
              )
              
              migratedImages.push(result.url)
              console.log(`✅ Migrated image ${i + 1}`)
            } catch (err) {
              console.error(`❌ Failed to migrate image ${i + 1}:`, err.message)
              migratedImages.push(imageUrl) // Keep original on failure
            }
          } else {
            migratedImages.push(imageUrl)
          }
        }
        
        newImages = migratedImages
      }

      // Update product with new URLs
      const { error: updateError } = await supabaseAdmin
        .from('products')
        .update({
          image_url: newImageUrl,
          images: newImages
        })
        .eq('id', product.id)

      if (updateError) {
        console.error(`❌ Failed to update product ${product.id}:`, updateError)
      } else {
        console.log(`✅ Updated product ${product.id}`)
      }
    }

    console.log('\n✅ Migration completed!')
  } catch (err) {
    console.error('❌ Migration failed:', err)
  }
}

migrateImages()
```

Run the migration:

```bash
node scripts/migrate-to-s3.js
```

### Step 5: Verify Migration

1. Check that all products have S3 URLs:

```sql
SELECT id, image_url, images 
FROM products 
WHERE image_url LIKE '%supabase%' 
   OR images::text LIKE '%supabase%';
```

This should return no results if migration is complete.

2. Test image loading on your frontend
3. Verify upload/delete functionality works

### Step 6: Update Frontend (if needed)

If your frontend has hardcoded Supabase URLs or logic, update them to use the new S3 URLs.

### Step 7: Clean Up (Optional)

Once you've verified everything works:

1. **Keep Supabase for 30 days** as a backup
2. After 30 days, delete images from Supabase Storage:
   - Go to Supabase Dashboard
   - Storage → Your bucket
   - Delete old files

3. Remove Supabase storage dependencies (optional):
   - Keep Supabase for database
   - Remove storage-related code if not needed

## Rollback Plan

If something goes wrong:

1. **Restore database backup** to revert URLs
2. **Keep Supabase storage** until migration is verified
3. **Check logs** for specific errors

## Cost Comparison

### Supabase Storage
- Free tier: 1GB storage
- Paid: $0.021/GB/month

### AWS S3
- Free tier: 5GB for 12 months (new accounts)
- Standard: $0.023/GB/month
- With CloudFront CDN: Additional costs but better performance

## Post-Migration Checklist

- [ ] All product images loading correctly
- [ ] Upload functionality works
- [ ] Delete functionality works
- [ ] Frontend displays images properly
- [ ] Database backup created
- [ ] Old Supabase storage marked for deletion (after 30 days)
- [ ] Team notified of the change
- [ ] Documentation updated

## Troubleshooting

### Images not loading after migration
- Check S3 bucket permissions
- Verify CORS configuration
- Check database URLs are correct

### Migration script fails
- Check AWS credentials
- Verify network connectivity
- Check Supabase URLs are accessible
- Review error logs

### Partial migration
- Run the migration script again (it should skip already migrated images)
- Or manually migrate remaining images

## Support

If you encounter issues:
1. Check AWS CloudWatch logs
2. Review server logs
3. Verify environment variables
4. Test with a single product first

## Additional Notes

- **Image compression**: The compression service has been updated to work with S3
- **Bandwidth**: S3 has better global performance with CloudFront
- **Backups**: Consider enabling S3 versioning for automatic backups
