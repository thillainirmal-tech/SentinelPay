# Deployment Guide — SentinelPay

## 6.1 Docker Compose (Development / Demo)

The recommended way to run the full system locally. Starts 13 containers with one command.

### Container inventory

| Container | Image | Port(s) | Role |
|-----------|-------|---------|------|
| `fraud-zookeeper` | `confluentinc/cp-zookeeper:7.5.0` | 2181 | Kafka coordination |
| `fraud-kafka` | `confluentinc/cp-kafka:7.5.0` | 9092, 29092 | Message broker |
| `fraud-redis` | `redis:7.2-alpine` | 6379 | Cache, rate limiting |
| `fraud-mysql` | `mysql:8.0` | 3307→3306 | Persistent database |
| `fraud-kafka-ui` | `provectuslabs/kafka-ui` | 8090 | Kafka inspection |
| `fraud-prometheus` | `prom/prometheus` | 9090 | Metrics scraping |
| `fraud-grafana` | `grafana/grafana` | 3000 | Dashboards |
| `fraud-bank-service` | Built | 8084 | Bank simulation |
| `fraud-auth-service` | Built | 8083 | Auth + JWT |
| `fraud-transaction-service` | Built | 8081 | Payment submission |
| `fraud-fraud-service` | Built | 8082 | Fraud detection |
| `fraud-notification-service` | Built | 8086 | Email alerts |
| `fraud-api-gateway` | Built | 8085 | Gateway |
| `sentinelpay-frontend` | Built | 3001 | React + Nginx |

### Startup sequence

Docker Compose `depends_on` with `condition: service_healthy` enforces this order:

```
1. MySQL, Zookeeper start (infrastructure base)
2. Kafka starts (waits for Zookeeper healthy)
3. Redis starts (independent)
4. bank-service starts (waits for MySQL healthy)
5. auth-service starts (waits for MySQL healthy + bank-service started)
6. transaction-service, fraud-detection-service start (wait for Kafka + Redis healthy)
7. notification-service starts (waits for Kafka healthy)
8. api-gateway starts (waits for all application services started)
9. frontend starts (waits for api-gateway started)
```

### Build and run

```bash
cd fraud-detection-system

# Full build and start (first run: 5-8 minutes)
docker-compose up -d --build

# View startup progress
docker-compose logs -f

# View all service health
docker-compose ps

# View specific service logs
docker-compose logs -f fraud-fraud-service

# Stop all (preserves data volumes)
docker-compose down

# Stop and wipe all data (fresh start)
docker-compose down -v
```

---

## 6.2 Environment Variables Reference

Copy `.env.example` to `.env` and configure:

### Required variables

| Variable | Example | Description |
|----------|---------|-------------|
| `MYSQL_ROOT_PASSWORD` | `strongPassword123` | MySQL root password |
| `MYSQL_USER` | `root` | MySQL user for services |
| `MYSQL_PASSWORD` | `strongPassword123` | MySQL user password |
| `JWT_SECRET` | 256-bit base64 string | Shared between auth-service and api-gateway. **Must be identical.** |
| `OPENAI_API_KEY` | `sk-proj-...` | Required for Layer 3 AI fraud detection |

### Optional variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_EXPIRATION_MS` | `86400000` | Token lifetime in ms (24h) |
| `RAZORPAY_ENABLED` | `false` | Enable real Razorpay payments |
| `RAZORPAY_KEY_ID` | — | Razorpay test/live key |
| `RAZORPAY_KEY_SECRET` | — | Razorpay secret |
| `EMAIL_USERNAME` | — | SMTP sender email (Gmail recommended) |
| `EMAIL_PASSWORD` | — | Gmail App Password |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:3001` | CORS allowed origins |

### Fraud tuning variables (no code changes required)

| Variable | Default | Description |
|----------|---------|-------------|
| `FRAUD_HIGH_AMOUNT_THRESHOLD` | `10000` | INR amount above which → FRAUD |
| `FRAUD_MAX_TX_PER_DAY` | `10` | Daily transaction limit → FRAUD |
| `FRAUD_IMPOSSIBLE_TRAVEL_MIN` | `5` | Minutes between cities → FRAUD |
| `FRAUD_REVIEW_CONF_MIN` | `0.4` | AI confidence above this → REVIEW |
| `FRAUD_REVIEW_CONF_MAX` | `0.6` | AI confidence above this → FRAUD |
| `FRAUD_RESULT_TTL_HOURS` | `72` | Hours before Redis clears results |
| `RATE_LIMIT_MAX_REQUESTS` | `5` | Max payment requests per window |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` | Rate limit window in seconds |

### Generating a JWT secret

```bash
# OpenSSL (Linux/Mac)
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 6.3 Database Initialisation

MySQL databases and tables are auto-created by Spring Boot's `spring.jpa.hibernate.ddl-auto=update` on first startup. The `init-mysql.sql` script (mounted to MySQL's init directory) creates the required databases:

```sql
-- init-mysql.sql
CREATE DATABASE IF NOT EXISTS auth_db;
CREATE DATABASE IF NOT EXISTS bank_db;
GRANT ALL PRIVILEGES ON auth_db.* TO 'root'@'%';
GRANT ALL PRIVILEGES ON bank_db.* TO 'root'@'%';
FLUSH PRIVILEGES;
```

On subsequent restarts, Hibernate uses `update` mode — existing data is preserved and schema changes are applied incrementally.

---

## 6.4 Production Considerations

> ⚠️ The current setup is optimised for local development and demos. The following changes are required before any production deployment.

### Security hardening

```yaml
# Replace wildcard CORS with specific domains
allowedOriginPatterns:
  - "https://app.yourdomain.com"
  - "https://yourdomain.com"

# Use HTTPS everywhere (TLS termination at load balancer)
# Never expose MySQL/Redis ports publicly
# Rotate JWT_SECRET — invalidates all existing tokens
# Use a secrets manager (AWS Secrets Manager, HashiCorp Vault) instead of .env files
```

### Kafka (3-broker cluster)

```yaml
KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 3
KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 3
KAFKA_DEFAULT_REPLICATION_FACTOR: 3
KAFKA_MIN_INSYNC_REPLICAS: 2
```

Change `transactions` topic to 6 partitions for higher throughput.

### MySQL

Replace the single MySQL container with:
- **AWS RDS** (managed, automated backups, multi-AZ)
- Or a MySQL cluster with read replicas for high-traffic scenarios

Enable `spring.jpa.hibernate.ddl-auto=validate` (never `update` or `create-drop` in production).

### Redis

Replace single Redis with:
- **Redis Cluster** (6 nodes: 3 primary, 3 replica) for high availability
- Or **AWS ElastiCache** (managed, automated failover)

### Reverse proxy / Load balancer

Replace the single Nginx container with:
- **AWS ALB** (Application Load Balancer) in front of multiple frontend replicas
- Or **Kubernetes Ingress** with cert-manager for TLS

### Monitoring

- Enable Prometheus alerting rules for: Kafka consumer lag > 1000, error rate > 1%, p99 latency > 2s
- Set up PagerDuty / Slack integration in Grafana for `COMPENSATION_FAILED` payment events
- Enable distributed tracing with Jaeger or Zipkin (add Spring Cloud Sleuth)

---

## 6.5 Kubernetes (Future)

A Kubernetes deployment would use:

```
├── helm/
│   ├── Chart.yaml
│   └── templates/
│       ├── api-gateway/       deployment.yaml, service.yaml, hpa.yaml
│       ├── auth-service/      deployment.yaml, service.yaml
│       ├── transaction-service/ deployment.yaml, service.yaml, hpa.yaml
│       ├── fraud-service/     deployment.yaml, service.yaml, hpa.yaml
│       ├── bank-service/      deployment.yaml, service.yaml
│       ├── notification-service/ deployment.yaml, service.yaml
│       ├── frontend/          deployment.yaml, service.yaml, ingress.yaml
│       └── configmaps/        application configs per service
```

Key Kubernetes features for this system:
- **HorizontalPodAutoscaler** on transaction-service and fraud-detection-service (CPU/Kafka lag metrics)
- **PodDisruptionBudget** to maintain at least 2 fraud-detection-service replicas during rolling updates
- **ConfigMaps** for fraud rule thresholds (hot-reload without pod restart)
- **Secrets** for JWT_SECRET, OPENAI_API_KEY, database credentials
- **Liveness/Readiness probes** using Spring Actuator `/actuator/health` endpoints
