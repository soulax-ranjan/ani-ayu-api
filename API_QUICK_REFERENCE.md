# API Quick Reference - Payment Integration

## 🚀 Quick Start: 3 API Calls for Payment

### 1️⃣ Create Order
```bash
POST /api/checkout
```
```json
{
  "addressId": "uuid",
  "paymentMethod": "card"
}
```
**Returns:** `{ orderId, amount, requiresPayment: true }`

---

### 2️⃣ Create Razorpay Order
```bash
POST /api/payments/create-order
```
```json
{
  "orderId": "uuid",
  "amount": 2999
}
```
**Returns:** `{ razorpayOrderId, amount: 299900, key }`

---

### 3️⃣ Verify Payment
```bash
POST /api/payments/verify
```
```json
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "xxx"
}
```
**Returns:** `{ success: true, orderId }`

---

## 📋 Complete API Endpoint List

### Payment APIs
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/checkout` | Create order in database |
| POST | `/api/payments/create-order` | Create Razorpay order |
| POST | `/api/payments/verify` | Verify payment signature |
| GET | `/api/payments/order/:orderId` | Get payment details |
| POST | `/api/payments/webhook` | Razorpay webhook (internal) |

### Supporting APIs
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/cart` | Get cart items |
| POST | `/api/cart/add` | Add item to cart |
| DELETE | `/api/cart/item/:id` | Remove cart item |
| GET | `/api/addresses` | Get user addresses |
| POST | `/api/addresses` | Create address |
| GET | `/api/orders` | Get user orders |
| GET | `/api/orders/:id` | Get order details |

---

## 💻 Minimal Frontend Code

```javascript
// 1. Checkout
const checkout = await fetch('/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ addressId, paymentMethod: 'card' })
}).then(r => r.json())

// 2. Create Razorpay Order
const payment = await fetch('/api/payments/create-order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    orderId: checkout.orderId, 
    amount: checkout.amount 
  })
}).then(r => r.json())

// 3. Open Razorpay
const razorpay = new Razorpay({
  key: payment.key,
  amount: payment.amount,
  order_id: payment.razorpayOrderId,
  handler: async (response) => {
    // 4. Verify
    await fetch('/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    })
    window.location.href = `/success/${checkout.orderId}`
  }
})
razorpay.open()
```

---

## 🔑 Environment Setup

```bash
# .env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxx
```

---

## 🗄️ Database Setup

```bash
# Run this SQL in Supabase
/database/razorpay_payments.sql
```

---

## 📦 Install Dependencies

```bash
npm install razorpay
```

---

## ✅ Testing

**Test Card:** `4111 1111 1111 1111`  
**CVV:** Any 3 digits  
**Expiry:** Any future date

---

## 🔗 Documentation Links

- **Full Integration Guide:** [RAZORPAY_INTEGRATION.md](./RAZORPAY_INTEGRATION.md)
- **Frontend Guide:** [FRONTEND_API_GUIDE.md](./FRONTEND_API_GUIDE.md)
- **API Docs:** http://localhost:3002/docs
- **Swagger:** [swagger.yaml](./swagger.yaml)

---

## 🎯 Payment Flow Summary

```
User → Checkout → Create Order → Create Razorpay Order → 
Open Razorpay Modal → User Pays → Verify Payment → Success
```

**Time:** ~2-3 seconds for complete flow

---

## 🛠️ Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid signature" | Check `RAZORPAY_KEY_SECRET` in .env |
| "Order not found" | Ensure order was created in step 1 |
| "Amount mismatch" | Verify amount is same in both calls |
| Webhook not working | Check webhook URL in Razorpay dashboard |

---

## 📞 Support

**Razorpay Docs:** https://razorpay.com/docs/  
**API Docs:** http://localhost:3002/docs  
**Test Dashboard:** https://dashboard.razorpay.com/
