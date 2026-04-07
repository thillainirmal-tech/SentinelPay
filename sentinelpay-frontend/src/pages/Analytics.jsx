/**
 * Analytics.jsx — Rich Analytics Dashboard (V3)
 *
 * Provides management-level insights from session transaction data.
 * In production, wire the KPI and chart data to a real admin API.
 *
 * Sections:
 *  1. KPI Summary Cards  — Total, Safe, Blocked, Review, Fraud Rate, Avg Confidence
 *  2. Transactions Over Time  — AreaChart (Recharts)
 *  3. Verdict Distribution    — PieChart donut
 *  4. Risk Score Distribution — BarChart histogram (10 buckets: 0–9%, 10–19% … 90–100%)
 *  5. Detection Layer Breakdown — horizontal BarChart
 */

import React, { useMemo } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Divider, Alert,
} from '@mui/material';
import BarChartIcon       from '@mui/icons-material/BarChart';
import TrendingUpIcon     from '@mui/icons-material/TrendingUp';
import CheckCircleIcon    from '@mui/icons-material/CheckCircle';
import BlockIcon          from '@mui/icons-material/Block';
import WarningAmberIcon   from '@mui/icons-material/WarningAmber';
import SpeedIcon          from '@mui/icons-material/Speed';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { format, subHours } from 'date-fns';
import StatsCard        from '../components/dashboard/StatsCard';
import { useAppState }  from '../context/AppStateContext';

// ── Palette ───────────────────────────────────────────────────────────────────
const COLORS = {
  safe:    '#4caf50',
  blocked: '#f44336',
  review:  '#ff9800',
  ai:      '#1a237e',
  rule:    '#00acc1',
};

// ── KPI sub-card for single metric highlight ──────────────────────────────────
function KpiCard({ label, value, color = 'primary', sub }) {
  return (
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
      <CardContent sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
        <Typography variant="h4" fontWeight={900} color={`${color}.main`} lineHeight={1.1} mt={0.5}>
          {value}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary" mt={0.5} display="block">{sub}</Typography>
        )}
      </CardContent>
    </Card>
  );
}

// ── Custom tooltip (shared) ───────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, minWidth: 140 }}>
      {label && <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>{label}</Typography>}
      {payload.map((p, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.color }} />
          <Typography variant="caption">{p.name}: <strong>{p.value}</strong></Typography>
        </Box>
      ))}
    </Box>
  );
}

// ── Chart helpers ─────────────────────────────────────────────────────────────
// ── Timestamp resolution ──────────────────────────────────────────────────────
// Records from Dashboard carry `timestamp` (set by recordTransaction normalizer).
// Records that were pushed before the fix may only have `submittedAt`/`analyzedAt`.
function resolveTxTimestamp(tx) {
  const raw = tx.timestamp || tx.submittedAt || tx.analyzedAt;
  if (!raw) return null;
  const d = new Date(raw.replace(' ', 'T'));
  return isNaN(d) ? null : d;
}

function buildTimelineData(txHistory) {
  const now   = new Date();
  const slots = Array.from({ length: 13 }, (_, i) => {
    const h = subHours(now, 12 - i);
    return { hour: format(h, 'HH:00'), safe: 0, blocked: 0, review: 0, total: 0 };
  });

  txHistory.forEach((tx) => {
    const d = resolveTxTimestamp(tx);
    if (!d) return;
    const label = format(d, 'HH:00');
    const slot  = slots.find((s) => s.hour === label);
    if (!slot) return;

    // All txHistory entries are guaranteed to have `fraudStatus` (set by normalizeTxRecord).
    const fs = tx.fraudStatus;
    slot.total += 1;
    if (fs === 'SAFE')   slot.safe    += 1;
    if (fs === 'FRAUD')  slot.blocked += 1;
    if (fs === 'REVIEW') slot.review  += 1;
  });

  return slots;
}

function buildPieData(stats) {
  return [
    { name: 'Safe',    value: stats.safe,    color: COLORS.safe },
    { name: 'Blocked', value: stats.blocked, color: COLORS.blocked },
    { name: 'Review',  value: stats.review,  color: COLORS.review },
  ].filter((d) => d.value > 0);
}

function buildRiskHistogram(txHistory) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}–${i * 10 + 9}%`,
    count: 0,
    color: i >= 6 ? COLORS.blocked : i >= 4 ? COLORS.review : COLORS.safe,
  }));
  txHistory.forEach((tx) => {
    // After normalization, confidenceScore is always a top-level field.
    // The old `tx.fraudResult?.confidenceScore` path never existed in the data model.
    const score = tx.confidenceScore ?? 0;
    const idx   = Math.min(Math.floor(score * 10), 9);
    buckets[idx].count += 1;
  });
  return buckets;
}

function buildLayerData(txHistory) {
  const counts = { RULE_BASED: 0, REDIS_HISTORY: 0, AI: 0, AI_FALLBACK: 0 };
  txHistory.forEach((tx) => {
    // After normalization, detectionLayer is always a top-level field.
    const layer = tx.detectionLayer;
    if (layer && counts[layer] !== undefined) counts[layer] += 1;
  });
  return [
    { name: 'Rule-Based',    value: counts.RULE_BASED,    fill: COLORS.rule },
    { name: 'History Check', value: counts.REDIS_HISTORY, fill: '#7c4dff' },
    { name: 'AI Model',      value: counts.AI,             fill: COLORS.ai },
    { name: 'AI Fallback',   value: counts.AI_FALLBACK,    fill: '#546e7a' },
  ].filter((d) => d.value > 0);
}

// ── Custom pie label ──────────────────────────────────────────────────────────
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {(percent * 100).toFixed(0)}%
    </text>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Analytics() {
  const { stats, txHistory } = useAppState();

  const fraudRate     = stats.total > 0 ? ((stats.blocked / stats.total) * 100).toFixed(1) : 0;
  const avgConfidence = useMemo(() => {
    // After normalization confidenceScore is always top-level (no fraudResult nesting).
    const scores = txHistory
      .map((tx) => tx.confidenceScore)
      .filter((s) => s !== undefined && s !== null);
    if (!scores.length) return '—';
    return ((scores.reduce((a, b) => a + b, 0) / scores.length) * 100).toFixed(0) + '%';
  }, [txHistory]);

  const timelineData = useMemo(() => buildTimelineData(txHistory), [txHistory]);
  const pieData      = useMemo(() => buildPieData(stats),          [stats]);
  const histogram    = useMemo(() => buildRiskHistogram(txHistory), [txHistory]);
  const layerData    = useMemo(() => buildLayerData(txHistory),     [txHistory]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <BarChartIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={700} lineHeight={1}>Analytics</Typography>
          <Typography variant="caption" color="text.secondary">Session-level fraud intelligence overview</Typography>
        </Box>
        <Chip label={`${stats.total} transactions`} size="small" sx={{ ml: 'auto' }} />
      </Box>

      {stats.total === 0 && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
          No transactions analysed yet this session. Submit a payment via the Dashboard to populate charts.
        </Alert>
      )}

      {/* KPI row */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={6} sm={4} md={2}>
          <KpiCard label="Total"       value={stats.total}   color="primary" />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <KpiCard label="Safe"        value={stats.safe}    color="success" />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <KpiCard label="Blocked"     value={stats.blocked} color="error"   />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <KpiCard label="Under Review" value={stats.review} color="warning" />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <KpiCard label="Fraud Rate"  value={`${fraudRate}%`} color={Number(fraudRate) > 20 ? 'error' : 'success'} sub="of total analysed" />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <KpiCard label="Avg Risk Score" value={avgConfidence} color="info" sub="mean confidence" />
        </Grid>
      </Grid>

      {/* Timeline + Pie row */}
      <Grid container spacing={3} mb={3}>
        {/* Transactions over time */}
        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={700} mb={0.5}>Transactions Over Time</Typography>
            <Typography variant="caption" color="text.secondary">Last 12 hours, bucketed by hour</Typography>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={timelineData} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradSafe"    x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={COLORS.safe}    stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.safe}    stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="gradBlocked" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={COLORS.blocked} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.blocked} stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="gradReview"  x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={COLORS.review}  stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.review}  stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RTooltip content={<CustomTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="safe"    name="Safe"    stroke={COLORS.safe}    fill="url(#gradSafe)"    strokeWidth={2} />
                <Area type="monotone" dataKey="blocked" name="Blocked" stroke={COLORS.blocked} fill="url(#gradBlocked)" strokeWidth={2} />
                <Area type="monotone" dataKey="review"  name="Review"  stroke={COLORS.review}  fill="url(#gradReview)"  strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Grid>

        {/* Verdict distribution */}
        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={700} mb={0.5}>Verdict Distribution</Typography>
            <Typography variant="caption" color="text.secondary">Session totals</Typography>
            {pieData.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                <Typography variant="body2" color="text.disabled">No data yet</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    dataKey="value"
                    labelLine={false}
                    label={PieLabel}
                  >
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <RTooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Grid>
      </Grid>

      {/* Risk histogram + layer breakdown */}
      <Grid container spacing={3}>
        {/* Risk score histogram */}
        <Grid item xs={12} md={7}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={0.5}>Risk Score Distribution</Typography>
            <Typography variant="caption" color="text.secondary">Confidence score buckets (0–100%)</Typography>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={histogram} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RTooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Transactions" radius={[4, 4, 0, 0]}>
                  {histogram.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Grid>

        {/* Detection layer breakdown */}
        <Grid item xs={12} md={5}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={0.5}>Detection Layer Breakdown</Typography>
            <Typography variant="caption" color="text.secondary">Which layer flagged each transaction</Typography>
            {layerData.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180 }}>
                <Typography variant="body2" color="text.disabled">No flagged transactions yet</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={layerData} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <RTooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Count" radius={[0, 4, 4, 0]}>
                    {layerData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
