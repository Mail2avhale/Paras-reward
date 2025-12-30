import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Users, BarChart3, ShoppingCart, Package,
  MessageSquare, HeadphonesIcon, DollarSign, UserCog,
  ChevronLeft, ChevronRight, LogOut, Bell, Menu, X, Briefcase, Zap
} from 'lucide-react';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_appreward-portal/artifacts/8iqee76c_IMG-20251230-WA0006.jpg";

const ManagerLayout = ({ children, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/manager' },
    { id: 'users', label: 'User Management', icon: Users, path: '/manager/users' },
    { id: 'orders', label: 'Orders', icon: ShoppingCart, path: '/manager/orders' },
    { id: 'products', label: 'Products', icon: Package, path: '/manager/products' },
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/manager/reports' },
    { id: 'finance', label: 'Finance', icon: DollarSign, path: '/manager/finance' },
    { id: 'stockists', label: 'Stockists', icon: UserCog, path: '/manager/stockists' },
    { id: 'communication', label: 'Communication', icon: MessageSquare, path: '/manager/communication' },
    { id: 'support', label: 'Support', icon: HeadphonesIcon, path: '/manager/support' },
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
        className={`hidden lg:flex flex-col bg-indigo-900 text-white transition-all duration-300 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-indigo-700">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Logo" className="h-10 w-10 rounded-xl" />
            {!sidebarCollapsed && (
              <div>
                <h1 className="font-bold text-lg">PARAS REWARD</h1>
                <p className="text-xs text-indigo-300">Manager Panel</p>
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
                    ? 'bg-indigo-600 text-white'
                    : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
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
          className="p-4 border-t border-indigo-700 flex items-center justify-center hover:bg-indigo-800"
        >
          {sidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>

        {/* User & Logout */}
        <div className="p-4 border-t border-indigo-700">
          {!sidebarCollapsed && (
            <div className="mb-3">
              <p className="text-sm font-medium truncate">{user?.name || 'Manager'}</p>
              <p className="text-xs text-indigo-300 truncate">{user?.email}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-800 hover:bg-indigo-700 rounded-lg text-sm"
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
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-indigo-900 text-white overflow-y-auto">
            <div className="p-4 border-b border-indigo-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={LOGO_URL} alt="Logo" className="h-10 w-10 rounded-xl" />
                <div>
                  <h1 className="font-bold">PARAS REWARD</h1>
                  <p className="text-xs text-indigo-300">Manager Panel</p>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-indigo-800 rounded-lg">
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
                      active ? 'bg-indigo-600 text-white' : 'text-indigo-200 hover:bg-indigo-800'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm">{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-indigo-700">
              <div className="mb-3">
                <p className="text-sm font-medium">{user?.name || 'Manager'}</p>
                <p className="text-xs text-indigo-300">{user?.email}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-800 rounded-lg text-sm"
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
            <h2 className="text-lg font-semibold text-gray-900">Manager Dashboard</h2>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-gray-100 rounded-lg relative">
              <Bell className="h-5 w-5 text-gray-600" />
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-100 rounded-full">
              <Briefcase className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-medium text-indigo-700">Manager</span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
};

export default ManagerLayout;
