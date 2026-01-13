import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Hand, Zap, Trophy, ArrowLeft, Star, Target, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL;

// Plan configurations for tap game
const PLAN_CONFIG = {
  explorer: { tapLimit: 100, prcPerTap: 0.01, multiplier: '1x', color: 'gray' },
  startup: { tapLimit: 200, prcPerTap: 0.015, multiplier: '1.5x', color: 'blue' },
  growth: { tapLimit: 300, prcPerTap: 0.02, multiplier: '2x', color: 'emerald' },
  elite: { tapLimit: 400, prcPerTap: 0.03, multiplier: '3x', color: 'amber' }
};

const TapGame = ({ user }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const [taps, setTaps] = useState(0);
  const [totalTapsToday, setTotalTapsToday] = useState(0);
  const [remainingTaps, setRemainingTaps] = useState(100);
  const [maxTaps, setMaxTaps] = useState(100);
  const [animating, setAnimating] = useState(false);
  const [earnedPRC, setEarnedPRC] = useState(0);
  const [floatingNumbers, setFloatingNumbers] = useState([]);
  const [subscriptionPlan, setSubscriptionPlan] = useState('explorer');
  const [prcPerTap, setPrcPerTap] = useState(0.01);
  const [loading, setLoading] = useState(true);
  
  // Batch taps for better performance
  const pendingTapsRef = useRef(0);
  const syncTimeoutRef = useRef(null);

  // Helper functions
  const hasPaidPlan = ['startup', 'growth', 'elite'].includes(subscriptionPlan);
  const planConfig = PLAN_CONFIG[subscriptionPlan] || PLAN_CONFIG.explorer;

  const t = {
    title: language === 'mr' ? 'टॅप गेम' : language === 'hi' ? 'टैप गेम' : 'Tap Game',
    tapToEarn: language === 'mr' ? 'टॅप करा आणि कमवा' : language === 'hi' ? 'टैप करें और कमाएं' : 'Tap to Earn',
    tapsToday: language === 'mr' ? 'आजचे टॅप्स' : language === 'hi' ? 'आज के टैप' : 'Taps Today',
    remaining: language === 'mr' ? 'बाकी' : language === 'hi' ? 'शेष' : 'Remaining',
    earned: language === 'mr' ? 'मिळवले' : language === 'hi' ? 'कमाया' : 'Earned',
    limitReached: language === 'mr' ? 'दैनिक मर्यादा पूर्ण!' : language === 'hi' ? 'दैनिक सीमा पूर्ण!' : 'Daily limit reached!',
  };

  useEffect(() => {
    fetchTapStats();
    return () => {
      // Sync any pending taps when component unmounts
      if (pendingTapsRef.current > 0) {
        syncTapsToServer(pendingTapsRef.current);
      }
    };
  }, [user]);

  const fetchTapStats = async () => {
    try {
      const response = await axios.get(`${API}/api/user/${user.uid}`);
      const data = response.data;
      const tapsToday = data.taps_today || 0;
      const userPlan = data.subscription_plan || 'explorer';
      const config = PLAN_CONFIG[userPlan] || PLAN_CONFIG.explorer;
      
      setTotalTapsToday(tapsToday);
      setRemainingTaps(Math.max(0, config.tapLimit - tapsToday));
      setMaxTaps(config.tapLimit);
      setSubscriptionPlan(userPlan);
      setPrcPerTap(config.prcPerTap);
    } catch (error) {
      console.error('Error fetching tap stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncTapsToServer = async (tapsToSync) => {
    if (tapsToSync <= 0) return;
    
    try {
      const response = await axios.post(`${API}/api/game/tap/${user.uid}`, { 
        taps: tapsToSync 
      });
      
      if (response.data) {
        setRemainingTaps(response.data.remaining_taps);
        const prcEarned = response.data.prc_earned || 0;
        setEarnedPRC(prev => prev + prcEarned);
      }
    } catch (error) {
      console.error('Error syncing taps:', error);
      if (error.response?.data?.detail === 'Daily tap limit reached') {
        setRemainingTaps(0);
        toast.error(t.limitReached);
      }
    }
  };

  const handleTap = () => {
    if (remainingTaps <= 0) {
      toast.error(t.limitReached);
      return;
    }

    // Immediate visual feedback
    setTaps(prev => prev + 1);
    setTotalTapsToday(prev => prev + 1);
    setRemainingTaps(prev => Math.max(0, prev - 1));
    setAnimating(true);
    
    // Add floating number
    const id = Date.now() + Math.random();
    const prc = prcPerTap.toFixed(2);
    setFloatingNumbers(prev => [...prev, { id, x: Math.random() * 80 - 40, value: prc }]);
    setTimeout(() => {
      setFloatingNumbers(prev => prev.filter(n => n.id !== id));
    }, 1000);

    setTimeout(() => setAnimating(false), 100);

    // Batch taps
    pendingTapsRef.current += 1;
    
    // Clear existing timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    
    // Sync to server every 5 taps or after 1 second of inactivity
    if (pendingTapsRef.current >= 5) {
      const tapsToSync = pendingTapsRef.current;
      pendingTapsRef.current = 0;
      syncTapsToServer(tapsToSync);
    } else {
      syncTimeoutRef.current = setTimeout(() => {
        const tapsToSync = pendingTapsRef.current;
        pendingTapsRef.current = 0;
        syncTapsToServer(tapsToSync);
      }, 1000);
    }
  };

  const progress = ((maxTaps - remainingTaps) / maxTaps) * 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
      {/* Header - with safe area padding */}
      <div className="px-5 pb-4" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top, 1.5rem))' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-white text-xl font-bold">{t.title}</h1>
              <p className="text-gray-400 text-sm">{t.tapToEarn}</p>
            </div>
          </div>
          {isVip && (
            <div className="bg-gradient-to-r from-amber-500 to-yellow-500 px-3 py-1 rounded-full">
              <span className="text-xs font-bold text-black flex items-center gap-1">
                <Crown className="w-3 h-3" /> 10x BONUS
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 text-center">
            <Target className="w-6 h-6 text-pink-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{totalTapsToday}</p>
            <p className="text-gray-500 text-xs">{t.tapsToday}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 text-center">
            <Zap className="w-6 h-6 text-amber-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{remainingTaps}</p>
            <p className="text-gray-500 text-xs">{t.remaining}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 text-center">
            <Star className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{earnedPRC.toFixed(2)}</p>
            <p className="text-gray-500 text-xs">{t.earned}</p>
          </div>
        </div>
      </div>

      {/* PRC Per Tap Info */}
      <div className="px-5 mb-4">
        <div className={`rounded-xl p-3 text-center ${isVip ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-gray-800/50 border border-gray-700'}`}>
          <p className={`text-sm font-medium ${isVip ? 'text-amber-400' : 'text-gray-400'}`}>
            {isVip ? '🎉 VIP Rate: ' : 'Free Rate: '}
            <span className="font-bold">{prcPerTap} PRC per tap</span>
            {!isVip && <span className="text-gray-500"> • VIP gets 0.1 PRC/tap</span>}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-5 mb-8">
        <div className="bg-gray-800 rounded-full h-3 overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-pink-500 to-rose-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <p className="text-center text-gray-500 text-sm mt-2">{totalTapsToday}/{maxTaps} taps today</p>
      </div>

      {/* Tap Button Area */}
      <div className="px-5 flex flex-col items-center justify-center min-h-[300px]">
        <div className="relative">
          {/* Floating Numbers */}
          <AnimatePresence>
            {floatingNumbers.map(num => (
              <motion.div
                key={num.id}
                initial={{ opacity: 1, y: 0, x: num.x, scale: 1 }}
                animate={{ opacity: 0, y: -100, scale: 1.5 }}
                exit={{ opacity: 0 }}
                className="absolute top-0 left-1/2 text-amber-400 font-bold text-xl pointer-events-none z-10"
                style={{ marginLeft: num.x }}
              >
                +{num.value}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Main Tap Button */}
          <motion.button
            onClick={handleTap}
            disabled={remainingTaps <= 0}
            whileTap={{ scale: 0.85 }}
            animate={animating ? { scale: 1.15 } : { scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className={`relative z-10 w-44 h-44 rounded-full flex items-center justify-center shadow-2xl select-none ${
              remainingTaps > 0 
                ? 'bg-gradient-to-br from-pink-500 via-rose-500 to-red-600 active:scale-95 cursor-pointer'
                : 'bg-gray-700 cursor-not-allowed'
            }`}
            style={{
              boxShadow: remainingTaps > 0 
                ? '0 0 60px rgba(236, 72, 153, 0.5), 0 20px 40px rgba(0,0,0,0.3)'
                : 'none',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
              userSelect: 'none'
            }}
            data-testid="tap-button"
          >
            <Hand className={`w-20 h-20 ${remainingTaps > 0 ? 'text-white' : 'text-gray-500'} pointer-events-none`} />
          </motion.button>

          {/* Glow Ring */}
          {remainingTaps > 0 && (
            <motion.div 
              className="absolute inset-0 rounded-full bg-pink-500 pointer-events-none"
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </div>

        <p className="text-gray-400 mt-8 text-center text-lg">
          {remainingTaps > 0 ? '👆 Tap fast to earn PRC!' : t.limitReached}
        </p>
      </div>

      {/* How It Works */}
      <div className="px-5 mt-8">
        <h2 className="text-white font-bold text-lg mb-4">How to Play</h2>
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 space-y-4">
          {[
            { icon: Hand, text: 'Tap the button as fast as you can', color: 'text-pink-500' },
            { icon: Star, text: `Earn ${prcPerTap} PRC per tap`, color: 'text-amber-500' },
            { icon: Trophy, text: `Max ${maxTaps} taps per day`, color: 'text-emerald-500' },
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

export default TapGame;
