import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { 
  TrendingUp, Star, ArrowUpRight, Clock,
  Zap, Crown, Eye, EyeOff,
  ChevronRight, Sparkles,
  Sun, Moon, Sunrise, Sunset, Building2
} from 'lucide-react';

import ProfileCompletionPopup from '@/components/ProfileCompletionPopup';
import { ProfileCompletionRing, ProfileFloatingReminder } from '@/components/ProfileCompletionComponents';
import LockedPRCCard from '@/components/LockedPRCCard';
import WalletServiceChargeLock from '@/components/WalletServiceChargeLock';
// AIChatbotEnhanced REMOVED - chatbot feature deprecated (March 2026)
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardSkeleton } from '@/components/skeletons';
// BurningIndicator removed - burning concept deprecated
import MiningWidget from '@/components/MiningWidget';
import RechargeCard from '@/components/RechargeCard';
import RefundBlockerModal from '@/components/RefundBlockerModal';
import PullToRefresh from '@/components/PullToRefresh';
import AdMobBanner from '@/components/AdMobBanner';

// Live Date & Time component for dashboard header
const LiveDateTime = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  const day = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  
  return (
    <div className="text-right" data-testid="live-datetime">
      <p className="text-white text-sm font-semibold leading-tight">{time}</p>
      <p className="text-white text-[10px] font-semibold">{day}</p>
    </div>
  );
};

import { API } from "../lib/api";

// Get time-based greeting with emoji
const getTimeGreeting = () => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return {
      text: 'Good Morning',
      emoji: '🌅',
      icon: Sunrise,
      color: 'from-orange-400 to-yellow-400'
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      text: 'Good Afternoon',
      emoji: '☀️',
      icon: Sun,
      color: 'from-yellow-400 to-orange-400'
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      text: 'Good Evening',
      emoji: '🌆',
      icon: Sunset,
      color: 'from-purple-400 to-pink-400'
    };
  } else {
    return {
      text: 'Good Night',
      emoji: '🌙',
      icon: Moon,
      color: 'from-indigo-400 to-purple-400'
    };
  }
};


const DashboardModern = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  // Time-based greeting
  const greeting = useMemo(() => getTimeGreeting(), []);
  
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [showBalance, setShowBalance] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState([]);
  // globalActivity and activityTab moved to separate Activity page
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [requiresRefundAction, setRequiresRefundAction] = useState(false);

  const [miningHistory, setMiningHistory] = useState([]);
  const [birthdayGreeting, setBirthdayGreeting] = useState(null);
  const [redeemLimit, setRedeemLimit] = useState(null);
  const [performanceSummary, setPerformanceSummary] = useState(null);
  // Global feature flag: admin can hide the Quick Recharge card. Default true
  // so the card stays visible if the API call fails or hasn't returned yet.
  const [quickRechargeEnabled, setQuickRechargeEnabled] = useState(true);

  // Stats - Initialize with user prop data to prevent flickering
  const [stats, setStats] = useState({
    prcBalance: user?.prc_balance || 0,
    totalMined: user?.total_mined || 0,
    totalRedeemed: user?.total_redeemed || 0,
    referralCount: user?.referral_count || 0,
    subscriptionPlan: user?.subscription_plan || 'explorer',
    subscriptionExpiry: user?.subscription_expiry || null,
    subscriptionStart: user?.subscription_start || user?.vip_activation_date || null,
    upcomingPlan: user?.upcoming_plan || null,
    upcomingPlansCount: user?.upcoming_plans_count || 0,
    prcRate: 10,
    categoryLimits: { utility: { remaining: 0 }, shopping: { remaining: 0 }, bank: { remaining: 0 } },
    poolWallet: { balance: 0, core_team_count: 0, is_core_member: false }, // Feb 17 2026 — retained as inert default so downstream reads never NPE; Core Team feature retired.
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

  // Update stats immediately when user prop changes (prevents subscription flickering)
  useEffect(() => {
    if (user?.subscription_plan) {
      setStats(prev => ({
        ...prev,
        subscriptionPlan: user.subscription_plan,
        subscriptionExpiry: user.subscription_expiry || prev.subscriptionExpiry,
        subscriptionStart: user.subscription_start || user.vip_activation_date || prev.subscriptionStart,
        prcBalance: user.prc_balance ?? prev.prcBalance
      }));
    }
  }, [user?.subscription_plan, user?.subscription_expiry, user?.prc_balance]);

  // Read the global "Quick Recharge" admin kill-switch on every dashboard load.
  // Endpoint is in EXCLUDED_ROUTES (auth-bypass) so anonymous fetch works too.
  // Cache-busting query param avoids stale service-worker / browser caching that
  // would otherwise prevent the toggle from taking effect for already-loaded apps.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(
          `${API}/admin/failed-transactions/quick-recharge-status?_=${Date.now()}`,
          { headers: { 'Cache-Control': 'no-cache' } }
        );
        if (!cancelled) setQuickRechargeEnabled(res.data?.enabled !== false);
      } catch {
        // Network/server error — fail-open (keep card visible).
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch dashboard data - optimized with parallel requests
  useEffect(() => {
    if (user?.uid) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = useCallback(async () => {
    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setLoading(false);
      console.warn('Dashboard data fetch timeout - using fallback data');
    }, 8000); // 8 second timeout
    
    try {
      setLoading(true);
      
      // Try combined API first (faster - single request)
      try {
        const combinedRes = await axios.get(`${API}/user/${user.uid}/dashboard`);
        
        if (combinedRes.data?.user) {
          const userData = combinedRes.data.user;
          const miningData = combinedRes.data.mining;
          
          setUserData({
            ...userData,
            mining_active: miningData.active,
            mining_session_end: miningData.session_end,
            mining_start_time: miningData.session_start
          });
          
          // Use PRC rate from combined response (single source of truth)
          const prcRate = combinedRes.data.prc_rate || null;
          
          setStats({
            prcBalance: userData.prc_balance || 0,
            totalMined: userData.total_mined || 0,
            totalRedeemed: userData.total_redeemed || 0,
            referralCount: userData.referral_count || 0,
            subscriptionPlan: userData.subscription_plan || 'explorer',
            subscriptionExpiry: userData.subscription_expiry || null,
            subscriptionStart: userData.subscription_start || null,
            upcomingPlan: combinedRes.data.upcoming_plan || null,
            upcomingPlansCount: combinedRes.data.upcoming_plans_count || 0,
            prcRate: prcRate,
            poolWallet: combinedRes.data.pool_wallet || { balance: 0, core_team_count: 0, is_core_member: false },
          });
          
          // Set recent activity from combined response
          const activities = combinedRes.data.recent_activity || [];
          setRecentTransactions(activities.slice(0, 5));
          
          // Check for pending refunds blocker
          if (combinedRes.data.requires_refund_action) {
            setRequiresRefundAction(true);
          }
          
          clearTimeout(timeoutId);
          setLoading(false);
          
          // Non-blocking: fetch redeem limit, performance summary & birthday after main load
          axios.get(`${API}/user/${user.uid}/redeem-limit`).then(res => {
            if (res.data?.success) setRedeemLimit(res.data.limit);
          }).catch(() => {});
          axios.get(`${API}/user/${user.uid}/performance-summary`).then(res => {
            if (res.data?.success) setPerformanceSummary(res.data.data);
          }).catch(() => {});
          axios.get(`${API}/user/${user.uid}/birthday-check`).then(res => {
            if (res.data?.is_birthday) setBirthdayGreeting(res.data);
          }).catch(() => {});
          
          return; // Success - exit early
        }
      } catch (combinedError) {
        // console.log('Combined API failed, trying fallback');
      }
      
      // Fallback to individual API calls (PRC rate is now fixed 10:1)
      const [userResult, activityResult] = await Promise.allSettled([
        axios.get(`${API}/user/${user.uid}`),
        axios.get(`${API}/user/${user.uid}/recent-activity?limit=10`)
      ]);
      
      const prcRate = 10;  // Fixed: 10 PRC = ₹1
      
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
          subscriptionStart: fetchedUserData.subscription_start || fetchedUserData.vip_activation_date || null,
          upcomingPlan: fetchedUserData.upcoming_plan || null,
          upcomingPlansCount: fetchedUserData.upcoming_plans_count || 0,
          prcRate: prcRate,
          poolWallet: fetchedUserData.pool_wallet || { balance: 0, core_team_count: 0, is_core_member: false },
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
          subscriptionStart: user.subscription_start || user.vip_activation_date || null,
          prcRate: prcRate
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
        const birthdayResponse = await axios.get(`${API}/user/${user.uid}/birthday-check`);
        if (birthdayResponse.data.is_birthday) {
          setBirthdayGreeting(birthdayResponse.data);
        }
      } catch (bdError) {
        // console.log('Birthday check failed');
      }

      // Fetch redeem limit (non-blocking)
      try {
        const redeemRes = await axios.get(`${API}/user/${user.uid}/redeem-limit`);
        if (redeemRes.data?.success) {
          setRedeemLimit(redeemRes.data.limit);
        }
      } catch (rlError) {
        // Redeem limit fetch failed - non-critical
      }

      // Fetch performance summary (non-blocking)
      try {
        const perfRes = await axios.get(`${API}/user/${user.uid}/performance-summary`);
        if (perfRes.data?.success) {
          setPerformanceSummary(perfRes.data.data);
        }
      } catch (psError) {
        // Performance summary fetch failed - non-critical
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Use fallback data from user prop
      setUserData(user);
      setStats({
        prcBalance: user?.prc_balance || 0,
        totalMined: user?.total_mined || 0,
        totalRedeemed: user?.total_redeemed || 0,
        referralCount: user?.referral_count || 0,
        subscriptionPlan: user?.subscription_plan || 'explorer',
        subscriptionExpiry: user?.subscription_expiry || null,
        subscriptionStart: user?.subscription_start || user?.vip_activation_date || null
      });
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [user]);


  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <PullToRefresh onRefresh={fetchDashboardData}>
    <div className="min-h-screen pb-24 bg-paras-app">

      {/* Refund Blocker Modal - blocks entire dashboard */}
      {requiresRefundAction && (
        <RefundBlockerModal
          userId={user?.uid}
          onAllRefundsComplete={() => setRequiresRefundAction(false)}
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
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{greeting.emoji}</span>
              <p className="text-paras text-sm font-medium">
                {greeting.text}
              </p>
            </div>
            <h1 className="text-paras text-xl font-bold">
              {userData?.name || user?.email?.split('@')[0] || 'User'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <LiveDateTime />
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
                  src="/paras-logo.png"
                  alt="PARAS REWARD"
                  className="h-16 w-16 object-contain rounded"
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
                <p className="text-[color:var(--paras-text-mute)] text-[10px] tracking-widest">REWARD POINTS</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span 
                  className="text-4xl font-black tracking-tight"
                  style={{
                    color: 'var(--paras-gold)',
                    textShadow: '0 2px 12px rgba(255, 193, 7, 0.28)'
                  }}
                >
                  {showBalance ? stats.prcBalance.toFixed(2) : '••••••'}
                </span>
                <span className="text-lg font-semibold" style={{ color: 'var(--paras-gold)', opacity: 0.85 }}>PRC</span>
              </div>
            </div>

            {/* Bottom Row - Card Holder & Mining Speed */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[color:var(--paras-text-mute)] text-[8px] tracking-widest mb-0.5">CARD HOLDER</p>
                <p className="text-paras text-sm font-semibold tracking-wide uppercase truncate max-w-[180px]">
                  {userData?.name || user?.email?.split('@')[0] || 'USER'}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  <p className="text-[color:var(--paras-text-mute)] text-[8px] tracking-widest mb-0.5">REWARD RATE</p>
                </div>
                <p className="text-sm font-bold flex items-center gap-1" style={{ color: 'var(--paras-mint)' }}>
                  {stats.subscriptionPlan === 'elite' || stats.subscriptionPlan === 'growth' || stats.subscriptionPlan === 'vip' ? 
                    (userData?.subscription_payment_type === 'prc' ? '100%' : <>100% + 30%<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 ml-0.5 inline-block" fill="none"><path d="M7 8C7 5.5 8.5 3 12 3C15.5 3 17 5.5 17 8" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"/><path d="M5.5 8C4.5 8 3 8.5 3 10.5C3 12 4 12.5 5 12.5" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"/><path d="M18.5 8C19.5 8 21 8.5 21 10.5C21 12 20 12.5 19 12.5" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"/><path d="M5 12.5L7 21H17L19 12.5" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="10" cy="8" r="1.5" fill="#fbbf24"/><circle cx="14" cy="8" r="1.5" fill="#fbbf24"/><circle cx="12" cy="6.5" r="1.2" fill="#fbbf24"/></svg></>) : 
                    '0%'}
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

          {/* PRC Expiry removed - PRC no longer expires */}
        </motion.div>
      </div>

      {/* PRC Locked Vault Card (25k lock, 365-day) — auto-hides if not locked */}
      {user?.uid && (
        <div className="px-5 mb-4">
          <LockedPRCCard uid={user.uid} />
        </div>
      )}

      {/* Core Team Pool Wallet Card removed Feb 17 2026 — feature retired. */}

      {/* Subscription Info Card - Only for paid subscribers */}
      {['startup', 'growth', 'elite'].includes(stats.subscriptionPlan?.toLowerCase()) && (
        <div className="px-5 mb-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4 border overflow-hidden relative"
            style={{
              background: stats.subscriptionPlan === 'elite' 
                ? 'linear-gradient(145deg, #1a1505 0%, #2d2008 50%, #1f1604 100%)'
                : stats.subscriptionPlan === 'growth'
                ? 'linear-gradient(145deg, #051a10 0%, #082d15 50%, #041f0c 100%)'
                : 'linear-gradient(145deg, #050d1a 0%, #081a2d 50%, #04101f 100%)',
              border: stats.subscriptionPlan === 'elite'
                ? '1px solid rgba(212, 175, 55, 0.35)'
                : stats.subscriptionPlan === 'growth'
                ? '1px solid rgba(16, 185, 129, 0.35)'
                : '1px solid rgba(59, 130, 246, 0.35)',
              boxShadow: stats.subscriptionPlan === 'elite'
                ? '0 8px 25px -5px rgba(212, 175, 55, 0.15)'
                : stats.subscriptionPlan === 'growth'
                ? '0 8px 25px -5px rgba(16, 185, 129, 0.15)'
                : '0 8px 25px -5px rgba(59, 130, 246, 0.15)'
            }}
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
                stats.subscriptionExpiry 
                  ? (new Date(stats.subscriptionExpiry) > new Date() 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-red-500/20 text-red-400')
                  : (stats.subscriptionPlan !== 'explorer' 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-gray-500/20 text-gray-400')
              }`}>
                {stats.subscriptionExpiry 
                  ? (new Date(stats.subscriptionExpiry) > new Date() ? `✓ ${t('active')}` : `⚠ ${t('expired')}`)
                  : (stats.subscriptionPlan !== 'explorer' ? `✓ ${t('active')}` : `— ${t('expired')}`)
                }
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
            
            {/* Renewal warning removed - subscription page deprecated */}

            {/* Next Renewal Card - Clear Timeline */}
            {stats.upcomingPlan && (
              <div className="mt-3 p-3.5 rounded-xl border" style={{
                background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(22,163,74,0.04) 100%)',
                borderColor: 'rgba(34,197,94,0.3)'
              }} data-testid="upcoming-plan-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                      <svg className="h-3 w-3 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <span className="text-green-400 font-semibold text-sm">Next Renewal: Paid & Confirmed</span>
                  </div>
                  {stats.upcomingPlansCount > 1 && (
                    <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium">+{stats.upcomingPlansCount - 1} more</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex-1">
                    <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-0.5">Starts</p>
                    <p className="text-white font-medium">
                      {stats.upcomingPlan.scheduled_start 
                        ? new Date(stats.upcomingPlan.scheduled_start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                        : 'After current plan'}
                    </p>
                  </div>
                  <div className="text-zinc-600">→</div>
                  <div className="flex-1">
                    <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-0.5">Ends</p>
                    <p className="text-white font-medium">
                      {stats.upcomingPlan.scheduled_end
                        ? new Date(stats.upcomingPlan.scheduled_end).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                        : `${stats.upcomingPlan.duration_days || 28} days`}
                    </p>
                  </div>
                  <div className="text-zinc-600">·</div>
                  <div className="flex-1 text-right">
                    <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-0.5">Paid</p>
                    <p className="text-green-400 font-semibold">
                      {stats.upcomingPlan.prc_amount 
                        ? `${Number(stats.upcomingPlan.prc_amount).toLocaleString()} PRC`
                        : stats.upcomingPlan.amount_inr || stats.upcomingPlan.amount
                          ? `₹${Number(stats.upcomingPlan.amount_inr || stats.upcomingPlan.amount).toLocaleString()}`
                          : 'Confirmed'}
                    </p>
                  </div>
                </div>
                <p className="text-zinc-500 text-[10px] mt-2 text-center">
                  Auto-renews on {stats.upcomingPlan.scheduled_start 
                    ? new Date(stats.upcomingPlan.scheduled_start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'plan expiry'}. No action needed.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Mining Widget - Reward collection on dashboard */}
      <div className="px-5 mb-4" data-testid="dashboard-mining-widget">
        <MiningWidget user={user} onBalanceUpdate={(newBalance) => {
          setStats(prev => ({ ...prev, prcBalance: newBalance }));
          if (userData) setUserData(prev => ({ ...prev, prc_balance: newBalance }));
        }} />
      </div>

      {/* Pay to Partner Store — v2.0 (Feb 2026) */}
      <div className="px-5 mb-4" data-testid="dashboard-pay-partner-store-card">
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          onClick={() => navigate('/pay-partner-store')}
          className="w-full rounded-xl p-4 relative overflow-hidden text-left backdrop-blur-xl"
          style={{
            // Sophisticated dark emerald glassmorphism — muted, not neon.
            background: 'linear-gradient(135deg, rgba(6,78,59,0.85) 0%, rgba(6,95,70,0.72) 50%, rgba(6,78,59,0.85) 100%)',
            border: '1px solid rgba(46, 196, 182, 0.35)',
            boxShadow: '0 8px 25px -6px rgba(0, 0, 0, 0.55), inset 0 0 0 1px rgba(46, 196, 182, 0.08)'
          }}
        >
          {/* Ambient glass sheen */}
          <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: 'radial-gradient(circle at 20% 0%, rgba(46,196,182,0.14), transparent 55%)' }} />
          <div className="relative flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(46, 196, 182, 0.18)', border: '1px solid rgba(46, 196, 182, 0.35)' }}>
              <svg className="w-5 h-5" style={{ color: 'var(--paras-mint)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-paras font-bold text-sm">Pay to Partner Store</p>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,193,7,0.18)', color: 'var(--paras-gold)', border: '1px solid var(--paras-gold-border)' }}>NEW</span>
              </div>
              <p className="text-paras-mute text-[11px] mt-0.5 truncate">
                Use PRC at verified local shops via mobile or Store ID
              </p>
            </div>
            <svg className="w-4 h-4 opacity-80" style={{ color: 'var(--paras-mint)' }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
            </svg>
          </div>
        </motion.button>
      </div>

      {/* Redeem Limit Card */}
      {redeemLimit && (
        <div className="px-5 mb-4" data-testid="dashboard-redeem-limit-card">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl p-4 cursor-pointer overflow-hidden relative bg-paras-card border shadow-paras-card"
            style={{
              borderColor: 'var(--paras-gold-border)',
            }}
            onClick={() => navigate('/bank-redeem')}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,193,7,0.12)', border: '1px solid var(--paras-gold-border)' }}>
                  <Building2 className="w-4 h-4" style={{ color: 'var(--paras-gold)' }} />
                </div>
                <span className="text-paras font-semibold text-sm">Redeem Limit</span>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,193,7,0.14)', color: 'var(--paras-gold)', border: '1px solid var(--paras-gold-border)' }}>
                {(redeemLimit.unlock_percent || 0).toFixed(2)}% Unlocked
              </span>
            </div>

            {/* Progress bar — silver-grey track + electric gold fill */}
            <div className="mb-1">
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--paras-slate-track)' }}>
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${Math.min(100, Math.max(0, redeemLimit.unlock_percent || 0))}%`,
                    background: 'linear-gradient(90deg, #FFD54F, #FFC107 60%, #C9971A)',
                    boxShadow: '0 0 10px rgba(255,193,7,0.55)'
                  }}
                />
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-paras-mute text-[9px]">0%</span>
                <span className="text-paras-mute text-[9px]">100% max</span>
              </div>
            </div>

            {/* Values - row layout like screenshot */}
            <div className="space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-paras-mute text-xs uppercase tracking-wider">Total Limit</span>
                <div className="text-right">
                  <span className="text-paras text-sm font-bold">{Number(redeemLimit.total_limit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PRC</span>
                  <span className="text-paras-mute text-[10px] ml-1.5">₹{(Number(redeemLimit.total_limit || 0) / (stats.prcRate || 10)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
              <div className="flex items-center justify-between cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate('/usage-history'); }}>
                <span className="text-paras-mute text-xs uppercase tracking-wider">Used</span>
                <div className="text-right">
                  <span className="text-sm font-bold" style={{ color: 'var(--paras-gold)' }}>- {Number(redeemLimit.total_redeemed || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PRC</span>
                  <span className="text-paras-mute text-[10px] ml-1.5">₹{(Number(redeemLimit.total_redeemed || 0) / (stats.prcRate || 10)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
              <div className="border-t pt-2 flex items-center justify-between" style={{ borderColor: 'var(--paras-slate-line)' }}>
                <span className="text-paras font-bold text-xs uppercase tracking-wider">Remaining</span>
                <div className="text-right">
                  <span className="text-sm font-extrabold" style={{ color: 'var(--paras-gold)' }}>{Number(redeemLimit.effective_available || redeemLimit.available || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} PRC</span>
                  <span className="text-paras-mute text-[10px] ml-1.5">₹{(Number(redeemLimit.effective_available || redeemLimit.available || 0) / (stats.prcRate || 10)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Performance Summary Card */}
      {performanceSummary && (
        <div className="px-5 mb-4" data-testid="performance-summary-card">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl p-4 bg-paras-card border border-paras-card shadow-paras-card"
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(46,196,182,0.12)', border: '1px solid rgba(46,196,182,0.3)' }}>
                <TrendingUp className="w-4 h-4" style={{ color: 'var(--paras-mint)' }} />
              </div>
              <span className="text-paras font-semibold text-sm" data-testid="perf-title">Performance Summary</span>
            </div>

            {/* Fields */}
            <div className="space-y-3">
              {/* Total Subscription Paid */}
              <div className="flex items-center justify-between" data-testid="perf-subscription-paid">
                <span className="text-paras-mute text-xs">Total Subscription Paid</span>
                <span className="text-paras text-sm font-bold">
                  ₹{Number(performanceSummary.total_subscription_paid_inr || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>

              {/* Total Rewards Redeemed */}
              <div className="flex items-center justify-between" data-testid="perf-rewards-redeemed">
                <span className="text-paras-mute text-xs">Total Rewards Redeemed</span>
                <span className="text-sm font-bold" style={{ color: 'var(--paras-mint)' }}>
                  ₹{Number(performanceSummary.total_rewards_redeemed_inr || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>

              {/* Divider */}
              <div className="border-t" style={{ borderColor: 'var(--paras-slate-line)' }} />

              {/* Available PRC Balance */}
              <div className="flex items-center justify-between" data-testid="perf-prc-balance">
                <span className="text-paras-mute text-xs">Available PRC Balance</span>
                <span className="text-sm font-bold" style={{ color: 'var(--paras-gold)' }}>
                  {Number(performanceSummary.available_prc_balance || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} PRC
                </span>
              </div>

              {/* Redemption lock status — pending 20% cash service charge (Feb 2026) */}
              <WalletServiceChargeLock
                uid={user?.uid}
                prcBalance={performanceSummary.available_prc_balance || user?.prc_balance || 0}
                prcRate={stats.prcRate || 10}
              />

              {/* Estimated PRC Value */}
              <div className="flex items-center justify-between" data-testid="perf-estimated-value">
                <span className="text-paras-mute text-xs">Estimated Value</span>
                <span className="text-paras text-sm font-medium">
                  ≈ ₹{Number(performanceSummary.estimated_prc_value_inr || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  <span className="text-paras-mute text-[9px] ml-1">(platform utility value)</span>
                </span>
              </div>
            </div>

            {/* Legal Safety Text */}
            <p className="text-paras-mute text-[9px] mt-3 leading-relaxed text-center opacity-70" data-testid="perf-legal-text">
              This is a performance-based reward summary. PRC is a digital reward and not a financial investment.
            </p>
          </motion.div>
        </div>
      )}

      {/* Quick Recharge Card — hidden globally when admin disables via system_config */}
      {user && stats && quickRechargeEnabled && (
        <div className="px-5 mb-4" data-testid="dashboard-recharge-card">
          <RechargeCard user={user} stats={stats} />
        </div>
      )}

      {/* Profile Completion Ring - Show if profile is incomplete */}
      <div className="px-5 mb-4">
        <ProfileCompletionRing 
          user={user}
          userData={userData}
          onComplete={() => navigate('/profile')}
        />
      </div>

      {/* AI Smart Tip */}
      <div className="px-5 mb-4">
      </div>

      {/* Dashboard AdMob banner removed Feb 17 2026 — v1.2.0.
          User feedback: the native banner (BOTTOM_CENTER) overlapped the
          bottom navigation on real devices making the primary nav hard to
          use. Ads are still shown on Notifications, Community Feed, and
          PayPartnerStore success screens where they don't interfere with
          navigation. */}

      {/* Rewarded ad widget removed — Google Play Store policy compliance
          (incentivised ads not allowed for AdMob rewarded video without
          full SDK init flow). Restore from git history if reintroduced. */}

      {/* Quick Actions removed - rewards integrated into dashboard */}

      {/* "Your Progress" stats card removed per admin request (29 Apr 2026):
          The data was redundant with the top stats strip. Keeping the file
          slim — if you want it back, restore from git history. */}

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

      {/* Profile Floating Reminder - Gentle prompt */}
      <ProfileFloatingReminder 
        user={user}
        userData={userData}
      />

      {/* Bottom padding for fixed BottomNav rendered by App.js */}
      <div className="pb-24" />
      
    </div>
    </PullToRefresh>
  );
};

export default DashboardModern;
