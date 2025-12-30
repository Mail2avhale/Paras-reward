import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Package, ShoppingCart, Truck, Users, BarChart3,
  MapPin, Wallet, Settings, ChevronLeft, ChevronRight,
  LogOut, Bell, Menu, X, Store, Zap, Box
} from 'lucide-react';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_appreward-portal/artifacts/8iqee76c_IMG-20251230-WA0006.jpg";

const StockistLayout = ({ children, user, onLogout, role }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Different menu items based on stockist role
  const getMenuItems = () => {
    const baseItems = [
      { id: 'dashboard', label: 'Dashboard', icon: Home, path: getBasePath() },
      { id: 'orders', label: 'Orders', icon: ShoppingCart, path: `${getBasePath()}/orders` },
      { id: 'inventory', label: 'Inventory', icon: Package, path: `${getBasePath()}/inventory` },
    ];

    if (role === 'master_stockist') {
      return [
        ...baseItems,
        { id: 'sub-stockists', label: 'Sub Stockists', icon: Users, path: '/master-stockist/sub-stockists' },
        { id: 'outlets', label: 'Outlets', icon: Store, path: '/master-stockist/outlets' },
        { id: 'stock-requests', label: 'Stock Requests', icon: Box, path: '/master-stockist/stock-requests' },
        { id: 'deliveries', label: 'Deliveries', icon: Truck, path: '/master-stockist/deliveries' },
        { id: 'reports', label: 'Reports', icon: BarChart3, path: '/master-stockist/reports' },
        { id: 'wallet', label: 'Wallet', icon: Wallet, path: '/master-stockist/wallet' },
      ];
    } else if (role === 'sub_stockist') {
      return [
        ...baseItems,
        { id: 'outlets', label: 'My Outlets', icon: Store, path: '/sub-stockist/outlets' },
        { id: 'stock-requests', label: 'Stock Requests', icon: Box, path: '/sub-stockist/stock-requests' },
        { id: 'deliveries', label: 'Deliveries', icon: Truck, path: '/sub-stockist/deliveries' },
        { id: 'wallet', label: 'Wallet', icon: Wallet, path: '/sub-stockist/wallet' },
      ];
    } else if (role === 'outlet') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/outlet' },
        { id: 'orders', label: 'Pending Orders', icon: ShoppingCart, path: '/outlet/orders' },
        { id: 'verify', label: 'Verify & Deliver', icon: Truck, path: '/outlet/verify' },
        { id: 'inventory', label: 'My Stock', icon: Package, path: '/outlet/inventory' },
        { id: 'stock-request', label: 'Request Stock', icon: Box, path: '/outlet/stock-request' },
        { id: 'history', label: 'History', icon: BarChart3, path: '/outlet/history' },
      ];
    }
    return baseItems;
  };

  const getBasePath = () => {
    switch (role) {
      case 'master_stockist': return '/master-stockist';
      case 'sub_stockist': return '/sub-stockist';
      case 'outlet': return '/outlet';
      default: return '/stockist';
    }
  };

  const getRoleLabel = () => {
    switch (role) {
      case 'master_stockist': return 'Master Stockist';
      case 'sub_stockist': return 'Sub Stockist';
      case 'outlet': return 'Outlet';
      default: return 'Stockist';
    }
  };

  const getRoleColor = () => {
    switch (role) {
      case 'master_stockist': return { bg: 'bg-emerald-900', hover: 'hover:bg-emerald-800', active: 'bg-emerald-600', light: 'bg-emerald-100', text: 'text-emerald-700' };
      case 'sub_stockist': return { bg: 'bg-teal-900', hover: 'hover:bg-teal-800', active: 'bg-teal-600', light: 'bg-teal-100', text: 'text-teal-700' };
      case 'outlet': return { bg: 'bg-cyan-900', hover: 'hover:bg-cyan-800', active: 'bg-cyan-600', light: 'bg-cyan-100', text: 'text-cyan-700' };
      default: return { bg: 'bg-green-900', hover: 'hover:bg-green-800', active: 'bg-green-600', light: 'bg-green-100', text: 'text-green-700' };
    }
  };

  const menuItems = getMenuItems();
  const colors = getRoleColor();
  const isActive = (path) => location.pathname === path;

  const handleNavigation = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar - Desktop */}
      <aside
        className={`hidden lg:flex flex-col ${colors.bg} text-white transition-all duration-300 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Logo" className="h-10 w-10 rounded-xl" />
            {!sidebarCollapsed && (
              <div>
                <h1 className="font-bold text-lg">PARAS REWARD</h1>
                <p className="text-xs text-white/60">{getRoleLabel()}</p>
              </div>
            )}
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                  active
                    ? `${colors.active} text-white`
                    : `text-white/70 ${colors.hover} hover:text-white`
                }`}
                title={sidebarCollapsed ? item.label : ''}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="text-sm">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`p-4 border-t border-white/10 flex items-center justify-center ${colors.hover}`}
        >
          {sidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>

        {/* User & Logout */}
        <div className="p-4 border-t border-white/10">
          {!sidebarCollapsed && (
            <div className="mb-3">
              <p className="text-sm font-medium truncate">{user?.name || getRoleLabel()}</p>
              <p className="text-xs text-white/60 truncate">{user?.email}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/dashboard')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 ${colors.hover} rounded-lg text-sm border border-white/20`}
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

      {/* Mobile Sidebar */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className={`absolute left-0 top-0 bottom-0 w-72 ${colors.bg} text-white overflow-y-auto`}>
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={LOGO_URL} alt="Logo" className="h-10 w-10 rounded-xl" />
                <div>
                  <h1 className="font-bold">PARAS REWARD</h1>
                  <p className="text-xs text-white/60">{getRoleLabel()}</p>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className={`p-2 ${colors.hover} rounded-lg`}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="py-4">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                      active ? `${colors.active} text-white` : `text-white/70 ${colors.hover}`
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm">{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/10">
              <div className="mb-3">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-white/60">{user?.email}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 ${colors.hover} rounded-lg text-sm border border-white/20`}
                >
                  <Zap className="h-4 w-4" /> User View
                </button>
                <button onClick={onLogout} className="p-2 bg-red-600 rounded-lg">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">{getRoleLabel()} Dashboard</h2>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-gray-100 rounded-lg relative">
              <Bell className="h-5 w-5 text-gray-600" />
            </button>
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 ${colors.light} rounded-full`}>
              <Store className={`h-4 w-4 ${colors.text}`} />
              <span className={`text-sm font-medium ${colors.text}`}>{getRoleLabel()}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
};

export default StockistLayout;
