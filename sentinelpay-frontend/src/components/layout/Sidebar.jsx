/**
 * Sidebar.jsx — Upgraded navigation sidebar
 *
 * Upgrades over v1:
 *  - Unread alert count badge on "Fraud Alerts" nav item (from AppStateContext)
 *  - Admin link shown only when user has ADMIN role (from AuthContext.isAdmin)
 *  - Logout clears both auth and app state
 *  - Memoised nav items to prevent re-renders
 */

import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer, Box, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Typography, Divider, Avatar, Badge,
  IconButton, Tooltip,
} from '@mui/material';
import DashboardIcon    from '@mui/icons-material/Dashboard';
import PaymentIcon      from '@mui/icons-material/Payment';
import ShieldIcon       from '@mui/icons-material/Shield';
import PersonIcon       from '@mui/icons-material/Person';
import SecurityIcon     from '@mui/icons-material/Security';
import AdminPanelIcon   from '@mui/icons-material/AdminPanelSettings';
import BarChartIcon     from '@mui/icons-material/BarChart';
import LogoutIcon       from '@mui/icons-material/Logout';
import { useAuth }      from '../../context/AuthContext';
import { useAppState }  from '../../context/AppStateContext';

function DrawerContent({ onClose }) {
  const { user, isAdmin, logout } = useAuth();
  const { unreadAlerts, clearAppState } = useAppState();
  const navigate  = useNavigate();
  const location  = useLocation();

  const navItems = useMemo(() => [
    { label: 'Dashboard',    path: '/dashboard',    icon: <DashboardIcon /> },
    {
      label: 'Transactions',
      path:  '/transactions',
      icon:  <PaymentIcon />,
    },
    {
      label: 'Fraud Alerts',
      path:  '/fraud-alerts',
      icon:  (
        <Badge badgeContent={unreadAlerts} color="error" max={9}>
          <ShieldIcon />
        </Badge>
      ),
    },
    { label: 'Analytics', path: '/analytics', icon: <BarChartIcon /> },
    { label: 'Profile',   path: '/profile',   icon: <PersonIcon /> },
    ...(isAdmin ? [{ label: 'Admin Panel', path: '/admin', icon: <AdminPanelIcon />, adminOnly: true }] : []),
  ], [unreadAlerts, isAdmin]);

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const handleNav = (path) => {
    navigate(path);
    if (onClose) onClose();
  };

  const handleLogout = () => {
    clearAppState();
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand */}
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <SecurityIcon sx={{ color: 'primary.main', fontSize: 32 }} />
        <Box>
          <Typography variant="h6" fontWeight={800} color="primary.main" lineHeight={1}>
            SentinelPay
          </Typography>
          <Typography variant="caption" color="text.secondary">Fraud Detection</Typography>
        </Box>
      </Box>

      <Divider />

      {/* User info */}
      <Box sx={{ px: 2, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40, fontSize: '0.875rem', fontWeight: 700 }}>
          {initials}
        </Avatar>
        <Box sx={{ overflow: 'hidden', flexGrow: 1 }}>
          <Typography variant="body2" fontWeight={600} noWrap>{user?.name}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary" noWrap>{user?.upiId}</Typography>
            {isAdmin && (
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>• Admin</Typography>
            )}
          </Box>
        </Box>
        <Tooltip title="Sign out">
          <IconButton size="small" onClick={handleLogout} sx={{ color: 'text.secondary' }}>
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider />

      {/* Navigation */}
      <List sx={{ px: 1, py: 1, flexGrow: 1 }}>
        {navItems.map(({ label, path, icon, adminOnly }) => {
          const active = location.pathname === path;
          return (
            <ListItem key={path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => handleNav(path)}
                selected={active}
                sx={{
                  borderRadius: 2,
                  '&.Mui-selected': {
                    bgcolor: adminOnly ? 'rgba(26,35,126,0.1)' : 'primary.main',
                    color: adminOnly ? 'primary.main' : 'white',
                    '& .MuiListItemIcon-root': { color: adminOnly ? 'primary.main' : 'white' },
                    '&:hover': { bgcolor: adminOnly ? 'rgba(26,35,126,0.15)' : 'primary.dark' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: active ? 'inherit' : 'text.secondary' }}>
                  {icon}
                </ListItemIcon>
                <ListItemText
                  primary={label}
                  primaryTypographyProps={{
                    fontWeight: active ? 700 : 400,
                    fontSize: '0.9rem',
                    color: adminOnly && active ? 'primary.main' : 'inherit',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.disabled">
          v2.0.0 · SentinelPay
        </Typography>
      </Box>
    </Box>
  );
}

export default function Sidebar({ drawerWidth, mobileOpen, onClose }) {
  return (
    <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
      {/* Mobile */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <DrawerContent onClose={onClose} />
      </Drawer>

      {/* Desktop */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', borderRight: '1px solid', borderColor: 'divider' },
        }}
        open
      >
        <DrawerContent />
      </Drawer>
    </Box>
  );
}
