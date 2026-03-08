import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Coins, Play, Clock, Star, Crown, ArrowLeft, Zap, Gift, TrendingUp, CheckCircle, Pause, Info } from 'lucide-react';
import { toast } from 'sonner';
import smartToast from '@/utils/smartToast';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { InfoTooltip } from '@/components/InfoTooltip';
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
// ENHANCED PARTICLE SYSTEM
// ============================================
const MiningParticles = ({ isActive, intensity = 1 }) => {
  const particles = Array.from({ length: Math.floor(12 * intensity) }, (_, i) => ({
    id: i,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 2,
    x: Math.random() * 100,
    size: 2 + Math.random() * 4
  }));

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            background: `radial-gradient(circle, rgba(251, 191, 36, 0.9) 0%, rgba(245, 158, 11, 0.6) 50%, transparent 100%)`
          }}
          initial={{ y: '100%', opacity: 0, scale: 0 }}
          animate={{
            y: '-100%',
            opacity: [0, 1, 1, 0],
            scale: [0.5, 1.2, 1, 0.5],
            x: [0, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 20]
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeOut'
          }}
        />
      ))}
      {/* Glowing orbs */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={`orb-${i}`}
          className="absolute w-3 h-3 rounded-full bg-amber-400/40 blur-sm"
          style={{ left: `${20 + i * 30}%` }}
          animate={{
            y: ['80%', '20%', '80%'],
            opacity: [0.3, 0.8, 0.3],
            scale: [1, 1.5, 1]
          }}
          transition={{
            duration: 3 + i,
            delay: i * 0.5,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      ))}
    </div>
  );
};

// ============================================
// ENHANCED FLOATING COINS (Collect Animation)
// ============================================
const CollectCoinsAnimation = ({ show, amount, onComplete }) => {
  const coins = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    angle: (i * 45) * (Math.PI / 180),
    distance: 60 + Math.random() * 40
  }));

  if (!show) return null;

  return (
    <AnimatePresence>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
        {/* Central burst */}
        <motion.div
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 3, opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute w-20 h-20 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300"
          onAnimationComplete={onComplete}
        />
        
        {/* Flying coins */}
        {coins.map((coin) => (
          <motion.div
            key={coin.id}
            className="absolute"
            initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
            animate={{
              scale: [0, 1.2, 1, 0.8],
              x: Math.cos(coin.angle) * coin.distance,
              y: [0, Math.sin(coin.angle) * coin.distance - 30, Math.sin(coin.angle) * coin.distance + 50],
              opacity: [1, 1, 1, 0],
              rotate: [0, 180, 360]
            }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/50">
              <span className="text-amber-900 font-bold text-xs">₽</span>
            </div>
          </motion.div>
        ))}
        
        {/* Amount text popup */}
        <motion.div
          initial={{ scale: 0, y: 0 }}
          animate={{ scale: [0, 1.2, 1], y: -80 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="absolute text-2xl font-bold text-amber-400 drop-shadow-lg"
        >
          +{amount?.toFixed(2)} PRC
        </motion.div>
      </div>
    </AnimatePresence>
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

// Floating coin animation for visual feedback
const FloatingCoin = ({ onComplete }) => {
  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -30, scale: 0.5 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      onAnimationComplete={onComplete}
      className="absolute text-amber-400 text-sm font-bold"
    >
      +PRC
    </motion.div>
  );
};

// Sparkle particle effect for extra visual appeal
const SparkleParticle = ({ delay = 0, x = 0 }) => {
  return (
    <motion.div
      className="absolute w-1 h-1 bg-amber-400 rounded-full"
      initial={{ opacity: 0, scale: 0, x: x, y: 0 }}
      animate={{ 
        opacity: [0, 1, 0],
        scale: [0, 1.5, 0],
        y: [-10, -30],
        x: [x, x + (Math.random() - 0.5) * 20]
      }}
      transition={{ 
        duration: 1.2, 
        delay: delay,
        ease: "easeOut"
      }}
    />
  );
};

// Pulse ring animation around the counter
const PulseRing = () => {
  return (
    <motion.div
      className="absolute inset-0 rounded-2xl border-2 border-amber-500/30"
      animate={{ 
        scale: [1, 1.05, 1],
        opacity: [0.3, 0.6, 0.3]
      }}
      transition={{ 
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  );
};

// Number flip animation component
const FlipDigit = ({ digit, prevDigit }) => {
  const hasChanged = digit !== prevDigit;
  
  return (
    <motion.span
      key={digit}
      initial={hasChanged ? { rotateX: -90, opacity: 0 } : false}
      animate={{ rotateX: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="inline-block"
      style={{ transformStyle: 'preserve-3d' }}
    >
      {digit}
    </motion.span>
  );
};

// Rainbow Gradient Border Animation
const RainbowBorder = () => {
  return (
    <motion.div
      className="absolute -inset-1 rounded-3xl opacity-60 blur-sm"
      style={{
        background: 'linear-gradient(90deg, #10b981, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #f59e0b, #10b981)',
        backgroundSize: '400% 100%'
      }}
      animate={{
        backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "linear"
      }}
    />
  );
};

// Orbiting Coin Animation
const OrbitingCoin = ({ delay = 0, radius = 60, duration = 4 }) => {
  return (
    <motion.div
      className="absolute"
      style={{
        width: 20,
        height: 20,
        left: '50%',
        top: '50%',
        marginLeft: -10,
        marginTop: -10
      }}
      animate={{
        rotate: 360
      }}
      transition={{
        duration: duration,
        repeat: Infinity,
        ease: "linear",
        delay: delay
      }}
    >
      <motion.div
        className="absolute bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full shadow-lg flex items-center justify-center text-xs font-bold text-amber-900"
        style={{
          width: 20,
          height: 20,
          transform: `translateX(${radius}px)`
        }}
        animate={{
          scale: [1, 1.2, 1],
          boxShadow: [
            '0 0 5px rgba(251, 191, 36, 0.5)',
            '0 0 15px rgba(251, 191, 36, 0.8)',
            '0 0 5px rgba(251, 191, 36, 0.5)'
          ]
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity
        }}
      >
        ₹
      </motion.div>
    </motion.div>
  );
};

// Confetti Particle for burst effect
const ConfettiParticle = ({ index, onComplete }) => {
  const colors = ['#fbbf24', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
  const color = colors[index % colors.length];
  const angle = (index * 360) / 12;
  const distance = 80 + Math.random() * 40;
  
  return (
    <motion.div
      className="absolute w-3 h-3 rounded-full"
      style={{
        backgroundColor: color,
        left: '50%',
        top: '50%',
        marginLeft: -6,
        marginTop: -6
      }}
      initial={{ scale: 0, x: 0, y: 0 }}
      animate={{
        scale: [0, 1, 0],
        x: Math.cos(angle * Math.PI / 180) * distance,
        y: Math.sin(angle * Math.PI / 180) * distance,
        rotate: 360
      }}
      transition={{
        duration: 0.8,
        ease: "easeOut"
      }}
      onAnimationComplete={index === 0 ? onComplete : undefined}
    />
  );
};

// Aurora Background Effect
const AuroraBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-3xl">
      <motion.div
        className="absolute w-[200%] h-[200%] -top-1/2 -left-1/2"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.2) 0%, transparent 50%), radial-gradient(ellipse at 30% 70%, rgba(59, 130, 246, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 30%, rgba(251, 191, 36, 0.15) 0%, transparent 50%)'
        }}
        animate={{
          rotate: [0, 360]
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      <motion.div
        className="absolute w-full h-full"
        style={{
          background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.2) 50%, transparent 70%)'
        }}
        animate={{
          x: ['-100%', '100%']
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "linear"
        }}
      />
    </div>
  );
};

// Floating Bubble Animation
const FloatingBubble = ({ delay = 0, size = 30, left = '50%' }) => {
  return (
    <motion.div
      className="absolute rounded-full bg-gradient-to-br from-white/40 to-emerald-200/30 backdrop-blur-sm border border-white/30"
      style={{
        width: size,
        height: size,
        left: left,
        bottom: -size
      }}
      animate={{
        y: [0, -400],
        x: [0, (Math.random() - 0.5) * 50],
        opacity: [0, 0.8, 0],
        scale: [0.5, 1, 0.8]
      }}
      transition={{
        duration: 4 + Math.random() * 2,
        repeat: Infinity,
        delay: delay,
        ease: "easeOut"
      }}
    />
  );
};

// Glowing Shadow Effect
const GlowingShadow = () => {
  return (
    <motion.div
      className="absolute inset-0 rounded-2xl"
      animate={{
        boxShadow: [
          '0 0 15px rgba(16, 185, 129, 0.2), 0 0 30px rgba(16, 185, 129, 0.15)',
          '0 0 30px rgba(16, 185, 129, 0.35), 0 0 60px rgba(16, 185, 129, 0.2)',
          '0 0 15px rgba(16, 185, 129, 0.2), 0 0 30px rgba(16, 185, 129, 0.15)'
        ]
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  );
};

const DailyRewards = ({ user }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  // Initialize userData with user prop to prevent subscription flickering
  const [userData, setUserData] = useState(user);
  const [isMining, setIsMining] = useState(false);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(0);
  const [sessionPRC, setSessionPRC] = useState(0);
  const [miningRate, setMiningRate] = useState(1.0);
  const [isStarting, setIsStarting] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [lifetimeEarnings, setLifetimeEarnings] = useState(0);
  const [showFloatingCoin, setShowFloatingCoin] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [sessionProgress, setSessionProgress] = useState(0); // Real progress percentage
  const [referralBreakdown, setReferralBreakdown] = useState(null); // Level-wise breakdown
  const [baseRate, setBaseRate] = useState(0); // Individual base mining rate
  
  // NEW: Enhanced animation states
  const [showCollectAnimation, setShowCollectAnimation] = useState(false);
  const [lastCollectedAmount, setLastCollectedAmount] = useState(0);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  
  const timerRef = useRef(null);
  const liveCounterRef = useRef(null);
  const progressRef = useRef(null);
  const sessionEndNotifiedRef = useRef(false);
  
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
  const fetchUserData = useCallback(async (isInitialLoad = false) => {
    // Set a timeout to prevent infinite loading on slow networks
    // OPTIMIZED: 3 second timeout for faster failure, show cached data immediately
    const timeoutId = setTimeout(() => {
      if (isInitialLoad) {
        setLoading(false);
        setUserData(user);
        console.warn('Mining data fetch timeout - using fallback');
      }
    }, 3000); // 3 second timeout
    
    try {
      // Fetch mining status FIRST (most important for this page)
      // Then fetch user data and stats in parallel
      const miningResponse = await axios.get(`${API}/mining/status/${user.uid}`, { timeout: 5000 });
      const miningData = miningResponse.data;
      
      // Immediately update mining state for faster UI
      setMiningRate(miningData.mining_rate_per_hour || miningData.mining_rate || 1.0);
      setReferralBreakdown(miningData.referral_breakdown || null);
      setBaseRate(miningData.base_rate || 0);
      
      // Auto-start mining display if session is active
      if (miningData.session_active && miningData.remaining_hours > 0) {
        setIsMining(true);
        setSessionTimeRemaining(Math.floor(miningData.remaining_hours * 3600));
        const sessionStart = new Date(miningData.session_start).getTime();
        setSessionStartTime(sessionStart);
        const totalDuration = 24 * 60 * 60 * 1000;
        const elapsed = Date.now() - sessionStart;
        setSessionProgress(Math.min(100, (elapsed / totalDuration) * 100));
        setSessionPRC(miningData.mined_this_session || 0);
      }
      
      // Clear loading immediately after mining data
      if (isInitialLoad) {
        clearTimeout(timeoutId);
        setLoading(false);
      }
      
      // Fetch user data and stats in background (non-blocking)
      const [userResponse, statsResponse] = await Promise.all([
        axios.get(`${API}/user/${user.uid}`, { timeout: 5000 }),
        axios.get(`${API}/user/${user.uid}/redemption-stats`, { timeout: 5000 }).catch(() => ({ data: {} }))
      ]);
      
      const data = userResponse.data;
      const statsData = statsResponse.data;
      
      setUserData(data);
      // Set lifetime earnings from redemption stats API for consistency
      setLifetimeEarnings(statsData.total_earned || 0);
      
      // Only update mining session if not already set by miningData (avoid overwrite)
      if (!isMining && data.mining_active && data.mining_session_end) {
        const endTime = new Date(data.mining_session_end).getTime();
        const startTime = data.mining_start_time ? new Date(data.mining_start_time).getTime() : (endTime - 24*60*60*1000);
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        
        if (remaining > 0) {
          setIsMining(true);
          setSessionTimeRemaining(remaining);
          setSessionStartTime(startTime);
          const totalDuration = 24 * 60 * 60 * 1000;
          const elapsed = now - startTime;
          setSessionProgress(Math.min(100, (elapsed / totalDuration) * 100));
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserData(user);
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
      
      // Live counter updates every 100ms for smooth real-time feel
      liveCounterRef.current = setInterval(() => {
        const prcPer100ms = miningRate / 36000; // Per 100ms
        setSessionPRC(prev => Math.max(0, prev + prcPer100ms));
      }, 100);
      
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
        smartToast.info('Session already active!');
        fetchUserData();
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
    
    setIsCollecting(true);
    try {
      // Claim mining rewards - uses correct endpoint with 80/20 luxury split
      const response = await axios.post(`${API}/mining/claim/${user.uid}`);
      
      const data = response.data;
      const claimed = data.claimed_amount || data.prc_collected || sessionPRC;
      
      // Store claimed amount for animation
      setLastCollectedAmount(claimed);
      
      // Trigger enhanced coin animation
      setShowCollectAnimation(true);
      
      // Haptic success feedback
      triggerHaptic('collect');
      
      // Trigger confetti celebration!
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1000);
      
      smartToast.success(`🎉 Collected ${claimed.toFixed(2)} PRC!`, { position: 'top-center' });
      
      // IMPORTANT: Immediately reset sessionPRC to 0 to avoid negative display
      setSessionPRC(0);
      
      // Reset notification flag for new session
      sessionEndNotifiedRef.current = false;
      
      // Reset session using response data - this ensures immediate UI update
      if (data.session_reset) {
        const newStartTime = new Date(data.new_session_start).getTime();
        setSessionStartTime(newStartTime);
        setSessionTimeRemaining(Math.floor(data.remaining_hours * 3600));
        setSessionProgress(0); // Reset progress for new session
        setIsMining(true);
      } else {
        // Fallback: Reset local session but keep mining
        setSessionStartTime(Date.now());
        setSessionProgress(0); // Reset progress
      }
      
      // Update user balance from response
      if (data.new_balance && userData) {
        setUserData(prev => ({
          ...prev,
          prc_balance: data.new_balance,
          total_mined: data.total_mined || prev.total_mined
        }));
      }
      
      // Refresh user data after a brief delay to ensure cache is cleared
      setTimeout(() => fetchUserData(), 1000);
      
    } catch (error) {
      console.error('Claim error:', error);
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
  
  // Get multiplier display
  const getMultiplierDisplay = (plan) => {
    const multipliers = {
      'explorer': '1x',
      'startup': '1.5x',
      'growth': '2x',
      'elite': '3x'
    };
    return multipliers[plan] || '1x';
  };
  
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
          {/* ENHANCED: Mining Particles Effect */}
          <MiningParticles isActive={isMining} intensity={hasPaidPlan ? 1.5 : 1} />
          
          {/* ENHANCED: Collect Coins Animation */}
          <CollectCoinsAnimation 
            show={showCollectAnimation} 
            amount={lastCollectedAmount}
            onComplete={() => setShowCollectAnimation(false)}
          />
          
          {/* Subtle ambient glow when mining */}
          {isMining && (
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500 rounded-full blur-[100px]" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-400 rounded-full blur-[80px]" />
            </div>
          )}
          
          {/* Confetti Burst on Collect - keep this for celebration */}
          <AnimatePresence>
            {showConfetti && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
                {[...Array(12)].map((_, i) => (
                  <ConfettiParticle key={i} index={i} onComplete={() => setShowConfetti(false)} />
                ))}
              </div>
            )}
          </AnimatePresence>

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
              {hasPaidPlan && (
                <div className="px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30">
                  <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                    <Crown className="w-3 h-3" /> {getMultiplierDisplay(subscriptionPlan)} BONUS
                  </span>
                </div>
              )}
            </div>

            {/* Timer or Start Button */}
            {isMining ? (
              <div className="text-center mb-6">
                <p className="text-zinc-500 text-sm mb-2">{globalT('timeRemaining')}</p>
                <div className="text-5xl font-semibold text-zinc-100 font-mono tracking-wider">
                  {formatTime(sessionTimeRemaining)}
                </div>
                
                {/* Earned PRC Display - Clean Dark Design */}
                <div className="mt-6 bg-zinc-800/50 backdrop-blur-sm rounded-2xl p-5 relative overflow-hidden border border-zinc-700/50">
                  
                  <p className="text-zinc-500 text-xs mb-2 relative z-10">{globalT('sessionEarnings')}</p>
                  <div className="flex items-center justify-center gap-3 relative z-10">
                    {/* Simple coin icon */}
                    <Coins className="w-6 h-6 text-amber-500" />
                    
                    {/* Live counter with gold gradient */}
                    <span className="text-4xl font-semibold text-amber-400 font-mono tabular-nums tracking-wide">
                      <AnimatedCounter value={sessionPRC} decimals={4} />
                    </span>
                    <span className="text-lg font-medium text-amber-500/70">
                      PRC
                    </span>
                    
                    {/* Floating +PRC indicator */}
                    <AnimatePresence>
                      {showFloatingCoin && (
                        <FloatingCoin onComplete={() => setShowFloatingCoin(false)} />
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Per-second rate indicator */}
                  <div className="flex items-center justify-center gap-2 mt-3 relative z-10">
                    <Zap className="w-3 h-3 text-emerald-500" />
                    <p className="text-emerald-500 text-xs font-mono">
                      +{(miningRate / 3600).toFixed(6)} PRC/sec
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
                  <div className="mt-6 bg-gradient-to-br from-amber-900/30 to-orange-900/20 rounded-2xl p-4 border border-amber-500/30">
                    <div className="flex items-center gap-3 mb-3">
                      <Crown className="w-6 h-6 text-amber-400" />
                      <div>
                        <p className="text-amber-400 font-semibold text-sm">Upgrade to Collect PRC!</p>
                        <p className="text-gray-400 text-xs">तुमचे {sessionPRC.toFixed(2)} PRC collect करण्यासाठी plan upgrade करा</p>
                      </div>
                    </div>
                    <Button 
                      onClick={() => navigate('/subscription')}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold py-3 rounded-xl"
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      Upgrade Now
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
                <p className="text-zinc-400 mb-4">{globalT('startEarning')}</p>
                <Button 
                  onClick={startSession}
                  disabled={isStarting}
                  className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold py-4 rounded-xl text-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-emerald-500/50 active:scale-[0.98] transition-all"
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
          </div>
        </motion.div>
      </div>

      {/* Free User Warning - Dark Theme */}
      {!hasPaidPlan && (
        <div className="px-5 mb-6">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <p className="text-amber-400 font-medium text-sm">{globalT('freeUserWarning')}</p>
                <button 
                  onClick={() => navigate('/subscription')}
                  className="text-amber-500 text-xs mt-1 underline hover:text-amber-400"
                >
                  {globalT('upgradeToVip')} →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats - Dark Theme */}
      {/* Level-wise Mining Breakdown */}
      <div className="px-5">
        <h2 className="text-zinc-100 font-semibold text-lg mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-amber-400" />
          Mining Speed Breakdown
        </h2>
        <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-2xl p-4 space-y-3">
          {/* Individual Base Rate */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Coins className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-zinc-200 text-sm font-medium">Your Mining</p>
                <p className="text-zinc-500 text-xs">Base rate</p>
              </div>
            </div>
            <p className="text-emerald-400 font-mono text-sm font-semibold">
              {baseRate.toFixed(2)} PRC/hr
            </p>
          </div>
          
          {/* Level 1 */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">L1</div>
              <div>
                <p className="text-zinc-200 text-sm font-medium">Direct Friends</p>
                <p className="text-zinc-500 text-xs">
                  {referralBreakdown?.level_1?.total_count || 0} invited • {referralBreakdown?.level_1?.active_count || 0} active
                </p>
              </div>
            </div>
            <p className={`font-mono text-sm font-semibold ${(referralBreakdown?.level_1?.bonus || 0) > 0 ? 'text-blue-400' : 'text-zinc-600'}`}>
              +{(referralBreakdown?.level_1?.bonus || 0).toFixed(2)} PRC/hr
            </p>
          </div>
          
          {/* Level 2 */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-bold">L2</div>
              <div>
                <p className="text-zinc-200 text-sm font-medium">Level 2 Friends</p>
                <p className="text-zinc-500 text-xs">
                  {referralBreakdown?.level_2?.total_count || 0} invited • {referralBreakdown?.level_2?.active_count || 0} active
                </p>
              </div>
            </div>
            <p className={`font-mono text-sm font-semibold ${(referralBreakdown?.level_2?.bonus || 0) > 0 ? 'text-purple-400' : 'text-zinc-600'}`}>
              +{(referralBreakdown?.level_2?.bonus || 0).toFixed(2)} PRC/hr
            </p>
          </div>
          
          {/* Level 3 */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400 text-xs font-bold">L3</div>
              <div>
                <p className="text-zinc-200 text-sm font-medium">Level 3 Friends</p>
                <p className="text-zinc-500 text-xs">
                  {referralBreakdown?.level_3?.total_count || 0} invited • {referralBreakdown?.level_3?.active_count || 0} active
                </p>
              </div>
            </div>
            <p className={`font-mono text-sm font-semibold ${(referralBreakdown?.level_3?.bonus || 0) > 0 ? 'text-orange-400' : 'text-zinc-600'}`}>
              +{(referralBreakdown?.level_3?.bonus || 0).toFixed(2)} PRC/hr
            </p>
          </div>
          
          {/* Total */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t-2 border-amber-500/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/30 flex items-center justify-center">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-amber-400 text-sm font-bold">TOTAL SPEED</p>
                <p className="text-zinc-500 text-xs">Per hour mining</p>
              </div>
            </div>
            <p className="text-amber-400 font-mono text-lg font-bold">
              {miningRate.toFixed(2)} PRC/hr
            </p>
          </div>
          
          {/* Info note */}
          <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-blue-300 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Bonus is calculated from active PAID users only. Free users don't contribute to mining speed.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyRewards;
