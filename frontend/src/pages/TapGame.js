import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Hand, Zap, Trophy, ArrowLeft, Star, Target } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL;

const TapGame = ({ user }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const [taps, setTaps] = useState(0);
  const [totalTapsToday, setTotalTapsToday] = useState(0);
  const [remainingTaps, setRemainingTaps] = useState(100);
  const [animating, setAnimating] = useState(false);
  const [earnedPRC, setEarnedPRC] = useState(0);
  const [floatingNumbers, setFloatingNumbers] = useState([]);

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
  }, [user]);

  const fetchTapStats = async () => {
    try {
      const response = await axios.get(`${API}/api/user/${user.uid}`);
      const data = response.data;
      const tapsToday = data.taps_today || 0;
      setTotalTapsToday(tapsToday);
      setRemainingTaps(Math.max(0, 100 - tapsToday));
    } catch (error) {
      console.error('Error fetching tap stats:', error);
    }
  };

  const handleTap = async () => {
    if (remainingTaps <= 0) {
      toast.error(t.limitReached);
      return;
    }

    // Immediate visual feedback
    setTaps(prev => prev + 1);
    setTotalTapsToday(prev => prev + 1);
    setRemainingTaps(prev => prev - 1);
    setAnimating(true);
    
    // Add floating number
    const id = Date.now();
    setFloatingNumbers(prev => [...prev, { id, x: Math.random() * 100 - 50 }]);
    setTimeout(() => {
      setFloatingNumbers(prev => prev.filter(n => n.id !== id));
    }, 1000);

    setTimeout(() => setAnimating(false), 100);

    // Send tap to backend every 10 taps
    if ((taps + 1) % 10 === 0 || remainingTaps - 1 === 0) {
      try {
        const tapsToSend = Math.min(10, taps + 1);
        await axios.post(`${API}/api/game/tap/${user.uid}`, { taps: tapsToSend });
        const prcEarned = tapsToSend * 0.1;
        setEarnedPRC(prev => prev + prcEarned);
      } catch (error) {
        console.error('Error recording taps:', error);
      }
    }
  };

  const progress = ((100 - remainingTaps) / 100) * 100;

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
            <h1 className="text-white text-xl font-bold">{t.title}</h1>
            <p className="text-gray-400 text-sm">{t.tapToEarn}</p>
          </div>
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
            <p className="text-2xl font-bold text-white">{earnedPRC.toFixed(1)}</p>
            <p className="text-gray-500 text-xs">{t.earned}</p>
          </div>
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
        <p className="text-center text-gray-500 text-sm mt-2">{totalTapsToday}/100 taps today</p>
      </div>

      {/* Tap Button Area */}
      <div className="px-5 flex flex-col items-center justify-center min-h-[300px]">
        <div className="relative">
          {/* Floating Numbers */}
          <AnimatePresence>
            {floatingNumbers.map(num => (
              <motion.div
                key={num.id}
                initial={{ opacity: 1, y: 0, x: num.x }}
                animate={{ opacity: 0, y: -80 }}
                exit={{ opacity: 0 }}
                className="absolute top-0 left-1/2 text-amber-400 font-bold text-xl pointer-events-none"
              >
                +0.1
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Main Tap Button */}
          <motion.button
            onClick={handleTap}
            disabled={remainingTaps <= 0}
            whileTap={{ scale: 0.9 }}
            animate={animating ? { scale: 1.1 } : { scale: 1 }}
            className={`w-40 h-40 rounded-full flex items-center justify-center shadow-2xl ${
              remainingTaps > 0 
                ? 'bg-gradient-to-br from-pink-500 via-rose-500 to-red-600'
                : 'bg-gray-700'
            }`}
            style={{
              boxShadow: remainingTaps > 0 
                ? '0 0 60px rgba(236, 72, 153, 0.5), 0 20px 40px rgba(0,0,0,0.3)'
                : 'none'
            }}
          >
            <Hand className={`w-16 h-16 ${remainingTaps > 0 ? 'text-white' : 'text-gray-500'}`} />
          </motion.button>

          {/* Glow Ring */}
          {remainingTaps > 0 && (
            <div className="absolute inset-0 rounded-full animate-ping opacity-30 bg-pink-500"></div>
          )}
        </div>

        <p className="text-gray-400 mt-6 text-center">
          {remainingTaps > 0 ? 'Tap fast to earn PRC!' : t.limitReached}
        </p>
      </div>

      {/* How It Works */}
      <div className="px-5 mt-8">
        <h2 className="text-white font-bold text-lg mb-4">How to Play</h2>
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 space-y-4">
          {[
            { icon: Hand, text: 'Tap the button as fast as you can' },
            { icon: Star, text: 'Earn 0.1 PRC per tap' },
            { icon: Trophy, text: 'Max 100 taps per day' },
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
                <item.icon className="w-5 h-5 text-pink-500" />
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
