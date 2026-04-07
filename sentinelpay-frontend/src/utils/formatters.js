/**
 * formatters.js — shared display utility functions
 */

/**
 * Format a number as Indian Rupees.
 * @param {number|string} amount
 */
export const formatCurrency = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num)) return '₹ —';
  return new Intl.NumberFormat('en-IN', {
    style:    'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

/**
 * Format a datetime string to a human-readable local format.
 * Accepts ISO strings or "yyyy-MM-dd HH:mm:ss" from the backend.
 */
export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr.replace(' ', 'T')); // handle backend format
  if (isNaN(date)) return dateStr;
  return new Intl.DateTimeFormat('en-IN', {
    year:   'numeric',
    month:  'short',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

/**
 * Format a confidence score (0.0–1.0) as a percentage string.
 */
export const formatConfidence = (score) => {
  if (score == null) return '—';
  return `${(score * 100).toFixed(1)}%`;
};

/**
 * Truncate a long transaction ID for display in narrow columns.
 */
export const truncateTxId = (txId, chars = 12) => {
  if (!txId) return '—';
  return txId.length > chars ? txId.substring(0, chars) + '…' : txId;
};

/**
 * Map a fraud status to a colour suitable for MUI Chip `color` prop.
 */
export const fraudStatusColor = (status) => {
  switch (status) {
    case 'SAFE':   return 'success';
    case 'FRAUD':  return 'error';
    case 'REVIEW': return 'warning';
    default:       return 'default';
  }
};

/**
 * Map an overall transaction status to a MUI colour.
 */
export const overallStatusColor = (status) => {
  switch (status) {
    case 'COMPLETE':         return 'success';
    case 'FAILED':
    case 'CRITICAL':         return 'error';
    case 'BLOCKED':          return 'error';
    case 'COMPENSATED':      return 'warning';
    case 'RAZORPAY_PENDING': return 'info';
    case 'PENDING':          return 'default';
    default:                 return 'default';
  }
};

/**
 * normalizeTxRecord — merge and normalize the two backend DTOs into one
 * consistent frontend record.
 *
 * The backend exposes two separate responses with overlapping but inconsistent
 * field names:
 *
 *   TransactionStatusResponse  (/api/transactions/{id}):
 *     { transactionId, fraudStatus, overallStatus, amount, payeeUpiId, … }
 *
 *   FraudResult  (/api/fraud/result/{id}):
 *     { transactionId, userId, status, confidenceScore,
 *       detectionLayer, reason, reviewNotes, analyzedAt, … }
 *     ↑ note: uses `status`, NOT `fraudStatus`
 *
 * Rules:
 *   - FraudResult.status  is the authoritative fraud verdict (most accurate)
 *   - TransactionStatusResponse.fraudStatus is the fallback verdict
 *   - Fields that only exist in one DTO are taken from that DTO
 *   - `timestamp` is always guaranteed (used by Analytics for chart bucketing)
 *
 * Either argument may be null — pass null for the one you don't have.
 *
 * @param {object|null} txStatus    — TransactionStatusResponse from /api/transactions/{id}
 * @param {object|null} fraudResult — FraudResult from /api/fraud/result/{id}
 * @returns {object}                — normalized record safe to use in any component
 */
export const normalizeTxRecord = (txStatus, fraudResult) => {
  const tx  = txStatus    || {};
  const fr  = fraudResult || {};
  const now = new Date().toISOString();

  return {
    // ── Identity ────────────────────────────────────────────────────────────
    transactionId:   tx.transactionId   || fr.transactionId   || null,
    userId:          fr.userId          || tx.userId           || null,

    // ── Payment details ─────────────────────────────────────────────────────
    amount:          tx.amount          ?? fr.amount           ?? 0,
    payeeUpiId:      tx.payeeUpiId      || fr.payeeUpiId       || null,

    // ── Fraud verdict ────────────────────────────────────────────────────────
    // FraudResult.status is the authoritative source; txStatus.fraudStatus is the fallback.
    fraudStatus:     fr.status          || tx.fraudStatus      || 'SAFE',

    // ── Transaction lifecycle status ─────────────────────────────────────────
    overallStatus:   tx.overallStatus   || null,

    // ── Risk intelligence (only in FraudResult) ──────────────────────────────
    // confidenceScore: validated to finite number or null — never NaN, Infinity, or a string
    confidenceScore: (typeof fr.confidenceScore === 'number' && isFinite(fr.confidenceScore))
      ? fr.confidenceScore : null,
    detectionLayer:  fr.detectionLayer  || null,
    // reason: empty string instead of null so string operations never crash on this field
    reason:          (typeof fr.reason === 'string' ? fr.reason : '') || '',
    // reviewNotes/analyzedAt stay null when absent — all consumers gate on truthiness before use
    reviewNotes:     fr.reviewNotes     || null,
    analyzedAt:      fr.analyzedAt      || null,

    // ── Timestamps ───────────────────────────────────────────────────────────
    submittedAt:     tx.submittedAt     || now,
    // `timestamp` is guaranteed — Analytics uses it for chart bucketing.
    timestamp:       tx.timestamp || tx.submittedAt || fr.analyzedAt || now,
  };
};

/**
 * Map a detection layer to a short human-readable label.
 */
export const detectionLayerLabel = (layer) => {
  switch (layer) {
    case 'RULE_BASED':    return 'Rule Engine';
    case 'REDIS_HISTORY': return 'Behaviour History';
    case 'AI':            return 'AI (GPT)';
    case 'AI_FALLBACK':   return 'AI Fallback';
    default:              return layer || '—';
  }
};
