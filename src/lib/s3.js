import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Initialize S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
})

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME

/**
 * Upload a file to S3
 * @param {Buffer|Stream} fileContent - File content as buffer or stream
 * @param {string} fileName - Name of the file in S3
 * @param {string} contentType - MIME type of the file
 * @param {string} folder - Optional folder path (e.g., 'products', 'banners')
 * @returns {Promise<{success: boolean, key: string, url: string}>}
 */
export async function uploadToS3(fileContent, fileName, contentType, folder = 'uploads') {
    try {
        const key = folder ? `${folder}/${fileName}` : fileName

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: fileContent,
            ContentType: contentType
            // Note: ACL removed - bucket uses bucket-level public access policy
        })

        await s3Client.send(command)

        // Generate public URL
        const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`

        return {
            success: true,
            key,
            url
        }
    } catch (error) {
        console.error('S3 upload error:', error)
        throw error
    }
}

/**
 * Delete a file from S3
 * @param {string} key - S3 object key (full path including folder)
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteFromS3(key) {
    try {
        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        })

        await s3Client.send(command)

        return { success: true }
    } catch (error) {
        console.error('S3 delete error:', error)
        throw error
    }
}

/**
 * Generate a presigned URL for private file access
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>}
 */
export async function getPresignedUrl(key, expiresIn = 3600) {
    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        })

        const url = await getSignedUrl(s3Client, command, { expiresIn })
        return url
    } catch (error) {
        console.error('S3 presigned URL error:', error)
        throw error
    }
}

/**
 * Get public URL for an S3 object
 * @param {string} key - S3 object key
 * @returns {string}
 */
export function getPublicUrl(key) {
    return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`
}

/**
 * Helper to determine folder name based on upload type
 * @param {string} type - Upload type ('product', 'banner', etc.)
 * @returns {string}
 */
export function getFolderName(type) {
    switch (type) {
        case 'banner':
            return 'banners'
        case 'product':
        default:
            return 'product-images'
    }
}

export { s3Client, BUCKET_NAME }
