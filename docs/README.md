# Technical Documentation — SentinelPay

Complete reference documentation for the SentinelPay platform.

## Contents

| Document | Description |
|----------|-------------|
| [01 — System Design](./01-system-design.md) | High-level architecture, service interaction map, Kafka topology, network layout, distributed tracing |
| [02 — Component Breakdown](./02-component-breakdown.md) | Deep-dive into each microservice: API Gateway, Auth, Transaction, Fraud Detection, Bank, Notification, Frontend |
| [03 — Database Design](./03-database-design.md) | MySQL schema (users, bank_accounts, bank_transactions), Redis key schema, entity relationships, data ownership |
| [04 — API Documentation](./04-api-documentation.md) | All endpoints with request/response examples, auth flow, error format, frontend polling pattern |
| [05 — Kafka Event Flow](./05-kafka-event-flow.md) | Topics, producers, consumers, message schemas, Dead Letter Queue, end-to-end event timeline |
| [06 — Deployment Guide](./06-deployment-guide.md) | Docker Compose setup, environment variables reference, database init, production considerations |
| [07 — Scalability & Improvements](./07-scalability-and-improvements.md) | Performance characteristics, horizontal scaling strategy, planned features, load testing guide |

---

## Quick Reference

### Service ports

| Service | Port | Health endpoint |
|---------|------|----------------|
| Frontend (Nginx) | 3001 | `GET /` |
| API Gateway | 8085 | `GET /actuator/health` |
| Auth Service | 8083 | `GET /auth/health` |
| Transaction Service | 8081 | `GET /actuator/health` |
| Fraud Detection Service | 8082 | `GET /api/fraud/health` |
| Bank Service | 8084 | `GET /actuator/health` |
| Notification Service | 8086 | `GET /actuator/health` |
| Grafana | 3000 | — |
| Kafka UI | 8090 | — |
| Prometheus | 9090 | — |

### Key Kafka topics

| Topic | Purpose |
|-------|---------|
| `transactions` | Payment events (transaction-service → fraud-detection-service) |
| `notifications` | Fraud alerts (fraud-detection-service → notification-service) |
| `transactions.DLT` | Dead Letter Topic for failed processing |

### Fraud verdict meanings

| Verdict | Meaning | Action |
|---------|---------|--------|
| `SAFE` | Transaction is legitimate | Payment processed |
| `FRAUD` | Transaction is flagged | Payment blocked, email alert sent |
| `REVIEW` | Borderline confidence | Payment held, analyst review required |

### Detection layers

| Layer | Technology | Typical latency |
|-------|-----------|----------------|
| `RULE_BASED` | Java in-memory | < 1ms |
| `REDIS_HISTORY` | Redis time-series | 5–20ms |
| `AI` | OpenAI GPT-4 | 300–800ms |
| `AI_FALLBACK` | Default SAFE | < 1ms |
