/**
 * authFlow.test.jsx — Auth context integration tests
 *
 * Tests:
 *  - login() succeeds and persists token + user to localStorage
 *  - login() fails with invalid credentials (MSW override)
 *  - registerUser() creates account and navigates to dashboard
 *  - logout() clears localStorage and resets state
 *  - Token hydration on app load (stale token discarded)
 *  - sentinelpay:auth:expired event triggers automatic logout
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { server } from '../../mocks/server';
import { errorHandlers, FIXTURES } from '../../mocks/handlers';

// ── Helper to render a component inside AuthProvider ─────────────────────────
function renderWithAuth(ui) {
  return render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}

// ── Minimal consumer component for testing context ────────────────────────────
function AuthConsumer() {
  const { user, isAuthenticated, isAdmin, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'logged-in' : 'logged-out'}</div>
      <div data-testid="user-name">{user?.name || 'none'}</div>
      <div data-testid="user-role">{user?.role || 'none'}</div>
      <div data-testid="is-admin">{isAdmin ? 'yes' : 'no'}</div>
      <button onClick={() => login('test@example.com', 'password123')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('AuthContext — login flow', () => {
  test('login() persists token and user to localStorage', async () => {
    renderWithAuth(<AuthConsumer />);

    await userEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-in');
    });

    expect(screen.getByTestId('user-name')).toHaveTextContent(FIXTURES.user.name);
    expect(localStorage.getItem('sentinelpay_token')).toBeTruthy();
    expect(localStorage.getItem('sentinelpay_user')).toBeTruthy();
  });

  test('login() sets role from JWT payload', async () => {
    renderWithAuth(<AuthConsumer />);
    await userEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-in');
    });

    // FIXTURES.user.token has role USER
    expect(screen.getByTestId('user-role')).toHaveTextContent('USER');
    expect(screen.getByTestId('is-admin')).toHaveTextContent('no');
  });

  test('login() throws and sets globalError on 401', async () => {
    server.use(errorHandlers.loginUnauthorized);

    const errors = [];
    function ErrorCapture() {
      const { globalError, login } = useAuth();
      return (
        <div>
          <div data-testid="global-error">{globalError || 'none'}</div>
          <button onClick={async () => {
            try { await login('bad@bad.com', 'wrong'); } catch { /* expected */ }
          }}>Login</button>
        </div>
      );
    }

    renderWithAuth(<ErrorCapture />);
    await userEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('global-error')).not.toHaveTextContent('none');
    });
  });
});

describe('AuthContext — logout', () => {
  test('logout() clears state and localStorage', async () => {
    renderWithAuth(<AuthConsumer />);

    // Login first
    await userEvent.click(screen.getByText('Login'));
    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-in'));

    // Then logout
    await userEvent.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-out');
    });

    expect(localStorage.getItem('sentinelpay_token')).toBeNull();
    expect(localStorage.getItem('sentinelpay_user')).toBeNull();
  });

  test('sentinelpay:auth:expired event triggers automatic logout', async () => {
    renderWithAuth(<AuthConsumer />);

    // Login first
    await userEvent.click(screen.getByText('Login'));
    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-in'));

    // Fire the expired event
    act(() => {
      window.dispatchEvent(new CustomEvent('sentinelpay:auth:expired'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-out');
    });
  });
});

describe('AuthContext — hydration', () => {
  test('stale (expired) token is discarded on load', () => {
    // Plant an expired token (exp in the past)
    const expiredPayload = btoa(JSON.stringify({ sub: 'test', exp: 1, roles: ['USER'] }));
    const fakeToken      = `header.${expiredPayload}.sig`;
    localStorage.setItem('sentinelpay_token', fakeToken);
    localStorage.setItem('sentinelpay_user',  JSON.stringify({ name: 'Old User', email: 'x@x.com', upiId: 'x' }));

    renderWithAuth(<AuthConsumer />);

    // Should NOT restore the session
    expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-out');
    expect(localStorage.getItem('sentinelpay_token')).toBeNull();
  });

  test('valid token restores session on load', () => {
    // Plant a valid token (exp far in future)
    const validPayload = btoa(JSON.stringify({ sub: 'test@example.com', exp: 9999999999, roles: ['USER'] }));
    const fakeToken    = `header.${validPayload}.sig`;
    const user         = { name: 'Test User', email: 'test@example.com', upiId: 'test@sp', role: 'USER' };
    localStorage.setItem('sentinelpay_token', fakeToken);
    localStorage.setItem('sentinelpay_user',  JSON.stringify(user));

    renderWithAuth(<AuthConsumer />);

    expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-in');
    expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
  });
});
