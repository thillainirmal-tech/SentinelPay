import React from 'react';
import { Card, CardContent, Box, Typography, Avatar } from '@mui/material';

/**
 * StatsCard — a metric display card shown on the Dashboard.
 *
 * @param {React.ReactNode} icon       - MUI icon element
 * @param {string}          title      - metric label
 * @param {string|number}   value      - primary value
 * @param {string}          [subtitle] - optional secondary label
 * @param {'primary'|'success'|'warning'|'error'|'info'} [color]
 */
export default function StatsCard({ icon, title, value, subtitle, color = 'primary' }) {
  const bgMap = {
    primary: 'primary.main',
    success: 'success.main',
    warning: 'warning.main',
    error:   'error.main',
    info:    'info.main',
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={500} gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={800} color="text.primary" lineHeight={1.2}>
              {value ?? '—'}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Avatar sx={{ bgcolor: bgMap[color] || bgMap.primary, width: 52, height: 52 }}>
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );
}
