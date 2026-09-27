import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    IMAGE_TABLES,
    s3KeyFromUrl,
    webpKeyFor,
    webpUrlFor,
    isWebpPath,
    planRowUpdate,
    collectUrls
} from '../scripts/lib/image-migration.js'

const bucketConfig = { bucket: 'ani-ayu-products-images', region: 'ap-south-1' }
const BASE = 'https://ani-ayu-products-images.s3.ap-south-1.amazonaws.com'
const products = IMAGE_TABLES.find(t => t.table === 'products')
const banners = IMAGE_TABLES.find(t => t.table === 'homepage_banners')

test('s3KeyFromUrl only accepts URLs in our bucket', () => {
    assert.equal(s3KeyFromUrl(`${BASE}/product-images/1776703429579-7wmsayh1m5u.png`, bucketConfig), 'product-images/1776703429579-7wmsayh1m5u.png')
    assert.equal(s3KeyFromUrl('https://ani-ayu-products-images.s3.amazonaws.com/banners/a.png', bucketConfig), 'banners/a.png')
    assert.equal(s3KeyFromUrl(`${BASE}/banners/my%20photo.png`, bucketConfig), 'banners/my photo.png')

    assert.equal(s3KeyFromUrl('https://ldfykcszxyjrferywgjb.supabase.co/storage/v1/object/public/product-images/design-3.webp', bucketConfig), null)
    assert.equal(s3KeyFromUrl('/assets/placeholders/ph-card-4x5.svg', bucketConfig), null)
    assert.equal(s3KeyFromUrl('https://other-bucket.s3.ap-south-1.amazonaws.com/x.png', bucketConfig), null)
    assert.equal(s3KeyFromUrl(null, bucketConfig), null)
})

test('webp key and URL replace only the extension', () => {
    assert.equal(webpKeyFor('product-images/1776703429579-7wmsayh1m5u.png'), 'product-images/1776703429579-7wmsayh1m5u.webp')
    assert.equal(webpKeyFor('banners/photo.final.JPEG'), 'banners/photo.final.webp')
    assert.equal(webpKeyFor('banners.v2/noext'), 'banners.v2/noext.webp')
    assert.equal(webpUrlFor(`${BASE}/product-images/a.png`), `${BASE}/product-images/a.webp`)
    assert.ok(isWebpPath('x/a.WEBP'))
    assert.ok(!isWebpPath('x/a.png'))
})

test('planRowUpdate rewrites image_url and matching entries in images', () => {
    const a = `${BASE}/product-images/a.png`
    const b = `${BASE}/product-images/b.png`
    const placeholder = '/assets/placeholders/ph-card-4x5.svg'
    const urlMap = new Map([[a, webpUrlFor(a)], [b, webpUrlFor(b)]])

    const entry = planRowUpdate({ id: 7, image_url: a, images: [a, placeholder, b] }, products, urlMap)
    assert.deepEqual(entry, {
        table: 'products',
        id: 7,
        old: { image_url: a, images: [a, placeholder, b] },
        new: { image_url: webpUrlFor(a), images: [webpUrlFor(a), placeholder, webpUrlFor(b)] }
    })
})

test('planRowUpdate keeps untouched columns in the backup and skips unchanged rows', () => {
    const a = `${BASE}/product-images/a.png`
    const kept = `${BASE}/product-images/kept.jpg`
    const urlMap = new Map([[a, webpUrlFor(a)]])

    const imagesOnly = planRowUpdate({ id: 1, image_url: kept, images: [a] }, products, urlMap)
    assert.equal(imagesOnly.old.image_url, kept)
    assert.equal(imagesOnly.new.image_url, kept)
    assert.deepEqual(imagesOnly.new.images, [webpUrlFor(a)])

    assert.equal(planRowUpdate({ id: 2, image_url: kept, images: null }, products, urlMap), null)
    assert.equal(planRowUpdate({ id: 3, image_url: null }, banners, urlMap), null)
})

test('collectUrls gathers distinct URLs from string and array columns', () => {
    const rows = [
        { id: 1, image_url: 'u1', images: ['u1', 'u2', null] },
        { id: 2, image_url: null, images: null }
    ]
    assert.deepEqual([...collectUrls(rows, products)].sort(), ['u1', 'u2'])
})
