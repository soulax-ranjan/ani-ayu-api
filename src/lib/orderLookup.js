// Helpers for looking up orders by phone number (guests who don't have their order ID)

/**
 * Normalise an Indian mobile number to its 10 digits.
 * Accepts "9988776655", "99887 76655", "+91 99887 76655", "+919988776655", "09988776655".
 * Returns null if it doesn't look like a 10-digit number.
 */
export function normalizePhone(input) {
    if (typeof input !== 'string') return null
    let digits = input.replace(/\D/g, '')
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
    else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
    return /^\d{10}$/.test(digits) ? digits : null
}

/**
 * PostgREST `or` filter matching the formats phones are stored in:
 * "+91XXXXXXXXXX", "XXXXXXXXXX" and "XXXXX XXXXX".
 * Results must still be checked with normalizePhone, since "%" is a loose match.
 */
export function phoneSearchFilter(digits) {
    return `phone.ilike.%${digits},phone.ilike.%${digits.slice(0, 5)} ${digits.slice(5)}`
}

// "Ravi Kumar" -> "R*** K***"
export function maskName(name) {
    if (!name) return null
    return name.trim().split(/\s+/).map(part => `${part[0]}***`).join(' ')
}

// "9988776655" -> "******6655"
export function maskPhone(digits) {
    return digits ? `******${digits.slice(-4)}` : null
}

// "order_P3t4B1rY8bAOme" -> "order_••••AOme"
export function maskOrderNumber(orderNumber) {
    if (!orderNumber) return null
    const prefix = orderNumber.startsWith('order_') ? 'order_' : ''
    return `${prefix}••••${orderNumber.slice(-4)}`
}

/**
 * Order lines from order_items, or from cart_snapshot for online orders whose payment
 * was not verified (those have no order_items yet).
 */
function orderLines(order, productsById) {
    if (order.items?.length) {
        return order.items
    }
    if (Array.isArray(order.cart_snapshot)) {
        return order.cart_snapshot.map(item => ({ ...item, product: productsById.get(item.product_id) }))
    }
    return []
}

/**
 * Reduce an order row to what is safe to show to someone who only knows the phone number:
 * status, items and totals, with the delivery address and identifiers masked.
 * @param {object} order
 * @param {Map<string, {name: string, image_url: string}>} productsById - products for cart_snapshot lines
 */
export function toPublicOrder(order, productsById = new Map()) {
    const address = order.address || {}
    // No internal order id: GET /orders/:id does not check ownership, so the id would expose the full order
    return {
        orderNumber: maskOrderNumber(order.razorpay_order_id),
        createdAt: order.created_at,
        status: order.status,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        totalAmount: order.total_amount,
        discountAmount: order.discount_amount,
        items: orderLines(order, productsById).map(item => ({
            name: item.product?.name ?? null,
            image: item.product?.image_url ?? null,
            quantity: item.quantity,
            size: item.size,
            color: item.color,
            price: item.price_at_purchase
        })),
        delivery: {
            name: maskName(address.full_name),
            phone: maskPhone(normalizePhone(address.phone)),
            city: address.city ?? null,
            state: address.state ?? null,
            postalCode: address.postal_code ?? null
        }
    }
}

/**
 * Minimal fixed-window rate limiter kept in memory (single EC2 instance).
 * Returns a function that reports whether `key` may make another request.
 */
export function createRateLimiter({ limit, windowMs, now = Date.now }) {
    const hits = new Map()
    return function allow(key) {
        const time = now()
        const entry = hits.get(key)
        if (!entry || time - entry.start >= windowMs) {
            hits.set(key, { start: time, count: 1 })
            // Drop expired entries occasionally so the map doesn't grow forever
            if (hits.size > 10000) {
                for (const [k, v] of hits) if (time - v.start >= windowMs) hits.delete(k)
            }
            return true
        }
        entry.count++
        return entry.count <= limit
    }
}
