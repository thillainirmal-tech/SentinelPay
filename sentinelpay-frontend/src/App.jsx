/**
 * App.jsx — Root router with lazy loading and role-based routing (V3)
 *
 * V3 additions:
 *  - /analytics route (PrivateRoute — all authenticated users can view)
 *  - GlobalLoadingBar mounted outside Routes so it persists across navigation
 *
 * Route structure:
 *   /login, /register          → PublicRoute  (redirect if authenticated)
 *   /dashboard, /transactions,
 *   /fraud-alerts, /profile,
 *   /analytics                 → PrivateRoute (redirect if NOT authenticated)
 *   /admin                     → AdminRoute   (redirect if not ADMIN role)
 */

import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import PrivateRoute              from './routes/PrivateRoute';
import PublicRoute               from './routes/PublicRoute';
import AdminRoute                from './routes/AdminRoute';
import { PageLoadingFallback }   from './components/common/PageSkeleton';
import ErrorBoundary             from './components/common/ErrorBoundary';
import GlobalLoadingBar          from './components/common/GlobalLoadingBar';

// ── Lazy page imports ─────────────────────────────────────────────────────────
const Login         = lazy(() => import('./pages/Login'));
const Register      = lazy(() => import('./pages/Register'));
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Transactions  = lazy(() => import('./pages/Transactions'));
const FraudAlerts   = lazy(() => import('./pages/FraudAlerts'));
const Profile       = lazy(() => import('./pages/Profile'));
const Analytics     = lazy(() => import('./pages/Analytics'));
const AdminPanel    = lazy(() => import('./pages/admin/AdminPanel'));
const AppLayout     = lazy(() => import('./components/layout/AppLayout'));
const NotFound      = lazy(() => import('./pages/NotFound'));
// PaymentResult is intentionally NOT behind PrivateRoute — the browser arrives
// here via a Razorpay redirect immediately after payment, before the React app
// has had a chance to restore the JWT from localStorage.
const PaymentResult = lazy(() => import('./pages/PaymentResult'));

// ── Suspense + ErrorBoundary wrapper ──────────────────────────────────────────
function SuspensePage({ children }) {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </Suspense>
  );
}

export default function App() {
  return (
    <>
      {/* Top-of-page loading bar — listens to sentinelpay:request:* events */}
      <GlobalLoadingBar />

      <Routes>
        {/* ── Public routes ─────────────────────────────────────────────────── */}
        <Route element={<PublicRoute />}>
          <Route path="/login"    element={<SuspensePage><Login /></SuspensePage>} />
          <Route path="/register" element={<SuspensePage><Register /></SuspensePage>} />
        </Route>

        {/* ── Authenticated user routes ──────────────────────────────────────── */}
        <Route element={<PrivateRoute />}>
          <Route
            element={
              <Suspense fallback={<Box sx={{ minHeight: '100vh' }} />}>
                <AppLayout />
              </Suspense>
            }
          >
            <Route path="/dashboard"    element={<SuspensePage><Dashboard /></SuspensePage>} />
            <Route path="/transactions" element={<SuspensePage><Transactions /></SuspensePage>} />
            <Route path="/fraud-alerts" element={<SuspensePage><FraudAlerts /></SuspensePage>} />
            <Route path="/profile"      element={<SuspensePage><Profile /></SuspensePage>} />
            <Route path="/analytics"    element={<SuspensePage><Analytics /></SuspensePage>} />
          </Route>
        </Route>

        {/* ── Admin-only routes ──────────────────────────────────────────────── */}
        <Route element={<AdminRoute />}>
          <Route
            element={
              <Suspense fallback={<Box sx={{ minHeight: '100vh' }} />}>
                <AppLayout />
              </Suspense>
            }
          >
            <Route path="/admin" element={<SuspensePage><AdminPanel /></SuspensePage>} />
          </Route>
        </Route>

        {/* ── Razorpay payment result — public, no auth required ─────────────── */}
        {/* Backend redirects here after POST /api/razorpay/verify succeeds/fails */}
        <Route
          path="/payment-result"
          element={<SuspensePage><PaymentResult /></SuspensePage>}
        />

        {/* ── Default redirects ──────────────────────────────────────────────── */}
        <Route path="/"  element={<Navigate to="/dashboard" replace />} />
        <Route path="*"  element={<SuspensePage><NotFound /></SuspensePage>} />
      </Routes>
    </>
  );
}
