/**
 * Register.jsx — Upgraded with react-hook-form and password strength indicator
 */

import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Box, Card, CardContent, TextField, Button,
  Typography, Link, InputAdornment, IconButton,
  CircularProgress, Alert, LinearProgress, Tooltip,
} from '@mui/material';
import Visibility    from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import SecurityIcon  from '@mui/icons-material/Security';
import InfoOutlined  from '@mui/icons-material/InfoOutlined';
import DOMPurify     from 'dompurify';
import toast         from 'react-hot-toast';
import { useAuth }   from '../context/AuthContext';

// ── Password strength ─────────────────────────────────────────────────────────
function passwordStrength(pwd = '') {
  let score = 0;
  if (pwd.length >= 6)                              score += 25;
  if (pwd.length >= 10)                             score += 25;
  if (/[0-9]/.test(pwd))                            score += 25;
  if (/[A-Z]/.test(pwd))                            score += 15;
  if (/[!@#$%^&*()_+\-=[\]{}|;]/.test(pwd))        score += 10;
  return Math.min(score, 100);
}
function strengthLabel(score) {
  if (score <= 25) return { label: 'Weak',   color: 'error' };
  if (score <= 50) return { label: 'Fair',   color: 'warning' };
  if (score <= 75) return { label: 'Good',   color: 'info' };
  return              { label: 'Strong', color: 'success' };
}

// ── Validation rules ──────────────────────────────────────────────────────────
const RULES = {
  name: {
    required:  'Name is required',
    minLength: { value: 2,   message: 'At least 2 characters' },
    maxLength: { value: 100, message: 'At most 100 characters' },
  },
  email: {
    required: 'Email is required',
    pattern:  { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
  },
  password: {
    required: 'Password is required',
    pattern:  {
      value:   /^(?=.*[0-9]).{6,}$/,
      message: 'Min 6 characters, at least 1 digit',
    },
  },
};

export default function Register() {
  const { registerUser } = useAuth();
  const navigate         = useNavigate();

  const [showPwd,  setShowPwd]  = useState(false);
  const [apiError, setApiError] = useState('');
  const [loading,  setLoading]  = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const passwordVal = watch('password', '');
  const pwdScore    = passwordStrength(passwordVal);
  const { label: pwdLabel, color: pwdColor } = strengthLabel(pwdScore);

  const onSubmit = async (data) => {
    if (data.password !== data.confirm) {
      setApiError('Passwords do not match');
      return;
    }

    const name  = DOMPurify.sanitize(data.name.trim());
    const email = DOMPurify.sanitize(data.email.trim());

    setLoading(true);
    setApiError('');
    try {
      const result = await registerUser(name, email, data.password);
      toast.success(`Welcome, ${result.name}! Your UPI ID is ${result.upiId}`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setApiError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 2 }}>
      <Box sx={{ width: '100%', maxWidth: 480 }}>
        {/* Brand */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <SecurityIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            <Typography variant="h4" fontWeight={800} color="primary.main">SentinelPay</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">Create your account</Typography>
        </Box>

        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" fontWeight={700} mb={0.5}>Create account</Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Already have an account?{' '}
              <Link component={RouterLink} to="/login" fontWeight={600}>Sign in</Link>
            </Typography>

            {apiError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{apiError}</Alert>}

            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <TextField
                fullWidth
                label="Full name"
                autoFocus
                {...register('name', RULES.name)}
                error={!!errors.name}
                helperText={errors.name?.message}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Email address"
                type="email"
                autoComplete="email"
                {...register('email', RULES.email)}
                error={!!errors.email}
                helperText={errors.email?.message}
                sx={{ mb: 2 }}
              />

              {/* Password with strength meter */}
              <TextField
                fullWidth
                label="Password"
                type={showPwd ? 'text' : 'password'}
                {...register('password', RULES.password)}
                error={!!errors.password}
                helperText={errors.password?.message || 'Min 6 characters, at least 1 digit'}
                sx={{ mb: passwordVal ? 0.5 : 2 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Min 6 chars, at least 1 digit">
                        <InfoOutlined fontSize="small" sx={{ mr: 0.5, opacity: 0.4 }} />
                      </Tooltip>
                      <IconButton onClick={() => setShowPwd((p) => !p)} edge="end" size="small">
                        {showPwd ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {passwordVal && (
                <Box sx={{ mb: 2, mt: 0.5 }}>
                  <LinearProgress
                    variant="determinate"
                    value={pwdScore}
                    color={pwdColor}
                    sx={{ borderRadius: 4, height: 5 }}
                  />
                  <Typography variant="caption" color={`${pwdColor}.main`} sx={{ float: 'right' }}>
                    {pwdLabel}
                  </Typography>
                </Box>
              )}

              <TextField
                fullWidth
                label="Confirm password"
                type={showPwd ? 'text' : 'password'}
                {...register('confirm', { required: 'Please confirm your password' })}
                error={!!errors.confirm}
                helperText={errors.confirm?.message}
                sx={{ mb: 3 }}
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                sx={{ py: 1.5, fontSize: '1rem' }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Create account'}
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={2}>
          A bank account and UPI ID are created automatically on registration.
        </Typography>
      </Box>
    </Box>
  );
}
