# Guest User Purchase Flow Guide

This document outlines the complete API journey for a Guest User to browse, add to cart, and complete a purchase without creating an account.


## 1. Start Guest Session
**Outcome:** The server sets a `guest_id` cookie. This cookie **must** be preserved by the client (browser/mobile) for all subsequent requests.

```bash
curl -X POST http://localhost:3002/guest/session \
  -c cookies.txt \
  -v
```
*(We use `-c cookies.txt` in these examples to simulate the browser storing cookies)*

---

## 2. Browse Products
Guest views product details to choose items.

```bash
# Get list of products
curl "http://localhost:3002/products?limit=5" -v

# Get specific product details (Copy an ID from above)
curl "http://localhost:3002/products/PRODUCT_ID" -v
```

---

## 3. Add to Cart
Guest adds an item to their cart. The cart is linked to the `guest_id` from the cookie.

```bash
curl -X POST http://localhost:3002/cart/add \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "YOUR_PRODUCT_UUID", 
    "quantity": 1,
    "size": "M",
    "color": "Blue"
  }' \
  -v
```

---

## 4. View Cart
Guest reviews their items.

```bash
curl http://localhost:3002/cart \
  -b cookies.txt \
  -v
```

---

## 5. Checkout Process

### Step A: Provide Shipping Address & Email
Since the user is a guest, we collect their **Email** here along with the address.
**Note:** The backend is updated to accept `email` in the address payload.

```bash
curl -X POST http://localhost:3002/addresses \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Guest Buyer",
    "email": "buyer@guest.com", 
    "phone": "9988776655", 
    "addressLine1": "Flat 101, Guest Residency", 
    "city": "Bengaluru", 
    "state": "Karnataka", 
    "country": "India", 
    "postalCode": "560001"
  }' \
  -v
```
**Response:** Returns the created Address object. **Copy the `id` (UUID)**.

### Step B: Place Order (COD or Online)
Guest initiates the order using the Address ID from Step A.

**Option 1: Cash on Delivery (COD)**
```bash
curl -X POST http://localhost:3002/checkout \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "addressId": "ADDRESS_UUID_FROM_STEP_A",
    "paymentMethod": "cod"
  }' \
  -v
```

**Option 2: Online Payment (Razorpay)**
```bash
curl -X POST http://localhost:3002/checkout \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "addressId": "ADDRESS_UUID_FROM_STEP_A",
    "paymentMethod": "card"
  }' \
  -v
```
**Response (Online):** Returns `{ success: true, orderId: "...", razorpayOrderId: "...", amount: ..., currency: "INR" }`.

---

**🛑 FRONTEND ACTION REQUIRED HERE 🛑**
1. Frontend receives `razorpayOrderId`.
2. Frontend opens Razorpay Checkout Form (`new Razorpay({...})`).
3. User pays successfully.
4. Razorpay returns `razorpayPaymentId` and `razorpaySignature` to the frontend.

---

### Step C: Verify Payment (If Online)
After successful payment on Razorpay, the frontend calls this API to confirm the transaction.

```bash
curl -X POST http://localhost:3002/payments/verify \
  -H "Content-Type: application/json" \
  -d '{
    "razorpayOrderId": "RAZORPAY_ORDER_ID_FROM_STEP_B",
    "razorpayPaymentId": "pay_mock_123456",
    "razorpaySignature": "mock_signature"
  }' \
  -v
```
**Success!** Order status updates to `processing` and payment status to `paid`.

### Step D: Check Order Details
Guest can view the order immediately.
Guest can view the order immediately (while the session is active).

```bash
# Replace with orderId from Step B
curl "http://localhost:3002/orders/ORDER_ID" \
  -b cookies.txt \
  -v
```

### Step E: Track Order (If Session Lost)
If the guest clears cookies or uses a different device, they can find their order using the **Email** and **Phone** they provided.

```bash
curl -X POST http://localhost:3002/orders/track \
  -H "Content-Type: application/json" \
  -d '{
    "email": "buyer@guest.com",
    "phone": "9988776655"
  }' \
  -v
```

---

## 6. Convert to Registered User (Optional)
...
