import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Zap, Users, TrendingUp, Bell, Send, Download, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import smartToast from '@/utils/smartToast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Haptic feedback
const triggerHaptic = (type = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = { light: [10], medium: [20], success: [10, 50, 10, 50, 30] };
    navigator.vibrate(patterns[type] || patterns.light);
  }
};

// ============================================
// CLASSIC SPEEDOMETER GAUGE (GREEN-YELLOW-RED)
// ============================================
const ClassicSpeedometer = ({ rate, maxRate = 100 }) => {
  const percentage = Math.min((rate / maxRate) * 100, 100);
  const needleAngle = -135 + (percentage / 100) * 270; // -135 to 135 degrees

  return (
    <div className="relative w-full flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-full max-w-[180px]">
        <defs>
          {/* Gradient for the gauge arc */}
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="40%" stopColor="#eab308" />
            <stop offset="70%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <filter id="glow2">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Background arc */}
        <path
          d="M 20 100 A 80 80 0 1 1 180 100"
          fill="none"
          stroke="#1e293b"
          strokeWidth="14"
          strokeLinecap="round"
        />
        
        {/* Colored gauge arc */}
        <path
          d="M 20 100 A 80 80 0 1 1 180 100"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="14"
          strokeLinecap="round"
          filter="url(#glow2)"
        />
        
        {/* Labels */}
        <text x="35" y="85" fill="#64748b" fontSize="10" fontWeight="bold">LOW</text>
        <text x="90" y="30" fill="#64748b" fontSize="10" fontWeight="bold">MID</text>
        <text x="150" y="85" fill="#64748b" fontSize="10" fontWeight="bold">HIGH</text>
        
        {/* Needle */}
        <g transform={`rotate(${needleAngle}, 100, 100)`}>
          <polygon
            points="100,25 96,100 104,100"
            fill="#f97316"
            filter="url(#glow2)"
          />
          <circle cx="100" cy="100" r="8" fill="#1e293b" stroke="#f97316" strokeWidth="2" />
        </g>
      </svg>
      
      {/* Rate display */}
      <div className="text-center -mt-2">
        <p className="text-2xl font-bold text-white font-mono">{rate.toFixed(2)} <span className="text-sm text-blue-400">PRC/hr</span></p>
        <div className="flex items-center justify-center gap-1 mt-1">
          <Zap className="w-3 h-3 text-yellow-400" />
          <span className="text-xs text-yellow-400 font-semibold">Referral Boost</span>
        </div>
      </div>
    </div>
  );
};

// ============================================
// FUTURISTIC CIRCULAR TIMER
// ============================================
const FuturisticTimer = ({ timeRemaining, sessionPRC, isMining, onTap, isLoading }) => {
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = isMining ? ((86400 - timeRemaining) / 86400) * 100 : 0;

  return (
    <motion.div 
      className="relative flex items-center justify-center cursor-pointer"
      onClick={onTap}
      whileTap={{ scale: 0.95 }}
      data-testid="mining-timer-button"
    >
      {/* Outer glow rings */}
      <div className="absolute w-[160px] h-[160px] rounded-full border-2 border-blue-500/20" />
      <div className="absolute w-[150px] h-[150px] rounded-full border border-blue-400/30" />
      
      {/* Main circular progress */}
      <svg width="140" height="140" className="transform -rotate-90">
        <defs>
          <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <filter id="timerGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Background circle */}
        <circle cx="70" cy="70" r="60" fill="none" stroke="#1e293b" strokeWidth="6" />
        
        {/* Progress arc */}
        <circle
          cx="70"
          cy="70"
          r="60"
          fill="none"
          stroke="url(#timerGrad)"
          strokeWidth="6"
          strokeLinecap="round"
          filter="url(#timerGlow)"
          strokeDasharray={`${progress * 3.77} 377`}
        />
        
        {/* Inner decorative circles */}
        <circle cx="70" cy="70" r="50" fill="none" stroke="#1e3a5f" strokeWidth="1" />
        <circle cx="70" cy="70" r="40" fill="none" stroke="#1e3a5f" strokeWidth="1" strokeDasharray="4 4" />
      </svg>
      
      {/* Center content */}
      <div className="absolute flex flex-col items-center justify-center">
        {isLoading ? (
          <motion.div
            className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        ) : isMining ? (
          <>
            <p className="text-3xl font-bold text-white font-mono tracking-wider">
              {formatTime(timeRemaining)}
            </p>
            <p className="text-xs text-blue-400 mt-1">+{sessionPRC.toFixed(2)} PRC</p>
          </>
        ) : (
          <>
            <Zap className="w-8 h-8 text-blue-400 mb-1" />
            <p className="text-xs text-blue-400">TAP TO START</p>
          </>
        )}
      </div>
      
      {/* Animated dot on progress */}
      {isMining && (
        <motion.div
          className="absolute w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_10px_#22d3ee]"
          style={{
            top: 70 - 60 * Math.cos((progress / 100) * Math.PI * 2 - Math.PI / 2),
            left: 70 + 60 * Math.sin((progress / 100) * Math.PI * 2 - Math.PI / 2),
          }}
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
};

// ============================================
// ODOMETER DISPLAY
// ============================================
const OdometerDisplay = ({ value }) => {
  const formatted = Math.floor(value).toString().padStart(6, '0');
  const colors = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6'];
  
  return (
    <div className="flex items-center gap-1">
      {formatted.split('').map((digit, i) => (
        <motion.div
          key={i}
          className="w-7 h-9 rounded flex items-center justify-center text-white font-mono font-bold text-lg"
          style={{ backgroundColor: colors[i % colors.length] + '33', border: `1px solid ${colors[i % colors.length]}` }}
          initial={{ y: -5, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: i * 0.05 }}
        >
          {digit}
        </motion.div>
      ))}
    </div>
  );
};

// ============================================
// MINI BAR CHART
// ============================================
const MiniBarChart = () => {
  const bars = [40, 60, 30, 80, 50, 70, 45, 90, 55, 65];
  return (
    <div className="flex items-end gap-[2px] h-10">
      {bars.map((height, i) => (
        <motion.div
          key={i}
          className="w-1.5 bg-blue-500/60 rounded-t"
          initial={{ height: 0 }}
          animate={{ height: `${height}%` }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
        />
      ))}
    </div>
  );
};

// ============================================
// MAIN DASHBOARD
// ============================================
const FuturisticMiningDashboard = ({ user }) => {
  const navigate = useNavigate();
  const { t: globalT } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(user);
  const [isMining, setIsMining] = useState(false);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(0);
  const [sessionPRC, setSessionPRC] = useState(0);
  const [miningRate, setMiningRate] = useState(20.83);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lifetimeEarnings, setLifetimeEarnings] = useState(0);
  const [referralBreakdown, setReferralBreakdown] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  
  const timerRef = useRef(null);
  const liveCounterRef = useRef(null);

  const subscriptionPlan = userData?.subscription_plan || user?.subscription_plan || 'explorer';
  const isFreeUser = !subscriptionPlan || subscriptionPlan === 'explorer' || subscriptionPlan === 'free';
  const activeReferrals = (referralBreakdown?.level_1?.active_count || 0) + 
                          (referralBreakdown?.level_2?.active_count || 0) + 
                          (referralBreakdown?.level_3?.active_count || 0);
  const referralBoost = (referralBreakdown?.level_1?.bonus || 0) + 
                        (referralBreakdown?.level_2?.bonus || 0) + 
                        (referralBreakdown?.level_3?.bonus || 0);

  const fetchUserData = useCallback(async (isInitialLoad = false) => {
    try {
      const miningResponse = await axios.get(`${API}/mining/status/${user.uid}`, { timeout: 8000 });
      const miningData = miningResponse.data;
      
      setMiningRate(miningData.mining_rate_per_hour || miningData.mining_rate || 20.83);
      setReferralBreakdown(miningData.referral_breakdown || null);
      
      if (miningData.session_active && miningData.remaining_hours > 0) {
        setIsMining(true);
        setSessionTimeRemaining(Math.floor(miningData.remaining_hours * 3600));
        setSessionPRC(miningData.mined_this_session || 0);
      } else {
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
      
      // Mock recent activity
      setRecentActivity([
        { type: 'Referral Bonus', amount: 5.00, time: '2h ago' },
        { type: 'Mining Reward', amount: miningData.mining_rate_per_hour || 4.55, time: '2h ago' },
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      if (isInitialLoad) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.uid) fetchUserData(true);
    const interval = setInterval(() => user?.uid && fetchUserData(false), 30000);
    return () => {
      clearInterval(interval);
      if (timerRef.current) clearInterval(timerRef.current);
      if (liveCounterRef.current) clearInterval(liveCounterRef.current);
    };
  }, [user, fetchUserData]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (liveCounterRef.current) clearInterval(liveCounterRef.current);
    
    if (isMining && sessionTimeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setSessionTimeRemaining(prev => {
          if (prev <= 1) {
            setIsMining(false);
            smartToast.success('Session complete!');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      liveCounterRef.current = setInterval(() => {
        setSessionPRC(prev => prev + miningRate / 36000);
      }, 100);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (liveCounterRef.current) clearInterval(liveCounterRef.current);
    };
  }, [isMining, miningRate]);

  const handleTimerTap = async () => {
    triggerHaptic('medium');
    setIsProcessing(true);
    
    try {
      if (!isMining) {
        // Start mining
        await axios.post(`${API}/mining/start/${user.uid}`);
        setIsMining(true);
        setSessionTimeRemaining(86400);
        setSessionPRC(0);
        triggerHaptic('success');
        smartToast.success('Mining started!');
      } else if (sessionPRC >= 0.01 && !isFreeUser) {
        // Collect rewards
        const response = await axios.post(`${API}/mining/claim/${user.uid}`);
        const claimed = response.data.claimed_amount || sessionPRC;
        triggerHaptic('success');
        smartToast.success(`Collected ${claimed.toFixed(2)} PRC!`);
        setSessionPRC(0);
        if (response.data.session_reset) {
          setSessionTimeRemaining(Math.floor(response.data.remaining_hours * 3600));
        }
        fetchUserData();
      }
    } catch (error) {
      smartToast.error(error.response?.data?.detail || 'Action failed');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <motion.div
          className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1628] pb-24">
      {/* Header */}
      <div className="px-4 pt-12 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/dashboard')}
              className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center"
              data-testid="back-button"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <span className="text-white font-semibold text-lg">Paras <span className="text-blue-400">Reward</span></span>
            </div>
          </div>
          <button className="relative">
            <Bell className="w-5 h-5 text-slate-400" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </div>
      </div>

      {/* Balance Section */}
      <div className="px-4 mb-4">
        <div className="bg-slate-800/30 rounded-2xl p-4 border border-slate-700/50">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-3xl font-bold text-white font-mono">
                {(userData?.prc_balance || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} <span className="text-blue-400 text-lg">PRC</span>
              </p>
              <p className="text-slate-400 text-sm">₹{((userData?.prc_balance || 0) / 10).toLocaleString('en-IN', { maximumFractionDigits: 2 })} INR</p>
            </div>
            <MiniBarChart />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button className="bg-slate-700/50 hover:bg-slate-700 rounded-xl py-2.5 flex items-center justify-center gap-2 transition-colors">
              <Send className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-medium">Send</span>
            </button>
            <button 
              onClick={() => navigate('/prc-to-bank')}
              className="bg-slate-700/50 hover:bg-slate-700 rounded-xl py-2.5 flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-medium">Receive</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mining Speed & Session */}
      <div className="px-4 mb-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Mining Speed */}
          <div className="bg-slate-800/30 rounded-2xl p-3 border border-slate-700/50">
            <div className="flex items-center gap-1 mb-2">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
              <p className="text-slate-400 text-xs font-medium">Mining Speed</p>
              <div className="flex-1 border-t border-dashed border-slate-600 mx-1" />
            </div>
            <ClassicSpeedometer rate={miningRate} maxRate={100} />
          </div>
          
          {/* Mining Session */}
          <div className="bg-slate-800/30 rounded-2xl p-3 border border-slate-700/50">
            <div className="flex items-center gap-1 mb-2">
              <div className="flex gap-0.5">
                {[1,2,3].map(i => <div key={i} className="w-1 h-1 bg-blue-400 rounded-full" />)}
              </div>
              <p className="text-slate-400 text-xs font-medium">Mining Session</p>
              <div className="flex-1 border-t border-dashed border-slate-600 mx-1" />
            </div>
            <div className="flex justify-center">
              <FuturisticTimer
                timeRemaining={sessionTimeRemaining}
                sessionPRC={sessionPRC}
                isMining={isMining}
                onTap={handleTimerTap}
                isLoading={isProcessing}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Referral & Total Mined */}
      <div className="px-4 mb-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Referral Boost */}
          <div className="bg-slate-800/30 rounded-2xl p-3 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-3 h-3 text-yellow-400" />
              </div>
              <span className="text-slate-300 text-sm font-medium">Referral Boost</span>
              <span className="text-yellow-400 font-bold">+{referralBoost.toFixed(0)}</span>
            </div>
            <p className="text-emerald-400 text-sm font-semibold">+{activeReferrals} Active Referrals</p>
          </div>
          
          {/* Total PRC Mined */}
          <div className="bg-slate-800/30 rounded-2xl p-3 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-3 h-3 text-blue-400" />
              </div>
              <span className="text-slate-300 text-sm font-medium">Total PRC Mined</span>
            </div>
            <OdometerDisplay value={lifetimeEarnings} />
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-4">
        <div className="bg-slate-800/30 rounded-2xl p-4 border border-slate-700/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">Recent Activity</h3>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
          <div className="space-y-3">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                    <Users className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{item.type}</p>
                    <p className="text-slate-500 text-xs">{item.time}</p>
                  </div>
                </div>
                <p className="text-emerald-400 font-semibold">+{item.amount.toFixed(2)} PRC</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Free User Upgrade */}
      {isFreeUser && (
        <div className="px-4 mt-4">
          <div className="bg-gradient-to-r from-amber-900/30 to-orange-900/20 rounded-2xl p-4 border border-amber-500/30">
            <p className="text-amber-400 font-semibold mb-2">Upgrade to Collect PRC!</p>
            <Button 
              onClick={() => navigate('/subscription')}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold"
              data-testid="upgrade-button"
            >
              Upgrade Now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FuturisticMiningDashboard;
