import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import SearchOffIcon from '@mui/icons-material/SearchOff';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        p: 4,
        textAlign: 'center',
        bgcolor: 'background.default',
      }}
    >
      <SearchOffIcon sx={{ fontSize: 80, color: 'text.disabled' }} />
      <Typography variant="h3" fontWeight={800} color="text.primary">404</Typography>
      <Typography variant="h6" fontWeight={600} color="text.secondary">Page not found</Typography>
      <Typography variant="body2" color="text.secondary" maxWidth={360}>
        The page you're looking for doesn't exist or has been moved.
      </Typography>
      <Button variant="contained" onClick={() => navigate('/dashboard')} sx={{ mt: 1 }}>
        Go to Dashboard
      </Button>
    </Box>
  );
}
