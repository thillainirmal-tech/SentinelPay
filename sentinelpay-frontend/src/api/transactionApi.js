import apiClient from './axiosConfig';

/**
 * transactionApi — wraps transaction-service and UPI endpoints
 *
 * POST /api/transactions  → Submit a legacy transaction (202 Accepted)
 * GET  /api/transactions/{id} → Get combined fraud + payment status
 * POST /api/upi/pay        → Submit a UPI payment (202 Accepted)
 */

/**
 * Submit a transaction for fraud analysis.
 * @param {{
 *   transactionId: string,
 *   userId: string,
 *   amount: number,
 *   location: string,
 *   device: string,
 *   merchantCategory: string
 * }} payload
 */
export const submitTransaction = async (payload) => {
  const { data } = await apiClient.post('/api/transactions', payload);
  return data;
};

/**
 * Get the combined fraud verdict + payment status for a transaction.
 * Returns TransactionStatusResponse:
 * { transactionId, fraudStatus, paymentStatus, overallStatus,
 *   amount, payerEmail, payeeEmail, payeeUpiId, razorpayOrderId }
 *
 * overallStatus values: PENDING | COMPLETE | FAILED | BLOCKED | COMPENSATED | CRITICAL | RAZORPAY_PENDING
 */
export const getTransactionStatus = async (transactionId) => {
  const { data } = await apiClient.get(`/api/transactions/${transactionId}`);
  return data;
};

/**
 * Submit a UPI payment.
 * The backend reads payer identity from the JWT (via X-User-Email header injected by gateway).
 * @param {{
 *   payeeUpiId: string,
 *   amount: number,
 *   paymentMode?: 'BANK' | 'RAZORPAY'
 * }} payload
 */
export const submitUpiPayment = async (payload) => {
  const { data } = await apiClient.post('/api/upi/pay', payload);
  return data;
};

/**
 * Submit a UPI payment with full fraud-context fields required by the
 * fraud-detection scoring pipeline.  Without device / location /
 * merchantCategory the backend cannot complete ML scoring and defaults
 * every transaction to REVIEW.
 *
 * Returns: { transactionId: string, status: string }
 *
 * @param {{
 *   payeeUpiId:       string,
 *   amount:           number,
 *   device:           string,
 *   location:         string,
 *   merchantCategory: string,
 *   paymentMode?:     'BANK' | 'RAZORPAY'
 * }} payload
 */
export const sendUpiPayment = async (payload) => {
  const { data } = await apiClient.post('/api/upi/pay', payload);
  return data;   // { transactionId, status }
};

/**
 * Poll until a transaction reaches a terminal state (non-PENDING overallStatus).
 * Retries every `intervalMs` up to `maxAttempts` times.
 *
 * @param {string} transactionId
 * @param {number} maxAttempts   default 15
 * @param {number} intervalMs    default 3000
 * @returns {Promise<object>}    final TransactionStatusResponse
 */
export const pollTransactionStatus = (transactionId, maxAttempts = 15, intervalMs = 3000) => {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const poll = async () => {
      attempts++;
      try {
        const result = await getTransactionStatus(transactionId);
        if (result.overallStatus && result.overallStatus !== 'PENDING') {
          resolve(result);
        } else if (attempts >= maxAttempts) {
          resolve({ ...result, overallStatus: 'PENDING', timedOut: true });
        } else {
          setTimeout(poll, intervalMs);
        }
      } catch (err) {
        if (attempts >= maxAttempts) {
          reject(err);
        } else {
          setTimeout(poll, intervalMs);
        }
      }
    };

    poll();
  });
};
