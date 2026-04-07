/**
 * AppStateContext.jsx — Global application state (non-auth)
 *
 * Stores data that survives navigation between pages:
 *   - Session transaction history (persists across Dashboard ↔ Transactions navigation)
 *   - Aggregated fraud stats (safe / blocked / review counts)
 *   - Live alert queue (simulated real-time fraud alerts)
 *   - Unread alert count (shown in Sidebar badge)
 *
 * Separating this from AuthContext keeps concerns clean:
 *   Auth = identity. AppState = session business data.
 */

import React, {
  createContext, useContext, useState,
  useCallback, useReducer,
} from 'react';
import { normalizeTxRecord } from '../utils/formatters';

// ── Fraud stats reducer ───────────────────────────────────────────────────────
const statsInitial = { safe: 0, blocked: 0, review: 0, total: 0 };

function statsReducer(state, action) {
  switch (action.type) {
    case 'INCREMENT_SAFE':
      return { ...state, safe:    state.safe    + 1, total: state.total + 1 };
    case 'INCREMENT_BLOCKED':
      return { ...state, blocked: state.blocked + 1, total: state.total + 1 };
    case 'INCREMENT_REVIEW':
      return { ...state, review:  state.review  + 1, total: state.total + 1 };
    case 'RESET':
      return statsInitial;
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────
const AppStateContext = createContext(null);

const MAX_HISTORY   = 50;  // keep last 50 transactions in session
const MAX_ALERTS    = 20;  // keep last 20 alert events

export function AppStateProvider({ children }) {
  const [txHistory,    setTxHistory]    = useState([]);  // TransactionRecord[]
  const [alerts,       setAlerts]       = useState([]);  // AlertEvent[]
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [stats,        dispatchStats]   = useReducer(statsReducer, statsInitial);

  // ── Add completed transaction to history ────────────────────────────────────
  const recordTransaction = useCallback((txRecord) => {
    // ── Defensive normalization ────────────────────────────────────────────
    // Callers should already pass a normalized record (from normalizeTxRecord),
    // but we enforce correctness here as the final safety net.
    //
    // We pass txRecord as BOTH arguments so the merge function can extract:
    //   - `status` (FraudResult field) from the `fraudResult` argument slot
    //   - `fraudStatus` (TransactionStatusResponse field) from the `txStatus` slot
    // Either path resolves correctly regardless of which DTO shape was passed.
    const normalized = normalizeTxRecord(txRecord, txRecord);

    // Deduplicate — SSE and Dashboard submit can both call recordTransaction
    // for the same transactionId; keep only the first entry.
    setTxHistory((prev) => {
      if (prev.some((t) => t.transactionId === normalized.transactionId)) return prev;
      return [normalized, ...prev].slice(0, MAX_HISTORY);
    });

    // Update aggregated stats for Analytics
    if      (normalized.fraudStatus === 'SAFE')   dispatchStats({ type: 'INCREMENT_SAFE' });
    else if (normalized.fraudStatus === 'FRAUD')  dispatchStats({ type: 'INCREMENT_BLOCKED' });
    else if (normalized.fraudStatus === 'REVIEW') dispatchStats({ type: 'INCREMENT_REVIEW' });

    // Auto-generate an alert for non-SAFE verdicts.
    // Also deduplicated — if SSE already pushed this alert, skip it here.
    if (normalized.fraudStatus === 'FRAUD' || normalized.fraudStatus === 'REVIEW') {
      const alert = {
        id:             crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        transactionId:  normalized.transactionId,
        fraudStatus:    normalized.fraudStatus,
        amount:         normalized.amount,
        payeeUpiId:     normalized.payeeUpiId,
        reason:         normalized.reason || (normalized.fraudStatus === 'FRAUD' ? 'Fraud detected' : 'Flagged for review'),
        detectionLayer: normalized.detectionLayer || 'RULE_BASED',
        confidenceScore: normalized.confidenceScore ?? null,
        timestamp:      new Date().toISOString(),
        read:           false,
      };
      setAlerts((prev) => {
        // Deduplicate with SSE-pushed alerts
        if (prev.some((a) => a.transactionId === normalized.transactionId)) return prev;
        return [alert, ...prev].slice(0, MAX_ALERTS);
      });
      setUnreadAlerts((n) => n + 1);
    }
  }, []);

  // ── Mark all alerts as read ─────────────────────────────────────────────────
  const markAlertsRead = useCallback(() => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    setUnreadAlerts(0);
  }, []);

  // ── Push a real alert from SSE or polling ────────────────────────────────────
  /**
   * Called by AlertsPanel when an SSE event or polling result delivers
   * a real fraud/review alert from the backend.
   */
  const pushAlert = useCallback((alert) => {
    setAlerts((prev) => {
      // Deduplicate by transactionId to avoid double-pushing
      if (prev.some((a) => a.transactionId === alert.transactionId)) return prev;
      return [alert, ...prev].slice(0, MAX_ALERTS);
    });
    setUnreadAlerts((n) => n + 1);
  }, []);

  // ── Push a simulated alert (for demo / when backend is offline) ─────────────
  const pushSimulatedAlert = useCallback((override = {}) => {
    const scenarios = [
      { fraudStatus: 'FRAUD',  reason: 'Amount exceeds ₹10,000 threshold', detectionLayer: 'RULE_BASED', confidenceScore: 0.92, amount: 15000 },
      { fraudStatus: 'FRAUD',  reason: 'Transaction from unknown location: Antarctica', detectionLayer: 'RULE_BASED', confidenceScore: 0.88, amount: 7500 },
      { fraudStatus: 'REVIEW', reason: 'New device detected — Samsung-Galaxy-A54', detectionLayer: 'AI', confidenceScore: 0.52, amount: 4200 },
      { fraudStatus: 'FRAUD',  reason: 'Impossible travel: Delhi → London within 3 minutes', detectionLayer: 'REDIS_HISTORY', confidenceScore: 0.97, amount: 9999 },
      { fraudStatus: 'REVIEW', reason: 'AI confidence borderline (0.48): unusual spending pattern', detectionLayer: 'AI', confidenceScore: 0.48, amount: 3300 },
    ];
    const base = scenarios[Math.floor(Math.random() * scenarios.length)];
    const alert = {
      id:            crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      transactionId: 'SIM-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      timestamp:     new Date().toISOString(),
      read:          false,
      payeeUpiId:    'merchant@upi',
      ...base,
      ...override,
    };
    setAlerts((prev) => [alert, ...prev].slice(0, MAX_ALERTS));
    setUnreadAlerts((n) => n + 1);
    return alert;
  }, []);

  // ── Clear session data (e.g. on logout) ─────────────────────────────────────
  const clearAppState = useCallback(() => {
    setTxHistory([]);
    setAlerts([]);
    setUnreadAlerts(0);
    dispatchStats({ type: 'RESET' });
  }, []);

  return (
    <AppStateContext.Provider value={{
      txHistory, stats,
      alerts, unreadAlerts,
      recordTransaction, markAlertsRead,
      pushAlert, pushSimulatedAlert, clearAppState,
    }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside <AppStateProvider>');
  return ctx;
}
