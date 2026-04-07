import apiClient from './axiosConfig';

/**
 * bankApi — wraps the external bank-service endpoints
 *
 * Only the two EXTERNAL endpoints are exposed here.
 * /debit, /credit, /refund are INTERNAL service-to-service calls and
 * must never be called from the frontend.
 *
 * GET /bank/balance           → BalanceResponse (authenticated user's own balance)
 * GET /bank/account/by-upi/{upiId} → AccountResponse (payee lookup by UPI ID)
 */

/**
 * Get the authenticated user's bank balance.
 * Identity comes from the JWT (gateway injects X-User-Email).
 *
 * BalanceResponse: { userId, upiId, balance, currency, accountStatus }
 */
export const getBalance = async () => {
  const { data } = await apiClient.get('/bank/balance');
  return data;
};

/**
 * Look up a bank account by UPI ID (payee resolution before sending money).
 * AccountResponse: { userId, upiId, name, accountStatus }
 */
export const getAccountByUpiId = async (upiId) => {
  const { data } = await apiClient.get(`/bank/account/by-upi/${encodeURIComponent(upiId)}`);
  return data;
};
