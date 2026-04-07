/**
 * TransactionChart.jsx — Dashboard donut chart (fraud vs safe ratio)
 *
 * Uses Recharts PieChart to show the current session's verdict breakdown.
 * Falls back to demo data if no real transactions exist.
 */

import React, { useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  Tooltip, Legend,
} from 'recharts';
import { Box, Card, CardContent, Typography, Chip, useTheme } from '@mui/material';
import DonutLargeIcon from '@mui/icons-material/DonutLarge';
import { useAppState } from '../../context/AppStateContext';

const DEMO_DATA = [
  { name: 'Safe',    value: 72, color: '#2e7d32' },
  { name: 'Blocked', value: 18, color: '#c62828' },
  { name: 'Review',  value: 10, color: '#f57c00' },
];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
      <Typography variant="caption" fontWeight={700}>{name}: {value}</Typography>
    </Box>
  );
};

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontWeight="700" fontSize={12}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function TransactionChart() {
  const theme  = useTheme();
  const { stats } = useAppState();

  const { data, isDemo } = useMemo(() => {
    if (stats.total === 0) {
      return { data: DEMO_DATA, isDemo: true };
    }
    return {
      isDemo: false,
      data: [
        { name: 'Safe',    value: stats.safe,    color: theme.palette.success.main },
        { name: 'Blocked', value: stats.blocked, color: theme.palette.error.main },
        { name: 'Review',  value: stats.review,  color: theme.palette.warning.main },
      ].filter((d) => d.value > 0),
    };
  }, [stats, theme]);

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DonutLargeIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={700} lineHeight={1}>Verdict Distribution</Typography>
              <Typography variant="caption" color="text.secondary">This session</Typography>
            </Box>
          </Box>
          {isDemo && <Chip label="Demo data" size="small" variant="outlined" color="info" />}
        </Box>

        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              labelLine={false}
              label={renderCustomLabel}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '0.8rem', paddingTop: 8 }}
              formatter={(value, entry) => (
                <span style={{ color: entry.color, fontWeight: 600 }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>

        {!isDemo && (
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Total analysed: <strong>{stats.total}</strong>
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
