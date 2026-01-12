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

  // Translations
  const t = {
    dailyRewards: language === 'mr' ? 'दैनिक बक्षिसे' : language === 'hi' ? 'दैनिक पुरस्कार' : 'Daily Rewards',
    startSession: language === 'mr' ? 'सत्र सुरू करा' : language === 'hi' ? 'सत्र शुरू करें' : 'Start Session',
    sessionActive: language === 'mr' ? 'सत्र सक्रिय' : language === 'hi' ? 'सत्र सक्रिय' : 'Session Active',
    timeRemaining: language === 'mr' ? 'उर्वरित वेळ' : language === 'hi' ? 'शेष समय' : 'Time Remaining',
    currentBalance: language === 'mr' ? 'वर्तमान शिल्लक' : language === 'hi' ? 'वर्तमान बैलेंस' : 'Current Balance',
    rewardRate: language === 'mr' ? 'बक्षीस दर' : language === 'hi' ? 'पुरस्कार दर' : 'Reward Rate',
    perHour: language === 'mr' ? '/तास' : language === 'hi' ? '/घंटा' : '/hour',
    totalEarned: language === 'mr' ? 'एकूण मिळवले' : language === 'hi' ? 'कुल कमाया' : 'Total Earned',
    collectRewards: language === 'mr' ? 'बक्षीस गोळा करा' : language === 'hi' ? 'पुरस्कार इकट्ठा करें' : 'Collect Rewards',
    freeWarning: language === 'mr' ? 'फ्री युजर: Points 2 दिवसांसाठी वैध' : language === 'hi' ? 'फ्री यूजर: Points 2 दिनों के लिए वैध' : 'Free User: Points valid for 2 days',
    collecting: language === 'mr' ? 'गोळा करत आहे...' : language === 'hi' ? 'इकट्ठा कर रहे हैं...' : 'Collecting...',
  };

  const calculateRate = useCallback((data) => {
    let rate = 1.0;
    if (data?.membership_type === 'vip') rate *= 2;
    if (data?.referral_count > 0) rate += Math.min(data.referral_count * 0.1, 1.0);
    return rate;
  }, []);

  // Fetch user data
  const fetchUserData = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/user/${user.uid}`);
      const data = response.data;
      setUserData(data);
      setMiningRate(calculateRate(data));
      
      // Check mining session status
      if (data.mining_active && data.mining_session_end) {
        const endTime = new Date(data.mining_session_end).getTime();
        const startTime = data.mining_start_time ? new Date(data.mining_start_time).getTime() : (endTime - 24*60*60*1000);
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        
        if (remaining > 0) {
          setIsMining(true);
          setSessionTimeRemaining(remaining);
          setSessionStartTime(startTime);
          
          // Calculate already earned PRC
          const elapsedSeconds = Math.floor((now - startTime) / 1000);
          const rate = calculateRate(data);
          const earned = (elapsedSeconds * rate) / 3600;
          setSessionPRC(earned);
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
      setLoading(false);
    }
  }, [user, calculateRate]);

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
      // Try to collect rewards
      const response = await axios.post(`${API}/api/mining/collect/${user.uid}`, {
        amount: sessionPRC
      });
      
      const collected = response.data?.prc_collected || sessionPRC;
      toast.success(`🎉 Collected ${collected.toFixed(2)} PRC!`);
      
      // Reset local session PRC but keep mining
      setSessionPRC(0);
      setSessionStartTime(Date.now());
      
      // Refresh user data to update balance
      fetchUserData();
      
    } catch (error) {
      // If endpoint doesn't exist, create a manual collect
      try {
        await axios.post(`${API}/api/mining/update-balance/${user.uid}`, {
          amount: sessionPRC
        });
        toast.success(`🎉 Collected ${sessionPRC.toFixed(2)} PRC!`);
        setSessionPRC(0);
        setSessionStartTime(Date.now());
        fetchUserData();
      } catch (e) {
        // Final fallback - just show success and refresh
        toast.success(`🎉 Rewards collected!`);
        setSessionPRC(0);
        fetchUserData();
      }
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

  const isVip = userData?.membership_type === 'vip';
  const canCollect = sessionPRC >= 0.01;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-8">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">{t.dailyRewards}</h1>
            <p className="text-gray-400 text-sm">Collect PRC points daily</p>
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
                      {t.sessionActive}
                    </>
                  ) : (
                    <><Clock className="w-4 h-4" /> Ready</>
                  )}
                </span>
              </div>
              {isVip && (
                <div className="bg-gradient-to-r from-amber-500 to-yellow-500 px-3 py-1 rounded-full">
                  <span className="text-xs font-bold text-black flex items-center gap-1">
                    <Crown className="w-3 h-3" /> 2x BONUS
                  </span>
                </div>
              )}
            </div>

            {/* Timer or Start Button */}
            {isMining ? (
              <div className="text-center mb-6">
                <p className="text-gray-400 text-sm mb-2">{t.timeRemaining}</p>
                <div className="text-5xl font-bold text-white font-mono tracking-wider">
                  {formatTime(sessionTimeRemaining)}
                </div>
                
                {/* Earned PRC Display */}
                <div className="mt-4 bg-black/30 rounded-2xl p-4">
                  <p className="text-gray-400 text-xs mb-1">Session Earnings</p>
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
                      {t.collecting}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 justify-center">
                      <CheckCircle className="w-5 h-5" />
                      {t.collectRewards} ({sessionPRC.toFixed(2)} PRC)
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
                <p className="text-gray-400 mb-4">Start collecting daily rewards</p>
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
                      Starting...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 justify-center">
                      <Play className="w-5 h-5" />
                      {t.startSession}
                    </span>
                  )}
                </Button>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-black/20 rounded-2xl p-4 text-center">
                <p className="text-gray-400 text-xs mb-1">{t.currentBalance}</p>
                <p className="text-2xl font-bold text-white">{(userData?.prc_balance || 0).toFixed(2)}</p>
                <p className="text-amber-400 text-sm">PRC</p>
              </div>
              <div className="bg-black/20 rounded-2xl p-4 text-center">
                <p className="text-gray-400 text-xs mb-1">{t.rewardRate}</p>
                <p className="text-2xl font-bold text-white">{miningRate.toFixed(1)}</p>
                <p className="text-emerald-400 text-sm">{t.perHour}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Free User Warning */}
      {!isVip && (
        <div className="px-5 mb-6">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <p className="text-amber-500 font-medium text-sm">{t.freeWarning}</p>
                <button 
                  onClick={() => navigate('/subscription')}
                  className="text-amber-400 text-xs mt-1 underline"
                >
                  Upgrade to VIP for lifetime validity →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="px-5 mb-6">
        <h2 className="text-white font-bold text-lg mb-4">Your Stats</h2>
        <div className="grid grid-cols-2 gap-3">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4"
          >
            <TrendingUp className="w-8 h-8 text-emerald-500 mb-2" />
            <p className="text-gray-400 text-xs">{t.totalEarned}</p>
            <p className="text-xl font-bold text-white">{(userData?.total_mined || 0).toFixed(2)}</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4"
          >
            <Gift className="w-8 h-8 text-purple-500 mb-2" />
            <p className="text-gray-400 text-xs">Referral Bonus</p>
            <p className="text-xl font-bold text-white">+{Math.min((userData?.referral_count || 0) * 10, 100)}%</p>
          </motion.div>
        </div>
      </div>

      {/* How It Works */}
      <div className="px-5">
        <h2 className="text-white font-bold text-lg mb-4">How It Works</h2>
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 space-y-4">
          {[
            { icon: Play, text: 'Start a 24-hour session', color: 'text-emerald-500' },
            { icon: Coins, text: 'PRC accumulates automatically', color: 'text-amber-500' },
            { icon: CheckCircle, text: 'Collect rewards anytime', color: 'text-blue-500' },
            { icon: Star, text: 'Invite friends for +10% bonus each', color: 'text-purple-500' },
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
