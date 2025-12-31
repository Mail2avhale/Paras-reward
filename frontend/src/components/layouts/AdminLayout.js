import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Users, CreditCard, FileText, Settings, BarChart3,
  Gift, ShoppingCart, Video, Award, Activity, Package,
  Truck, Store, HeadphonesIcon, UserCog, DollarSign,
  ChevronLeft, ChevronRight, LogOut, Bell, Search,
  Menu, X, Shield, Zap
} from 'lucide-react';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_appreward-portal/artifacts/8iqee76c_IMG-20251230-WA0006.jpg";

const AdminLayout = ({ children, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/admin' },
    { id: 'users', label: 'Users', icon: Users, path: '/admin/users' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
    { id: 'prc-analytics', label: 'PRC Analytics', icon: Activity, path: '/admin/prc-analytics' },
    { id: 'kyc', label: 'KYC Verification', icon: FileText, path: '/admin/kyc' },
    { id: 'payments', label: 'VIP Payments', icon: CreditCard, path: '/admin/payments' },
    { id: 'bill-payments', label: 'Bill Payments', icon: CreditCard, path: '/admin/bill-payments' },
    { id: 'gift-vouchers', label: 'Gift Vouchers', icon: Gift, path: '/admin/gift-vouchers' },
    { id: 'orders', label: 'Orders', icon: ShoppingCart, path: '/admin/orders' },
    { id: 'marketplace', label: 'Marketplace', icon: Store, path: '/admin/marketplace' },
    { id: 'vip-plans', label: 'VIP Plans', icon: Award, path: '/admin/vip-plans' },
    { id: 'video-ads', label: 'Video Ads', icon: Video, path: '/admin/video-ads' },
    { id: 'service-charges', label: 'Service Charges', icon: DollarSign, path: '/admin/service-charges' },
    { id: 'policies', label: 'Policy Editor', icon: FileText, path: '/admin/policies' },
    { id: 'stockists', label: 'Stockist Management', icon: UserCog, path: '/admin/stockists' },
    { id: 'support', label: 'Support Tickets', icon: HeadphonesIcon, path: '/admin/support' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings' },
  ];

  const isActive = (path) => location.pathname === path;

  const handleNavigation = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
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
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
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
          })}
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
              {menuItems.map((item) => {
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
