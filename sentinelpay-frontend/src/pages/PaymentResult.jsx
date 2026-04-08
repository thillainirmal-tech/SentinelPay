/**
 * PaymentResult.jsx
 *
 * Landing page after a Razorpay payment redirect.
 *
 * URL shape produced by RazorpayWebhookController.verifyPayment:
 *   /payment-result?transactionId=<id>&status=success
 *   /payment-result?transactionId=<id>&status=failed
 *
 * Flow:
 *   1. Read ?transactionId and ?status from the URL.
 *   2. If status=success, poll GET /api/transactions/{id} until terminal state.
 *   3. Render the result — fraud verdict, payment status, amounts, participants.
 *   4. "Go to Dashboard" button to return to the React app.
 *
 * No authentication is required — the URL is opened by a browser redirect from
 * the backend after Razorpay payment, so the JWT may not be present in memory
 * yet. The page therefore also handles the case where the poll returns 401 by
 * showing the status that was already embedded in the redirect URL.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon     from '@mui/icons-material/CancelOutlined';
import GppBadOutlinedIcon     from '@mui/icons-material/GppBadOutlined';
import HourglassTopIcon       from '@mui/icons-material/HourglassTop';
import { getTransactionStatus } from '../api/transactionApi';
import { useAppState }          from '../context/AppStateContext';
import { normalizeTxRecord }    from '../utils/formatters';

// ── Poll config ──────────────────────────────────────────────────────────────
const MAX_POLL_ATTEMPTS = 12;   // 12 × 3 s = 36 s maximum
const POLL_INTERVAL_MS  = 3000;

// ── Helpers ──────────────────────────────────────────────────────────────────
const TERMINAL = new Set(['COMPLETE', 'FAILED', 'BLOCKED', 'COMPENSATED', 'CRITICAL']);

function isTerminal(overallStatus) {
  return TERMINAL.has(overallStatus);
}

function statusMeta(overallStatus, razorpayStatus) {
  // razorpayStatus = 'success' | 'failed' from URL param (fast path before poll finishes)
  if (overallStatus === 'COMPLETE')     return { icon: <CheckCircleOutlineIcon sx={{ fontSize: 64, color: 'success.main' }} />, label: 'Payment Successful',  color: 'success' };
  if (overallStatus === 'BLOCKED')      return { icon: <GppBadOutlinedIcon     sx={{ fontSize: 64, color: 'error.main'   }} />, label: 'Payment Blocked',     color: 'error'   };
  if (overallStatus === 'FAILED')       return { icon: <CancelOutlinedIcon     sx={{ fontSize: 64, color: 'error.main'   }} />, label: 'Payment Failed',      color: 'error'   };
  if (overallStatus === 'COMPENSATED')  return { icon: <CheckCircleOutlineIcon sx={{ fontSize: 64, color: 'warning.main' }} />, label: 'Payment Refunded',    color: 'warning' };
  if (overallStatus === 'CRITICAL')     return { icon: <CancelOutlinedIcon     sx={{ fontSize: 64, color: 'error.main'   }} />, label: 'Settlement Error',    color: 'error'   };

  // fallback from URL ?status param while we wait for the poll
  if (razorpayStatus === 'success')     return { icon: <CheckCircleOutlineIcon sx={{ fontSize: 64, color: 'success.main' }} />, label: 'Payment Confirmed',   color: 'success' };
  if (razorpayStatus === 'failed')      return { icon: <CancelOutlinedIcon     sx={{ fontSize: 64, color: 'error.main'   }} />, label: 'Payment Failed',      color: 'error'   };

  return { icon: <HourglassTopIcon sx={{ fontSize: 64, color: 'info.main' }} />, label: 'Processing…', color: 'info' };
}

// ── Component ────────────────────────────────────────────────────────────────
export default function PaymentResult() {
  const [searchParams]    = useSearchParams();
  const navigate           = useNavigate();
  const { recordTransaction } = useAppState();

  const transactionId  = searchParams.get('transactionId');
  // NOTE: ?status URL param is intentionally NOT used for display — it can be
  // 'failed' even when the backend actually succeeded (e.g. ondismiss fires on
  // dismiss after a successful charge).  The backend poll is the sole source of
  // truth.  We read it only to keep the variable available for debugging.

  const [loading,  setLoading]  = useState(true);
  const [result,   setResult]   = useState(null);   // TransactionStatusResponse
  const [pollErr,  setPollErr]  = useState(false);

  const attempts   = useRef(0);
  const isMounted  = useRef(true);

  // ── Poll until terminal status ─────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;

    if (!transactionId) {
      setLoading(false);
      return;
    }

    const poll = async () => {
      if (!isMounted.current) return;

      attempts.current += 1;

      try {
        const data = await getTransactionStatus(transactionId);

        if (!isMounted.current) return;

        if (isTerminal(data.overallStatus) || attempts.current >= MAX_POLL_ATTEMPTS) {
          // Normalize and push into global session state so Analytics,
          // FraudAlerts and Dashboard all update immediately — same pattern
          // as Dashboard.jsx after a successful UPI/bank payment.
          const normalized = normalizeTxRecord(data, data);
          setResult(normalized);
          setLoading(false);
          recordTransaction(normalized);
        } else {
          setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (_err) {
        if (!isMounted.current) return;

        if (attempts.current >= MAX_POLL_ATTEMPTS) {
          setPollErr(true);
          setLoading(false);
        } else {
          setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
    };

    poll();

    return () => { isMounted.current = false; };
  }, [transactionId]);

  // ── Derived display values ─────────────────────────────────────────────────
  const overallStatus = result?.overallStatus ?? null;
  // Pass null as second arg — URL ?status is ignored; only backend verdict shown.
  const { icon, label, color } = statusMeta(overallStatus, null);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        bgcolor: 'background.default',
      }}
    >
      <Card elevation={4} sx={{ maxWidth: 520, width: '100%', borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>

          {/* ── Loading spinner ───────────────────────────── */}
          {loading && (
            <Stack alignItems="center" spacing={2} py={4}>
              <CircularProgress size={52} />
              <Typography variant="h6" color="text.secondary">
                Processing payment…
              </Typography>
              <Typography variant="body2" color="text.disabled">
                Verifying with Razorpay and checking fraud analysis
              </Typography>
            </Stack>
          )}

          {/* ── Result card ───────────────────────────────── */}
          {!loading && (
            <Stack alignItems="center" spacing={2}>

              {/* Icon + headline */}
              {icon}
              <Typography variant="h5" fontWeight={700} color={`${color}.main`}>
                {label}
              </Typography>

              {/* Poll error notice */}
              {pollErr && (
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Could not fetch the final verdict — your payment status is shown below.
                  Check the Transactions page for the latest update.
                </Typography>
              )}

              <Divider flexItem />

              {/* Detail rows */}
              <Stack spacing={1.5} width="100%" px={1}>

                {transactionId && (
                  <DetailRow label="Transaction ID">
                    <Typography
                      variant="body2"
                      fontFamily="monospace"
                      sx={{ wordBreak: 'break-all', color: 'text.primary' }}
                    >
                      {transactionId}
                    </Typography>
                  </DetailRow>
                )}

                {result?.fraudStatus && (
                  <DetailRow label="Fraud Check">
                    <Chip
                      label={result.fraudStatus}
                      size="small"
                      color={
                        result.fraudStatus === 'SAFE'   ? 'success' :
                        result.fraudStatus === 'FRAUD'  ? 'error'   : 'warning'
                      }
                    />
                  </DetailRow>
                )}

                {result?.fraudDetectionLayer && (
                  <DetailRow label="Detected by">
                    <Typography variant="body2" color="text.secondary">
                      {result.fraudDetectionLayer}
                    </Typography>
                  </DetailRow>
                )}

                {result?.amount != null && (
                  <DetailRow label="Amount">
                    <Typography variant="body2" fontWeight={600} color="text.primary">
                      ₹{Number(result.amount).toFixed(2)}
                    </Typography>
                  </DetailRow>
                )}

                {result?.paymentMode && (
                  <DetailRow label="Payment Mode">
                    <Chip label={result.paymentMode} size="small" variant="outlined" />
                  </DetailRow>
                )}

                {result?.payerEmail && (
                  <DetailRow label="From">
                    <Typography variant="body2" color="text.secondary">
                      {result.payerEmail}
                    </Typography>
                  </DetailRow>
                )}

                {(result?.payeeEmail || result?.payeeUpiId) && (
                  <DetailRow label="To">
                    <Typography variant="body2" color="text.secondary">
                      {result.payeeUpiId || result.payeeEmail}
                    </Typography>
                  </DetailRow>
                )}

                {result?.fraudReason && (
                  <DetailRow label="Reason">
                    <Typography variant="body2" color="error.main">
                      {result.fraudReason}
                    </Typography>
                  </DetailRow>
                )}

              </Stack>

              <Divider flexItem />

              {/* CTA */}
              <Stack direction="row" spacing={2} pt={1}>
                <Button
                  variant="contained"
                  onClick={() => navigate('/dashboard')}
                  sx={{ flex: 1 }}
                >
                  Go to Dashboard
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/transactions')}
                  sx={{ flex: 1 }}
                >
                  View Transactions
                </Button>
              </Stack>

            </Stack>
          )}

        </CardContent>
      </Card>
    </Box>
  );
}

// ── Small helper layout component ────────────────────────────────────────────
function DetailRow({ label, children }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
      <Typography variant="body2" color="text.disabled" flexShrink={0} sx={{ minWidth: 120 }}>
        {label}
      </Typography>
      {children}
    </Stack>
  );
}
