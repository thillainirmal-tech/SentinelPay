/**
 * PageSkeleton.jsx — Skeleton loaders for consistent loading states
 *
 * Provides skeleton variants matching real page layouts so users see
 * the page shape immediately, reducing perceived load time.
 */

import React from 'react';
import {
  Box, Skeleton, Grid, Card, CardContent,
} from '@mui/material';

// ── Stats row skeleton (Dashboard top area) ───────────────────────────────────
export function StatsRowSkeleton({ count = 4 }) {
  return (
    <Grid container spacing={2} mb={3}>
      {Array.from({ length: count }).map((_, i) => (
        <Grid key={i} item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Skeleton width="60%" height={16} sx={{ mb: 1 }} />
                  <Skeleton width="40%" height={40} />
                </Box>
                <Skeleton variant="circular" width={52} height={52} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

// ── Card skeleton (generic content card) ─────────────────────────────────────
export function CardSkeleton({ height = 200 }) {
  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Skeleton width="50%" height={24} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={height} sx={{ borderRadius: 2 }} />
      </CardContent>
    </Card>
  );
}

// ── Table skeleton ────────────────────────────────────────────────────────────
export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', gap: 2, mb: 1, px: 1 }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width={`${100 / cols}%`} height={20} />
        ))}
      </Box>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            gap: 2,
            px: 1,
            py: 0.75,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} width={`${100 / cols}%`} height={18} />
          ))}
        </Box>
      ))}
    </Box>
  );
}

// ── Chart skeleton ────────────────────────────────────────────────────────────
export function ChartSkeleton({ height = 280 }) {
  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Skeleton width="35%" height={24} />
          <Skeleton width="15%" height={24} />
        </Box>
        <Skeleton variant="rectangular" height={height} sx={{ borderRadius: 2 }} />
      </CardContent>
    </Card>
  );
}

// ── Fraud result skeleton ─────────────────────────────────────────────────────
export function FraudResultSkeleton() {
  return (
    <Box sx={{ bgcolor: 'grey.50', borderRadius: 2, p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
        <Skeleton width="45%" height={20} />
        <Skeleton width="20%" height={28} sx={{ borderRadius: 4 }} />
      </Box>
      <Skeleton height={1} sx={{ mb: 1.5 }} />
      {[1, 2, 3].map((i) => (
        <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Skeleton width="30%" height={16} />
          <Skeleton width="40%" height={16} />
        </Box>
      ))}
      <Skeleton width="100%" height={8} sx={{ mt: 1.5, borderRadius: 4 }} />
    </Box>
  );
}

// ── Full-page lazy load fallback ──────────────────────────────────────────────
export function PageLoadingFallback() {
  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Skeleton width="30%" height={32} sx={{ mb: 1 }} />
      <Skeleton width="50%" height={18} sx={{ mb: 3 }} />
      <StatsRowSkeleton count={4} />
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <ChartSkeleton />
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartSkeleton />
        </Grid>
      </Grid>
    </Box>
  );
}
