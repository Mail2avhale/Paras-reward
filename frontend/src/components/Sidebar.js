import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  X, Home, Crown, Users, Rss,
  ShoppingBag, Heart, FileText, History,
  Banknote, Receipt, ShieldCheck, BarChart3,
  MessageSquare, Mail, Bell, UserPlus,
  User, HelpCircle, Lock, LogOut,
  Facebook, Twitter, Instagram, Linkedin, Youtube, Send, MessageCircle,
} from 'lucide-react';
import axios from 'axios';
import { useLanguage } from '@/contexts/LanguageContext';
import { API } from '@/lib/api';

const LOGO_URL = '/paras-logo.png';

/* ─────────────────────────────────────────────────────────────
   Menu schema — 5 sections × 4 tiles per row (Pi-style grid).
   Each item carries: id, label, icon, route. The route MUST
   match an entry in /app/frontend/src/App.js or be a public path.
   ──────────────────────────────────────────────────────────── */
const MENU_SECTIONS = [
  {
    title: 'Earn',
    items: [
      { id: 'dashboard',   label: 'Dashboard',     icon: Home,   route: '/dashboard' },
      { id: 'subscription',label: 'Subscription',  icon: Crown,  route: '/subscription' },
      { id: 'referrals',   label: 'Referrals',     icon: Users,  route: '/referrals' },
      { id: 'network-feed',label: 'Network Feed',  icon: Rss,    route: '/network-feed' },
    ],
  },
  {
    title: 'Rewards',
    items: [
      { id: 'mall',         label: 'Paras Mall',    icon: ShoppingBag, route: '/mall' },
      { id: 'mall-wishlist',label: 'Wishlist',      icon: Heart,       route: '/mall/wishlist' },
      { id: 'prc-statement',label: 'PRC Statement', icon: FileText,    route: '/prc-statement' },
      { id: 'usage-history',label: 'Usage History', icon: History,     route: '/usage-history' },
    ],
  },
  {
    title: 'Wallet',
    items: [
      { id: 'bank-redeem',  label: 'Bank Redeem',   icon: Banknote,    route: '/bank-redeem' },
      { id: 'my-invoices',  label: 'My Invoices',   icon: Receipt,     route: '/my-invoices' },
      { id: 'kyc',          label: 'KYC',           icon: ShieldCheck, route: '/kyc' },
      { id: 'my-reports',   label: 'My Reports',    icon: BarChart3,   route: '/my-reports' },
    ],
  },
  {
    title: 'Social',
    items: [
      { id: 'community',    label: 'Community',     icon: MessageSquare, route: '/community' },
      { id: 'messages',     label: 'Messages',      icon: Mail,          route: '/messages' },
      { id: 'notifications',label: 'Notifications', icon: Bell,          route: '/notifications' },
      { id: 'followers',    label: 'Followers',     icon: UserPlus,      route: '/followers' },
    ],
  },
  {
    title: 'Account',
    items: [
      { id: 'profile',      label: 'My Profile',    icon: User,        route: '/profile' },
      { id: 'support',      label: 'Support',       icon: HelpCircle,  route: '/support' },
      { id: 'terms',        label: 'Terms',         icon: FileText,    route: '/terms' },
      { id: 'privacy',      label: 'Privacy',       icon: Lock,        route: '/privacy' },
    ],
  },
];

const SOCIAL_PLATFORMS = [
  { key: 'facebook',  Icon: Facebook,       hover: 'hover:text-blue-600' },
  { key: 'twitter',   Icon: Twitter,        hover: 'hover:text-sky-500' },
  { key: 'instagram', Icon: Instagram,      hover: 'hover:text-pink-500' },
  { key: 'youtube',   Icon: Youtube,        hover: 'hover:text-red-600' },
  { key: 'linkedin',  Icon: Linkedin,       hover: 'hover:text-blue-700' },
  { key: 'telegram',  Icon: Send,           hover: 'hover:text-sky-500' },
  { key: 'whatsapp',  Icon: MessageCircle,  hover: 'hover:text-green-600' },
];

const Sidebar = ({ isOpen, onClose, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [socialMedia, setSocialMedia] = useState({});

  // Resolve a route that may need a dynamic UID suffix (e.g. /followers/:uid)
  const resolveRoute = (route) => {
    if (route === '/followers') return user?.uid ? `/followers/${user.uid}` : '/profile';
    return route;
  };

  // Close sidebar when route changes (only on actual path change, NOT when isOpen flips).
  const prevPathRef = React.useRef(location.pathname);
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      if (isOpen) onClose();
    }
  }, [location.pathname, isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // Fetch social media links once (only when drawer opens for the first time)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/admin/social-media-settings`);
        if (!cancelled) setSocialMedia(res.data || {});
      } catch (_err) { /* silent — footer just hides icons */ }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const handleNavigation = (route) => {
    navigate(resolveRoute(route));
    onClose();
  };

  const handleLogout = () => {
    onClose();
    if (onLogout) onLogout();
  };

  const isActive = (route) => {
    const r = resolveRoute(route);
    return location.pathname === r || location.pathname.startsWith(r + '/');
  };

  // Greeting label
  const displayName = (user?.name || user?.full_name || user?.username || 'Member').toString();
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="sidebar-backdrop"
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        data-testid="user-sidebar"
        className={`fixed top-0 left-0 h-full w-[88vw] max-w-[360px] z-[70] bg-[#fafafa] shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-200 bg-white flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={LOGO_URL}
                alt="PARAS REWARD"
                className="h-11 w-11 rounded-xl object-contain bg-slate-900 p-1 shadow-sm"
              />
              <div className="min-w-0">
                <p className="text-[11px] text-slate-500 leading-tight">{greeting},</p>
                <p className="text-base font-bold text-slate-900 leading-tight truncate" data-testid="sidebar-user-name">
                  {displayName}
                </p>
                <p className="text-[10px] text-slate-400 leading-tight truncate">UID: {user?.uid || '—'}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              data-testid="sidebar-close-btn"
              className="p-1.5 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0"
              aria-label="Close menu"
            >
              <X className="h-5 w-5 text-slate-600" />
            </button>
          </div>

          {/* PRC Balance pill */}
          <button
            onClick={() => handleNavigation('/dashboard')}
            data-testid="sidebar-balance-pill"
            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 border border-amber-200 px-4 py-2.5 flex items-center justify-between hover:shadow-md transition-shadow"
          >
            <div className="text-left">
              <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">PRC Balance</p>
              <p className="text-base font-bold text-slate-900 tabular-nums">
                {Number(user?.prc_balance ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500">≈ ₹</p>
              <p className="text-sm font-bold text-emerald-700 tabular-nums">
                {(Number(user?.prc_balance ?? 0) / 10).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            </div>
          </button>
        </div>

        {/* Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 pb-6">
          {MENU_SECTIONS.map((section) => (
            <section key={section.title} className="mb-4" data-testid={`sidebar-section-${section.title.toLowerCase()}`}>
              <h3 className="px-2 mb-1.5 text-[10px] uppercase tracking-[0.15em] font-bold text-slate-500">
                {section.title}
              </h3>
              <div className="grid grid-cols-4 gap-0.5">
                {section.items.map(({ id, label, icon: Icon, route }) => {
                  const active = isActive(route);
                  return (
                    <button
                      key={id}
                      onClick={() => handleNavigation(route)}
                      data-testid={`sidebar-tile-${id}`}
                      className="group relative flex flex-col items-center justify-start gap-1 py-2.5 px-1 rounded-xl hover:bg-white hover:shadow-sm transition-all"
                    >
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
                          active
                            ? 'bg-blue-50 ring-1 ring-blue-200'
                            : 'bg-slate-100 group-hover:bg-slate-50'
                        }`}
                      >
                        <Icon
                          className={`h-[18px] w-[18px] stroke-[1.5] ${active ? 'text-blue-600' : 'text-slate-700'}`}
                        />
                      </div>
                      <span
                        className={`text-[9.5px] leading-[1.15] text-center break-words ${
                          active ? 'text-blue-700 font-semibold' : 'text-slate-700 font-medium'
                        }`}
                      >
                        {label}
                      </span>
                      {/* Active dot indicator */}
                      <span
                        className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full ${
                          active ? 'bg-blue-600' : 'bg-transparent'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Logout */}
          <button
            onClick={handleLogout}
            data-testid="sidebar-logout-btn"
            className="w-full mt-1 mb-3 px-4 py-2.5 rounded-xl bg-white border border-rose-200 text-rose-600 font-semibold flex items-center justify-center gap-2 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm">{t('logout') || 'Logout'}</span>
          </button>
        </div>

        {/* Social footer */}
        <div className="border-t border-slate-200 bg-white px-5 py-4 flex-shrink-0">
          <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-slate-500 text-center mb-3">
            Follow us on
          </p>
          <div className="flex items-center justify-center gap-4">
            {SOCIAL_PLATFORMS.map(({ key, Icon, hover }) => {
              const url = socialMedia?.[key];
              if (!url) return null;
              return (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`sidebar-social-${key}`}
                  className={`text-slate-400 ${hover} transition-colors`}
                  aria-label={`Follow on ${key}`}
                >
                  <Icon className="h-5 w-5" />
                </a>
              );
            })}
            {/* Fallback: if admin hasn't configured any social URLs, show a hint */}
            {SOCIAL_PLATFORMS.every(({ key }) => !socialMedia?.[key]) && (
              <p className="text-[10px] text-slate-400 italic">Social links coming soon</p>
            )}
          </div>
          <p className="text-[10px] text-center text-slate-400 mt-3">
            © {new Date().getFullYear()} PARAS REWARD · v3.3.1
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
