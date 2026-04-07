/**
 * AlertsPanel.jsx — Real-time fraud alert feed (V3)
 *
 * V3 upgrades:
 *  - useSSE hook connects to /api/fraud/stream for live fraud alerts
 *  - SSE status badge (Live / Polling / Connecting) shown in header
 *  - Falls back to simulated alerts if SSE + polling both fail
 *  - Per-alert expand/collapse detail view retained from V2
 *
 * Alert data flows:
 *   SSE event → onMessage → pushAlert() from AppStateContext
 *   Polling fallback → fraudApi.getUserHistory → pushAlert()
 *   Demo button → pushSimulatedAlert() from AppStateContext
 */

import React, { useState, memo, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Chip, IconButton,
  List, ListItem, ListItemText, ListItemIcon,
  Divider, Button, Tooltip, Badge, Collapse,
  Alert as MuiAlert,
} from '@mui/material';
import ShieldIcon         from '@mui/icons-material/Shield';
import BlockIcon          from '@mui/icons-material/Block';
import WarningAmberIcon   from '@mui/icons-material/WarningAmber';
import DoneAllIcon        from '@mui/icons-material/DoneAll';
import PlayCircleIcon     from '@mui/icons-material/PlayCircle';
import ExpandMoreIcon     from '@mui/icons-material/ExpandMore';
import ExpandLessIcon     from '@mui/icons-material/ExpandLess';
import WifiIcon           from '@mui/icons-material/Wifi';
import WifiOffIcon        from '@mui/icons-material/WifiOff';
import { formatDateTime, formatCurrency, truncateTxId, detectionLayerLabel, formatConfidence } from '../../utils/formatters';
import { useAppState }  from '../../context/AppStateContext';
import { useAuth }      from '../../context/AuthContext';
import { useSSE }       from '../../hooks/useSSE';
import apiClient        from '../../api/axiosConfig';

// ── SSE status indicator ──────────────────────────────────────────────────────
function SseStatusChip({ status }) {
  const map = {
    sse:        { label: 'Live',       color: 'success', icon: <WifiIcon sx={{ fontSize: 12 }} /> },
    polling:    { label: 'Polling',    color: 'warning', icon: <WifiIcon sx={{ fontSize: 12 }} /> },
    connecting: { label: 'Connecting', color: 'default', icon: null },
    error:      { label: 'Offline',    color: 'error',   icon: <WifiOffIcon sx={{ fontSize: 12 }} /> },
    idle:       { label: null,         color: 'default', icon: null },
  };
  const meta = map[status] || map.idle;
  if (!meta.label) return null;
  return (
    <Chip
      label={meta.label}
      size="small"
      color={meta.color}
      icon={meta.icon}
      sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
    />
  );
}

// ── Single alert item ─────────────────────────────────────────────────────────
const AlertItem = memo(function AlertItem({ alert }) {
  const [expanded, setExpanded] = useState(false);

  const isFraud = alert.fraudStatus === 'FRAUD';
  const color   = isFraud ? 'error' : 'warning';
  const Icon    = isFraud ? BlockIcon : WarningAmberIcon;

  return (
    <>
      <ListItem
        alignItems="flex-start"
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: alert.read ? 'transparent' : (isFraud ? 'rgba(198,40,40,0.04)' : 'rgba(245,124,0,0.04)'),
          borderLeft: '3px solid',
          borderLeftColor: isFraud ? 'error.main' : 'warning.main',
          mb: 0.5,
          borderRadius: '0 8px 8px 0',
          transition: 'background 0.2s',
        }}
      >
        <ListItemIcon sx={{ minWidth: 40, mt: 0.5 }}>
          <Icon color={color} fontSize="small" />
        </ListItemIcon>

        <ListItemText
          primary={
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Chip
                  label={alert.fraudStatus}
                  size="small"
                  color={color}
                  sx={{ fontSize: '0.68rem', height: 20 }}
                />
                <Typography variant="caption" fontFamily="monospace" fontWeight={700}>
                  {truncateTxId(alert.transactionId, 14)}
                </Typography>
                {!alert.read && (
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: `${color}.main` }} />
                )}
              </Box>
              <IconButton
                size="small"
                onClick={() => setExpanded((p) => !p)}
                aria-label={expanded ? 'collapse alert details' : 'expand alert details'}
              >
                {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            </Box>
          }
          secondary={
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                {alert.reason}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                {formatDateTime(alert.timestamp)} · {formatCurrency(alert.amount)}
              </Typography>
            </Box>
          }
        />
      </ListItem>

      {/* Expanded detail */}
      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ px: 2, pb: 1.5, mx: 1, bgcolor: 'grey.50', borderRadius: 2, mb: 0.5 }}>
          <Divider sx={{ mb: 1 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {[
              ['Payee UPI',       alert.payeeUpiId    || '—'],
              ['Detection Layer', detectionLayerLabel(alert.detectionLayer)],
              ['Confidence',      formatConfidence(alert.confidenceScore)],
              ['Amount',         formatCurrency(alert.amount)],
            ].map(([label, value]) => (
              <Box key={label}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="body2" fontWeight={600} fontSize="0.8rem">{value}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Collapse>
    </>
  );
});

// ── Main panel ────────────────────────────────────────────────────────────────
export default function AlertsPanel({ maxHeight = 480 }) {
  const { alerts, unreadAlerts, markAlertsRead, pushSimulatedAlert, pushAlert } = useAppState();
  const { isAuthenticated, user } = useAuth();

  // ── SSE / polling for real-time alerts ───────────────────────────────────
  const { status: sseStatus } = useSSE({
    url:          '/api/fraud/stream',
    enabled:      isAuthenticated,
    pollInterval: 20_000,
    maxRetries:   3,
    // Map incoming SSE event to an alert and push to AppStateContext
    onMessage: useCallback((event) => {
      // Backend sends FraudResult-shaped objects
      if (!event?.transactionId) return;
      if (event.status !== 'FRAUD' && event.status !== 'REVIEW') return;

      pushAlert({
        id:             event.transactionId + '-' + Date.now(),
        transactionId:  event.transactionId,
        userId:         event.userId,
        fraudStatus:    event.status,
        reason:         event.reason || 'Flagged by fraud detection system',
        amount:         event.amount || 0,
        payeeUpiId:     event.payeeUpiId || null,
        confidenceScore: event.confidenceScore ?? 0,
        detectionLayer: event.detectionLayer || 'RULE_BASED',
        timestamp:      event.analyzedAt || new Date().toISOString(),
        read:           false,
      });
    }, [pushAlert]),
    // Polling fallback: fetch user's recent fraud history
    pollFn: useCallback(() => {
      if (!user?.email) return Promise.resolve({ data: [] });
      return apiClient.get(`/api/fraud/history/${encodeURIComponent(user.email)}`);
    }, [user?.email]),
  });

  const handleSimulate = useCallback(() => {
    pushSimulatedAlert();
  }, [pushSimulatedAlert]);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        {/* Header */}
        <Box
          sx={{
            px: 3,
            py: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Badge badgeContent={unreadAlerts} color="error" max={9}>
              <ShieldIcon color="primary" />
            </Badge>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography variant="h6" fontWeight={700} lineHeight={1}>Live Alerts</Typography>
                <SseStatusChip status={sseStatus} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {alerts.length} event{alerts.length !== 1 ? 's' : ''} · {unreadAlerts} unread
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Simulate a fraud alert (demo)">
              <Button
                size="small"
                variant="outlined"
                startIcon={<PlayCircleIcon />}
                onClick={handleSimulate}
                sx={{ fontSize: '0.75rem' }}
                aria-label="simulate fraud alert"
              >
                Simulate
              </Button>
            </Tooltip>
            {unreadAlerts > 0 && (
              <Tooltip title="Mark all as read">
                <IconButton
                  size="small"
                  onClick={markAlertsRead}
                  aria-label="mark all alerts as read"
                >
                  <DoneAllIcon fontSize="small" color="primary" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Alert list */}
        <Box sx={{ maxHeight, overflowY: 'auto' }} role="feed" aria-label="fraud alerts feed">
          {alerts.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <ShieldIcon sx={{ fontSize: 48, color: 'success.light', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No alerts. System is monitoring all transactions.
              </Typography>
              <Typography variant="caption" color="text.disabled" display="block" mt={0.5}>
                Click "Simulate" to generate a demo alert.
              </Typography>
            </Box>
          ) : (
            <List disablePadding sx={{ pt: 1 }}>
              {alerts.map((alert) => (
                <AlertItem key={alert.id} alert={alert} />
              ))}
            </List>
          )}
        </Box>

        {/* Footer summary */}
        {alerts.length > 0 && (
          <Box
            sx={{
              px: 3,
              py: 1.5,
              borderTop: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              gap: 1.5,
            }}
          >
            {[
              { label: 'Fraud',  count: alerts.filter((a) => a.fraudStatus === 'FRAUD').length,  color: 'error' },
              { label: 'Review', count: alerts.filter((a) => a.fraudStatus === 'REVIEW').length, color: 'warning' },
            ].map(({ label, count, color }) => (
              <Chip
                key={label}
                label={`${count} ${label}`}
                size="small"
                color={color}
                variant="outlined"
              />
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
