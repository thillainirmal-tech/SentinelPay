# Payment lifecycle design

Status: accepted design baseline; implementation remains incremental and must preserve the existing debit, credit, and compensation APIs until a separately reviewed migration is complete.

This design incorporates the payment-switch analysis contributed by [@Rahul1123-lang in issue #25](https://github.com/thillainirmal-tech/SentinelPay/issues/25). It turns that proposal into a compact architecture contract for implementation and review.

## Scope

The first lifecycle supports authorization holds, full capture, full authorization reversal, authorization expiry, settlement, partial or full refunds, idempotent commands, optimistic locking, and reconciliation of unknown downstream outcomes.

Partial capture, multiple captures against one authorization, and partial authorization reversal are intentionally deferred.

## Separate state dimensions

A payment must not use one overloaded status field. Persist the lifecycle dimensions independently:

| Dimension | States |
|---|---|
| Authorization | `PENDING`, `AUTHORIZED`, `DECLINED`, `REVERSED`, `EXPIRED`, `UNKNOWN` |
| Capture | `PENDING`, `CAPTURED`, `FAILED`, `UNKNOWN` |
| Settlement | `PENDING`, `SETTLED`, `FAILED`, `UNKNOWN` |
| Refund | `PENDING`, `SUCCEEDED`, `FAILED`, `UNKNOWN` |
| Operation | `PROCESSING`, `SUCCEEDED`, `FAILED`, `UNKNOWN` |

`UNKNOWN` is non-terminal. It records that an external request may have succeeded even though SentinelPay did not receive a definitive response. It must enter reconciliation and must never trigger an unconditional retry.

## Financial invariants

1. Authorization creates an identifiable hold. It reduces available balance without posting a debit.
2. Capture consumes an active hold and posts exactly one debit.
3. Reversal or expiry releases an active, uncaptured hold exactly once. Neither operation creates a generic credit.
4. Settlement is independent from capture. A captured payment may remain unsettled.
5. Refund is allowed only after settlement and creates a separate credit entry.
6. Cumulative successful refunds must never exceed the settled captured amount.
7. Ledger entries are immutable and remain the financial source of truth.
8. Every accepted financial command and its ledger mutation commit atomically.
9. Rejected transitions produce no financial ledger entry.
10. Money is stored in integer minor units, never floating-point values.

## Transition contract

| Current condition | Command | Result | Required financial effect |
|---|---|---|---|
| New payment, sufficient funds | Authorize | `AUTHORIZED` | Create one active hold |
| New payment, definitive rejection | Authorize | `DECLINED` | No hold or debit |
| Active authorization | Capture | `CAPTURED` | Consume hold and post one debit |
| Active authorization | Reverse | `REVERSED` | Release hold once |
| Active authorization past expiry | Expire | `EXPIRED` | Release hold once |
| Captured payment | Settle | `SETTLED` | Record settlement accounting |
| Settled payment | Refund | Refund `SUCCEEDED` | Post a separate credit |
| Reversed or expired authorization | Capture | Rejected | No mutation |
| Captured or settled payment | Reverse | Rejected | No mutation |
| Unsettled payment | Refund | Rejected | No mutation |

A replay with the same idempotency key and request returns the stored result. Reusing the key with a different request is a conflict. A duplicate command must never repeat its financial effect.

## Persistence and concurrency

The implementation should introduce explicit `authorization`, `authorization_hold`, `capture`, `refund`, `payment_operation`, `external_attempt`, `settlement_batch`, `settlement_batch_item`, and `reconciliation_case` records while continuing to use immutable ledger entries.

Database constraints are the final duplicate-effect guard:

- unique idempotency scope: merchant, operation type, and idempotency key;
- at most one successful capture per payment under the full-capture model;
- unique hold-release operation;
- unique ledger operation reference;
- unique provider reference where available;
- unique settlement item per captured transaction.

Use version columns on payment, authorization, hold, wallet balance, and the refund aggregate. After an optimistic-lock conflict, reload and revalidate the transition. Never bypass lifecycle guards merely to retry.

Concurrent capture and reversal must serialize to one valid financial outcome. Concurrent refunds must serialize against the remaining refundable amount.

## External calls and reconciliation

External network calls cannot participate in the local database transaction. Persist an operation and external-attempt record before dispatch, and publish asynchronous work through a transactional outbox.

When a timeout leaves the result uncertain:

1. mark the operation `UNKNOWN`;
2. persist the provider correlation data;
3. create or update a reconciliation case;
4. resolve by inquiry, callback, settlement data, or an explicitly safe provider retry;
5. make reconciliation itself idempotent and auditable.

Settlement batches may partially succeed. Each item therefore owns an independent state, and successful items must not be submitted again when failed or unknown items are retried.

## Compatibility boundary

The existing `DEBIT`, `CREDIT`, and compensation `REFUND` behavior remains supported during migration. Authorization reversal must not map to generic `CREDIT` or the existing compensation refund. Before implementation, define how legacy transactions map to the new lifecycle and prevent both models from mutating the same financial operation.

## Verification gate

Use MySQL 8 Testcontainers and deterministic adapters. The minimum acceptance suite must prove:

- replayed and concurrent commands create one financial effect;
- authorization changes available balance but not posted balance;
- capture consumes the hold and posts one debit;
- reversal and expiry release a hold once;
- capture and reversal cannot both win;
- refund before settlement is rejected;
- cumulative and concurrent refunds cannot exceed the captured amount;
- timeouts enter `UNKNOWN` without blind retries;
- repeated reconciliation is safe;
- ledger entries remain immutable and balances reconcile to ledger plus active holds.

No production implementation begins until the transition contract, idempotency scope, persistence constraints, and legacy compatibility plan are approved in review.
