import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    normalizePhone,
    phoneSearchFilter,
    maskName,
    maskPhone,
    maskOrderNumber,
    toPublicOrder,
    createRateLimiter
} from '../src/lib/orderLookup.js'

test('normalizePhone accepts the formats customers type and the database stores', () => {
    for (const input of ['9988776655', '99887 76655', '+919988776655', '+91 99887 76655', '91-99887-76655', '09988776655']) {
        assert.equal(normalizePhone(input), '9988776655', input)
    }
})

test('normalizePhone rejects anything that is not a 10-digit number', () => {
    for (const input of ['', '12345', '99887766550000', 'phone', '%', null, undefined, 9988776655]) {
        assert.equal(normalizePhone(input), null, String(input))
    }
})

test('phoneSearchFilter covers plain, +91 and spaced formats', () => {
    assert.equal(phoneSearchFilter('9988776655'), 'phone.ilike.%9988776655,phone.ilike.%99887 76655')
})

test('masking helpers hide personal details', () => {
    assert.equal(maskName('Ravi  Kumar'), 'R*** K***')
    assert.equal(maskName(null), null)
    assert.equal(maskPhone('9988776655'), '******6655')
    assert.equal(maskOrderNumber('order_P3t4B1rY8bAOme'), 'order_••••AOme')
    assert.equal(maskOrderNumber(null), null)
})

test('toPublicOrder keeps status, items and totals but masks the address', () => {
    const order = {
        id: 'uuid-1',
        razorpay_order_id: 'order_P3t4B1rY8bAOme',
        created_at: '2026-09-01T10:00:00Z',
        status: 'delivered',
        payment_status: 'paid',
        payment_method: 'upi',
        total_amount: 1499,
        discount_amount: 0,
        address: {
            full_name: 'Ravi Kumar',
            phone: '+919988776655',
            address_line1: 'Flat 101, Guest Residency',
            city: 'Bengaluru',
            state: 'Karnataka',
            postal_code: '560001'
        },
        items: [{ quantity: 1, size: 'M', color: 'Gold', price_at_purchase: 1499, product: { name: 'Silk Kurta', image_url: 'https://x/a.webp' } }]
    }

    const result = toPublicOrder(order)
    assert.deepEqual(result.delivery, { name: 'R*** K***', phone: '******6655', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001' })
    assert.deepEqual(result.items, [{ name: 'Silk Kurta', image: 'https://x/a.webp', quantity: 1, size: 'M', color: 'Gold', price: 1499 }])
    assert.equal(result.orderNumber, 'order_••••AOme')
    assert.equal(result.status, 'delivered')
    assert.ok(!JSON.stringify(result).includes('Flat 101'))
    assert.ok(!JSON.stringify(result).includes('P3t4B1rY8b'))
    assert.equal(result.id, undefined)
})

test('toPublicOrder falls back to cart_snapshot when there are no order_items', () => {
    const order = {
        id: 'uuid-2',
        status: 'pending',
        items: [],
        cart_snapshot: [{ cart_item_id: 'c1', product_id: 'p1', quantity: 2, size: 'S', color: 'Red', price_at_purchase: 799 }],
        address: { full_name: 'Asha', phone: '9988776655', city: 'Pune' }
    }
    const products = new Map([['p1', { name: 'Lehenga', image_url: 'https://x/l.webp' }]])

    assert.deepEqual(toPublicOrder(order, products).items, [
        { name: 'Lehenga', image: 'https://x/l.webp', quantity: 2, size: 'S', color: 'Red', price: 799 }
    ])
    assert.equal(JSON.stringify(toPublicOrder(order, products)).includes('cart_item_id'), false)
})

test('rate limiter allows `limit` requests per key per window', () => {
    let time = 0
    const allow = createRateLimiter({ limit: 2, windowMs: 1000, now: () => time })
    assert.equal(allow('a'), true)
    assert.equal(allow('a'), true)
    assert.equal(allow('a'), false)
    assert.equal(allow('b'), true)
    time = 1000
    assert.equal(allow('a'), true)
})
