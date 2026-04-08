# API Documentation — SentinelPay

All API calls go through the API Gateway at `http://localhost:8085` (or `http://localhost:3001` via the Nginx reverse proxy when using Docker).

## 4.1 Authentication

### Standard Auth Flow

```
1. Register (or login) → receive JWT access token
2. Include token in every subsequent request:
   Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
3. Token expires after JWT_EXPIRATION_MS (default: 24 hours)
4. Use refresh token flow to get a new access token silently
```

All endpoints under `/auth/**` are **public** (no JWT required). All others require a valid JWT.

---

## 4.2 Auth Endpoints

### POST `/auth/register`

Register a new user. Automatically creates a bank account with ₹10,000 starting balance.

**Request:**
```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Smith",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response 201 Created:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJqb2huQGV4YW1wbGUuY29tIiwiaWF0IjoxNzEyMzQ1Njc4LCJleHAiOjE3MTI0MzIwNzh9.signature",
  "email": "john@example.com",
  "name": "John Smith",
  "upiId": "johnsmith@upi",
  "message": "Registration successful"
}
```

**Response 409 Conflict** (email already registered):
```json
{
  "error": "Email already registered: john@example.com"
}
```

---

### POST `/auth/login`

**Request:**
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response 200 OK:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "email": "john@example.com",
  "name": "John Smith",
  "upiId": "johnsmith@upi",
  "message": "Login successful"
}
```

**Response 401 Unauthorized** (wrong credentials):
```json
{
  "error": "Bad credentials",
  "httpStatus": 401
}
```

---

### GET `/auth/health`

Service liveness check (no auth required).

**Response 200 OK:**
```json
{
  "service": "auth-service",
  "status": "UP",
  "timestamp": "2025-04-08T14:23:01"
}
```

---

## 4.3 UPI Payment Endpoints

### POST `/api/upi/pay`

Submit a UPI payment for async fraud analysis. Returns immediately with `PENDING` status.

**Request:**
```http
POST /api/upi/pay
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
Content-Type: application/json

{
  "payeeUpiId": "alice@upi",
  "amount": 500.00,
  "device": "mobile",
  "location": "chennai",
  "merchantCategory": "grocery",
  "paymentMode": "BANK"
}
```

**Field descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `payeeUpiId` | string | ✅ | Recipient's UPI ID (must be registered in bank-service) |
| `amount` | decimal | ✅ | Payment amount in INR (must be > 0) |
| `device` | string | ✅ | Device identifier — used for device-change fraud detection |
| `location` | string | ✅ | City/location — used for impossible travel detection |
| `merchantCategory` | string | recommended | e.g. "grocery", "fuel", "entertainment" — improves AI analysis |
| `paymentMode` | string | ✅ | `"BANK"` (simulation) or `"RAZORPAY"` (real payment) |

> ⚠️ **Payer identity is always taken from the JWT** (injected as `X-User-Email` by the gateway). Any `payerUserId` field in the request body is ignored.

**Response 202 Accepted:**
```json
{
  "transactionId": "3f8a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "status": "PENDING",
  "message": "Transaction submitted. Poll /api/transactions/3f8a2b1c-... for result.",
  "payerEmail": "john@example.com",
  "payeeUpiId": "alice@upi",
  "amount": 500.00,
  "timestamp": "2025-04-08T14:23:01"
}
```

**Response 401 Unauthorized** (missing X-User-Email — gateway bypass detected):
```json
{
  "error": "Unauthorized",
  "message": "X-User-Email header missing. Request must pass through API Gateway."
}
```

**Response 429 Too Many Requests** (rate limit exceeded):
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Maximum 5 requests per 60 seconds."
}
```

---

### GET `/api/transactions/{transactionId}`

Get the combined payment status and fraud verdict for a transaction.

**Request:**
```http
GET /api/transactions/3f8a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

**Response 200 OK (SAFE + payment processed):**
```json
{
  "transactionId": "3f8a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "fraudStatus": "SAFE",
  "fraudReason": "Transaction appears legitimate. AI confidence score: 0.12",
  "confidenceScore": 0.12,
  "detectionLayer": "AI",
  "paymentStatus": "SUCCESS",
  "amount": 500.00,
  "payerEmail": "john@example.com",
  "payeeUpiId": "alice@upi",
  "analyzedAt": "2025-04-08 14:23:04"
}
```

**Response 200 OK (FRAUD + payment blocked):**
```json
{
  "transactionId": "3f8a2b1c-...",
  "fraudStatus": "FRAUD",
  "fraudReason": "Transaction amount 25000 INR exceeds high-risk threshold of 10000 INR",
  "confidenceScore": 0.95,
  "detectionLayer": "RULE_BASED",
  "paymentStatus": "SKIPPED",
  "analyzedAt": "2025-04-08 14:23:02"
}
```

---

## 4.4 Fraud Detection Endpoints

### GET `/api/fraud/result/{transactionId}`

Poll for the fraud verdict. Used by the frontend polling loop.

**Response 200 OK (verdict ready):**
```json
{
  "transactionId": "3f8a2b1c-...",
  "userId": "john@example.com",
  "status": "SAFE",
  "reason": "No suspicious indicators detected",
  "confidenceScore": 0.08,
  "detectionLayer": "AI",
  "analyzedAt": "2025-04-08 14:23:04"
}
```

**Response 202 Accepted (still processing):**
```json
{
  "status": "PENDING",
  "message": "Fraud analysis in progress. Retry after hint: 3 seconds.",
  "retryAfterSeconds": 3
}
```

> The `retryAfterSeconds` hint is dynamic — the AI layer may return a longer hint if under load. The frontend respects this and adjusts its polling interval accordingly (capped at 30s).

---

### GET `/api/fraud/payment/{transactionId}`

Get the payment lifecycle status (separate from fraud verdict).

**Response 200 OK:**
```json
{
  "transactionId": "3f8a2b1c-...",
  "paymentStatus": "SUCCESS",
  "payerEmail": "john@example.com",
  "payeeEmail": "alice@example.com",
  "payeeUpiId": "alice@upi",
  "amount": 500.00,
  "paymentMode": "BANK",
  "initiatedAt": "2025-04-08T14:23:01",
  "completedAt": "2025-04-08T14:23:04",
  "elapsedMs": 3002
}
```

---

### GET `/api/fraud/history/{userId}`

Get the user's cached transaction history from Redis. Primarily for debugging.

**Request:**
```http
GET /api/fraud/history/john@example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

---

### DELETE `/api/fraud/result/{transactionId}`

Clear a fraud result from Redis to allow re-analysis (useful for REVIEW status cases).

**Response 204 No Content** (result cleared successfully).
**Response 404 Not Found** (no result exists for this transaction ID).

---

## 4.5 Bank Endpoints

### GET `/bank/balance`

Get the authenticated user's current balance. Identity comes from the JWT (X-User-Email).

**Response 200 OK:**
```json
{
  "userId": "john@example.com",
  "upiId": "johnsmith@upi",
  "balance": 9500.00,
  "currency": "INR",
  "accountStatus": "ACTIVE"
}
```

---

### GET `/bank/account/by-upi/{upiId}`

Look up a bank account by UPI ID (used for payee resolution before payment).

**Request:**
```http
GET /bank/account/by-upi/alice%40upi
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

**Response 200 OK:**
```json
{
  "userId": "alice@example.com",
  "upiId": "alice@upi",
  "name": "Alice Johnson",
  "accountStatus": "ACTIVE"
}
```

**Response 404 Not Found** (UPI ID not registered):
```json
{
  "error": "Account not found for UPI ID: unknown@upi"
}
```

---

## 4.6 Standard Error Response Format

All services return errors in a consistent format:

```json
{
  "traceId": "3f8a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "timestamp": "2025-04-08T14:23:01",
  "httpStatus": 401,
  "error": "Unauthorized",
  "message": "Invalid or expired JWT token: Token has expired",
  "path": "/api/upi/pay"
}
```

| Field | Description |
|-------|-------------|
| `traceId` | Distributed trace ID — use this to grep logs across all services |
| `timestamp` | When the error occurred (ISO 8601) |
| `httpStatus` | HTTP status code (integer) |
| `error` | Short error type |
| `message` | Human-readable explanation |
| `path` | Request path that failed |

---

## 4.7 Frontend Polling Pattern

The frontend implements an abort-aware polling loop for fraud results:

```
Submit payment → POST /api/upi/pay → 202 { transactionId }
                                          ↓
                              Start polling loop (max 12 attempts)
                                          ↓
                         GET /api/fraud/result/{transactionId}
                                          ↓
                    202? → wait retryAfterSeconds (default 3s, max 30s)
                    200? → render verdict (SAFE / REVIEW / FRAUD)
                    404? → throw error (transaction not found)
                    Abort signal? → exit loop silently (component unmounted)
```

Recommended client-side implementation: poll with exponential backoff only if the server doesn't return a `retryAfterSeconds` hint. If the hint is present, use it directly.
