/**
 * GlobalLoadingBar.jsx — Thin top-of-page progress bar (V3)
 *
 * Listens for:
 *   'sentinelpay:request:start' — emitted by axiosConfig when activeRequests goes 0→1
 *   'sentinelpay:request:end'   — emitted when activeRequests drops back to 0
 *
 * Renders a thin CSS-animated bar at the very top of the viewport, behind the AppBar
 * (zIndex: appBar + 1 so it peeks above).  Uses a requestAnimationFrame-based
 * indeterminate animation — no NProgress dependency needed.
 *
 * Usage: Mount once in index.js / App.jsx, outside any page components.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useTheme as useMuiTheme } from '@mui/material/styles';

const BAR_HEIGHT = 3; // px

export default function GlobalLoadingBar() {
  const [visible,  setVisible]  = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef    = useRef(null);
  const startRef  = useRef(null);
  const muiTheme  = useMuiTheme();

  // Animate progress from 0 → ~85% while loading, then jump to 100% on end
  const animateTo85 = () => {
    startRef.current = null;

    const tick = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;

      // Ease-out: quick start, slow approach to 85
      const raw = Math.min((elapsed / 2500) * 85, 85);
      setProgress(raw);

      if (raw < 85) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const completeBar = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setProgress(100);
    // Hide after the CSS transition finishes (300ms)
    setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 400);
  };

  useEffect(() => {
    const onStart = () => {
      setVisible(true);
      setProgress(0);
      animateTo85();
    };

    const onEnd = () => completeBar();

    window.addEventListener('sentinelpay:request:start', onStart);
    window.addEventListener('sentinelpay:request:end',   onEnd);

    return () => {
      window.removeEventListener('sentinelpay:request:start', onStart);
      window.removeEventListener('sentinelpay:request:end',   onEnd);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <Box
      role="progressbar"
      aria-label="Loading"
      aria-valuenow={Math.round(progress)}
      sx={{
        position:   'fixed',
        top:        0,
        left:       0,
        right:      0,
        height:     BAR_HEIGHT,
        zIndex:     (theme) => theme.zIndex.appBar + 1,
        pointerEvents: 'none',
        backgroundColor: 'rgba(255,255,255,0.1)',
      }}
    >
      <Box
        sx={{
          height:           '100%',
          width:            `${progress}%`,
          backgroundColor:  muiTheme.palette.secondary.main,
          transition:       progress === 100 ? 'width 0.3s ease' : 'width 0.1s linear',
          borderRadius:     '0 2px 2px 0',
          boxShadow:        `0 0 8px ${muiTheme.palette.secondary.main}`,
        }}
      />
    </Box>
  );
}
