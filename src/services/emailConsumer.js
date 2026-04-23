import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'ap-south-1'
})

const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@aniayu.in'
const ADMIN_EMAILS = ['support@aniayu.com', 'aarunyathreads@gmail.com']

/**
 * AWS Lambda handler — triggered by SQS events.
 * Reads each SQS record, sends a confirmation email via SES.
 */
export const handler = async (event) => {
  const results = []

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body)

      if (message.type !== 'ORDER_CONFIRMATION') {
        console.log(`Skipping unknown message type: ${message.type}`)
        results.push({ status: 'skipped', messageId: record.messageId })
        continue
      }

      const { orderId, orderNumber, customerEmail, customerName, totalAmount, currency, items, address } = message.data

      const emailHtml = buildOrderConfirmationHtml({
        orderId,
        orderNumber,
        customerName,
        totalAmount,
        currency,
        items,
        address
      })

      const emailText = buildOrderConfirmationText({
        orderNumber,
        customerName,
        totalAmount,
        currency
      })

      const command = new SendEmailCommand({
        Source: `Ani & Ayu <${FROM_EMAIL}>`,
        Destination: {
          ToAddresses: [customerEmail]
        },
        Message: {
          Subject: {
            Data: `🎉 Order Confirmed! #${orderNumber}`,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: emailHtml,
              Charset: 'UTF-8'
            },
            Text: {
              Data: emailText,
              Charset: 'UTF-8'
            }
          }
        }
      })

      await sesClient.send(command)
      console.log(`✅ Order confirmation email sent to ${customerEmail} for order ${orderNumber}`)
      
      // Send admin notification email
      try {
        const adminEmailHtml = buildAdminNotificationHtml({
          orderId,
          orderNumber,
          customerEmail,
          customerName,
          totalAmount,
          currency,
          items,
          address
        })

        const adminEmailText = buildAdminNotificationText({
          orderNumber,
          customerEmail,
          customerName,
          totalAmount,
          currency,
          items,
          address
        })

        const adminCommand = new SendEmailCommand({
          Source: `Ani & Ayu Orders <${FROM_EMAIL}>`,
          Destination: {
            ToAddresses: ADMIN_EMAILS
          },
          Message: {
            Subject: {
              Data: `🛍️ You received an order - #${orderNumber}`,
              Charset: 'UTF-8'
            },
            Body: {
              Html: {
                Data: adminEmailHtml,
                Charset: 'UTF-8'
              },
              Text: {
                Data: adminEmailText,
                Charset: 'UTF-8'
              }
            }
          }
        })

        await sesClient.send(adminCommand)
        console.log(`✅ Admin notification sent for order ${orderNumber} to ${ADMIN_EMAILS.join(', ')}`)
      } catch (adminError) {
        console.error(`⚠️ Failed to send admin notification for order ${orderNumber}:`, adminError)
        // Don't throw - customer email was sent successfully
      }
      
      results.push({ status: 'sent', orderId, customerEmail, messageId: record.messageId })

    } catch (error) {
      console.error(`❌ Failed to process SQS record ${record.messageId}:`, error)
      // Re-throw to let SQS retry (message won't be deleted from queue)
      throw error
    }
  }

  return { processed: results.length, results }
}

// ---------------------------------------------------------------------------
// Email template helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency
  }).format(amount)
}

function buildItemsTable(items = []) {
  if (!items || items.length === 0) return ''

  const rows = items.map(item => `
    <tr>
      <td style="padding:12px 8px;border-bottom:1px solid #f0e8df;">
        <strong>${item.name || 'Product'}</strong>
        ${item.size ? `<br><small style="color:#888;">Size: ${item.size}</small>` : ''}
        ${item.color ? `<small style="color:#888;"> · Color: ${item.color}</small>` : ''}
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid #f0e8df;text-align:center;">${item.quantity}</td>
      <td style="padding:12px 8px;border-bottom:1px solid #f0e8df;text-align:right;">${formatCurrency(item.price_at_purchase)}</td>
    </tr>
  `).join('')

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
      <thead>
        <tr style="background:#fdf6f0;">
          <th style="padding:10px 8px;text-align:left;font-size:12px;color:#a07850;text-transform:uppercase;letter-spacing:1px;">Item</th>
          <th style="padding:10px 8px;text-align:center;font-size:12px;color:#a07850;text-transform:uppercase;letter-spacing:1px;">Qty</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;color:#a07850;text-transform:uppercase;letter-spacing:1px;">Price</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

function buildAddressBlock(address) {
  if (!address) return ''
  const parts = [
    address.address_line1,
    address.address_line2,
    address.city,
    address.state,
    address.pincode,
    address.country
  ].filter(Boolean)

  return `<p style="margin:4px 0;color:#555;font-size:14px;">${parts.join(', ')}</p>`
}

function buildOrderConfirmationHtml({ orderNumber, customerName, totalAmount, currency, items, address }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Order Confirmed – Ani & Ayu</title>
</head>
<body style="margin:0;padding:0;background:#fdf6f0;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf6f0;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#c17f4a 0%,#a05c2a 100%);padding:40px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">Ani &amp; Ayu</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;letter-spacing:2px;text-transform:uppercase;">Order Confirmed</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;">

              <!-- Greeting -->
              <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#2c1a0e;">Hi ${customerName || 'there'} 👋</p>
              <p style="margin:0 0 24px;font-size:15px;color:#666;line-height:1.6;">
                Thank you for your order! We're excited to get your items ready. Your order has been confirmed and is now being processed.
              </p>

              <!-- Order Number Badge -->
              <div style="background:#fdf6f0;border:1.5px dashed #c17f4a;border-radius:10px;padding:16px 24px;margin-bottom:28px;text-align:center;">
                <p style="margin:0;font-size:12px;color:#a07850;text-transform:uppercase;letter-spacing:1.5px;">Order ID</p>
                <p style="margin:6px 0 0;font-size:24px;font-weight:700;color:#c17f4a;">#${orderNumber}</p>
              </div>

              <!-- Items -->
              <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#2c1a0e;">Your Items</p>
              ${buildItemsTable(items)}

              <!-- Total -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                <tr>
                  <td style="padding:12px 8px;font-size:16px;font-weight:700;color:#2c1a0e;">Total Paid</td>
                  <td style="padding:12px 8px;font-size:18px;font-weight:700;color:#c17f4a;text-align:right;">${formatCurrency(totalAmount, currency)}</td>
                </tr>
              </table>

              <!-- Shipping Address -->
              ${address ? `
              <div style="margin-top:28px;padding:20px;background:#fdf6f0;border-radius:10px;">
                <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#2c1a0e;text-transform:uppercase;letter-spacing:1px;">Shipping To</p>
                ${address.name ? `<p style="margin:0 0 4px;font-weight:600;color:#333;font-size:15px;">${address.name}</p>` : ''}
                ${buildAddressBlock(address)}
                ${address.phone ? `<p style="margin:8px 0 0;color:#555;font-size:14px;">📞 ${address.phone}</p>` : ''}
              </div>` : ''}

              <!-- CTA -->
              <div style="text-align:center;margin-top:36px;">
                <a href="${process.env.FRONTEND_URL || 'https://aniayu.in'}/orders"
                   style="display:inline-block;background:linear-gradient(135deg,#c17f4a,#a05c2a);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.5px;">
                  Track Your Order →
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f5ede4;padding:24px 32px;text-align:center;border-top:1px solid #e8d8c8;">
              <p style="margin:0;font-size:13px;color:#999;">
                Questions? Reply to this email or visit our
                <a href="${process.env.FRONTEND_URL || 'https://aniayu.in'}" style="color:#c17f4a;text-decoration:none;">website</a>.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#bbb;">© ${new Date().getFullYear()} Ani &amp; Ayu. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

function buildOrderConfirmationText({ orderNumber, customerName, totalAmount, currency }) {
  return [
    `Hi ${customerName || 'there'},`,
    '',
    `Your order #${orderNumber} has been confirmed!`,
    '',
    `Total Paid: ${formatCurrency(totalAmount, currency)}`,
    '',
    'We\'ll notify you once your order ships.',
    '',
    '— Ani & Ayu Team'
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Admin notification email templates
// ---------------------------------------------------------------------------

function buildAdminNotificationHtml({ orderNumber, customerEmail, customerName, totalAmount, currency, items, address }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>New Order - ${orderNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background:#28a745;padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">🛍️ New Order Received!</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Order #${orderNumber}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">

              <!-- Order Info -->
              <div style="background:#f8f9fa;border-left:4px solid #28a745;padding:16px 20px;margin-bottom:24px;border-radius:4px;">
                <p style="margin:0 0 4px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:1px;">Order ID</p>
                <p style="margin:0;font-size:20px;font-weight:700;color:#28a745;">#${orderNumber}</p>
              </div>

              <!-- Customer Details -->
              <div style="margin-bottom:24px;">
                <p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#333;">Customer Details</p>
                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef;border-radius:6px;overflow:hidden;">
                  <tr>
                    <td style="padding:12px 16px;background:#f8f9fa;font-weight:600;color:#495057;width:140px;border-bottom:1px solid #e9ecef;">Name</td>
                    <td style="padding:12px 16px;color:#212529;border-bottom:1px solid #e9ecef;">${customerName || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 16px;background:#f8f9fa;font-weight:600;color:#495057;border-bottom:1px solid #e9ecef;">Email</td>
                    <td style="padding:12px 16px;color:#212529;border-bottom:1px solid #e9ecef;"><a href="mailto:${customerEmail}" style="color:#007bff;text-decoration:none;">${customerEmail}</a></td>
                  </tr>
                  ${address?.phone ? `
                  <tr>
                    <td style="padding:12px 16px;background:#f8f9fa;font-weight:600;color:#495057;">Phone</td>
                    <td style="padding:12px 16px;color:#212529;"><a href="tel:${address.phone}" style="color:#007bff;text-decoration:none;">${address.phone}</a></td>
                  </tr>
                  ` : ''}
                </table>
              </div>

              <!-- Shipping Address -->
              ${address ? `
              <div style="margin-bottom:24px;">
                <p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#333;">Shipping Address</p>
                <div style="background:#f8f9fa;padding:16px;border-radius:6px;border:1px solid #e9ecef;">
                  ${address.name ? `<p style="margin:0 0 8px;font-weight:600;color:#212529;">${address.name}</p>` : ''}
                  ${buildAddressBlock(address)}
                  ${address.phone ? `<p style="margin:8px 0 0;color:#6c757d;">📞 ${address.phone}</p>` : ''}
                </div>
              </div>
              ` : ''}

              <!-- Order Items -->
              <p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#333;">Order Items</p>
              ${buildItemsTable(items)}

              <!-- Total -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#28a745;border-radius:6px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;font-size:16px;font-weight:700;color:#ffffff;">Total Amount</td>
                  <td style="padding:16px 20px;font-size:20px;font-weight:700;color:#ffffff;text-align:right;">${formatCurrency(totalAmount, currency)}</td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8f9fa;padding:20px 32px;text-align:center;border-top:1px solid #e9ecef;">
              <p style="margin:0;font-size:13px;color:#6c757d;">
                This is an automated notification from your Ani & Ayu store.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

function buildAdminNotificationText({ orderNumber, customerEmail, customerName, totalAmount, currency, items, address }) {
  const itemsList = items.map(item => 
    `  - ${item.name} (Qty: ${item.quantity}) - ${formatCurrency(item.price_at_purchase)}`
  ).join('\n')

  const addressText = address ? [
    '',
    'SHIPPING ADDRESS:',
    address.name || '',
    address.address_line1 || '',
    address.address_line2 || '',
    `${address.city || ''}, ${address.state || ''} ${address.pincode || ''}`,
    address.country || '',
    address.phone ? `Phone: ${address.phone}` : ''
  ].filter(Boolean).join('\n') : ''

  return [
    '🛍️ NEW ORDER RECEIVED',
    '',
    `Order #${orderNumber}`,
    '',
    'CUSTOMER DETAILS:',
    `Name: ${customerName || 'N/A'}`,
    `Email: ${customerEmail}`,
    addressText,
    '',
    'ORDER ITEMS:',
    itemsList,
    '',
    `TOTAL: ${formatCurrency(totalAmount, currency)}`,
    '',
    '—',
    'Ani & Ayu Admin Notification'
  ].join('\n')
}
