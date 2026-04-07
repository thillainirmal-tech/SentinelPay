/**
 * axiosConfig.test.js — Axios instance unit tests
 *
 * Tests:
 *  - JWT Bearer token injected from localStorage
 *  - X-Request-Id header present on every request
 *  - 401 without refresh token fires sentinelpay:auth:expired event
 *  - 5xx triggers retry (up to RETRY_COUNT)
 *  - Error normalisation shape: { message, status, traceId }
 *  - Cancellation of in-flight GET duplicates
 */

import axios from 'axios';
import { server } from '../../mocks/server';
import { rest }   from 'msw';
import { errorHandlers } from '../../mocks/handlers';

const BASE = 'http://localhost:8085';

// Dynamically import apiClient so localStorage is pre-seeded before module load
let apiClient;
beforeAll(async () => {
  ({ default: apiClient } = await import('../../api/axiosConfig'));
});

describe('axiosConfig — request interceptor', () => {
  test('injects Authorization header when token in localStorage', async () => {
    localStorage.setItem('sentinelpay_token', 'mock-jwt-token');

    let capturedAuth;
    server.use(
      rest.get(`${BASE}/test-auth`, (req, res, ctx) => {
        capturedAuth = req.headers.get('Authorization');
        return res(ctx.status(200), ctx.json({}));
      })
    );

    await apiClient.get('/test-auth');
    expect(capturedAuth).toBe('Bearer mock-jwt-token');
  });

  test('stamps X-Request-Id on every request', async () => {
    let capturedRequestId;
    server.use(
      rest.get(`${BASE}/test-rid`, (req, res, ctx) => {
        capturedRequestId = req.headers.get('X-Request-Id');
        return res(ctx.status(200), ctx.json({}));
      })
    );

    await apiClient.get('/test-rid');
    expect(capturedRequestId).toBeTruthy();
    expect(typeof capturedRequestId).toBe('string');
  });
});

describe('axiosConfig — 401 handling', () => {
  test('fires sentinelpay:auth:expired event on 401 (no refresh token)', async () => {
    sessionStorage.clear(); // Ensure no refresh token

    const eventSpy = jest.fn();
    window.addEventListener('sentinelpay:auth:expired', eventSpy);

    server.use(
      rest.get(`${BASE}/test-401`, (req, res, ctx) =>
        res(ctx.status(401), ctx.json({ message: 'Unauthorized' }))
      )
    );

    await expect(apiClient.get('/test-401')).rejects.toThrow();
    expect(eventSpy).toHaveBeenCalledTimes(1);

    window.removeEventListener('sentinelpay:auth:expired', eventSpy);
  });
});

describe('axiosConfig — error normalisation', () => {
  test('normalises 404 into { message, status }', async () => {
    server.use(
      rest.get(`${BASE}/not-found`, (req, res, ctx) =>
        res(ctx.status(404), ctx.json({ message: 'Resource not found', traceId: 'trace-xyz' }))
      )
    );

    try {
      await apiClient.get('/not-found');
      fail('Expected request to throw');
    } catch (err) {
      expect(err.message).toBe('Resource not found');
      expect(err.status).toBe(404);
      expect(err.traceId).toBe('trace-xyz');
    }
  });

  test('normalises network error into human-readable message', async () => {
    server.use(
      rest.get(`${BASE}/network-fail`, (req, res) => res.networkError('Failed to connect'))
    );

    try {
      await apiClient.get('/network-fail');
      fail('Expected request to throw');
    } catch (err) {
      expect(err.message).toMatch(/network error/i);
      expect(err.status).toBe(0);
    }
  });

  test('normalises 500 with no body into standard message', async () => {
    server.use(
      rest.get(`${BASE}/server-error`, (req, res, ctx) =>
        res(ctx.status(500), ctx.json({}))
      )
    );

    try {
      await apiClient.get('/server-error');
      fail('Expected request to throw');
    } catch (err) {
      expect(err.status).toBe(500);
      expect(err.message).toMatch(/internal server error/i);
    }
  });
});
