# Database Design — SentinelPay

## 3.1 Overview

SentinelPay uses two persistence technologies with distinct responsibilities:

| Technology | Database | Used by | Data type |
|-----------|----------|---------|-----------|
| MySQL 8.0 | `auth_db` | auth-service | User accounts (persistent) |
| MySQL 8.0 | `bank_db` | bank-service | Bank accounts & transactions (persistent) |
| Redis 7.2 | Key-value store | fraud-detection-service, transaction-service | Fraud results, user history, rate limits (TTL-based) |

---

## 3.2 MySQL Schema — `auth_db`

### `users` Table

Managed by auth-service. Persisted indefinitely.

```sql
CREATE TABLE users (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    name        VARCHAR(255)    NOT NULL,
    email       VARCHAR(255)    NOT NULL,
    password    VARCHAR(255)    NOT NULL,  -- BCrypt hash, never plaintext
    upi_id      VARCHAR(255)    NOT NULL,  -- e.g. "johnsmith@upi", auto-generated
    created_at  DATETIME        NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email  (email),
    UNIQUE KEY uk_users_upi_id (upi_id)
);
```

**Design decisions:**
- `email` is the identity key — used as JWT subject and `X-User-Email` throughout the system
- `upi_id` is derived from name at registration: `sanitise(name) + "@upi"`
- `password` is always BCrypt — never stored or logged in plaintext
- No `updated_at` column — user profile updates are not supported in the current version

---

## 3.3 MySQL Schema — `bank_db`

### `bank_accounts` Table

One account per user. Created automatically when a user registers via auth-service → bank-service call.

```sql
CREATE TABLE bank_accounts (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    user_id         VARCHAR(255)    NOT NULL,  -- matches users.email
    upi_id          VARCHAR(255)    NOT NULL,  -- matches users.upi_id
    account_number  VARCHAR(12)     NOT NULL,  -- 12 uppercase hex chars (UUID-derived)
    bank_name       VARCHAR(255)    NOT NULL DEFAULT 'Fraud Detection Bank',
    ifsc            VARCHAR(20)     NOT NULL DEFAULT 'FRDTB0001',
    balance         DECIMAL(15,2)   NOT NULL DEFAULT 10000.00,
    version         BIGINT,                    -- optimistic lock version
    created_at      DATETIME        NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uk_accounts_user_id    (user_id),
    UNIQUE KEY uk_accounts_upi_id     (upi_id),
    UNIQUE KEY uk_accounts_account_no (account_number)
);
```

**Design decisions:**
- `balance` uses `DECIMAL(15,2)` — avoids floating-point precision errors for monetary values
- `version` supports optimistic locking (JPA `@Version`) as secondary protection
- Primary concurrency guard is **pessimistic write locking** (`SELECT ... FOR UPDATE`) in the repository — prevents ABA problems under concurrent debit/credit
- `account_number` uses UUID-derived hex characters — unpredictable, not guessable from user ID

### `bank_transactions` Table

Immutable audit log of every debit/credit. Used for idempotency checks.

```sql
CREATE TABLE bank_transactions (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    transaction_id  VARCHAR(255)    NOT NULL,  -- from TransactionEvent.transactionId
    account_id      BIGINT          NOT NULL,  -- FK → bank_accounts.id
    type            ENUM('DEBIT','CREDIT','REFUND') NOT NULL,
    amount          DECIMAL(15,2)   NOT NULL,
    balance_after   DECIMAL(15,2)   NOT NULL,
    created_at      DATETIME        NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uk_tx_txid_type (transaction_id, type),  -- idempotency key
    FOREIGN KEY (account_id) REFERENCES bank_accounts(id)
);
```

**Idempotency:** The `(transaction_id, type)` unique constraint ensures a debit or credit for a given transaction can only be recorded once. If a Kafka message is replayed (at-least-once delivery), the duplicate operation is silently ignored.

---

## 3.4 Redis Key Schema

Redis acts as a high-speed cache and message store. All keys have TTLs to prevent unbounded growth.

### Fraud Results

```
Key:   fraud:result:{transactionId}
Value: JSON-serialised FraudResult
TTL:   FRAUD_RESULT_TTL_HOURS (default: 72 hours)

Example:
Key:   fraud:result:3f8a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c
Value: {
  "transactionId": "3f8a2b1c-...",
  "userId": "john@example.com",
  "status": "FRAUD",
  "reason": "Amount 25000 exceeds threshold 10000",
  "confidenceScore": 0.95,
  "detectionLayer": "RULE_BASED",
  "analyzedAt": "2025-04-08 14:23:01"
}
```

### Payment Records

```
Key:   payment:record:{transactionId}
Value: JSON-serialised PaymentRecord
TTL:   FRAUD_RESULT_TTL_HOURS (same as fraud result)

PaymentStatus state machine:
  PENDING → SUCCESS
          → FAILED
          → COMPENSATING → COMPENSATED
                         → COMPENSATION_FAILED  ← ops alert required
          → SKIPPED  (non-UPI / legacy transactions)
          → RAZORPAY_ORDER_CREATED
```

### User Transaction History

```
Key:   user:history:{userId}
Value: JSON-serialised UserTransactionHistory
TTL:   7 days (rolling — refreshed on each transaction)

Structure:
{
  "userId": "john@example.com",
  "transactions": [
    {
      "transactionId": "...",
      "amount": 500.00,
      "location": "Chennai",
      "device": "mobile",
      "timestamp": "2025-04-08T14:23:01",
      "merchantCategory": "grocery"
    },
    ...
  ],
  "knownLocations": ["Chennai", "Bangalore"],
  "knownDevices": ["mobile"],
  "todayTransactionCount": 3
}
```

Used by Layer 1 (velocity, unknown location) and Layer 2 (impossible travel, device change).

### Rate Limiting

```
Key:   rate:{userId}
Value: integer (request count)
TTL:   RATE_LIMIT_WINDOW_SECONDS (default: 60 seconds)

Implemented as Redis INCR + EXPIRE:
  INCR rate:{userId}    → increment counter
  If new key: EXPIRE rate:{userId} RATE_LIMIT_WINDOW_SECONDS
  If counter > RATE_LIMIT_MAX_REQUESTS → 429 Too Many Requests
```

---

## 3.5 Entity Relationships

```
auth_db.users (1)──────────────────────(1) bank_db.bank_accounts
  email (PK identity)                       user_id (= users.email)
  upi_id                                    upi_id (= users.upi_id)
                                            │
                                            │(1)
                                            │
                                      (N) bank_db.bank_transactions
                                            account_id → bank_accounts.id
                                            transaction_id (from Kafka event)

Redis.fraud:result:{txId} ─── references ─── MySQL.bank_transactions.transaction_id
Redis.payment:record:{txId} ─ references ─── MySQL.bank_transactions.transaction_id
Redis.user:history:{userId} ─ references ─── auth_db.users.email
```

---

## 3.6 Data Isolation Between Services

Each service owns its data. Cross-service data access is **always via REST API**, never via shared database connections.

| Service | Owns | Never accesses |
|---------|------|----------------|
| auth-service | `auth_db.users` | bank_db directly |
| bank-service | `bank_db.*` | auth_db directly |
| transaction-service | Redis (rate limits) | MySQL directly |
| fraud-detection-service | Redis (fraud results, history) | MySQL directly |
| notification-service | No persistent state | — |

This strict ownership boundary means each service's database schema can evolve independently, and database credentials are scoped per-service.
