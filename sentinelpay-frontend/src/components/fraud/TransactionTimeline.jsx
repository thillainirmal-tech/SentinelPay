/**
 * TransactionTimeline.jsx — Visual Transaction Lifecycle (V3)
 *
 * Shows the full journey of a UPI payment through the SentinelPay microservices:
 *   1. Initiated         — User submits payment
 *   2. Published         — Kafka event published (async)
 *   3. Fraud Analysis    — 3 sub-layers: Rule-Based → Redis History → AI Model
 *   4. Bank Processing   — Debit/Credit via Bank Service (if SAFE)
 *   5. Result            — Final verdict delivered
 *
 * Props:
 *   result {object|null} — normalized transaction record (via normalizeTxRecord); null = analysis in-progress
 *   loading {boolean}    — Show skeleton/pulse animation
 *   txId   {string}      — Transaction ID
 *
 * Status mapping (uses result.fraudStatus — normalized field, not raw backend `status`):
 *   null result, loading=true       → Steps 1–2 complete, step 3 active
 *   result.fraudStatus = SAFE       → All steps complete
 *   result.fraudStatus = FRAUD      → Steps 1–3 complete, step 4 skipped, step 5 blocked
 *   result.fraudStatus = REVIEW     → Steps 1–3 complete, step 4–5 pending
 */

import React, { memo } from 'react';
import {
  Box, Typography, Stepper, Step, StepLabel,
  StepContent, Chip, CircularProgress, Tooltip,
} from '@mui/material';
import CheckCircleIcon    from '@mui/icons-material/CheckCircle';
import BlockIcon          from '@mui/icons-material/Block';
import WarningAmberIcon   from '@mui/icons-material/WarningAmber';
import HourglassTopIcon   from '@mui/icons-material/HourglassTop';
import SendIcon           from '@mui/icons-material/Send';
import StorageIcon        from '@mui/icons-material/Storage';
import PsychologyIcon     from '@mui/icons-material/Psychology';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import TaskAltIcon        from '@mui/icons-material/TaskAlt';

// ── Step icon with status-aware colour ───────────────────────────────────────
function StepStatusIcon({ state, icon, size = 24 }) {
  const map = {
    done:    { color: 'success.main', Icon: CheckCircleIcon },
    active:  { color: 'primary.main', Icon: null },
    blocked: { color: 'error.main',   Icon: BlockIcon },
    warning: { color: 'warning.main', Icon: WarningAmberIcon },
    pending: { color: 'text.disabled', Icon: null },
  };
  const meta = map[state] || map.pending;

  if (state === 'active') {
    return (
      <Box sx={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={size - 4} thickness={5} color="primary" />
      </Box>
    );
  }

  const DisplayIcon = meta.Icon || (() => <Box sx={{ fontSize: size * 0.6 }}>{icon}</Box>);
  return (
    <Box sx={{ color: meta.color, display: 'flex', alignItems: 'center' }}>
      <DisplayIcon fontSize="small" />
    </Box>
  );
}

// ── Derive step states from result ───────────────────────────────────────────
function deriveStates(result, loading) {
  // Pending state — analysis not done yet
  if (!result && loading) {
    return ['done', 'done', 'active', 'pending', 'pending'];
  }
  if (!result) {
    return ['done', 'done', 'pending', 'pending', 'pending'];
  }

  // Use normalized field `fraudStatus` — never raw backend `status`
  const { fraudStatus } = result;
  if (fraudStatus === 'SAFE') {
    return ['done', 'done', 'done', 'done', 'done'];
  }
  if (fraudStatus === 'FRAUD') {
    return ['done', 'done', 'blocked', 'pending', 'blocked'];
  }
  if (fraudStatus === 'REVIEW') {
    return ['done', 'done', 'warning', 'pending', 'warning'];
  }

  return ['done', 'done', 'done', 'done', 'done'];
}

// ── Sub-layer chips for the Fraud Analysis step ───────────────────────────────
function FraudSubLayers({ detectionLayer, fraudStatus }) {
  const layers = [
    { key: 'RULE_BASED',     label: 'Rule Engine',  icon: '📏' },
    { key: 'REDIS_HISTORY',  label: 'History Check',icon: '📊' },
    { key: 'AI',             label: 'AI Model',     icon: '🧠' },
    { key: 'AI_FALLBACK',    label: 'AI Fallback',  icon: '🔄' },
  ];

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
      {layers.map(({ key, label, icon }) => {
        const isActive = detectionLayer === key;
        const color    = isActive
          ? (fraudStatus === 'SAFE' ? 'success' : fraudStatus === 'FRAUD' ? 'error' : 'warning')
          : 'default';
        return (
          <Tooltip key={key} title={isActive ? 'This layer flagged the transaction' : 'Passed'} arrow>
            <Chip
              label={`${icon} ${label}`}
              size="small"
              color={color}
              variant={isActive ? 'filled' : 'outlined'}
              sx={{ fontSize: '0.7rem', opacity: isActive ? 1 : 0.6 }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}

// ── Steps definition ──────────────────────────────────────────────────────────
function buildSteps(result, loading) {
  const states       = deriveStates(result, loading);
  const detectionLayer = result?.detectionLayer;
  const fraudStatus    = result?.fraudStatus;  // normalized field — never raw `status`

  return [
    {
      label:   'Payment Initiated',
      state:   states[0],
      icon:    <SendIcon />,
      content: 'User submitted the UPI payment request through SentinelPay.',
    },
    {
      label:   'Event Published to Kafka',
      state:   states[1],
      icon:    <StorageIcon />,
      content: 'Transaction event published asynchronously to the Kafka topic. API returned HTTP 202 Accepted.',
    },
    {
      label:   'Fraud Analysis',
      state:   states[2],
      icon:    <PsychologyIcon />,
      content: states[2] === 'active'
        ? 'Running fraud analysis across all detection layers…'
        : `Analysis complete via ${detectionLayer?.replace(/_/g, ' ') || 'fraud detection'} layer.`,
      extra:   result ? <FraudSubLayers detectionLayer={detectionLayer} fraudStatus={fraudStatus} /> : null,
    },
    {
      label:   'Bank Processing',
      state:   states[3],
      icon:    <AccountBalanceIcon />,
      content: states[3] === 'done'
        ? 'Bank service confirmed debit and credit.'
        : states[3] === 'pending' && fraudStatus === 'FRAUD'
        ? 'Skipped — transaction was blocked before reaching bank.'
        : 'Awaiting bank service confirmation.',
    },
    {
      label:   'Final Verdict',
      state:   states[4],
      icon:    <TaskAltIcon />,
      content: !result
        ? 'Awaiting fraud analysis result…'
        : fraudStatus === 'SAFE'
        ? 'Transaction completed successfully. Funds transferred.'
        : fraudStatus === 'FRAUD'
        ? 'Transaction blocked. Funds were not transferred.'
        : 'Transaction flagged for manual review. Funds held temporarily.',
    },
  ];
}

// ── Custom step icon ──────────────────────────────────────────────────────────
const COLOUR_BY_STATE = {
  done:    '#4caf50',
  active:  '#1a237e',
  blocked: '#f44336',
  warning: '#ff9800',
  pending: '#bdbdbd',
};

function CustomStepIconComponent({ state }) {
  return (
    <Box
      sx={{
        width:  28,
        height: 28,
        borderRadius: '50%',
        bgcolor: COLOUR_BY_STATE[state] || '#bdbdbd',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'background-color 0.3s ease',
      }}
    >
      {state === 'active' && <CircularProgress size={14} thickness={5} sx={{ color: 'white' }} />}
      {state === 'done'    && <CheckCircleIcon  sx={{ fontSize: 16, color: 'white' }} />}
      {state === 'blocked' && <BlockIcon        sx={{ fontSize: 16, color: 'white' }} />}
      {state === 'warning' && <WarningAmberIcon sx={{ fontSize: 16, color: 'white' }} />}
      {state === 'pending' && <HourglassTopIcon sx={{ fontSize: 16, color: 'white' }} />}
    </Box>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
const TransactionTimeline = memo(function TransactionTimeline({ result, loading, txId }) {
  const steps = buildSteps(result, loading);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>Transaction Lifecycle</Typography>
        {txId && (
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {txId.slice(0, 12)}…
          </Typography>
        )}
      </Box>

      <Stepper orientation="vertical" sx={{ '& .MuiStepConnector-line': { minHeight: 16 } }}>
        {steps.map((step) => (
          <Step key={step.label} active={step.state === 'active'} completed={step.state === 'done'}>
            <StepLabel
              icon={<CustomStepIconComponent state={step.state} />}
              sx={{
                '& .MuiStepLabel-label': {
                  fontWeight:  step.state === 'active' ? 700 : 500,
                  color:       step.state === 'pending'
                    ? 'text.disabled'
                    : step.state === 'blocked' || step.state === 'warning'
                    ? `${step.state === 'blocked' ? 'error' : 'warning'}.main`
                    : 'text.primary',
                },
              }}
            >
              {step.label}
            </StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {step.content}
              </Typography>
              {step.extra}
            </StepContent>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
});

export default TransactionTimeline;
