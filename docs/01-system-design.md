# System Design — SentinelPay

## 1.1 High-Level Architecture

SentinelPay follows a **microservices architecture** with event-driven communication via Apache Kafka. The system is designed around three core principles:

**Async by default** — Payment submission and fraud analysis are decoupled. A user submits a payment and immediately gets a transaction ID. Fraud analysis happens asynchronously; the frontend polls for the result. This means the system can handle high throughput without sacrificing fraud analysis depth.

**Short-circuit layered analysis** — The 3-layer fraud pipeline runs the cheapest check first. If Layer 1 (rule engine) catches fraud, the system returns immediately without touching Redis or OpenAI. This keeps average latency low while AI handles only borderline cases.

**Identity-from-JWT always** — The API Gateway extracts user identity from the JWT and injects it as `X-User-Email`. No downstream service trusts any `userId` field in a request body. This eliminates an entire class of identity spoofing attacks.

---

## 1.2 Service Interaction Map

```
                    ┌─────────────────────────────┐
                    │        React Frontend         │
                    │    (Nginx Reverse Proxy)      │
                    └──────────────┬───────────────┘
                                   │ HTTPS/HTTP
                    ┌──────────────▼───────────────┐
                    │          API Gateway          │ ← JWT validation
                    │    Spring Cloud Gateway        │ ← Route matching
                    │         Port: 8085             │ ← X-User-Email inject
                    └───┬──────┬──────┬──────┬──────┘
                        │      │      │      │
          /auth/**       │      │      │      │  /api/upi/**
    ┌─────▼──────┐       │      │      │   ┌──▼──────────────┐
    │ auth-svc   │       │      │      │   │ transaction-svc  │
    │  Port 8083 │       │      │      │   │   Port 8081      │
    │  MySQL     │       │      │      │   │   Kafka Producer │
    └─────┬──────┘       │      │      │   └──────┬──────────┘
          │ (register)   │      │      │          │
    ┌─────▼──────┐       │      │  /bank/**   ┌───▼────────────────┐
    │ bank-svc   │◄──────┘      │   ┌─────────│   Apache Kafka     │
    │  Port 8084 │◄─────────────┼───┤         │  "transactions"    │
    │  MySQL     │              │   │         └───────────┬────────┘
    └────────────┘              │   │                     │
                                │   │         ┌───────────▼────────┐
                         /api/fraud/**         │  fraud-detect-svc  │
                    ┌─────────────────┐        │    Port 8082        │
                    │                 │        │    Redis + OpenAI   │
                    │   fraud-svc     │◄───────┤    3-Layer Pipeline │
                    │   (polling)     │        └───────────┬────────┘
                    └─────────────────┘                    │
                                                 ┌─────────▼────────┐
                                                 │    Kafka           │
                                                 │  "notifications"  │
                                                 └─────────┬────────┘
                                                           │
                                                 ┌─────────▼────────┐
                                                 │ notification-svc  │
                                                 │   Port 8086       │
                                                 │   SMTP Email      │
                                                 └──────────────────┘
```

---

## 1.3 Kafka Topic Architecture

```
Producer                    Topic                   Consumer
─────────                   ─────                   ────────
transaction-svc  ──────►  transactions          ►  fraud-detect-svc
                           (3 partitions)
                           (DLT: transactions.DLT)

fraud-detect-svc ──────►  notifications         ►  notification-svc
                           (1 partition)

                     Dead Letter Topics
transaction-svc  ──────►  transactions.DLT      ►  (manual ops replay)
```

**Partition strategy:** The `transactions` topic uses 3 partitions. Messages are keyed by `userId` so all transactions for the same user land on the same partition, preserving ordering for the behavioural analysis layer.

**Delivery guarantees:** `acks=all` on the producer, `earliest` offset reset on the consumer. With the Dead Letter Queue, no transaction event is silently dropped.

---

## 1.4 Network Architecture (Docker)

```
Host Machine
├── localhost:3001  ─►  sentinelpay-frontend (Nginx)
│                          └── /auth/*  ─►  fraud-api-gateway:8085
│                          └── /bank/*  ─►  fraud-api-gateway:8085
│                          └── /api/*   ─►  fraud-api-gateway:8085
│
├── localhost:8085  ─►  fraud-api-gateway   (direct, for debugging)
├── localhost:3000  ─►  grafana
├── localhost:9090  ─►  prometheus
└── localhost:8090  ─►  kafka-ui

Internal Docker network (fraud-network):
  Services communicate by container name
  e.g. fraud-detection-service → http://bank-service:8084/bank/balance
  Browser NEVER resolves Docker hostnames
```

The Nginx reverse proxy pattern is the key insight: the React bundle is built with `REACT_APP_API_BASE_URL=http://localhost:3001` (same origin). Nginx receives all API calls and proxies them internally over Docker's `fraud-network`. The browser never makes cross-origin requests, so no CORS is needed for API responses.

---

## 1.5 Distributed Tracing

Every request generates an `X-Trace-Id` (UUID v4) at the API Gateway. This ID is:

- Forwarded to all downstream services via HTTP header
- Embedded in every Kafka message (`TransactionEvent.traceId`)
- Added to SLF4J MDC in each service so every log line includes `[traceId=...]`

This enables complete end-to-end tracing of any transaction across 6 services and 2 Kafka topics using a single grep:

```bash
docker-compose logs | grep "traceId=3f8a2b1c-..."
```
