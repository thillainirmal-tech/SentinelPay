/**
 * ActivityFeed.jsx — Recent transaction activity list (right-side panel)
 *
 * Pulls from AppStateContext.txHistory so it survives navigation.
 * Shows the last 8 transactions with verdict badge and amount.
 */

import React, { memo } from 'react';
import {
  Card, CardContent, Box, Typography, List, ListItem,
  ListItemAvatar, ListItemText, Avatar, Divider, Chip,
} from '@mui/material';
import HistoryIcon      from '@mui/icons-material/History';
import CheckCircleIcon  from '@mui/icons-material/CheckCircle';
import BlockIcon        from '@mui/icons-material/Block';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import { formatCurrency, formatDateTime, truncateTxId } from '../../utils/formatters';
import { useAppState } from '../../context/AppStateContext';

function VerdictAvatar({ status }) {
  if (status === 'SAFE')   return <Avatar sx={{ bgcolor: 'success.light', width: 36, height: 36 }}><CheckCircleIcon color="success" fontSize="small" /></Avatar>;
  if (status === 'FRAUD')  return <Avatar sx={{ bgcolor: 'error.light',   width: 36, height: 36 }}><BlockIcon color="error" fontSize="small" /></Avatar>;
  if (status === 'REVIEW') return <Avatar sx={{ bgcolor: 'warning.light', width: 36, height: 36 }}><WarningAmberIcon color="warning" fontSize="small" /></Avatar>;
  return <Avatar sx={{ bgcolor: 'grey.200', width: 36, height: 36 }}><HourglassTopIcon fontSize="small" color="disabled" /></Avatar>;
}

const DEMO_FEED = [
  { transactionId: 'DEMO-001', fraudStatus: 'SAFE',   amount: 1500,  payeeUpiId: 'alice@upi',    submittedAt: new Date(Date.now() - 120000).toISOString() },
  { transactionId: 'DEMO-002', fraudStatus: 'FRAUD',  amount: 15000, payeeUpiId: 'unknown@upi',  submittedAt: new Date(Date.now() - 300000).toISOString() },
  { transactionId: 'DEMO-003', fraudStatus: 'SAFE',   amount: 850,   payeeUpiId: 'food@upi',     submittedAt: new Date(Date.now() - 480000).toISOString() },
  { transactionId: 'DEMO-004', fraudStatus: 'REVIEW', amount: 4200,  payeeUpiId: 'shop@razorpay', submittedAt: new Date(Date.now() - 720000).toISOString() },
  { transactionId: 'DEMO-005', fraudStatus: 'SAFE',   amount: 200,   payeeUpiId: 'coffee@upi',   submittedAt: new Date(Date.now() - 900000).toISOString() },
];

const ActivityItem = memo(function ActivityItem({ tx, isLast }) {
  return (
    <>
      <ListItem alignItems="flex-start" sx={{ px: 1.5, py: 1 }}>
        <ListItemAvatar sx={{ minWidth: 48 }}>
          <VerdictAvatar status={tx.fraudStatus} />
        </ListItemAvatar>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" fontWeight={600} fontFamily="monospace" fontSize="0.78rem">
                {truncateTxId(tx.transactionId, 14)}
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {formatCurrency(tx.amount)}
              </Typography>
            </Box>
          }
          secondary={
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.25 }}>
              <Typography variant="caption" color="text.secondary">
                → {tx.payeeUpiId || '—'}
              </Typography>
              {tx.fraudStatus ? (
                <Chip
                  label={tx.fraudStatus}
                  size="small"
                  color={tx.fraudStatus === 'SAFE' ? 'success' : tx.fraudStatus === 'FRAUD' ? 'error' : 'warning'}
                  sx={{ height: 18, fontSize: '0.65rem' }}
                />
              ) : (
                <Typography variant="caption" color="text.disabled">
                  {formatDateTime(tx.submittedAt)}
                </Typography>
              )}
            </Box>
          }
        />
      </ListItem>
      {!isLast && <Divider component="li" sx={{ ml: 7 }} />}
    </>
  );
});

export default function ActivityFeed() {
  const { txHistory } = useAppState();
  const feed    = txHistory.length > 0 ? txHistory.slice(0, 8) : DEMO_FEED;
  const isDemo  = txHistory.length === 0;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon color="primary" fontSize="small" />
            <Box>
              <Typography variant="h6" fontWeight={700} lineHeight={1}>Recent Activity</Typography>
              <Typography variant="caption" color="text.secondary">Last {feed.length} transactions</Typography>
            </Box>
          </Box>
          {isDemo && <Chip label="Demo" size="small" variant="outlined" color="info" />}
        </Box>

        <List disablePadding>
          {feed.map((tx, i) => (
            <ActivityItem key={tx.transactionId} tx={tx} isLast={i === feed.length - 1} />
          ))}
        </List>
      </CardContent>
    </Card>
  );
}
