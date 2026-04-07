/**
 * ErrorBoundary.jsx — Class-based React error boundary
 *
 * Catches any render-time JavaScript error thrown by a descendant component,
 * prevents the crash from destroying the entire app, and renders a fallback UI
 * with a retry button.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomePage />
 *   </ErrorBoundary>
 *
 *   // Or with a custom fallback:
 *   <ErrorBoundary fallback={<MyFallback />}>
 *     <SomePage />
 *   </ErrorBoundary>
 */

import React from 'react';
import { Box, Typography, Button, Paper, Divider } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon      from '@mui/icons-material/Refresh';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // In production, forward to an error monitoring service here (Sentry, etc.)
    if (process.env.REACT_APP_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: this.props.fullPage ? '100vh' : '240px',
            p: 4,
          }}
        >
          <Paper
            variant="outlined"
            sx={{ p: 4, maxWidth: 520, width: '100%', borderRadius: 3, textAlign: 'center' }}
          >
            <ErrorOutlineIcon sx={{ fontSize: 56, color: 'error.main', mb: 1 }} />

            <Typography variant="h6" fontWeight={700} mb={1}>
              Something went wrong
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              This section encountered an unexpected error. Your data is safe — try refreshing.
            </Typography>

            {process.env.REACT_APP_ENV === 'development' && this.state.error && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box
                  sx={{
                    bgcolor: 'grey.100',
                    borderRadius: 2,
                    p: 1.5,
                    textAlign: 'left',
                    mb: 2,
                    maxHeight: 120,
                    overflow: 'auto',
                  }}
                >
                  <Typography
                    variant="caption"
                    fontFamily="monospace"
                    color="error.main"
                    display="block"
                  >
                    {this.state.error.toString()}
                  </Typography>
                </Box>
              </>
            )}

            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={this.handleRetry}
              >
                Try again
              </Button>
              <Button
                variant="outlined"
                onClick={() => window.location.reload()}
              >
                Reload page
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
