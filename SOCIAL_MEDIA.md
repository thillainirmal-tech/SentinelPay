# SentinelPay — GitHub Social Media & Branding Kit

---

## 1. Repository Short Description (≤160 chars)

```
Real-time UPI fraud detection platform: Spring Boot microservices + Kafka + OpenAI GPT + React. 3-layer ML pipeline. Dockerized. Production-grade.
```

---

## 2. SEO-Friendly Tagline

```
AI-Powered Real-Time Fraud Detection for UPI Payments — Built with Event-Driven Microservices
```

---

## 3. GitHub Topics (Add All 15)

```
microservices  spring-boot  kafka  fraud-detection  react  docker
spring-cloud-gateway  openai  redis  mysql  event-driven  upi-payment
jwt-authentication  prometheus  grafana
```

> Go to your repo → **⚙ Settings** → **Topics** → paste each word

---

## 4. GitHub "About" Section

**Description:**
```
AI-powered UPI payment fraud detection system built with Spring Boot microservices, Apache Kafka, OpenAI GPT, and React. Features a 3-layer fraud pipeline (Rules → Behavioural Analysis → AI), real-time async polling, JWT auth, and full Docker orchestration.
```

**Website:** *(your portfolio URL or demo link)*

**Topics:** *(as listed above)*

---

## 5. Banner / Social Preview Image Concept

**Recommended tool:** Figma, Canva, or Carbon.now.sh

**Design brief:**

```
┌──────────────────────────────────────────────────────────────────┐
│  Background: Dark gradient (#0F172A → #1E293B)                   │
│                                                                  │
│  Top-left: Shield icon (green) + "SentinelPay" (white, bold)    │
│  Subtitle: "AI-Powered Fraud Detection Platform"                 │
│                                                                  │
│  Center: Three pill badges in a row:                            │
│   [⚡ Kafka]  [🤖 OpenAI GPT]  [☁ Spring Boot]                  │
│                                                                  │
│  Bottom row of tech logos:                                       │
│   React  •  MySQL  •  Redis  •  Docker  •  Prometheus            │
│                                                                  │
│  Bottom-right: Subtle circuit/network pattern overlay            │
│  Dimensions: 1280 × 640 px                                      │
└──────────────────────────────────────────────────────────────────┘
```

**Color palette:**
- Background: `#0F172A` / `#1E293B`
- Accent green: `#22C55E`
- Accent blue: `#3B82F6`
- Text: `#F1F5F9`

---

## 6. LinkedIn Post

```
🚀 Excited to share SentinelPay — a production-grade, AI-powered fraud detection
platform I built from scratch for UPI payments.

𝗪𝗵𝗮𝘁 𝗶𝘁 𝗱𝗼𝗲𝘀:
Analyses every UPI transaction through a 3-layer fraud pipeline before money moves:
→ Layer 1: Rule Engine (velocity, amount thresholds, unknown locations)
→ Layer 2: Behavioural Analysis via Redis (impossible travel, device changes)
→ Layer 3: OpenAI GPT with confidence scoring (SAFE / REVIEW / FRAUD)

𝗧𝗲𝗰𝗵 𝘀𝘁𝗮𝗰𝗸:
• Backend: Spring Boot · Spring Cloud Gateway · Apache Kafka · Redis · MySQL
• AI: Spring AI + OpenAI GPT-4
• Payments: Razorpay integration + internal bank simulation
• Frontend: React + Material UI with real-time async fraud polling
• DevOps: Docker Compose · Prometheus · Grafana · Kafka UI
• Security: JWT + distributed tracing (X-Trace-Id) across all 6 microservices

𝗞𝗲𝘆 𝗲𝗻𝗴𝗶𝗻𝗲𝗲𝗿𝗶𝗻𝗴 𝗱𝗲𝗰𝗶𝘀𝗶𝗼𝗻𝘀:
✅ Kafka async processing — fraud analysis never blocks payment submission
✅ HTTP 202 polling with dynamic retryAfterSeconds — no busy-wait
✅ Dead Letter Queue for failed events — zero message loss
✅ Configurable fraud thresholds via environment variables — no redeploys needed
✅ AbortController + isMountedRef — production-safe React async patterns

The entire system runs with a single `docker-compose up` command.

🔗 GitHub: https://github.com/thillainirmal-tech/SentinelPay

#SpringBoot #Kafka #Microservices #FraudDetection #OpenAI #React #Docker
#Java #FinTech #SoftwareEngineering #BackendDevelopment
```

---

## 7. Twitter / X Post

```
🛡️ Built SentinelPay — an AI fraud detection system for UPI payments

3-layer pipeline:
→ Rule engine (< 1ms)
→ Redis behavioural history
→ OpenAI GPT confidence scoring

Stack: Spring Boot · Kafka · React · Redis · Docker

Ships with Prometheus + Grafana monitoring out of the box 📊

🔗 github.com/thillainirmal-tech/SentinelPay

#OpenSource #SpringBoot #Kafka #FinTech #AI
```

---

## 8. Portfolio / Resume Description

**Project Title:** SentinelPay — AI-Powered UPI Fraud Detection Platform

**One-liner:**
> Production-grade, event-driven microservices system that detects UPI payment fraud in real time using a 3-layer pipeline: deterministic rules, Redis behavioural history, and OpenAI GPT.

**Bullet points (for resume):**

- Architected a **6-service Spring Boot microservices system** with Spring Cloud Gateway, JWT authentication, and distributed tracing via `X-Trace-Id` propagated across all services and Kafka messages
- Designed a **3-layer fraud detection pipeline** combining a rule engine (< 1ms), Redis-based transaction history analysis (impossible travel, device fingerprinting), and OpenAI GPT for contextual AI scoring — producing SAFE / REVIEW / FRAUD verdicts with confidence scores
- Implemented **Kafka async event flow** with a Dead Letter Queue, ensuring zero message loss; frontend uses HTTP 202 polling with dynamic `retryAfterSeconds` hints to avoid busy-wait
- Built a **React frontend** with production-grade patterns: AbortController cancellation, isMountedRef unmount safety, DOMPurify XSS sanitisation, and SSE with polling fallback for live fraud alerts
- Integrated **Razorpay payment gateway** alongside an internal bank simulation, with a compensation (rollback) flow for failed post-fraud payments
- Full **Docker Compose orchestration** with health-checked dependencies; includes Prometheus metrics scraping, Grafana dashboards, and Kafka UI for observability
- Implemented **configurable fraud thresholds** (amount limit, transaction velocity, travel time) via environment variables — no code changes or redeploys needed to tune the system

**Tech stack line:**
> Java 17 · Spring Boot 3 · Spring Cloud Gateway · Apache Kafka · Redis · MySQL 8 · OpenAI API · React 18 · Material UI · Docker · Prometheus · Grafana
