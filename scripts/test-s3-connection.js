import { S3Client, ListBucketsCommand, HeadBucketCommand } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

console.log('🔍 Testing AWS S3 Connection...\n')

// Check if required environment variables are set
const requiredEnvVars = [
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_S3_BUCKET_NAME'
]

console.log('📋 Checking environment variables:')
let missingVars = []
for (const varName of requiredEnvVars) {
    const value = process.env[varName]
    if (!value || value === 'your_aws_access_key_id' || value === 'your_aws_secret_access_key' || value === 'your-s3-bucket-name') {
        console.log(`  ❌ ${varName}: Not set or using placeholder value`)
        missingVars.push(varName)
    } else {
        // Mask sensitive values
        if (varName.includes('SECRET') || varName.includes('KEY_ID')) {
            console.log(`  ✅ ${varName}: ${value.substring(0, 4)}...${value.substring(value.length - 4)}`)
        } else {
            console.log(`  ✅ ${varName}: ${value}`)
        }
    }
}

if (missingVars.length > 0) {
    console.log('\n❌ Missing or invalid environment variables:', missingVars.join(', '))
    console.log('\nPlease update your .env file with valid AWS credentials.')
    console.log('See AWS_S3_SETUP.md for setup instructions.')
    process.exit(1)
}

console.log('\n🔌 Attempting to connect to AWS S3...')

// Initialize S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
})

async function testConnection() {
    try {
        // Test 1: List buckets (verify credentials work)
        console.log('\n📦 Test 1: Listing accessible buckets...')
        const listCommand = new ListBucketsCommand({})
        const listResponse = await s3Client.send(listCommand)

        if (listResponse.Buckets && listResponse.Buckets.length > 0) {
            console.log(`  ✅ Successfully connected! Found ${listResponse.Buckets.length} bucket(s):`)
            listResponse.Buckets.forEach(bucket => {
                console.log(`     - ${bucket.Name}`)
            })
        } else {
            console.log('  ⚠️  Connected but no buckets found')
        }

        // Test 2: Check if the specified bucket exists and is accessible
        console.log(`\n🪣 Test 2: Checking bucket "${process.env.AWS_S3_BUCKET_NAME}"...`)
        const headCommand = new HeadBucketCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME
        })

        await s3Client.send(headCommand)
        console.log(`  ✅ Bucket "${process.env.AWS_S3_BUCKET_NAME}" exists and is accessible!`)

        // Success summary
        console.log('\n' + '='.repeat(50))
        console.log('✅ AWS S3 Connection Test: PASSED')
        console.log('='.repeat(50))
        console.log('\nYour AWS S3 configuration is working correctly!')
        console.log('You can now:')
        console.log('  • Upload images using the API')
        console.log('  • Run the migration script: npm run migrate-to-s3')
        console.log('  • Start the server: npm run dev')
        console.log('')

        process.exit(0)

    } catch (error) {
        console.log('\n' + '='.repeat(50))
        console.log('❌ AWS S3 Connection Test: FAILED')
        console.log('='.repeat(50))

        if (error.name === 'InvalidAccessKeyId') {
            console.log('\n❌ Error: Invalid AWS Access Key ID')
            console.log('   Please check your AWS_ACCESS_KEY_ID in .env file')
        } else if (error.name === 'SignatureDoesNotMatch') {
            console.log('\n❌ Error: Invalid AWS Secret Access Key')
            console.log('   Please check your AWS_SECRET_ACCESS_KEY in .env file')
        } else if (error.name === 'NotFound' || error.name === 'NoSuchBucket') {
            console.log(`\n❌ Error: Bucket "${process.env.AWS_S3_BUCKET_NAME}" does not exist`)
            console.log('   Please check your AWS_S3_BUCKET_NAME in .env file')
            console.log('   Or create the bucket in AWS Console')
        } else if (error.name === 'Forbidden' || error.name === 'AccessDenied') {
            console.log('\n❌ Error: Access Denied')
            console.log('   Your IAM user does not have permission to access this bucket')
            console.log('   Please check IAM permissions in AWS Console')
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            console.log('\n❌ Error: Network connection failed')
            console.log('   Please check your internet connection')
            console.log('   Or verify the AWS_REGION is correct')
        } else {
            console.log('\n❌ Error:', error.message)
            console.log('\nFull error details:')
            console.log(error)
        }

        console.log('\n📖 For help, see:')
        console.log('   • AWS_S3_SETUP.md - Setup instructions')
        console.log('   • https://docs.aws.amazon.com/s3/')
        console.log('')

        process.exit(1)
    }
}

testConnection()
