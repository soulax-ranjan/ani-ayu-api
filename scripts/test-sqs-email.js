#!/usr/bin/env node
/**
 * Test script: Sends a mock order confirmation message to SQS.
 * The emailConsumer Lambda will pick it up and send via SES.
 *
 * Usage:
 *   node scripts/test-sqs-email.js
 *   node scripts/test-sqs-email.js --email you@example.com
 */

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import dotenv from 'dotenv'

dotenv.config()

const args = process.argv.slice(2)
const emailFlagIndex = args.indexOf('--email')
const recipientEmail = emailFlagIndex !== -1 ? args[emailFlagIndex + 1] : null

const sqsClient = new SQSClient({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
})

const QUEUE_URL = process.env.SQS_ORDER_CONFIRMATION_QUEUE_URL

if (!QUEUE_URL) {
    console.error('❌ SQS_ORDER_CONFIRMATION_QUEUE_URL is not set in .env')
    process.exit(1)
}

const testPayload = {
    type: 'ORDER_CONFIRMATION',
    timestamp: new Date().toISOString(),
    data: {
        orderId: 'test-order-id-' + Date.now(),
        orderNumber: 'ANI-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
        customerEmail: recipientEmail || 'test@example.com',
        customerName: 'Test Customer',
        totalAmount: 1499.00,
        currency: 'INR',
        items: [
            {
                name: 'Silk Anarkali Kurta',
                quantity: 1,
                price_at_purchase: 999.00,
                size: 'M',
                color: 'Rose Gold'
            },
            {
                name: 'Embroidered Dupatta',
                quantity: 1,
                price_at_purchase: 500.00,
                size: null,
                color: 'Ivory'
            }
        ],
        address: {
            name: 'Test Customer',
            address_line1: '123, MG Road',
            address_line2: 'Indiranagar',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560038',
            country: 'India',
            phone: '+91 98765 43210'
        }
    }
}

console.log('🚀 Sending test order confirmation to SQS...')
console.log(`   Queue  : ${QUEUE_URL}`)
console.log(`   Email  : ${testPayload.data.customerEmail}`)
console.log(`   Order  : ${testPayload.data.orderNumber}`)
console.log(`   Amount : ₹${testPayload.data.totalAmount}`)
console.log('')

const command = new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify(testPayload),
    MessageAttributes: {
        eventType: {
            DataType: 'String',
            StringValue: 'ORDER_CONFIRMATION'
        }
    }
})

try {
    const result = await sqsClient.send(command)
    console.log('✅ Message sent to SQS successfully!')
    console.log(`   MessageId : ${result.MessageId}`)
    console.log('')
    console.log('⏳ The emailConsumer Lambda will trigger in ~5–10 seconds.')
    console.log(`   Check the inbox of: ${testPayload.data.customerEmail}`)
    console.log('')
    console.log('🔍 To monitor Lambda logs run:')
    console.log('   npx serverless logs -f emailConsumer --tail')
} catch (err) {
    console.error('❌ Failed to send message:', err.message)
    process.exit(1)
}
