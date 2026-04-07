import React, { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, TextField,
  Button, MenuItem, Select, FormControl, InputLabel,
  CircularProgress, Divider, Chip, Alert,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Tooltip,
  Collapse,
} from '@mui/material';
import SearchIcon       from '@mui/icons-material/Search';
import SendIcon         from '@mui/icons-material/Send';
import RefreshIcon      from '@mui/icons-material/Refresh';
import ExpandMoreIcon   from '@mui/icons-material/ExpandMore';
import ExpandLessIcon   from '@mui/icons-material/ExpandLess';
import toast            from 'react-hot-toast';
import StatusBadge      from '../components/common/StatusBadge';
import { submitTransaction, getTransactionStatus, pollTransactionStatus } from '../api/transactionApi';
import { formatCurrency, formatDateTime, truncateTxId, detectionLayerLabel, formatConfidence } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

const MERCHANT_CATEGORIES = ['Food', 'Electronics', 'Travel', 'Healthcare', 'Entertainment', 'Utilities', 'Other'];

function ResultRow({ tx }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <Tooltip title={tx.transactionId}>
            <Typography variant="body2" fontWeight={600} fontFamily="monospace">
              {truncateTxId(tx.transactionId, 14)}
            </Typography>
          </Tooltip>
        </TableCell>
        <TableCell>{formatCurrency(tx.amount)}</TableCell>
        <TableCell>{tx.location || '—'}</TableCell>
        <TableCell>{tx.merchantCategory || '—'}</TableCell>
        <TableCell>
          {tx.fraudStatus
            ? <StatusBadge type="fraud" status={tx.fraudStatus} />
            : <Chip label="PENDING" size="small" />}
        </TableCell>
        <TableCell>
          {tx.overallStatus
            ? <StatusBadge type="overall" status={tx.overallStatus} />
            : '—'}
        </TableCell>
        <TableCell>{formatDateTime(tx.submittedAt)}</TableCell>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={8} sx={{ py: 0 }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Detection Layer</Typography>
                  <Typography variant="body2" fontWeight={600}>{detectionLayerLabel(tx.detectionLayer) || '—'}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Confidence</Typography>
                  <Typography variant="body2" fontWeight={600}>{formatConfidence(tx.confidenceScore)}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Device</Typography>
                  <Typography variant="body2" fontWeight={600}>{tx.device || '—'}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Analyzed At</Typography>
                  <Typography variant="body2" fontWeight={600}>{formatDateTime(tx.analyzedAt)}</Typography>
                </Grid>
                {tx.reason && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Reason</Typography>
                    <Typography variant="body2">{tx.reason}</Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function Transactions() {
  const { user } = useAuth();

  // Legacy transaction submit form
  const [form, setForm] = useState({
    transactionId: '', amount: '', location: '', device: '', merchantCategory: 'Food',
  });
  const [submitting, setSubmitting]   = useState(false);
  const [polling, setPolling]         = useState(false);

  // Poll-by-ID form
  const [pollId, setPollId]           = useState('');
  const [pollLoading, setPollLoading] = useState(false);
  const [pollResult, setPollResult]   = useState(null);

  // Transaction history (session-local)
  const [history, setHistory] = useState([]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.transactionId || !form.amount) {
      toast.error('Transaction ID and Amount are required');
      return;
    }

    const payload = {
      transactionId:    form.transactionId.trim(),
      userId:           user.email,
      amount:           parseFloat(form.amount),
      location:         form.location || 'Unknown',
      device:           form.device   || 'Web',
      merchantCategory: form.merchantCategory,
    };

    setSubmitting(true);
    try {
      await submitTransaction(payload);
      toast.success('Transaction submitted for fraud analysis');

      const entry = { ...payload, submittedAt: new Date().toISOString() };
      setHistory((prev) => [entry, ...prev]);

      // Poll for result
      setPolling(true);
      const final = await pollTransactionStatus(payload.transactionId);
      setHistory((prev) =>
        prev.map((t) => t.transactionId === payload.transactionId ? { ...t, ...final } : t)
      );

      if (final.fraudStatus === 'FRAUD')  toast.error('Transaction BLOCKED — fraud detected!');
      else if (final.fraudStatus === 'REVIEW') toast('Under REVIEW', { icon: '⚠️' });
      else toast.success('Transaction SAFE — approved');

      setForm({ transactionId: '', amount: '', location: '', device: '', merchantCategory: 'Food' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
      setPolling(false);
    }
  };

  const handlePoll = async () => {
    if (!pollId.trim()) return;
    setPollLoading(true);
    setPollResult(null);
    try {
      const result = await getTransactionStatus(pollId.trim());
      setPollResult(result);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transaction not found');
    } finally {
      setPollLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>Transactions</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Submit transactions and track fraud analysis results.
      </Typography>

      <Grid container spacing={3}>
        {/* Submit transaction */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <SendIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>Submit Transaction</Typography>
              </Box>

              <Box component="form" onSubmit={handleSubmit} noValidate>
                <TextField
                  fullWidth label="Transaction ID" name="transactionId"
                  value={form.transactionId} onChange={handleFormChange}
                  helperText="e.g. TXN-001 (must be unique)" sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth label="Amount (₹)" name="amount" type="number"
                  value={form.amount} onChange={handleFormChange}
                  inputProps={{ min: 1, step: '0.01' }} sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth label="Location" name="location"
                  value={form.location} onChange={handleFormChange}
                  helperText="City or IP address" sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth label="Device" name="device"
                  value={form.device} onChange={handleFormChange}
                  helperText="e.g. iPhone-14, Android-Samsung" sx={{ mb: 2 }}
                />
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Merchant Category</InputLabel>
                  <Select name="merchantCategory" value={form.merchantCategory}
                    label="Merchant Category" onChange={handleFormChange}>
                    {MERCHANT_CATEGORIES.map((c) => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  type="submit" variant="contained" fullWidth size="large"
                  disabled={submitting || polling}
                  startIcon={(submitting || polling) ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                  sx={{ py: 1.5 }}
                >
                  {polling ? 'Analysing…' : submitting ? 'Submitting…' : 'Submit Transaction'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Poll by ID */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <SearchIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>Check Transaction Status</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  fullWidth label="Transaction ID" value={pollId}
                  onChange={(e) => setPollId(e.target.value)}
                  placeholder="TXN-001"
                  onKeyDown={(e) => e.key === 'Enter' && handlePoll()}
                />
                <Button
                  variant="contained" onClick={handlePoll} disabled={pollLoading}
                  sx={{ minWidth: 56, px: 2 }}
                >
                  {pollLoading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                </Button>
              </Box>

              {pollResult && (
                <Box sx={{ bgcolor: 'grey.50', borderRadius: 2, p: 2 }}>
                  {[
                    ['ID',           truncateTxId(pollResult.transactionId, 20)],
                    ['Amount',       formatCurrency(pollResult.amount)],
                    ['Payer',        pollResult.payerEmail || '—'],
                    ['Payee UPI',    pollResult.payeeUpiId || '—'],
                  ].map(([label, value]) => (
                    <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                      <Typography variant="body2" color="text.secondary">{label}</Typography>
                      <Typography variant="body2" fontWeight={600}>{value}</Typography>
                    </Box>
                  ))}
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                    <Typography variant="body2" color="text.secondary">Fraud Verdict</Typography>
                    <StatusBadge type="fraud" status={pollResult.fraudStatus} />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Overall Status</Typography>
                    <StatusBadge type="overall" status={pollResult.overallStatus} />
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Transaction history table */}
      {history.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700} mb={2}>This Session</Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    {['Transaction ID', 'Amount', 'Location', 'Category', 'Fraud', 'Status', 'Submitted', ''].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.78rem' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((tx) => <ResultRow key={tx.transactionId} tx={tx} />)}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
