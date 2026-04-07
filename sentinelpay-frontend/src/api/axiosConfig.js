/**
 * axiosConfig.js — Production-Grade Axios Instance (V3)
 *
 * V3 upgrades over V2:
 *  - Refresh token queue: queues concurrent 401s while /auth/refresh is in-flight
 *    (prevents duplicate refresh calls and infinite retry loops)
 *  - _retry flag to stop infinite 401 → refresh → 401 loops
 *  - GET request deduplication: AbortController map cancels in-flight duplicates
 *  - Global loading events (sentinelpay:request:start / :end) for NProgress bar
 *  - Refresh token stored in sessionStorage (cleared on tab close)
 *  - Silent fallback: if /auth/refresh fails → fires auth:expired event → logout
 */

import axios from 'axios';
import axiosRetry from 'axios-retry';

// ── Constants ─────────────────────────────────────────────────────────────────
const BASE_URL      = process.env.REACT_APP_API_BASE_URL   || 'http://localhost:8085';
const TOKEN_KEY     = process.env.REACT_APP_TOKEN_KEY      || 'sentinelpay_token';
const REFRESH_KEY   = 'sentinelpay_refresh_token';
const RETRY_COUNT   = parseInt(process.env.REACT_APP_RETRY_COUNT    || '3', 10);
const RETRY_DELAY   = parseInt(process.env.REACT_APP_RETRY_DELAY_MS || '800', 10);

// ── Axios instance ────────────────────────────────────────────────────────────
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

// ── Retry policy ──────────────────────────────────────────────────────────────
// Retry on network errors and idempotent 5xx ONLY.
// Never retry 401/403/404/400 — those are definitive answers.
axiosRetry(apiClient, {
  retries: RETRY_COUNT,
  retryCondition: (error) => {
    // Skip retry if we already tried a refresh (avoids double-retry on stale token)
    if (error.config?._retry) return false;
    return axiosRetry.isNetworkError(error) || axiosRetry.isRetryableError(error);
  },
  retryDelay: (retryCount) => RETRY_DELAY * Math.pow(2, retryCount - 1),
  onRetry: (retryCount, error) => {
    if (process.env.REACT_APP_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn(`[Axios] Retry ${retryCount}/${RETRY_COUNT} for ${error.config?.url}`, error.message);
    }
  },
});

// ── Refresh token state ───────────────────────────────────────────────────────
let isRefreshing = false;
let failedRequestQueue = [];   // pending promises waiting for a fresh token

/** Resolve or reject every queued promise with the new token / error. */
function processQueue(error, newToken = null) {
  failedRequestQueue.forEach((deferred) => {
    if (error) deferred.reject(error);
    else       deferred.resolve(newToken);
  });
  failedRequestQueue = [];
}

/** Attempt to exchange the stored refresh token for a new access token. */
async function doRefresh() {
  const refreshToken = sessionStorage.getItem(REFRESH_KEY);
  if (!refreshToken) throw new Error('No refresh token available');

  // Use a plain axios call (NOT apiClient) to avoid interceptor loops
  const { data } = await axios.post(
    `${BASE_URL}/auth/refresh`,
    { refreshToken },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );

  // Persist new tokens
  localStorage.setItem(TOKEN_KEY, data.token);
  if (data.refreshToken) sessionStorage.setItem(REFRESH_KEY, data.refreshToken);

  return data.token;
}

// ── GET deduplication map ─────────────────────────────────────────────────────
// Keyed by "<method>:<url>" — cancels any previous in-flight GET before firing a new one.
const pendingGets = new Map();

// ── Active request counter (for global loading bar) ───────────────────────────
let activeRequests = 0;

function notifyLoadingStart() {
  activeRequests += 1;
  if (activeRequests === 1) {
    window.dispatchEvent(new CustomEvent('sentinelpay:request:start'));
  }
}

function notifyLoadingEnd() {
  activeRequests = Math.max(0, activeRequests - 1);
  if (activeRequests === 0) {
    window.dispatchEvent(new CustomEvent('sentinelpay:request:end'));
  }
}

// ── Request interceptor ───────────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    // Inject JWT
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers['Authorization'] = `Bearer ${token}`;

    // Stamp each request with a unique ID for server-side log correlation
    config.headers['X-Request-Id'] = crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

    // GET deduplication — cancel in-flight duplicate GETs
    if (config.method === 'get' && !config._skipDedup) {
      const key = `get:${config.url}`;
      if (pendingGets.has(key)) {
        // Abort the previous request
        pendingGets.get(key).abort();
      }
      const controller = new AbortController();
      config.signal = controller.signal;
      pendingGets.set(key, controller);
    }

    // Notify loading bar
    notifyLoadingStart();

    return config;
  },
  (error) => {
    notifyLoadingEnd();
    return Promise.reject(normaliseError(error));
  }
);

// ── Response interceptor ──────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => {
    // Clean up dedup map entry on success
    if (response.config.method === 'get' && !response.config._skipDedup) {
      const key = `get:${response.config.url}`;
      pendingGets.delete(key);
    }
    notifyLoadingEnd();
    return response;
  },
  async (error) => {
    notifyLoadingEnd();

    // Clean up dedup map on error (including cancellation)
    if (error.config?.method === 'get') {
      const key = `get:${error.config.url}`;
      pendingGets.delete(key);
    }

    // Ignore cancellation errors (not real errors)
    if (axios.isCancel(error) || error.name === 'CanceledError' || error.name === 'AbortError') {
      return Promise.reject(error);
    }

    const status         = error.response?.status;
    const originalConfig = error.config;

    // ── Refresh token flow ────────────────────────────────────────────────────
    // Condition: 401 AND we haven't already retried this request AND it's not
    // a refresh request itself (prevents infinite loops)
    if (
      status === 401 &&
      !originalConfig._retry &&
      !originalConfig.url?.includes('/auth/refresh') &&
      !originalConfig.url?.includes('/auth/login') &&
      !originalConfig.url?.includes('/auth/register')
    ) {
      if (isRefreshing) {
        // Queue this request — it will be replayed once refresh completes
        return new Promise((resolve, reject) => {
          failedRequestQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            originalConfig.headers['Authorization'] = `Bearer ${newToken}`;
            return apiClient(originalConfig);
          })
          .catch((queueError) => Promise.reject(normaliseError(queueError)));
      }

      // Mark that we're attempting a refresh
      originalConfig._retry = true;
      isRefreshing = true;

      try {
        const newToken = await doRefresh();
        processQueue(null, newToken);

        // Retry the original request with the fresh token
        originalConfig.headers['Authorization'] = `Bearer ${newToken}`;
        return apiClient(originalConfig);
      } catch (refreshError) {
        // Refresh failed — clear all queued requests and force logout
        processQueue(refreshError, null);
        window.dispatchEvent(new CustomEvent('sentinelpay:auth:expired'));
        return Promise.reject(normaliseError(refreshError));
      } finally {
        isRefreshing = false;
      }
    }

    // 401 on a non-retriable request (already retried, or auth endpoint)
    if (status === 401 && !isRefreshing) {
      window.dispatchEvent(new CustomEvent('sentinelpay:auth:expired'));
    }

    return Promise.reject(normaliseError(error));
  }
);

// ── Error normalisation ───────────────────────────────────────────────────────
/**
 * Convert any Axios error into a consistent shape:
 *   { message, status, traceId, originalError, response }
 */
function normaliseError(error) {
  // Don't double-normalise
  if (error._normalised) return error;

  const response = error.response;
  const status   = response?.status ?? 0;
  const data     = response?.data ?? {};

  const message =
    data.message ||
    data.error   ||
    (status === 0   && 'Network error — check your connection') ||
    (status === 408 && 'Request timed out') ||
    (status === 429 && 'Too many requests — please slow down') ||
    (status === 500 && 'Internal server error') ||
    (status === 503 && 'Service unavailable') ||
    error.message   ||
    'An unexpected error occurred';

  const enhanced         = new Error(message);
  enhanced._normalised   = true;
  enhanced.status        = status;
  enhanced.traceId       = data.traceId || response?.headers?.['x-request-id'] || null;
  enhanced.originalError = error;
  enhanced.response      = response;

  return enhanced;
}

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * createAbortController() — Returns a new AbortController.
 * Pass `{ signal: controller.signal }` to any apiClient call.
 * Call `controller.abort()` in your useEffect cleanup.
 */
export function createAbortController() {
  return new AbortController();
}

/**
 * storeRefreshToken(token) — Called by AuthContext after login/register
 * to persist the refresh token in sessionStorage.
 */
export function storeRefreshToken(token) {
  if (token) sessionStorage.setItem(REFRESH_KEY, token);
}

/**
 * clearRefreshToken() — Called by AuthContext on logout.
 */
export function clearRefreshToken() {
  sessionStorage.removeItem(REFRESH_KEY);
}

export default apiClient;
