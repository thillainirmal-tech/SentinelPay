import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Avatar,
  TextField, Button, Divider, Chip, CircularProgress,
  Alert, List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import PersonIcon           from '@mui/icons-material/Person';
import EmailIcon            from '@mui/icons-material/Email';
import AccountBalanceIcon   from '@mui/icons-material/AccountBalance';
import SecurityIcon         from '@mui/icons-material/Security';
import CheckCircleIcon      from '@mui/icons-material/CheckCircle';
import toast                from 'react-hot-toast';
import { useAuth }          from '../context/AuthContext';
import { getBalance }       from '../api/bankApi';
import { formatCurrency }   from '../utils/formatters';

export default function Profile() {
  const { user } = useAuth();

  const [balance, setBalance]   = useState(null);
  const [balLoading, setBalLoading] = useState(true);

  useEffect(() => {
    getBalance()
      .then(setBalance)
      .catch(() => {})
      .finally(() => setBalLoading(false));
  }, []);

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>Profile</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Your account information and security settings.
      </Typography>

      <Grid container spacing={3}>
        {/* User card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>
              <Avatar
                sx={{
                  width: 88,
                  height: 88,
                  bgcolor: 'primary.main',
                  fontSize: '2rem',
                  fontWeight: 800,
                  mx: 'auto',
                  mb: 2,
                }}
              >
                {initials}
              </Avatar>

              <Typography variant="h6" fontWeight={700}>{user?.name}</Typography>
              <Typography variant="body2" color="text.secondary" mb={1}>{user?.email}</Typography>

              <Chip
                label={user?.upiId || '—'}
                variant="outlined"
                color="primary"
                sx={{ fontWeight: 600, mb: 2 }}
              />

              <Divider sx={{ my: 2 }} />

              <List dense disablePadding>
                <ListItem disableGutters>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <AccountBalanceIcon fontSize="small" color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Balance"
                    secondary={balLoading ? '…' : formatCurrency(balance?.balance)}
                    primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                    secondaryTypographyProps={{ variant: 'body2', fontWeight: 700, color: 'text.primary' }}
                  />
                </ListItem>

                <ListItem disableGutters>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <SecurityIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Account Status"
                    secondary={balance?.accountStatus || 'ACTIVE'}
                    primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                    secondaryTypographyProps={{ variant: 'body2', fontWeight: 700, color: 'success.main' }}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Account details */}
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} mb={2}>Account Details</Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Full Name"
                    value={user?.name || ''}
                    InputProps={{ readOnly: true }}
                    variant="filled"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email Address"
                    value={user?.email || ''}
                    InputProps={{ readOnly: true }}
                    variant="filled"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="UPI ID"
                    value={user?.upiId || balance?.upiId || '—'}
                    InputProps={{ readOnly: true }}
                    variant="filled"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Account Balance"
                    value={balLoading ? 'Loading…' : formatCurrency(balance?.balance)}
                    InputProps={{ readOnly: true }}
                    variant="filled"
                  />
                </Grid>
              </Grid>

              <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                Profile editing is managed by the auth service. Contact support to update your name or email.
              </Alert>
            </CardContent>
          </Card>

          {/* Security features */}
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} mb={2}>Security Features</Typography>

              {[
                {
                  title:   'JWT Authentication',
                  desc:    'All requests use short-lived Bearer tokens validated at the API Gateway.',
                  enabled: true,
                },
                {
                  title:   'Rate Limiting',
                  desc:    'Maximum 5 transaction submissions per 60 seconds to prevent abuse.',
                  enabled: true,
                },
                {
                  title:   '3-Layer Fraud Detection',
                  desc:    'Rule engine → behaviour history (Redis) → AI (OpenAI GPT) pipeline on every transaction.',
                  enabled: true,
                },
                {
                  title:   'Distributed Tracing',
                  desc:    'Every transaction tagged with a trace ID across all 6 microservices.',
                  enabled: true,
                },
                {
                  title:   'Email Notifications',
                  desc:    'Alerts sent for every fraud verdict via the notification service.',
                  enabled: true,
                },
                {
                  title:   'Dead Letter Queue',
                  desc:    'Failed transactions are routed to DLQ for investigation and replay.',
                  enabled: true,
                },
              ].map(({ title, desc, enabled }) => (
                <Box
                  key={title}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 2,
                    mb: 2,
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'grey.50',
                  }}
                >
                  <CheckCircleIcon color="success" sx={{ mt: 0.3, flexShrink: 0 }} />
                  <Box>
                    <Typography variant="body2" fontWeight={700}>{title}</Typography>
                    <Typography variant="caption" color="text.secondary">{desc}</Typography>
                  </Box>
                  <Chip
                    label="Active"
                    size="small"
                    color="success"
                    sx={{ ml: 'auto', flexShrink: 0, fontWeight: 700 }}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
