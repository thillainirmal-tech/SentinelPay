import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Loader — full-area centered spinner with optional message.
 * @param {string} [message] - optional loading text below spinner
 * @param {boolean} [overlay] - if true, covers full viewport with semi-transparent bg
 */
export default function Loader({ message = 'Loading…', overlay = false }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        minHeight: overlay ? '100vh' : '200px',
        width: '100%',
        position: overlay ? 'fixed' : 'static',
        top: 0,
        left: 0,
        bgcolor: overlay ? 'rgba(255,255,255,0.85)' : 'transparent',
        zIndex: overlay ? 9999 : 'auto',
      }}
    >
      <CircularProgress size={44} thickness={4} />
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );
}
