import sharp from 'sharp'
import axios from 'axios'
import { supabaseAdmin } from '../lib/supabase.js'
import { uploadToS3, deleteFromS3, getPublicUrl } from '../lib/s3.js'
import { createWriteStream, createReadStream, unlinkSync, mkdirSync, readFileSync } from 'fs'
import { pipeline } from 'stream/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const MAX_SIZE_MB = 2
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024
const COMPRESSION_QUALITY = 80
const TEMP_DIR = join(tmpdir(), 'image-compression')

// Ensure temp directory exists
try {
    mkdirSync(TEMP_DIR, { recursive: true })
} catch (err) {
    console.error('Failed to create temp directory:', err)
}

/**
 * Extract folder and filename from S3 URL
 * Example: https://bucket.s3.region.amazonaws.com/product-images/image.jpg
 * Returns: { folder: 'product-images', fileName: 'image.jpg', key: 'product-images/image.jpg' }
 */
function parseS3Url(url) {
    try {
        const urlObj = new URL(url)
        const pathParts = urlObj.pathname.split('/').filter(p => p)

        if (pathParts.length < 2) {
            throw new Error('Invalid S3 URL format')
        }

        const folder = pathParts[0]
        const fileName = pathParts.slice(1).join('/')
        const key = `${folder}/${fileName}`

        return { folder, fileName, key }
    } catch (err) {
        console.error('Failed to parse S3 URL:', url, err)
        return null
    }
}

/**
 * Download image from URL to local temp file
 */
async function downloadImage(url, tempPath) {
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream'
    })

    await pipeline(response.data, createWriteStream(tempPath))
    return tempPath
}

/**
 * Compress image using sharp
 */
async function compressImage(inputPath, outputPath) {
    await sharp(inputPath)
        .jpeg({ quality: COMPRESSION_QUALITY, progressive: true })
        .toFile(outputPath)

    return outputPath
}

/**
 * Upload compressed image to S3
 */
async function uploadCompressedToS3(filePath, folder, fileName) {
    const fileBuffer = readFileSync(filePath)

    const result = await uploadToS3(fileBuffer, fileName, 'image/jpeg', folder)

    if (!result.success) {
        throw new Error('Failed to upload to S3')
    }

    return result
}

/**
 * Get file size from URL
 */
async function getFileSize(url) {
    try {
        const response = await axios.head(url)
        return parseInt(response.headers['content-length'] || '0', 10)
    } catch (err) {
        console.error('Failed to get file size:', err)
        return 0
    }
}

/**
 * Process a single image URL
 */
async function processImage(imageUrl, productId) {
    console.log(`Processing image: ${imageUrl}`)

    // Check file size
    const fileSize = await getFileSize(imageUrl)
    console.log(`File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`)

    if (fileSize <= MAX_SIZE_BYTES) {
        console.log('Image is already under 2MB, skipping...')
        return imageUrl
    }

    const urlInfo = parseS3Url(imageUrl)
    if (!urlInfo) {
        console.warn('Skipping non-S3 URL:', imageUrl)
        return imageUrl
    }

    const { folder, fileName, key } = urlInfo
    const timestamp = Date.now()
    const tempInput = join(TEMP_DIR, `input-${timestamp}.jpg`)
    const tempOutput = join(TEMP_DIR, `output-${timestamp}.jpg`)

    try {
        // Download original image
        console.log('Downloading image...')
        await downloadImage(imageUrl, tempInput)

        // Compress image
        console.log('Compressing image...')
        await compressImage(tempInput, tempOutput)

        // Check compressed size
        const { size: compressedSize } = await sharp(tempOutput).metadata()
        console.log(`Compressed size: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`)

        // Generate new filename with timestamp to avoid caching issues
        const fileNameParts = fileName.split('.')
        const extension = fileNameParts.pop()
        const newFileName = `${fileNameParts.join('.')}-compressed-${timestamp}.${extension}`

        // Upload compressed image
        console.log('Uploading compressed image to S3...')
        const uploadResult = await uploadCompressedToS3(tempOutput, folder, newFileName)

        // Delete old image (optional - comment out if you want to keep originals)
        console.log('Deleting old image from S3...')
        await deleteFromS3(key)

        console.log('✅ Image compressed successfully')
        return uploadResult.url

    } catch (err) {
        console.error('Failed to process image:', err)
        return imageUrl // Return original URL on failure
    } finally {
        // Cleanup temp files
        try {
            unlinkSync(tempInput)
            unlinkSync(tempOutput)
        } catch (err) {
            // Ignore cleanup errors
        }
    }
}

/**
 * Main service function to compress all product images
 */
export async function compressAllProductImages() {
    console.log('🚀 Starting image compression service...')

    try {
        // Fetch all products
        const { data: products, error } = await supabaseAdmin
            .from('products')
            .select('id, image_url, images')

        if (error) {
            throw error
        }

        console.log(`Found ${products.length} products`)

        let processedCount = 0
        let updatedCount = 0

        for (const product of products) {
            console.log(`\n--- Processing product ${product.id} ---`)

            let needsUpdate = false
            let newImageUrl = product.image_url
            let newImages = product.images || []

            // Process main image
            if (product.image_url) {
                const compressed = await processImage(product.image_url, product.id)
                if (compressed !== product.image_url) {
                    newImageUrl = compressed
                    needsUpdate = true
                }
            }

            // Process additional images
            if (Array.isArray(product.images) && product.images.length > 0) {
                const compressedImages = []
                for (const imageUrl of product.images) {
                    const compressed = await processImage(imageUrl, product.id)
                    compressedImages.push(compressed)
                    if (compressed !== imageUrl) {
                        needsUpdate = true
                    }
                }
                newImages = compressedImages
            }

            // Update product if any images were compressed
            if (needsUpdate) {
                const { error: updateError } = await supabaseAdmin
                    .from('products')
                    .update({
                        image_url: newImageUrl,
                        images: newImages
                    })
                    .eq('id', product.id)

                if (updateError) {
                    console.error('Failed to update product:', updateError)
                } else {
                    console.log('✅ Product updated')
                    updatedCount++
                }
            }

            processedCount++
        }

        console.log('\n✅ Image compression service completed!')
        console.log(`Processed: ${processedCount} products`)
        console.log(`Updated: ${updatedCount} products`)

        return {
            success: true,
            processed: processedCount,
            updated: updatedCount
        }

    } catch (err) {
        console.error('❌ Image compression service failed:', err)
        throw err
    }
}

// Export individual functions for testing
export {
    processImage,
    parseS3Url,
    getFileSize
}
