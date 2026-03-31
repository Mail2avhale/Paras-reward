import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Coins, Play, Clock, Star, Crown, ArrowLeft, Zap, Gift, TrendingUp, CheckCircle, Pause, Info, Users } from 'lucide-react';
import { toast } from 'sonner';
import smartToast from '@/utils/smartToast';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { InfoTooltip } from '@/components/InfoTooltip';
import BurningIndicator from '@/components/BurningIndicator';
// PRCBurnAlert removed - free users no longer collect PRC

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ============================================
// HAPTIC FEEDBACK UTILITY
// ============================================
const triggerHaptic = (type = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30],
      success: [10, 50, 10, 50, 30],
      collect: [15, 30, 15, 30, 50, 100]
    };
    navigator.vibrate(patterns[type] || patterns.light);
  }
};

// ============================================
// PUSH NOTIFICATION UTILITY
// ============================================
const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

const sendSessionEndNotification = () => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('⛏️ Mining Session Complete!', {
      body: 'Your PRC rewards are ready to collect!',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-48x48.png',
      tag: 'mining-session-end',
      requireInteraction: true,
      vibrate: [200, 100, 200]
    });
  }
};

// ============================================
// PARTICLE SYSTEM - DISABLED FOR PERFORMANCE
// ============================================
const MiningParticles = () => null;


// ============================================
// COLLECT ANIMATION - SIMPLIFIED FOR PERFORMANCE
// ============================================
const CollectCoinsAnimation = ({ show, amount, onComplete }) => {
  useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, 500);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
      <div className="bg-gradient-to-br from-amber-500 to-yellow-600 rounded-2xl p-6 shadow-2xl">
        <div className="text-center">
          <Coins className="w-12 h-12 text-white mx-auto mb-2" />
          <p className="text-white text-2xl font-bold">+{amount?.toFixed(2)} PRC</p>
          <p className="text-white/80 text-sm">Collected!</p>
        </div>
      </div>
    </div>
  );
};


// Animated counter component for live PRC display - ALWAYS shows positive values
const AnimatedCounter = ({ value, decimals = 4 }) => {
  const [displayValue, setDisplayValue] = useState(Math.max(0, value));
  const prevValueRef = useRef(Math.max(0, value));
  
  useEffect(() => {
    // Ensure value is always positive
    const safeValue = Math.max(0, value);
    const prevValue = prevValueRef.current;
    const diff = safeValue - prevValue;
    
    // If new value is less than previous (e.g., after collect), just set it directly without animation
    if (safeValue < prevValue || Math.abs(diff) < 0.0001) {
      setDisplayValue(safeValue);
      prevValueRef.current = safeValue;
      return;
    }
    
    // Smooth animation over 100ms for increasing values only
    const steps = 10;
    const stepValue = diff / steps;
    let currentStep = 0;
    
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(safeValue);
        prevValueRef.current = safeValue;
        clearInterval(interval);
      } else {
        setDisplayValue(prev => Math.max(0, prev + stepValue));
      }
    }, 10);
    
    return () => clearInterval(interval);
  }, [value]);
  
  return (
    <span className="tabular-nums">
      {Math.max(0, displayValue).toFixed(decimals)}
    </span>
  );
};


// ============================================
// ANIMATIONS DISABLED FOR PERFORMANCE
// ============================================
const FloatingCoin = () => null;
const SparkleParticle = () => null;
const PulseRing = () => null;
const FlipDigit = ({ digit }) => <span>{digit}</span>;
const RainbowBorder = () => null;
const GlowOrb = () => null;
const BalanceCard = ({ label, value, icon: Icon, color, tooltip }) => (
  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${color || "bg-gray-800/50"}`}>
    {Icon && <Icon className="w-4 h-4" />}
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  </div>
);

// Confetti disabled for performance
const ConfettiParticle = () => null;

const DailyRewards = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  // Initialize userData with user prop to prevent subscription flickering
  const [userData, setUserData] = useState(user);
  // FIXED: Initialize isMining from user prop if available
  const [isMining, setIsMining] = useState(() => {
    // Check if user has active session from props
    if (user?.mining_active && user?.mining_session_end) {
      const endTime = new Date(user.mining_session_end).getTime();
      return endTime > Date.now();
    }
    return false;
  });
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(0);
  const [sessionPRC, setSessionPRC] = useState(0);
  const [miningRate, setMiningRate] = useState(20.83); // Default to base rate (500/24)
  const [isStarting, setIsStarting] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [lifetimeEarnings, setLifetimeEarnings] = useState(0);
  const [showFloatingCoin, setShowFloatingCoin] = useState(false);
  const [sessionProgress, setSessionProgress] = useState(0); // Real progress percentage
  const [referralBreakdown, setReferralBreakdown] = useState(null); // Level-wise breakdown
  const [baseRate, setBaseRate] = useState(0); // Individual base mining rate (includes growth network bonus)
  const [networkRate, setNetworkRate] = useState(0); // Network mining rate from Growth Economy
  
  // Collect state
  const [lastCollectedAmount, setLastCollectedAmount] = useState(0);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  
  const timerRef = useRef(null);
  const liveCounterRef = useRef(null);
  const progressRef = useRef(null);
  const sessionEndNotifiedRef = useRef(false);
  const collectInProgressRef = useRef(false); // Prevents re-fetch from overwriting optimistic balance update
  
  // Get global translation function
  const { t: globalT } = useLanguage();
  
  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission().then(() => {
      setNotificationEnabled(Notification.permission === 'granted');
    });
  }, []);
  
  // Check if user is free user (explorer, free, or no plan)
  // Use user prop first, then userData for more accurate initial display
  const subscriptionPlan = userData?.subscription_plan || user?.subscription_plan || 'explorer';
  const isFreeUser = !subscriptionPlan || subscriptionPlan === 'explorer' || subscriptionPlan === 'free' || subscriptionPlan === '';

  // Fetch user data and mining status
  const fetchUserData = useCallback(async (isInitialLoad = false, retryCount = 0) => {
    // OPTIMIZED: 4 second timeout (reduced from 8s)
    const timeoutId = setTimeout(() => {
      if (isInitialLoad) {
        setLoading(false);
        setUserData({
          ...user,
          mining_rate: user.mining_rate || 0.5,
          base_rate: user.mining_rate || 0.5
        });
        setMiningRate(user.mining_rate || 0.5);
        setBaseRate(user.mining_rate || 0.5);
        console.warn('Mining data fetch timeout - using cached user data');
        if (retryCount < 2) {
          setTimeout(() => fetchUserData(false, retryCount + 1), 1000);
        }
      }
    }, 4000);
    
    try {
      // Fetch mining status FIRST (most important for this page)
      const miningResponse = await axios.get(`${API}/mining/status/${user.uid}`, { timeout: 4000 });
      const miningData = miningResponse.data;
      
      // Immediately update mining state for faster UI
      // FIXED: Use proper fallback chain for mining rate
      const rate = miningData.mining_rate_per_hour || miningData.mining_rate || 20.83;
      setMiningRate(rate);
      // console.log('Mining rate loaded:', rate); // DEBUG
      
      setReferralBreakdown(miningData.referral_breakdown || null);
      setBaseRate(miningData.base_rate || 20.83);
      setNetworkRate(miningData.network_rate || 0); // Growth Network rate
      
      // Auto-start mining display if session is active
      // FIXED: Check session_active flag from API (source of truth)
      if (miningData.session_active) {
        const sessionStart = new Date(miningData.session_start).getTime();
        const totalDuration = 24 * 60 * 60 * 1000;
        const elapsed = Date.now() - sessionStart;
        const remainingSeconds = miningData.time_remaining || (miningData.remaining_hours * 3600) || 0;
        
        setIsMining(true);
        setSessionTimeRemaining(Math.max(0, Math.floor(remainingSeconds)));
        setSessionStartTime(sessionStart);
        setSessionProgress(Math.min(100, (elapsed / totalDuration) * 100));
        
        // Set sessionPRC from API on every load to sync with server
        const minedAmount = miningData.mined_this_session || miningData.mined_coins || 0;
        if (isInitialLoad || minedAmount > sessionPRC) {
          setSessionPRC(minedAmount);
        }
        
        console.log('[MINING] Session restored:', {
          active: true,
          remaining: remainingSeconds,
          mined: minedAmount
        });
      } else {
        // No active session
        setIsMining(false);
        setSessionTimeRemaining(0);
        setSessionProgress(0);
        if (isInitialLoad) {
          setSessionPRC(0);
        }
        console.log('[MINING] No active session');
      }
      
      // Clear loading immediately after mining data
      if (isInitialLoad) {
        clearTimeout(timeoutId);
        setLoading(false);
      }
      
      // Fetch user data and stats in background (non-blocking, parallel)
      const [userResponse, statsResponse] = await Promise.all([
        axios.get(`${API}/user/${user.uid}`, { timeout: 4000 }),
        axios.get(`${API}/user/${user.uid}/redemption-stats`, { timeout: 4000 }).catch(() => ({ data: {} }))
      ]);
      
      const data = userResponse.data;
      const statsData = statsResponse.data;
      
      // Skip overwriting userData if a collect is in progress (optimistic update takes priority)
      if (!collectInProgressRef.current) {
        setUserData(data);
      } else {
        // Still update non-balance fields during collect
        setUserData(prev => ({
          ...data,
          prc_balance: prev?.prc_balance ?? data.prc_balance
        }));
      }
      // Set lifetime earnings from redemption stats API for consistency
      setLifetimeEarnings(statsData.total_earned || 0);
      
      // NOTE: Session state is managed by mining/status API (source of truth)
      // User data is only used for balance and profile info
    } catch (error) {
      console.error('Error fetching user data:', error);
      
      // RETRY LOGIC: If first attempt fails, retry up to 2 times
      if (retryCount < 2) {
        setTimeout(() => fetchUserData(isInitialLoad, retryCount + 1), 500);
        return;
      }
      
      if (!collectInProgressRef.current) {
        setUserData(user);
      }
      // Keep default rate (20.83) instead of 1.0
    } finally {
      clearTimeout(timeoutId);
      if (isInitialLoad) setLoading(false);
    }
  }, [user, isMining]);

  useEffect(() => {
    if (user?.uid) {
      fetchUserData(true); // Initial load
    }
    
    // Auto-refresh mining status every 30 seconds
    const refreshInterval = setInterval(() => {
      if (user?.uid) {
        fetchUserData(false); // Background refresh
      }
    }, 30000);
    
    return () => {
      clearInterval(refreshInterval);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (liveCounterRef.current) {
        clearInterval(liveCounterRef.current);
      }
    };
  }, [user, fetchUserData]);

  // Timer effect - separate from data fetch
  // OPTIMIZED: Main timer every 5s, live counter every 100ms for smooth animation
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (liveCounterRef.current) {
      clearInterval(liveCounterRef.current);
    }
    if (progressRef.current) {
      clearInterval(progressRef.current);
    }
    
    if (isMining && sessionTimeRemaining > 0) {
      // Main timer updates every 5 seconds for time display
      timerRef.current = setInterval(() => {
        setSessionTimeRemaining(prev => {
          if (prev <= 5) {
            setIsMining(false);
            setSessionProgress(100);
            smartToast.success('Session complete! Collect your rewards.');
            
            // Send push notification when session ends
            if (!sessionEndNotifiedRef.current) {
              sendSessionEndNotification();
              triggerHaptic('success');
              sessionEndNotifiedRef.current = true;
            }
            
            clearInterval(timerRef.current);
            if (liveCounterRef.current) clearInterval(liveCounterRef.current);
            if (progressRef.current) clearInterval(progressRef.current);
            return 0;
          }
          
          // Send notification 5 minutes before session ends
          if (prev <= 300 && prev > 295 && !sessionEndNotifiedRef.current) {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('⏰ Mining Session Ending Soon!', {
                body: '5 minutes remaining. Collect your PRC soon!',
                icon: '/icons/icon-192x192.png',
                tag: 'mining-session-warning'
              });
            }
          }
          
          return prev - 5;
        });
        
        // Show floating coin animation periodically
        setShowFloatingCoin(true);
        setTimeout(() => setShowFloatingCoin(false), 800);
      }, 5000);
      
      // Live counter updates every 1 second
      liveCounterRef.current = setInterval(() => {
        const prcPerSecond = miningRate / 3600; // Per second
        setSessionPRC(prev => Math.max(0, prev + prcPerSecond));
      }, 1000);
      
      // Progress bar updates every second for smooth progression
      progressRef.current = setInterval(() => {
        if (sessionStartTime) {
          const totalDuration = 24 * 60 * 60 * 1000; // 24 hours in ms
          const elapsed = Date.now() - sessionStartTime;
          const progress = Math.min(100, (elapsed / totalDuration) * 100);
          setSessionProgress(progress);
        }
      }, 1000);
      
      // Calculate initial progress
      if (sessionStartTime) {
        const totalDuration = 24 * 60 * 60 * 1000;
        const elapsed = Date.now() - sessionStartTime;
        setSessionProgress(Math.min(100, (elapsed / totalDuration) * 100));
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (liveCounterRef.current) {
        clearInterval(liveCounterRef.current);
      }
      if (progressRef.current) {
        clearInterval(progressRef.current);
      }
    };
  }, [isMining, miningRate, sessionStartTime]);

  const startSession = async () => {
    // Haptic feedback on button press
    triggerHaptic('medium');
    
    // If already mining, just refresh data instead of starting new session
    if (isMining) {
      console.log('[MINING] Already mining, refreshing data...');
      await fetchUserData(true);
      return;
    }
    
    setIsStarting(true);
    try {
      const response = await axios.post(`${API}/mining/start/${user.uid}`);
      if (response.data) {
        setIsMining(true);
        setSessionTimeRemaining(24 * 60 * 60); // 24 hours
        setSessionPRC(0);
        setSessionStartTime(Date.now());
        setSessionProgress(0); // Reset progress to 0
        
        // Success haptic
        triggerHaptic('success');
        smartToast.success('Session started! Earning PRC...');
        
        // Reset notification flag
        sessionEndNotifiedRef.current = false;
        
        // Refresh user data
        setTimeout(() => fetchUserData(), 500);
      }
    } catch (error) {
      const detail = error.response?.data?.detail || 'Failed to start session';
      if (detail.includes('already active')) {
        // Session is active on server but not showing locally - sync it
        console.log('[MINING] Session active on server, syncing...');
        smartToast.info('Syncing active session...');
        await fetchUserData(true);
      } else {
        smartToast.error(detail);
      }
    } finally {
      setIsStarting(false);
    }
  };

  const collectRewards = async () => {
    if (sessionPRC < 0.01) {
      smartToast.error('Not enough PRC to collect');
      triggerHaptic('light');
      return;
    }
    
    // Haptic feedback on button press
    triggerHaptic('medium');
    
    // Mark collecting in progress to prevent re-fetch from overwriting balance
    collectInProgressRef.current = true;
    setIsCollecting(true);
    try {
      // Collect mining rewards - correct endpoint
      const response = await axios.post(`${API}/mining/collect/${user.uid}`);
      
      const data = response.data;
      const claimed = data.collected_amount || data.claimed_amount || data.prc_collected || sessionPRC;
      
      // Store claimed amount for display
      setLastCollectedAmount(claimed);
      
      // Simple haptic feedback
      triggerHaptic('success');
      
      // Show success toast
      smartToast.success(`Collected ${claimed.toFixed(2)} PRC!`, { position: 'top-center' });
      
      // Update user balance from response IMMEDIATELY
      if (data.new_balance !== undefined) {
        setUserData(prev => ({
          ...prev,
          prc_balance: data.new_balance
        }));
        
        // Update GLOBAL state so Dashboard/Profile/all pages show updated balance
        if (onBalanceUpdate) {
          onBalanceUpdate(data.new_balance);
        }
      }
      
      // Auto-start: If backend started a new session, keep mining active
      if (data.auto_started && data.new_session_start) {
        setSessionPRC(0);
        setSessionTimeRemaining(24 * 60 * 60); // Fresh 24 hours
        setSessionStartTime(new Date(data.new_session_start).getTime());
        setSessionProgress(0);
        setIsMining(true);
        
        // Reset notification flag for new session
        sessionEndNotifiedRef.current = false;
        
        smartToast.info('New session auto-started!', { position: 'top-center' });
      } else {
        // Fallback: Reset session state
        setSessionPRC(0);
        setIsMining(false);
        setSessionTimeRemaining(0);
        setSessionProgress(0);
        sessionEndNotifiedRef.current = false;
      }
      
      // Allow re-fetches to update balance after 3 seconds (DB fully synced by then)
      setTimeout(() => {
        collectInProgressRef.current = false;
        fetchUserData(false);
      }, 3000);
      
    } catch (error) {
      console.error('Claim error:', error);
      collectInProgressRef.current = false; // Clear on error
      const errorMsg = error.response?.data?.detail || 'Failed to collect rewards';
      smartToast.error(errorMsg);
    } finally {
      setIsCollecting(false);
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 pb-24">
        {/* Header Skeleton */}
        <div className="px-5 pb-4 pt-20" style={{ paddingTop: 'max(5rem, calc(env(safe-area-inset-top, 0px) + 4rem))' }}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-zinc-800 animate-pulse"></div>
            <div>
              <div className="h-6 w-32 bg-zinc-800 rounded animate-pulse mb-2"></div>
              <div className="h-4 w-24 bg-zinc-800/50 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
        
        {/* Mining Card Skeleton */}
        <div className="px-5 py-6">
          <div className="relative bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 rounded-3xl p-6 border border-zinc-800/50">
            {/* PRC Display Skeleton */}
            <div className="text-center py-8">
              <div className="h-4 w-20 bg-zinc-800 rounded mx-auto mb-4 animate-pulse"></div>
              <div className="h-12 w-40 bg-amber-900/30 rounded-lg mx-auto mb-4 animate-pulse"></div>
              <div className="h-4 w-32 bg-zinc-800/50 rounded mx-auto animate-pulse"></div>
            </div>
            
            {/* Progress Bar Skeleton */}
            <div className="my-6">
              <div className="h-3 bg-zinc-800 rounded-full animate-pulse"></div>
            </div>
            
            {/* Button Skeleton */}
            <div className="h-14 bg-amber-900/30 rounded-2xl animate-pulse"></div>
          </div>
        </div>
        
        {/* Stats Skeleton */}
        <div className="px-5 grid grid-cols-2 gap-4">
          <div className="bg-zinc-900 rounded-2xl p-4 animate-pulse">
            <div className="h-4 w-16 bg-zinc-800 rounded mb-2"></div>
            <div className="h-6 w-24 bg-zinc-800 rounded"></div>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-4 animate-pulse">
            <div className="h-4 w-16 bg-zinc-800 rounded mb-2"></div>
            <div className="h-6 w-24 bg-zinc-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Get subscription plan info - use existing subscriptionPlan from state
  const hasPaidPlan = ['startup', 'growth', 'elite'].includes(subscriptionPlan);
  
  // Get mining speed display based on subscription
  const getMiningSpeedDisplay = (plan, paymentType) => {
    // Explorer = can mine but can't collect
    if (!plan || plan === 'explorer' || plan === 'free' || plan === '') {
      return { speed: '100%', color: 'text-zinc-400', canMine: true, isDemo: false, label: '100% Speed' };
    }
    
    // Elite with PRC payment = Display as 100% (internally 70%)
    if (paymentType === 'prc') {
      return { speed: '100%', color: 'text-emerald-400', canMine: true, isDemo: false, label: '100% Speed' };
    }
    
    // Elite with Cash/Manual/Razorpay = 100% + 30% POPCORN bonus
    return { speed: '130%', color: 'text-emerald-400', canMine: true, isDemo: false, label: '100% + 30% POPCORN' };
  };
  
  const speedInfo = getMiningSpeedDisplay(subscriptionPlan, userData?.subscription_payment_type);
  
  const canCollect = sessionPRC >= 0.01;

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      {/* Header - Premium Dark Theme */}
      <div className="px-5 pb-4 pt-20" style={{ paddingTop: 'max(5rem, calc(env(safe-area-inset-top, 0px) + 4rem))' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                triggerHaptic('light');
                navigate('/dashboard');
              }}
              className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div>
              <h1 className="text-zinc-100 text-xl font-semibold tracking-tight">{globalT('dailyRewards')}</h1>
              <p className="text-zinc-500 text-sm">{globalT('collectRewards')}</p>
            </div>
          </div>
          
          {/* Notification Status Badge */}
          <button
            onClick={async () => {
              triggerHaptic('light');
              if (Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                setNotificationEnabled(permission === 'granted');
                if (permission === 'granted') {
                  smartToast.success('🔔 Notifications enabled!');
                }
              } else if (Notification.permission === 'denied') {
                smartToast.error('Please enable notifications in browser settings');
              }
            }}
            className={`p-2 rounded-full transition-colors ${
              notificationEnabled 
                ? 'bg-emerald-500/10 text-emerald-400' 
                : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
            }`}
            title={notificationEnabled ? 'Notifications enabled' : 'Enable notifications'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
        </div>
      </div>

      {/* PRC Burn Alert removed - free users no longer collect PRC */}

      {/* Main Mining Card - Glass Obsidian Design */}
      <div className="px-5 mb-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative overflow-hidden rounded-[2rem] p-6 backdrop-blur-xl border transition-all duration-500 ${
            isMining 
              ? 'bg-zinc-900/80 border-amber-500/30 shadow-[0_0_40px_-10px_rgba(251,191,36,0.2)]' 
              : 'bg-zinc-900/40 border-zinc-800 shadow-2xl shadow-black/40'
          }`}
        >
          {/* Mining Particles disabled for performance */}
          
          {/* Subtle ambient glow when mining */}
          {isMining && (
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500 rounded-full blur-[100px]" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-400 rounded-full blur-[80px]" />
            </div>
          )}

          <div className="relative z-10">
            {/* Status Badge - Clean Dark Design */}
            <div className="flex items-center justify-between mb-6">
              <div className={`px-4 py-2 rounded-full border ${
                isMining 
                  ? 'bg-emerald-500/10 border-emerald-500/30' 
                  : 'bg-zinc-800/50 border-zinc-700'
              }`}>
                <span className={`text-sm font-medium flex items-center gap-2 ${
                  isMining ? 'text-emerald-400' : 'text-zinc-400'
                }`}>
                  {isMining ? (
                    <>
                      <motion.div
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Zap className="w-4 h-4" />
                      </motion.div>
                      {globalT('sessionActive')}
                    </>
                  ) : (
                    <><Clock className="w-4 h-4" /> Ready</>
                  )}
                </span>
              </div>
              {hasPaidPlan ? (
                <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-xs font-semibold flex items-center gap-1 text-emerald-400">
                    <Zap className="w-3 h-3" /> {speedInfo.label}
                  </span>
                </div>
              ) : (
                <div className="px-3 py-1.5 rounded-full bg-zinc-800/50 border border-zinc-700">
                  <span className="text-xs font-semibold flex items-center gap-1 text-zinc-400">
                    <Zap className="w-3 h-3" /> Demo
                  </span>
                </div>
              )}
            </div>

            {/* Timer or Start Button */}
            {isMining ? (
              <div className="text-center mb-6">
                <p className="text-zinc-500 text-sm mb-2">{globalT('timeRemaining')}</p>
                {/* Digital Clock Display */}
                <div className="flex items-center justify-center gap-1">
                  {formatTime(sessionTimeRemaining).split('').map((char, i) => (
                    <div 
                      key={i}
                      className={`
                        ${char === ':' ? 'w-4 text-amber-400' : 'w-10 h-14 bg-zinc-800 border border-zinc-700 rounded-lg flex items-center justify-center'}
                      `}
                    >
                      <span className={`font-mono font-bold ${char === ':' ? 'text-2xl' : 'text-3xl text-zinc-100'}`}>
                        {char}
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* Earned PRC Display - Advanced Digital Odometer */}
                <div className="mt-6 bg-zinc-800/50 backdrop-blur-sm rounded-2xl p-5 relative overflow-hidden border border-zinc-700/50">
                  
                  <p className="text-zinc-500 text-xs mb-3 relative z-10 text-center">{globalT('sessionEarnings')}</p>
                  
                  {/* Digital Odometer Display */}
                  <div className="flex items-center justify-center gap-1 relative z-10">
                    <Coins className="w-5 h-5 text-amber-500 mr-2" />
                    
                    {/* Odometer digits */}
                    {sessionPRC.toFixed(2).split('').map((char, i) => (
                      <motion.div
                        key={`${i}-${char}`}
                        className={`
                          ${char === '.' 
                            ? 'w-3 flex items-end justify-center pb-1' 
                            : 'w-9 h-12 bg-zinc-900 border border-amber-500/30 rounded-lg flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                          }
                        `}
                        initial={{ y: -5, opacity: 0.5 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <span 
                          className={`font-mono font-bold ${
                            char === '.' 
                              ? 'text-amber-400 text-2xl' 
                              : 'text-2xl bg-gradient-to-b from-amber-300 to-amber-500 bg-clip-text text-transparent'
                          }`}
                        >
                          {char}
                        </span>
                      </motion.div>
                    ))}
                    
                    <span className="text-amber-500 font-semibold ml-2">PRC</span>
                  </div>
                  
                  {/* Per-second rate indicator */}
                  <div className="flex items-center justify-center gap-2 mt-4 relative z-10">
                    <Zap className="w-3 h-3 text-emerald-500" />
                    <p className="text-emerald-500 text-xs font-mono">
                      +{(miningRate / 3600).toFixed(4)} PRC/sec
                    </p>
                  </div>
                  
                  {/* Real Progress Bar */}
                  <div className="mt-4 relative z-10">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                      <span>Session Progress</span>
                      <span className="text-amber-400 font-mono">{sessionProgress.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${sessionProgress}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        style={{
                          background: 'linear-gradient(90deg, #10b981, #34d399)',
                          boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)'
                        }}
                      />
                    </div>
                  </div>
                </div>
                
                {/* FREE USER - Show upgrade prompt instead of collect button */}
                {isFreeUser ? (
                  /* Explorer - Show Collect disabled with upgrade prompt */
                  <div className="mt-6 bg-gradient-to-br from-amber-900/30 to-orange-900/20 rounded-2xl p-4 border border-amber-500/30">
                    <div className="flex items-center gap-3 mb-3">
                      <Crown className="w-6 h-6 text-amber-400" />
                      <div>
                        <p className="text-amber-400 font-semibold text-sm">Upgrade to Collect PRC!</p>
                        <p className="text-gray-400 text-xs">Session active - upgrade to collect {sessionPRC.toFixed(2)} PRC</p>
                      </div>
                    </div>
                    <Button 
                      disabled={true}
                      className="w-full bg-zinc-800 text-zinc-500 font-semibold py-3 rounded-xl cursor-not-allowed border border-zinc-700 mb-2"
                      data-testid="collect-disabled-btn"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Collect ({sessionPRC.toFixed(2)} PRC)
                    </Button>
                    <Button 
                      onClick={() => navigate('/subscription')}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold py-3 rounded-xl"
                      data-testid="upgrade-to-collect-btn"
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      Upgrade to Elite
                    </Button>
                  </div>
                ) : (
                  /* Collect Button - Gold Gradient - PAID USERS ONLY */
                  <Button 
                    onClick={collectRewards}
                    disabled={!canCollect || isCollecting}
                    className={`mt-6 w-full py-4 rounded-xl font-semibold text-lg transition-all active:scale-[0.98] ${
                      canCollect
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] border border-amber-400/50'
                        : 'bg-zinc-800 text-zinc-600 border border-zinc-700 cursor-not-allowed'
                    }`}
                  >
                    {isCollecting ? (
                      <span className="flex items-center gap-2 justify-center">
                        <motion.div 
                          className="w-5 h-5 border-2 border-black border-t-transparent rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                        {globalT('collecting')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 justify-center">
                        <CheckCircle className="w-5 h-5" />
                        {globalT('collectRewards')} ({sessionPRC.toFixed(2)} PRC)
                      </span>
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center mb-6">
                <motion.div 
                  className="w-24 h-24 mx-auto mb-4 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center"
                  animate={{ scale: [1, 1.03, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Star className="w-12 h-12 text-amber-500" />
                </motion.div>
                
                {/* Show daily rate for ALL users including Explorer */}
                <div className="mb-4 bg-zinc-800/50 rounded-2xl p-4 border border-zinc-700/50">
                  <p className="text-zinc-500 text-xs mb-1">Daily Earning Rate</p>
                  <p className="text-2xl font-bold text-amber-400 font-mono">
                    {(baseRate || 500).toFixed(0)} + {(networkRate || 0).toFixed(2)}
                  </p>
                  <p className="text-zinc-500 text-xs mt-1">Base + Network PRC/day</p>
                </div>
                
                {isFreeUser ? (
                  /* Explorer - Can Start Session */
                  <>
                    <p className="text-zinc-400 mb-4">{globalT('startEarning')}</p>
                    <Button 
                      onClick={startSession}
                      disabled={isStarting}
                      className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold py-4 rounded-xl text-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-emerald-500/50 active:scale-[0.98] transition-all"
                      data-testid="start-mining-btn"
                    >
                      {isStarting ? (
                        <span className="flex items-center gap-2 justify-center">
                          <motion.div 
                            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          />
                          {globalT('processing')}...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 justify-center">
                          <Play className="w-5 h-5" />
                          {globalT('startSession')}
                        </span>
                      )}
                    </Button>
                    <p className="text-amber-400/70 text-xs mt-2 text-center">Upgrade to Elite to collect earned PRC</p>
                  </>
                ) : (
                  <>
                    <p className="text-zinc-400 mb-4">{globalT('startEarning')}</p>
                    <Button 
                      onClick={startSession}
                      disabled={isStarting}
                      className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold py-4 rounded-xl text-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-emerald-500/50 active:scale-[0.98] transition-all"
                      data-testid="start-mining-btn"
                    >
                      {isStarting ? (
                        <span className="flex items-center gap-2 justify-center">
                          <motion.div 
                            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          />
                          {globalT('processing')}...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 justify-center">
                          <Play className="w-5 h-5" />
                          {globalT('startSession')}
                        </span>
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Stats Grid - Dark Glass Design */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="bg-zinc-800/50 backdrop-blur-sm rounded-2xl p-4 text-center border border-zinc-700/50">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <p className="text-zinc-500 text-xs">{globalT('currentBalance')}</p>
                  <InfoTooltip>
                    <p>Your available PRC balance that can be used for bill payments, vouchers, and marketplace purchases</p>
                  </InfoTooltip>
                </div>
                <p className="text-2xl font-semibold text-zinc-100 font-mono tabular-nums">{(userData?.prc_balance || 0).toFixed(2)}</p>
                <p className="text-amber-500 text-sm">PRC</p>
              </div>
              <div className="bg-zinc-800/50 backdrop-blur-sm rounded-2xl p-4 text-center border border-zinc-700/50">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <p className="text-zinc-500 text-xs">{globalT('rewardRate')}</p>
                  <InfoTooltip>
                    <p>PRC earned per hour. Rate increases with your subscription plan and referral bonuses</p>
                  </InfoTooltip>
                </div>
                <p className="text-2xl font-semibold text-zinc-100 font-mono tabular-nums">{miningRate.toFixed(1)}</p>
                <p className="text-emerald-500 text-sm">{globalT('perHour')}</p>
              </div>
            </div>

            {/* Burning Indicator - shows only when subscription expired */}
            <div className="mt-4">
              <BurningIndicator user={user} variant="full" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Free User Warning - Dark Theme */}
      {!hasPaidPlan && (
        <div className="px-5 mb-6">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4" data-testid="explorer-demo-warning">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <p className="text-amber-400 font-medium text-sm">Explorer Plan</p>
                <p className="text-zinc-500 text-xs mt-1">You can mine PRC but collection requires Elite plan</p>
                <button 
                  onClick={() => navigate('/subscription')}
                  className="text-amber-500 text-xs mt-1 underline hover:text-amber-400"
                >
                  Upgrade to Elite →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyRewards;
