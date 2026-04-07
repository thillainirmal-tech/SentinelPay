import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { useAuth } from '../context/AuthContext';

/**
 * AdminRoute — wraps routes that require the ADMIN role.
 *
 * Unauthenticated users   → /login
 * Authenticated non-admin → 403 inline (not a redirect, to preserve history)
 */
export default function AdminRoute() {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2,
          p: 4,
          textAlign: 'center',
        }}
      >
        <LockIcon sx={{ fontSize: 72, color: 'text.disabled' }} />
        <Typography variant="h5" fontWeight={700}>Access Restricted</Typography>
        <Typography variant="body2" color="text.secondary" maxWidth={360}>
          You don't have administrator privileges to access this page.
          Contact your system administrator to request access.
        </Typography>
        <Button variant="contained" href="/dashboard">Back to Dashboard</Button>
      </Box>
    );
  }

  return <Outlet />;
}
