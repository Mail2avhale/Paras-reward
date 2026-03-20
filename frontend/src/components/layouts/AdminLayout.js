import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  Home, Users, CreditCard, FileText, Settings, BarChart3, BarChart2,
  Gift, ShoppingCart, Video, Award, Activity, Package,
  Truck, Store, HeadphonesIcon, UserCog, DollarSign,
  ChevronLeft, ChevronRight, LogOut, Bell, Search,
  Menu, X, Shield, Wallet, TrendingUp, ChevronDown,
  Globe, Phone, Mail, Image, Share2, Cpu, ToggleLeft,
  AlertTriangle, Smartphone, Building, Crown, AlertOctagon, Database, Eye,
  ShieldAlert, CheckCircle, Building2, Zap, Receipt, Send, MessageSquare, Banknote,
  Coins, Flame
} from 'lucide-react';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_appreward-portal/artifacts/8iqee76c_IMG-20251230-WA0006.jpg";
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Mapping of menu item IDs to permission IDs
const MENU_TO_PERMISSION = {
  'dashboard': 'dashboard',
  'users': 'users',
  'user-360': 'users',
  'user-controls': 'user_360',
  'analytics': 'analytics',
  'kyc': 'kyc',
  // 'orders': 'orders', // Marketplace deprecated
  // 'marketplace': 'marketplace', // Marketplace deprecated
  'video-ads': 'video_ads',
  // 'stockists': 'stockist', // Removed - stockist system deprecated
  'support': 'support',
  'fraud-alerts': 'fraud',
  'fraud-dashboard': 'fraud',
  'accounting': 'accounting',
  'profit-loss': 'profit_loss',
  'company-wallets': 'company_wallets',
  'capital': 'capital',
  'user-ledger': 'user_ledger',
  'ads-income': 'ads_income',
  'fixed-expenses': 'fixed_expenses',
  'prc-analytics': 'prc_analytics',
  'prc-economy': 'prc_economy',
  'liquidity': 'liquidity',
  'audit': 'audit',
  'subscriptions': 'subscription_payment',  // Replaces vip_payment
  'withdrawals': 'withdrawals',
  'gift-vouchers': 'gift_vouchers',  // Fixed: was 'gift-voucher'
  'bill-payments': 'bill_payments',   // Fixed: was 'bill-payment'
  'payment-settings': 'system_settings',
  'system-settings': 'system_settings',
  'web-settings': 'system_settings',
  'social-settings': 'system_settings',
  'redeem-settings': 'redeem_settings'
};

const AdminLayout = ({ children, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({
    requestApprovals: false,
    finance: false,
    controls: false,
    settings: false
  });
  const [userPermissions, setUserPermissions] = useState([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [pendingCounts, setPendingCounts] = useState({
    kyc: 0,
    subscriptions: 0,
    bills: 0,
    gifts: 0,
    bankWithdrawals: 0,
    rdRedeem: 0
  });

  // Fetch pending approval counts
  useEffect(() => {
    const fetchPendingCounts = async () => {
      try {
        // Use Promise.allSettled to handle individual API failures gracefully
        const results = await Promise.allSettled([
          axios.get(`${API}/kyc/stats`),
          axios.get(`${API}/admin/vip-payments?status=pending&limit=1`),
          axios.get(`${API}/admin/bill-payment/requests?status=pending&limit=1`),
          axios.get(`${API}/admin/gift-voucher/requests?status=pending&limit=1`),
          // luxury-claims API call REMOVED - feature deprecated
          axios.get(`${API}/admin/bank-redeem/requests?status=pending&page=1&limit=1`),
          axios.get(`${API}/rd/admin/redeem-requests?status=pending&skip=0&limit=1`)
        ]);
        
        // Extract values safely
        const getValue = (result, extractor, defaultVal = 0) => {
          if (result.status === 'fulfilled') {
            try {
              return extractor(result.value.data) || defaultVal;
            } catch {
              return defaultVal;
            }
          }
          return defaultVal;
        };
        
        setPendingCounts({
          kyc: getValue(results[0], d => d?.pending),
          subscriptions: getValue(results[1], d => d?.total || d?.payments?.length),
          bills: getValue(results[2], d => d?.stats?.pending || d?.total),
          gifts: getValue(results[3], d => d?.stats?.pending || d?.requests?.length || d?.total),
          // luxury count REMOVED - feature deprecated
          bankWithdrawals: getValue(results[4], d => d?.stats?.pending?.count || d?.total),
          rdRedeem: getValue(results[5], d => d?.stats?.pending || d?.total)
        });
      } catch (error) {
        console.error('Error fetching pending counts:', error);
      }
    };
    
    fetchPendingCounts();
    // Refresh counts every 2 minutes
    const interval = setInterval(fetchPendingCounts, 120000);
    return () => clearInterval(interval);
  }, []);

  // Fetch manager permissions on mount
  useEffect(() => {
    const fetchPermissions = async () => {
      if (user?.role === 'manager' && user?.uid) {
        try {
          const response = await axios.get(`${API}/admin/user/${user.uid}/permissions`);
          setUserPermissions(response.data.permissions || []);
        } catch (error) {
          console.error('Error fetching permissions:', error);
          setUserPermissions(['users', 'subscription_payment', 'kyc']); // Default permissions
        }
      } else if (user?.role === 'admin') {
        // Admin has all permissions
        setUserPermissions(['all']);
      }
      setPermissionsLoaded(true);
    };
    fetchPermissions();
  }, [user]);

  // Check if user has permission for a menu item
  const hasPermission = (menuId) => {
    if (user?.role === 'admin') return true;
    if (!permissionsLoaded) return false;
    const permissionId = MENU_TO_PERMISSION[menuId] || menuId;
    return userPermissions.includes(permissionId) || userPermissions.includes('all');
  };

  // Regular menu items (not grouped) - Simplified and organized
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/admin' },
    { id: 'members', label: 'Members Dashboard', icon: Users, path: '/admin/members' },
    { id: 'user-360', label: 'User 360° View', icon: Eye, path: '/admin/user-360' },
    // Orders removed - Marketplace deprecated (December 2025)
    // Delivery Partners removed - feature deprecated
    // Marketplace removed - feature deprecated
    // Chatbot Withdrawals removed - feature deprecated (March 2026)
    { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
    { id: 'performance-report', label: 'Admin Performance', icon: Award, path: '/admin/performance-report' },
    { id: 'support', label: 'Support Tickets', icon: HeadphonesIcon, path: '/admin/support' },
    { id: 'contact-submissions', label: 'Contact Inquiries', icon: Mail, path: '/admin/contact-submissions' },
  ];

  // Grouped menu items - Simplified structure
  // Pending counts mapping for Request Approvals sub-items
  const pendingCountsMap = {
    'kyc': pendingCounts.kyc,
    'subscriptions': pendingCounts.subscriptions,
    'bill-payments': pendingCounts.bills,
    'gift-vouchers': pendingCounts.gifts,
    'bank-withdrawals': pendingCounts.bankWithdrawals
    // recurring-deposits REMOVED - feature deprecated
  };
  
  const totalPendingApprovals = pendingCounts.kyc + pendingCounts.subscriptions + pendingCounts.bills + pendingCounts.gifts + pendingCounts.bankWithdrawals;

  const menuGroups = {
    requestApprovals: {
      label: 'Request Approvals',
      icon: CheckCircle,
      totalPending: totalPendingApprovals,
      subItems: [
        { id: 'kyc', label: 'KYC', icon: Shield, path: '/admin/kyc', pendingCount: pendingCounts.kyc },
        { id: 'bank-transfers', label: 'Redeem to Bank', icon: Banknote, path: '/admin/bank-transfers', highlight: true },
        { id: 'subscriptions', label: 'Subscription', icon: Crown, path: '/admin/subscriptions', pendingCount: pendingCounts.subscriptions },
        { id: 'razorpay-subs', label: 'Razorpay Payments', icon: CreditCard, path: '/admin/razorpay-subscriptions', highlight: true },
        { id: 'redeem-v2', label: 'Redeem Requests', icon: Receipt, path: '/admin/redeem', highlight: true },
        { id: 'bbps-dashboard', label: 'BBPS Instant', icon: Activity, path: '/admin/bbps', highlight: true },
        // DMT Bank Transfer removed - Eko API not working
        // unified-payments removed - all pending rejected + refunded
        { id: 'eko-services', label: 'Eko Direct Services', icon: Zap, path: '/admin/eko-services', highlight: true },
        // bill-payments removed - all pending rejected + refunded
        { id: 'gift-vouchers', label: 'Gift Vouchers', icon: Gift, path: '/admin/gift-vouchers', pendingCount: pendingCounts.gifts },
        // recurring-deposits REMOVED - feature deprecated
      ]
    },
    finance: {
      label: 'Finance & Accounting',
      icon: DollarSign,
      subItems: [
        { id: 'accounting', label: 'Accounting Dashboard', icon: BarChart2, path: '/admin/accounting' },
        { id: 'company-wallets', label: 'Company Wallets', icon: Wallet, path: '/admin/company-wallets' },
        { id: 'prc-analytics', label: 'PRC Analytics', icon: Activity, path: '/admin/prc-analytics' },
        { id: 'prc-ledger', label: 'PRC Ledger', icon: Activity, path: '/admin/prc-ledger' },
        { id: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp, path: '/admin/profit-loss' },
        { id: 'user-ledger', label: 'User Ledger', icon: FileText, path: '/admin/user-ledger' },
        { id: 'liquidity', label: 'Liquidity', icon: DollarSign, path: '/admin/liquidity' },
      ]
    },
    controls: {
      label: 'Controls & Security',
      icon: Shield,
      subItems: [
        { id: 'popup-messages', label: 'Popup Messages', icon: MessageSquare, path: '/admin/popup-messages', highlight: true },
        { id: 'error-monitor', label: 'System Monitor', icon: Activity, path: '/admin/error-monitor', highlight: true },
        { id: 'prc-economy', label: 'PRC Token Economy', icon: Coins, path: '/admin/prc-economy', highlight: true },
        { id: 'security-dashboard', label: 'Security Dashboard', icon: Shield, path: '/admin/security' },
        { id: 'fraud-dashboard', label: 'Fraud Detection', icon: ShieldAlert, path: '/admin/fraud-dashboard' },
        { id: 'fraud-alerts', label: 'Fraud Alerts', icon: AlertTriangle, path: '/admin/fraud-alerts' },
        { id: 'prc-burn-control', label: 'PRC Burn Control', icon: Flame, path: '/admin/prc-burn-control' },
        { id: 'data-backup', label: 'Data Backup & Archive', icon: Database, path: '/admin/data-backup' },
      ]
    },
    settings: {
      label: 'Settings',
      icon: Settings,
      subItems: [
        { id: 'settings-hub', label: 'All Settings', icon: Settings, path: '/admin/settings-hub' },
        { id: 'payment-settings', label: 'Payment Settings', icon: CreditCard, path: '/admin/settings-hub?tab=payment' },
        { id: 'system-settings', label: 'System Settings', icon: Cpu, path: '/admin/settings-hub?tab=system' },
        { id: 'web-settings', label: 'Web Settings', icon: Globe, path: '/admin/settings-hub?tab=web' },
        { id: 'social-settings', label: 'Social Media', icon: Share2, path: '/admin/settings-hub?tab=social' },
        { id: 'redeem-settings', label: 'Redeem Safety', icon: Shield, path: '/admin/settings-hub?tab=redeem' },
        { id: 'video-ads', label: 'Video Ads', icon: Video, path: '/admin/settings-hub?tab=video-ads' },
      ]
    }
  };

  // Map route paths to permission IDs
  const ROUTE_TO_PERMISSION = {
    '/admin/bill-payments': 'bill_payments',
    '/admin/gift-vouchers': 'gift_vouchers',
    '/admin/subscriptions': 'subscription_payment',
    '/admin/kyc': 'kyc',
    '/admin/users': 'users',
    '/admin/user-360': 'users',
    '/admin/members': 'users',
    // '/admin/orders': 'orders', // Marketplace deprecated
    // marketplace removed
    '/admin/support': 'support',
    '/admin/fraud-dashboard': 'fraud',
    '/admin/analytics': 'analytics',
  };

  // Check route permissions and redirect if unauthorized
  useEffect(() => {
    // Wait for permissions to load before checking
    if (!permissionsLoaded) return;
    
    // Admin has full access
    if (user?.role === 'admin') return;
    
    // Dashboard is always accessible
    if (location.pathname === '/admin') return;
    
    const currentPath = location.pathname;
    const requiredPermission = ROUTE_TO_PERMISSION[currentPath];
    
    // If this route requires a permission, check it
    if (requiredPermission) {
      const hasAccess = userPermissions.includes(requiredPermission);
      // console.log(`Route ${currentPath} requires ${requiredPermission}, user has: ${hasAccess}`);
      
      if (!hasAccess) {
        // console.log(`Access denied to ${currentPath}, redirecting to /admin`);
        navigate('/admin');
      }
    }
  }, [location.pathname, permissionsLoaded, userPermissions, user, navigate]);

  const isActive = (path) => {
    // Handle paths with query params
    if (path.includes('?')) {
      const [pathname, search] = path.split('?');
      return location.pathname === pathname && location.search.includes(search);
    }
    return location.pathname === path;
  };
  
  const isGroupActive = (groupKey) => {
    return menuGroups[groupKey].subItems.some(item => {
      if (item.path.includes('?')) {
        const [pathname] = item.path.split('?');
        return location.pathname === pathname;
      }
      return location.pathname === item.path;
    });
  };

  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const handleNavigation = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  // Filter menu items based on permissions
  const filteredMenuItems = menuItems.filter(item => hasPermission(item.id));
  
  // Filter grouped menu items based on permissions
  const getFilteredSubItems = (groupKey) => {
    return menuGroups[groupKey].subItems.filter(item => hasPermission(item.id));
  };

  // Render a single menu item
  const renderMenuItem = (item, isSubItem = false) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <button
        key={item.id}
        onClick={() => handleNavigation(item.path)}
        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
          isSubItem ? 'pl-10' : ''
        } ${
          active
            ? 'bg-purple-600 text-white'
            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
        }`}
        title={sidebarCollapsed ? item.label : ''}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {!sidebarCollapsed && <span className="text-sm">{item.label}</span>}
      </button>
    );
  };

  // Render a group header with expandable sub-items
  const renderMenuGroup = (groupKey) => {
    const group = menuGroups[groupKey];
    const Icon = group.icon;
    const isExpanded = expandedGroups[groupKey];
    const groupActive = isGroupActive(groupKey);
    const filteredSubItems = getFilteredSubItems(groupKey);
    const showTotalBadge = groupKey === 'requestApprovals' && group.totalPending > 0;
    
    // Don't render group if no items are accessible
    if (filteredSubItems.length === 0) return null;

    return (
      <div key={groupKey}>
        <button
          onClick={() => !sidebarCollapsed && toggleGroup(groupKey)}
          className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
            groupActive
              ? 'bg-purple-900/50 text-purple-300 border-l-2 border-purple-500'
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
          }`}
          title={sidebarCollapsed ? group.label : ''}
        >
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 flex-shrink-0" />
            {!sidebarCollapsed && (
              <span className="text-sm font-medium">{group.label}</span>
            )}
            {/* Total pending badge for Request Approvals */}
            {!sidebarCollapsed && showTotalBadge && (
              <span className="px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full min-w-[20px] text-center">
                {group.totalPending > 99 ? '99+' : group.totalPending}
              </span>
            )}
          </div>
          {!sidebarCollapsed && (
            <ChevronDown 
              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            />
          )}
        </button>
        
        {/* Sub-items */}
        {!sidebarCollapsed && isExpanded && (
          <div className="bg-gray-950/50">
            {filteredSubItems.map((subItem) => {
              const SubIcon = subItem.icon;
              const active = isActive(subItem.path);
              const hasPending = subItem.pendingCount && subItem.pendingCount > 0;
              return (
                <button
                  key={subItem.id}
                  onClick={() => handleNavigation(subItem.path)}
                  className={`w-full flex items-center justify-between pl-10 pr-4 py-2.5 transition-colors ${
                    active
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <SubIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">{subItem.label}</span>
                  </div>
                  {/* Individual pending count badge */}
                  {hasPending && (
                    <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full min-w-[20px] text-center ${
                      active ? 'bg-white/20 text-white' : 'bg-amber-500 text-black'
                    }`}>
                      {subItem.pendingCount > 99 ? '99+' : subItem.pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render mobile menu group
  const renderMobileMenuGroup = (groupKey) => {
    const group = menuGroups[groupKey];
    const Icon = group.icon;
    const isExpanded = expandedGroups[groupKey];
    const groupActive = isGroupActive(groupKey);
    const filteredSubItems = getFilteredSubItems(groupKey);
    const showTotalBadge = groupKey === 'requestApprovals' && group.totalPending > 0;
    
    // Don't render group if no items are accessible
    if (filteredSubItems.length === 0) return null;

    return (
      <div key={groupKey}>
        <button
          onClick={() => toggleGroup(groupKey)}
          className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
            groupActive
              ? 'bg-purple-900/50 text-purple-300 border-l-2 border-purple-500'
              : 'text-gray-300 hover:bg-gray-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5" />
            <span className="text-sm font-medium">{group.label}</span>
            {/* Total pending badge for Request Approvals */}
            {showTotalBadge && (
              <span className="px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full min-w-[20px] text-center">
                {group.totalPending > 99 ? '99+' : group.totalPending}
              </span>
            )}
          </div>
          <ChevronDown 
            className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          />
        </button>
        
        {isExpanded && (
          <div className="bg-gray-950/50">
            {filteredSubItems.map((subItem) => {
              const SubIcon = subItem.icon;
              const active = isActive(subItem.path);
              const hasPending = subItem.pendingCount && subItem.pendingCount > 0;
              return (
                <button
                  key={subItem.id}
                  onClick={() => handleNavigation(subItem.path)}
                  className={`w-full flex items-center justify-between pl-10 pr-4 py-2.5 transition-colors ${
                    active
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <SubIcon className="h-4 w-4" />
                    <span className="text-sm">{subItem.label}</span>
                  </div>
                  {/* Individual pending count badge */}
                  {hasPending && (
                    <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full min-w-[20px] text-center ${
                      active ? 'bg-white/20 text-white' : 'bg-amber-500 text-black'
                    }`}>
                      {subItem.pendingCount > 99 ? '99+' : subItem.pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 flex dark" data-admin="true">
      {/* Sidebar - Desktop */}
      <aside
        className={`hidden lg:flex flex-col bg-gray-900 text-white transition-all duration-300 border-r border-gray-800 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Logo" className="h-10 w-10 rounded-xl" />
            {!sidebarCollapsed && (
              <div>
                <h1 className="font-bold text-lg">PARAS REWARD</h1>
                <p className="text-xs text-gray-500">Admin Panel</p>
              </div>
            )}
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-4">
          {/* Regular menu items - filtered by permissions */}
          {filteredMenuItems.map((item) => renderMenuItem(item))}
          
          {/* Divider */}
          <div className="my-2 mx-4 border-t border-gray-800"></div>
          
          {/* Request Approvals Group */}
          {renderMenuGroup('requestApprovals')}
          
          {/* Finance Group */}
          {renderMenuGroup('finance')}
          
          {/* Controls & Security Group */}
          {renderMenuGroup('controls')}
          
          {/* Settings Group */}
          {renderMenuGroup('settings')}
        </nav>

        {/* Collapse Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-4 border-t border-gray-800 flex items-center justify-center hover:bg-gray-800"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>

        {/* User & Logout */}
        <div className="p-4 border-t border-gray-800">
          {!sidebarCollapsed && (
            <div className="mb-3">
              <p className="text-sm font-medium truncate">{user?.name || 'Admin'}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-gray-900 text-white overflow-y-auto">
            {/* Mobile Header */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={LOGO_URL} alt="Logo" className="h-10 w-10 rounded-xl" />
                <div>
                  <h1 className="font-bold">PARAS REWARD</h1>
                  <p className="text-xs text-gray-400">Admin Panel</p>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-gray-800 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile Menu */}
            <nav className="py-4">
              {/* Regular menu items - filtered by permissions */}
              {filteredMenuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                      active
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm">{item.label}</span>
                  </button>
                );
              })}
              
              {/* Divider */}
              <div className="my-2 mx-4 border-t border-gray-800"></div>
              
              {/* Request Approvals Group */}
              {renderMobileMenuGroup('requestApprovals')}
              
              {/* Finance Group */}
              {renderMobileMenuGroup('finance')}
              
              {/* Controls & Security Group */}
              {renderMobileMenuGroup('controls')}
              
              {/* Settings Group */}
              {renderMobileMenuGroup('settings')}
            </nav>

            {/* Mobile User & Logout */}
            <div className="p-4 border-t border-gray-800">
              <div className="mb-3">
                <p className="text-sm font-medium">{user?.name || 'Admin'}</p>
                <p className="text-xs text-gray-400">{user?.email}</p>
              </div>
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar - Dark Theme */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-800 rounded-lg text-gray-300"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-white">Admin Dashboard</h2>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-gray-800 rounded-lg relative">
              <Bell className="h-5 w-5 text-gray-400" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 rounded-full">
              <Shield className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-300">Admin</span>
            </div>
          </div>
        </header>

        {/* Page Content - Dark Background */}
        <main className="flex-1 overflow-auto bg-gray-950 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
