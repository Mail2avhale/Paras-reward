import { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Coins, Play, Clock, Star, Crown, ArrowLeft, Zap, Gift, TrendingUp } from 'lucide-react';
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
    sessionEarnings: language === 'mr' ? 'सत्र कमाई' : language === 'hi' ? 'सत्र कमाई' : 'Session Earnings',
    vipBonus: language === 'mr' ? 'VIP बोनस' : language === 'hi' ? 'VIP बोनस' : 'VIP Bonus',
    freeWarning: language === 'mr' ? 'फ्री युजर: Points 2 दिवसांसाठी वैध' : language === 'hi' ? 'फ्री यूजर: Points 2 दिनों के लिए वैध' : 'Free User: Points valid for 2 days',
  };

  useEffect(() => {
    if (user?.uid) {
      fetchUserData();
    }
  }, [user]);

  useEffect(() => {
    let interval;
    if (isMining && sessionTimeRemaining > 0) {
      interval = setInterval(() => {
        setSessionTimeRemaining(prev => {
          if (prev <= 1) {
            setIsMining(false);
            toast.success('Session complete! PRC collected.');
            return 0;
          }
          return prev - 1;
        });
        
        // Calculate earned PRC
        const prcPerSecond = miningRate / 3600;
        setSessionPRC(prev => prev + prcPerSecond);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isMining, sessionTimeRemaining, miningRate]);

  const fetchUserData = async () => {
    try {
      const response = await axios.get(`${API}/api/user/${user.uid}`);
      const data = response.data;
      setUserData(data);
      
      // Check if session is active
      if (data.mining_active && data.mining_session_end) {
        const endTime = new Date(data.mining_session_end).getTime();
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        
        if (remaining > 0) {
          setIsMining(true);
          setSessionTimeRemaining(remaining);
        }
      }
      
      // Calculate mining rate
      let rate = 1.0;
      if (data.membership_type === 'vip') rate *= 2;
      if (data.referral_count > 0) rate += data.referral_count * 0.1;
      setMiningRate(rate);
      
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Use fallback from user prop
      setUserData(user);
    } finally {
      setLoading(false);
    }
  };

  const startSession = async () => {
    setIsStarting(true);
    try {
      const response = await axios.post(`${API}/api/mining/start/${user.uid}`);
      if (response.data) {
        setIsMining(true);
        setSessionTimeRemaining(24 * 60 * 60); // 24 hours
        setSessionPRC(0);
        toast.success('Session started! Collecting PRC...');
        fetchUserData();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start session');
    } finally {
      setIsStarting(false);
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
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400 rounded-full blur-3xl animate-pulse"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-green-400 rounded-full blur-3xl animate-pulse"></div>
            </div>
          )}

          <div className="relative z-10">
            {/* Status Badge */}
            <div className="flex items-center justify-between mb-6">
              <div className={`px-4 py-2 rounded-full ${isMining ? 'bg-emerald-500/30' : 'bg-gray-700/50'}`}>
                <span className={`text-sm font-semibold flex items-center gap-2 ${isMining ? 'text-emerald-400' : 'text-gray-400'}`}>
                  {isMining ? <><Zap className="w-4 h-4" /> {t.sessionActive}</> : <><Clock className="w-4 h-4" /> Waiting</>}
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
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <span className="text-2xl font-bold text-amber-400">
                    +{sessionPRC.toFixed(4)} PRC
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center mb-6">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center">
                  <Star className="w-12 h-12 text-black" />
                </div>
                <p className="text-gray-400 mb-4">Start collecting daily rewards</p>
                <Button 
                  onClick={startSession}
                  disabled={isStarting}
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-bold py-4 rounded-2xl text-lg"
                >
                  {isStarting ? 'Starting...' : t.startSession}
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
                  onClick={() => navigate('/vip')}
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
            <p className="text-xl font-bold text-white">+{((userData?.referral_count || 0) * 10)}%</p>
          </motion.div>
        </div>
      </div>

      {/* How It Works */}
      <div className="px-5">
        <h2 className="text-white font-bold text-lg mb-4">How It Works</h2>
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 space-y-4">
          {[
            { icon: Play, text: 'Start a 24-hour session' },
            { icon: Coins, text: 'Earn PRC automatically' },
            { icon: Star, text: 'Invite friends for bonus rate' },
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <item.icon className="w-5 h-5 text-amber-500" />
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
