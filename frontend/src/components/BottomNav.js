import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Zap, Gamepad2, Store, UserPlus, User } from 'lucide-react';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active tab based on current route
  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'home';
    if (path === '/mining') return 'mine';
    if (path === '/game') return 'game';
    if (path === '/marketplace') return 'shop';
    if (path === '/referrals') return 'refer';
    if (path === '/profile' || path === '/profile-advanced') return 'profile';
    return 'home';
  };

  const activeTab = getActiveTab();

  const BottomNavItem = ({ icon: Icon, label, tabName, isActive, isCenterButton = false }) => (
    <button
      onClick={() => {
        if (tabName === 'home') {
          navigate('/dashboard');
        } else if (tabName === 'mine') {
          navigate('/mining');
        } else if (tabName === 'game') {
          navigate('/game');
        } else if (tabName === 'shop') {
          navigate('/marketplace');
        } else if (tabName === 'refer') {
          navigate('/referrals');
        } else if (tabName === 'profile') {
          navigate('/profile');
        }
      }}
      className={`flex flex-col items-center justify-center flex-1 py-3 transition-colors ${
        isCenterButton 
          ? 'relative -mt-6' 
          : ''
      } ${
        isActive 
          ? 'text-purple-600' 
          : 'text-gray-500 hover:text-purple-500'
      }`}
    >
      {isCenterButton ? (
        <div className="bg-gradient-to-br from-purple-600 to-blue-500 p-4 rounded-full shadow-2xl">
          <Icon className={`w-8 h-8 text-white ${isActive ? 'animate-bounce' : ''}`} />
        </div>
      ) : (
        <>
          <Icon className={`w-6 h-6 mb-1 ${isActive ? 'animate-bounce' : ''}`} />
          <span className="text-xs font-medium">{label}</span>
        </>
      )}
    </button>
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-md mx-auto flex items-center justify-around h-16">
        <BottomNavItem 
          icon={Home} 
          label="Home" 
          tabName="home" 
          isActive={activeTab === 'home'} 
        />
        <BottomNavItem 
          icon={Zap} 
          label="Mine" 
          tabName="mine" 
          isActive={activeTab === 'mine'} 
        />
        <BottomNavItem 
          icon={Gamepad2} 
          label="Play" 
          tabName="game" 
          isActive={activeTab === 'game'} 
          isCenterButton 
        />
        <BottomNavItem 
          icon={Store} 
          label="Shop" 
          tabName="shop" 
          isActive={activeTab === 'shop'} 
        />
        <BottomNavItem 
          icon={UserPlus} 
          label="Refer" 
          tabName="refer" 
          isActive={activeTab === 'refer'} 
        />
        <BottomNavItem 
          icon={User} 
          label="Profile" 
          tabName="profile" 
          isActive={activeTab === 'profile'} 
        />
      </div>
    </div>
  );
};

export default BottomNav;
