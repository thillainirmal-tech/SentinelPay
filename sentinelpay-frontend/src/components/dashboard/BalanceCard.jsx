import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, CardContent, Box, Typography, IconButton,
  Tooltip, CircularProgress, Divider, Chip,
} from '@mui/material';
import RefreshIcon   from '@mui/icons-material/Refresh';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { getBalance } from '../../api/bankApi';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';

export default function BalanceCard() {
  const { user } = useAuth();
  const [balance, setBalance]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(null);

  const fetchBalance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBalance();
      setBalance(data);
    } catch (err) {
      setError('Unable to load balance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  return (
    <Card sx={{ background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)', color: 'white' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalanceWalletIcon sx={{ fontSize: 28, opacity: 0.9 }} />
            <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 600 }}>
              Account Balance
            </Typography>
          </Box>
          <Tooltip title="Refresh balance">
            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.7)' }} onClick={fetchBalance} disabled={loading}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ mt: 2, mb: 1 }}>
          {loading ? (
            <CircularProgress size={32} sx={{ color: 'rgba(255,255,255,0.7)' }} />
          ) : error ? (
            <Typography variant="body2" sx={{ opacity: 0.8 }}>{error}</Typography>
          ) : (
            <Typography variant="h3" fontWeight={800} letterSpacing="-1px">
              {formatCurrency(balance?.balance)}
            </Typography>
          )}
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 1.5 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>UPI ID</Typography>
            <Typography variant="body2" fontWeight={600}>{user?.upiId || balance?.upiId || '—'}</Typography>
          </Box>
          {balance?.accountStatus && (
            <Chip
              label={balance.accountStatus}
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 700, fontSize: '0.7rem' }}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
