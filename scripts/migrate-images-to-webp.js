// One-off migration: convert oversized product/banner/category images in S3 to WebP
// and point the database rows at the new files. Originals are never deleted or overwritten.
//
//   node scripts/migrate-images-to-webp.js                      # dry run (default, read-only)
//   node scripts/migrate-images-to-webp.js --execute            # convert, back up rows, update rows
//   node scripts/migrate-images-to-webp.js --rollback <file>    # restore rows from a backup file
import 'dotenv/config'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { s3Client, BUCKET_NAME } from '../src/lib/s3.js'
import { supabaseAdmin } from '../src/lib/supabase.js'
import {
    convertToWebp,
    readImageMetadata,
    isOversized,
    IMMUTABLE_CACHE_CONTROL
} from '../src/lib/imageProcessing.js'
import {
    IMAGE_TABLES,
    columnsFor,
    s3KeyFromUrl,
    isWebpPath,
    webpKeyFor,
    webpUrlFor,
    planRowUpdate,
    collectUrls,
    formatBytes
} from './lib/image-migration.js'

const REGION = process.env.AWS_REGION || 'us-east-1'
const BACKUP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'backups')
const FILE_CONCURRENCY = 4
const PAGE_SIZE = 1000

// ---------- S3 helpers ----------

function isNotFound(error) {
    return error?.name === 'NotFound' || error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404
}

async function objectExists(key) {
    try {
        await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
        return true
    } catch (error) {
        if (isNotFound(error)) return false
        throw error
    }
}

async function downloadObject(key) {
    const response = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
    return Buffer.from(await response.Body.transformToByteArray())
}

// Returns false if the key already exists (If-None-Match makes S3 refuse to overwrite)
async function putIfAbsent(key, body) {
    try {
        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: body,
            ContentType: 'image/webp',
            CacheControl: IMMUTABLE_CACHE_CONTROL,
            IfNoneMatch: '*'
        }))
        return true
    } catch (error) {
        if (error?.$metadata?.httpStatusCode === 412 || error?.name === 'PreconditionFailed') return false
        throw error
    }
}

// ---------- Database helpers ----------

async function fetchAllRows(tableConfig) {
    const rows = []
    const select = ['id', ...columnsFor(tableConfig)].join(', ')
    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabaseAdmin
            .from(tableConfig.table)
            .select(select)
            .order('id')
            .range(from, from + PAGE_SIZE - 1)
        if (error) throw new Error(`Failed to read ${tableConfig.table}: ${error.message}`)
        rows.push(...data)
        if (data.length < PAGE_SIZE) return rows
    }
}

/**
 * Update one row with a single UPDATE statement (atomic per row). The update only
 * applies if the row's URL columns still hold `expected`, so edits made in the admin
 * panel while the script runs are never overwritten. Returns true if the row was updated.
 */
async function updateRowIfUnchanged(table, id, values, expected) {
    const tableConfig = IMAGE_TABLES.find(t => t.table === table)
    if (!tableConfig) throw new Error(`Unknown table in backup: ${table}`)

    let query = supabaseAdmin.from(table).update(values).eq('id', id)
    for (const column of tableConfig.stringColumns) {
        query = expected[column] === null ? query.is(column, null) : query.eq(column, expected[column])
    }
    const { data, error } = await query.select('id')
    if (error) throw new Error(error.message)
    return data.length > 0
}

// ---------- Utilities ----------

async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length)
    let next = 0
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const index = next++
            results[index] = await fn(items[index], index)
        }
    })
    await Promise.all(workers)
    return results
}

function describeRowChange(entry) {
    const parts = []
    for (const [column, oldValue] of Object.entries(entry.old)) {
        const newValue = entry.new[column]
        if (Array.isArray(oldValue)) {
            const changed = oldValue.filter((url, i) => url !== newValue[i]).length
            if (changed) parts.push(`${column}: ${changed} of ${oldValue.length} entries -> .webp`)
        } else if (oldValue !== newValue) {
            parts.push(`${column}: ${oldValue} -> ${newValue}`)
        }
    }
    return `  ${entry.table} ${entry.id}\n    ${parts.join('\n    ')}`
}

// ---------- Per-file processing ----------

/**
 * Decide what to do with one image URL and, when executing, write the WebP sibling.
 * Never throws; failures are returned as { status: 'failed' }.
 */
async function processFile(url, key, execute) {
    try {
        if (isWebpPath(key)) return { url, key, status: 'already-webp' }

        const webpKey = webpKeyFor(key)
        if (await objectExists(webpKey)) {
            return { url, key, status: 'webp-exists', newUrl: webpUrlFor(url) }
        }

        const original = await downloadObject(key)
        const metadata = await readImageMetadata(original)
        const dims = `${metadata.width}x${metadata.height}`

        if (!isOversized({ bytes: original.length, width: metadata.width, height: metadata.height })) {
            return { url, key, status: 'small', before: original.length, dims }
        }

        const converted = await convertToWebp(original)
        const result = {
            url,
            key,
            webpKey,
            before: original.length,
            after: converted.buffer.length,
            dims,
            newDims: `${converted.width}x${converted.height}`,
            alpha: converted.hasAlpha
        }

        if (converted.buffer.length >= original.length) return { ...result, status: 'no-gain' }
        if (!execute) return { ...result, status: 'would-convert', newUrl: webpUrlFor(url) }

        const written = await putIfAbsent(webpKey, converted.buffer)
        return { ...result, status: written ? 'converted' : 'webp-exists', newUrl: webpUrlFor(url) }
    } catch (error) {
        return { url, key, status: 'failed', error: isNotFound(error) ? 'original not found in S3' : error.message }
    }
}

function logFileResult(r) {
    switch (r.status) {
        case 'would-convert':
        case 'converted':
            console.log(
                `  ${(r.status === 'converted' ? '[converted]' : '[convert]').padEnd(12)}${r.key}  ` +
                `${formatBytes(r.before)} ${r.dims} -> ${formatBytes(r.after)} ${r.newDims}${r.alpha ? ' (alpha)' : ''}`
            )
            break
        case 'webp-exists':
            console.log(`  [exists]    ${r.key} -> ${r.newUrl} already present, reusing it`)
            break
        case 'no-gain':
            console.log(`  [skip]      ${r.key}  WebP would not be smaller (${formatBytes(r.before)} -> ${formatBytes(r.after)})`)
            break
        case 'failed':
            console.log(`  [FAILED]    ${r.key}  ${r.error}`)
            break
    }
}

// ---------- Modes ----------

async function migrate(execute) {
    console.log(`\n${execute ? 'EXECUTE' : 'DRY RUN (no changes will be made; pass --execute to apply)'}`)
    console.log(`Bucket: ${BUCKET_NAME} (${REGION})\n`)

    // 1. Scan rows
    const rowsByTable = new Map()
    const allUrls = new Set()
    for (const tableConfig of IMAGE_TABLES) {
        const rows = await fetchAllRows(tableConfig)
        rowsByTable.set(tableConfig.table, rows)
        collectUrls(rows, tableConfig).forEach(url => allUrls.add(url))
        console.log(`Scanned ${tableConfig.table}: ${rows.length} rows`)
    }

    const s3Urls = []
    let foreignUrls = 0
    for (const url of allUrls) {
        const key = s3KeyFromUrl(url, { bucket: BUCKET_NAME, region: REGION })
        if (key) s3Urls.push({ url, key })
        else foreignUrls++
    }
    console.log(`Distinct image URLs: ${allUrls.size} (${s3Urls.length} in bucket, ${foreignUrls} elsewhere, left untouched)\n`)

    // 2. Files
    console.log('Files:')
    const fileResults = await mapWithConcurrency(s3Urls, FILE_CONCURRENCY, async ({ url, key }) => {
        const result = await processFile(url, key, execute)
        logFileResult(result)
        return result
    })

    const urlMap = new Map(fileResults.filter(r => r.newUrl).map(r => [r.url, r.newUrl]))

    // 3. Rows
    const entries = []
    for (const tableConfig of IMAGE_TABLES) {
        for (const row of rowsByTable.get(tableConfig.table)) {
            const entry = planRowUpdate(row, tableConfig, urlMap)
            if (entry) entries.push(entry)
        }
    }

    console.log(`\nRows ${execute ? 'to update' : 'that would be updated'}: ${entries.length}`)
    entries.forEach(entry => console.log(describeRowChange(entry)))

    let rowsUpdated = 0
    const rowFailures = []
    let backupPath = null

    if (execute && entries.length > 0) {
        // 4. Back up before touching the database
        mkdirSync(BACKUP_DIR, { recursive: true })
        backupPath = join(BACKUP_DIR, `image-migration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
        writeFileSync(backupPath, JSON.stringify({
            createdAt: new Date().toISOString(),
            bucket: BUCKET_NAME,
            entries
        }, null, 2))
        console.log(`\nBackup written: ${backupPath}`)

        // 5. Apply, one row per statement
        for (const entry of entries) {
            try {
                const updated = await updateRowIfUnchanged(entry.table, entry.id, entry.new, entry.old)
                if (updated) rowsUpdated++
                else rowFailures.push({ ...entry, error: 'row changed since scan, not updated' })
            } catch (error) {
                rowFailures.push({ ...entry, error: error.message })
            }
        }
    }

    // 6. Summary
    const count = status => fileResults.filter(r => r.status === status).length
    const convertedResults = fileResults.filter(r => r.status === (execute ? 'converted' : 'would-convert'))
    const before = convertedResults.reduce((sum, r) => sum + r.before, 0)
    const after = convertedResults.reduce((sum, r) => sum + r.after, 0)
    const fileFailures = fileResults.filter(r => r.status === 'failed')

    const line = (label, value) => console.log(`${(label + ':').padEnd(22)}${value}`)
    console.log('\n========== Summary ==========')
    line(`Files ${execute ? 'converted' : 'to convert'}`, convertedResults.length)
    line('Size before -> after', `${formatBytes(before)} -> ${formatBytes(after)}${before ? ` (${Math.round((1 - after / before) * 100)}% smaller)` : ''}`)
    line('WebP already existed', count('webp-exists'))
    line('Left alone (small)', count('small'))
    line('Already WebP', count('already-webp'))
    line('No gain from WebP', count('no-gain'))
    line(`Rows ${execute ? 'updated' : 'to update'}`, execute ? rowsUpdated : entries.length)
    if (backupPath) line('Backup', backupPath)
    line('File failures', fileFailures.length)
    fileFailures.forEach(r => console.log(`  ${r.key}: ${r.error}`))
    line('Row failures', rowFailures.length)
    rowFailures.forEach(r => console.log(`  ${r.table} ${r.id}: ${r.error}`))

    return fileFailures.length + rowFailures.length === 0
}

async function rollback(backupFile) {
    const backup = JSON.parse(readFileSync(backupFile, 'utf8'))
    console.log(`\nROLLBACK from ${backupFile} (${backup.entries.length} rows, created ${backup.createdAt})\n`)

    let restored = 0
    const failures = []
    for (const entry of backup.entries) {
        try {
            // Only restore rows that still hold the values this migration wrote
            const updated = await updateRowIfUnchanged(entry.table, entry.id, entry.old, entry.new)
            if (updated) {
                restored++
                console.log(`  restored ${entry.table} ${entry.id}`)
            } else {
                failures.push({ ...entry, error: 'row changed since migration, not restored' })
            }
        } catch (error) {
            failures.push({ ...entry, error: error.message })
        }
    }

    console.log('\n========== Summary ==========')
    console.log(`Rows restored: ${restored}`)
    console.log(`Failures:      ${failures.length}`)
    failures.forEach(f => console.log(`  ${f.table} ${f.id}: ${f.error}`))
    console.log('WebP files are left in S3; they are harmless and make a re-run faster.')
    return failures.length === 0
}

// ---------- CLI ----------

function parseArgs(argv) {
    const options = { execute: false, rollback: null }
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--execute') options.execute = true
        else if (argv[i] === '--rollback') options.rollback = argv[++i]
        else throw new Error(`Unknown argument: ${argv[i]}`)
    }
    if (options.rollback === undefined) throw new Error('--rollback needs a backup file path')
    if (options.execute && options.rollback) throw new Error('Use either --execute or --rollback, not both')
    return options
}

try {
    const options = parseArgs(process.argv.slice(2))
    if (!BUCKET_NAME) throw new Error('AWS_S3_BUCKET_NAME is not set')
    const ok = options.rollback ? await rollback(options.rollback) : await migrate(options.execute)
    process.exit(ok ? 0 : 1)
} catch (error) {
    console.error(`\nFatal: ${error.message}`)
    process.exit(1)
}
