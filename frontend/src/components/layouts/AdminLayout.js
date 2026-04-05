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

// Mapping of menu item IDs to permission IDs (Cleaned - March 2026)
const MENU_TO_PERMISSION = {
  // General
  'dashboard': 'dashboard',
  'users': 'users',
  'user360': 'user360',
  'members': 'members',
  'analytics': 'analytics',
  'performance-report': 'performance-report',
  
  // Operations
  'kyc': 'kyc',
  'support': 'support',
  'contact-submissions': 'contact-submissions',
  'popup-messages': 'popup-messages',
  'error-monitor': 'error-monitor',
  
  // Payments - Active
  'subscriptions': 'subscriptions',
  'bank-transfers': 'bank-transfers',
  'razorpay-subs': 'razorpay-subs',
  'bbps-dashboard': 'bbps-dashboard',
  'eko-services': 'eko-services',
  'gift-vouchers': 'gift-vouchers',
  
  // Finance
  'accounting': 'accounting',
  'company-wallets': 'company-wallets',
  'prc-analytics': 'prc-analytics',
  'prc-ledger': 'prc-ledger',
  'profit-loss': 'profit-loss',
  'user-ledger': 'user-ledger',
  'liquidity': 'liquidity',
  
  // Security
  'fraud-alerts': 'fraud-alerts',
  'fraud-dashboard': 'fraud-dashboard',
  'security-dashboard': 'security',
  'prc-economy': 'prc-economy',
  'data-backup': 'data-backup',
  
  // Settings
  'settings-hub': 'settings-hub',
  'payment-settings': 'settings-hub',
  'system-settings': 'settings-hub',
  'web-settings': 'settings-hub',
  'social-settings': 'settings-hub',
  'redeem-settings': 'settings-hub',
  'video-ads': 'settings-hub'
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
        const results = await Promise.allSettled([
          axios.get(`${API}/kyc/stats`),
          axios.get(`${API}/admin/vip-payments?status=pending&limit=1`),
          axios.get(`${API}/admin/bill-payment/requests?status=pending&limit=1`),
          axios.get(`${API}/admin/gift-voucher/requests?status=pending&limit=1`),
          axios.get(`${API}/admin/bank-redeem/requests?status=pending&page=1&limit=1`),
          axios.get(`${API}/rd/admin/redeem-requests?status=pending&skip=0&limit=1`)
        ]);
        
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
          bankWithdrawals: getValue(results[4], d => d?.stats?.pending?.count || d?.total),
          rdRedeem: getValue(results[5], d => d?.stats?.pending || d?.total)
        });
      } catch (error) {
        console.error('Error fetching pending counts:', error);
      }
    };
    
    fetchPendingCounts();
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
          setUserPermissions(['users', 'subscription_payment', 'kyc']);
        }
      } else if (user?.role === 'admin') {
        setUserPermissions(['all']);
      }
      setPermissionsLoaded(true);
    };
    fetchPermissions();
  }, [user]);

  const hasPermission = (menuId) => {
    if (user?.role === 'admin') return true;
    if (!permissionsLoaded) return false;
    const permissionId = MENU_TO_PERMISSION[menuId] || menuId;
    return userPermissions.includes(permissionId) || userPermissions.includes('all');
  };

  // Regular menu items
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/admin' },
    { id: 'members', label: 'Members Dashboard', icon: Users, path: '/admin/members' },
    { id: 'user360', label: 'User 360° View', icon: Eye, path: '/admin/user360' },
    { id: 'failed-transactions', label: 'Failed Transactions', icon: AlertTriangle, path: '/admin/failed-transactions' },
    { id: 'transaction-manager', label: 'Transaction Manager', icon: FileText, path: '/admin/transaction-manager' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
    { id: 'performance-report', label: 'Admin Performance', icon: Award, path: '/admin/performance-report' },
    { id: 'support', label: 'Support Tickets', icon: HeadphonesIcon, path: '/admin/support' },
    { id: 'contact-submissions', label: 'Contact Inquiries', icon: Mail, path: '/admin/contact-submissions' },
  ];

  const pendingCountsMap = {
    'kyc': pendingCounts.kyc,
    'subscriptions': pendingCounts.subscriptions,
    'bill-payments': pendingCounts.bills,
    'gift-vouchers': pendingCounts.gifts,
    'bank-withdrawals': pendingCounts.bankWithdrawals
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
        { id: 'bbps-dashboard', label: 'BBPS Instant', icon: Activity, path: '/admin/bbps', highlight: true },
        { id: 'eko-services', label: 'Eko Direct Services', icon: Zap, path: '/admin/eko-services', highlight: true },
        { id: 'gift-vouchers', label: 'Gift Vouchers', icon: Gift, path: '/admin/gift-vouchers', pendingCount: pendingCounts.gifts },
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

  const ROUTE_TO_PERMISSION = {
    '/admin/members': 'members',
    '/admin/user360': 'user360',
    '/admin/analytics': 'analytics',
    '/admin/performance-report': 'performance-report',
    '/admin/kyc': 'kyc',
    '/admin/support': 'support',
    '/admin/contact-submissions': 'contact-submissions',
    '/admin/popup-messages': 'popup-messages',
    '/admin/error-monitor': 'error-monitor',
    '/admin/subscriptions': 'subscriptions',
    '/admin/bank-transfers': 'bank-transfers',
    '/admin/razorpay-subscriptions': 'razorpay-subs',
    '/admin/bbps': 'bbps-dashboard',
    '/admin/eko-services': 'eko-services',
    '/admin/gift-vouchers': 'gift-vouchers',
    '/admin/accounting': 'accounting',
    '/admin/company-wallets': 'company-wallets',
    '/admin/prc-analytics': 'prc-analytics',
    '/admin/prc-ledger': 'prc-ledger',
    '/admin/profit-loss': 'profit-loss',
    '/admin/user-ledger': 'user-ledger',
    '/admin/liquidity': 'liquidity',
    '/admin/fraud-dashboard': 'fraud-dashboard',
    '/admin/fraud-alerts': 'fraud-alerts',
    '/admin/security': 'security',
    '/admin/prc-economy': 'prc-economy',
    '/admin/data-backup': 'data-backup',
    '/admin/settings-hub': 'settings-hub',
    '/admin/transaction-manager': 'transaction-manager',
  };

  useEffect(() => {
    if (!permissionsLoaded) return;
    if (user?.role === 'admin') return;
    if (location.pathname === '/admin') return;
    
    const currentPath = location.pathname;
    const requiredPermission = ROUTE_TO_PERMISSION[currentPath];
    
    if (requiredPermission) {
      const hasAccess = userPermissions.includes(requiredPermission);
      if (!hasAccess) {
        navigate('/admin');
      }
    }
  }, [location.pathname, permissionsLoaded, userPermissions, user, navigate]);

  const isActive = (path) => {
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

  const filteredMenuItems = menuItems.filter(item => hasPermission(item.id));
  
  const getFilteredSubItems = (groupKey) => {
    return menuGroups[groupKey].subItems.filter(item => hasPermission(item.id));
  };

  // Render a single menu item - BULKPE STYLE
  const renderMenuItem = (item, isSubItem = false) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <button
        key={item.id}
        data-testid={`admin-sidebar-${item.id}`}
        onClick={() => handleNavigation(item.path)}
        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl mx-2 my-0.5 transition-colors duration-200 ${
          isSubItem ? 'pl-10' : ''
        } ${
          active
            ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
            : 'text-slate-700 hover:bg-purple-50 hover:text-purple-700'
        }`}
        title={sidebarCollapsed ? item.label : ''}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {!sidebarCollapsed && <span className="text-[15px] font-medium">{item.label}</span>}
      </button>
    );
  };

  // Render a group header - BULKPE STYLE
  const renderMenuGroup = (groupKey) => {
    const group = menuGroups[groupKey];
    const Icon = group.icon;
    const isExpanded = expandedGroups[groupKey];
    const groupActive = isGroupActive(groupKey);
    const filteredSubItems = getFilteredSubItems(groupKey);
    const showTotalBadge = groupKey === 'requestApprovals' && group.totalPending > 0;
    
    if (filteredSubItems.length === 0) return null;

    return (
      <div key={groupKey} className="mb-1">
        <button
          data-testid={`admin-sidebar-group-${groupKey}`}
          onClick={() => !sidebarCollapsed && toggleGroup(groupKey)}
          className={`w-full flex items-center justify-between px-4 py-3.5 mx-2 rounded-xl transition-colors duration-200 ${
            groupActive
              ? 'bg-purple-50 text-purple-700 border-l-4 border-purple-600'
              : 'text-slate-700 hover:bg-slate-50'
          }`}
          title={sidebarCollapsed ? group.label : ''}
        >
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 flex-shrink-0" />
            {!sidebarCollapsed && (
              <span className="text-[15px] font-semibold">{group.label}</span>
            )}
            {!sidebarCollapsed && showTotalBadge && (
              <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full min-w-[22px] text-center">
                {group.totalPending > 99 ? '99+' : group.totalPending}
              </span>
            )}
          </div>
          {!sidebarCollapsed && (
            <ChevronDown 
              className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
            />
          )}
        </button>
        
        {/* Sub-items */}
        {!sidebarCollapsed && isExpanded && (
          <div className="mt-1 space-y-0.5">
            {filteredSubItems.map((subItem) => {
              const SubIcon = subItem.icon;
              const active = isActive(subItem.path);
              const hasPending = subItem.pendingCount && subItem.pendingCount > 0;
              return (
                <button
                  key={subItem.id}
                  data-testid={`admin-sidebar-${subItem.id}`}
                  onClick={() => handleNavigation(subItem.path)}
                  className={`w-full flex items-center justify-between pl-12 pr-4 py-3 mx-2 rounded-xl transition-colors duration-200 ${
                    active
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-600 hover:bg-purple-50 hover:text-purple-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <SubIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-[14px] font-medium">{subItem.label}</span>
                  </div>
                  {hasPending && (
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full min-w-[22px] text-center ${
                      active ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
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

  // Render mobile menu group - BULKPE STYLE
  const renderMobileMenuGroup = (groupKey) => {
    const group = menuGroups[groupKey];
    const Icon = group.icon;
    const isExpanded = expandedGroups[groupKey];
    const groupActive = isGroupActive(groupKey);
    const filteredSubItems = getFilteredSubItems(groupKey);
    const showTotalBadge = groupKey === 'requestApprovals' && group.totalPending > 0;
    
    if (filteredSubItems.length === 0) return null;

    return (
      <div key={groupKey} className="mb-1">
        <button
          onClick={() => toggleGroup(groupKey)}
          className={`w-full flex items-center justify-between px-4 py-3 mx-2 rounded-xl transition-colors duration-200 ${
            groupActive
              ? 'bg-purple-50 text-purple-700'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5" />
            <span className="text-sm font-semibold">{group.label}</span>
            {showTotalBadge && (
              <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
                {group.totalPending > 99 ? '99+' : group.totalPending}
              </span>
            )}
          </div>
          <ChevronDown 
            className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
          />
        </button>
        
        {isExpanded && (
          <div className="mt-1 space-y-0.5">
            {filteredSubItems.map((subItem) => {
              const SubIcon = subItem.icon;
              const active = isActive(subItem.path);
              const hasPending = subItem.pendingCount && subItem.pendingCount > 0;
              return (
                <button
                  key={subItem.id}
                  onClick={() => handleNavigation(subItem.path)}
                  className={`w-full flex items-center justify-between pl-12 pr-4 py-2.5 mx-2 rounded-xl transition-colors duration-200 ${
                    active
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-500 hover:bg-purple-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <SubIcon className="h-4 w-4" />
                    <span className="text-sm">{subItem.label}</span>
                  </div>
                  {hasPending && (
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                      active ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
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
    <div className="min-h-screen bg-white flex" data-admin="true" data-testid="admin-layout">
      {/* Sidebar - Desktop - BULKPE STYLE */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-slate-200 transition-all duration-300 shadow-sm ${
          sidebarCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        {/* Logo */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Logo" className="h-11 w-11 rounded-xl shadow-md" />
            {!sidebarCollapsed && (
              <div>
                <h1 className="font-bold text-lg text-slate-800 tracking-tight">PARAS REWARD</h1>
                <p className="text-xs text-slate-400 font-medium">Admin Panel</p>
              </div>
            )}
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {/* Regular menu items */}
          {filteredMenuItems.map((item) => renderMenuItem(item))}
          
          {/* Divider */}
          <div className="my-4 mx-4 border-t border-slate-200"></div>
          
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
          data-testid="admin-sidebar-collapse"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-4 border-t border-slate-100 flex items-center justify-center hover:bg-slate-50 text-slate-400 transition-colors duration-200"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>

        {/* User & Logout */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          {!sidebarCollapsed && (
            <div className="mb-3">
              <p className="text-sm font-semibold text-slate-800 truncate">{user?.name || 'Admin'}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          )}
          <button
            data-testid="admin-logout-btn"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 rounded-xl text-sm text-white font-medium transition-colors duration-200"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay - BULKPE STYLE */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-80 bg-white shadow-2xl overflow-y-auto rounded-r-3xl">
            {/* Mobile Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={LOGO_URL} alt="Logo" className="h-11 w-11 rounded-xl shadow-md" />
                <div>
                  <h1 className="font-bold text-slate-800">PARAS REWARD</h1>
                  <p className="text-xs text-slate-400">Admin Panel</p>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile Menu */}
            <nav className="py-4 px-2">
              {filteredMenuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3 mx-2 rounded-xl transition-colors duration-200 ${
                      active
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-600 hover:bg-purple-50'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                );
              })}
              
              {/* Divider */}
              <div className="my-4 mx-4 border-t border-slate-200"></div>
              
              {renderMobileMenuGroup('requestApprovals')}
              {renderMobileMenuGroup('finance')}
              {renderMobileMenuGroup('controls')}
              {renderMobileMenuGroup('settings')}
            </nav>

            {/* Mobile User & Logout */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <div className="mb-3">
                <p className="text-sm font-semibold text-slate-800">{user?.name || 'Admin'}</p>
                <p className="text-xs text-slate-400">{user?.email}</p>
              </div>
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 rounded-xl text-sm text-white font-medium"
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
        {/* Top Bar - BULKPE STYLE */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              data-testid="admin-mobile-menu"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-xl text-slate-600"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-slate-800 tracking-tight">Admin Dashboard</h2>
          </div>

          <div className="flex items-center gap-3">
            <button 
              data-testid="admin-notifications"
              className="p-2.5 hover:bg-slate-100 rounded-xl relative text-slate-600 transition-colors duration-200"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-xl border border-purple-100">
              <Shield className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-semibold text-purple-700">Admin</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold shadow-md">
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
          </div>
        </header>

        {/* Page Content - BULKPE STYLE - Light Cream Background */}
        <main className="flex-1 overflow-auto bg-white p-6 lg:p-8" data-testid="admin-main-content">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 px-6 py-3 text-center">
          <p className="text-xs text-slate-400">© 2021 - 2026 Paras Reward Technologies</p>
        </footer>
      </div>
    </div>
  );
};

export default AdminLayout;
