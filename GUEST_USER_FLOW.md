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

### Step B: Place Order
Guest finalizes the order using the Address ID from Step A.

**Selective Checkout (Optional):** You can pass `cartItemIds`: `["ITEM_UUID_1", "ITEM_UUID_2"]` to order only specific items from the cart. If omitted, all cart items are ordered.

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

**Success!** The API returns `{ success: true, orderId: "...", message: "Order placed successfully" }`.
The Cart is now empty (or contains only unselected items).

### Step C: Check Order Details
Guest can view the order immediately (while the session is active).

```bash
# Replace with orderId from Step B
curl "http://localhost:3002/orders/ORDER_ID" \
  -b cookies.txt \
  -v
```

### Step D: Track Order (If Session Lost)
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
