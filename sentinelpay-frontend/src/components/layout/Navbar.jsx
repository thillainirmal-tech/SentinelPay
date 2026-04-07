/**
 * Navbar.jsx — Top navigation bar (V3)
 *
 * V3 additions:
 *  - Dark / light mode toggle button (calls ThemeContext.toggleTheme)
 *  - DarkModeIcon / LightModeIcon swap based on current mode
 *
 * V2 features retained:
 *  - GlobalErrorBanner below AppBar when globalError is set
 *  - Unread alert badge on bell icon
 *  - Admin badge shown when user.role === ADMIN
 *  - Logout clears both auth and app state
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, IconButton, Avatar,
  Menu, MenuItem, ListItemIcon, Divider, Box, Chip,
  Badge, Alert, Tooltip,
} from '@mui/material';
import MenuIcon          from '@mui/icons-material/Menu';
import LogoutIcon        from '@mui/icons-material/Logout';
import PersonIcon        from '@mui/icons-material/Person';
import SecurityIcon      from '@mui/icons-material/Security';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AdminPanelIcon    from '@mui/icons-material/AdminPanelSettings';
import CloseIcon         from '@mui/icons-material/Close';
import DarkModeIcon      from '@mui/icons-material/DarkMode';
import LightModeIcon     from '@mui/icons-material/LightMode';
import { useAuth }       from '../../context/AuthContext';
import { useAppState }   from '../../context/AppStateContext';
import { useTheme }      from '../../context/ThemeContext';

export default function Navbar({ drawerWidth, onMenuClick }) {
  const { user, isAdmin, logout, globalError, clearGlobalError } = useAuth();
  const { unreadAlerts, clearAppState }                           = useAppState();
  const { mode, toggleTheme }                                     = useTheme();
  const navigate                                                  = useNavigate();
  const [anchorEl, setAnchorEl]                                   = useState(null);

  const handleMenuOpen  = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = ()  => setAnchorEl(null);

  const handleProfile = () => { handleMenuClose(); navigate('/profile'); };
  const handleAdmin   = () => { handleMenuClose(); navigate('/admin'); };

  const handleLogout = () => {
    handleMenuClose();
    clearAppState();
    logout();
    navigate('/login', { replace: true });
  };

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width:   { md: `calc(100% - ${drawerWidth}px)` },
          ml:      { md: `${drawerWidth}px` },
          bgcolor: 'primary.main',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <Toolbar>
          {/* Mobile hamburger */}
          <IconButton color="inherit" edge="start" onClick={onMenuClick} sx={{ mr: 2, display: { md: 'none' } }}>
            <MenuIcon />
          </IconButton>

          {/* Brand */}
          <SecurityIcon sx={{ mr: 1, fontSize: 28 }} />
          <Typography variant="h6" noWrap sx={{ fontWeight: 700, flexGrow: 1, letterSpacing: '-0.3px' }}>
            SentinelPay
          </Typography>

          {/* Admin badge */}
          {isAdmin && (
            <Chip
              label="ADMIN"
              size="small"
              sx={{ mr: 1.5, bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 700, fontSize: '0.7rem' }}
            />
          )}

          {/* UPI ID chip */}
          {user?.upiId && (
            <Chip
              label={user.upiId}
              size="small"
              sx={{ mr: 2, bgcolor: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '0.72rem', fontWeight: 600, display: { xs: 'none', sm: 'flex' } }}
            />
          )}

          {/* Dark/Light mode toggle */}
          <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton color="inherit" onClick={toggleTheme} sx={{ mr: 0.5 }} aria-label="toggle dark mode">
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>

          {/* Notification bell */}
          <IconButton color="inherit" sx={{ mr: 1 }} onClick={() => navigate('/fraud-alerts')} aria-label="fraud alerts">
            <Badge badgeContent={unreadAlerts} color="error" max={9}>
              <NotificationsIcon />
            </Badge>
          </IconButton>

          {/* Avatar dropdown */}
          <IconButton onClick={handleMenuOpen} size="small">
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'secondary.main', fontSize: '0.875rem', fontWeight: 700 }}>
              {initials}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            PaperProps={{ elevation: 4, sx: { mt: 1, minWidth: 220, borderRadius: 2 } }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>{user?.name}</Typography>
              <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
              {isAdmin && (
                <Chip label="Admin" size="small" color="primary" sx={{ mt: 0.5, height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
            <Divider />
            <MenuItem onClick={handleProfile}>
              <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
              Profile
            </MenuItem>
            {isAdmin && (
              <MenuItem onClick={handleAdmin}>
                <ListItemIcon><AdminPanelIcon fontSize="small" color="primary" /></ListItemIcon>
                Admin Panel
              </MenuItem>
            )}
            <Divider />
            <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
              <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
              Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Global error banner */}
      {globalError && (
        <Box
          sx={{
            position: 'fixed',
            top: 64,
            left: { md: `${drawerWidth}px` },
            right: 0,
            zIndex: (theme) => theme.zIndex.appBar - 1,
          }}
        >
          <Alert
            severity="error"
            action={
              <IconButton size="small" color="inherit" onClick={clearGlobalError}>
                <CloseIcon fontSize="small" />
              </IconButton>
            }
            sx={{ borderRadius: 0 }}
          >
            {globalError}
          </Alert>
        </Box>
      )}
    </>
  );
}
