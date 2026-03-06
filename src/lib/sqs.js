import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import dotenv from 'dotenv'

dotenv.config()

const sqsClient = new SQSClient({
    region: process.env.AWS_REGION || 'ap-south-1',
    // On Lambda the SDK uses the IAM execution role automatically.
    // Pass explicit credentials only for local development.
    ...(process.env.NODE_ENV !== 'production' && process.env.AWS_ACCESS_KEY_ID
        ? {
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        }
        : {})
})

const QUEUE_URL = process.env.SQS_ORDER_CONFIRMATION_QUEUE_URL

/**
 * Enqueue an order confirmation email message to SQS.
 * The email consumer Lambda will pick this up and send via SES.
 *
 * @param {Object} payload
 * @param {string} payload.orderId
 * @param {string} payload.orderNumber
 * @param {string} payload.customerEmail
 * @param {string} payload.customerName
 * @param {number} payload.totalAmount
 * @param {string} payload.currency
 * @param {Array}  payload.items          - cart items array
 * @param {Object} payload.address        - shipping address
 */
export async function sendOrderConfirmationToQueue(payload) {
    if (!QUEUE_URL) {
        console.warn('⚠️  SQS_ORDER_CONFIRMATION_QUEUE_URL not set – skipping email queue')
        return
    }

    const message = {
        type: 'ORDER_CONFIRMATION',
        timestamp: new Date().toISOString(),
        data: payload
    }

    const command = new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(message),
        MessageAttributes: {
            eventType: {
                DataType: 'String',
                StringValue: 'ORDER_CONFIRMATION'
            }
        }
    })

    const result = await sqsClient.send(command)
    console.log(`✅ Order confirmation queued. MessageId: ${result.MessageId}`)
    return result
}

export { sqsClient }
