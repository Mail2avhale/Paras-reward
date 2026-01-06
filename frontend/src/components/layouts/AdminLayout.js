import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  Home, Users, CreditCard, FileText, Settings, BarChart3, BarChart2,
  Gift, ShoppingCart, Video, Award, Activity, Package,
  Truck, Store, HeadphonesIcon, UserCog, DollarSign,
  ChevronLeft, ChevronRight, LogOut, Bell, Search,
  Menu, X, Shield, Zap, Wallet, TrendingUp, ChevronDown,
  Globe, Phone, Mail, Image, Share2, Cpu, ToggleLeft,
  AlertTriangle, Smartphone, Building, Crown, CloudRain, AlertOctagon
} from 'lucide-react';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_appreward-portal/artifacts/8iqee76c_IMG-20251230-WA0006.jpg";
const API = process.env.REACT_APP_BACKEND_URL;

// Mapping of menu item IDs to permission IDs
const MENU_TO_PERMISSION = {
  'dashboard': 'dashboard',
  'users': 'users',
  'user-controls': 'user_controls',
  'analytics': 'analytics',
  'kyc': 'kyc',
  'orders': 'orders',
  'marketplace': 'marketplace',
  'video-ads': 'video_ads',
  'prc-rain': 'prc_rain',
  'stockists': 'stockist',
  'support': 'support',
  'fraud-alerts': 'fraud',
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
  'vip-payment': 'vip_payment',
  'withdrawals': 'withdrawals',
  'gift-voucher': 'gift_voucher',
  'bill-payment': 'bill_payment',
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
    settings: false,
    payments: false,
    finance: false
  });
  const [userPermissions, setUserPermissions] = useState([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // Fetch manager permissions on mount
  useEffect(() => {
    const fetchPermissions = async () => {
      if (user?.role === 'manager' && user?.uid) {
        try {
          const response = await axios.get(`${API}/api/admin/user/${user.uid}/permissions`);
          setUserPermissions(response.data.permissions || []);
        } catch (error) {
          console.error('Error fetching permissions:', error);
          setUserPermissions(['users', 'vip_payment', 'kyc']); // Default permissions
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

  // Regular menu items (not grouped)
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/admin' },
    { id: 'users', label: 'Users', icon: Users, path: '/admin/users' },
    { id: 'user-controls', label: 'User Controls', icon: UserCog, path: '/admin/user-controls' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
    { id: 'kyc', label: 'KYC Verification', icon: FileText, path: '/admin/kyc' },
    { id: 'orders', label: 'Orders', icon: ShoppingCart, path: '/admin/orders' },
    { id: 'marketplace', label: 'Marketplace', icon: Store, path: '/admin/marketplace' },
    { id: 'video-ads', label: 'Video Ads', icon: Video, path: '/admin/video-ads' },
    { id: 'prc-rain', label: 'PRC Rain Drop', icon: CloudRain, path: '/admin/prc-rain' },
    { id: 'stockists', label: 'Stockist Management', icon: UserCog, path: '/admin/stockists' },
    { id: 'support', label: 'Support Tickets', icon: HeadphonesIcon, path: '/admin/support' },
    { id: 'fraud-alerts', label: 'Fraud Alerts', icon: AlertTriangle, path: '/admin/fraud-alerts' },
  ];

  // Grouped menu items
  const menuGroups = {
    finance: {
      label: 'Finance',
      icon: DollarSign,
      subItems: [
        { id: 'accounting', label: 'Accounting Dashboard', icon: BarChart2, path: '/admin/accounting' },
        { id: 'cash-bank-book', label: 'Cash & Bank Book', icon: Wallet, path: '/admin/cash-bank-book' },
        { id: 'capital-management', label: 'Capital & Equity', icon: Building, path: '/admin/capital-management' },
        { id: 'trial-balance', label: 'Trial Balance & COA', icon: Activity, path: '/admin/trial-balance' },
        { id: 'accounts-receivable', label: 'Accounts Receivable (AR)', icon: TrendingUp, path: '/admin/accounts-receivable' },
        { id: 'accounts-payable', label: 'Accounts Payable (AP)', icon: TrendingUp, path: '/admin/accounts-payable' },
        { id: 'financial-ratios', label: 'Financial Ratios', icon: Activity, path: '/admin/financial-ratios' },
        { id: 'prc-ledger', label: 'PRC Ledger (DR/CR)', icon: Activity, path: '/admin/prc-ledger' },
        { id: 'financial-reports', label: 'Financial Reports', icon: FileText, path: '/admin/financial-reports' },
        { id: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp, path: '/admin/profit-loss' },
        { id: 'company-wallets', label: 'Company Wallets', icon: Wallet, path: '/admin/company-wallets' },
        { id: 'user-ledger', label: 'User Ledger', icon: FileText, path: '/admin/user-ledger' },
        { id: 'ads-income', label: 'Ads Income', icon: Smartphone, path: '/admin/ads-income' },
        { id: 'fixed-expenses', label: 'Fixed Expenses', icon: Building, path: '/admin/fixed-expenses' },
        { id: 'prc-analytics', label: 'PRC Analytics', icon: Activity, path: '/admin/prc-analytics' },
        { id: 'prc-economy', label: 'PRC Emergency Controls', icon: AlertOctagon, path: '/admin/prc-economy' },
        { id: 'liquidity', label: 'Liquidity', icon: DollarSign, path: '/admin/liquidity' },
        { id: 'audit', label: 'Audit Service', icon: Shield, path: '/admin/audit' },
      ]
    },
    security: {
      label: '🔐 Security',
      icon: Shield,
      subItems: [
        { 
          id: 'security-dashboard', 
          label: 'Security Dashboard', 
          icon: Shield, 
          path: '/admin/security',
          description: 'JWT, Rate Limiting, Sessions, Audit Logs'
        },
      ]
    },
    settings: {
      label: 'Settings',
      icon: Settings,
      subItems: [
        { 
          id: 'system-settings', 
          label: 'System Settings', 
          icon: Cpu, 
          path: '/admin/settings/system',
          description: 'VIP Plans, Mining Formula, Registration Control, Service Charges'
        },
        { 
          id: 'web-settings', 
          label: 'Web Settings', 
          icon: Globe, 
          path: '/admin/settings/web',
          description: 'Policy Editor, Address, Phone, Email, Logo'
        },
        { 
          id: 'social-settings', 
          label: 'Social Media', 
          icon: Share2, 
          path: '/admin/settings/social',
          description: 'Social Media Links & Integrations'
        },
        { 
          id: 'redeem-settings', 
          label: 'Redeem Safety', 
          icon: Shield, 
          path: '/admin/settings/redeem',
          description: 'Daily Limits, Approval Thresholds'
        },
      ]
    },
    payments: {
      label: 'Payments',
      icon: CreditCard,
      subItems: [
        { 
          id: 'vip-verification', 
          label: 'VIP Verification', 
          icon: Award, 
          path: '/admin/vip-verification',
          description: 'Approve/Reject VIP Payments'
        },
        { 
          id: 'vip-plans', 
          label: 'VIP Plans', 
          icon: Crown, 
          path: '/admin/payments',
          description: 'Manage VIP Plan Pricing'
        },
        { 
          id: 'bill-payments', 
          label: 'Bill Payments', 
          icon: FileText, 
          path: '/admin/bill-payments',
          description: 'Recharge & Bill Payment Requests'
        },
        { 
          id: 'gift-vouchers', 
          label: 'Gift Vouchers', 
          icon: Gift, 
          path: '/admin/gift-vouchers',
          description: 'PhonePe Gift Voucher Requests'
        },
      ]
    }
  };

  const isActive = (path) => location.pathname === path;
  const isGroupActive = (groupKey) => {
    return menuGroups[groupKey].subItems.some(item => location.pathname === item.path);
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
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
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
    
    // Don't render group if no items are accessible
    if (filteredSubItems.length === 0) return null;

    return (
      <div key={groupKey}>
        <button
          onClick={() => !sidebarCollapsed && toggleGroup(groupKey)}
          className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
            groupActive
              ? 'bg-purple-900/50 text-purple-300 border-l-2 border-purple-500'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
          title={sidebarCollapsed ? group.label : ''}
        >
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium">{group.label}</span>}
          </div>
          {!sidebarCollapsed && (
            <ChevronDown 
              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            />
          )}
        </button>
        
        {/* Sub-items */}
        {!sidebarCollapsed && isExpanded && (
          <div className="bg-slate-950/50">
            {filteredSubItems.map((subItem) => {
              const SubIcon = subItem.icon;
              const active = isActive(subItem.path);
              return (
                <button
                  key={subItem.id}
                  onClick={() => handleNavigation(subItem.path)}
                  className={`w-full flex items-center gap-3 pl-10 pr-4 py-2.5 transition-colors ${
                    active
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <SubIcon className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{subItem.label}</span>
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
    
    // Don't render group if no items are accessible
    if (filteredSubItems.length === 0) return null;

    return (
      <div key={groupKey}>
        <button
          onClick={() => toggleGroup(groupKey)}
          className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
            groupActive
              ? 'bg-purple-900/50 text-purple-300 border-l-2 border-purple-500'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5" />
            <span className="text-sm font-medium">{group.label}</span>
          </div>
          <ChevronDown 
            className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          />
        </button>
        
        {isExpanded && (
          <div className="bg-slate-950/50">
            {filteredSubItems.map((subItem) => {
              const SubIcon = subItem.icon;
              const active = isActive(subItem.path);
              return (
                <button
                  key={subItem.id}
                  onClick={() => handleNavigation(subItem.path)}
                  className={`w-full flex items-center gap-3 pl-10 pr-4 py-2.5 transition-colors ${
                    active
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <SubIcon className="h-4 w-4" />
                  <span className="text-sm">{subItem.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar - Desktop */}
      <aside
        className={`hidden lg:flex flex-col bg-slate-900 text-white transition-all duration-300 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Logo" className="h-10 w-10 rounded-xl" />
            {!sidebarCollapsed && (
              <div>
                <h1 className="font-bold text-lg">PARAS REWARD</h1>
                <p className="text-xs text-slate-400">Admin Panel</p>
              </div>
            )}
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-4">
          {/* Regular menu items - filtered by permissions */}
          {filteredMenuItems.map((item) => renderMenuItem(item))}
          
          {/* Divider */}
          <div className="my-2 mx-4 border-t border-slate-700"></div>
          
          {/* Finance Group */}
          {renderMenuGroup('finance')}
          
          {/* Security Group */}
          {renderMenuGroup('security')}
          
          {/* Settings Group */}
          {renderMenuGroup('settings')}
          
          {/* Payments Group */}
          {renderMenuGroup('payments')}
        </nav>

        {/* Collapse Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-4 border-t border-slate-700 flex items-center justify-center hover:bg-slate-800"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>

        {/* User & Logout */}
        <div className="p-4 border-t border-slate-700">
          {!sidebarCollapsed && (
            <div className="mb-3">
              <p className="text-sm font-medium truncate">{user?.name || 'Admin'}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm"
              title="Switch to User View"
            >
              <Zap className="h-4 w-4" />
              {!sidebarCollapsed && <span>User View</span>}
            </button>
            <button
              onClick={onLogout}
              className="flex items-center justify-center p-2 bg-red-600 hover:bg-red-700 rounded-lg"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-slate-900 text-white overflow-y-auto">
            {/* Mobile Header */}
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={LOGO_URL} alt="Logo" className="h-10 w-10 rounded-xl" />
                <div>
                  <h1 className="font-bold">PARAS REWARD</h1>
                  <p className="text-xs text-slate-400">Admin Panel</p>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-slate-800 rounded-lg">
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
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm">{item.label}</span>
                  </button>
                );
              })}
              
              {/* Divider */}
              <div className="my-2 mx-4 border-t border-slate-700"></div>
              
              {/* Finance Group */}
              {renderMobileMenuGroup('finance')}
              
              {/* Settings Group */}
              {renderMobileMenuGroup('settings')}
              
              {/* Payments Group */}
              {renderMobileMenuGroup('payments')}
            </nav>

            {/* Mobile User & Logout */}
            <div className="p-4 border-t border-slate-700">
              <div className="mb-3">
                <p className="text-sm font-medium">{user?.name || 'Admin'}</p>
                <p className="text-xs text-slate-400">{user?.email}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm"
                >
                  <Zap className="h-4 w-4" />
                  <span>User View</span>
                </button>
                <button
                  onClick={onLogout}
                  className="flex items-center justify-center p-2 bg-red-600 hover:bg-red-700 rounded-lg"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">Admin Dashboard</h2>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-gray-100 rounded-lg relative">
              <Bell className="h-5 w-5 text-gray-600" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-purple-100 rounded-full">
              <Shield className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-700">Admin</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
