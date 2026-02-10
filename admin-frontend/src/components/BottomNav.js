import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Zap, Gamepad2, User } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  // Determine active tab based on current route
  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'home';
    if (path === '/mining' || path === '/daily-rewards') return 'rewards';
    if (path === '/game') return 'game';
    if (path === '/profile' || path === '/profile-advanced') return 'profile';
    return 'home';
  };

  const activeTab = getActiveTab();

  const navItems = [
    { id: 'home', label: t('home'), icon: Home, route: '/dashboard' },
    { id: 'rewards', label: t('rewards'), icon: Zap, route: '/daily-rewards' },
    { id: 'game', label: t('tapGame'), icon: Gamepad2, route: '/game' },
    { id: 'profile', label: t('profile'), icon: User, route: '/profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-950/95 backdrop-blur-md border-t border-gray-800 shadow-2xl">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                data-testid={`nav-${item.id}`}
                onClick={() => navigate(item.route)}
                className={`flex flex-col items-center justify-center flex-1 py-2 px-3 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/10' 
                    : 'hover:bg-gray-800/50'
                }`}
              >
                <div className={`relative transition-all duration-300 ${
                  isActive ? 'transform scale-110' : ''
                }`}>
                  <Icon 
                    className={`h-6 w-6 transition-colors duration-300 ${
                      isActive 
                        ? 'text-amber-500' 
                        : 'text-gray-500'
                    }`}
                  />
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
                  )}
                </div>
                <span className={`text-xs font-medium mt-1 transition-colors duration-300 ${
                  isActive 
                    ? 'text-amber-400 font-semibold' 
                    : 'text-gray-500'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomNav;
