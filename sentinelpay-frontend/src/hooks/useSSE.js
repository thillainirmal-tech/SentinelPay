/**
 * useSSE.js — Real-time fraud alerts via Server-Sent Events (V3)
 *
 * Connects to the backend SSE stream at /api/fraud/stream (configurable).
 * Falls back to polling via the provided `pollFn` when:
 *   - The browser lacks EventSource support
 *   - The initial SSE connection fails (after `maxRetries` reconnection attempts)
 *
 * Features:
 *  - Automatic reconnection with exponential back-off (capped at 30 seconds)
 *  - Drops to polling fallback after maxRetries consecutive failures
 *  - JWT token injected via URL query parameter (EventSource doesn't support headers)
 *  - Cleanup on unmount — no memory leaks
 *  - `status` field tells the UI whether we're on SSE or polling
 *
 * Usage:
 *   const { status, lastEvent } = useSSE({
 *     url: '/api/fraud/stream',
 *     onMessage: (event) => { ... },      // called for each SSE message
 *     pollFn: () => api.get('/api/fraud/history/me'),  // polling fallback
 *     pollInterval: 15_000,
 *   });
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const TOKEN_KEY   = process.env.REACT_APP_TOKEN_KEY || 'sentinelpay_token';
const BASE_URL    = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8085';
const SSE_TIMEOUT = 5_000;   // ms to wait for first message before considering failed

/**
 * @param {object}   options
 * @param {string}   options.url          — SSE endpoint path (relative to BASE_URL)
 * @param {Function} options.onMessage    — callback(parsedData) for each SSE message
 * @param {Function} [options.pollFn]     — async fn returning { data } when SSE unavailable
 * @param {number}   [options.pollInterval=15000]  — polling interval in ms
 * @param {number}   [options.maxRetries=5]        — SSE reconnection attempts before fallback
 * @param {boolean}  [options.enabled=true]        — disable hook entirely (e.g. when logged out)
 */
export function useSSE({
  url,
  onMessage,
  pollFn,
  pollInterval = 15_000,
  maxRetries   = 5,
  enabled      = true,
}) {
  const [status,    setStatus]    = useState('idle');     // idle | connecting | sse | polling | error
  const [lastEvent, setLastEvent] = useState(null);

  const esRef         = useRef(null);       // EventSource instance
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef(null);
  const pollTimerRef  = useRef(null);
  const onMessageRef  = useRef(onMessage);

  // Keep ref in sync without triggering re-connects
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  // ── Polling fallback ───────────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (!pollFn) { setStatus('error'); return; }
    setStatus('polling');

    const doPoll = async () => {
      try {
        const res = await pollFn();
        if (res?.data) {
          const events = Array.isArray(res.data) ? res.data : [res.data];
          events.forEach((ev) => {
            onMessageRef.current?.(ev);
            setLastEvent(ev);
          });
        }
      } catch {
        // Silently continue polling — axiosConfig will surface repeated failures
      }
    };

    doPoll(); // immediate first call
    pollTimerRef.current = setInterval(doPoll, pollInterval);
  }, [pollFn, pollInterval]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // ── SSE connection ─────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!enabled || typeof EventSource === 'undefined') {
      // Browser doesn't support SSE — go straight to polling
      startPolling();
      return;
    }

    const token    = localStorage.getItem(TOKEN_KEY);
    const fullUrl  = `${BASE_URL}${url}${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    setStatus('connecting');
    const es = new EventSource(fullUrl, { withCredentials: false });
    esRef.current = es;

    // Timeout: if no message received within SSE_TIMEOUT, consider it a failure
    const openTimeout = setTimeout(() => {
      if (status !== 'sse') {
        es.close();
        handleRetry();
      }
    }, SSE_TIMEOUT);

    es.onopen = () => {
      clearTimeout(openTimeout);
      retryCountRef.current = 0;
      setStatus('sse');
    };

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessageRef.current?.(parsed);
        setLastEvent(parsed);
      } catch {
        // Non-JSON heartbeat or keep-alive — ignore
      }
    };

    // Named event types (Spring sends `event: fraud-alert` headers)
    es.addEventListener('fraud-alert', (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessageRef.current?.(parsed);
        setLastEvent(parsed);
      } catch { /* ignore */ }
    });

    es.onerror = () => {
      clearTimeout(openTimeout);
      es.close();
      handleRetry();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, url, startPolling]);

  const handleRetry = useCallback(() => {
    retryCountRef.current += 1;
    if (retryCountRef.current > maxRetries) {
      // Exceeded retries — fall back to polling
      if (process.env.REACT_APP_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('[useSSE] Exceeded max retries — switching to polling fallback');
      }
      startPolling();
      return;
    }

    // Exponential back-off: 1s, 2s, 4s, 8s … capped at 30s
    const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 30_000);
    setStatus('connecting');

    retryTimerRef.current = setTimeout(() => {
      connect();
    }, delay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxRetries, startPolling, connect]);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) { setStatus('idle'); return; }

    connect();

    return () => {
      // Cleanup on unmount
      if (esRef.current)       esRef.current.close();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      stopPolling();
      setStatus('idle');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, url]);

  return { status, lastEvent };
}
