import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Zap, Gamepad2, User } from 'lucide-react';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

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
    { id: 'home', label: 'Home', icon: Home, route: '/dashboard' },
    { id: 'rewards', label: 'Rewards', icon: Zap, route: '/daily-rewards' },
    { id: 'game', label: 'Play', icon: Gamepad2, route: '/game' },
    { id: 'profile', label: 'Profile', icon: User, route: '/profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-2xl">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.route)}
                className={`flex flex-col items-center justify-center flex-1 py-2 px-3 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? 'bg-gradient-to-br from-purple-100 to-blue-100' 
                    : 'hover:bg-gray-100'
                }`}
              >
                <div className={`relative transition-all duration-300 ${
                  isActive ? 'transform scale-110' : ''
                }`}>
                  <Icon 
                    className={`h-6 w-6 transition-colors duration-300 ${
                      isActive 
                        ? 'text-purple-600' 
                        : 'text-gray-500'
                    }`}
                  />
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-purple-600 rounded-full animate-pulse" />
                  )}
                </div>
                <span className={`text-xs font-medium mt-1 transition-colors duration-300 ${
                  isActive 
                    ? 'text-purple-900 font-semibold' 
                    : 'text-gray-600'
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
