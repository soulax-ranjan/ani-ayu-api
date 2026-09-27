// Pure helpers for scripts/migrate-images-to-webp.js (no S3 or database access, so they are unit-testable)

// Tables and the columns in them that hold S3 image URLs.
// Orders, order items and cart items are deliberately excluded.
export const IMAGE_TABLES = [
    { table: 'products', stringColumns: ['image_url'], arrayColumns: ['images'] },
    { table: 'homepage_banners', stringColumns: ['image_url'], arrayColumns: [] },
    { table: 'categories', stringColumns: ['image_url'], arrayColumns: [] }
]

export function columnsFor(tableConfig) {
    return [...tableConfig.stringColumns, ...tableConfig.arrayColumns]
}

/**
 * Return the S3 object key for a URL in our bucket, or null for anything else
 * (Supabase storage links, relative placeholders, other buckets).
 * Supports virtual-hosted style URLs, with or without the region.
 */
export function s3KeyFromUrl(url, { bucket, region }) {
    if (typeof url !== 'string') return null
    let parsed
    try {
        parsed = new URL(url)
    } catch {
        return null
    }
    const hosts = [`${bucket}.s3.${region}.amazonaws.com`, `${bucket}.s3.amazonaws.com`]
    if (parsed.protocol !== 'https:' || !hosts.includes(parsed.hostname)) return null

    const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
    return key || null
}

export function isWebpPath(path) {
    return /\.webp$/i.test(path)
}

/**
 * Key of the WebP sibling: same key with the extension replaced by .webp
 */
export function webpKeyFor(key) {
    return key.replace(/\.[^./]+$/, '') + '.webp'
}

/**
 * Same URL (host, query untouched) with the file extension replaced by .webp
 */
export function webpUrlFor(url) {
    const parsed = new URL(url)
    parsed.pathname = webpKeyFor(parsed.pathname)
    return parsed.toString()
}

/**
 * Compute the new column values for a row given a map of old URL -> new URL.
 * `old` and `new` always hold every image column of the row, so a backup entry
 * restores the row completely. Returns null when nothing in the row changes.
 */
export function planRowUpdate(row, tableConfig, urlMap) {
    const oldValues = {}
    const newValues = {}
    let changed = false

    for (const column of tableConfig.stringColumns) {
        const value = row[column] ?? null
        oldValues[column] = value
        newValues[column] = urlMap.has(value) ? urlMap.get(value) : value
        if (newValues[column] !== value) changed = true
    }

    for (const column of tableConfig.arrayColumns) {
        const value = row[column] ?? null
        oldValues[column] = value
        newValues[column] = Array.isArray(value)
            ? value.map(item => (urlMap.has(item) ? urlMap.get(item) : item))
            : value
        if (Array.isArray(value) && newValues[column].some((item, i) => item !== value[i])) changed = true
    }

    if (!changed) return null
    return { table: tableConfig.table, id: row.id, old: oldValues, new: newValues }
}

/**
 * Collect every distinct URL referenced by the image columns of the given rows
 */
export function collectUrls(rows, tableConfig) {
    const urls = new Set()
    for (const row of rows) {
        for (const column of tableConfig.stringColumns) {
            if (row[column]) urls.add(row[column])
        }
        for (const column of tableConfig.arrayColumns) {
            if (Array.isArray(row[column])) row[column].forEach(url => url && urls.add(url))
        }
    }
    return urls
}

export function formatBytes(bytes) {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
    return `${(bytes / 1024).toFixed(0)} KB`
}
