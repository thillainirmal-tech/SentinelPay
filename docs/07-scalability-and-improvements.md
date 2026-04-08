# Scalability & Future Improvements — SentinelPay

## 7.1 Current Performance Characteristics

| Operation | Typical Latency | Bottleneck |
|-----------|----------------|-----------|
| Payment submission (202) | 10–50ms | Bank service UPI lookup |
| Fraud result — Layer 1 (rule engine) | < 5ms | Redis read only |
| Fraud result — Layer 2 (history) | 5–20ms | Redis read + write |
| Fraud result — Layer 3 (AI) | 300–800ms | OpenAI API |
| Frontend first poll finds result | ~3 seconds | Fixed poll interval |
| Email notification delivered | 5–15 seconds | SMTP relay |

**Throughput estimate (single-node):**
- Transaction submissions: ~200 req/s (constrained by MySQL writes in bank-service)
- Fraud analysis: ~50–100 transactions/s (constrained by OpenAI rate limits)
- Rule-only fraud verdicts: ~1,000/s (Redis ops)

---

## 7.2 Horizontal Scaling Points

The system is designed for horizontal scaling at every layer. Services are **stateless** (state in Redis/MySQL) and **Kafka-partitioned** (parallel consumers).

### transaction-service

Scale to N replicas. Each instance handles independent payment submissions. Rate limit state is in Redis, so it's consistent across all replicas. Kafka producer sends to any partition (keyed by userId for ordering).

```yaml
# docker-compose scale
docker-compose up -d --scale transaction-service=3
```

### fraud-detection-service

Scale to N replicas. Each replica is a Kafka consumer in the same group. Kafka distributes partitions across consumers — with 3 partitions and 3 replicas, each replica handles exactly 1 partition. This gives 3× throughput for rule engine and history analysis. AI calls scale with replicas too (independent OpenAI API calls per consumer).

```yaml
docker-compose up -d --scale fraud-detection-service=3
```

> 🔑 Key insight: To handle 9× throughput, increase partitions to 9 and replicas to 9. Partition count cannot be reduced after creation — plan ahead.

### api-gateway

Stateless — scale freely. Place an L4 load balancer (Nginx, HAProxy, AWS NLB) in front.

---

## 7.3 Planned Improvements by Priority

### 🔴 High Priority

**Fine-tuned ML model instead of pure GPT prompting**

Currently, Layer 3 sends a natural language prompt to OpenAI GPT-4 for each transaction. While flexible, this has two drawbacks: it's expensive (API cost per transaction) and slow (200–800ms). A fine-tuned model trained on labelled historical transaction data would be faster (50–100ms inference), cheaper, and more accurate for domain-specific patterns.

Suggested approach: Export Redis transaction history, label outcomes (SAFE/FRAUD/REVIEW), train a gradient boosting model (XGBoost/LightGBM), and deploy as a sidecar alongside the fraud-detection-service.

**TOTP / SMS OTP for high-value transactions**

Transactions above a configurable amount (e.g. ₹50,000) should require a second factor before Kafka publish. Integrate with TOTP (Google Authenticator) or an SMS OTP provider (Twilio, MSG91).

**Webhook notifications**

Beyond email, the system should support registered webhooks. When a fraud verdict is issued, fire an HTTP POST to any registered endpoint with the `FraudResult` payload. Useful for integration with third-party SIEM, ticketing systems, and custom fraud review dashboards.

---

### 🟡 Medium Priority

**REVIEW queue management UI**

Currently, `REVIEW` verdicts are surfaced in the frontend but require manual analyst action. Build a dedicated admin dashboard showing all REVIEW-status transactions, enriched with the AI's confidence breakdown and suggested next action (approve / block). Include case assignment, notes, and audit log.

**Razorpay webhook reconciliation**

When `paymentMode=RAZORPAY`, the system creates a Razorpay order but currently relies on polling for status. Razorpay webhooks should update the `PaymentRecord` in real time — reducing latency for Razorpay payment confirmation from seconds to milliseconds.

**Resilience4j circuit breakers**

Inter-service REST calls (fraud-service → bank-service, transaction-service → bank-service) currently fail fast on timeout. Add Circuit Breaker (Resilience4j) with fallback strategies:
- bank-service unavailable → cache last known UPI mapping for read operations
- OpenAI unavailable → Layer 3 falls back gracefully (currently AI_FALLBACK, could be smarter)

**Service discovery with Eureka**

Currently, service URLs are hardcoded environment variables (`AUTH_SERVICE_URL=http://auth-service:8083`). Spring Cloud Eureka would enable dynamic service registration and load-balanced routing without hardcoded URLs. Particularly useful when running multiple replicas.

---

### 🟢 Low Priority

**Audit log service**

For regulatory compliance (PCI-DSS, RBI guidelines for payment systems), every fraud verdict and payment action should be written to an immutable, append-only audit log. Implement as an event-sourced store (Kafka → Elasticsearch / ClickHouse) with no delete capabilities.

**A/B fraud rule testing (shadow mode)**

Allow new fraud rules to run in "shadow mode" — they evaluate transactions and log what they *would have* decided, without actually blocking anything. Compare shadow results against live verdicts to validate new rules before enabling them.

**Multi-currency support**

Currently assumes INR. Add a `currency` field to `TransactionEvent` and update fraud thresholds to be currency-aware. The bank-service would need to support currency conversion for cross-border transfers.

**GraphQL API**

The current REST API requires multiple round-trips for the frontend (separate calls for fraud result, payment status, user balance). A GraphQL endpoint at `/graphql` would let the frontend fetch all required data in a single query, reducing waterfall requests.

---

## 7.4 Load Testing Guide

Use Apache JMeter or k6 to load test the payment submission flow:

```javascript
// k6 script: load-test-payments.js
import http from 'k6/http';
import { sleep } from 'k6';

export let options = {
  vus: 50,           // 50 virtual users
  duration: '60s',   // 1 minute
};

export default function () {
  let token = "eyJhbGciOiJIUzI1NiJ9...";  // pre-generated JWT

  let payload = JSON.stringify({
    payeeUpiId: "testuser@upi",
    amount: Math.random() * 5000,
    device: "mobile",
    location: "chennai",
    merchantCategory: "grocery",
    paymentMode: "BANK"
  });

  http.post("http://localhost:3001/api/upi/pay", payload, {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });

  sleep(0.5);  // 2 rps per VU = 100 rps total
}
```

**Key metrics to watch during load test:**
- `docker stats` — CPU/memory per container
- Kafka UI → consumer group lag on `fraud-detection-group`
- Prometheus → JVM heap usage, GC frequency on fraud-detection-service
- Redis memory usage: `redis-cli info memory`

**Expected bottleneck:** At ~100 rps sustained, the OpenAI API will be the first limit hit (default rate limit: 500 RPM for GPT-4). Add a local cache for identical transaction patterns, or implement the ML model fallback.
