import apiClient from './axiosConfig';

/**
 * fraudApi — wraps fraud-detection-service endpoints
 *
 * GET  /api/fraud/result/{txId}   → FraudResult | 202 (pending)
 * GET  /api/fraud/history/{userId} → UserTransactionHistory
 * POST /api/fraud/analyze          → Direct analysis (test/debug)
 */

// ── Fraud result polling constants ────────────────────────────────────────────
// Kafka processing typically completes in 2–5 seconds; allow up to ~36s max.
const DEFAULT_FRAUD_POLL_ATTEMPTS = 12;
const DEFAULT_FRAUD_POLL_DELAY_MS = 3000;

/**
 * Get the fraud verdict for a transaction.
 * Returns 200 FraudResult when ready, 202 when still processing.
 *
 * FraudResult: { transactionId, userId, status, reason,
 *                confidenceScore, detectionLayer, reviewNotes, analyzedAt }
 * status: 'SAFE' | 'FRAUD' | 'REVIEW'
 * detectionLayer: 'RULE_BASED' | 'REDIS_HISTORY' | 'AI' | 'AI_FALLBACK'
 */
export const getFraudResult = async (transactionId) => {
  const response = await apiClient.get(`/api/fraud/result/${transactionId}`);
  // 202 Accepted returns the pending hint; 200 returns the FraudResult
  return { status: response.status, data: response.data };
};

/**
 * fetchFraudResultWithRetry — polls GET /api/fraud/result/{txId} until the
 * fraud pipeline completes and a real FraudResult is available (HTTP 200).
 *
 * Why this is necessary:
 *   Fraud detection is Kafka-async. After a transaction is submitted the
 *   fraud-detection-service processes it asynchronously. Until it finishes,
 *   GET /api/fraud/result/{txId} returns HTTP 202 (Accepted / PENDING).
 *   A single fetch would return null, leaving confidenceScore / detectionLayer
 *   / reason empty and the UI showing incomplete data.
 *
 * Behaviour:
 *   - Returns the raw FraudResult object on success (caller normalises it)
 *   - Returns null if max attempts reached (caller shows "delayed" message)
 *   - Returns null immediately if the AbortSignal fires (component unmounted)
 *   - Does NOT retry on 404 (transaction genuinely missing) — re-throws
 *   - Treats network / 5xx errors as transient and continues polling
 *
 * @param {string}      transactionId
 * @param {object}      [options]
 * @param {number}      [options.maxAttempts=12]   — total poll attempts
 * @param {number}      [options.delayMs=3000]     — ms between attempts
 * @param {AbortSignal} [options.signal]            — cancels polling on unmount
 * @returns {Promise<object|null>}  raw FraudResult | null
 */
export const fetchFraudResultWithRetry = async (
  transactionId,
  { maxAttempts = DEFAULT_FRAUD_POLL_ATTEMPTS, delayMs = DEFAULT_FRAUD_POLL_DELAY_MS, signal } = {},
) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Respect unmount / cancellation before every attempt
    if (signal?.aborted) return null;

    // Per-attempt delay: starts at the caller-provided default; may be overridden
    // by a `retryAfterSeconds` hint in the 202 response body (capped at 30 s).
    let retryDelay = delayMs;

    try {
      const { status, data } = await getFraudResult(transactionId);

      if (status === 200 && data) {
        // ✅ Real FraudResult received — stop polling and return it
        return data;
      }

      // HTTP 202 — Kafka pipeline still processing.
      // Backend may include { retryAfterSeconds: N } to tell us how long to wait.
      if (
        status === 202 &&
        typeof data?.retryAfterSeconds === 'number' &&
        data.retryAfterSeconds > 0
      ) {
        retryDelay = Math.min(data.retryAfterSeconds * 1000, 30_000);
      }
    } catch (err) {
      // Cancelled by the caller (component unmounted mid-poll) — exit cleanly
      if (err.name === 'AbortError' || err.name === 'CanceledError') return null;

      // 404 means the transaction ID doesn't exist at all — don't keep polling
      if (err.response?.status === 404) throw err;

      // Network errors, 5xx — treat as transient and keep polling
      // (fraud service may be briefly unavailable while processing)
    }

    // Wait before the next attempt, but cancel the sleep if signal fires
    if (attempt < maxAttempts) {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, retryDelay);
        // Honour AbortSignal during the sleep so unmount is instantaneous
        signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
      });
    }
  }

  // All attempts exhausted — fraud result not yet available
  return null;
};

/**
 * Get user transaction history from Redis cache (for fraud audit).
 * Returns UserTransactionHistory:
 * { userId, recentTransactions: [...], knownLocations: [...], knownDevices: [...] }
 */
export const getUserFraudHistory = async (userId) => {
  const { data } = await apiClient.get(`/api/fraud/history/${userId}`);
  return data;
};

/**
 * Delete a fraud result from Redis (use before resubmitting a REVIEW verdict).
 * Returns 204 No Content on success.
 */
export const deleteFraudResult = async (transactionId) => {
  await apiClient.delete(`/api/fraud/result/${transactionId}`);
};

/**
 * Direct synchronous fraud analysis — bypasses Kafka (testing/debug only).
 * @param {object} transactionEvent — full TransactionEvent body
 */
export const analyzeDirectly = async (transactionEvent) => {
  const { data } = await apiClient.post('/api/fraud/analyze', transactionEvent);
  return data;
};
