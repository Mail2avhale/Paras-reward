import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Users, User, Crown, MessageCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'home';
    if (path === '/referrals') return 'referrals';
    if (path === '/community') return 'community';
    if (path === '/subscription') return 'subscription';
    if (path === '/profile' || path === '/profile-advanced') return 'profile';
    return 'home';
  };

  const activeTab = getActiveTab();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home, route: '/dashboard', activeColor: 'from-amber-400 to-amber-600', textColor: 'text-amber-400', glowColor: 'shadow-amber-500/30' },
    { id: 'referrals', label: 'Invite', icon: Users, route: '/referrals', activeColor: 'from-cyan-400 to-blue-500', textColor: 'text-cyan-400', glowColor: 'shadow-cyan-500/30' },
    { id: 'community', label: 'Community', icon: MessageCircle, route: '/community', activeColor: 'from-rose-400 to-pink-500', textColor: 'text-rose-400', glowColor: 'shadow-rose-500/30' },
    { id: 'subscription', label: 'Plan', icon: Crown, route: '/subscription', activeColor: 'from-purple-400 to-violet-600', textColor: 'text-purple-400', glowColor: 'shadow-purple-500/30' },
    { id: 'profile', label: 'Profile', icon: User, route: '/profile', activeColor: 'from-emerald-400 to-green-500', textColor: 'text-emerald-400', glowColor: 'shadow-emerald-500/30' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div className="bg-gray-950/98 backdrop-blur-xl border-t border-gray-800/80">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-around h-[68px] px-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  data-testid={`nav-${item.id}`}
                  onClick={() => navigate(item.route)}
                  className="flex flex-col items-center justify-center flex-1 py-1.5 relative"
                >
                  {/* Active indicator line */}
                  {isActive && (
                    <div className={`absolute -top-[1px] w-8 h-[3px] rounded-full bg-gradient-to-r ${item.activeColor}`} />
                  )}

                  {/* Icon container */}
                  <div className={`relative flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-300 ${
                    isActive
                      ? `bg-gradient-to-br ${item.activeColor} shadow-lg ${item.glowColor}`
                      : 'bg-transparent'
                  }`}>
                    <Icon
                      className={`transition-all duration-300 ${
                        isActive
                          ? 'h-5 w-5 text-white'
                          : 'h-[22px] w-[22px] text-gray-500'
                      }`}
                      strokeWidth={isActive ? 2.5 : 1.8}
                    />
                  </div>

                  {/* Label */}
                  <span className={`text-[10px] mt-0.5 font-medium transition-all duration-300 ${
                    isActive ? `${item.textColor} font-bold` : 'text-gray-600'
                  }`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BottomNav;
