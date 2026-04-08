# Component Breakdown — SentinelPay

## 2.1 API Gateway

**Port:** 8085 | **Tech:** Spring Cloud Gateway 4.x

The gateway is the **single entry point** for all client requests. It performs three critical functions before any request reaches a downstream service.

### JWT Validation (`JwtAuthFilter`)

A `GlobalFilter` running at `Ordered.HIGHEST_PRECEDENCE` that:

1. Generates `X-Trace-Id` (UUID) if not present — propagated to all downstream services
2. Allows public paths (`/auth/**`, `/actuator/**`) without JWT
3. For all other paths: extracts and validates the `Authorization: Bearer <token>` header
4. On success: extracts email from JWT subject, injects `X-User-Email` header
5. On failure: returns a structured JSON 401 (never HTML, never a redirect)

The filter's public path check uses `startsWith("/auth/")` — note the trailing slash. A bare `/auth` request is treated as protected. This is intentional.

### Route Table (`application-docker.yml`)

| Route ID | Path Predicate | Upstream Service |
|----------|---------------|-----------------|
| `auth-service` | `/auth/**` | `auth-service:8083` |
| `transaction-service` | `/api/transactions` | `transaction-service:8081` |
| `transaction-status` | `/api/transactions/**` | `transaction-service:8081` |
| `upi-payment` | `/api/upi/**` | `transaction-service:8081` |
| `fraud-detection-service` | `/api/fraud/**` | `fraud-detection-service:8082` |
| `bank-balance` | `/bank/balance` | `bank-service:8084` |
| `bank-account-by-upi` | `/bank/account/by-upi/**` | `bank-service:8084` |

All routes use `StripPrefix=0` — the full path is forwarded unchanged to the upstream service.

### CORS Policy

Configured via `globalcors` in `application-docker.yml`. In development, `ALLOWED_ORIGINS` includes both `http://localhost:3000` (npm start) and `http://localhost:3001` (Docker Nginx). Credentials are allowed with `allowCredentials: true`.

---

## 2.2 Auth Service

**Port:** 8083 | **Tech:** Spring Boot, Spring Security, JJWT, JPA/MySQL

Handles all user identity operations.

### Registration Flow

```
POST /auth/register { name, email, password }
    ↓
1. Check email uniqueness (throws 409 if exists)
2. Generate UPI ID: sanitise(name) + "@upi"  e.g. "johnsmith@upi"
3. BCrypt-hash password
4. Persist User entity to MySQL (auth_db.users)
5. Call bank-service: POST /bank/account/create
   → Creates BankAccount with ₹10,000 starting balance
6. Generate JWT (subject = email, exp = 24h)
7. Return AuthResponse { token, email, name, upiId }
```

### Login Flow

```
POST /auth/login { email, password }
    ↓
1. Load UserDetails from MySQL by email (throws 401 if not found)
2. BCrypt.matches(rawPassword, storedHash)
3. Generate JWT
4. Return AuthResponse
```

### JWT Structure

```json
{
  "sub": "john@example.com",
  "iat": 1712345678,
  "exp": 1712432078
}
```

The JWT secret must match between `auth-service` and `api-gateway` — both read from the `JWT_SECRET` environment variable.

---

## 2.3 Transaction Service

**Port:** 8081 | **Tech:** Spring Boot, Kafka Producer, Redis, JPA

Handles payment submission and acts as the **Kafka producer** for the fraud pipeline.

### UPI Payment Flow (`POST /api/upi/pay`)

```
Request arrives with X-User-Email (injected by gateway)
    ↓
1. Identity enforcement: 401 if X-User-Email is missing (gateway bypass)
2. Bean validation: payeeUpiId, amount (> 0), paymentMode
3. Rate limit check via Redis:
   Key: "rate:{userEmail}" → increment + TTL
   If > RATE_LIMIT_MAX_REQUESTS in window → 429 Too Many Requests
4. Resolve payee: GET bank-service/bank/account/by-upi/{payeeUpiId}
   → Returns payee AccountResponse or 404 if UPI not found
5. Build TransactionEvent:
   { transactionId (UUID), payerUserId (from X-User-Email),
     payeeUpiId, amount, device, location, merchantCategory,
     paymentMode, timestamp, traceId }
6. Publish to Kafka topic "transactions" (key = payerUserId for ordering)
7. Return 202 Accepted { transactionId, status: "PENDING" }
```

### Transaction Status (`GET /api/transactions/{id}`)

Aggregates two Redis keys:

- `fraud:result:{id}` — the fraud verdict
- `payment:record:{id}` — the payment lifecycle state

Returns a combined `TransactionStatusResponse` with both verdict and payment outcome.

---

## 2.4 Fraud Detection Service

**Port:** 8082 | **Tech:** Spring Boot, Kafka Consumer, Redis, OpenAI (Spring AI)

The core of the system. Implements the **3-layer short-circuit fraud pipeline**.

### Layer 1: Rule Engine

Runs synchronously in-memory in < 1ms. Checks in order:

```java
// 1. High-amount threshold
if (amount > fraudRules.getHighAmountThreshold())  // default: ₹10,000
    return FRAUD("Amount exceeds threshold", 0.95)

// 2. Unknown location
if (userHasHistory && !history.getLocations().contains(location))
    return FRAUD("Unknown location: " + location, 0.90)

// 3. Velocity (too many transactions today)
long todayCount = history.getTodayTransactionCount()
if (todayCount > fraudRules.getMaxTransactionsPerDay())  // default: 10
    return FRAUD("Velocity exceeded: " + todayCount + " today", 0.88)
```

### Layer 2: Redis History Analyser

Reads the user's transaction history from Redis. Two checks:

**Impossible travel detection:**
```java
// If two transactions happened < 5 minutes apart from different cities → FRAUD
Duration elapsed = Duration.between(previous.getTimestamp(), current.getTimestamp())
if (elapsed.toMinutes() < fraudRules.getImpossibleTravelMinutes()
    && !previous.getLocation().equals(current.getLocation()))
    return FRAUD("Impossible travel: " + prev.location + " → " + curr.location, 0.92)
```

**Device change detection:**
```java
// If device changed AND neither side is "UNKNOWN" → REVIEW (escalate to AI)
if (isDifferentDevice(previous, current))
    reviewFlag = true  // Don't block yet — AI decides
```

The `"UNKNOWN"` sentinel is excluded from device/location comparisons. This prevents false positives from historical records stored before device tracking was added.

### Layer 3: OpenAI GPT (Spring AI)

Only reached when Layers 1 and 2 don't conclusively flag FRAUD. Sends a structured prompt to GPT-4:

```
Analyse this UPI transaction for fraud risk:
Amount: ₹{amount} | Location: {location} | Device: {device}
Merchant Category: {merchantCategory} | History: {recentTransactions}
Context: {reviewNotes from Layer 2 if REVIEW flagged}

Respond with JSON: { "confidence": 0.0-1.0, "reason": "..." }
```

Confidence interpretation:
- `> 0.6` → `FRAUD`
- `0.4–0.6` → `REVIEW` (human analyst queue)
- `< 0.4` → `SAFE`

If OpenAI is unavailable (timeout/API error), the service falls back to `SAFE` with `detectionLayer: "AI_FALLBACK"` and logs a warning. The system never blocks a transaction due to AI unavailability.

### Payment Processing (post-verdict)

If fraud verdict is `SAFE`, the service executes the payment:

```
1. Resolve payee email from UPI ID → bank-service lookup
2. Debit payer: POST /bank/debit { userId: payerEmail, amount }
3. Credit payee: POST /bank/credit { userId: payeeEmail, amount }
4. If credit fails after successful debit: COMPENSATE
   → POST /bank/refund { userId: payerEmail, amount }
   → PaymentRecord.status = COMPENSATED or COMPENSATION_FAILED
5. Update PaymentRecord in Redis
```

This implements a **saga-style compensation pattern**. If the credit step fails, the debit is refunded. `COMPENSATION_FAILED` is a critical state requiring manual ops intervention.

### Razorpay Integration

When `paymentMode=RAZORPAY`, the service creates a Razorpay order instead of using the internal bank-service. The order ID is stored in `PaymentRecord.razorpayOrderId` for reconciliation.

---

## 2.5 Bank Service

**Port:** 8084 | **Tech:** Spring Boot, JPA/MySQL, Pessimistic Locking

Simulates an NPCI bank backend. All balance operations use **pessimistic write locking** (`SELECT ... FOR UPDATE`) to prevent race conditions in concurrent debit/credit scenarios.

**Idempotency:** Every debit/credit operation records a `BankTransaction` entity. Before processing, the service checks if a transaction with the same `transactionId` already exists — if so, it returns the cached result (idempotent replay).

**Starting balance:** Every new account is seeded with ₹10,000 by the `@PrePersist` hook.

**External endpoints (via API Gateway):**
- `GET /bank/balance` — authenticated user's balance (identity from X-User-Email)
- `GET /bank/account/by-upi/{upiId}` — payee lookup

**Internal endpoints (NOT routed through gateway):**
- `POST /bank/debit` — deduct from account
- `POST /bank/credit` — add to account
- `POST /bank/refund` — compensation credit
- `POST /bank/account/create` — called by auth-service on registration

---

## 2.6 Notification Service

**Port:** 8086 | **Tech:** Spring Boot, Kafka Consumer, Spring Mail (SMTP)

A lightweight consumer that listens on the `notifications` Kafka topic and sends fraud alert emails.

```
NotificationEvent received:
    ↓
EmailTemplateBuilder.build(event)  → HTML email with fraud details
    ↓
EmailService.send(to: userEmail, subject: "⚠️ Fraud Alert", body: html)
    ↓
JavaMailSender → SMTP (Gmail / any SMTP provider)
```

Email content includes: transaction ID, amount, detected fraud reason, confidence score, timestamp, and a link to the fraud alerts page.

---

## 2.7 Frontend (React SPA)

**Port:** 3001 (Docker via Nginx) | 3000 (npm start) | **Tech:** React 18, Material UI, Axios

### Key Architectural Patterns

**Async fraud polling:** After submitting a payment (202 response), the frontend enters a polling loop. `fetchFraudResultWithRetry` polls `GET /api/fraud/result/{id}` up to 12 times with 3-second intervals. Each 202 response may include a `retryAfterSeconds` hint that dynamically adjusts the wait time (capped at 30s).

**AbortController cancellation:** Each polling loop is bound to an `AbortController`. When the component unmounts or the user submits a new payment, the controller aborts all pending requests and the abort-aware sleep resolves immediately, preventing setState calls on unmounted components.

**isMountedRef guard:** A single `useRef(true)` (set to `false` on cleanup) guards all post-await state updates. This is the last line of defence against React's "Can't perform a state update on an unmounted component" warning.

**GET request deduplication:** `axiosConfig.js` maintains an in-flight AbortController map keyed by `get:{url}`. If the same GET is fired twice concurrently, the first is aborted. This prevents duplicate fraud result polls from stacking up.

**SSE with polling fallback:** `useSSE.js` connects to `/api/fraud/stream` for real-time fraud alerts. If the EventSource fails (after 5 retries with exponential backoff), it falls back to a 15-second polling interval.

**Theme system:** Dark/light mode is managed by `ThemeContext` which bridges a custom React context to MUI's `ThemeProvider`. The theme persists across navigation without re-mounting the provider.
