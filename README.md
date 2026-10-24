<div align="center">

<img src="https://img.shields.io/badge/SentinelPay-AI%20Fraud%20Detection-22C55E?style=for-the-badge&logo=shield&logoColor=white" alt="SentinelPay"/>

# 🛡️ SentinelPay

### AI-Powered Real-Time Fraud Detection for UPI Payments

*Event-Driven Microservices · Apache Kafka · Spring AI · Spring Boot · React · Docker*

---

[![Java](https://img.shields.io/badge/Java-17-ED8B00?style=flat-square&logo=openjdk&logoColor=white)](https://openjdk.org/projects/jdk/17/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-6DB33F?style=flat-square&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Apache Kafka](https://img.shields.io/badge/Apache%20Kafka-7.5-231F20?style=flat-square&logo=apachekafka&logoColor=white)](https://kafka.apache.org/)
[![Redis](https://img.shields.io/badge/Redis-7.2-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=flat-square&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)](LICENSE)

<p align="center">
<a href="https://sentinelpay.thillainirmal-tech.dev/#/login">🌐 Live Demo</a> •
<a href="https://ijracse.org/index.php/cse/article/view/2477">📄 Journal Publication</a> •
<a href="#-docker-setup">🐳 Run Locally</a>
</p>

</div>

---

## 📄 International Journal Publication

**SentinelPay: A Hybrid AI-Driven System for Real-Time Fraud Detection in Digital Payment Systems**  
Published in **International Journal for Research in Advanced Computer Science and Engineering (IJRACSE)**  
**Volume 12 • Issue 1 • May 2026**

This project has been officially validated and published as an international research article for its hybrid AI-assisted digital payment fraud detection architecture.

---

## 🚀 Overview

**SentinelPay** is a production-grade event-driven fintech fraud prevention platform that analyses every UPI payment transaction through a **3-stage intelligent fraud verdict engine before transaction authorization**.

The platform combines:

- deterministic rule evaluation,
- Redis-backed behavioural anomaly tracking,
- Spring AI contextual reasoning,
- Kafka asynchronous event orchestration,
- and real-time user notification workflows

to deliver a scalable fraud detection ecosystem built for modern digital payments.

<img width="3787" height="2744" alt="overview-architecture" src="https://github.com/user-attachments/assets/137722fe-91e1-41d4-89d7-7650f8e815e9" />

---

## 📊 Published Benchmark Results

| Metric | Performance |
|--------|-------------|
| Detection Accuracy | **95.2%** |
| Precision | **93.8%** |
| Recall | **94.6%** |
| F1 Score | **94.2%** |
| Average Processing Latency | **~50 ms** |
| Throughput | **1200 TPS** |

These measured results were obtained from a 50,000 transaction fraud simulation benchmark with real-time event-driven orchestration.

---

## 🧠 Why SentinelPay Matters

UPI fraud and digital payment anomalies continue to grow rapidly while most traditional systems still rely on:

- post-payment fraud checks,
- brittle static thresholds,
- delayed manual intervention.

SentinelPay solves this by ensuring:

✅ fraud analysis before money moves  
✅ millisecond-level verdict generation  
✅ scalable asynchronous transaction processing  
✅ AI-assisted contextual anomaly identification  
✅ full observability with production monitoring

---

## ⚡ 3-Layer Fraud Detection Pipeline

| Layer | Engine | Speed | Fraud Coverage |
|-------|--------|-------|----------------|
| Layer 1 | Rule Engine | <1 ms | amount spikes, location mismatch, transaction velocity |
| Layer 2 | Redis Behavioural Engine | <5 ms | impossible travel, device switching, repeated suspicious patterns |
| Layer 3 | Spring AI Contextual Analysis | adaptive | unseen anomalies, semantic behavioural irregularities |

Each fraud layer short-circuits on a `FRAUD` verdict to minimize latency while preserving high-confidence AI analysis for borderline transactions.

---

## 🏗️ Distributed Microservice Architecture

<img width="2162" height="4520" alt="microservice-architecture" src="https://github.com/user-attachments/assets/4ae901d0-1fa5-40fa-8d3c-c6c297f6d9e3" />

### Core Services

- **API Gateway** → centralized JWT validation and request routing
- **Auth Service** → user registration, login, token issuance
- **Transaction Service** → UPI payment intake and Kafka event publishing
- **Fraud Detection Service** → hybrid fraud scoring engine
- **Bank Service** → account balance management and UPI simulation
- **Notification Service** → asynchronous fraud alert dispatch
- **React Frontend** → customer-facing dashboard

Kafka acts as the event backbone while Redis enables sub-millisecond behavioural profile access.

---

## ⚙️ Engineering Stack

### Backend
`Java 17` `Spring Boot 3` `Spring Security` `Spring Cloud Gateway` `Spring AI` `Apache Kafka` `Redis` `MySQL`

### Frontend
`React 18` `Material UI` `Axios` `Recharts`

### DevOps / Monitoring
`Docker` `Docker Compose` `Prometheus` `Grafana` `Nginx`

---

## 🔄 End-to-End Payment Lifecycle

<img width="8684" height="1632" alt="payment-lifecycle" src="https://github.com/user-attachments/assets/d8131bcb-1ec2-4047-b2d8-f16686df3529" />

---

## 📸 Platform Screenshots

| Login & Registration | User Dashboard |
|----------------------|----------------|
| <img width="450" src="https://github.com/user-attachments/assets/aa2a1a0d-9b11-41eb-b4c9-61e64ba835c4" /> | <img width="450" src="https://github.com/user-attachments/assets/69a4a152-d94f-4019-af3e-9cfc1cfbafea" /> |

| Payment Submission | Fraud Verdict |
|--------------------|--------------|
| <img width="450" src="https://github.com/user-attachments/assets/cc53aa0d-9267-426a-b88d-ae9d01254aaf" /> | <img width="450" src="https://github.com/user-attachments/assets/79752bb6-536f-413b-b0be-1b97fba8a3b3" /> |

| Analytics Dashboard | Grafana Monitoring |
|---------------------|-------------------|
| <img width="450" src="https://github.com/user-attachments/assets/de7f9592-6dd6-411e-ab12-f16eee784843" /> | <img width="450" src="https://github.com/user-attachments/assets/c326c8f8-6f4b-4876-828a-ecbcb28afd00" /> |

---

<details>
<summary>🧪 Key REST API Endpoints</summary>

### Auth Service
- POST `/auth/register`
- POST `/auth/login`

### Transaction Service
- POST `/api/upi/pay`
- GET `/api/transactions/{id}`

### Fraud Detection Service
- GET `/api/fraud/result/{txId}`
- GET `/api/fraud/payment/{txId}`

### Bank Service
- GET `/bank/balance`
- GET `/bank/account/by-upi/{upiId}`

</details>

## 🐳 Docker Setup

```bash
git clone https://github.com/thillainirmal-tech/SentinelPay.git
cd SentinelPay
cp .env.example .env
docker compose up -d --build
```

Review the generated `.env` before starting the stack and never commit real credentials.

## 🤝 Contribution Guide

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Follow code style**: Java code uses the existing package structure; React code follows the existing hook/context patterns
4. **Test your changes**: Ensure existing API contracts are preserved
5. **Commit with clear messages**: `feat: add impossible travel detection for IPv6`
6. **Open a Pull Request** with a description of what changed and why

### Areas open for contribution

- Additional fraud detection rules (Layer 1)
- Grafana dashboard templates
- Unit and integration tests
- Documentation improvements
- Frontend UI enhancements

---

## 📜 License

This project is licensed under the **Apache License 2.0** — see the [LICENSE](LICENSE) file for details.

```
Copyright 2026 Thillai Nirmal K

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```

---

<div align="center">

**Built with ❤️ by [Thillai Nirmal K](https://github.com/thillainirmal-tech)**

*If this project helped you, please consider giving it a ⭐*

</div>
