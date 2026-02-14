import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Hand, Zap, Trophy, ArrowLeft, Star, Target, Crown, Flame, Award, TrendingUp } from 'lucide-react';
import smartToast from '@/utils/smartToast';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL;

// Plan configurations
const PLAN_CONFIG = {
  explorer: { tapLimit: 100, prcPerTap: 0.1, multiplier: '1x', color: 'gray', dailyMax: 10 },
  startup: { tapLimit: 100, prcPerTap: 0.5, multiplier: '5x', color: 'blue', dailyMax: 50 },
  growth: { tapLimit: 100, prcPerTap: 1.0, multiplier: '10x', color: 'emerald', dailyMax: 100 },
  elite: { tapLimit: 100, prcPerTap: 2.0, multiplier: '20x', color: 'amber', dailyMax: 200 }
};

// Combo thresholds
const COMBO_THRESHOLDS = [
  { taps: 5, multiplier: 1.5, name: 'NICE!', color: 'text-blue-400' },
  { taps: 10, multiplier: 2, name: 'GREAT!', color: 'text-green-400' },
  { taps: 20, multiplier: 3, name: 'AMAZING!', color: 'text-yellow-400' },
  { taps: 35, multiplier: 4, name: 'INCREDIBLE!', color: 'text-orange-400' },
  { taps: 50, multiplier: 5, name: 'LEGENDARY!', color: 'text-red-400' },
];

// Particle component for tap effects
const Particle = ({ x, y, color, size, delay }) => (
  <motion.div
    className="absolute pointer-events-none rounded-full"
    style={{
      left: x,
      top: y,
      width: size,
      height: size,
      background: color,
    }}
    initial={{ opacity: 1, scale: 1 }}
    animate={{
      opacity: 0,
      scale: 0,
      x: (Math.random() - 0.5) * 200,
      y: (Math.random() - 0.5) * 200 - 50,
    }}
    transition={{ duration: 0.8, delay, ease: 'easeOut' }}
  />
);

// Fire particle for power mode
const FireParticle = ({ delay }) => (
  <motion.div
    className="absolute bottom-0 left-1/2 pointer-events-none"
    initial={{ opacity: 0.8, y: 0, x: (Math.random() - 0.5) * 60, scale: 1 }}
    animate={{ opacity: 0, y: -100, scale: 0.5 }}
    transition={{ duration: 1, delay, repeat: Infinity }}
  >
    <Flame className="w-6 h-6 text-orange-500" />
  </motion.div>
);

// Combo display component
const ComboDisplay = ({ combo, comboMultiplier, comboName, comboColor }) => (
  <AnimatePresence>
    {combo >= 5 && (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="absolute -top-20 left-1/2 transform -translate-x-1/2 text-center"
      >
        <motion.p 
          className={`text-3xl font-black ${comboColor}`}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 0.3, repeat: Infinity }}
        >
          {comboName}
        </motion.p>
        <p className="text-white font-bold text-xl">
          {combo}x COMBO
        </p>
        <p className="text-amber-400 font-semibold">
          {comboMultiplier}x BONUS
        </p>
      </motion.div>
    )}
  </AnimatePresence>
);

// Streak badge component
const StreakBadge = ({ streak }) => (
  <motion.div
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 px-3 py-1 rounded-full"
  >
    <Flame className="w-4 h-4 text-white" />
    <span className="text-white font-bold text-sm">{streak} Day Streak!</span>
  </motion.div>
);

const TapGameAdvanced = ({ user }) => {
  const navigate = useNavigate();
  const { t: globalT } = useLanguage();
  
  // Core state
  const [taps, setTaps] = useState(0);
  const [totalTapsToday, setTotalTapsToday] = useState(0);
  const [remainingTaps, setRemainingTaps] = useState(100);
  const [maxTaps, setMaxTaps] = useState(100);
  const [earnedPRC, setEarnedPRC] = useState(0);
  const [subscriptionPlan, setSubscriptionPlan] = useState('explorer');
  const [prcPerTap, setPrcPerTap] = useState(0.01);
  const [loading, setLoading] = useState(true);
  
  // Advanced state
  const [combo, setCombo] = useState(0);
  const [comboMultiplier, setComboMultiplier] = useState(1);
  const [comboName, setComboName] = useState('');
  const [comboColor, setComboColor] = useState('text-white');
  const [streak, setStreak] = useState(0);
  const [isPowerMode, setIsPowerMode] = useState(false);
  const [particles, setParticles] = useState([]);
  const [floatingNumbers, setFloatingNumbers] = useState([]);
  const [screenShake, setScreenShake] = useState(false);
  const [tapScale, setTapScale] = useState(1);
  
  // Refs
  const pendingTapsRef = useRef(0);
  const syncTimeoutRef = useRef(null);
  const comboTimeoutRef = useRef(null);
  const buttonRef = useRef(null);

  const hasPaidPlan = ['startup', 'growth', 'elite'].includes(subscriptionPlan);
  const planConfig = PLAN_CONFIG[subscriptionPlan] || PLAN_CONFIG.explorer;

  useEffect(() => {
    fetchTapStats();
    return () => {
      if (pendingTapsRef.current > 0) {
        syncTapsToServer(pendingTapsRef.current);
      }
    };
  }, [user]);

  // Update combo multiplier based on combo count
  useEffect(() => {
    let newMultiplier = 1;
    let newName = '';
    let newColor = 'text-white';
    
    for (let i = COMBO_THRESHOLDS.length - 1; i >= 0; i--) {
      if (combo >= COMBO_THRESHOLDS[i].taps) {
        newMultiplier = COMBO_THRESHOLDS[i].multiplier;
        newName = COMBO_THRESHOLDS[i].name;
        newColor = COMBO_THRESHOLDS[i].color;
        break;
      }
    }
    
    setComboMultiplier(newMultiplier);
    setComboName(newName);
    setComboColor(newColor);
    
    // Power mode at 20+ combo
    setIsPowerMode(combo >= 20);
  }, [combo]);

  const fetchTapStats = async () => {
    try {
      const response = await axios.get(`${API}/api/user/${user.uid}`);
      const data = response.data;
      const tapsToday = data.taps_today || 0;
      const userPlan = data.subscription_plan || 'explorer';
      const config = PLAN_CONFIG[userPlan] || PLAN_CONFIG.explorer;
      const userStreak = data.tap_streak || 0;
      
      setTotalTapsToday(tapsToday);
      setRemainingTaps(Math.max(0, config.tapLimit - tapsToday));
      setMaxTaps(config.tapLimit);
      setSubscriptionPlan(userPlan);
      setPrcPerTap(config.prcPerTap);
      setStreak(userStreak);
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
        taps: tapsToSync,
        combo_multiplier: comboMultiplier
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
        toast.error(globalT('dailyLimitReached'));
      }
    }
  };

  const createParticles = useCallback((e) => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const colors = isPowerMode 
      ? ['#f97316', '#ef4444', '#eab308', '#f59e0b']
      : ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981'];
    
    const newParticles = [];
    const particleCount = isPowerMode ? 20 : 12;
    
    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: Date.now() + Math.random(),
        x: centerX,
        y: centerY,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 12 + 6,
        delay: Math.random() * 0.1,
      });
    }
    
    setParticles(prev => [...prev, ...newParticles]);
    
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 1000);
  }, [isPowerMode]);

  const handleTap = useCallback((e) => {
    if (remainingTaps <= 0) {
      smartToast.error(globalT('dailyLimitReached'));
      return;
    }

    // Immediate visual feedback
    setTaps(prev => prev + 1);
    setTotalTapsToday(prev => prev + 1);
    setRemainingTaps(prev => Math.max(0, prev - 1));
    
    // Combo system
    setCombo(prev => prev + 1);
    
    // Reset combo timeout
    if (comboTimeoutRef.current) {
      clearTimeout(comboTimeoutRef.current);
    }
    comboTimeoutRef.current = setTimeout(() => {
      setCombo(0);
    }, 1500); // Combo resets after 1.5 seconds of no taps
    
    // Create particles
    createParticles(e);
    
    // Screen shake for power mode
    if (isPowerMode) {
      setScreenShake(true);
      setTimeout(() => setScreenShake(false), 100);
    }
    
    // Tap animation
    setTapScale(0.9);
    setTimeout(() => setTapScale(1), 100);
    
    // Add floating number with combo bonus
    const id = Date.now() + Math.random();
    const prcEarned = (prcPerTap * comboMultiplier).toFixed(2);
    setFloatingNumbers(prev => [...prev, { 
      id, 
      x: Math.random() * 80 - 40, 
      value: prcEarned,
      isCombo: comboMultiplier > 1
    }]);
    setTimeout(() => {
      setFloatingNumbers(prev => prev.filter(n => n.id !== id));
    }, 1000);

    // Batch taps
    pendingTapsRef.current += 1;
    
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    
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
  }, [remainingTaps, prcPerTap, comboMultiplier, isPowerMode, createParticles, globalT]);

  const progress = ((maxTaps - remainingTaps) / maxTaps) * 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <motion.div 
      className={`min-h-screen pb-24 pt-16 ${
        isPowerMode 
          ? 'bg-gradient-to-b from-orange-950 via-red-950 to-gray-950' 
          : 'bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950'
      }`}
      animate={screenShake ? { x: [0, -5, 5, -5, 5, 0] } : {}}
      transition={{ duration: 0.1 }}
    >
      {/* Power Mode Fire Background */}
      {isPowerMode && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[...Array(10)].map((_, i) => (
            <FireParticle key={i} delay={i * 0.2} />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="px-5 pb-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-white text-xl font-bold flex items-center gap-2">
                {globalT('tapGame')}
                {isPowerMode && (
                  <motion.span 
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="text-orange-500"
                  >
                    🔥
                  </motion.span>
                )}
              </h1>
              <p className="text-gray-400 text-sm">{globalT('tapToEarn')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {streak > 0 && <StreakBadge streak={streak} />}
            {hasPaidPlan && (
              <div className={`px-3 py-1 rounded-full ${
                subscriptionPlan === 'elite' ? 'bg-gradient-to-r from-amber-500 to-yellow-500' :
                subscriptionPlan === 'growth' ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
                'bg-gradient-to-r from-blue-500 to-cyan-500'
              }`}>
                <span className="text-xs font-bold text-black flex items-center gap-1">
                  <Crown className="w-3 h-3" /> {planConfig.multiplier}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-3 text-center">
            <Target className="w-5 h-5 text-pink-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{totalTapsToday}</p>
            <p className="text-gray-500 text-xs">Taps</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-3 text-center">
            <Zap className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{remainingTaps}</p>
            <p className="text-gray-500 text-xs">Left</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-3 text-center">
            <Star className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{earnedPRC.toFixed(1)}</p>
            <p className="text-gray-500 text-xs">PRC</p>
          </div>
          <div className={`rounded-2xl p-3 text-center ${
            isPowerMode 
              ? 'bg-gradient-to-br from-orange-500/30 to-red-500/30 border border-orange-500/50' 
              : 'bg-gray-900/50 border border-gray-800'
          }`}>
            <TrendingUp className={`w-5 h-5 mx-auto mb-1 ${isPowerMode ? 'text-orange-400' : 'text-purple-500'}`} />
            <p className={`text-xl font-bold ${isPowerMode ? 'text-orange-400' : 'text-white'}`}>
              {comboMultiplier}x
            </p>
            <p className="text-gray-500 text-xs">Combo</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-5 mb-6">
        <div className="bg-gray-800 rounded-full h-3 overflow-hidden">
          <motion.div 
            className={`h-full ${
              isPowerMode 
                ? 'bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500' 
                : 'bg-gradient-to-r from-pink-500 to-rose-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <p className="text-center text-gray-500 text-sm mt-2">{totalTapsToday}/{maxTaps} taps</p>
      </div>

      {/* Tap Button Area */}
      <div className="px-5 flex flex-col items-center justify-center min-h-[320px]">
        <div className="relative" ref={buttonRef}>
          {/* Combo Display */}
          <ComboDisplay 
            combo={combo} 
            comboMultiplier={comboMultiplier} 
            comboName={comboName}
            comboColor={comboColor}
          />

          {/* Particles */}
          <AnimatePresence>
            {particles.map(p => (
              <Particle key={p.id} {...p} />
            ))}
          </AnimatePresence>

          {/* Floating Numbers */}
          <AnimatePresence>
            {floatingNumbers.map(num => (
              <motion.div
                key={num.id}
                initial={{ opacity: 1, y: 0, x: num.x, scale: 1 }}
                animate={{ opacity: 0, y: -120, scale: 1.5 }}
                exit={{ opacity: 0 }}
                className={`absolute top-0 left-1/2 font-bold text-xl pointer-events-none z-20 ${
                  num.isCombo ? 'text-orange-400' : 'text-amber-400'
                }`}
                style={{ marginLeft: num.x }}
              >
                +{num.value}
                {num.isCombo && <span className="text-xs ml-1">🔥</span>}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Main Tap Button */}
          <motion.button
            onClick={handleTap}
            disabled={remainingTaps <= 0}
            animate={{ scale: tapScale }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className={`relative z-10 w-48 h-48 rounded-full flex items-center justify-center shadow-2xl select-none ${
              remainingTaps > 0 
                ? isPowerMode
                  ? 'bg-gradient-to-br from-orange-500 via-red-500 to-yellow-600 active:scale-95 cursor-pointer'
                  : 'bg-gradient-to-br from-pink-500 via-rose-500 to-red-600 active:scale-95 cursor-pointer'
                : 'bg-gray-700 cursor-not-allowed'
            }`}
            style={{
              boxShadow: remainingTaps > 0 
                ? isPowerMode
                  ? '0 0 80px rgba(249, 115, 22, 0.6), 0 0 120px rgba(239, 68, 68, 0.4), 0 20px 40px rgba(0,0,0,0.3)'
                  : '0 0 60px rgba(236, 72, 153, 0.5), 0 20px 40px rgba(0,0,0,0.3)'
                : 'none',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
              userSelect: 'none'
            }}
            data-testid="tap-button"
          >
            {isPowerMode ? (
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                <Flame className="w-24 h-24 text-white" />
              </motion.div>
            ) : (
              <Hand className={`w-20 h-20 ${remainingTaps > 0 ? 'text-white' : 'text-gray-500'} pointer-events-none`} />
            )}
          </motion.button>

          {/* Glow Rings */}
          {remainingTaps > 0 && (
            <>
              <motion.div 
                className={`absolute inset-0 rounded-full pointer-events-none ${
                  isPowerMode ? 'bg-orange-500' : 'bg-pink-500'
                }`}
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              {isPowerMode && (
                <motion.div 
                  className="absolute inset-0 rounded-full bg-red-500 pointer-events-none"
                  animate={{ scale: [1.1, 1.5, 1.1], opacity: [0.2, 0, 0.2] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
                />
              )}
            </>
          )}
        </div>

        <p className="text-gray-400 mt-8 text-center text-lg">
          {remainingTaps > 0 
            ? combo >= 20 
              ? '🔥 POWER MODE ACTIVATED! Keep tapping!' 
              : combo >= 5 
                ? `🎯 ${combo}x COMBO! Don't stop!` 
                : '👆 Tap fast to build combos!'
            : globalT('dailyLimitReached')
          }
        </p>
      </div>

      {/* Combo Guide */}
      <div className="px-5 mt-6">
        <h2 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          Combo Bonuses
        </h2>
        <div className="grid grid-cols-5 gap-2">
          {COMBO_THRESHOLDS.map((threshold, index) => (
            <div 
              key={index}
              className={`rounded-xl p-2 text-center ${
                combo >= threshold.taps 
                  ? 'bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-amber-500/50' 
                  : 'bg-gray-900/50 border border-gray-800'
              }`}
            >
              <p className={`text-xs font-bold ${combo >= threshold.taps ? 'text-amber-400' : 'text-gray-500'}`}>
                {threshold.taps}+
              </p>
              <p className={`text-lg font-bold ${combo >= threshold.taps ? 'text-white' : 'text-gray-600'}`}>
                {threshold.multiplier}x
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* PRC Per Tap Info */}
      <div className="px-5 mt-4 mb-4">
        <div className={`rounded-xl p-3 text-center ${
          subscriptionPlan === 'elite' ? 'bg-amber-500/20 border border-amber-500/30' :
          subscriptionPlan === 'growth' ? 'bg-emerald-500/20 border border-emerald-500/30' :
          subscriptionPlan === 'startup' ? 'bg-blue-500/20 border border-blue-500/30' :
          'bg-gray-800/50 border border-gray-700'
        }`}>
          <p className="text-sm text-gray-300">
            Base: <span className="font-bold text-white">{prcPerTap} PRC/tap</span>
            {comboMultiplier > 1 && (
              <span className="text-orange-400 ml-2">
                → Current: <span className="font-bold">{(prcPerTap * comboMultiplier).toFixed(2)} PRC</span> 🔥
              </span>
            )}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default TapGameAdvanced;
