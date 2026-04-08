# Kafka Event Flow — SentinelPay

## 5.1 Overview

Apache Kafka is the backbone of SentinelPay's async fraud detection pipeline. It decouples payment submission from fraud analysis, enabling the system to:

- Accept payments at high throughput without waiting for AI analysis
- Guarantee at-least-once delivery (no transaction is silently dropped)
- Recover from downstream service failures via Dead Letter Queue replay
- Scale fraud analysis independently of payment submission

---

## 5.2 Topics

| Topic | Partitions | Replication | Producer | Consumer |
|-------|-----------|-------------|---------|---------|
| `transactions` | 3 | 1 (dev) | transaction-service | fraud-detection-service |
| `notifications` | 1 | 1 (dev) | fraud-detection-service | notification-service |
| `transactions.DLT` | 1 | 1 (dev) | (auto — Kafka DLT) | (manual ops replay) |

> In production, replication factor should be 3 with `min.insync.replicas=2`.

---

## 5.3 Transaction Event Flow

### Producer: transaction-service

Kafka producer configuration:

```java
// KafkaProducerConfig.java
ProducerFactory<String, TransactionEvent>
  bootstrap.servers = KAFKA_BOOTSTRAP_SERVERS    // e.g. kafka:29092
  key.serializer   = StringSerializer
  value.serializer = JsonSerializer
  acks             = all                          // Wait for all in-sync replicas
  retries          = 3
```

Message key: `transactionEvent.getUserId()` (payer email)

Using user email as the partition key ensures all transactions from the same user always land on the same partition. This guarantees **ordering** for the Layer 2 behavioural analysis — the fraud service always sees a user's transactions in chronological order.

**Published when:** `POST /api/upi/pay` is accepted (rate limit passed, payee resolved).

**Message structure (`TransactionEvent`):**

```json
{
  "transactionId": "3f8a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "userId": "john@example.com",
  "payerUserId": "john@example.com",
  "payeeUpiId": "alice@upi",
  "payeeUserId": null,
  "amount": 500.00,
  "location": "chennai",
  "device": "mobile",
  "merchantCategory": "grocery",
  "paymentMode": "BANK",
  "timestamp": "2025-04-08 14:23:01",
  "traceId": "9f1e3d2c-..."
}
```

---

### Consumer: fraud-detection-service

Kafka consumer configuration:

```java
// KafkaConsumerConfig.java
ConsumerFactory<String, TransactionEvent>
  bootstrap.servers  = KAFKA_BOOTSTRAP_SERVERS
  group.id           = "fraud-detection-group"
  auto.offset.reset  = earliest          // Process all messages, even if consumer was down
  key.deserializer   = StringDeserializer
  value.deserializer = JsonDeserializer
  trusted.packages   = "com.fraud.common.dto"
```

**Consumer class: `TransactionConsumer`**

```java
@KafkaListener(topics = "${kafka.topic.transactions}", groupId = "fraud-detection-group")
public void consume(TransactionEvent event) {
    // 1. Set traceId in MDC for logging correlation
    MDC.put("traceId", event.getTraceId());

    // 2. Run 3-layer fraud pipeline
    FraudResult result = fraudDetectionService.analyzeTransaction(event);

    // 3. Store result in Redis (TTL: 72h)
    redisService.storeFraudResult(event.getTransactionId(), result);

    // 4. If SAFE → process payment (debit payer, credit payee)
    if (result.getStatus() == SAFE) {
        paymentProcessorService.processPayment(event, result);
    }

    // 5. If FRAUD → publish notification event
    if (result.getStatus() == FRAUD) {
        notificationProducer.publishFraudAlert(event, result);
    }
}
```

**Error handling:** If the consumer throws an uncaught exception, the message is sent to `transactions.DLT` after the configured retry attempts. An ops team can inspect and replay DLT messages once the root cause is fixed.

---

## 5.4 Notification Event Flow

### Producer: fraud-detection-service

**Published when:** Fraud analysis returns `status = FRAUD`.

**Message structure (`NotificationEvent`):**

```json
{
  "userId": "john@example.com",
  "transactionId": "3f8a2b1c-...",
  "amount": 25000.00,
  "reason": "Transaction amount 25000 INR exceeds high-risk threshold of 10000 INR",
  "status": "FRAUD",
  "confidenceScore": 0.95,
  "detectionLayer": "RULE_BASED",
  "timestamp": "2025-04-08 14:23:02"
}
```

---

### Consumer: notification-service

```java
@KafkaListener(topics = "${kafka.topic.notifications}", groupId = "notification-group")
public void handleNotification(NotificationEvent event) {
    String htmlEmail = emailTemplateBuilder.build(event);
    emailService.sendFraudAlert(event.getUserId(), htmlEmail);
}
```

Email subject: `⚠️ Fraud Alert — Suspicious Transaction Detected`

Email content includes: transaction ID, amount, fraud reason, confidence score, detection layer, timestamp, and a direct link to the Fraud Alerts page.

---

## 5.5 Dead Letter Queue

The `transactions.DLT` topic captures messages that fail all retry attempts.

**Common causes:**
- Redis connection failure (fraud result cannot be stored)
- OpenAI API timeout (Layer 3 fails and fallback also fails)
- Bank service unavailable (payment processing fails)

**Replay procedure:**

```bash
# List DLT messages
docker-compose exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic transactions.DLT \
  --from-beginning

# Replay DLT to original topic (after fixing the root cause)
docker-compose exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic transactions.DLT \
  --from-beginning | \
docker-compose exec -T kafka kafka-console-producer \
  --bootstrap-server localhost:9092 \
  --topic transactions
```

---

## 5.6 Kafka UI Monitoring

Access Kafka UI at `http://localhost:8090` to:

- View all topics and their partition/offset state
- Inspect individual messages in `transactions`, `notifications`, `transactions.DLT`
- Monitor consumer group lag (`fraud-detection-group`, `notification-group`)
- Manually produce test messages for development

**Consumer lag** is the key metric — high lag on `fraud-detection-group` means the fraud service is falling behind and fraud verdicts will be delayed. Consider increasing partitions and consumer replicas to scale.

---

## 5.7 End-to-End Message Lifecycle

```
Time 0ms:   POST /api/upi/pay received by transaction-service
Time 2ms:   TransactionEvent published to Kafka "transactions" (key=userEmail)
Time 3ms:   transaction-service returns 202 { transactionId, status: PENDING }
            (User sees "Payment submitted. Checking for fraud...")

Time 50ms:  Kafka delivers message to fraud-detection-service consumer
Time 51ms:  Layer 1 rule engine runs (< 1ms)
Time 55ms:  Layer 2 Redis history analysis (5ms Redis lookup)
Time 300ms: Layer 3 OpenAI GPT analysis (200-800ms)
Time 350ms: FraudResult stored in Redis

Time 3000ms: Frontend polls GET /api/fraud/result/{id} → 200 OK
             User sees fraud verdict (SAFE / REVIEW / FRAUD)
```

For FRAUD verdicts caught by Layer 1 (rule engine), the entire pipeline completes in < 100ms. The frontend's first poll (at 3 seconds) will always find the result ready.
