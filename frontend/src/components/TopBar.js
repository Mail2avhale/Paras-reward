import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Bell, Menu, ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Sidebar from '@/components/Sidebar';
import NotificationCenter from '@/components/NotificationCenter';
import { LanguageSelectorCompact } from '@/components/LanguageSelector';
import axios from 'axios';

import { API } from "../lib/api";
const LOGO_URL = "/paras-logo.png";

// Routes that live in the BottomNav — no back button needed on these
// (they ARE the root destinations). Everything else gets a chevron.
const TAB_ROOT_PATHS = new Set([
  '/dashboard',
  '/referrals',
  '/mall',
  '/community',
  '/profile',
  '/profile-advanced',
]);

const TopBar = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Fetch unread notification count
  const fetchUnreadCount = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const response = await axios.get(`${API}/notifications/${user.uid}/unread-count`);
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [user?.uid]);
  
  // Fetch unread count on mount and periodically
  useEffect(() => {
    if (user?.uid) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 60000); // Poll every 60 seconds
      return () => clearInterval(interval);
    }
  }, [user?.uid, fetchUnreadCount]);

  // Auto-hide on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY < 10) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 80) {
        // Scrolling down & past threshold
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling up
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Implement search functionality
      // console.log('Searching for:', searchQuery);
      // navigate(`/search?q=${searchQuery}`);
    }
  };

  // Feb 25 2026 — Back button. Hidden on the 5 BottomNav root tabs
  // (they ARE the destinations, so back-out doesn't make sense). Uses
  // history.back() when there's a prior entry, else falls back to
  // /dashboard so a fresh deep-link never dead-ends the user.
  const showBackBtn = !TAB_ROOT_PATHS.has(location.pathname);
  const handleBack = () => {
    // window.history.length starts at 1 on a fresh tab. If it's > 1
    // there IS a prior entry, so navigate(-1) is safe.
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <>
      <div
        className={`fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm transition-transform duration-300 ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Back button — Feb 25 2026. Hidden on the 5 tab-root pages
              (dashboard / referrals / mall / community / profile) since
              those are BottomNav destinations. Renders on every other
              user page for easy one-tap navigation. */}
          {showBackBtn && (
            <button
              onClick={handleBack}
              data-testid="topbar-back-btn"
              aria-label="Go back"
              className="mr-1 -ml-1 p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors flex-shrink-0"
            >
              <ChevronLeft className="h-5 w-5 text-gray-700" />
            </button>
          )}

          {/* Logo */}
          <div 
            className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate('/dashboard')}
          >
            <img
              src={LOGO_URL}
              alt="PARAS REWARD"
              className="h-10 w-auto rounded-xl object-contain bg-black p-1 shadow-lg"
            />
            <div className="hidden sm:flex flex-col">
              <span className="font-bold text-lg text-gray-900 leading-tight">
                PARAS REWARD
              </span>
              <span className="text-xs text-purple-600 leading-tight">
                India&apos;s No.1 Rewards Platform
              </span>
            </div>
          </div>

          {/* Search Bar - Desktop */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <form onSubmit={handleSearch} className="w-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products, bills, vouchers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                />
              </div>
            </form>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Language Selector */}
            <LanguageSelectorCompact />

            {/* Search Icon - Mobile */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Search className="h-5 w-5 text-gray-700" />
            </button>

            {/* Notifications */}
            <button
              id="notification-bell-btn"
              data-testid="notification-bell-topbar"
              onClick={(e) => {
                e.stopPropagation();
                setNotificationsOpen(!notificationsOpen);
              }}
              className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Bell className="h-5 w-5 text-gray-700" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center bg-red-500 text-white text-xs p-0 rounded-full">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </button>

            {/* Menu Icon - Opens Sidebar */}
            <button
              onClick={() => setSidebarOpen(true)}
              data-testid="topbar-menu-btn"
              aria-label="Open menu"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="h-6 w-6 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Mobile Search Overlay */}
        {showSearch && (
          <div className="md:hidden px-4 pb-3 bg-white border-t border-gray-100">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Sidebar Component */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        onLogout={onLogout}
      />

      {/* Notification Center */}
      <NotificationCenter
        user={user}
        isOpen={notificationsOpen}
        onClose={() => {
          setNotificationsOpen(false);
          fetchUnreadCount(); // Refresh count when closing
        }}
      />
    </>
  );
};

export default TopBar;
