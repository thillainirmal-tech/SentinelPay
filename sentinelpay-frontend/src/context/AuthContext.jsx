/**
 * AuthContext.jsx — Production-Grade Auth State (V3)
 *
 * V3 upgrades over V2:
 *  - Stores refreshToken (from login/register API) in sessionStorage via storeRefreshToken()
 *  - clearRefreshToken() called on logout to wipe session
 *  - Token expiry checked on every app hydration (stale sessions cleared immediately)
 *  - Listens for 'sentinelpay:auth:expired' DOM event fired by axiosConfig (clean logout)
 *  - globalLoading and globalError exposed for app-wide UI
 *  - DOMPurify sanitises all stored user fields before rendering
 */

import React, {
  createContext, useContext, useState,
  useCallback, useEffect, useRef,
} from 'react';
import DOMPurify                        from 'dompurify';
import { login as apiLogin, register as apiRegister } from '../api/authApi';
import { storeRefreshToken, clearRefreshToken }       from '../api/axiosConfig';

// ── Storage keys ──────────────────────────────────────────────────────────────
const TOKEN_KEY = process.env.REACT_APP_TOKEN_KEY || 'sentinelpay_token';
const USER_KEY  = process.env.REACT_APP_USER_KEY  || 'sentinelpay_user';

// ── JWT helpers ───────────────────────────────────────────────────────────────

/**
 * Decode a JWT payload without crypto verification.
 * Server re-validates signature on every API call — this is CLIENT-SIDE only
 * for expiry detection and role-based UI branching.
 */
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64    = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json      = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Returns true only if the JWT exp claim is > 30 seconds in the future. */
function isTokenValid(token) {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  // 30-second grace window prevents "just expired" edge cases
  return payload.exp * 1000 > Date.now() - 30_000;
}

/** Extract ADMIN / USER role from the JWT payload. */
function extractRole(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) return 'USER';
  const roles = payload.roles || payload.role || [];
  const arr   = Array.isArray(roles) ? roles : [roles];
  return arr.some((r) => r === 'ROLE_ADMIN' || r === 'ADMIN') ? 'ADMIN' : 'USER';
}

/** Sanitise user object fields to prevent stored-XSS. */
function sanitiseUser(raw) {
  if (!raw) return null;
  return {
    email: DOMPurify.sanitize(String(raw.email || '')),
    name:  DOMPurify.sanitize(String(raw.name  || '')),
    upiId: DOMPurify.sanitize(String(raw.upiId || '')),
    role:  raw.role || 'USER',
  };
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,          setUser]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError,   setGlobalError]   = useState(null);

  // Ref so the expired-token listener always calls the latest logout function
  const logoutRef = useRef(null);

  // ── Hydrate on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    const token      = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (token && storedUser && isTokenValid(token)) {
      try {
        const raw = JSON.parse(storedUser);
        raw.role  = extractRole(token);
        setUser(sanitiseUser(raw));
      } catch {
        clearStorage();
      }
    } else if (token) {
      // Token present but expired — wipe silently before first render
      clearStorage();
      clearRefreshToken();
    }

    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Listen for auth:expired event fired by axiosConfig ────────────────────
  useEffect(() => {
    const handleExpiry = () => {
      if (logoutRef.current) logoutRef.current();
    };
    window.addEventListener('sentinelpay:auth:expired', handleExpiry);
    return () => window.removeEventListener('sentinelpay:auth:expired', handleExpiry);
  }, []);

  // ── Storage helpers ────────────────────────────────────────────────────────
  function clearStorage() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  /**
   * Persist a successful auth response.
   * Stores both access token (localStorage) and refresh token (sessionStorage).
   */
  const persistSession = (data) => {
    const role     = extractRole(data.token);
    const userData = sanitiseUser({
      email: data.email,
      name:  data.name,
      upiId: data.upiId,
      role,
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY,  JSON.stringify(userData));

    // Store refresh token if the backend returns one
    if (data.refreshToken) storeRefreshToken(data.refreshToken);

    setUser(userData);
    return userData;
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    setGlobalLoading(true);
    setGlobalError(null);
    try {
      const data = await apiLogin({ email, password });
      return persistSession(data);
    } catch (err) {
      setGlobalError(err.message);
      throw err;
    } finally {
      setGlobalLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Register ───────────────────────────────────────────────────────────────
  const registerUser = useCallback(async (name, email, password) => {
    setGlobalLoading(true);
    setGlobalError(null);
    try {
      const data = await apiRegister({ name, email, password });
      return persistSession(data);
    } catch (err) {
      setGlobalError(err.message);
      throw err;
    } finally {
      setGlobalLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearStorage();
    clearRefreshToken();
    setUser(null);
    setGlobalError(null);
  }, []);

  // Keep ref in sync with the latest logout closure
  useEffect(() => { logoutRef.current = logout; }, [logout]);

  // ── Update cached user (e.g. profile edits) ────────────────────────────────
  const updateUser = useCallback((updates) => {
    setUser((prev) => {
      const updated = sanitiseUser({ ...prev, ...updates });
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearGlobalError = useCallback(() => setGlobalError(null), []);

  const isAuthenticated = !!user;
  const isAdmin         = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isAdmin, loading,
      globalLoading, globalError, clearGlobalError,
      login, registerUser, logout, updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
