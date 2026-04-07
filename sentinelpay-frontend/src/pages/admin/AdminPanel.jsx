/**
 * AdminPanel.jsx — Admin-only dashboard
 *
 * Accessible only when user.role === 'ADMIN' (enforced by AdminRoute).
 *
 * Features:
 *  - System-wide fraud stats overview
 *  - Full fraud trend chart
 *  - Live alerts panel (all users)
 *  - Quick-access to fraud verdict lookup for any transaction
 *
 * Note: The backend doesn't have a dedicated admin API in the current design,
 * so this page aggregates session-level data from AppStateContext.
 * A real admin API (e.g. GET /admin/stats) can be wired in later.
 */

import React from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Alert,
} from '@mui/material';
import AdminPanelIcon    from '@mui/icons-material/AdminPanelSettings';
import CheckCircleIcon   from '@mui/icons-material/CheckCircle';
import BlockIcon         from '@mui/icons-material/Block';
import WarningAmberIcon  from '@mui/icons-material/WarningAmber';
import TrendingUpIcon    from '@mui/icons-material/TrendingUp';
import StatsCard         from '../../components/dashboard/StatsCard';
import FraudTrendChart   from '../../components/fraud/FraudTrendChart';
import AlertsPanel       from '../../components/fraud/AlertsPanel';
import { useAuth }       from '../../context/AuthContext';
import { useAppState }   from '../../context/AppStateContext';

export default function AdminPanel() {
  const { user }  = useAuth();
  const { stats } = useAppState();

  const fraudRate = stats.total > 0
    ? ((stats.blocked / stats.total) * 100).toFixed(1) + '%'
    : '—';

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
        <AdminPanelIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={700} lineHeight={1}>Admin Panel</Typography>
          <Typography variant="caption" color="text.secondary">
            Logged in as {user?.name} ({user?.email})
          </Typography>
        </Box>
        <Chip label="ADMIN" color="primary" size="small" sx={{ ml: 'auto' }} />
      </Box>

      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        This panel is visible only to users with the ADMIN role (decoded from JWT).
        Stats shown are session-level. Wire in a real admin API for production.
      </Alert>

      {/* Stats */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={6} sm={3}>
          <StatsCard icon={<TrendingUpIcon />}    title="Total Analysed" value={stats.total}   color="primary" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatsCard icon={<CheckCircleIcon />}   title="Safe"           value={stats.safe}    color="success" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatsCard icon={<BlockIcon />}         title="Blocked"        value={stats.blocked} color="error" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatsCard icon={<WarningAmberIcon />}  title="Under Review"   value={stats.review}  color="warning" />
        </Grid>
      </Grid>

      {/* Fraud rate callout */}
      <Card
        sx={{
          mb: 3,
          background: stats.blocked / (stats.total || 1) > 0.2
            ? 'linear-gradient(135deg, #c62828 0%, #b71c1c 100%)'
            : 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
          color: 'white',
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h3" fontWeight={900}>{fraudRate}</Typography>
          <Typography variant="body1" sx={{ opacity: 0.85 }}>
            Fraud rate this session · {stats.total} total transactions analysed
          </Typography>
        </CardContent>
      </Card>

      {/* Charts */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <FraudTrendChart />
        </Grid>
        <Grid item xs={12} md={5}>
          <AlertsPanel maxHeight={360} />
        </Grid>
      </Grid>
    </Box>
  );
}
