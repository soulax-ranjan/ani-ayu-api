import { compressAllProductImages } from '../src/services/imageCompression.js'

// Run the compression service
console.log('Starting image compression...\n')

compressAllProductImages()
    .then(result => {
        console.log('\n✅ Compression completed successfully!')
        console.log('Result:', result)
        process.exit(0)
    })
    .catch(err => {
        console.error('\n❌ Compression failed:', err)
        process.exit(1)
    })
