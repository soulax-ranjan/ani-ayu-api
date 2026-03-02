import { supabaseAdmin } from '../src/lib/supabase.js'
import { uploadToS3 } from '../src/lib/s3.js'
import axios from 'axios'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

/**
 * Migrate images from Supabase Storage to AWS S3
 */
async function migrateImages() {
    console.log('🚀 Starting migration from Supabase to S3...')
    console.log(`Target S3 Bucket: ${process.env.AWS_S3_BUCKET_NAME}`)
    console.log(`AWS Region: ${process.env.AWS_REGION}\n`)

    try {
        // Fetch all products
        const { data: products, error } = await supabaseAdmin
            .from('products')
            .select('id, image_url, images')

        if (error) throw error

        console.log(`Found ${products.length} products to migrate\n`)

        let successCount = 0
        let failCount = 0
        let skippedCount = 0

        for (const product of products) {
            console.log(`\n📦 Processing product ${product.id}...`)

            let newImageUrl = product.image_url
            let newImages = product.images || []
            let productUpdated = false

            // Migrate main image
            if (product.image_url) {
                if (product.image_url.includes('supabase')) {
                    try {
                        console.log(`  Downloading main image...`)
                        const response = await axios.get(product.image_url, {
                            responseType: 'arraybuffer',
                            timeout: 30000 // 30 second timeout
                        })
                        const buffer = Buffer.from(response.data)

                        // Extract file extension from URL or default to jpg
                        const urlParts = product.image_url.split('.')
                        const ext = urlParts.length > 1 ? urlParts[urlParts.length - 1].split('?')[0] : 'jpg'

                        const fileName = `product-${product.id}-main-${Date.now()}.${ext}`

                        console.log(`  Uploading to S3...`)
                        const result = await uploadToS3(
                            buffer,
                            fileName,
                            `image/${ext}`,
                            'product-images'
                        )

                        newImageUrl = result.url
                        productUpdated = true
                        console.log(`  ✅ Main image migrated: ${fileName}`)
                    } catch (err) {
                        console.error(`  ❌ Failed to migrate main image:`, err.message)
                        failCount++
                    }
                } else {
                    console.log(`  ⏭️  Main image already on S3 or external URL`)
                    skippedCount++
                }
            }

            // Migrate additional images
            if (Array.isArray(product.images) && product.images.length > 0) {
                const migratedImages = []

                for (let i = 0; i < product.images.length; i++) {
                    const imageUrl = product.images[i]

                    if (imageUrl && imageUrl.includes('supabase')) {
                        try {
                            console.log(`  Downloading image ${i + 1}/${product.images.length}...`)
                            const response = await axios.get(imageUrl, {
                                responseType: 'arraybuffer',
                                timeout: 30000
                            })
                            const buffer = Buffer.from(response.data)

                            // Extract file extension
                            const urlParts = imageUrl.split('.')
                            const ext = urlParts.length > 1 ? urlParts[urlParts.length - 1].split('?')[0] : 'jpg'

                            const fileName = `product-${product.id}-${i}-${Date.now()}.${ext}`

                            console.log(`  Uploading to S3...`)
                            const result = await uploadToS3(
                                buffer,
                                fileName,
                                `image/${ext}`,
                                'product-images'
                            )

                            migratedImages.push(result.url)
                            productUpdated = true
                            console.log(`  ✅ Image ${i + 1} migrated: ${fileName}`)
                        } catch (err) {
                            console.error(`  ❌ Failed to migrate image ${i + 1}:`, err.message)
                            migratedImages.push(imageUrl) // Keep original on failure
                            failCount++
                        }
                    } else {
                        console.log(`  ⏭️  Image ${i + 1} already on S3 or external URL`)
                        migratedImages.push(imageUrl)
                        skippedCount++
                    }
                }

                newImages = migratedImages
            }

            // Update product with new URLs if any images were migrated
            if (productUpdated) {
                console.log(`  Updating database...`)
                const { error: updateError } = await supabaseAdmin
                    .from('products')
                    .update({
                        image_url: newImageUrl,
                        images: newImages
                    })
                    .eq('id', product.id)

                if (updateError) {
                    console.error(`  ❌ Failed to update product ${product.id}:`, updateError.message)
                    failCount++
                } else {
                    console.log(`  ✅ Product ${product.id} updated in database`)
                    successCount++
                }
            } else {
                console.log(`  ⏭️  No migration needed for product ${product.id}`)
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500))
        }

        console.log('\n' + '='.repeat(50))
        console.log('✅ Migration completed!')
        console.log('='.repeat(50))
        console.log(`Total products processed: ${products.length}`)
        console.log(`Successfully migrated: ${successCount}`)
        console.log(`Failed: ${failCount}`)
        console.log(`Skipped (already migrated): ${skippedCount}`)
        console.log('='.repeat(50))

    } catch (err) {
        console.error('\n❌ Migration failed:', err)
        process.exit(1)
    }
}

// Run migration
migrateImages()
    .then(() => {
        console.log('\n✅ Migration script completed successfully')
        process.exit(0)
    })
    .catch((err) => {
        console.error('\n❌ Migration script failed:', err)
        process.exit(1)
    })
