/**
 * FraudExplanation.jsx — WHY Was This Transaction Flagged? (V3)
 *
 * Renders a rich panel explaining the fraud verdict for a given FraudResult.
 * Maps backend fields (status, detectionLayer, reason, reviewNotes, confidenceScore)
 * to human-readable explanations with visual cues.
 *
 * Props:
 *   result {object} — normalized transaction record (via normalizeTxRecord)
 *     { transactionId, fraudStatus, reason, confidenceScore,
 *       detectionLayer, reviewNotes, analyzedAt }
 *
 * NOTE: always pass the normalized model — never raw backend DTOs.
 */

import React, { memo } from 'react';
import {
  Box, Typography, Chip, Divider, LinearProgress,
  List, ListItem, ListItemIcon, ListItemText, Tooltip,
  Card, CardContent, Alert, Collapse,
} from '@mui/material';
import CheckCircleIcon    from '@mui/icons-material/CheckCircle';
import BlockIcon          from '@mui/icons-material/Block';
import WarningAmberIcon   from '@mui/icons-material/WarningAmber';
import ShieldIcon         from '@mui/icons-material/Shield';
import PsychologyIcon     from '@mui/icons-material/Psychology';
import HistoryIcon        from '@mui/icons-material/History';
import RuleIcon           from '@mui/icons-material/Rule';
import InfoOutlinedIcon   from '@mui/icons-material/InfoOutlined';
import FingerprintIcon    from '@mui/icons-material/Fingerprint';

// ── Detection layer metadata ──────────────────────────────────────────────────
const LAYER_META = {
  RULE_BASED: {
    icon:    <RuleIcon />,
    label:   'Rule-Based Engine',
    color:   'warning',
    desc:    'A deterministic rule triggered — e.g. amount threshold, merchant category, or velocity limit.',
  },
  REDIS_HISTORY: {
    icon:    <HistoryIcon />,
    label:   'Velocity / History Check',
    color:   'warning',
    desc:    'Unusual pattern detected compared to your recent transaction history (stored in Redis cache).',
  },
  AI: {
    icon:    <PsychologyIcon />,
    label:   'AI / ML Model',
    color:   'error',
    desc:    'A machine learning model assigned a high-risk score based on transaction features.',
  },
  AI_FALLBACK: {
    icon:    <ShieldIcon />,
    label:   'AI Fallback Layer',
    color:   'warning',
    desc:    'Primary AI model was unavailable; a fallback heuristic model was used.',
  },
};

// ── Risk factor inference (parsed from `reason` string) ──────────────────────
function parseRiskFactors(reason) {
  // Backend (especially BANK mode) can return null, undefined, or non-string.
  // Guard here so this function NEVER throws regardless of what arrives.
  if (!reason || typeof reason !== 'string') return [];

  const factors = [];
  const r = reason.toLowerCase();

  if (r.includes('amount') || r.includes('large') || r.includes('threshold'))
    factors.push({ label: 'Unusual Amount',     icon: '💰', desc: 'Transaction value deviates significantly from your average.' });
  if (r.includes('velocity') || r.includes('rapid') || r.includes('multiple'))
    factors.push({ label: 'High Velocity',       icon: '⚡', desc: 'Multiple transactions detected in a short time window.' });
  if (r.includes('new') || r.includes('unknown') || r.includes('payee'))
    factors.push({ label: 'Unknown Recipient',   icon: '👤', desc: 'First-time payment to this UPI ID.' });
  if (r.includes('night') || r.includes('midnight') || r.includes('unusual time'))
    factors.push({ label: 'Unusual Timing',      icon: '🕐', desc: 'Transaction attempted outside your normal active hours.' });
  if (r.includes('location') || r.includes('geo') || r.includes('country'))
    factors.push({ label: 'Location Anomaly',    icon: '📍', desc: 'Activity from an unfamiliar geographic location.' });
  if (r.includes('device') || r.includes('fingerprint'))
    factors.push({ label: 'Device Mismatch',     icon: '📱', desc: 'Request originated from an unrecognised device.' });
  if (r.includes('pattern') || r.includes('model') || r.includes('ai'))
    factors.push({ label: 'Behavioral Anomaly',  icon: '🧠', desc: 'AI detected a pattern inconsistent with your transaction history.' });

  // Fallback — always show at least one factor
  if (factors.length === 0 && reason) {
    factors.push({ label: 'Flagged Signal',      icon: '🚩', desc: reason });
  }

  return factors;
}

// ── Status metadata ───────────────────────────────────────────────────────────
const STATUS_META = {
  SAFE:   { icon: <CheckCircleIcon />, color: 'success', label: 'Safe',         headline: 'Transaction approved' },
  FRAUD:  { icon: <BlockIcon />,       color: 'error',   label: 'Blocked',      headline: 'Transaction blocked — fraud detected' },
  REVIEW: { icon: <WarningAmberIcon />,color: 'warning', label: 'Under Review', headline: 'Transaction flagged for manual review' },
};

// ── Confidence bar ─────────────────────────────────────────────────────────────
function ConfidenceBar({ score }) {
  // Clamp: coerce null/undefined/NaN to 0, cap at [0, 1]
  const safe  = (typeof score === 'number' && isFinite(score)) ? Math.min(Math.max(score, 0), 1) : 0;
  const pct   = Math.round(safe * 100);
  const color = safe >= 0.6 ? 'error' : safe >= 0.4 ? 'warning' : 'success';
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">Fraud confidence score</Typography>
        <Typography variant="caption" fontWeight={700} color={`${color}.main`}>{pct}%</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        color={color}
        sx={{ height: 8, borderRadius: 4 }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography variant="caption" color="text.disabled">Safe</Typography>
        <Typography variant="caption" color="text.disabled">Suspicious</Typography>
        <Typography variant="caption" color="text.disabled">Fraud</Typography>
      </Box>
    </Box>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const FraudExplanation = memo(function FraudExplanation({ result }) {
  if (!result) return null;

  // Destructure with explicit fallbacks so no downstream code ever receives
  // null for a field it will perform an operation on.
  const fraudStatus    = result?.fraudStatus    || 'SAFE';
  const reason         = typeof result?.reason === 'string' ? result.reason : '';
  const confidenceScore = (typeof result?.confidenceScore === 'number' && isFinite(result.confidenceScore))
    ? result.confidenceScore : null;
  const detectionLayer = result?.detectionLayer  || null;
  const reviewNotes    = result?.reviewNotes     || null;
  const analyzedAt     = result?.analyzedAt      || null;

  const statusMeta  = STATUS_META[fraudStatus] || STATUS_META.REVIEW;
  const layerMeta   = LAYER_META[detectionLayer] || null;
  const riskFactors = parseRiskFactors(reason);   // always returns array — never throws

  return (
    <Card
      elevation={0}
      sx={{ border: '1px solid', borderColor: `${statusMeta.color}.main`, borderRadius: 2 }}
    >
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{ color: `${statusMeta.color}.main`, display: 'flex' }}>{statusMeta.icon}</Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>{statusMeta.headline}</Typography>
            {analyzedAt && (() => {
              const d = new Date(analyzedAt);
              return isNaN(d.getTime()) ? null : (
                <Typography variant="caption" color="text.secondary">
                  Analysed at {d.toLocaleTimeString()}
                </Typography>
              );
            })()}
          </Box>
          <Chip
            label={statusMeta.label}
            color={statusMeta.color}
            size="small"
            icon={statusMeta.icon}
          />
        </Box>

        {/* Confidence score — confidenceScore is already validated to number|null above */}
        <Box sx={{ mb: 2 }}>
          <ConfidenceBar score={confidenceScore ?? 0} />
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Detection layer */}
        {layerMeta && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Detection Engine
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Box sx={{ color: `${layerMeta.color}.main`, display: 'flex' }}>
                {layerMeta.icon}
              </Box>
              <Box>
                <Typography variant="body2" fontWeight={600}>{layerMeta.label}</Typography>
                <Typography variant="caption" color="text.secondary">{layerMeta.desc}</Typography>
              </Box>
            </Box>
          </Box>
        )}

        {/* Risk factors */}
        {riskFactors.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Risk Factors Detected
            </Typography>
            <List dense sx={{ mt: 0.5, p: 0 }}>
              {riskFactors.map((f, i) => (
                <ListItem key={i} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Typography fontSize="1rem">{f.icon}</Typography>
                  </ListItemIcon>
                  <ListItemText
                    primary={<Typography variant="body2" fontWeight={600}>{f.label}</Typography>}
                    secondary={<Typography variant="caption" color="text.secondary">{f.desc}</Typography>}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Raw reason */}
        {reason && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              System Reason
            </Typography>
            <Box sx={{ mt: 0.5, p: 1.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {reason}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Review notes — shown for REVIEW status */}
        <Collapse in={!!reviewNotes}>
          <Alert severity="warning" icon={<FingerprintIcon />} sx={{ mb: 2, borderRadius: 2 }}>
            <Typography variant="caption" fontWeight={700} display="block">Manual Review Note</Typography>
            <Typography variant="body2">{reviewNotes}</Typography>
          </Alert>
        </Collapse>

        {/* Recommendation */}
        <Box sx={{ p: 1.5, bgcolor: `${statusMeta.color}.50`, borderRadius: 2, border: '1px solid', borderColor: `${statusMeta.color}.200` }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <InfoOutlinedIcon fontSize="small" color={statusMeta.color} sx={{ mt: 0.2 }} />
            <Box>
              <Typography variant="caption" fontWeight={700} color={`${statusMeta.color}.dark`}>
                Recommendation
              </Typography>
              <Typography variant="body2" color={`${statusMeta.color}.dark`}>
                {fraudStatus === 'SAFE'   && 'Transaction is considered legitimate. No action required.'}
                {fraudStatus === 'FRAUD'  && 'This transaction has been blocked. If you believe this is a mistake, contact support with your transaction ID.'}
                {fraudStatus === 'REVIEW' && 'Your transaction is under review. Funds are held temporarily. Resolution typically takes 1–2 hours.'}
              </Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
});

export default FraudExplanation;
