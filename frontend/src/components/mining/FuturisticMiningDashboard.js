import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Zap, Crown, TrendingUp, Info } from 'lucide-react';
import { toast } from 'sonner';
import smartToast from '@/utils/smartToast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

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
// SPEEDOMETER GAUGE COMPONENT - Compact
// ============================================
const SpeedometerGauge = ({ rate, maxRate = 250 }) => {
  const percentage = Math.min((rate / maxRate) * 100, 100);
  const angle = (percentage / 100) * 180 - 90; // -90 to 90 degrees

  return (
    <div className="relative w-full flex flex-col items-center">
      {/* SVG Gauge */}
      <svg viewBox="0 0 200 110" className="w-full max-w-[160px]">
        <defs>
          <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#67e8f9" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Background track */}
        <path
          d="M 25 95 A 75 75 0 0 1 175 95"
          fill="none"
          stroke="#1e293b"
          strokeWidth="10"
          strokeLinecap="round"
        />
        
        {/* Speed arc - animated */}
        <motion.path
          d="M 25 95 A 75 75 0 0 1 175 95"
          fill="none"
          stroke="url(#speedGradient)"
          strokeWidth="10"
          strokeLinecap="round"
          filter="url(#glow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: percentage / 100 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{
            strokeDasharray: "236",
            strokeDashoffset: 236 * (1 - percentage / 100)
          }}
        />
        
        {/* Needle */}
        <motion.g
          initial={{ rotate: -90 }}
          animate={{ rotate: angle }}
          transition={{ duration: 1, ease: "easeOut", type: "spring", stiffness: 60 }}
          style={{ transformOrigin: "100px 95px" }}
        >
          <polygon
            points="100,35 96,95 104,95"
            fill="#22d3ee"
            filter="url(#glow)"
          />
        </motion.g>
        
        {/* Center circle */}
        <circle cx="100" cy="95" r="6" fill="#0f172a" stroke="#22d3ee" strokeWidth="2" />
        
        {/* Rate text inside SVG */}
        <text x="100" y="80" textAnchor="middle" className="fill-cyan-400 font-mono font-bold" style={{ fontSize: '18px' }}>
          {rate.toFixed(1)}
        </text>
        <text x="100" y="108" textAnchor="middle" className="fill-cyan-500/70 uppercase" style={{ fontSize: '8px', letterSpacing: '1px' }}>
          PRC/HR
        </text>
      </svg>
    </div>
  );
};

// ============================================
// CIRCULAR TIMER / TAP TO COLLECT COMPONENT
// ============================================
const CircularTimer = ({ 
  sessionPRC, 
  timeRemaining, 
  totalTime = 86400, 
  isMining, 
  onCollect, 
  onStart, 
  isCollecting, 
  isStarting,
  canCollect,
  isFreeUser
}) => {
  const progress = isMining ? ((totalTime - timeRemaining) / totalTime) * 100 : 0;
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer glow ring */}
      <div className={`absolute w-[280px] h-[280px] rounded-full ${isMining ? 'animate-pulse' : ''}`}
        style={{
          background: isMining 
            ? 'radial-gradient(circle, rgba(34,211,238,0.15) 0%, transparent 70%)' 
            : 'radial-gradient(circle, rgba(71,85,105,0.1) 0%, transparent 70%)'
        }}
      />
      
      {/* SVG Circle */}
      <svg width="260" height="260" className="transform -rotate-90">
        <defs>
          <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          <filter id="timerGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Background circle */}
        <circle
          cx="130"
          cy="130"
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth="8"
        />
        
        {/* Progress circle */}
        <motion.circle
          cx="130"
          cy="130"
          r={radius}
          fill="none"
          stroke="url(#timerGradient)"
          strokeWidth="8"
          strokeLinecap="round"
          filter="url(#timerGlow)"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{
            strokeDasharray: circumference,
          }}
        />
        
        {/* Animated dots on the progress */}
        {isMining && (
          <motion.circle
            cx={130 + radius * Math.cos((progress / 100) * 2 * Math.PI - Math.PI / 2)}
            cy={130 + radius * Math.sin((progress / 100) * 2 * Math.PI - Math.PI / 2)}
            r="6"
            fill="#22d3ee"
            filter="url(#timerGlow)"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </svg>
      
      {/* Center content - Tappable */}
      <motion.button
        className="absolute flex flex-col items-center justify-center w-[200px] h-[200px] rounded-full bg-slate-900/80 backdrop-blur-sm border border-cyan-500/30 cursor-pointer"
        onClick={() => {
          triggerHaptic('medium');
          if (isMining && canCollect && !isFreeUser) {
            onCollect();
          } else if (!isMining) {
            onStart();
          }
        }}
        disabled={isCollecting || isStarting || (isMining && isFreeUser)}
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.02 }}
        data-testid="mining-collect-button"
      >
        {isMining ? (
          <>
            {/* Mining active - show PRC earned */}
            <motion.p 
              className="text-4xl font-bold text-cyan-400 font-mono mb-1"
              key={sessionPRC.toFixed(2)}
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 0.3 }}
            >
              {sessionPRC.toFixed(2)}
            </motion.p>
            <p className="text-sm text-cyan-500/70 mb-2">PRC Earned</p>
            <p className="text-xs text-slate-400 font-mono">{formatTime(timeRemaining)}</p>
            
            {/* Tap instruction */}
            {canCollect && !isFreeUser && (
              <motion.p 
                className="text-[10px] text-cyan-400 mt-2 uppercase tracking-wider"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Tap to Collect
              </motion.p>
            )}
            {isFreeUser && (
              <p className="text-[10px] text-amber-400 mt-2">Upgrade to Collect</p>
            )}
          </>
        ) : (
          <>
            {/* Not mining - show start prompt */}
            <Zap className="w-12 h-12 text-cyan-400 mb-2" />
            <p className="text-lg font-semibold text-cyan-400">Start Mining</p>
            <p className="text-xs text-slate-500 mt-1">Tap to begin session</p>
          </>
        )}
        
        {/* Loading states */}
        {(isCollecting || isStarting) && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 rounded-full">
            <motion.div
              className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        )}
      </motion.button>
    </div>
  );
};

// ============================================
// ODOMETER COMPONENT - Compact for mobile
// ============================================
const OdometerDisplay = ({ value, label }) => {
  // Format value with commas for readability, max 2 decimal places
  const formattedValue = value.toLocaleString('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
  
  return (
    <div className="text-center w-full overflow-hidden">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-center justify-center">
        <span className="text-xl font-bold text-cyan-400 font-mono truncate">
          {formattedValue}
        </span>
        <span className="ml-1 text-xs text-cyan-500 font-semibold">PRC</span>
      </div>
    </div>
  );
};

// ============================================
// MAIN FUTURISTIC MINING DASHBOARD
// ============================================
const FuturisticMiningDashboard = ({ user }) => {
  const navigate = useNavigate();
  const { t: globalT } = useLanguage();
  
  // State
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(user);
  const [isMining, setIsMining] = useState(false);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(0);
  const [sessionPRC, setSessionPRC] = useState(0);
  const [miningRate, setMiningRate] = useState(20.83);
  const [isStarting, setIsStarting] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [lifetimeEarnings, setLifetimeEarnings] = useState(0);
  const [baseRate, setBaseRate] = useState(20.83);
  const [referralBreakdown, setReferralBreakdown] = useState(null);
  
  // Refs
  const timerRef = useRef(null);
  const liveCounterRef = useRef(null);
  const sessionEndNotifiedRef = useRef(false);
  
  // Derived state
  const subscriptionPlan = userData?.subscription_plan || user?.subscription_plan || 'explorer';
  const isFreeUser = !subscriptionPlan || subscriptionPlan === 'explorer' || subscriptionPlan === 'free' || subscriptionPlan === '';
  const hasPaidPlan = ['startup', 'growth', 'elite'].includes(subscriptionPlan);
  const canCollect = sessionPRC >= 0.01;

  // Fetch user data and mining status
  const fetchUserData = useCallback(async (isInitialLoad = false) => {
    try {
      const miningResponse = await axios.get(`${API}/mining/status/${user.uid}`, { timeout: 8000 });
      const miningData = miningResponse.data;
      
      const rate = miningData.mining_rate_per_hour || miningData.mining_rate || 20.83;
      setMiningRate(rate);
      setReferralBreakdown(miningData.referral_breakdown || null);
      setBaseRate(miningData.base_rate || 20.83);
      
      if (miningData.session_active && miningData.remaining_hours > 0) {
        const sessionStart = new Date(miningData.session_start).getTime();
        setIsMining(true);
        setSessionTimeRemaining(Math.floor(miningData.remaining_hours * 3600));
        setSessionStartTime(sessionStart);
        setSessionPRC(miningData.mined_this_session || 0);
      } else if (miningData.session_active === false) {
        setIsMining(false);
        setSessionTimeRemaining(0);
      }
      
      if (isInitialLoad) setLoading(false);
      
      const [userResponse, statsResponse] = await Promise.all([
        axios.get(`${API}/user/${user.uid}`, { timeout: 8000 }),
        axios.get(`${API}/user/${user.uid}/redemption-stats`, { timeout: 8000 }).catch(() => ({ data: {} }))
      ]);
      
      setUserData(userResponse.data);
      setLifetimeEarnings(statsResponse.data.total_earned || 0);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserData(user);
      if (isInitialLoad) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.uid) {
      fetchUserData(true);
    }
    
    const refreshInterval = setInterval(() => {
      if (user?.uid) fetchUserData(false);
    }, 30000);
    
    return () => {
      clearInterval(refreshInterval);
      if (timerRef.current) clearInterval(timerRef.current);
      if (liveCounterRef.current) clearInterval(liveCounterRef.current);
    };
  }, [user, fetchUserData]);

  // Timer effect
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (liveCounterRef.current) clearInterval(liveCounterRef.current);
    
    if (isMining && sessionTimeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setSessionTimeRemaining(prev => {
          if (prev <= 5) {
            setIsMining(false);
            smartToast.success('Session complete! Collect your rewards.');
            if (!sessionEndNotifiedRef.current) {
              triggerHaptic('success');
              sessionEndNotifiedRef.current = true;
            }
            clearInterval(timerRef.current);
            if (liveCounterRef.current) clearInterval(liveCounterRef.current);
            return 0;
          }
          return prev - 5;
        });
      }, 5000);
      
      liveCounterRef.current = setInterval(() => {
        const prcPer100ms = miningRate / 36000;
        setSessionPRC(prev => Math.max(0, prev + prcPer100ms));
      }, 100);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (liveCounterRef.current) clearInterval(liveCounterRef.current);
    };
  }, [isMining, miningRate]);

  const startSession = async () => {
    triggerHaptic('medium');
    setIsStarting(true);
    try {
      const response = await axios.post(`${API}/mining/start/${user.uid}`);
      if (response.data) {
        setIsMining(true);
        setSessionTimeRemaining(24 * 60 * 60);
        setSessionPRC(0);
        setSessionStartTime(Date.now());
        triggerHaptic('success');
        smartToast.success('Session started! Earning PRC...');
        sessionEndNotifiedRef.current = false;
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
      return;
    }
    
    triggerHaptic('medium');
    setIsCollecting(true);
    
    try {
      const response = await axios.post(`${API}/mining/claim/${user.uid}`);
      const data = response.data;
      const claimed = data.claimed_amount || data.prc_collected || sessionPRC;
      
      triggerHaptic('success');
      smartToast.success(`Collected ${claimed.toFixed(2)} PRC!`);
      setSessionPRC(0);
      sessionEndNotifiedRef.current = false;
      
      if (data.session_reset) {
        const newStartTime = new Date(data.new_session_start).getTime();
        setSessionStartTime(newStartTime);
        setSessionTimeRemaining(Math.floor(data.remaining_hours * 3600));
        setIsMining(true);
      } else {
        setSessionStartTime(Date.now());
      }
      
      if (data.new_balance && userData) {
        setUserData(prev => ({
          ...prev,
          prc_balance: data.new_balance,
          total_mined: data.total_mined || prev.total_mined
        }));
      }
      
      setTimeout(() => fetchUserData(), 1000);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to collect rewards';
      smartToast.error(errorMsg);
    } finally {
      setIsCollecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <motion.div
          className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-24 overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px]" />
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(34,211,238,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.3) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}
        />
      </div>
      
      {/* Header */}
      <div className="relative z-10 px-5 pb-4 pt-16" style={{ paddingTop: 'max(4rem, calc(env(safe-area-inset-top, 0px) + 3rem))' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                triggerHaptic('light');
                navigate('/dashboard');
              }}
              className="w-10 h-10 rounded-full bg-slate-900/80 border border-slate-700 flex items-center justify-center hover:bg-slate-800 transition-colors backdrop-blur-sm"
              data-testid="back-button"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <h1 className="text-slate-100 text-xl font-semibold tracking-tight">Mining Station</h1>
              <p className="text-slate-500 text-sm">Earn PRC rewards</p>
            </div>
          </div>
          
          {hasPaidPlan && (
            <div className="px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 backdrop-blur-sm">
              <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                <Crown className="w-3 h-3" /> VIP
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Main Dashboard Content */}
      <div className="relative z-10 px-5">
        {/* Circular Timer - Main Element */}
        <div className="flex justify-center mb-6">
          <CircularTimer
            sessionPRC={sessionPRC}
            timeRemaining={sessionTimeRemaining}
            isMining={isMining}
            onCollect={collectRewards}
            onStart={startSession}
            isCollecting={isCollecting}
            isStarting={isStarting}
            canCollect={canCollect}
            isFreeUser={isFreeUser}
          />
        </div>
        
        {/* Speed and Total - Side by Side */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Speed Gauge */}
          <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-2xl p-3 flex flex-col items-center justify-center overflow-hidden">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Mining Speed</p>
            <SpeedometerGauge rate={miningRate} maxRate={250} />
          </div>
          
          {/* Total Mined - Simple display */}
          <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-2xl p-3 flex flex-col items-center justify-center overflow-hidden">
            <OdometerDisplay value={lifetimeEarnings} label="Total Mined" />
          </div>
        </div>
        
        {/* Balance Card */}
        <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 mb-1">Current Balance</p>
              <p className="text-xl font-bold text-slate-100 font-mono truncate">
                {(userData?.prc_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-cyan-400 text-sm">PRC</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 ml-3">
              <Zap className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
        </div>
        
        {/* Free User Upgrade Prompt */}
        {isFreeUser && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-amber-900/30 to-orange-900/20 rounded-2xl p-4 border border-amber-500/30 mb-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <Crown className="w-6 h-6 text-amber-400" />
              <div>
                <p className="text-amber-400 font-semibold text-sm">Upgrade to Collect PRC!</p>
                <p className="text-gray-400 text-xs">Plan upgrade करा आणि PRC collect करा</p>
              </div>
            </div>
            <Button 
              onClick={() => navigate('/subscription')}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold py-3 rounded-xl"
              data-testid="upgrade-button"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade Now
            </Button>
          </motion.div>
        )}
        
        {/* Mining Speed Breakdown */}
        <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-2xl p-4">
          <h2 className="text-slate-100 font-semibold text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            Speed Breakdown
          </h2>
          
          <div className="space-y-3">
            {/* Base Rate */}
            <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center">
                  <Zap className="w-3 h-3 text-emerald-400" />
                </div>
                <span className="text-slate-300 text-sm">Base Rate</span>
              </div>
              <span className="text-emerald-400 font-mono text-sm">{baseRate.toFixed(2)}</span>
            </div>
            
            {/* Level 1 */}
            <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center text-blue-400 text-[10px] font-bold">L1</div>
                <span className="text-slate-300 text-sm">Direct ({referralBreakdown?.level_1?.active_count || 0})</span>
              </div>
              <span className={`font-mono text-sm ${(referralBreakdown?.level_1?.bonus || 0) > 0 ? 'text-blue-400' : 'text-slate-600'}`}>
                +{(referralBreakdown?.level_1?.bonus || 0).toFixed(2)}
              </span>
            </div>
            
            {/* Level 2 */}
            <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center text-purple-400 text-[10px] font-bold">L2</div>
                <span className="text-slate-300 text-sm">Level 2 ({referralBreakdown?.level_2?.active_count || 0})</span>
              </div>
              <span className={`font-mono text-sm ${(referralBreakdown?.level_2?.bonus || 0) > 0 ? 'text-purple-400' : 'text-slate-600'}`}>
                +{(referralBreakdown?.level_2?.bonus || 0).toFixed(2)}
              </span>
            </div>
            
            {/* Level 3 */}
            <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-orange-500/20 flex items-center justify-center text-orange-400 text-[10px] font-bold">L3</div>
                <span className="text-slate-300 text-sm">Level 3 ({referralBreakdown?.level_3?.active_count || 0})</span>
              </div>
              <span className={`font-mono text-sm ${(referralBreakdown?.level_3?.bonus || 0) > 0 ? 'text-orange-400' : 'text-slate-600'}`}>
                +{(referralBreakdown?.level_3?.bonus || 0).toFixed(2)}
              </span>
            </div>
            
            {/* Total */}
            <div className="flex items-center justify-between pt-2 mt-1 border-t-2 border-cyan-500/30">
              <span className="text-cyan-400 text-sm font-bold">TOTAL SPEED</span>
              <span className="text-cyan-400 font-mono text-lg font-bold">{miningRate.toFixed(2)} PRC/hr</span>
            </div>
          </div>
          
          {/* Info */}
          <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
            <p className="text-cyan-300 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Bonus is calculated from active PAID users only.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FuturisticMiningDashboard;
