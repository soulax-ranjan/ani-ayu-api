import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import {
    processUpload,
    convertToWebp,
    UnsupportedImageError,
    MAX_DIMENSION,
    SMALL_FILE_BYTES
} from '../src/lib/imageProcessing.js'

// Random noise compresses badly, which gives realistic "photo-sized" files
function noise(width, height, channels = 3) {
    return sharp({
        create: { width, height, channels, noise: { type: 'gaussian', mean: 128, sigma: 40 } }
    })
}

function solid(width, height, background) {
    return sharp({ create: { width, height, channels: 4, background } })
}

test('large PNG is resized to fit within 1600px and converted to WebP', async () => {
    const input = await noise(3200, 2400).png().toBuffer()
    const result = await processUpload(input)

    assert.equal(result.converted, true)
    assert.equal(result.ext, 'webp')
    assert.equal(result.contentType, 'image/webp')

    const meta = await sharp(result.buffer).metadata()
    assert.equal(meta.format, 'webp')
    assert.equal(meta.width, MAX_DIMENSION)
    assert.equal(meta.height, 1200)
    assert.ok(result.buffer.length < input.length)
})

test('portrait image is limited by its height', async () => {
    const input = await noise(1000, 2000).png().toBuffer()
    const meta = await sharp((await processUpload(input)).buffer).metadata()
    assert.equal(meta.width, 800)
    assert.equal(meta.height, MAX_DIMENSION)
})

test('small images are never upscaled', async () => {
    const input = await noise(800, 600).png().toBuffer()
    const result = await processUpload(input)
    const meta = await sharp(result.buffer).metadata()

    assert.equal(result.converted, true) // PNGs are always converted
    assert.equal(meta.format, 'webp')
    assert.equal(meta.width, 800)
    assert.equal(meta.height, 600)
})

test('EXIF orientation is applied and metadata is stripped', async () => {
    // Stored as 200x100 landscape, with orientation 6 (rotate 90° clockwise to display)
    const input = await noise(200, 100).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    assert.equal((await sharp(input).metadata()).orientation, 6)

    const result = await processUpload(input)
    const meta = await sharp(result.buffer).metadata()

    assert.equal(result.converted, true) // small, but needs rotation so not passed through
    assert.equal(meta.width, 100)
    assert.equal(meta.height, 200)
    assert.equal(meta.orientation, undefined)
    assert.equal(meta.exif, undefined)
})

test('PNG with real transparency keeps its alpha channel', async () => {
    const transparent = await solid(400, 400, { r: 0, g: 0, b: 0, alpha: 0 })
        .composite([{ input: await solid(200, 200, { r: 255, g: 0, b: 0, alpha: 1 }).png().toBuffer(), top: 100, left: 100 }])
        .png()
        .toBuffer()

    const result = await convertToWebp(transparent)
    assert.equal(result.hasAlpha, true)

    const meta = await sharp(result.buffer).metadata()
    assert.equal(meta.hasAlpha, true)
    const [cornerAlpha] = (await sharp(result.buffer).extractChannel(3).raw().toBuffer()).subarray(0, 1)
    assert.equal(cornerAlpha, 0)
})

test('fully opaque RGBA PNG drops the unused alpha channel', async () => {
    const opaque = await solid(400, 400, { r: 10, g: 120, b: 200, alpha: 1 }).png().toBuffer()
    assert.equal((await sharp(opaque).metadata()).hasAlpha, true)

    const result = await convertToWebp(opaque)
    assert.equal(result.hasAlpha, false)
    assert.equal((await sharp(result.buffer).metadata()).hasAlpha, false)
})

test('small JPEG within limits is stored as-is', async () => {
    const input = await noise(600, 400).jpeg({ quality: 70 }).toBuffer()
    assert.ok(input.length < SMALL_FILE_BYTES)

    const result = await processUpload(input)
    assert.equal(result.converted, false)
    assert.equal(result.ext, 'jpg')
    assert.equal(result.contentType, 'image/jpeg')
    assert.equal(result.buffer, input)
})

test('small WebP within limits is stored as-is', async () => {
    const input = await noise(600, 400).webp({ quality: 70 }).toBuffer()
    const result = await processUpload(input)
    assert.equal(result.converted, false)
    assert.equal(result.ext, 'webp')
    assert.equal(result.buffer, input)
})

test('JPEG over the size threshold is converted even if within 1600px', async () => {
    const input = await noise(1500, 1500).jpeg({ quality: 100 }).toBuffer()
    assert.ok(input.length > SMALL_FILE_BYTES)

    const result = await processUpload(input)
    assert.equal(result.converted, true)
    assert.equal((await sharp(result.buffer).metadata()).format, 'webp')
})

test('non-image data is rejected with UnsupportedImageError', async () => {
    await assert.rejects(processUpload(Buffer.from('definitely not an image')), UnsupportedImageError)
})
