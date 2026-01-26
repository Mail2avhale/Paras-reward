import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { 
  TrendingUp, Star, Gift, ArrowUpRight, Clock,
  Home, UserPlus, Gamepad2, User, Zap, Crown, Eye, EyeOff,
  ChevronRight, Sparkles, ShoppingBag, CreditCard
} from 'lucide-react';
import PRCExpiryTimer from '@/components/PRCExpiryTimer';
import ProfileCompletionPopup from '@/components/ProfileCompletionPopup';
import InteractiveWalkthrough, { useWalkthrough } from '@/components/InteractiveWalkthrough';
import AIChatbotEnhanced from '@/components/AIChatbotEnhanced';
import PRCRain from '@/components/PRCRain';
import NotificationBell from '@/components/NotificationBell';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardSkeleton } from '@/components/skeletons';

const API = process.env.REACT_APP_BACKEND_URL || '';

// Bottom Navigation Item
const BottomNavItem = ({ icon: Icon, label, isActive, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center py-2 px-3 transition-all ${
      isActive ? 'text-amber-500' : 'text-gray-400'
    }`}
  >
    <Icon className={`w-5 h-5 mb-1 ${isActive ? 'text-amber-500' : ''}`} />
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

const DashboardModern = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  
  // Interactive Walkthrough for new users
  const { showWalkthrough, hideWalkthrough } = useWalkthrough();
  
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [showBalance, setShowBalance] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState([]);
  // globalActivity and activityTab moved to separate Activity page
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [miningHistory, setMiningHistory] = useState([]);
  const [birthdayGreeting, setBirthdayGreeting] = useState(null);

  // Stats
  const [stats, setStats] = useState({
    prcBalance: 0,
    totalMined: 0,
    totalRedeemed: 0,
    referralCount: 0,
    subscriptionPlan: 'explorer',
    subscriptionExpiry: null,
    subscriptionStart: null
  });

  // Helper function to get plan display name
  const getPlanDisplayName = (plan) => {
    const planNames = {
      'explorer': 'Explorer',
      'startup': 'Startup',
      'growth': 'Growth',
      'elite': 'Elite'
    };
    return planNames[plan] || 'Explorer';
  };

  // Check if user has a paid plan
  const hasPaidPlan = ['startup', 'growth', 'elite'].includes(stats.subscriptionPlan);

  // Fetch dashboard data - optimized with parallel requests
  useEffect(() => {
    if (user?.uid) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Parallel API calls for faster loading
      const [userResult, activityResult] = await Promise.allSettled([
        axios.get(`${API}/api/user/${user.uid}`),
        axios.get(`${API}/api/user/${user.uid}/recent-activity?limit=10`)
      ]);
      
      // Process user data
      if (userResult.status === 'fulfilled') {
        const fetchedUserData = userResult.value.data;
        setUserData(fetchedUserData);
        setMiningHistory(fetchedUserData.mining_history || []);
        setStats({
          prcBalance: fetchedUserData.prc_balance || 0,
          totalMined: fetchedUserData.total_mined || 0,
          totalRedeemed: fetchedUserData.total_redeemed || 0,
          referralCount: fetchedUserData.referral_count || 0,
          subscriptionPlan: fetchedUserData.subscription_plan || 'explorer',
          subscriptionExpiry: fetchedUserData.subscription_expiry || null,
          subscriptionStart: fetchedUserData.subscription_start || fetchedUserData.vip_activation_date || null
        });
      } else {
        // Fallback to user prop data
        setUserData(user);
        setStats({
          prcBalance: user.prc_balance || 0,
          totalMined: user.total_mined || 0,
          totalRedeemed: user.total_redeemed || 0,
          referralCount: user.referral_count || 0,
          subscriptionPlan: user.subscription_plan || 'explorer',
          subscriptionExpiry: user.subscription_expiry || null,
          subscriptionStart: user.subscription_start || user.vip_activation_date || null
        });
      }
      
      // Process activity data (for recent transactions only, full activity moved to /activity page)
      if (activityResult.status === 'fulfilled') {
        const activities = activityResult.value.data.activities || [];
        const formattedActivities = activities.map(activity => ({
          type: activity.type,
          description: activity.description,
          amount: activity.amount || 0,
          timestamp: activity.timestamp || new Date().toISOString(),
          icon: activity.icon
        }));
        setRecentTransactions(formattedActivities);
      }

      // Check profile completion
      const currentUser = userResult.status === 'fulfilled' ? userResult.value.data : user;
      const profileComplete = currentUser?.name && currentUser?.phone && currentUser?.city;
      if (!profileComplete && !localStorage.getItem('profile_popup_dismissed')) {
        setShowProfilePopup(true);
      }

      // Check for birthday (non-blocking)
      try {
        const birthdayResponse = await axios.get(`${API}/api/user/${user.uid}/birthday-check`);
        if (birthdayResponse.data.is_birthday) {
          setBirthdayGreeting(birthdayResponse.data);
        }
      } catch (bdError) {
        console.log('Birthday check failed');
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleNavigation = (tabName) => {
    setActiveTab(tabName);
    const routes = {
      'home': '/dashboard',
      'rewards': '/daily-rewards',
      'game': '/game',
      'profile': '/profile'
    };
    if (routes[tabName]) {
      navigate(routes[tabName]);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
      
      {/* PRC Rain Drop Game */}
      <PRCRain user={user} onComplete={() => fetchDashboardData()} />
      
      {/* Interactive Walkthrough for new users */}
      {showWalkthrough && (
        <InteractiveWalkthrough 
          user={user}
          onComplete={hideWalkthrough}
          onSkip={hideWalkthrough}
        />
      )}

      {/* Profile Completion Popup */}
      {showProfilePopup && (
        <ProfileCompletionPopup 
          user={userData}
          onClose={() => {
            setShowProfilePopup(false);
            localStorage.setItem('profile_popup_dismissed', 'true');
          }}
          onComplete={() => navigate('/profile')}
        />
      )}

      {/* Header - with safe area padding for mobile browsers */}
      <div className="px-5 pb-4 pt-20" style={{ paddingTop: 'max(5rem, calc(env(safe-area-inset-top, 0px) + 4rem))' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">{t('welcomeBack')}</p>
            <h1 className="text-white text-xl font-bold">
              {userData?.name || user?.email?.split('@')[0] || 'User'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {hasPaidPlan && (
              <div className={`px-3 py-1 rounded-full ${
                stats.subscriptionPlan === 'elite' ? 'bg-gradient-to-r from-amber-500 to-yellow-500' :
                stats.subscriptionPlan === 'growth' ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
                'bg-gradient-to-r from-blue-500 to-cyan-500'
              }`}>
                <span className="text-xs font-bold text-black flex items-center gap-1">
                  <Crown className="w-3 h-3" /> {getPlanDisplayName(stats.subscriptionPlan)}
                </span>
              </div>
            )}
            <NotificationBell user={user} />
            <button 
              onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center"
            >
              <User className="w-5 h-5 text-black" />
            </button>
          </div>
        </div>
      </div>

      {/* Premium 3D Credit Card - Plan-Based Design */}
      <div className="px-5 mb-6" style={{ perspective: '1500px' }}>
        <motion.div 
          initial={{ opacity: 0, rotateX: 20 }}
          animate={{ opacity: 1, rotateX: 0 }}
          whileHover={{ rotateY: 3, rotateX: -2, scale: 1.01 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: stats.subscriptionPlan === 'elite' 
              ? 'linear-gradient(145deg, #1a1505 0%, #2d2008 30%, #1f1604 70%, #0d0a02 100%)'
              : stats.subscriptionPlan === 'growth'
              ? 'linear-gradient(145deg, #051a10 0%, #082d15 30%, #041f0c 70%, #020d05 100%)'
              : stats.subscriptionPlan === 'startup'
              ? 'linear-gradient(145deg, #050d1a 0%, #081a2d 30%, #04101f 70%, #02080d 100%)'
              : 'linear-gradient(145deg, #1c1c1c 0%, #0d0d0d 30%, #1a1a1a 70%, #0a0a0a 100%)',
            boxShadow: stats.subscriptionPlan === 'elite'
              ? '0 25px 50px -12px rgba(212, 175, 55, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
              : stats.subscriptionPlan === 'growth'
              ? '0 25px 50px -12px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
              : stats.subscriptionPlan === 'startup'
              ? '0 25px 50px -12px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            transformStyle: 'preserve-3d',
            aspectRatio: '1.586',
            border: stats.subscriptionPlan === 'elite'
              ? '1.5px solid rgba(212, 175, 55, 0.4)'
              : stats.subscriptionPlan === 'growth'
              ? '1.5px solid rgba(16, 185, 129, 0.4)'
              : stats.subscriptionPlan === 'startup'
              ? '1.5px solid rgba(59, 130, 246, 0.4)'
              : '1.5px solid rgba(100, 100, 100, 0.3)'
          }}
        >
          {/* Animated border glow - Plan specific */}
          <div 
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              background: 'transparent',
              boxShadow: stats.subscriptionPlan === 'elite'
                ? '0 0 20px rgba(212, 175, 55, 0.2), inset 0 0 20px rgba(212, 175, 55, 0.08)'
                : stats.subscriptionPlan === 'growth'
                ? '0 0 20px rgba(16, 185, 129, 0.2), inset 0 0 20px rgba(16, 185, 129, 0.08)'
                : stats.subscriptionPlan === 'startup'
                ? '0 0 20px rgba(59, 130, 246, 0.2), inset 0 0 20px rgba(59, 130, 246, 0.08)'
                : '0 0 10px rgba(100, 100, 100, 0.1)',
              animation: 'borderPulse 3s ease-in-out infinite'
            }}
          />

          {/* Artistic Background - Plan specific designs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <svg 
              className="absolute inset-0 w-full h-full" 
              viewBox="0 0 400 252" 
              preserveAspectRatio="xMidYMid slice"
              style={{ opacity: 0.35 }}
            >
              <defs>
                {/* Elite - Gold Gradient */}
                <linearGradient id="eliteGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffd700" />
                  <stop offset="50%" stopColor="#d4af37" />
                  <stop offset="100%" stopColor="#b8860b" />
                </linearGradient>
                {/* Growth - Emerald Gradient */}
                <linearGradient id="growthGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="50%" stopColor="#059669" />
                  <stop offset="100%" stopColor="#047857" />
                </linearGradient>
                {/* Startup - Blue Gradient */}
                <linearGradient id="startupGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="50%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
                {/* Explorer - Gray Gradient */}
                <linearGradient id="explorerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#9ca3af" />
                  <stop offset="50%" stopColor="#6b7280" />
                  <stop offset="100%" stopColor="#4b5563" />
                </linearGradient>
              </defs>
              
              <g fill="none" stroke={`url(#${stats.subscriptionPlan}Gradient)`} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                {/* Elite Card - Crown & Diamonds */}
                {stats.subscriptionPlan === 'elite' && (
                  <>
                    {/* Large Crown */}
                    <path d="M50 80 L30 50 L50 65 L70 35 L90 65 L110 50 L90 80 Z" strokeWidth="1.5" />
                    <path d="M45 80 L45 90 L95 90 L95 80" />
                    <circle cx="70" cy="60" r="5" fill="#d4af37" stroke="none" />
                    {/* Diamond Pattern */}
                    <path d="M320 40 L340 70 L320 100 L300 70 Z" />
                    <path d="M320 55 L330 70 L320 85 L310 70 Z" />
                    {/* Star Constellation */}
                    <path d="M180 30 L185 45 L200 45 L188 55 L192 70 L180 60 L168 70 L172 55 L160 45 L175 45 Z" />
                    <circle cx="220" cy="50" r="3" />
                    <circle cx="240" cy="35" r="2" />
                    <circle cx="260" cy="55" r="2.5" />
                    {/* Luxury Wave Pattern */}
                    <path d="M0 150 Q50 130 100 150 Q150 170 200 150 Q250 130 300 150 Q350 170 400 150" strokeWidth="0.8" />
                    <path d="M0 170 Q50 150 100 170 Q150 190 200 170 Q250 150 300 170 Q350 190 400 170" strokeWidth="0.8" />
                    {/* Trophy */}
                    <path d="M350 180 L350 160 Q350 145 365 145 L375 145 Q390 145 390 160 L390 180" />
                    <path d="M355 180 L385 180 L380 200 L360 200 Z" />
                    {/* Coins Stack */}
                    <ellipse cx="60" cy="200" rx="25" ry="6" />
                    <ellipse cx="60" cy="193" rx="25" ry="6" />
                    <ellipse cx="60" cy="186" rx="25" ry="6" />
                  </>
                )}
                
                {/* Growth Card - Plant & Chart Theme */}
                {stats.subscriptionPlan === 'growth' && (
                  <>
                    {/* Growing Plant */}
                    <path d="M60 200 L60 120" strokeWidth="2" />
                    <path d="M60 180 Q40 170 35 150" strokeWidth="1.5" />
                    <path d="M60 160 Q80 150 85 130" strokeWidth="1.5" />
                    <path d="M60 140 Q45 130 40 115" strokeWidth="1.5" />
                    <path d="M60 120 Q70 105 75 90" strokeWidth="1.5" />
                    <ellipse cx="35" cy="145" rx="12" ry="8" />
                    <ellipse cx="85" cy="125" rx="12" ry="8" />
                    <ellipse cx="40" cy="110" rx="10" ry="7" />
                    <ellipse cx="75" cy="85" rx="10" ry="7" />
                    {/* Rising Chart */}
                    <path d="M180 180 L200 160 L230 170 L260 130 L290 140 L320 80" strokeWidth="2" />
                    <path d="M310 80 L320 80 L320 90" strokeWidth="2" />
                    <circle cx="180" cy="180" r="4" fill="#10b981" stroke="none" />
                    <circle cx="200" cy="160" r="4" fill="#10b981" stroke="none" />
                    <circle cx="260" cy="130" r="4" fill="#10b981" stroke="none" />
                    <circle cx="320" cy="80" r="4" fill="#10b981" stroke="none" />
                    {/* Percentage Up */}
                    <circle cx="350" cy="160" r="12" />
                    <path d="M345 165 L350 155 L355 165" strokeWidth="2" />
                    <path d="M350 155 L350 170" strokeWidth="2" />
                    {/* Leaf Pattern */}
                    <path d="M380 200 Q370 180 380 160 Q390 180 380 200" />
                    <path d="M20 60 Q30 40 20 20 Q10 40 20 60" />
                  </>
                )}
                
                {/* Startup Card - Rocket & Innovation Theme */}
                {stats.subscriptionPlan === 'startup' && (
                  <>
                    {/* Rocket */}
                    <path d="M80 180 L60 140 L50 140 L70 80 L90 140 L80 140 Z" strokeWidth="1.5" />
                    <path d="M70 80 Q70 60 85 50" strokeWidth="1.5" />
                    <path d="M70 80 Q70 60 55 50" strokeWidth="1.5" />
                    <circle cx="70" cy="110" r="8" />
                    <path d="M55 160 L50 180 L60 170" />
                    <path d="M85 160 L90 180 L80 170" />
                    {/* Flame */}
                    <path d="M65 180 Q70 200 75 180" fill="#3b82f6" strokeWidth="1" />
                    {/* Stars & Space */}
                    <path d="M200 40 L205 55 L220 55 L208 65 L212 80 L200 70 L188 80 L192 65 L180 55 L195 55 Z" />
                    <circle cx="250" cy="60" r="2" />
                    <circle cx="280" cy="45" r="1.5" />
                    <circle cx="300" cy="70" r="2" />
                    <circle cx="160" cy="80" r="1.5" />
                    {/* Lightning Bolt */}
                    <path d="M330 100 L310 140 L325 140 L305 180 L340 130 L320 130 L340 100 Z" fill="none" strokeWidth="1.5" />
                    {/* Orbit */}
                    <ellipse cx="360" cy="200" rx="30" ry="15" strokeDasharray="5,5" />
                    <circle cx="360" cy="200" r="6" fill="#3b82f6" stroke="none" />
                    {/* Gear */}
                    <circle cx="40" cy="40" r="15" />
                    <circle cx="40" cy="40" r="8" />
                  </>
                )}
                
                {/* Explorer Card - Compass & Map Theme */}
                {stats.subscriptionPlan === 'explorer' && (
                  <>
                    {/* Compass */}
                    <circle cx="70" cy="80" r="35" />
                    <circle cx="70" cy="80" r="28" />
                    <circle cx="70" cy="80" r="5" />
                    <path d="M70 50 L70 45" strokeWidth="2" />
                    <path d="M70 110 L70 115" strokeWidth="2" />
                    <path d="M40 80 L35 80" strokeWidth="2" />
                    <path d="M100 80 L105 80" strokeWidth="2" />
                    <path d="M70 80 L55 60" strokeWidth="2" fill="#6b7280" />
                    <path d="M70 80 L85 100" strokeWidth="1.5" />
                    {/* Mountain */}
                    <path d="M200 200 L250 120 L280 160 L310 100 L380 200 Z" strokeWidth="1.5" />
                    <path d="M250 120 L250 200" strokeDasharray="3,3" />
                    {/* Path/Trail */}
                    <path d="M150 200 Q180 180 200 190 Q230 200 260 180 Q290 160 310 170" strokeDasharray="5,5" />
                    {/* Stars */}
                    <circle cx="340" cy="50" r="2" />
                    <circle cx="360" cy="70" r="1.5" />
                    <circle cx="380" cy="45" r="2" />
                    {/* Flag */}
                    <path d="M310 100 L310 70" strokeWidth="2" />
                    <path d="M310 70 L330 80 L310 90" fill="#6b7280" />
                  </>
                )}
              </g>
            </svg>
            
            {/* Glow overlays - Plan specific colors */}
            <div 
              className="absolute -right-10 -top-10 w-40 h-40 rounded-full"
              style={{ 
                background: stats.subscriptionPlan === 'elite'
                  ? 'radial-gradient(circle, rgba(212, 175, 55, 0.25) 0%, transparent 70%)'
                  : stats.subscriptionPlan === 'growth'
                  ? 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 70%)'
                  : stats.subscriptionPlan === 'startup'
                  ? 'radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(100, 100, 100, 0.15) 0%, transparent 70%)'
              }}
            />
            <div 
              className="absolute -left-10 -bottom-10 w-32 h-32 rounded-full"
              style={{ 
                background: stats.subscriptionPlan === 'elite'
                  ? 'radial-gradient(circle, rgba(255, 215, 0, 0.2) 0%, transparent 70%)'
                  : stats.subscriptionPlan === 'growth'
                  ? 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%)'
                  : stats.subscriptionPlan === 'startup'
                  ? 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(100, 100, 100, 0.1) 0%, transparent 70%)'
              }}
            />
          </div>

          {/* Card texture */}
          <div 
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />
          
          {/* Holographic stripe - Plan specific */}
          <div 
            className="absolute top-0 left-0 right-0 h-12 opacity-20"
            style={{
              background: stats.subscriptionPlan === 'elite'
                ? 'linear-gradient(90deg, transparent 0%, rgba(255, 215, 0, 0.4) 20%, rgba(255, 255, 255, 0.5) 50%, rgba(255, 215, 0, 0.4) 80%, transparent 100%)'
                : stats.subscriptionPlan === 'growth'
                ? 'linear-gradient(90deg, transparent 0%, rgba(16, 185, 129, 0.4) 20%, rgba(255, 255, 255, 0.5) 50%, rgba(16, 185, 129, 0.4) 80%, transparent 100%)'
                : stats.subscriptionPlan === 'startup'
                ? 'linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.4) 20%, rgba(255, 255, 255, 0.5) 50%, rgba(59, 130, 246, 0.4) 80%, transparent 100%)'
                : 'linear-gradient(90deg, transparent 0%, rgba(150, 150, 150, 0.3) 20%, rgba(255, 255, 255, 0.4) 50%, rgba(150, 150, 150, 0.3) 80%, transparent 100%)',
              animation: 'shimmer 4s infinite linear'
            }}
          />

          {/* Card Content */}
          <div className="relative z-10 p-5 h-full flex flex-col justify-between">
            {/* Top Row - Logo & Plan Badge */}
            <div className="flex items-start justify-between">
              {/* PARAS REWARD Logo */}
              <div className="flex items-center">
                <img 
                  src="https://customer-assets.emergentagent.com/job_finance-ai-35/artifacts/tppmh3uy_IMG-20251230-WA0004.jpg"
                  alt="PARAS REWARD"
                  className="h-10 w-auto object-contain rounded"
                  style={{
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                  }}
                />
              </div>
              
              {/* Plan Badge */}
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${
                stats.subscriptionPlan === 'elite' ? 'bg-amber-500/20 border border-amber-500/30' :
                stats.subscriptionPlan === 'growth' ? 'bg-emerald-500/20 border border-emerald-500/30' :
                stats.subscriptionPlan === 'startup' ? 'bg-blue-500/20 border border-blue-500/30' :
                'bg-gray-500/20 border border-gray-500/30'
              }`}>
                <Crown className={`w-3 h-3 ${
                  stats.subscriptionPlan === 'elite' ? 'text-amber-400' :
                  stats.subscriptionPlan === 'growth' ? 'text-emerald-400' :
                  stats.subscriptionPlan === 'startup' ? 'text-blue-400' :
                  'text-gray-400'
                }`} />
                <span className={`text-[10px] font-bold tracking-wide ${
                  stats.subscriptionPlan === 'elite' ? 'text-amber-400' :
                  stats.subscriptionPlan === 'growth' ? 'text-emerald-400' :
                  stats.subscriptionPlan === 'startup' ? 'text-blue-400' :
                  'text-gray-400'
                }`}>
                  {getPlanDisplayName(stats.subscriptionPlan).toUpperCase()}
                </span>
              </div>
            </div>

            {/* Balance - Center */}
            <div className="flex-1 flex flex-col justify-center -mt-2">
              <div className="flex items-center gap-2 mb-1">
                <button 
                  onClick={() => setShowBalance(!showBalance)}
                  className={`transition-colors ${
                    stats.subscriptionPlan === 'elite' ? 'text-gray-600 hover:text-amber-400' :
                    stats.subscriptionPlan === 'growth' ? 'text-gray-600 hover:text-emerald-400' :
                    stats.subscriptionPlan === 'startup' ? 'text-gray-600 hover:text-blue-400' :
                    'text-gray-600 hover:text-gray-400'
                  }`}
                >
                  {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <p className="text-gray-500 text-[10px] tracking-widest">BALANCE</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span 
                  className="text-4xl font-black tracking-tight"
                  style={{
                    background: stats.subscriptionPlan === 'elite'
                      ? 'linear-gradient(180deg, #ffd700 0%, #f5f5f5 40%, #ffd700 100%)'
                      : stats.subscriptionPlan === 'growth'
                      ? 'linear-gradient(180deg, #10b981 0%, #f5f5f5 40%, #10b981 100%)'
                      : stats.subscriptionPlan === 'startup'
                      ? 'linear-gradient(180deg, #3b82f6 0%, #f5f5f5 40%, #3b82f6 100%)'
                      : 'linear-gradient(180deg, #9ca3af 0%, #f5f5f5 40%, #9ca3af 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: stats.subscriptionPlan === 'elite'
                      ? '0 2px 10px rgba(255, 215, 0, 0.2)'
                      : stats.subscriptionPlan === 'growth'
                      ? '0 2px 10px rgba(16, 185, 129, 0.2)'
                      : stats.subscriptionPlan === 'startup'
                      ? '0 2px 10px rgba(59, 130, 246, 0.2)'
                      : '0 2px 10px rgba(100, 100, 100, 0.1)'
                  }}
                >
                  {showBalance ? stats.prcBalance.toFixed(2) : '••••••'}
                </span>
                <span className={`text-lg font-semibold ${
                  stats.subscriptionPlan === 'elite' ? 'text-amber-500/80' :
                  stats.subscriptionPlan === 'growth' ? 'text-emerald-500/80' :
                  stats.subscriptionPlan === 'startup' ? 'text-blue-500/80' :
                  'text-gray-500/80'
                }`}>PRC</span>
              </div>
            </div>

            {/* Bottom Row - Card Holder, Redeemed & Multiplier */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-gray-600 text-[8px] tracking-widest mb-0.5">CARD HOLDER</p>
                <p className="text-white text-sm font-semibold tracking-wide uppercase truncate max-w-[120px]">
                  {userData?.name || user?.email?.split('@')[0] || 'USER'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-600 text-[8px] tracking-widest mb-0.5">REDEEMED</p>
                <p className="text-emerald-400 text-sm font-bold">
                  {stats.totalRedeemed >= 1000 
                    ? `${(stats.totalRedeemed / 1000).toFixed(1)}K` 
                    : stats.totalRedeemed.toFixed(0)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-gray-600 text-[8px] tracking-widest mb-0.5">MULTIPLIER</p>
                <p className={`text-sm font-bold ${
                  stats.subscriptionPlan === 'elite' ? 'text-amber-400' :
                  stats.subscriptionPlan === 'growth' ? 'text-emerald-400' :
                  stats.subscriptionPlan === 'startup' ? 'text-blue-400' :
                  'text-gray-500'
                }`}>
                  {stats.subscriptionPlan === 'elite' ? '3.0x' :
                   stats.subscriptionPlan === 'growth' ? '2.0x' :
                   stats.subscriptionPlan === 'startup' ? '1.5x' : '1.0x'}
                </p>
              </div>
            </div>

            {/* Contactless Icon */}
            <div className="absolute top-5 right-5 flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="opacity-40">
                <path d="M12 2C10.5 2 9 2.5 7.5 3.5" stroke={
                  stats.subscriptionPlan === 'elite' ? '#FFD700' :
                  stats.subscriptionPlan === 'growth' ? '#10b981' :
                  stats.subscriptionPlan === 'startup' ? '#3b82f6' : '#9ca3af'
                } strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 6C11 6 10 6.3 9 7" stroke={
                  stats.subscriptionPlan === 'elite' ? '#FFD700' :
                  stats.subscriptionPlan === 'growth' ? '#10b981' :
                  stats.subscriptionPlan === 'startup' ? '#3b82f6' : '#9ca3af'
                } strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 10C11.5 10 11 10.2 10.5 10.5" stroke={
                  stats.subscriptionPlan === 'elite' ? '#FFD700' :
                  stats.subscriptionPlan === 'growth' ? '#10b981' :
                  stats.subscriptionPlan === 'startup' ? '#3b82f6' : '#9ca3af'
                } strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          </div>

          {/* PRC Expiry Warning for Free Users */}
          {!hasPaidPlan && stats.prcBalance > 0 && (
            <div className="relative z-10 px-5 pb-4 -mt-2">
              <PRCExpiryTimer 
                userId={user?.uid}
                prcBalance={stats.prcBalance}
                miningHistory={miningHistory}
              />
            </div>
          )}
        </motion.div>
      </div>

      {/* Subscription Info Card - Only for paid subscribers */}
      {['startup', 'growth', 'elite'].includes(stats.subscriptionPlan?.toLowerCase()) && (
        <div className="px-5 mb-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl p-4 border ${
              stats.subscriptionPlan === 'elite' ? 'bg-gradient-to-r from-amber-900/30 to-yellow-900/30 border-amber-500/30' :
              stats.subscriptionPlan === 'growth' ? 'bg-gradient-to-r from-emerald-900/30 to-green-900/30 border-emerald-500/30' :
              'bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border-blue-500/30'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Crown className={`w-5 h-5 ${
                  stats.subscriptionPlan === 'elite' ? 'text-amber-400' :
                  stats.subscriptionPlan === 'growth' ? 'text-emerald-400' :
                  'text-blue-400'
                }`} />
                <span className={`font-bold ${
                  stats.subscriptionPlan === 'elite' ? 'text-amber-400' :
                  stats.subscriptionPlan === 'growth' ? 'text-emerald-400' :
                  'text-blue-400'
                }`}>
                  {stats.subscriptionPlan?.charAt(0).toUpperCase() + stats.subscriptionPlan?.slice(1)} {t('planActive')}
                </span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                stats.subscriptionExpiry && new Date(stats.subscriptionExpiry) > new Date() 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {stats.subscriptionExpiry && new Date(stats.subscriptionExpiry) > new Date() ? `✓ ${t('active')}` : `⚠ ${t('expired')}`}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider">{t('started')}</p>
                <p className="text-white text-sm font-medium">
                  {stats.subscriptionStart 
                    ? new Date(stats.subscriptionStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider">{t('expires')}</p>
                <p className="text-white text-sm font-medium">
                  {stats.subscriptionExpiry 
                    ? new Date(stats.subscriptionExpiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider">{t('daysLeft')}</p>
                <p className={`text-sm font-bold ${
                  stats.subscriptionExpiry && Math.ceil((new Date(stats.subscriptionExpiry) - new Date()) / (1000 * 60 * 60 * 24)) <= 7
                    ? 'text-red-400'
                    : 'text-green-400'
                }`}>
                  {stats.subscriptionExpiry 
                    ? Math.max(0, Math.ceil((new Date(stats.subscriptionExpiry) - new Date()) / (1000 * 60 * 60 * 24)))
                    : '—'}
                </p>
              </div>
            </div>
            
            {/* Renewal warning if less than 7 days left */}
            {stats.subscriptionExpiry && Math.ceil((new Date(stats.subscriptionExpiry) - new Date()) / (1000 * 60 * 60 * 24)) <= 7 && (
              <button 
                onClick={() => navigate('/subscription')}
                className="w-full mt-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
              >
                {t('planExpiresSoonRenew')}
              </button>
            )}
          </motion.div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-5 mb-4">
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: Star, label: t('rewards'), route: '/daily-rewards', gradient: 'from-purple-600 to-violet-700' },
            { icon: Gamepad2, label: t('play'), route: '/game', gradient: 'from-pink-600 to-rose-700' },
            { icon: UserPlus, label: t('invite'), route: '/referrals', gradient: 'from-blue-600 to-indigo-700' },
            { icon: ShoppingBag, label: t('shop'), route: '/marketplace', gradient: 'from-emerald-600 to-teal-700' },
          ].map((action, index) => (
            <motion.button
              key={action.route}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => navigate(action.route)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl bg-gradient-to-br ${action.gradient} shadow-lg`}
            >
              <action.icon className="w-5 h-5 text-white mb-1" />
              <span className="text-[10px] font-semibold text-white">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Horizontal Scrollable Cards - Upgrade Banner + Offers (only for Explorer/Free users) */}
      {!['startup', 'growth', 'elite'].includes(stats.subscriptionPlan?.toLowerCase()) && (
        <div className="mb-4 overflow-hidden">
          <div className="px-5 flex gap-3 overflow-x-auto scrollbar-hide pb-2" style={{ scrollSnapType: 'x mandatory' }}>
            {/* Upgrade Card */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => navigate('/subscription')}
              className="flex-shrink-0 w-[85%] cursor-pointer"
              style={{ scrollSnapAlign: 'start' }}
            >
              <div 
                className="relative overflow-hidden rounded-xl p-4"
                style={{
                  background: 'linear-gradient(135deg, #92400e 0%, #78350f 50%, #451a03 100%)'
                }}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-400/20 rounded-full blur-2xl"></div>
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-400/20 flex items-center justify-center">
                      <Crown className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-yellow-400 font-bold text-sm">{t('upgradeNow')}</p>
                      <p className="text-amber-200/60 text-xs">{t('startupElitePlan')} • {t('unlockRedeemServices')}</p>
                    </div>
                  </div>
                  <div className="bg-yellow-400 text-black px-3 py-1.5 rounded-lg font-bold text-sm">
                    ₹299
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Stats Card */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex-shrink-0 w-[85%]"
              style={{ scrollSnapAlign: 'start' }}
            >
              <div className="bg-gray-900/80 rounded-xl p-4 border border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">{t('yourProgress')}</p>
                      <p className="text-gray-400 text-xs">{t('total')}: {stats.totalMined.toFixed(0)} PRC</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-400 font-bold text-lg">{stats.referralCount}</p>
                    <p className="text-gray-500 text-xs">{t('referrals')}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
          {/* Scroll indicator dots */}
          <div className="flex justify-center gap-1.5 mt-1">
            <div className="w-4 h-1 bg-amber-500 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
          </div>
        </div>
      )}

      {/* Birthday Greeting */}
      {birthdayGreeting && (
        <div className="px-5 mb-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600"
          >
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-yellow-400/30 rounded-full blur-2xl animate-pulse"></div>
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-pink-400/30 rounded-full blur-2xl animate-pulse"></div>
            </div>
            <div className="relative z-10 text-center">
              <div className="text-4xl mb-2">🎂🎉🎁</div>
              <h3 className="text-white text-xl font-bold mb-1">{birthdayGreeting.message}</h3>
              <p className="text-white/80 text-sm">{birthdayGreeting.greeting}</p>
              <p className="text-yellow-300 text-xs mt-2 font-medium">{birthdayGreeting.bonus_message}</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* ========== SERVICES SECTION ========== */}
      <div className="px-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            {t('services')}
          </h2>
        </div>

        {/* Bill Payments Card */}
        <div className="bg-gradient-to-br from-blue-900/40 to-indigo-900/30 rounded-2xl border border-blue-500/30 p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-400" />
              {t('billPayments')}
            </h3>
            <button 
              onClick={() => navigate('/bill-payments')}
              className="text-blue-400 text-xs font-medium flex items-center gap-1"
            >
              {t('viewAll')} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <button 
              onClick={() => navigate('/bill-payments?type=mobile_recharge')}
              className="flex flex-col items-center gap-1.5 p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <span className="text-xl">📱</span>
              </div>
              <span className="text-[10px] text-gray-300 text-center">{t('mobile')}</span>
            </button>
            <button 
              onClick={() => navigate('/bill-payments?type=dish_recharge')}
              className="flex flex-col items-center gap-1.5 p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <span className="text-xl">📺</span>
              </div>
              <span className="text-[10px] text-gray-300 text-center">{t('dth')}</span>
            </button>
            <button 
              onClick={() => navigate('/bill-payments?type=electricity_bill')}
              className="flex flex-col items-center gap-1.5 p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <span className="text-xl">⚡</span>
              </div>
              <span className="text-[10px] text-gray-300 text-center">{t('electricity')}</span>
            </button>
            <button 
              onClick={() => navigate('/bill-payments?type=credit_card_payment')}
              className="flex flex-col items-center gap-1.5 p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <span className="text-xl">💳</span>
              </div>
              <span className="text-[10px] text-gray-300 text-center">{t('card')}</span>
            </button>
            <button 
              onClick={() => navigate('/bill-payments?type=loan_emi')}
              className="flex flex-col items-center gap-1.5 p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <span className="text-xl">🏛️</span>
              </div>
              <span className="text-[10px] text-gray-300 text-center">{t('loanEmi')}</span>
            </button>
          </div>
        </div>

        {/* Gift Vouchers & Shop Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Gift Vouchers Card */}
          <button 
            onClick={() => navigate('/gift-vouchers')}
            className="bg-gradient-to-br from-pink-900/40 to-rose-900/30 rounded-2xl border border-pink-500/30 p-4 text-left hover:border-pink-500/50 transition-all"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center mb-3 shadow-lg">
                <Gift className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-bold text-white text-sm mb-1">{t('giftVouchers')}</h3>
              <p className="text-[10px] text-gray-400">{t('amazonFlipkartMore')}</p>
              <div className="mt-2 px-3 py-1 bg-pink-500 text-white text-[10px] font-semibold rounded-full">
                {t('redeem')}
              </div>
            </div>
          </button>

          {/* Shop Card */}
          <button 
            onClick={() => navigate('/marketplace')}
            className="bg-gradient-to-br from-purple-900/40 to-indigo-900/30 rounded-2xl border border-purple-500/30 p-4 text-left hover:border-purple-500/50 transition-all"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center mb-3 shadow-lg">
                <ShoppingBag className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-bold text-white text-sm mb-1">{t('shop')}</h3>
              <p className="text-[10px] text-gray-400">{t('productsDeals')}</p>
              <div className="mt-2 px-3 py-1 bg-purple-500 text-white text-[10px] font-semibold rounded-full">
                {t('explore')}
              </div>
            </div>
          </button>
        </div>

        {/* Activity Button */}
        <button 
          onClick={() => navigate('/activity')}
          className="w-full mt-4 bg-gradient-to-r from-cyan-900/40 to-teal-900/30 rounded-2xl border border-cyan-500/30 p-4 hover:border-cyan-500/50 transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-white text-sm">{t('activity')}</h3>
              <p className="text-[10px] text-gray-400">{t('activityLiveFeed')}</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-cyan-400" />
        </button>

        {/* Luxury Life Banner - Premium Feature */}
        {['startup', 'growth', 'elite'].includes(stats.subscriptionPlan?.toLowerCase()) && (
          <motion.button 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate('/luxury-life')}
            className="w-full mt-4 relative overflow-hidden rounded-2xl border border-amber-500/40 hover:border-amber-500/60 transition-all"
          >
            {/* Gold Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-900/60 via-yellow-800/40 to-orange-900/60" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptNiA2djZoNnYtNmgtNnptLTYgNmg2djZoLTZ2LTZ6bTYgMGg2djZoLTZ2LTZ6bS0xMi0xMmg2djZoLTZ2LTZ6bTYgMGg2djZoLTZ2LTZ6bS02IDZoNnY2aC02di02em02IDBoNnY2aC02di02eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
            
            <div className="relative z-10 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 via-yellow-300 to-orange-400 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <Crown className="w-7 h-7 text-amber-900" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-200 text-base">LUXURY LIFE</h3>
                    <span className="px-2 py-0.5 bg-amber-500/30 rounded text-[8px] text-amber-300 font-bold">20% AUTO-SAVE</span>
                  </div>
                  <p className="text-amber-200/70 text-xs italic mt-0.5">&ldquo;Smart Saving. Live Better.&rdquo;</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400">📱 Mobile</span>
                    <span className="text-[10px] text-gray-400">🏍️ Bike</span>
                    <span className="text-[10px] text-gray-400">🚗 Car</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <ChevronRight className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </motion.button>
        )}
      </div>

      {/* Share App FAB removed */}

      {/* AI Chatbot */}
      <AIChatbotEnhanced 
        user={user}
        isVip={hasPaidPlan}
      />

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 z-50">
        <div className="flex items-center justify-around py-2 px-4 max-w-lg mx-auto">
          <BottomNavItem 
            icon={Home} 
            label={t('home')} 
            isActive={activeTab === 'home'} 
            onClick={() => handleNavigation('home')}
          />
          <BottomNavItem 
            icon={Star} 
            label={t('rewards')} 
            isActive={activeTab === 'rewards'} 
            onClick={() => handleNavigation('rewards')}
          />
          <BottomNavItem 
            icon={Gamepad2} 
            label={t('tapGame')} 
            isActive={activeTab === 'game'} 
            onClick={() => handleNavigation('game')}
          />
          <BottomNavItem 
            icon={User} 
            label={t('profile')} 
            isActive={activeTab === 'profile'} 
            onClick={() => handleNavigation('profile')}
          />
        </div>
      </div>
    </div>
  );
};

export default DashboardModern;
