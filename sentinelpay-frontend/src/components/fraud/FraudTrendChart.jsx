/**
 * FraudTrendChart.jsx — Recharts line/area chart of fraud vs safe over time
 *
 * Driven by the txHistory array from AppStateContext (session transactions).
 * If no real data exists, renders a meaningful demo dataset so the chart
 * always looks populated in a portfolio demo environment.
 */

import React, { useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Box, Card, CardContent, Typography, Chip, useTheme } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { format, subHours } from 'date-fns';
import { useAppState } from '../../context/AppStateContext';

// Generate demo data (last 12 hours, one point per hour)
function generateDemoData() {
  const now = new Date();
  return Array.from({ length: 13 }, (_, i) => {
    const hour = subHours(now, 12 - i);
    return {
      time:    format(hour, 'HH:mm'),
      safe:    Math.floor(Math.random() * 8) + 2,
      blocked: Math.floor(Math.random() * 3),
      review:  Math.floor(Math.random() * 2),
    };
  });
}

// Bucket real transactions into hourly time slots
function buildChartData(txHistory) {
  if (!txHistory || txHistory.length === 0) return generateDemoData();

  const buckets = {};
  txHistory.forEach((tx) => {
    const ts  = tx.submittedAt || tx.analyzedAt || new Date().toISOString();
    const key = format(new Date(ts), 'HH:00');
    if (!buckets[key]) buckets[key] = { time: key, safe: 0, blocked: 0, review: 0 };

    const fs = tx.fraudStatus;
    if      (fs === 'SAFE')   buckets[key].safe++;
    else if (fs === 'FRAUD')  buckets[key].blocked++;
    else if (fs === 'REVIEW') buckets[key].review++;
  });

  const sorted = Object.values(buckets).sort((a, b) => a.time.localeCompare(b.time));
  return sorted.length >= 2 ? sorted : generateDemoData();
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5, minWidth: 140 }}>
      <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>{label}</Typography>
      {payload.map((p) => (
        <Box key={p.dataKey} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
          <Typography variant="caption" color={p.color}>{p.name}</Typography>
          <Typography variant="caption" fontWeight={700}>{p.value}</Typography>
        </Box>
      ))}
    </Box>
  );
};

export default function FraudTrendChart() {
  const theme     = useTheme();
  const { txHistory, stats } = useAppState();
  const data      = useMemo(() => buildChartData(txHistory), [txHistory]);
  const isDemo    = txHistory.length === 0;

  const fraudRate = stats.total > 0
    ? Math.round((stats.blocked / stats.total) * 100)
    : 0;

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUpIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={700} lineHeight={1}>Fraud Trend</Typography>
              <Typography variant="caption" color="text.secondary">Transactions per hour</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {isDemo && (
              <Chip label="Demo data" size="small" variant="outlined" color="info" />
            )}
            <Chip
              label={`${fraudRate}% fraud rate`}
              size="small"
              color={fraudRate > 20 ? 'error' : fraudRate > 10 ? 'warning' : 'success'}
            />
          </Box>
        </Box>

        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="safe_grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={theme.palette.success.main} stopOpacity={0.25} />
                <stop offset="95%" stopColor={theme.palette.success.main} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fraud_grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={theme.palette.error.main} stopOpacity={0.3} />
                <stop offset="95%" stopColor={theme.palette.error.main} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="review_grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={theme.palette.warning.main} stopOpacity={0.25} />
                <stop offset="95%" stopColor={theme.palette.warning.main} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.grey[200]} />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '0.8rem', paddingTop: 8 }}
              formatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
            />
            <Area
              type="monotone"
              dataKey="safe"
              name="Safe"
              stroke={theme.palette.success.main}
              fill="url(#safe_grad)"
              strokeWidth={2}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="blocked"
              name="Blocked"
              stroke={theme.palette.error.main}
              fill="url(#fraud_grad)"
              strokeWidth={2}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="review"
              name="Review"
              stroke={theme.palette.warning.main}
              fill="url(#review_grad)"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
