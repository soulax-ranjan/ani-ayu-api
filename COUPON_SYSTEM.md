# Coupon/Promo Code System - Complete Guide

## 🎯 Overview

Complete coupon/discount code system with:
- ✅ Percentage & fixed discounts
- ✅ Minimum order amount validation
- ✅ Usage limits (total & per-user)
- ✅ Expiry dates
- ✅ Real-time verification
- ✅ Automatic discount calculation

---

## 📊 Database Schema

### **Coupons Table**
```sql
- id (UUID)
- code (VARCHAR) - Unique coupon code
- description (TEXT)
- discount_type ('percentage' | 'fixed')
- discount_value (DECIMAL)
- max_discount_amount (DECIMAL) - Cap for percentage discounts
- min_order_amount (DECIMAL)
- max_uses (INTEGER) - NULL = unlimited
- max_uses_per_user (INTEGER)
- current_uses (INTEGER)
- valid_from (TIMESTAMP)
- valid_until (TIMESTAMP)
- is_active (BOOLEAN)
```

### **Coupon Usage Table**
```sql
- id (UUID)
- coupon_id (UUID)
- user_id (UUID)
- guest_id (VARCHAR)
- order_id (UUID)
- discount_amount (DECIMAL)
- order_amount (DECIMAL)
- used_at (TIMESTAMP)
```

---

## 🚀 API Endpoints

### **1. Verify Coupon**
**POST** `/api/coupons/verify`

Verify a coupon code and calculate discount.

**Headers:**
```javascript
{
  'Content-Type': 'application/json',
  'x-guest-id': '<guest-id>' // or Authorization header
}
```

**Request:**
```json
{
  "code": "WELCOME10",
  "orderAmount": 2500
}
```

**Response (Valid):**
```json
{
  "valid": true,
  "coupon": {
    "id": "uuid",
    "code": "WELCOME10",
    "description": "Welcome discount - 10% off",
    "discount_type": "percentage",
    "discount_value": 10
  },
  "discount": 250,
  "finalAmount": 2250,
  "message": "Coupon applied! You saved ₹250"
}
```

**Response (Invalid):**
```json
{
  "valid": false,
  "message": "Minimum order amount is ₹1000"
}
```

---

### **2. Get All Active Coupons**
**GET** `/api/coupons`

Get list of all active coupons.

**Response:**
```json
{
  "coupons": [
    {
      "code": "WELCOME10",
      "description": "Welcome discount - 10% off",
      "discount_type": "percentage",
      "discount_value": 10,
      "max_discount_amount": 500,
      "min_order_amount": 1000,
      "valid_until": "2024-02-28T00:00:00Z"
    },
    {
      "code": "FLAT200",
      "description": "Flat ₹200 off on orders above ₹2000",
      "discount_type": "fixed",
      "discount_value": 200,
      "min_order_amount": 2000,
      "valid_until": "2024-02-28T00:00:00Z"
    }
  ]
}
```

---

### **3. Get Specific Coupon**
**GET** `/api/coupons/:code`

Get details of a specific coupon.

**Response:**
```json
{
  "coupon": {
    "code": "WELCOME10",
    "description": "Welcome discount - 10% off",
    "discount_type": "percentage",
    "discount_value": 10,
    "max_discount_amount": 500,
    "min_order_amount": 1000,
    "valid_from": "2024-01-01T00:00:00Z",
    "valid_until": "2024-02-28T00:00:00Z",
    "is_active": true
  }
}
```

---

## 💻 Frontend Integration

### **React/Next.js Example**

```typescript
// hooks/useCoupon.ts
import { useState } from 'react'

interface CouponVerification {
  valid: boolean
  discount?: number
  finalAmount?: number
  message?: string
}

export const useCoupon = () => {
  const [loading, setLoading] = useState(false)
  const [couponData, setCouponData] = useState<CouponVerification | null>(null)

  const verifyCoupon = async (code: string, orderAmount: number) => {
    setLoading(true)
    try {
      const response = await fetch('/api/coupons/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-guest-id': localStorage.getItem('guestId') || ''
        },
        body: JSON.stringify({ code, orderAmount })
      })

      const data = await response.json()
      setCouponData(data)
      return data
    } catch (error) {
      console.error('Coupon verification error:', error)
      return { valid: false, message: 'Failed to verify coupon' }
    } finally {
      setLoading(false)
    }
  }

  const removeCoupon = () => {
    setCouponData(null)
  }

  return { verifyCoupon, removeCoupon, couponData, loading }
}
```

### **Usage in Component**

```typescript
// components/CheckoutPage.tsx
'use client'

import { useState } from 'react'
import { useCoupon } from '@/hooks/useCoupon'

export default function CheckoutPage() {
  const [couponCode, setCouponCode] = useState('')
  const [orderAmount] = useState(2500)
  const { verifyCoupon, removeCoupon, couponData, loading } = useCoupon()

  const handleApplyCoupon = async () => {
    const result = await verifyCoupon(couponCode, orderAmount)
    
    if (result.valid) {
      alert(result.message)
    } else {
      alert(result.message)
    }
  }

  const finalAmount = couponData?.valid 
    ? couponData.finalAmount 
    : orderAmount

  return (
    <div className="checkout">
      <h2>Order Summary</h2>
      
      <div className="order-total">
        <p>Subtotal: ₹{orderAmount}</p>
        
        {couponData?.valid && (
          <p className="discount">
            Discount ({couponData.coupon.code}): -₹{couponData.discount}
            <button onClick={removeCoupon}>Remove</button>
          </p>
        )}
        
        <p className="total">Total: ₹{finalAmount}</p>
      </div>

      <div className="coupon-section">
        <input
          type="text"
          placeholder="Enter coupon code"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
        />
        <button 
          onClick={handleApplyCoupon}
          disabled={loading || !couponCode}
        >
          {loading ? 'Verifying...' : 'Apply'}
        </button>
      </div>

      {couponData && !couponData.valid && (
        <p className="error">{couponData.message}</p>
      )}
    </div>
  )
}
```

### **Vanilla JavaScript Example**

```javascript
// coupon.js
class CouponManager {
  constructor() {
    this.apiBaseUrl = 'http://localhost:3002/api'
    this.guestId = localStorage.getItem('guestId')
    this.appliedCoupon = null
  }

  async verifyCoupon(code, orderAmount) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/coupons/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-guest-id': this.guestId
        },
        body: JSON.stringify({ code, orderAmount })
      })

      const data = await response.json()

      if (data.valid) {
        this.appliedCoupon = data
        this.updateUI(data)
      }

      return data
    } catch (error) {
      console.error('Coupon error:', error)
      return { valid: false, message: 'Failed to verify coupon' }
    }
  }

  removeCoupon() {
    this.appliedCoupon = null
    this.updateUI(null)
  }

  updateUI(couponData) {
    const discountEl = document.getElementById('discount-amount')
    const totalEl = document.getElementById('total-amount')
    const couponMsgEl = document.getElementById('coupon-message')

    if (couponData && couponData.valid) {
      discountEl.textContent = `₹${couponData.discount}`
      totalEl.textContent = `₹${couponData.finalAmount}`
      couponMsgEl.textContent = couponData.message
      couponMsgEl.className = 'success'
    } else {
      discountEl.textContent = '₹0'
      totalEl.textContent = `₹${orderAmount}`
      if (couponData) {
        couponMsgEl.textContent = couponData.message
        couponMsgEl.className = 'error'
      }
    }
  }

  getDiscount() {
    return this.appliedCoupon?.discount || 0
  }

  getCouponCode() {
    return this.appliedCoupon?.coupon?.code || null
  }
}

// Usage
const couponManager = new CouponManager()

document.getElementById('apply-coupon-btn').addEventListener('click', async () => {
  const code = document.getElementById('coupon-input').value
  const orderAmount = parseFloat(document.getElementById('order-amount').dataset.amount)
  
  const result = await couponManager.verifyCoupon(code, orderAmount)
  
  if (!result.valid) {
    alert(result.message)
  }
})
```

---

## 🎨 Sample Coupons

The system comes with pre-loaded sample coupons:

| Code | Type | Discount | Min Order | Max Discount | Description |
|------|------|----------|-----------|--------------|-------------|
| `WELCOME10` | Percentage | 10% | ₹1000 | ₹500 | Welcome discount |
| `FLAT200` | Fixed | ₹200 | ₹2000 | - | Flat discount |
| `FIRST500` | Fixed | ₹500 | ₹2000 | - | First order discount |
| `SAVE20` | Percentage | 20% | ₹1500 | ₹1000 | Save big |

---

## ✅ Validation Rules

The system automatically validates:

1. **Coupon Exists** - Code must be valid
2. **Active Status** - Coupon must be active
3. **Validity Period** - Current date must be within valid range
4. **Minimum Amount** - Order must meet minimum amount
5. **Usage Limits** - Total and per-user limits enforced
6. **Already Used** - Prevents duplicate usage by same user

---

## 🔄 Integration with Checkout

The coupon system integrates seamlessly with checkout. When a user applies a coupon:

1. Frontend verifies coupon via `/coupons/verify`
2. User proceeds to checkout with coupon code
3. Backend applies discount during order creation
4. Coupon usage is recorded
5. Discount is reflected in final amount

---

## 🧪 Testing

### **Test Coupon Verification**
```bash
curl -X POST http://localhost:3002/api/coupons/verify \
  -H "Content-Type: application/json" \
  -H "x-guest-id: test_guest_123" \
  -d '{
    "code": "WELCOME10",
    "orderAmount": 2500
  }'
```

### **Test Get All Coupons**
```bash
curl http://localhost:3002/api/coupons
```

---

## 📝 Admin Features (Future)

You can extend the system with admin endpoints to:
- Create new coupons
- Update existing coupons
- Deactivate coupons
- View usage statistics
- Export coupon reports

---

## 🎉 Summary

Your coupon system is now ready with:
- ✅ Complete API endpoints
- ✅ Database schema with RLS
- ✅ Frontend integration examples
- ✅ Validation & error handling
- ✅ Usage tracking
- ✅ Sample coupons

**Run the database migration and start using coupons!** 🚀
