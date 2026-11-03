# Engineering evidence and verification

Use this guide to inspect the implementation and distinguish existing mechanisms from guarantees that still need executable evidence.

## Review the payment design

| Question | Evidence to inspect | Verification still needed |
|---|---|---|
| Where do balances change? | [BankService](../bank-service/src/main/java/com/fraud/bank/service/BankService.java) implements debit, credit, and refund inside Spring transactions. | Integration tests for success, insufficient funds, replay, and rollback. |
| How are concurrent writes coordinated? | [BankAccountRepository](../bank-service/src/main/java/com/fraud/bank/repository/BankAccountRepository.java) exposes the locking lookup used by the service. | Concurrent requests against the actual MySQL database, with persisted balance and ledger assertions. |
| What identifies a repeated operation? | [BankTransaction](../bank-service/src/main/java/com/fraud/bank/entity/BankTransaction.java) defines the ledger and transaction/type uniqueness boundary. | Separate DEBIT and REFUND replay cases, plus concurrent duplicate requests. |
| Which modules are built? | The root [Maven reactor](../pom.xml) lists the shared DTO and six backend services. | End-to-end payment and failure-path tests across services. |
| What does CI execute? | [Build and test workflow](../.github/workflows/ci.yml) runs Maven verification on Java 17. | Backend test classes and a frontend CI job. A green Maven build alone does not demonstrate payment correctness. |

The bank service uses the MySQL JDBC driver and the [Compose stack](../docker-compose.yml) uses `mysql:8.0`. Database integration tests should use that engine; substituting PostgreSQL or an in-memory database would not validate the same locking and constraint behavior.

## Verify a checkout

Record the commit being evaluated:

```bash
git rev-parse HEAD
mvn --batch-mode --no-transfer-progress verify
```

Run the existing frontend tests and build separately from the backend:

```bash
cd sentinelpay-frontend
npm ci
npm test -- --watchAll=false --runInBand
npm run build
```

The frontend already contains tests under `src/__tests__`; the current GitHub Actions workflow does not run them. There are currently no backend `src/test` suites in this checkout. Record test counts and failures alongside command output instead of treating a successful build as proof of test coverage.

For a local stack, follow the [deployment guide](06-deployment-guide.md), review `.env.example`, and supply private local values without committing them. Stack startup, model-provider access, email delivery, and deployment availability are separate checks from compilation. Use synthetic accounts and transactions for evaluation.

## Payment regression work

[Issue #18](https://github.com/thillainirmal-tech/SentinelPay/issues/18) tracks replay idempotency and concurrent debit coverage. A useful suite should:

- Start a MySQL 8.0 test container and isolate test data between cases.
- Use a start barrier and bounded executor/future timeouts for concurrent requests, without timing sleeps.
- Assert outcomes, final balances, ledger row counts, and ledger totals after transactions commit.
- Test DEBIT and REFUND replay independently, including the transaction/type uniqueness boundary.
- Provision Redis only when testing the fraud/payment-record flow that uses it.
- Document the exact command and Docker requirement, and run repeatedly in CI.

Those criteria describe planned validation, not tests already implemented. Co-author attribution should reflect only contributor code or test design actually incorporated.

## Benchmark evidence

The README's accuracy and throughput figures are reported project results. The checked-in source does not include the full dataset, executable benchmark harness, or raw outputs needed to reproduce them. The [scalability guide](07-scalability-and-improvements.md) contains estimates and an illustrative load-test sketch; neither is a reproducible benchmark result.

To make a result independently reviewable, publish a synthetic or appropriately licensed dataset with labels, a fixed seed, the exact commit and configuration, hardware and dependency versions, workload definition, and raw outputs. Separate payment submission latency from completed fraud verdict latency; include percentile latency, error rates, and whether external AI calls are included. Report classification metrics with the evaluation split and confusion matrix.

Until those artifacts exist, the reported numbers should not be treated as verified performance of a fresh checkout or proof of production readiness.
