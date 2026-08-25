import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Gift, User, MessageCircle, ShoppingBag } from 'lucide-react';
// import { useLanguage } from '@/contexts/LanguageContext';

/**
 * BottomNav (Feb 27 2026 design refresh).
 *
 * Unified premium dark theme:
 *  • Translucent obsidian background with a subtle top hairline in muted gold.
 *  • Active tab: solid gold pill (icon + label), soft gold glow.
 *  • Inactive tabs: soft silver-grey icon + label — no more competing colours.
 *  • Home icon promoted to the sophisticated "filled" look (via strokeWidth 2.6).
 *  • Bottom safe-area padding so gesture bars / notches don't crop the labels.
 */
const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'home';
    if (path === '/referrals') return 'referrals';
    if (path === '/mall') return 'mall';
    if (path === '/community') return 'community';
    if (path === '/profile' || path === '/profile-advanced') return 'profile';
    return 'home';
  };

  const activeTab = getActiveTab();

  const navItems = [
    { id: 'home',      label: 'Home',         icon: Home,          route: '/dashboard' },
    { id: 'referrals', label: 'Refer & Earn', icon: Gift,          route: '/referrals' },
    { id: 'mall',      label: 'Mall',         icon: ShoppingBag,   route: '/mall'      },
    { id: 'community', label: 'Community',    icon: MessageCircle, route: '/community' },
    { id: 'profile',   label: 'Profile',      icon: User,          route: '/profile'   },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40" data-testid="bottom-nav">
      <div
        className="backdrop-blur-xl border-t"
        style={{
          backgroundColor: 'rgba(15, 17, 21, 0.92)',
          borderTopColor: 'var(--paras-slate-line)',
        }}
      >
        <div className="max-w-md mx-auto">
          <div
            className="flex items-center justify-around px-1"
            style={{
              height: 'calc(68px + env(safe-area-inset-bottom, 0px))',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  data-testid={`nav-${item.id}`}
                  onClick={() => navigate(item.route)}
                  className="flex flex-col items-center justify-center flex-1 py-1.5 relative outline-none"
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {/* Active gold hairline at top */}
                  {isActive && (
                    <span
                      className="absolute -top-px w-8 h-[3px] rounded-full"
                      style={{
                        background:
                          'linear-gradient(90deg, #FFD54F 0%, #FFC107 50%, #C9971A 100%)',
                        boxShadow: '0 0 12px rgba(255, 193, 7, 0.55)',
                      }}
                    />
                  )}

                  {/* Icon pill */}
                  <div
                    className="relative flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-300"
                    style={{
                      backgroundColor: isActive ? 'rgba(255, 193, 7, 0.14)' : 'transparent',
                      boxShadow: isActive
                        ? '0 0 18px -4px rgba(255, 193, 7, 0.55), inset 0 0 0 1px rgba(255, 193, 7, 0.35)'
                        : 'none',
                    }}
                  >
                    <Icon
                      className="transition-colors duration-300"
                      style={{
                        color: isActive ? 'var(--paras-gold)' : 'var(--paras-text-mute)',
                        width: 22,
                        height: 22,
                      }}
                      strokeWidth={isActive ? 2.6 : 1.9}
                      // Home always uses the sophisticated filled look
                      fill={item.id === 'home' && isActive ? 'currentColor' : 'none'}
                    />
                  </div>

                  {/* Label */}
                  <span
                    className="text-[10px] mt-0.5 tracking-wide transition-colors duration-300"
                    style={{
                      color: isActive ? 'var(--paras-gold)' : 'var(--paras-text-mute)',
                      fontWeight: isActive ? 700 : 500,
                    }}
                  >
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
