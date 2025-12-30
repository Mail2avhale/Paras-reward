import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  X,
  Home,
  Zap,
  Gamepad2,
  User,
  ShoppingBag,
  Gift,
  Receipt,
  Trophy,
  Users,
  Crown,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  Star,
  Wallet,
  FileText,
  Shield
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Close sidebar on route change
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
  }, [location.pathname]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleNavigation = (route) => {
    navigate(route);
    onClose();
  };

  const handleLogout = () => {
    onClose();
    if (onLogout) onLogout();
  };

  const menuItems = [
    { id: 'home', label: 'Home', icon: Home, route: '/dashboard' },
    { id: 'mining', label: 'Mining', icon: Zap, route: '/mining' },
    { id: 'game', label: 'Tap Game', icon: Gamepad2, route: '/game' },
    { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag, route: '/marketplace' },
    { id: 'orders', label: 'My Orders', icon: Receipt, route: '/orders' },
    { id: 'gift-vouchers', label: 'Gift Vouchers', icon: Gift, route: '/gift-vouchers' },
    { id: 'bill-payments', label: 'Bill Payments', icon: FileText, route: '/bill-payments' },
    { id: 'referrals', label: 'Referrals', icon: Users, route: '/referrals' },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, route: '/leaderboard' },
    { id: 'vip', label: 'VIP Membership', icon: Crown, route: '/vip' },
    { id: 'gamification', label: 'Achievements', icon: Star, route: '/gamification' },
  ];

  const bottomMenuItems = [
    { id: 'profile', label: 'My Profile', icon: User, route: '/profile' },
    { id: 'support', label: 'Support', icon: HelpCircle, route: '/support' },
    { id: 'terms', label: 'Terms & Conditions', icon: FileText, route: '/terms' },
    { id: 'privacy', label: 'Privacy Policy', icon: Shield, route: '/privacy' },
  ];

  const isActive = (route) => location.pathname === route;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar Panel */}
      <div
        className={`fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-white z-[70] shadow-2xl transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header with Logo */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img
                src="https://customer-assets.emergentagent.com/job_appreward-portal/artifacts/8iqee76c_IMG-20251230-WA0006.jpg"
                alt="PARAS REWARD"
                className="h-12 w-12 rounded-xl object-cover shadow-lg"
              />
              <div className="flex flex-col">
                <span className="font-bold text-lg text-white leading-tight">
                  PARAS REWARD
                </span>
                <span className="text-xs text-purple-200 leading-tight">
                  India's No.1 Mining Platform
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>

          {/* User Info */}
          {user && (
            <div className="mt-4 p-3 bg-white/10 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {user.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{user.name || 'User'}</p>
                  <p className="text-xs text-purple-200 truncate">{user.email}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="h-6 w-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">₹</span>
                  </div>
                  <span className="text-white font-bold">
                    {user.prc_balance?.toLocaleString() || '0'} PRC
                  </span>
                </div>
                {user.vip_level && (
                  <span className="px-2 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">
                    VIP {user.vip_level}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto py-4" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <div className="px-3 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.route);

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.route)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                    active
                      ? 'bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon
                      className={`h-5 w-5 ${
                        active ? 'text-purple-600' : 'text-gray-500'
                      }`}
                    />
                    <span className={`font-medium ${active ? 'text-purple-700' : ''}`}>
                      {item.label}
                    </span>
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 ${
                      active ? 'text-purple-400' : 'text-gray-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-gray-200" />

          {/* Bottom Menu Items */}
          <div className="px-3 space-y-1">
            <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Account & Support
            </p>
            {bottomMenuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.route);

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.route)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                    active
                      ? 'bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon
                      className={`h-5 w-5 ${
                        active ? 'text-purple-600' : 'text-gray-500'
                      }`}
                    />
                    <span className={`font-medium ${active ? 'text-purple-700' : ''}`}>
                      {item.label}
                    </span>
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 ${
                      active ? 'text-purple-400' : 'text-gray-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Logout Button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
