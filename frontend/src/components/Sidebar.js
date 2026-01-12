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
  HelpCircle,
  LogOut,
  ChevronRight,
  Star,
  FileText,
  Shield
} from 'lucide-react';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_appreward-portal/artifacts/8iqee76c_IMG-20251230-WA0006.jpg";

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
    // Removed: Leaderboard for AdMob compliance
    // Removed: Achievements for AdMob compliance
    { id: 'vip', label: 'VIP Membership', icon: Crown, route: '/vip' },
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
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar Panel - Gradient Background matching app style */}
      <div
        className={`fixed top-0 left-0 h-full w-80 max-w-[85vw] z-[70] shadow-2xl transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 50%, #3b82f6 100%)'
        }}
      >
        {/* Header with Logo */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img
                src={LOGO_URL}
                alt="PARAS REWARD"
                className="h-12 w-12 rounded-xl object-cover shadow-lg ring-2 ring-white/20"
              />
              <div className="flex flex-col">
                <span className="font-bold text-lg text-white leading-tight tracking-wide">
                  PARAS REWARD
                </span>
                <span className="text-xs text-white/70 leading-tight">
                  India's No.1 Mining Platform
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto py-4" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          <div className="px-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.route);

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.route)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-200 ${
                    active
                      ? 'bg-white/20 backdrop-blur-sm shadow-lg'
                      : 'hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${active ? 'bg-white/20' : 'bg-white/10'}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <span className={`font-medium text-white ${active ? 'font-semibold' : ''}`}>
                      {item.label}
                    </span>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-white/50 ${active ? 'text-white/80' : ''}`} />
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="my-4 mx-4 border-t border-white/10" />

          {/* Bottom Menu Items */}
          <div className="px-4 space-y-1">
            <p className="px-4 text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
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
                      ? 'bg-white/20 backdrop-blur-sm'
                      : 'hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${active ? 'bg-white/20' : 'bg-white/10'}`}>
                      <Icon className="h-4 w-4 text-white/80" />
                    </div>
                    <span className={`font-medium text-white/90 text-sm ${active ? 'text-white font-semibold' : ''}`}>
                      {item.label}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/40" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Logout Button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/20 to-transparent">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl transition-all duration-200 border border-white/10"
          >
            <LogOut className="h-5 w-5 text-white" />
            <span className="font-semibold text-white">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
