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
import AppTutorialAdvanced from '@/components/AppTutorialAdvanced';
import AIChatbotEnhanced from '@/components/AIChatbotEnhanced';
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
  
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [showBalance, setShowBalance] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [globalActivity, setGlobalActivity] = useState([]);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [activityTab, setActivityTab] = useState('yours');
  const [miningHistory, setMiningHistory] = useState([]);
  const [birthdayGreeting, setBirthdayGreeting] = useState(null);

  // Stats
  const [stats, setStats] = useState({
    prcBalance: 0,
    totalMined: 0,
    referralCount: 0,
    membershipType: 'free'
  });

  // Check tutorial on mount
  useEffect(() => {
    const tutorialCompleted = localStorage.getItem('tutorial_completed');
    if (!tutorialCompleted && user?.uid) {
      setShowTutorial(true);
    }
  }, [user]);

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
      const [userResult, activityResult, globalResult] = await Promise.allSettled([
        axios.get(`${API}/api/user/${user.uid}`),
        axios.get(`${API}/api/user/${user.uid}/recent-activity?limit=10`),
        axios.get(`${API}/api/global/live-activity?limit=10`)
      ]);
      
      // Process user data
      if (userResult.status === 'fulfilled') {
        const fetchedUserData = userResult.value.data;
        setUserData(fetchedUserData);
        setMiningHistory(fetchedUserData.mining_history || []);
        setStats({
          prcBalance: fetchedUserData.prc_balance || 0,
          totalMined: fetchedUserData.total_mined || 0,
          referralCount: fetchedUserData.referral_count || 0,
          membershipType: fetchedUserData.membership_type || 'free'
        });
      } else {
        // Fallback to user prop data
        setUserData(user);
        setStats({
          prcBalance: user.prc_balance || 0,
          totalMined: user.total_mined || 0,
          referralCount: user.referral_count || 0,
          membershipType: user.membership_type || 'free'
        });
      }
      
      // Process activity data
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
      
      // Process global activity
      if (globalResult.status === 'fulfilled') {
        setGlobalActivity(globalResult.value.data.activities || []);
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
  };

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
      
      {/* Tutorial */}
      {showTutorial && (
        <AppTutorialAdvanced 
          user={user}
          onComplete={() => {
            setShowTutorial(false);
            localStorage.setItem('tutorial_completed', 'true');
          }}
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

      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Welcome back,</p>
            <h1 className="text-white text-xl font-bold">
              {userData?.name || user?.email?.split('@')[0] || 'User'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {stats.membershipType === 'vip' && (
              <div className="bg-gradient-to-r from-amber-500 to-yellow-500 px-3 py-1 rounded-full">
                <span className="text-xs font-bold text-black flex items-center gap-1">
                  <Crown className="w-3 h-3" /> VIP
                </span>
              </div>
            )}
            <button 
              onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center"
            >
              <User className="w-5 h-5 text-black" />
            </button>
          </div>
        </div>
      </div>

      {/* Premium 3D Credit Card */}
      <div className="px-5 mb-6" style={{ perspective: '1500px' }}>
        <motion.div 
          initial={{ opacity: 0, rotateX: 20 }}
          animate={{ opacity: 1, rotateX: 0 }}
          whileHover={{ rotateY: 3, rotateX: -2, scale: 1.01 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: 'linear-gradient(145deg, #1c1c1c 0%, #0d0d0d 30%, #1a1a1a 70%, #0a0a0a 100%)',
            boxShadow: `
              0 25px 50px -12px rgba(0, 0, 0, 0.8),
              inset 0 1px 0 rgba(255, 255, 255, 0.05)
            `,
            transformStyle: 'preserve-3d',
            aspectRatio: '1.586',
            border: '1.5px solid rgba(212, 175, 55, 0.3)'
          }}
        >
          {/* Animated gold border glow */}
          <div 
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              background: 'transparent',
              boxShadow: '0 0 20px rgba(212, 175, 55, 0.15), inset 0 0 20px rgba(212, 175, 55, 0.05)',
              animation: 'borderPulse 3s ease-in-out infinite'
            }}
          />

          {/* Artistic Line Art Background - Reward/Finance Theme */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* SVG Illustration Pattern */}
            <svg 
              className="absolute inset-0 w-full h-full" 
              viewBox="0 0 400 252" 
              preserveAspectRatio="xMidYMid slice"
              style={{ opacity: 0.35 }}
            >
              <defs>
                <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffd700" />
                  <stop offset="50%" stopColor="#d4af37" />
                  <stop offset="100%" stopColor="#b8860b" />
                </linearGradient>
              </defs>
              <g fill="none" stroke="url(#goldGradient)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                {/* Large Coin - top left */}
                <circle cx="60" cy="50" r="35" />
                <circle cx="60" cy="50" r="28" />
                <text x="60" y="58" textAnchor="middle" fill="#d4af37" fontSize="24" fontWeight="bold" stroke="none">₹</text>
                
                {/* Stack of Coins - bottom left */}
                <ellipse cx="45" cy="200" rx="30" ry="8" />
                <ellipse cx="45" cy="192" rx="30" ry="8" />
                <ellipse cx="45" cy="184" rx="30" ry="8" />
                <path d="M15 184 L15 200" />
                <path d="M75 184 L75 200" />
                
                {/* Gift Box - center */}
                <rect x="160" y="100" width="50" height="45" rx="3" />
                <path d="M160 115 L210 115" />
                <path d="M185 100 L185 145" />
                <path d="M170 100 Q185 85 200 100" />
                <path d="M175 100 Q185 90 195 100" />
                
                {/* Trophy - right side */}
                <path d="M320 60 L320 40 Q320 25 335 25 L345 25 Q360 25 360 40 L360 60" />
                <path d="M325 60 L355 60 L350 80 L330 80 Z" />
                <rect x="332" y="80" width="16" height="8" />
                <rect x="328" y="88" width="24" height="5" />
                <path d="M320 45 Q305 45 305 55 Q305 65 320 60" />
                <path d="M360 45 Q375 45 375 55 Q375 65 360 60" />
                
                {/* Star - top right */}
                <path d="M370 130 L375 145 L390 145 L378 155 L383 170 L370 160 L357 170 L362 155 L350 145 L365 145 Z" />
                
                {/* Small Stars scattered */}
                <path d="M120 30 L123 38 L131 38 L125 43 L127 51 L120 46 L113 51 L115 43 L109 38 L117 38 Z" />
                <path d="M280 180 L282 186 L288 186 L283 190 L285 196 L280 192 L275 196 L277 190 L272 186 L278 186 Z" />
                
                {/* Wallet - bottom center */}
                <rect x="230" y="190" width="55" height="40" rx="5" />
                <path d="M230 205 L285 205" />
                <circle cx="270" cy="215" r="8" />
                <circle cx="270" cy="215" r="4" />
                
                {/* Rising Arrow/Chart - top center */}
                <path d="M180 50 L200 35 L220 45 L240 20" />
                <path d="M230 20 L240 20 L240 30" />
                
                {/* Decorative curves and waves */}
                <path d="M0 130 Q50 110 100 130 Q150 150 200 130" strokeWidth="0.8" />
                <path d="M200 180 Q250 160 300 180 Q350 200 400 180" strokeWidth="0.8" />
                
                {/* Diamond shapes */}
                <path d="M100 160 L115 175 L100 190 L85 175 Z" />
                <path d="M310 100 L320 112 L310 124 L300 112 Z" />
                
                {/* Floating Circles/Bubbles */}
                <circle cx="140" cy="70" r="6" />
                <circle cx="155" cy="85" r="4" />
                <circle cx="250" cy="70" r="5" />
                <circle cx="90" cy="120" r="4" />
                <circle cx="350" cy="200" r="6" />
                
                {/* Percentage symbol */}
                <circle cx="30" cy="130" r="8" />
                <circle cx="55" cy="155" r="8" />
                <path d="M25 160 L60 125" strokeWidth="2" />
                
                {/* Credit Card icon - small */}
                <rect x="320" y="220" width="40" height="25" rx="3" />
                <path d="M320 230 L360 230" />
                <rect x="325" y="235" width="15" height="5" rx="1" />
                
                {/* Arrows pointing up */}
                <path d="M390 230 L390 200 M383 210 L390 200 L397 210" />
                
                {/* Plant/Growth symbol */}
                <path d="M10 250 L10 200 Q10 180 25 185 Q10 175 10 160" />
                <path d="M10 190 Q25 185 20 175" />
                <path d="M10 210 Q-5 205 0 195" />
              </g>
            </svg>
            
            {/* Subtle glow overlays */}
            <div 
              className="absolute -right-10 -top-10 w-40 h-40 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(212, 175, 55, 0.2) 0%, transparent 70%)' }}
            />
            <div 
              className="absolute -left-10 -bottom-10 w-32 h-32 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(255, 215, 0, 0.15) 0%, transparent 70%)' }}
            />
          </div>

          {/* Realistic card texture */}
          <div 
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />
          
          {/* Holographic stripe */}
          <div 
            className="absolute top-0 left-0 right-0 h-12 opacity-20"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255, 215, 0, 0.3) 20%, rgba(255, 255, 255, 0.4) 50%, rgba(255, 215, 0, 0.3) 80%, transparent 100%)',
              animation: 'shimmer 4s infinite linear'
            }}
          />

          {/* Card Content */}
          <div className="relative z-10 p-5 h-full flex flex-col justify-between">
            {/* Top Row - Logo & Live Session Indicator */}
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
              
              {/* Live Session Indicator */}
              <div className="flex items-center gap-1.5 bg-black/30 px-2 py-1 rounded-full">
                <div className="relative">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <div className="absolute inset-0 w-2 h-2 bg-emerald-400 rounded-full animate-ping"></div>
                </div>
                <span className="text-emerald-400 text-[9px] font-semibold tracking-wide">ACTIVE</span>
              </div>
            </div>

            {/* Balance - Center */}
            <div className="flex-1 flex flex-col justify-center -mt-2">
              <div className="flex items-center gap-2 mb-1">
                <button 
                  onClick={() => setShowBalance(!showBalance)}
                  className="text-gray-600 hover:text-amber-400 transition-colors"
                >
                  {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <p className="text-gray-500 text-[10px] tracking-widest">BALANCE</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span 
                  className="text-4xl font-black tracking-tight"
                  style={{
                    background: 'linear-gradient(180deg, #ffd700 0%, #f5f5f5 40%, #ffd700 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 2px 10px rgba(255, 215, 0, 0.2)'
                  }}
                >
                  {showBalance ? stats.prcBalance.toFixed(2) : '••••••'}
                </span>
                <span className="text-amber-500/80 text-lg font-semibold">PRC</span>
              </div>
            </div>

            {/* Bottom Row - Card Holder & Stats */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-gray-600 text-[8px] tracking-widest mb-0.5">CARD HOLDER</p>
                <p className="text-white text-sm font-semibold tracking-wide uppercase truncate max-w-[160px]">
                  {userData?.name || user?.email?.split('@')[0] || 'USER'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-gray-600 text-[8px] tracking-widest mb-0.5">STATUS</p>
                <p className={`text-sm font-bold ${stats.membershipType === 'vip' ? 'text-amber-400' : 'text-gray-500'}`}>
                  {stats.membershipType === 'vip' ? '★ VIP' : 'FREE'}
                </p>
              </div>
            </div>

            {/* Contactless + Visa-like Logo */}
            <div className="absolute top-5 right-5 flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="opacity-40">
                <path d="M12 2C10.5 2 9 2.5 7.5 3.5" stroke="#FFD700" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 6C11 6 10 6.3 9 7" stroke="#FFD700" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 10C11.5 10 11 10.2 10.5 10.5" stroke="#FFD700" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          </div>

          {/* PRC Expiry Warning for Free Users */}
          {stats.membershipType !== 'vip' && stats.prcBalance > 0 && (
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

      {/* Quick Actions */}
      <div className="px-5 mb-4">
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: Star, label: 'Rewards', route: '/daily-rewards', gradient: 'from-purple-600 to-violet-700' },
            { icon: Gamepad2, label: 'Play', route: '/game', gradient: 'from-pink-600 to-rose-700' },
            { icon: UserPlus, label: 'Invite', route: '/referrals', gradient: 'from-blue-600 to-indigo-700' },
            { icon: ShoppingBag, label: 'Shop', route: '/marketplace', gradient: 'from-emerald-600 to-teal-700' },
          ].map((action, index) => (
            <motion.button
              key={action.label}
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

      {/* Horizontal Scrollable Cards - VIP Upgrade + Offers */}
      {stats.membershipType !== 'vip' && (
        <div className="mb-4 overflow-hidden">
          <div className="px-5 flex gap-3 overflow-x-auto scrollbar-hide pb-2" style={{ scrollSnapType: 'x mandatory' }}>
            {/* VIP Upgrade Card */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => navigate('/vip')}
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
                      <p className="text-yellow-400 font-bold text-sm">Upgrade to VIP</p>
                      <p className="text-amber-200/60 text-xs">2x Rewards • No Expiry</p>
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
                      <p className="text-white font-bold text-sm">Your Progress</p>
                      <p className="text-gray-400 text-xs">Total: {stats.totalMined.toFixed(0)} PRC</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-400 font-bold text-lg">{stats.referralCount}</p>
                    <p className="text-gray-500 text-xs">Referrals</p>
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

      {/* Combined Activity Card - Your Activity + Live Activity */}
      <div className="px-5 mb-6">
        <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden">
          {/* Tab Header */}
          <div className="flex items-center border-b border-gray-800">
            <button
              onClick={() => setActivityTab('yours')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-all ${
                activityTab === 'yours' 
                  ? 'text-amber-500 border-b-2 border-amber-500 bg-amber-500/5' 
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Your Activity
            </button>
            <button
              onClick={() => setActivityTab('live')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activityTab === 'live' 
                  ? 'text-emerald-500 border-b-2 border-emerald-500 bg-emerald-500/5' 
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Live Activity
            </button>
          </div>

          {/* Content */}
          <div className="min-h-[200px]">
            {activityTab === 'yours' ? (
              /* Your Activity Content */
              recentTransactions.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-10 h-10 mx-auto mb-2 text-gray-600" />
                  <p className="text-gray-500 text-sm">No activity yet</p>
                  <button 
                    onClick={() => navigate('/daily-rewards')}
                    className="mt-2 text-amber-500 text-sm font-medium"
                  >
                    Start Earning →
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {recentTransactions.slice(0, 5).map((tx, index) => (
                    <div key={index} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                          tx.amount > 0 ? 'bg-emerald-500/20' : tx.amount < 0 ? 'bg-red-500/20' : 'bg-blue-500/20'
                        }`}>
                          {tx.icon ? (
                            <span>{tx.icon}</span>
                          ) : tx.amount > 0 ? (
                            <TrendingUp className="w-5 h-5 text-emerald-500" />
                          ) : tx.amount < 0 ? (
                            <ShoppingBag className="w-5 h-5 text-red-400" />
                          ) : (
                            <Clock className="w-5 h-5 text-blue-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">
                            {(tx.description || tx.type || 'Activity').replace(/mining/gi, 'rewards')}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : 'Today'}
                          </p>
                        </div>
                      </div>
                      {tx.amount !== undefined && tx.amount !== 0 && (
                        <p className={`font-bold ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount?.toFixed(2)} PRC
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* Live Activity Content */
              globalActivity.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-10 h-10 mx-auto mb-2 text-gray-600" />
                  <p className="text-gray-500 text-sm">No recent activity</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800 max-h-[250px] overflow-y-auto">
                  {globalActivity.slice(0, 8).map((activity, index) => (
                    <motion.div 
                      key={index} 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base ${
                          activity.category === 'bill' ? 'bg-blue-500/20' :
                          activity.category === 'voucher' ? 'bg-purple-500/20' : 'bg-amber-500/20'
                        }`}>
                          <span>{activity.icon}</span>
                        </div>
                        <div>
                          <p className="text-white text-sm">{activity.description}</p>
                          <p className="text-gray-500 text-xs">
                            {activity.user} {activity.location && `• ${activity.location}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-gray-600 text-xs">
                        {activity.timestamp ? new Date(activity.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Now'}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* View All Footer */}
          {activityTab === 'yours' && recentTransactions.length > 0 && (
            <div className="border-t border-gray-800 p-3">
              <button 
                onClick={() => navigate('/transactions')}
                className="w-full text-amber-500 text-sm font-medium flex items-center justify-center gap-1"
              >
                View All Transactions <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* AI Chatbot */}
      <AIChatbotEnhanced 
        user={user}
        isVip={stats.membershipType === 'vip'}
      />

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 z-50">
        <div className="flex items-center justify-around py-2 px-4 max-w-lg mx-auto">
          <BottomNavItem 
            icon={Home} 
            label="Home" 
            isActive={activeTab === 'home'} 
            onClick={() => handleNavigation('home')}
          />
          <BottomNavItem 
            icon={Star} 
            label="Rewards" 
            isActive={activeTab === 'rewards'} 
            onClick={() => handleNavigation('rewards')}
          />
          <BottomNavItem 
            icon={Gamepad2} 
            label="Play" 
            isActive={activeTab === 'game'} 
            onClick={() => handleNavigation('game')}
          />
          <BottomNavItem 
            icon={User} 
            label="Profile" 
            isActive={activeTab === 'profile'} 
            onClick={() => handleNavigation('profile')}
          />
        </div>
      </div>
    </div>
  );
};

export default DashboardModern;
