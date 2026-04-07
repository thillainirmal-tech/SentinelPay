/**
 * logger.js — Structured Client-Side Logger (V3)
 *
 * Features:
 *  - Log levels: debug | info | warn | error
 *  - Silent in production (REACT_APP_ENV !== 'development') — no console bleed
 *  - Every log carries a `traceId` for correlation with server-side logs
 *  - `withTrace(traceId)` creates a bound logger scoped to one request/transaction
 *  - Remote drain: set REACT_APP_LOG_ENDPOINT to POST structured logs to your backend
 *    (errors only by default, configurable via `remoteLevel`)
 *
 * Usage:
 *   import logger from '../utils/logger';
 *   logger.info('Payment submitted', { txId: '123', amount: 500 });
 *
 *   // Scoped logger (same traceId throughout a component lifecycle)
 *   const log = logger.withTrace(traceId);
 *   log.info('Fraud check started');
 *   log.warn('Retry triggered', { attempt: 2 });
 *   log.error('Request failed', err);
 */

const IS_DEV         = process.env.REACT_APP_ENV === 'development' || process.env.NODE_ENV === 'development';
const LOG_ENDPOINT   = process.env.REACT_APP_LOG_ENDPOINT || null;
const REMOTE_LEVEL   = (process.env.REACT_APP_LOG_REMOTE_LEVEL || 'error').toLowerCase();

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

// ── Remote drain (fire-and-forget) ─────────────────────────────────────────────
function drainToRemote(level, message, context) {
  if (!LOG_ENDPOINT) return;
  if (LEVELS[level] < LEVELS[REMOTE_LEVEL]) return;

  const payload = {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
    url:       window.location.href,
    userAgent: navigator.userAgent,
  };

  // Use sendBeacon for error logs (survives page unload)
  if (level === 'error' && navigator.sendBeacon) {
    navigator.sendBeacon(LOG_ENDPOINT, JSON.stringify(payload));
  } else {
    fetch(LOG_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      // Don't let logging failures bubble up to the user
    }).catch(() => { /* intentionally silent */ });
  }
}

// ── Core log function ──────────────────────────────────────────────────────────
function log(level, message, context = {}, traceId = null) {
  const entry = {
    level,
    message,
    traceId,
    timestamp: new Date().toISOString(),
    ...context,
  };

  if (IS_DEV) {
    const styles = {
      debug: 'color: #8b949e',
      info:  'color: #2196f3; font-weight:600',
      warn:  'color: #ff9800; font-weight:600',
      error: 'color: #f44336; font-weight:700',
    };
    // eslint-disable-next-line no-console
    const fn = console[level] || console.log;
    fn(
      `%c[${level.toUpperCase()}]%c ${message}`,
      styles[level],
      'color: inherit',
      ...(traceId ? [`[trace: ${traceId}]`] : []),
      Object.keys(context).length ? context : ''
    );
  }

  drainToRemote(level, message, entry);
}

// ── Logger API ─────────────────────────────────────────────────────────────────
const logger = {
  debug: (message, context)  => log('debug', message, context),
  info:  (message, context)  => log('info',  message, context),
  warn:  (message, context)  => log('warn',  message, context),
  error: (message, context)  => log('error', message, context),

  /**
   * Returns a child logger with a fixed traceId.
   * All logs from the child include `traceId` automatically.
   *
   * @param {string} traceId — e.g. request ID from X-Request-Id header
   */
  withTrace: (traceId) => ({
    debug: (message, context) => log('debug', message, context, traceId),
    info:  (message, context) => log('info',  message, context, traceId),
    warn:  (message, context) => log('warn',  message, context, traceId),
    error: (message, context) => log('error', message, context, traceId),
  }),
};

export default logger;
