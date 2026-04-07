/**
 * handlers.js — MSW request handlers for testing
 *
 * Intercepts all API calls in Jest/test environments and returns
 * realistic fixture data that mirrors the Spring Boot backend responses.
 *
 * Import into server.js and use in test files via:
 *   server.use(handlers.fraud.blocked) — to override specific scenarios
 */

import { rest } from 'msw';

const BASE = 'http://localhost:8085';

// ── Fixtures ──────────────────────────────────────────────────────────────────
export const FIXTURES = {
  user: {
    name:         'Test User',
    email:        'test@example.com',
    upiId:        'testuser@sentinelpay',
    token:        // JWT with exp = year 2099, role = USER
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZXMiOlsiVVNFUiJdLCJleHAiOjQxMDI0NDQ4MDB9.placeholder',
    refreshToken: 'mock-refresh-token-abc123',
  },
  admin: {
    name:  'Admin User',
    email: 'admin@example.com',
    upiId: 'admin@sentinelpay',
    token: // JWT with role = ROLE_ADMIN
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbkBleGFtcGxlLmNvbSIsInJvbGVzIjpbIlJPTEVfQURNSU4iXSwiZXhwIjo0MTAyNDQ0ODAwfQ.placeholder',
    refreshToken: 'mock-admin-refresh-token',
  },
  fraudResult: {
    safe: {
      transactionId:  'tx-safe-001',
      userId:         'user-123',
      status:         'SAFE',
      reason:         'No anomaly detected',
      confidenceScore: 0.12,
      detectionLayer: 'RULE_BASED',
      reviewNotes:    null,
      analyzedAt:     new Date().toISOString(),
    },
    fraud: {
      transactionId:  'tx-fraud-001',
      userId:         'user-123',
      status:         'FRAUD',
      reason:         'High amount, new payee, velocity threshold exceeded',
      confidenceScore: 0.91,
      detectionLayer: 'AI',
      reviewNotes:    null,
      analyzedAt:     new Date().toISOString(),
    },
    review: {
      transactionId:  'tx-review-001',
      userId:         'user-123',
      status:         'REVIEW',
      reason:         'Moderate risk pattern detected via Redis history',
      confidenceScore: 0.52,
      detectionLayer: 'REDIS_HISTORY',
      reviewNotes:    'Escalated for manual review by compliance team.',
      analyzedAt:     new Date().toISOString(),
    },
  },
  balance: { balance: 50000.00, accountNumber: 'ACCT-TEST-001' },
};

// ── Auth handlers ─────────────────────────────────────────────────────────────
const authHandlers = [
  rest.post(`${BASE}/auth/login`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(FIXTURES.user),
    );
  }),

  rest.post(`${BASE}/auth/register`, (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json(FIXTURES.user),
    );
  }),

  rest.post(`${BASE}/auth/refresh`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({ token: FIXTURES.user.token, refreshToken: 'new-refresh-token' }),
    );
  }),
];

// ── UPI / Payment handlers ────────────────────────────────────────────────────
const paymentHandlers = [
  rest.post(`${BASE}/api/upi/pay`, (req, res, ctx) => {
    return res(
      ctx.status(202),
      ctx.json({ transactionId: 'tx-safe-001', message: 'Payment queued for processing' }),
    );
  }),

  rest.get(`${BASE}/api/upi/account/by-upi/:upiId`, (req, res, ctx) => {
    const { upiId } = req.params;
    if (upiId === 'invalid@upi') return res(ctx.status(404), ctx.json({ message: 'UPI ID not found' }));
    return res(ctx.status(200), ctx.json({ name: 'Payee Name', upiId }));
  }),
];

// ── Fraud handlers ────────────────────────────────────────────────────────────
const fraudHandlers = [
  rest.get(`${BASE}/api/fraud/result/:txId`, (req, res, ctx) => {
    const { txId } = req.params;
    if (txId === 'tx-fraud-001')  return res(ctx.status(200), ctx.json(FIXTURES.fraudResult.fraud));
    if (txId === 'tx-review-001') return res(ctx.status(200), ctx.json(FIXTURES.fraudResult.review));
    if (txId === 'tx-pending')    return res(ctx.status(202), ctx.json({ message: 'Analysis in progress' }));
    return res(ctx.status(200), ctx.json(FIXTURES.fraudResult.safe));
  }),

  rest.get(`${BASE}/api/fraud/history/:userId`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([FIXTURES.fraudResult.safe, FIXTURES.fraudResult.fraud]),
    );
  }),

  rest.post(`${BASE}/api/fraud/analyze`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(FIXTURES.fraudResult.safe));
  }),
];

// ── Bank handlers ─────────────────────────────────────────────────────────────
const bankHandlers = [
  rest.get(`${BASE}/bank/balance`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(FIXTURES.balance));
  }),
];

// ── Error scenario handlers (use in individual tests via server.use()) ─────────
export const errorHandlers = {
  loginUnauthorized: rest.post(`${BASE}/auth/login`, (req, res, ctx) =>
    res(ctx.status(401), ctx.json({ message: 'Invalid credentials' }))
  ),
  networkError: rest.post(`${BASE}/auth/login`, (req, res) =>
    res.networkError('Network failed')
  ),
  refreshFailed: rest.post(`${BASE}/auth/refresh`, (req, res, ctx) =>
    res(ctx.status(401), ctx.json({ message: 'Refresh token expired' }))
  ),
  serverError: rest.get(`${BASE}/api/fraud/result/:txId`, (req, res, ctx) =>
    res(ctx.status(500), ctx.json({ message: 'Internal server error' }))
  ),
};

export const handlers = [
  ...authHandlers,
  ...paymentHandlers,
  ...fraudHandlers,
  ...bankHandlers,
];
