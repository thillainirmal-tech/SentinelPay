/**
 * index.js — Application entry point (V3)
 *
 * V3 changes:
 *  - Replaced hardcoded createTheme() with ThemeProvider from ThemeContext
 *    (dark/light mode toggle now drives the entire MUI theme dynamically)
 *  - ThemeConsumer wraps MUI ThemeProvider + CssBaseline so they always
 *    receive the live theme from context
 *
 * Provider order (outermost → innermost):
 *   BrowserRouter → ThemeProvider (our context) → AuthProvider → AppStateProvider → App
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider }                from './context/AuthContext';
import { AppStateProvider }            from './context/AppStateContext';
import { ThemeProvider, useTheme }     from './context/ThemeContext';

// ── Bridges our ThemeContext to MUI's ThemeProvider ───────────────────────────
// Must be a child of ThemeProvider so it can call useTheme()
function MuiThemeBridge({ children }) {
  const { muiTheme } = useTheme();
  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <MuiThemeBridge>
          <AuthProvider>
            <AppStateProvider>
              <App />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    fontFamily: '"Inter", sans-serif',
                    borderRadius: 8,
                    fontSize: '0.875rem',
                  },
                  success: { iconTheme: { primary: '#2e7d32', secondary: '#fff' } },
                  error:   { iconTheme: { primary: '#c62828', secondary: '#fff' } },
                }}
              />
            </AppStateProvider>
          </AuthProvider>
        </MuiThemeBridge>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
