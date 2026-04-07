/**
 * setupTests.js — Jest / React Testing Library global setup
 *
 * Runs before every test file.
 * Configures MSW server, cleans up DOM, and polyfills missing browser APIs.
 */

import '@testing-library/jest-dom';
import { server } from './mocks/server';

// ── MSW server lifecycle ───────────────────────────────────────────────────────
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();            // Reset overrides after each test
  localStorage.clear();              // Wipe auth tokens between tests
  sessionStorage.clear();
});
afterAll(() => server.close());

// ── Polyfills for jsdom environment ──────────────────────────────────────────
// TextEncoder / TextDecoder (required by some libs)
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// crypto.randomUUID (used in axiosConfig for X-Request-Id)
if (!global.crypto) {
  global.crypto = { randomUUID: () => Math.random().toString(36).slice(2) };
} else if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = () => Math.random().toString(36).slice(2);
}

// matchMedia (used by ThemeContext to detect OS preference)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value:    jest.fn().mockImplementation((query) => ({
    matches:             false,
    media:               query,
    onchange:            null,
    addListener:         jest.fn(),
    removeListener:      jest.fn(),
    addEventListener:    jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent:       jest.fn(),
  })),
});

// ── Silence noisy console.warn/error in tests ─────────────────────────────────
const originalWarn  = console.warn.bind(console);
const originalError = console.error.bind(console);

console.warn = (...args) => {
  // Suppress known noisy React / RTL warnings
  const msg = args[0]?.toString() || '';
  if (
    msg.includes('Warning: ReactDOM.render') ||
    msg.includes('act(...)') ||
    msg.includes('[MSW]')
  ) return;
  originalWarn(...args);
};

console.error = (...args) => {
  const msg = args[0]?.toString() || '';
  if (
    msg.includes('Warning:') ||
    msg.includes('not wrapped in act')
  ) return;
  originalError(...args);
};
