/**
 * RiskGauge.jsx — Radial confidence score visualiser
 *
 * Renders an SVG arc gauge that fills from green (0.0) → amber → red (1.0)
 * matching the backend's FraudResult.confidenceScore (0.0–1.0 range).
 *
 * Zones mirroring backend thresholds:
 *   0.00 – 0.39 → SAFE    (green)
 *   0.40 – 0.59 → REVIEW  (amber)
 *   0.60 – 1.00 → FRAUD   (red)
 */

import React, { useEffect, useRef } from 'react';
import { Box, Typography, useTheme } from '@mui/material';

const RADIUS     = 72;
const STROKE     = 14;
const CENTER     = RADIUS + STROKE;
const SVG_SIZE   = (RADIUS + STROKE) * 2;

// Arc goes from 210° to 330° (240° sweep — a typical gauge shape)
const START_ANGLE = 210;
const SWEEP_ANGLE = 240;

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const s   = polarToCartesian(cx, cy, r, startAngle);
  const e   = polarToCartesian(cx, cy, r, endAngle);
  const big = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${big} 1 ${e.x} ${e.y}`;
}

function scoreToColor(score) {
  if (score < 0.4)  return '#2e7d32';  // SAFE green
  if (score < 0.6)  return '#f57c00';  // REVIEW amber
  return '#c62828';                     // FRAUD red
}

function scoreToLabel(score) {
  if (score < 0.4)  return 'LOW RISK';
  if (score < 0.6)  return 'REVIEW';
  return 'HIGH RISK';
}

export default function RiskGauge({ score, size = 'medium' }) {
  const theme   = useTheme();
  const clamp   = Math.max(0, Math.min(1, score ?? 0));
  const fillEnd = START_ANGLE + SWEEP_ANGLE * clamp;
  const color   = scoreToColor(clamp);
  const label   = scoreToLabel(clamp);

  const scale   = size === 'small' ? 0.7 : size === 'large' ? 1.3 : 1;
  const dim     = SVG_SIZE * scale;
  const cx      = CENTER * scale;
  const cy      = CENTER * scale;
  const r       = RADIUS * scale;
  const sw      = STROKE * scale;

  const trackPath = describeArc(cx, cy, r, START_ANGLE, START_ANGLE + SWEEP_ANGLE);
  const fillPath  = clamp > 0.01
    ? describeArc(cx, cy, r, START_ANGLE, fillEnd)
    : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ position: 'relative', width: dim, height: dim }}>
        <svg width={dim} height={dim} viewBox={`0 0 ${SVG_SIZE * scale} ${SVG_SIZE * scale}`}>
          {/* Track */}
          <path
            d={trackPath}
            fill="none"
            stroke={theme.palette.grey[200]}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          {/* Fill */}
          {fillPath && (
            <path
              d={fillPath}
              fill="none"
              stroke={color}
              strokeWidth={sw}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.5s ease' }}
            />
          )}
          {/* Zone tick marks */}
          {[0.4, 0.6].map((pct) => {
            const angle = START_ANGLE + SWEEP_ANGLE * pct;
            const inner = polarToCartesian(cx, cy, r - sw / 2 - 2 * scale, angle);
            const outer = polarToCartesian(cx, cy, r + sw / 2 + 2 * scale, angle);
            return (
              <line
                key={pct}
                x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                stroke={theme.palette.grey[400]}
                strokeWidth={1.5 * scale}
              />
            );
          })}
          {/* Centre text */}
          <text
            x={cx} y={cy - 6 * scale}
            textAnchor="middle"
            fill={color}
            fontFamily="Inter, sans-serif"
            fontWeight="800"
            fontSize={22 * scale}
          >
            {Math.round(clamp * 100)}%
          </text>
          <text
            x={cx} y={cy + 18 * scale}
            textAnchor="middle"
            fill={theme.palette.text.secondary}
            fontFamily="Inter, sans-serif"
            fontWeight="500"
            fontSize={9 * scale}
          >
            CONFIDENCE
          </text>
        </svg>
      </Box>

      <Typography
        variant="caption"
        fontWeight={800}
        sx={{ color, letterSpacing: '0.08em', fontSize: `${0.75 * scale}rem` }}
      >
        {label}
      </Typography>

      {/* Zone legend */}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
        {[
          { label: 'Safe',   color: '#2e7d32', range: '< 40%' },
          { label: 'Review', color: '#f57c00', range: '40–60%' },
          { label: 'Fraud',  color: '#c62828', range: '> 60%' },
        ].map(({ label: l, color: c, range }) => (
          <Box key={l} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <Box sx={{ width: 8 * scale, height: 8 * scale, borderRadius: '50%', bgcolor: c }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: `${0.65 * scale}rem` }}>
              {l} ({range})
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
