/**
 * Login.jsx — Upgraded with react-hook-form and DOMPurify sanitisation
 *
 * Replaces manual useState validation with react-hook-form's register/errors.
 * Input values are sanitised via DOMPurify before being passed to the API.
 */

import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Box, Card, CardContent, TextField, Button,
  Typography, Link, InputAdornment, IconButton,
  CircularProgress, Divider, Alert,
} from '@mui/material';
import Visibility     from '@mui/icons-material/Visibility';
import VisibilityOff  from '@mui/icons-material/VisibilityOff';
import SecurityIcon   from '@mui/icons-material/Security';
import DOMPurify      from 'dompurify';
import toast          from 'react-hot-toast';
import { useAuth }    from '../context/AuthContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PWD_PATTERN   = /^(?=.*[0-9]).{6,}$/;

const FIELD_RULES = {
  email: {
    required: 'Email is required',
    pattern:  { value: EMAIL_PATTERN, message: 'Enter a valid email address' },
  },
  password: {
    required:  'Password is required',
    minLength: { value: 6, message: 'Minimum 6 characters' },
  },
};

export default function Login() {
  const { login }   = useAuth();
  const navigate    = useNavigate();
  const [showPwd, setShowPwd]   = useState(false);
  const [apiError, setApiError] = useState('');
  const [loading,  setLoading]  = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    // Sanitise before sending — prevents XSS in error responses from injecting
    const email    = DOMPurify.sanitize(data.email.trim());
    const password = data.password; // passwords must not be sanitised (would corrupt special chars)

    setLoading(true);
    setApiError('');
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setApiError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        {/* Brand */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <SecurityIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            <Typography variant="h4" fontWeight={800} color="primary.main">SentinelPay</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            AI-Powered Real-Time Fraud Detection
          </Typography>
        </Box>

        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" fontWeight={700} mb={0.5}>Sign in</Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Don't have an account?{' '}
              <Link component={RouterLink} to="/register" fontWeight={600}>Create one</Link>
            </Typography>

            {apiError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{apiError}</Alert>
            )}

            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <TextField
                fullWidth
                label="Email address"
                type="email"
                autoComplete="email"
                autoFocus
                {...register('email', FIELD_RULES.email)}
                error={!!errors.email}
                helperText={errors.email?.message}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Password"
                type={showPwd ? 'text' : 'password'}
                autoComplete="current-password"
                {...register('password', FIELD_RULES.password)}
                error={!!errors.password}
                helperText={errors.password?.message}
                sx={{ mb: 3 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPwd((p) => !p)} edge="end" size="small">
                        {showPwd ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                sx={{ py: 1.5, fontSize: '1rem' }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign in'}
              </Button>
            </Box>

            <Divider sx={{ my: 3 }}>
              <Typography variant="caption" color="text.secondary">Security info</Typography>
            </Divider>
            <Box sx={{ bgcolor: 'grey.50', borderRadius: 2, p: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                🔒 Sessions use short-lived JWT tokens. You'll be signed out automatically when your token expires.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
