import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Coins, Play, Clock, Star, Crown, ArrowLeft, Zap, Gift, TrendingUp, CheckCircle, Pause, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { InfoTooltip } from '@/components/InfoTooltip';

const API = process.env.REACT_APP_BACKEND_URL;

// Animated counter component for live PRC display
const AnimatedCounter = ({ value, decimals = 4 }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);
  
  useEffect(() => {
    const prevValue = prevValueRef.current;
    const diff = value - prevValue;
    
    if (Math.abs(diff) < 0.0001) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }
    
    // Smooth animation over 100ms
    const steps = 10;
    const stepValue = diff / steps;
    let currentStep = 0;
    
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(value);
        prevValueRef.current = value;
        clearInterval(interval);
      } else {
        setDisplayValue(prev => prev + stepValue);
      }
    }, 10);
    
    return () => clearInterval(interval);
  }, [value]);
  
  return (
    <span className="tabular-nums">
      {displayValue.toFixed(decimals)}
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
  const [userData, setUserData] = useState(null);
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
  
  const timerRef = useRef(null);
  const liveCounterRef = useRef(null);
  const progressRef = useRef(null);
  
  // Get global translation function
  const { t: globalT } = useLanguage();

  // Fetch user data and mining status
  const fetchUserData = useCallback(async () => {
    // Set a timeout to prevent infinite loading on slow networks
    // OPTIMIZED: Reduced timeout from 10s to 5s for faster failure
    const timeoutId = setTimeout(() => {
      setLoading(false);
      setUserData(user);
      console.warn('Mining data fetch timeout - using fallback');
    }, 5000); // 5 second timeout
    
    try {
      // Fetch user data, mining status, and redemption stats in parallel
      const [userResponse, miningResponse, statsResponse] = await Promise.all([
        axios.get(`${API}/api/user/${user.uid}`),
        axios.get(`${API}/api/mining/status/${user.uid}`),
        axios.get(`${API}/api/user/${user.uid}/redemption-stats`)
      ]);
      
      const data = userResponse.data;
      const miningData = miningResponse.data;
      const statsData = statsResponse.data;
      
      setUserData(data);
      // Use the actual mining rate from backend (per hour)
      setMiningRate(miningData.mining_rate_per_hour || miningData.mining_rate || 1.0);
      // Set lifetime earnings from redemption stats API for consistency
      setLifetimeEarnings(statsData.total_earned || 0);
      
      // Check mining session status
      if (miningData.session_active && miningData.remaining_hours > 0) {
        setIsMining(true);
        setSessionTimeRemaining(Math.floor(miningData.remaining_hours * 3600));
        const sessionStart = new Date(miningData.session_start).getTime();
        setSessionStartTime(sessionStart);
        
        // Calculate initial progress
        const totalDuration = 24 * 60 * 60 * 1000; // 24 hours
        const elapsed = Date.now() - sessionStart;
        setSessionProgress(Math.min(100, (elapsed / totalDuration) * 100));
        
        // Use mined_this_session from backend
        setSessionPRC(miningData.mined_this_session || 0);
      } else if (data.mining_active && data.mining_session_end) {
        const endTime = new Date(data.mining_session_end).getTime();
        const startTime = data.mining_start_time ? new Date(data.mining_start_time).getTime() : (endTime - 24*60*60*1000);
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        
        if (remaining > 0) {
          setIsMining(true);
          setSessionTimeRemaining(remaining);
          setSessionStartTime(startTime);
          
          // Calculate initial progress
          const totalDuration = 24 * 60 * 60 * 1000;
          const elapsed = now - startTime;
          setSessionProgress(Math.min(100, (elapsed / totalDuration) * 100));
          
          setSessionPRC(miningData.mined_this_session || 0);
        } else {
          setIsMining(false);
          setSessionTimeRemaining(0);
          setSessionProgress(0);
        }
      } else {
        setIsMining(false);
        setSessionTimeRemaining(0);
        setSessionProgress(0);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserData(user);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.uid) {
      fetchUserData();
    }
    
    return () => {
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
            toast.success('Session complete! Collect your rewards.');
            clearInterval(timerRef.current);
            if (liveCounterRef.current) clearInterval(liveCounterRef.current);
            if (progressRef.current) clearInterval(progressRef.current);
            return 0;
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
        setSessionPRC(prev => prev + prcPer100ms);
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
    setIsStarting(true);
    try {
      const response = await axios.post(`${API}/api/mining/start/${user.uid}`);
      if (response.data) {
        setIsMining(true);
        setSessionTimeRemaining(24 * 60 * 60); // 24 hours
        setSessionPRC(0);
        setSessionStartTime(Date.now());
        setSessionProgress(0); // Reset progress to 0
        toast.success('Session started! Earning PRC...');
        
        // Refresh user data
        setTimeout(() => fetchUserData(), 500);
      }
    } catch (error) {
      const detail = error.response?.data?.detail || 'Failed to start session';
      if (detail.includes('already active')) {
        toast.info('Session already active!');
        fetchUserData();
      } else {
        toast.error(detail);
      }
    } finally {
      setIsStarting(false);
    }
  };

  const collectRewards = async () => {
    if (sessionPRC < 0.01) {
      toast.error('Not enough PRC to collect');
      return;
    }
    
    setIsCollecting(true);
    try {
      // Claim mining rewards - uses correct endpoint with 80/20 luxury split
      const response = await axios.post(`${API}/api/mining/claim/${user.uid}`);
      
      const data = response.data;
      const claimed = data.claimed_amount || data.prc_collected || sessionPRC;
      const luxurySaved = data.luxury_savings?.deducted || 0;
      
      // Trigger confetti celebration!
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1000);
      
      if (luxurySaved > 0) {
        toast.success(`🎉 Collected ${claimed.toFixed(2)} PRC! (₹${luxurySaved.toFixed(2)} saved for Luxury Life)`);
      } else {
        toast.success(`🎉 Collected ${claimed.toFixed(2)} PRC!`);
      }
      
      // Reset session using response data - this ensures immediate UI update
      if (data.session_reset) {
        setSessionPRC(0);
        setSessionStartTime(new Date(data.new_session_start).getTime());
        setSessionTimeRemaining(Math.floor(data.remaining_hours * 3600));
        setSessionProgress(0); // Reset progress for new session
        setIsMining(true);
      } else {
        // Fallback: Reset local session PRC but keep mining
        setSessionPRC(0);
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
      setTimeout(() => fetchUserData(), 500);
      
    } catch (error) {
      console.error('Claim error:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to collect rewards';
      toast.error(errorMsg);
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Get subscription plan info
  const subscriptionPlan = userData?.subscription_plan || 'explorer';
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
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div>
            <h1 className="text-zinc-100 text-xl font-semibold tracking-tight">{globalT('dailyRewards')}</h1>
            <p className="text-zinc-500 text-sm">{globalT('collectRewards')}</p>
          </div>
        </div>
      </div>

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
                
                {/* Collect Button - Gold Gradient */}
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
      <div className="px-5 mb-6">
        <h2 className="text-zinc-100 font-semibold text-lg mb-4">{globalT('yourStats')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-2xl p-4"
          >
            <TrendingUp className="w-7 h-7 text-emerald-500 mb-2" />
            <div className="flex items-center gap-1">
              <p className="text-zinc-500 text-xs">Lifetime Earnings</p>
              <InfoTooltip>
                <p>Includes: Mining rewards, Referral bonuses, Tap Game, Rain Drop Game & Cashback</p>
              </InfoTooltip>
            </div>
            <p className="text-xl font-semibold text-zinc-100 font-mono tabular-nums">{(lifetimeEarnings + sessionPRC).toFixed(2)}</p>
            <p className="text-emerald-500 text-xs">PRC</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-2xl p-4"
          >
            <Gift className="w-7 h-7 text-amber-500 mb-2" />
            <div className="flex items-center gap-1">
              <p className="text-zinc-500 text-xs">{globalT('referralWeight')}</p>
              <InfoTooltip>
                <p>Bonus mining rate from your paid referrals. Each paid referral adds +10% to your mining speed (max 100%)</p>
              </InfoTooltip>
            </div>
            <p className="text-xl font-semibold text-zinc-100 font-mono tabular-nums">+{Math.min((userData?.referral_count || 0) * 10, 100)}%</p>
          </motion.div>
        </div>
      </div>

      {/* How It Works - Dark Theme */}
      <div className="px-5">
        <h2 className="text-zinc-100 font-semibold text-lg mb-4">{globalT('howToPlay')}</h2>
        <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-2xl p-5 space-y-4">
          {[
            { icon: Play, text: globalT('startSession'), color: 'text-emerald-500' },
            { icon: Coins, text: globalT('collectRewards'), color: 'text-amber-500' },
            { icon: CheckCircle, text: globalT('rewardRate'), color: 'text-emerald-400' },
            { icon: Star, text: globalT('referralWeight') + ' +10%', color: 'text-amber-400' },
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <p className="text-zinc-300 text-sm">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DailyRewards;
