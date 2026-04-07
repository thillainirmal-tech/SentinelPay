import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { fraudStatusColor, overallStatusColor } from '../../utils/formatters';

/**
 * StatusBadge — renders a MUI Chip for fraud/overall transaction status.
 *
 * @param {'fraud'|'overall'} type - which status palette to use
 * @param {string} status          - the status value
 * @param {string} [tooltip]       - optional tooltip text
 * @param {'small'|'medium'} [size]
 */
export default function StatusBadge({ type = 'fraud', status, tooltip, size = 'small' }) {
  if (!status) return null;

  const color = type === 'fraud'
    ? fraudStatusColor(status)
    : overallStatusColor(status);

  const chip = (
    <Chip
      label={status.replace('_', ' ')}
      color={color}
      size={size}
      sx={{ fontWeight: 700, letterSpacing: '0.03em' }}
    />
  );

  return tooltip ? <Tooltip title={tooltip} placement="top">{chip}</Tooltip> : chip;
}
