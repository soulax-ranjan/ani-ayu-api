# Razorpay Payment Integration Guide

## Overview
This guide explains how to integrate Razorpay payments in the Ani & Ayu e-commerce platform.

## Table of Contents
1. [Setup](#setup)
2. [Database Configuration](#database-configuration)
3. [Environment Variables](#environment-variables)
4. [Payment Flow](#payment-flow)
5. [API Endpoints](#api-endpoints)
6. [Frontend Integration](#frontend-integration)
7. [Webhook Configuration](#webhook-configuration)
8. [Testing](#testing)

---

## Setup

### 1. Install Dependencies
```bash
npm install razorpay
```

### 2. Create Razorpay Account
1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Sign up or log in
3. Complete KYC verification
4. Navigate to Settings → API Keys
5. Generate API keys (Key ID and Key Secret)

---

## Database Configuration

### Run the Migration
Execute the SQL migration to create payment tables:

```bash
# In Supabase SQL Editor, run:
/Users/branjan/Documents/GitHub/AniAyu/ani-ayu-api/database/razorpay_payments.sql
```

This creates:
- **`payments`** table - Stores all payment transactions
- **`webhook_events`** table - Logs all Razorpay webhook events
- Indexes for performance
- Row Level Security policies

---

## Environment Variables

Update your `.env` file with Razorpay credentials:

```bash
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxx
```

### How to Get These Values:

1. **RAZORPAY_KEY_ID** & **RAZORPAY_KEY_SECRET**:
   - Go to: https://dashboard.razorpay.com/app/keys
   - Copy Key ID and Key Secret

2. **RAZORPAY_WEBHOOK_SECRET**:
   - Go to: https://dashboard.razorpay.com/app/webhooks
   - Create a new webhook
   - Copy the webhook secret

---

## Payment Flow

### Complete Payment Flow Diagram

```
┌─────────────┐
│   User      │
│ Clicks Pay  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Frontend: POST /api/checkout            │
│ - addressId, paymentMethod, cartItems   │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Backend: Create Order in Database       │
│ - Validate cart items                   │
│ - Calculate total                       │
│ - Create order record                   │
│ - Clear cart items                      │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Backend Returns:                        │
│ {                                       │
│   requiresPayment: true,                │
│   orderId: "uuid",                      │
│   amount: 2999,                         │
│   currency: "INR"                       │
│ }                                       │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Frontend: POST /api/payments/create-order│
│ - orderId, amount                       │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Backend → Razorpay: Create Order        │
│ - razorpay.orders.create()              │
│ - Store payment record in DB            │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Backend Returns:                        │
│ {                                       │
│   razorpayOrderId: "order_xxx",         │
│   amount: 299900,  // in paise          │
│   currency: "INR",                      │
│   key: "rzp_test_xxx"                   │
│ }                                       │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Frontend: Open Razorpay Checkout        │
│ - Display payment modal                 │
│ - User completes payment                │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Razorpay: Payment Success               │
│ Returns: {                              │
│   razorpay_order_id,                    │
│   razorpay_payment_id,                  │
│   razorpay_signature                    │
│ }                                       │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Frontend: POST /api/payments/verify     │
│ - Send payment details for verification │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Backend: Verify Payment                 │
│ 1. Verify signature using HMAC SHA256   │
│ 2. Update payment status to "captured"  │
│ 3. Update order status to "confirmed"   │
│ 4. Update payment_status to "paid"      │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Razorpay → Webhook (Async)              │
│ - payment.captured event                │
│ - Redundant verification                │
│ - Log in webhook_events table           │
└─────────────────────────────────────────┘
```

---

## API Endpoints

### 1. Create Razorpay Order
**POST** `/api/payments/create-order`

Creates a Razorpay order for payment processing.

**Request:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 2999,
  "currency": "INR"
}
```

**Response:**
```json
{
  "success": true,
  "razorpayOrderId": "order_MXXXXXXXXXXXx",
  "amount": 299900,
  "currency": "INR",
  "key": "rzp_test_xxxxxxxxxxxxx"
}
```

---

### 2. Verify Payment
**POST** `/api/payments/verify`

Verifies the payment signature and updates order status.

**Request:**
```json
{
  "razorpay_order_id": "order_MXXXXXXXXXXXx",
  "razorpay_payment_id": "pay_MXXXXXXXXXXXx",
  "razorpay_signature": "xxxxxxxxxxxxxxxxxxxxx"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "orderId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### 3. Webhook Handler
**POST** `/api/payments/webhook`

Handles Razorpay webhook events (internal use only).

**Events Handled:**
- `payment.authorized`
- `payment.captured`
- `payment.failed`
- `order.paid`

---

### 4. Get Payment Details
**GET** `/api/payments/order/:orderId`

Retrieves payment details for a specific order.

**Response:**
```json
{
  "success": true,
  "payments": [
    {
      "id": "uuid",
      "order_id": "uuid",
      "razorpay_order_id": "order_xxx",
      "razorpay_payment_id": "pay_xxx",
      "amount": 2999,
      "currency": "INR",
      "status": "captured",
      "method": "card",
      "created_at": "2024-01-27T10:00:00Z"
    }
  ]
}
```

---

## Frontend Integration

### Step 1: Checkout
```javascript
// When user clicks "Pay Now"
const checkoutResponse = await fetch('/api/checkout', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`, // if logged in
    'x-guest-id': guestId // if guest
  },
  body: JSON.stringify({
    addressId: selectedAddressId,
    paymentMethod: 'card', // or 'upi', 'cod'
    cartItemIds: [] // optional
  })
})

const { requiresPayment, orderId, amount, currency } = await checkoutResponse.json()
```

### Step 2: Create Razorpay Order
```javascript
if (requiresPayment) {
  // Create Razorpay order
  const paymentOrderResponse = await fetch('/api/payments/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: orderId,
      amount: amount,
      currency: currency
    })
  })

  const { razorpayOrderId, amount: razorpayAmount, key } = await paymentOrderResponse.json()
}
```

### Step 3: Open Razorpay Checkout
```javascript
// Load Razorpay script
const script = document.createElement('script')
script.src = 'https://checkout.razorpay.com/v1/checkout.js'
document.body.appendChild(script)

script.onload = () => {
  const options = {
    key: key, // Razorpay Key ID
    amount: razorpayAmount, // Amount in paise
    currency: currency,
    name: 'Ani & Ayu',
    description: 'Order Payment',
    order_id: razorpayOrderId,
    handler: async function (response) {
      // Payment successful - verify on backend
      await verifyPayment(response)
    },
    prefill: {
      name: customerName,
      email: customerEmail,
      contact: customerPhone
    },
    theme: {
      color: '#FF6B6B'
    }
  }

  const razorpay = new Razorpay(options)
  razorpay.open()
}
```

### Step 4: Verify Payment
```javascript
async function verifyPayment(response) {
  const verifyResponse = await fetch('/api/payments/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_order_id: response.razorpay_order_id,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature
    })
  })

  const result = await verifyResponse.json()
  
  if (result.success) {
    // Payment verified - redirect to success page
    window.location.href = `/order-success/${result.orderId}`
  } else {
    // Payment verification failed
    alert('Payment verification failed')
  }
}
```

---

## Webhook Configuration

### 1. Configure Webhook in Razorpay Dashboard

1. Go to: https://dashboard.razorpay.com/app/webhooks
2. Click "Create New Webhook"
3. Enter your webhook URL:
   ```
   https://your-api-domain.com/api/payments/webhook
   ```
4. Select events to listen:
   - ✅ payment.authorized
   - ✅ payment.captured
   - ✅ payment.failed
   - ✅ order.paid
5. Copy the webhook secret and add to `.env`

### 2. Webhook Security

The webhook handler automatically:
- Verifies webhook signature
- Logs all events in `webhook_events` table
- Processes events idempotently
- Updates payment and order status

---

## Testing

### Test Mode
Razorpay provides test mode for development:

1. Use test API keys (prefix: `rzp_test_`)
2. Use test card numbers:
   - **Success**: `4111 1111 1111 1111`
   - **Failure**: `4000 0000 0000 0002`
   - CVV: Any 3 digits
   - Expiry: Any future date

### Test Payment Flow
```bash
# 1. Create order
curl -X POST http://localhost:3002/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "addressId": "uuid",
    "paymentMethod": "card"
  }'

# 2. Create Razorpay order
curl -X POST http://localhost:3002/api/payments/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "uuid",
    "amount": 2999
  }'

# 3. Complete payment in Razorpay checkout (frontend)

# 4. Verify payment
curl -X POST http://localhost:3002/api/payments/verify \
  -H "Content-Type: application/json" \
  -d '{
    "razorpay_order_id": "order_xxx",
    "razorpay_payment_id": "pay_xxx",
    "razorpay_signature": "xxx"
  }'
```

---

## Error Handling

### Common Errors

1. **Invalid Signature**
   - Cause: Tampered payment response
   - Action: Payment marked as failed

2. **Payment Not Found**
   - Cause: Invalid order ID
   - Action: Return 404 error

3. **Amount Mismatch**
   - Cause: Order amount doesn't match payment amount
   - Action: Reject payment creation

4. **Webhook Verification Failed**
   - Cause: Invalid webhook signature
   - Action: Log event but don't process

---

## Database Schema

### Payments Table
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  razorpay_order_id VARCHAR(100) UNIQUE,
  razorpay_payment_id VARCHAR(100) UNIQUE,
  razorpay_signature VARCHAR(255),
  amount DECIMAL(10,2),
  currency VARCHAR(3),
  status VARCHAR(20), -- pending, authorized, captured, failed, refunded
  method VARCHAR(50), -- card, upi, netbanking, wallet
  created_at TIMESTAMP,
  captured_at TIMESTAMP
)
```

### Webhook Events Table
```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY,
  event_id VARCHAR(100) UNIQUE,
  event_type VARCHAR(100),
  entity_type VARCHAR(50),
  entity_id VARCHAR(100),
  payload JSONB,
  signature VARCHAR(255),
  verified BOOLEAN,
  processed BOOLEAN,
  created_at TIMESTAMP
)
```

---

## Production Checklist

- [ ] Replace test API keys with live keys
- [ ] Configure webhook URL in Razorpay dashboard
- [ ] Enable HTTPS for webhook endpoint
- [ ] Set up monitoring for failed payments
- [ ] Configure email notifications for payment events
- [ ] Test refund flow
- [ ] Set up payment reconciliation
- [ ] Enable payment analytics in Razorpay dashboard

---

## Support

For issues or questions:
- Razorpay Docs: https://razorpay.com/docs/
- Razorpay Support: https://razorpay.com/support/
- API Reference: https://razorpay.com/docs/api/

---

## Security Best Practices

1. **Never expose secrets**: Keep `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` server-side only
2. **Always verify signatures**: Both payment and webhook signatures must be verified
3. **Use HTTPS**: All payment endpoints must use HTTPS in production
4. **Validate amounts**: Always verify payment amount matches order amount
5. **Log everything**: Keep detailed logs of all payment events
6. **Handle failures gracefully**: Implement retry logic for failed webhooks
7. **Monitor suspicious activity**: Set up alerts for unusual payment patterns
