import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Coins, Play, Clock, Star, Crown, ArrowLeft, Zap, Gift, TrendingUp, CheckCircle, Pause } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL;

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
  
  const timerRef = useRef(null);
  
  // Get global translation function
  const { t: globalT } = useLanguage();

  // Fetch user data and mining status
  const fetchUserData = useCallback(async () => {
    // Set a timeout to prevent infinite loading on slow networks
    const timeoutId = setTimeout(() => {
      setLoading(false);
      setUserData(user);
      console.warn('Mining data fetch timeout - using fallback');
    }, 10000); // 10 second timeout
    
    try {
      // Fetch both user data and mining status in parallel
      const [userResponse, miningResponse] = await Promise.all([
        axios.get(`${API}/api/user/${user.uid}`),
        axios.get(`${API}/api/mining/status/${user.uid}`)
      ]);
      
      const data = userResponse.data;
      const miningData = miningResponse.data;
      
      setUserData(data);
      // Use the actual mining rate from backend (per hour)
      setMiningRate(miningData.mining_rate_per_hour || miningData.mining_rate || 1.0);
      
      // Check mining session status
      if (miningData.session_active && miningData.remaining_hours > 0) {
        setIsMining(true);
        setSessionTimeRemaining(Math.floor(miningData.remaining_hours * 3600));
        setSessionStartTime(new Date(miningData.session_start).getTime());
        
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
          setSessionPRC(miningData.mined_this_session || 0);
        } else {
          setIsMining(false);
          setSessionTimeRemaining(0);
        }
      } else {
        setIsMining(false);
        setSessionTimeRemaining(0);
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
    };
  }, [user, fetchUserData]);

  // Timer effect - separate from data fetch
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (isMining && sessionTimeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setSessionTimeRemaining(prev => {
          if (prev <= 1) {
            setIsMining(false);
            toast.success('Session complete! Collect your rewards.');
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
        
        // Accumulate PRC
        const prcPerSecond = miningRate / 3600;
        setSessionPRC(prev => prev + prcPerSecond);
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isMining, miningRate]);

  const startSession = async () => {
    setIsStarting(true);
    try {
      const response = await axios.post(`${API}/api/mining/start/${user.uid}`);
      if (response.data) {
        setIsMining(true);
        setSessionTimeRemaining(24 * 60 * 60); // 24 hours
        setSessionPRC(0);
        setSessionStartTime(Date.now());
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
      
      if (luxurySaved > 0) {
        toast.success(`🎉 Collected ${claimed.toFixed(2)} PRC! (₹${luxurySaved.toFixed(2)} saved for Luxury Life)`);
      } else {
        toast.success(`🎉 Collected ${claimed.toFixed(2)} PRC!`);
      }
      
      // Reset local session PRC but keep mining
      setSessionPRC(0);
      setSessionStartTime(Date.now());
      
      // Refresh user data to update balance
      fetchUserData();
      
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
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
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
      {/* Header - with safe area padding */}
      <div className="px-5 pb-4 pt-20" style={{ paddingTop: 'max(5rem, calc(env(safe-area-inset-top, 0px) + 4rem))' }}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">{globalT('dailyRewards')}</h1>
            <p className="text-gray-400 text-sm">{globalT('collectRewards')}</p>
          </div>
        </div>
      </div>

      {/* Main Rewards Card */}
      <div className="px-5 mb-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-6"
          style={{
            background: isMining 
              ? 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)'
              : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}
        >
          {/* Glow effect when active */}
          {isMining && (
            <div className="absolute inset-0 opacity-20">
              <motion.div 
                className="absolute top-0 right-0 w-64 h-64 bg-emerald-400 rounded-full blur-3xl"
                animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <motion.div 
                className="absolute bottom-0 left-0 w-48 h-48 bg-green-400 rounded-full blur-3xl"
                animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.3, 0.2] }}
                transition={{ duration: 4, repeat: Infinity }}
              />
            </div>
          )}

          <div className="relative z-10">
            {/* Status Badge */}
            <div className="flex items-center justify-between mb-6">
              <div className={`px-4 py-2 rounded-full ${isMining ? 'bg-emerald-500/30' : 'bg-gray-700/50'}`}>
                <span className={`text-sm font-semibold flex items-center gap-2 ${isMining ? 'text-emerald-400' : 'text-gray-400'}`}>
                  {isMining ? (
                    <>
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
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
                <div className={`px-3 py-1 rounded-full ${
                  subscriptionPlan === 'elite' ? 'bg-gradient-to-r from-amber-500 to-yellow-500' :
                  subscriptionPlan === 'growth' ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
                  'bg-gradient-to-r from-blue-500 to-cyan-500'
                }`}>
                  <span className="text-xs font-bold text-black flex items-center gap-1">
                    <Crown className="w-3 h-3" /> {getMultiplierDisplay(subscriptionPlan)} BONUS
                  </span>
                </div>
              )}
            </div>

            {/* Timer or Start Button */}
            {isMining ? (
              <div className="text-center mb-6">
                <p className="text-gray-400 text-sm mb-2">{globalT('timeRemaining')}</p>
                <div className="text-5xl font-bold text-white font-mono tracking-wider">
                  {formatTime(sessionTimeRemaining)}
                </div>
                
                {/* Earned PRC Display */}
                <div className="mt-4 bg-black/30 rounded-2xl p-4">
                  <p className="text-gray-400 text-xs mb-1">{globalT('sessionEarnings')}</p>
                  <div className="flex items-center justify-center gap-2">
                    <Coins className="w-6 h-6 text-amber-400" />
                    <span className="text-3xl font-bold text-amber-400">
                      {sessionPRC.toFixed(4)}
                    </span>
                    <span className="text-amber-400 text-lg">PRC</span>
                  </div>
                </div>
                
                {/* Collect Button */}
                <Button 
                  onClick={collectRewards}
                  disabled={!canCollect || isCollecting}
                  className={`mt-4 w-full py-4 rounded-2xl font-bold text-lg transition-all ${
                    canCollect
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black shadow-lg shadow-amber-500/30'
                      : 'bg-gray-700 text-gray-400'
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
                  className="w-28 h-28 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Star className="w-14 h-14 text-black" />
                </motion.div>
                <p className="text-gray-400 mb-4">{globalT('startEarning')}</p>
                <Button 
                  onClick={startSession}
                  disabled={isStarting}
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-bold py-4 rounded-2xl text-lg shadow-lg shadow-amber-500/30"
                >
                  {isStarting ? (
                    <span className="flex items-center gap-2 justify-center">
                      <motion.div 
                        className="w-5 h-5 border-2 border-black border-t-transparent rounded-full"
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

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-black/20 rounded-2xl p-4 text-center">
                <p className="text-gray-400 text-xs mb-1">{globalT('currentBalance')}</p>
                <p className="text-2xl font-bold text-white">{(userData?.prc_balance || 0).toFixed(2)}</p>
                <p className="text-amber-400 text-sm">PRC</p>
              </div>
              <div className="bg-black/20 rounded-2xl p-4 text-center">
                <p className="text-gray-400 text-xs mb-1">{globalT('rewardRate')}</p>
                <p className="text-2xl font-bold text-white">{miningRate.toFixed(1)}</p>
                <p className="text-emerald-400 text-sm">{globalT('perHour')}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Free User Warning */}
      {!hasPaidPlan && (
        <div className="px-5 mb-6">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <p className="text-amber-500 font-medium text-sm">{globalT('freeUserWarning')}</p>
                <button 
                  onClick={() => navigate('/subscription')}
                  className="text-amber-400 text-xs mt-1 underline"
                >
                  {globalT('upgradeToVip')} →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="px-5 mb-6">
        <h2 className="text-white font-bold text-lg mb-4">{globalT('yourStats')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4"
          >
            <TrendingUp className="w-8 h-8 text-emerald-500 mb-2" />
            <p className="text-gray-400 text-xs">{globalT('totalEarned')}</p>
            <p className="text-xl font-bold text-white">{((userData?.total_mined || 0) + sessionPRC).toFixed(2)}</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4"
          >
            <Gift className="w-8 h-8 text-purple-500 mb-2" />
            <p className="text-gray-400 text-xs">{globalT('referralWeight')}</p>
            <p className="text-xl font-bold text-white">+{Math.min((userData?.referral_count || 0) * 10, 100)}%</p>
          </motion.div>
        </div>
      </div>

      {/* How It Works */}
      <div className="px-5">
        <h2 className="text-white font-bold text-lg mb-4">{globalT('howToPlay')}</h2>
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 space-y-4">
          {[
            { icon: Play, text: globalT('startSession'), color: 'text-emerald-500' },
            { icon: Coins, text: globalT('collectRewards'), color: 'text-amber-500' },
            { icon: CheckCircle, text: globalT('rewardRate'), color: 'text-blue-500' },
            { icon: Star, text: globalT('referralWeight') + ' +10%', color: 'text-purple-500' },
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <p className="text-gray-300 text-sm">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DailyRewards;
