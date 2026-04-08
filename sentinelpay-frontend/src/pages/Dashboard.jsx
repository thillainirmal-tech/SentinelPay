/**
 * Dashboard.jsx — Enhanced dashboard page (V3)
 *
 * V3 upgrades:
 *  - FraudExplanation panel shown in result area (WHY was this flagged)
 *  - TransactionTimeline shown alongside result (visual lifecycle)
 *  - Result panel expanded to accommodate new components
 *
 * V2 features retained:
 *  - Stats persist across navigation (via AppStateContext)
 *  - react-hook-form manages UPI form
 *  - RiskGauge for confidence score visualisation
 *  - AbortController for payee lookup cleanup
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Box, Grid, Typography, Card, CardContent,
  TextField, Button, MenuItem, Select, FormControl,
  InputLabel, CircularProgress, Divider,
  Collapse, Alert, Tabs, Tab,
  FormHelperText,
} from '@mui/material';
import SendIcon          from '@mui/icons-material/Send';
import PaymentIcon       from '@mui/icons-material/Payment';
import CheckCircleIcon   from '@mui/icons-material/CheckCircle';
import BlockIcon         from '@mui/icons-material/Block';
import HourglassTopIcon  from '@mui/icons-material/HourglassTop';
import AnalyticsIcon     from '@mui/icons-material/Analytics';
import TimelineIcon      from '@mui/icons-material/Timeline';
import toast             from 'react-hot-toast';

import { useAuth }           from '../context/AuthContext';
import { useAppState }       from '../context/AppStateContext';
import BalanceCard           from '../components/dashboard/BalanceCard';
import StatsCard             from '../components/dashboard/StatsCard';
import TransactionChart      from '../components/dashboard/TransactionChart';
import ActivityFeed          from '../components/dashboard/ActivityFeed';
import StatusBadge           from '../components/common/StatusBadge';
import RiskGauge             from '../components/fraud/RiskGauge';
import FraudExplanation      from '../components/fraud/FraudExplanation';
import TransactionTimeline   from '../components/fraud/TransactionTimeline';

import { sendUpiPayment, pollTransactionStatus } from '../api/transactionApi';
import { fetchFraudResultWithRetry }               from '../api/fraudApi';
import { getAccountByUpiId }                       from '../api/bankApi';
import { createAbortController }                   from '../api/axiosConfig';
import { formatCurrency, formatDateTime, normalizeTxRecord } from '../utils/formatters';

const PAYMENT_MODES = ['BANK', 'RAZORPAY'];
const POLL_INTERVAL = parseInt(process.env.REACT_APP_POLL_INTERVAL_MS || '3000', 10);
const POLL_ATTEMPTS = parseInt(process.env.REACT_APP_POLL_MAX_ATTEMPTS || '15', 10);

// ── UPI form validation rules (react-hook-form) ───────────────────────────────
const UPI_RULES = {
  payeeUpiId: {
    required:  'Payee UPI ID is required',
    pattern:   { value: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/, message: 'Enter a valid UPI ID (e.g. alice@upi)' },
  },
  amount: {
    required:  'Amount is required',
    min:       { value: 1, message: 'Minimum amount is ₹1' },
    max:       { value: 1000000, message: 'Maximum amount is ₹10,00,000' },
    validate:  (v) => !isNaN(parseFloat(v)) || 'Must be a valid number',
  },
};

export default function Dashboard() {
  const { user }                       = useAuth();
  const { stats, recordTransaction }   = useAppState();

  // Form
  const { control, register, handleSubmit, reset, watch, formState: { errors } } =
    useForm({ defaultValues: { payeeUpiId: '', amount: '', paymentMode: 'BANK' } });

  // State
  const [payeeInfo,     setPayeeInfo]     = useState(null);
  const [lookingUp,     setLookingUp]     = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [polling,       setPolling]       = useState(false);
  // fraudPolling: true while waiting for the Kafka async fraud result (may take several seconds)
  const [fraudPolling,  setFraudPolling]  = useState(false);
  const [result,        setResult]        = useState(null);
  const [resultTab,     setResultTab]     = useState(0);  // 0 = Explanation, 1 = Timeline

  const payeeUpiId      = watch('payeeUpiId');
  const lookupAbort     = useRef(null);
  // Abort controller for the fraud-result polling loop — cancelled on unmount
  const fraudPollAbort  = useRef(null);
  // Tracks whether the component is still mounted — prevents setState after unmount
  // when the user navigates away mid-poll.
  const isMountedRef    = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      lookupAbort.current?.abort();
      // Cancel any in-flight fraud poll when the component unmounts
      fraudPollAbort.current?.abort();
    };
  }, []);

  // ── Payee lookup on blur ──────────────────────────────────────────────────
  const handlePayeeLookup = useCallback(async () => {
    const upi = payeeUpiId?.trim();
    if (!upi || !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(upi)) return;

    lookupAbort.current?.abort();
    lookupAbort.current = createAbortController();

    setLookingUp(true);
    setPayeeInfo(null);
    try {
      const acc = await getAccountByUpiId(upi);
      setPayeeInfo(acc);
    } catch {
      // Silently ignore — backend validates on submit
    } finally {
      setLookingUp(false);
    }
  }, [payeeUpiId]);

  // ── Submit UPI payment ────────────────────────────────────────────────────
  const onSubmit = async (formData) => {
    setSubmitting(true);
    setResult(null);
    setResultTab(0);

    try {
      // Step 1: Submit payment (202 Accepted — queues Kafka event).
      // device / location / merchantCategory are required by the fraud-detection
      // ML pipeline; omitting them causes the backend to default to REVIEW.
      const resp = await sendUpiPayment({
        payeeUpiId:       formData.payeeUpiId.trim(),
        amount:           parseFloat(formData.amount),
        device:           'mobile',
        location:         'chennai',
        merchantCategory: formData.merchantCategory || 'grocery',
        paymentMode:      formData.paymentMode,
      });
      const txId = resp.transactionId;
      toast.success(`Payment submitted — ID: ${txId}`);

      // ── RAZORPAY: hand off to the hosted Thymeleaf payment page ───────────
      // The /pay endpoint is served directly by transaction-service (port 8081)
      // and is NOT routed through Nginx/Gateway — so we redirect the browser
      // there rather than polling.  PaymentResult.jsx handles status sync after
      // the user completes (or dismisses) the Razorpay modal.
      if (formData.paymentMode === 'RAZORPAY') {
        const paymentBase = process.env.REACT_APP_PAYMENT_PAGE_BASE_URL || 'http://localhost:8081';
        window.location.href = `${paymentBase}/pay?transactionId=${txId}`;
        return;   // browser navigates away; skip BANK polling path entirely
      }

      // Step 2: Poll transaction-service until overallStatus leaves PENDING
      setPolling(true);
      const txStatus = await pollTransactionStatus(txId, POLL_ATTEMPTS, POLL_INTERVAL);

      // Step 3: Poll for FraudResult from fraud-detection-service.
      //
      // The fraud pipeline is Kafka-async — GET /api/fraud/result/{id} returns
      // HTTP 202 until the event is processed (typically 2–8 seconds).
      // A single fetch would return null, leaving confidenceScore / detectionLayer
      // / reason / analyzedAt absent and the result panel showing incomplete data.
      //
      // fetchFraudResultWithRetry polls up to 12 × 3s = 36 seconds, returning the
      // raw FraudResult object on success or null if the pipeline is still delayed.
      let fraudResultData = null;
      try {
        // Cancel any prior poll (e.g. rapid re-submit) and create a fresh signal
        fraudPollAbort.current?.abort();
        fraudPollAbort.current = new AbortController();

        setFraudPolling(true);
        fraudResultData = await fetchFraudResultWithRetry(txId, {
          signal: fraudPollAbort.current.signal,
        });

        if (!fraudResultData) {
          // Kafka pipeline is still delayed after max retries — show a soft warning.
          // We still build a partial record from txStatus so the UI isn't empty.
          toast('Fraud analysis is delayed. The result may update shortly.', { icon: '⏳' });
        }
      } catch (err) {
        // Re-thrown 404 or unexpected error — show warning but don't block the UI
        if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
          toast('Fraud analysis unavailable. Please check Fraud Alerts for the final result.', { icon: '⚠️' });
        }
      } finally {
        if (isMountedRef.current) setFraudPolling(false);
      }

      // Guard: component may have unmounted while we were polling (user navigated away).
      // If so, skip all remaining state updates — AbortController already stopped
      // the network requests, but we still need to avoid calling setState here.
      if (!isMountedRef.current) return;

      // Step 4: Build a fully-normalized record using the single source-of-truth utility.
      // normalizeTxRecord merges both DTOs, resolves field-name inconsistencies
      // (FraudResult.status → fraudStatus), and guarantees all fields exist.
      const txRecord = normalizeTxRecord(
        { ...txStatus, transactionId: txId,
          amount:    txStatus.amount    ?? parseFloat(formData.amount),
          payeeUpiId: txStatus.payeeUpiId ?? formData.payeeUpiId.trim() },
        fraudResultData,
      );

      setResult(txRecord);

      // Step 5: Push to global state — updates Fraud Alerts, Analytics, and Stats
      recordTransaction(txRecord);

      // Step 6: Toast verdict
      if (txRecord.fraudStatus === 'FRAUD') {
        toast.error('Transaction BLOCKED — fraud detected!');
      } else if (txRecord.fraudStatus === 'REVIEW') {
        toast('Transaction flagged for REVIEW', { icon: '⚠️' });
      } else if (txRecord.overallStatus === 'COMPLETE') {
        toast.success('Payment completed successfully!');
      }

      reset();
      setPayeeInfo(null);
    } catch (err) {
      if (isMountedRef.current) {
        toast.error(err.message || 'Payment submission failed');
      }
    } finally {
      if (isMountedRef.current) {
        setSubmitting(false);
        setPolling(false);
      }
    }
  };

  // ── Status icon ───────────────────────────────────────────────────────────
  const statusIcon = (status) => {
    if (status === 'COMPLETE') return <CheckCircleIcon color="success" />;
    if (['BLOCKED', 'FAILED', 'CRITICAL'].includes(status)) return <BlockIcon color="error" />;
    return <HourglassTopIcon color="warning" />;
  };

  const resultBorderColor = result
    ? result.fraudStatus === 'SAFE' ? 'success.light' : result.fraudStatus === 'FRAUD' ? 'error.light' : 'warning.light'
    : 'divider';

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        Welcome back, {user?.name?.split(' ')[0]} 👋
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Here's your SentinelPay fraud detection dashboard.
      </Typography>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={4}>
          <BalanceCard />
        </Grid>
        <Grid item xs={6} sm={4} md={2.67}>
          <StatsCard icon={<CheckCircleIcon />} title="Safe"          value={stats.safe}    color="success" />
        </Grid>
        <Grid item xs={6} sm={4} md={2.67}>
          <StatsCard icon={<BlockIcon />}        title="Blocked"       value={stats.blocked} color="error" />
        </Grid>
        <Grid item xs={6} sm={4} md={2.67}>
          <StatsCard icon={<PaymentIcon />}      title="Under Review"  value={stats.review}  color="warning" />
        </Grid>
      </Grid>

      {/* ── UPI send + result ─────────────────────────────────────────────── */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <SendIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>Send Money (UPI)</Typography>
              </Box>

              <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                {/* Payee UPI */}
                <TextField
                  fullWidth
                  label="Payee UPI ID"
                  placeholder="alice@upi"
                  {...register('payeeUpiId', UPI_RULES.payeeUpiId)}
                  onBlur={handlePayeeLookup}
                  error={!!errors.payeeUpiId}
                  helperText={errors.payeeUpiId?.message || 'e.g. alice@upi'}
                  sx={{ mb: 1.5 }}
                  InputProps={{
                    endAdornment: lookingUp && <CircularProgress size={18} />,
                  }}
                />

                {payeeInfo && (
                  <Alert severity="info" sx={{ mb: 1.5, borderRadius: 2, py: 0.5 }}>
                    Payee resolved: <strong>{payeeInfo.name || payeeInfo.userId}</strong>
                  </Alert>
                )}

                {/* Amount */}
                <TextField
                  fullWidth
                  label="Amount (₹)"
                  type="number"
                  {...register('amount', UPI_RULES.amount)}
                  error={!!errors.amount}
                  helperText={errors.amount?.message || 'Amounts above ₹10,000 trigger fraud review'}
                  sx={{ mb: 1.5 }}
                  inputProps={{ min: 1, step: '0.01' }}
                />

                {/* Payment mode */}
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Payment Mode</InputLabel>
                  <Controller
                    name="paymentMode"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} label="Payment Mode">
                        {PAYMENT_MODES.map((m) => (
                          <MenuItem key={m} value={m}>{m}</MenuItem>
                        ))}
                      </Select>
                    )}
                  />
                </FormControl>

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={submitting || polling || fraudPolling}
                  startIcon={
                    (submitting || polling || fraudPolling)
                      ? <CircularProgress size={20} color="inherit" />
                      : <SendIcon />
                  }
                  sx={{ py: 1.5 }}
                >
                  {fraudPolling  ? 'Detecting fraud…'
                   : polling     ? 'Analysing…'
                   : submitting  ? 'Submitting…'
                   :               'Send Payment'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Result panel — V3: FraudExplanation + TransactionTimeline tabs */}
        <Grid item xs={12} md={6}>
          <Collapse in={!!result} unmountOnExit>
            {result && (
              <Card sx={{ border: '2px solid', borderColor: resultBorderColor }}>
                <CardContent sx={{ p: 0 }}>
                  {/* Quick header */}
                  <Box sx={{ px: 3, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    {statusIcon(result.overallStatus)}
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" fontWeight={700} lineHeight={1}>Transaction Result</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {result.transactionId?.slice(0, 16)}…
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, flexDirection: 'column', alignItems: 'flex-end' }}>
                      <StatusBadge type="fraud"   status={result.fraudStatus}   size="small" />
                      <StatusBadge type="overall" status={result.overallStatus} size="small" />
                    </Box>
                  </Box>

                  {/* Risk gauge + key metadata */}
                  <Box sx={{ px: 3, py: 1.5, display: 'flex', gap: 2, alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <RiskGauge
                      score={result.confidenceScore ?? (result.fraudStatus === 'FRAUD' ? 0.85 : result.fraudStatus === 'REVIEW' ? 0.5 : 0.1)}
                      size={0.75}
                    />
                    <Box sx={{ flexGrow: 1 }}>
                      {[
                        ['Amount',    formatCurrency(result.amount)],
                        ['Payee',     result.payeeUpiId || '—'],
                        ['Settled',   formatDateTime(result.analyzedAt)],
                      ].map(([label, value]) => (
                        <Box key={label} sx={{ mb: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">{label}</Typography>
                          <Typography variant="body2" fontWeight={600} fontSize="0.8rem">{value || '—'}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  {/* Tabs: Explanation | Timeline */}
                  <Tabs
                    value={resultTab}
                    onChange={(_, v) => setResultTab(v)}
                    sx={{ borderBottom: '1px solid', borderColor: 'divider', minHeight: 40 }}
                    TabIndicatorProps={{ sx: { height: 3 } }}
                  >
                    <Tab
                      label="Why Flagged?"
                      icon={<AnalyticsIcon sx={{ fontSize: 16 }} />}
                      iconPosition="start"
                      sx={{ minHeight: 40, fontSize: '0.8rem', textTransform: 'none', fontWeight: 600 }}
                    />
                    <Tab
                      label="Timeline"
                      icon={<TimelineIcon sx={{ fontSize: 16 }} />}
                      iconPosition="start"
                      sx={{ minHeight: 40, fontSize: '0.8rem', textTransform: 'none', fontWeight: 600 }}
                    />
                  </Tabs>

                  <Box sx={{ p: 2, maxHeight: 320, overflowY: 'auto' }}>
                    {resultTab === 0 && (
                      <FraudExplanation result={{
                        transactionId:   result.transactionId,
                        fraudStatus:     result.fraudStatus,
                        reason:          result.reason,
                        confidenceScore: result.confidenceScore,
                        detectionLayer:  result.detectionLayer,
                        reviewNotes:     result.reviewNotes,
                        analyzedAt:      result.analyzedAt,
                      }} />
                    )}
                    {resultTab === 1 && (
                      <TransactionTimeline
                        result={{
                          fraudStatus:    result.fraudStatus,
                          detectionLayer: result.detectionLayer,
                        }}
                        loading={false}
                        txId={result.transactionId}
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            )}
          </Collapse>

          {/* Polling in-progress — show timeline in "active" state */}
          {!result && (polling || fraudPolling) && (
            <Card sx={{ border: '2px solid', borderColor: 'primary.light' }}>
              <CardContent sx={{ p: 3 }}>
                {/* Phase-specific status message above the timeline */}
                <Alert
                  severity="info"
                  sx={{ mb: 2, borderRadius: 2 }}
                  icon={<CircularProgress size={16} color="inherit" />}
                >
                  {fraudPolling
                    ? 'Analyzing transaction… Fraud detection is processing your payment.'
                    : 'Submitting to payment network…'}
                </Alert>
                <TransactionTimeline result={null} loading={true} txId={null} />
              </CardContent>
            </Card>
          )}

          {!result && !polling && (
            <Box sx={{ height: '100%', minHeight: 240, border: '2px dashed', borderColor: 'divider', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1, color: 'text.secondary' }}>
              <PaymentIcon sx={{ fontSize: 48, opacity: 0.2 }} />
              <Typography variant="body2">Transaction result will appear here</Typography>
              <Typography variant="caption" color="text.disabled">Submit a payment above</Typography>
            </Box>
          )}
        </Grid>
      </Grid>

      {/* ── Charts + Activity feed ────────────────────────────────────────── */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <TransactionChart />
        </Grid>
        <Grid item xs={12} md={7}>
          <ActivityFeed />
        </Grid>
      </Grid>
    </Box>
  );
}
