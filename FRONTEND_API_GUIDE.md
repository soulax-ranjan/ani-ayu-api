# Frontend API Integration Guide - Razorpay Payment Flow

This document provides all the API endpoints and code examples needed for frontend integration of the Razorpay payment system.

## Table of Contents
1. [Complete Payment Flow](#complete-payment-flow)
2. [API Endpoints](#api-endpoints)
3. [Frontend Code Examples](#frontend-code-examples)
4. [TypeScript Types](#typescript-types)
5. [Error Handling](#error-handling)

---

## Complete Payment Flow

### Flow Diagram
```
User Checkout → Create Order → Create Razorpay Order → Open Razorpay Checkout → Verify Payment → Success
```

### Step-by-Step Integration

---

## API Endpoints

### 1. **POST** `/api/checkout`
Creates an order in the database and prepares for payment.

**Headers:**
```javascript
{
  'Content-Type': 'application/json',
  'Authorization': 'Bearer <jwt_token>', // Optional for logged-in users
  'x-guest-id': '<guest_id>' // Required for guest users
}
```

**Request Body:**
```json
{
  "addressId": "550e8400-e29b-41d4-a716-446655440000",
  "paymentMethod": "card", // "card" | "upi" | "cod"
  "cartItemIds": [] // Optional: specific cart items to checkout
}
```

**Response (Online Payment):**
```json
{
  "success": true,
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Order placed successfully",
  "requiresPayment": true,
  "amount": 2999,
  "currency": "INR",
  "paymentMethod": "card"
}
```

**Response (COD):**
```json
{
  "success": true,
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Order placed successfully"
}
```

---

### 2. **POST** `/api/payments/create-order`
Creates a Razorpay order for payment processing.

**Headers:**
```javascript
{
  'Content-Type': 'application/json'
}
```

**Request Body:**
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
  "amount": 299900, // Amount in paise (2999 * 100)
  "currency": "INR",
  "key": "rzp_test_xxxxxxxxxxxxx" // Razorpay Key ID
}
```

---

### 3. **POST** `/api/payments/verify`
Verifies the payment signature after successful payment.

**Headers:**
```javascript
{
  'Content-Type': 'application/json'
}
```

**Request Body:**
```json
{
  "razorpay_order_id": "order_MXXXXXXXXXXXx",
  "razorpay_payment_id": "pay_MXXXXXXXXXXXx",
  "razorpay_signature": "xxxxxxxxxxxxxxxxxxxxx"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "orderId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (Failure):**
```json
{
  "error": "Invalid Signature",
  "message": "Payment verification failed"
}
```

---

### 4. **GET** `/api/payments/order/:orderId`
Gets payment details for a specific order.

**Headers:**
```javascript
{
  'Authorization': 'Bearer <jwt_token>' // Optional
}
```

**Response:**
```json
{
  "success": true,
  "payments": [
    {
      "id": "payment-uuid",
      "order_id": "order-uuid",
      "razorpay_order_id": "order_MXXXXXXXXXXXx",
      "razorpay_payment_id": "pay_MXXXXXXXXXXXx",
      "amount": 2999,
      "currency": "INR",
      "status": "captured", // "pending" | "authorized" | "captured" | "failed" | "refunded"
      "method": "card", // "card" | "upi" | "netbanking" | "wallet"
      "created_at": "2024-01-27T10:00:00Z",
      "captured_at": "2024-01-27T10:01:00Z"
    }
  ]
}
```

---

## Frontend Code Examples

### React/Next.js Implementation

#### 1. Install Razorpay Script
```typescript
// utils/razorpay.ts
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}
```

#### 2. Complete Payment Flow
```typescript
// hooks/usePayment.ts
import { useState } from 'react'
import { loadRazorpayScript } from '@/utils/razorpay'

interface CheckoutData {
  addressId: string
  paymentMethod: 'card' | 'upi' | 'cod'
  cartItemIds?: string[]
}

interface RazorpayResponse {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

export const usePayment = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processPayment = async (checkoutData: CheckoutData) => {
    try {
      setLoading(true)
      setError(null)

      // Step 1: Create order in database
      const checkoutResponse = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'x-guest-id': localStorage.getItem('guestId') || ''
        },
        body: JSON.stringify(checkoutData)
      })

      if (!checkoutResponse.ok) {
        throw new Error('Failed to create order')
      }

      const checkoutResult = await checkoutResponse.json()

      // If COD, redirect to success page
      if (!checkoutResult.requiresPayment) {
        window.location.href = `/order-success/${checkoutResult.orderId}`
        return
      }

      // Step 2: Create Razorpay order
      const paymentOrderResponse = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: checkoutResult.orderId,
          amount: checkoutResult.amount,
          currency: checkoutResult.currency
        })
      })

      if (!paymentOrderResponse.ok) {
        throw new Error('Failed to create payment order')
      }

      const paymentOrder = await paymentOrderResponse.json()

      // Step 3: Load Razorpay script
      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded) {
        throw new Error('Failed to load Razorpay SDK')
      }

      // Step 4: Open Razorpay checkout
      await openRazorpayCheckout(paymentOrder, checkoutResult.orderId)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
      console.error('Payment error:', err)
    } finally {
      setLoading(false)
    }
  }

  const openRazorpayCheckout = (
    paymentOrder: any,
    orderId: string
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const options = {
        key: paymentOrder.key,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: 'Ani & Ayu',
        description: 'Order Payment',
        order_id: paymentOrder.razorpayOrderId,
        handler: async (response: RazorpayResponse) => {
          try {
            await verifyPayment(response, orderId)
            resolve()
          } catch (err) {
            reject(err)
          }
        },
        prefill: {
          name: localStorage.getItem('userName') || '',
          email: localStorage.getItem('userEmail') || '',
          contact: localStorage.getItem('userPhone') || ''
        },
        theme: {
          color: '#FF6B6B'
        },
        modal: {
          ondismiss: () => {
            reject(new Error('Payment cancelled by user'))
          }
        }
      }

      const razorpay = new (window as any).Razorpay(options)
      razorpay.open()
    })
  }

  const verifyPayment = async (
    response: RazorpayResponse,
    orderId: string
  ) => {
    const verifyResponse = await fetch('/api/payments/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature
      })
    })

    if (!verifyResponse.ok) {
      throw new Error('Payment verification failed')
    }

    const result = await verifyResponse.json()

    if (result.success) {
      // Redirect to success page
      window.location.href = `/order-success/${orderId}`
    } else {
      throw new Error('Payment verification failed')
    }
  }

  return { processPayment, loading, error }
}
```

#### 3. Usage in Component
```typescript
// components/CheckoutPage.tsx
'use client'

import { useState } from 'react'
import { usePayment } from '@/hooks/usePayment'

export default function CheckoutPage() {
  const [selectedAddress, setSelectedAddress] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi' | 'cod'>('card')
  const { processPayment, loading, error } = usePayment()

  const handleCheckout = async () => {
    if (!selectedAddress) {
      alert('Please select a delivery address')
      return
    }

    await processPayment({
      addressId: selectedAddress,
      paymentMethod: paymentMethod
    })
  }

  return (
    <div className="checkout-page">
      <h1>Checkout</h1>
      
      {/* Address Selection */}
      <div className="address-section">
        {/* Your address selection UI */}
      </div>

      {/* Payment Method Selection */}
      <div className="payment-method">
        <label>
          <input
            type="radio"
            value="card"
            checked={paymentMethod === 'card'}
            onChange={(e) => setPaymentMethod(e.target.value as any)}
          />
          Card / UPI / Netbanking
        </label>
        <label>
          <input
            type="radio"
            value="cod"
            checked={paymentMethod === 'cod'}
            onChange={(e) => setPaymentMethod(e.target.value as any)}
          />
          Cash on Delivery
        </label>
      </div>

      {/* Error Display */}
      {error && <div className="error">{error}</div>}

      {/* Checkout Button */}
      <button
        onClick={handleCheckout}
        disabled={loading || !selectedAddress}
      >
        {loading ? 'Processing...' : 'Place Order'}
      </button>
    </div>
  )
}
```

---

### Vanilla JavaScript Implementation

```javascript
// payment.js
class PaymentHandler {
  constructor() {
    this.apiBaseUrl = 'http://localhost:3002/api'
    this.token = localStorage.getItem('token')
    this.guestId = localStorage.getItem('guestId')
  }

  async checkout(addressId, paymentMethod) {
    try {
      // Step 1: Create order
      const response = await fetch(`${this.apiBaseUrl}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.token ? `Bearer ${this.token}` : '',
          'x-guest-id': this.guestId || ''
        },
        body: JSON.stringify({
          addressId,
          paymentMethod
        })
      })

      const result = await response.json()

      if (!result.requiresPayment) {
        // COD order - redirect to success
        window.location.href = `/order-success.html?orderId=${result.orderId}`
        return
      }

      // Step 2: Create Razorpay order
      const paymentOrder = await this.createRazorpayOrder(
        result.orderId,
        result.amount,
        result.currency
      )

      // Step 3: Open Razorpay checkout
      await this.openRazorpay(paymentOrder, result.orderId)

    } catch (error) {
      console.error('Checkout error:', error)
      alert('Payment failed: ' + error.message)
    }
  }

  async createRazorpayOrder(orderId, amount, currency) {
    const response = await fetch(`${this.apiBaseUrl}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ orderId, amount, currency })
    })

    return await response.json()
  }

  async openRazorpay(paymentOrder, orderId) {
    // Load Razorpay script
    await this.loadScript('https://checkout.razorpay.com/v1/checkout.js')

    const options = {
      key: paymentOrder.key,
      amount: paymentOrder.amount,
      currency: paymentOrder.currency,
      name: 'Ani & Ayu',
      description: 'Order Payment',
      order_id: paymentOrder.razorpayOrderId,
      handler: async (response) => {
        await this.verifyPayment(response, orderId)
      },
      prefill: {
        name: localStorage.getItem('userName') || '',
        email: localStorage.getItem('userEmail') || '',
        contact: localStorage.getItem('userPhone') || ''
      },
      theme: {
        color: '#FF6B6B'
      }
    }

    const razorpay = new Razorpay(options)
    razorpay.open()
  }

  async verifyPayment(response, orderId) {
    const verifyResponse = await fetch(`${this.apiBaseUrl}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature
      })
    })

    const result = await verifyResponse.json()

    if (result.success) {
      window.location.href = `/order-success.html?orderId=${orderId}`
    } else {
      alert('Payment verification failed')
    }
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.onload = () => resolve(true)
      script.onerror = () => reject(new Error('Script load failed'))
      document.body.appendChild(script)
    })
  }
}

// Usage
const paymentHandler = new PaymentHandler()

document.getElementById('checkout-btn').addEventListener('click', () => {
  const addressId = document.getElementById('address-select').value
  const paymentMethod = document.querySelector('input[name="payment"]:checked').value
  
  paymentHandler.checkout(addressId, paymentMethod)
})
```

---

## TypeScript Types

```typescript
// types/payment.ts

export interface CheckoutRequest {
  addressId: string
  paymentMethod: 'card' | 'upi' | 'cod'
  cartItemIds?: string[]
}

export interface CheckoutResponse {
  success: boolean
  orderId: string
  message: string
  requiresPayment?: boolean
  amount?: number
  currency?: string
  paymentMethod?: string
}

export interface CreateRazorpayOrderRequest {
  orderId: string
  amount: number
  currency?: string
}

export interface CreateRazorpayOrderResponse {
  success: boolean
  razorpayOrderId: string
  amount: number
  currency: string
  key: string
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

export interface VerifyPaymentResponse {
  success: boolean
  message: string
  orderId: string
}

export interface Payment {
  id: string
  order_id: string
  razorpay_order_id: string
  razorpay_payment_id: string
  amount: number
  currency: string
  status: 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded'
  method: string
  created_at: string
  captured_at?: string
}

export interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  handler: (response: RazorpayResponse) => void
  prefill?: {
    name?: string
    email?: string
    contact?: string
  }
  theme?: {
    color?: string
  }
  modal?: {
    ondismiss?: () => void
  }
}

export interface RazorpayResponse {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => {
      open: () => void
      on: (event: string, handler: () => void) => void
    }
  }
}
```

---

## Error Handling

### Common Error Scenarios

```typescript
// utils/errorHandler.ts

export const handlePaymentError = (error: any) => {
  if (error.response) {
    // API error
    switch (error.response.status) {
      case 400:
        return 'Invalid payment details. Please try again.'
      case 404:
        return 'Order not found. Please contact support.'
      case 500:
        return 'Server error. Please try again later.'
      default:
        return 'Payment failed. Please try again.'
    }
  } else if (error.message === 'Payment cancelled by user') {
    return 'Payment was cancelled. You can try again when ready.'
  } else {
    return 'An unexpected error occurred. Please try again.'
  }
}
```

### Retry Logic

```typescript
// utils/retry.ts

export const retryPayment = async (
  paymentFn: () => Promise<any>,
  maxRetries = 3
) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await paymentFn()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
```

---

## Testing

### Test Card Numbers (Razorpay Test Mode)

```javascript
// Test cards for different scenarios
const TEST_CARDS = {
  success: {
    number: '4111 1111 1111 1111',
    cvv: '123',
    expiry: '12/25'
  },
  failure: {
    number: '4000 0000 0000 0002',
    cvv: '123',
    expiry: '12/25'
  },
  insufficientFunds: {
    number: '4000 0000 0000 9995',
    cvv: '123',
    expiry: '12/25'
  }
}
```

---

## Quick Start Checklist

- [ ] Install Razorpay script loader
- [ ] Implement checkout API call
- [ ] Implement create Razorpay order API call
- [ ] Implement Razorpay checkout modal
- [ ] Implement payment verification API call
- [ ] Add error handling
- [ ] Add loading states
- [ ] Test with test cards
- [ ] Handle COD payments
- [ ] Redirect to success page

---

## API Base URL

**Development:** `http://localhost:3002/api`  
**Production:** `https://your-domain.com/api`

---

## Support

For integration issues, refer to:
- [Razorpay Integration Guide](./RAZORPAY_INTEGRATION.md)
- [API Documentation](http://localhost:3002/docs)
- [Razorpay Docs](https://razorpay.com/docs/payments/payment-gateway/web-integration/)
