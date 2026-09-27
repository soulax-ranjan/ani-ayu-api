import sharp from 'sharp'

export const MAX_DIMENSION = 1600
export const WEBP_QUALITY = 80
export const SMALL_FILE_BYTES = 400 * 1024
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'

// Formats that may be stored untouched when they are already small enough
const PASSTHROUGH_FORMATS = {
    webp: { ext: 'webp', contentType: 'image/webp' },
    jpeg: { ext: 'jpg', contentType: 'image/jpeg' }
}

export class UnsupportedImageError extends Error {}

/**
 * Read image metadata, throwing UnsupportedImageError if sharp cannot decode it
 * @param {Buffer} buffer
 */
export async function readImageMetadata(buffer) {
    try {
        const metadata = await sharp(buffer).metadata()
        if (!metadata.width || !metadata.height) throw new Error('Missing dimensions')
        return metadata
    } catch (error) {
        throw new UnsupportedImageError(`Unsupported or corrupt image: ${error.message}`)
    }
}

/**
 * Whether an image is large enough (bytes or pixels) to be worth converting
 */
export function isOversized({ bytes, width, height }) {
    return bytes > SMALL_FILE_BYTES || Math.max(width, height) > MAX_DIMENSION
}

/**
 * Convert an image to WebP: apply EXIF rotation, fit within MAX_DIMENSION
 * (never upscale), strip metadata, keep alpha only if it is actually used.
 * @param {Buffer} buffer
 * @returns {Promise<{buffer: Buffer, width: number, height: number, hasAlpha: boolean}>}
 */
export async function convertToWebp(buffer) {
    const metadata = await readImageMetadata(buffer)

    // An RGBA PNG that is fully opaque does not need an alpha channel
    let keepAlpha = false
    if (metadata.hasAlpha) {
        const { isOpaque } = await sharp(buffer).stats()
        keepAlpha = !isOpaque
    }

    let pipeline = sharp(buffer)
        .rotate() // applies EXIF orientation; output metadata is stripped by default
        .resize({
            width: MAX_DIMENSION,
            height: MAX_DIMENSION,
            fit: 'inside',
            withoutEnlargement: true
        })

    if (!keepAlpha) pipeline = pipeline.removeAlpha()

    const { data, info } = await pipeline
        .webp({ quality: WEBP_QUALITY, effort: 4 })
        .toBuffer({ resolveWithObject: true })

    return { buffer: data, width: info.width, height: info.height, hasAlpha: info.channels === 4 }
}

/**
 * Prepare an uploaded image for storage.
 * Small, correctly oriented WebP/JPEG files are stored as-is; everything else becomes WebP.
 * @param {Buffer} buffer
 * @returns {Promise<{buffer: Buffer, ext: string, contentType: string, converted: boolean}>}
 */
export async function processUpload(buffer) {
    const metadata = await readImageMetadata(buffer)
    const passthrough = PASSTHROUGH_FORMATS[metadata.format]
    const needsRotation = metadata.orientation && metadata.orientation !== 1

    if (
        passthrough &&
        !needsRotation &&
        !isOversized({ bytes: buffer.length, width: metadata.width, height: metadata.height })
    ) {
        return { buffer, ...passthrough, converted: false }
    }

    const converted = await convertToWebp(buffer)
    return { buffer: converted.buffer, ext: 'webp', contentType: 'image/webp', converted: true }
}
