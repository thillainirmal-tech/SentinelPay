/**
 * ThemeContext.jsx — Dark / Light mode toggle (V3)
 *
 * Provides:
 *  - `mode`        — 'light' | 'dark'
 *  - `toggleTheme` — flip between modes
 *  - `muiTheme`    — fully constructed MUI theme object (pass to <ThemeProvider>)
 *
 * Persists the user's preference in localStorage under 'sentinelpay_theme'.
 * Defaults to the OS-level preference (prefers-color-scheme) when no stored value exists.
 */

import React, {
  createContext, useContext, useState, useMemo, useCallback,
} from 'react';
import { createTheme } from '@mui/material/styles';

const THEME_KEY = 'sentinelpay_theme';

const ThemeContext = createContext(null);

// ── Base palette tokens shared across both modes ───────────────────────────────
const PRIMARY   = '#1a237e';
const SECONDARY = '#00acc1';

function buildTheme(mode) {
  return createTheme({
    palette: {
      mode,
      primary:    { main: PRIMARY,   contrastText: '#ffffff' },
      secondary:  { main: SECONDARY, contrastText: '#ffffff' },
      background: mode === 'dark'
        ? { default: '#0d1117', paper: '#161b22' }
        : { default: '#f5f7fa', paper: '#ffffff' },
      text: mode === 'dark'
        ? { primary: '#e6edf3', secondary: '#8b949e' }
        : { primary: '#1c1c1e', secondary: '#636366' },
      error:   { main: '#f44336' },
      warning: { main: '#ff9800' },
      success: { main: '#4caf50' },
      info:    { main: '#2196f3' },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
      h4: { fontWeight: 800 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 },
          containedPrimary: { boxShadow: '0 2px 8px rgba(26,35,126,0.25)' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: mode === 'dark'
              ? '0 1px 3px rgba(0,0,0,0.5)'
              : '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
          },
        },
      },
      MuiTextField: {
        defaultProps: { size: 'small' },
        styleOverrides: { root: { borderRadius: 8 } },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 600 } },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: mode === 'dark' ? '#161b22' : PRIMARY,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: mode === 'dark' ? '#161b22' : '#ffffff',
          },
        },
      },
    },
  });
}

export function ThemeProvider({ children }) {
  // Detect OS preference as default
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const stored      = localStorage.getItem(THEME_KEY);

  const [mode, setMode] = useState(
    stored === 'dark' || stored === 'light' ? stored : (prefersDark ? 'dark' : 'light')
  );

  const muiTheme = useMemo(() => buildTheme(mode), [mode]);

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, muiTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
