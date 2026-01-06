import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, ChevronLeft, X, Coins, Users, ShoppingBag, 
  Gift, Zap, CloudRain, TrendingUp, Shield, Smartphone, Check,
  Sparkles, Star, Heart, Rocket
} from 'lucide-react';
import { Button } from './ui/button';
import { useLanguage } from '../contexts/LanguageContext';

// Cute Mascot Character - Paras Buddy
const ParasBuddy = ({ emotion = 'happy', message = '' }) => {
  const emotions = {
    happy: '😊',
    excited: '🤩',
    thinking: '🤔',
    celebrating: '🥳',
    waving: '👋',
    mining: '⛏️',
    rich: '🤑',
    cool: '😎'
  };

  return (
    <motion.div 
      className="flex flex-col items-center gap-2"
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      {/* Speech Bubble */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-lg max-w-[200px] text-center relative"
        >
          <span className="text-sm font-medium text-gray-800">{message}</span>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/90 rotate-45"></div>
        </motion.div>
      )}
      
      {/* Character Body */}
      <motion.div
        animate={{ 
          y: [0, -8, 0],
          rotate: [-2, 2, -2]
        }}
        transition={{ 
          duration: 2, 
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="relative"
      >
        {/* Main Body - Cute Blob Shape */}
        <div className="w-20 h-20 bg-gradient-to-br from-purple-400 via-purple-500 to-indigo-600 rounded-[40%_60%_70%_30%/60%_30%_70%_40%] shadow-xl relative overflow-hidden">
          {/* Face */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl">{emotions[emotion]}</span>
          </div>
          
          {/* Sparkle Effects */}
          <motion.div
            className="absolute top-1 right-1"
            animate={{ scale: [0, 1, 0], rotate: [0, 180, 360] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className="w-4 h-4 text-yellow-300" />
          </motion.div>
        </div>
        
        {/* Little Arms */}
        <motion.div
          className="absolute -left-2 top-8 w-4 h-4 bg-purple-400 rounded-full"
          animate={{ rotate: [-20, 20, -20] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
        <motion.div
          className="absolute -right-2 top-8 w-4 h-4 bg-purple-400 rounded-full"
          animate={{ rotate: [20, -20, 20] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      </motion.div>
    </motion.div>
  );
};

// Animated Icon Components with Cartoon Style
const AnimatedCoin = () => (
  <motion.div
    className="relative w-24 h-24 mx-auto"
    animate={{ rotateY: [0, 360] }}
    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
  >
    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500 flex items-center justify-center shadow-2xl">
      <span className="text-4xl font-bold text-yellow-900">₿</span>
    </div>
    <motion.div
      className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"
      animate={{ scale: [1, 1.2, 1] }}
      transition={{ duration: 1, repeat: Infinity }}
    >
      <span className="text-white text-xs">+</span>
    </motion.div>
  </motion.div>
);

const AnimatedRain = () => (
  <div className="relative w-32 h-32 mx-auto overflow-hidden">
    {[...Array(8)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-3 h-5 rounded-full"
        style={{
          left: `${10 + i * 12}%`,
          background: ['#22c55e', '#3b82f6', '#eab308', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'][i],
        }}
        animate={{
          y: [-20, 140],
          opacity: [1, 1, 0],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          delay: i * 0.15,
          ease: "easeIn"
        }}
      />
    ))}
    <motion.div
      className="absolute bottom-0 left-1/2 -translate-x-1/2"
      animate={{ scale: [1, 1.1, 1] }}
      transition={{ duration: 0.5, repeat: Infinity }}
    >
      <span className="text-4xl">👆</span>
    </motion.div>
  </div>
);

const AnimatedNetwork = () => (
  <div className="relative w-32 h-32 mx-auto">
    {/* Center node */}
    <motion.div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center z-10"
      animate={{ scale: [1, 1.1, 1] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <Users className="w-6 h-6 text-white" />
    </motion.div>
    {/* Orbiting nodes */}
    {[0, 60, 120, 180, 240, 300].map((angle, i) => (
      <motion.div
        key={i}
        className="absolute w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center"
        style={{
          top: '50%',
          left: '50%',
        }}
        animate={{
          x: [Math.cos((angle * Math.PI) / 180) * 45, Math.cos(((angle + 360) * Math.PI) / 180) * 45],
          y: [Math.sin((angle * Math.PI) / 180) * 45, Math.sin(((angle + 360) * Math.PI) / 180) * 45],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      >
        <span className="text-white text-xs">{i + 1}</span>
      </motion.div>
    ))}
  </div>
);

const AnimatedShop = () => (
  <motion.div className="relative w-32 h-32 mx-auto">
    <motion.div
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <ShoppingBag className="w-20 h-20 mx-auto text-indigo-500" />
    </motion.div>
    {[...Array(3)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"
        style={{ top: '20%', left: `${20 + i * 25}%` }}
        animate={{
          y: [0, -30, -60],
          opacity: [0, 1, 0],
          scale: [0.5, 1, 0.5],
        }}
        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
      >
        <Coins className="w-2 h-2 text-white" />
      </motion.div>
    ))}
  </motion.div>
);

const AnimatedGift = () => (
  <motion.div className="relative w-32 h-32 mx-auto">
    <motion.div
      animate={{ 
        rotateZ: [-5, 5, -5],
        scale: [1, 1.05, 1]
      }}
      transition={{ duration: 1, repeat: Infinity }}
    >
      <div className="w-24 h-24 mx-auto bg-gradient-to-br from-pink-500 to-red-500 rounded-xl relative">
        <div className="absolute inset-x-0 top-1/2 h-3 bg-yellow-400 -translate-y-1/2" />
        <div className="absolute inset-y-0 left-1/2 w-3 bg-yellow-400 -translate-x-1/2" />
        <motion.div
          className="absolute -top-4 left-1/2 -translate-x-1/2"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          <div className="w-8 h-4 bg-yellow-400 rounded-full" />
        </motion.div>
      </div>
    </motion.div>
    <motion.div
      className="absolute -top-2 -right-2"
      animate={{ scale: [0, 1, 0], rotate: [0, 180, 360] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <span className="text-2xl">✨</span>
    </motion.div>
  </motion.div>
);

// Animation components for Mining slide
const MiningAnimation = () => (
  <motion.div className="relative w-32 h-32 mx-auto">
    <motion.div
      className="w-24 h-24 mx-auto bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center"
      animate={{ boxShadow: ['0 0 20px #8b5cf6', '0 0 40px #8b5cf6', '0 0 20px #8b5cf6'] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <Zap className="w-12 h-12 text-yellow-400" />
    </motion.div>
    <motion.div
      className="absolute -top-2 right-4 text-xl"
      animate={{ y: [0, -20], opacity: [1, 0] }}
      transition={{ duration: 1, repeat: Infinity }}
    >
      +5
    </motion.div>
  </motion.div>
);

// Animation component for VIP slide
const VIPAnimation = () => (
  <motion.div className="w-32 h-32 mx-auto relative">
    <motion.div
      animate={{ 
        rotateY: [0, 360],
        scale: [1, 1.1, 1]
      }}
      transition={{ duration: 3, repeat: Infinity }}
      className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 rounded-full flex items-center justify-center shadow-2xl"
    >
      <span className="text-5xl">👑</span>
    </motion.div>
    {[...Array(8)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-2 h-2 bg-yellow-400 rounded-full"
        style={{
          top: '50%',
          left: '50%',
        }}
        animate={{
          x: [0, Math.cos((i * 45 * Math.PI) / 180) * 60],
          y: [0, Math.sin((i * 45 * Math.PI) / 180) * 60],
          opacity: [1, 0],
          scale: [1, 0],
        }}
        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
      />
    ))}
  </motion.div>
);

// Animation component for Ready slide
const ReadyAnimation = () => (
  <motion.div 
    className="w-32 h-32 mx-auto flex items-center justify-center"
    animate={{ scale: [1, 1.2, 1] }}
    transition={{ duration: 1, repeat: Infinity }}
  >
    <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
      <Check className="w-12 h-12 text-white" />
    </div>
  </motion.div>
);

// Function to generate tutorial slides with translations
const getTutorialSlides = (t) => [
  {
    id: 'welcome',
    title: t('tutorialWelcomeTitle'),
    subtitle: t('tutorialWelcomeSubtitle'),
    description: t('tutorialWelcomeDesc'),
    animation: <AnimatedCoin />,
    mascot: { emotion: 'waving', message: t('mascotWelcome') },
    color: 'from-yellow-500 to-orange-600',
    tips: [t('tutorialWelcomeTip1'), t('tutorialWelcomeTip2'), t('tutorialWelcomeTip3')]
  },
  {
    id: 'mining',
    title: t('tutorialMiningTitle'),
    subtitle: t('tutorialMiningSubtitle'),
    description: t('tutorialMiningDesc'),
    animation: <MiningAnimation />,
    mascot: { emotion: 'mining', message: t('mascotMining') },
    color: 'from-purple-600 to-blue-600',
    tips: [t('tutorialMiningTip1'), t('tutorialMiningTip2'), t('tutorialMiningTip3')]
  },
  {
    id: 'referral',
    title: t('tutorialReferralTitle'),
    subtitle: t('tutorialReferralSubtitle'),
    description: t('tutorialReferralDesc'),
    animation: <AnimatedNetwork />,
    mascot: { emotion: 'excited', message: t('mascotReferral') },
    color: 'from-blue-600 to-cyan-500',
    tips: [t('tutorialReferralTip1'), t('tutorialReferralTip2'), t('tutorialReferralTip3')]
  },
  {
    id: 'rain',
    title: t('tutorialRainTitle'),
    subtitle: t('tutorialRainSubtitle'),
    description: t('tutorialRainDesc'),
    animation: <AnimatedRain />,
    mascot: { emotion: 'celebrating', message: t('mascotRain') },
    color: 'from-indigo-600 to-purple-600',
    tips: [t('tutorialRainTip1'), t('tutorialRainTip2'), t('tutorialRainTip3')]
  },
  {
    id: 'marketplace',
    title: t('tutorialMarketplaceTitle'),
    subtitle: t('tutorialMarketplaceSubtitle'),
    description: t('tutorialMarketplaceDesc'),
    animation: <AnimatedShop />,
    mascot: { emotion: 'rich', message: t('mascotMarketplace') },
    color: 'from-green-600 to-teal-500',
    tips: [t('tutorialMarketplaceTip1'), t('tutorialMarketplaceTip2'), t('tutorialMarketplaceTip3')]
  },
  {
    id: 'redeem',
    title: t('tutorialRedeemTitle'),
    subtitle: t('tutorialRedeemSubtitle'),
    description: t('tutorialRedeemDesc'),
    animation: <AnimatedGift />,
    mascot: { emotion: 'happy', message: t('mascotRedeem') },
    color: 'from-pink-600 to-rose-500',
    tips: [t('tutorialRedeemTip1'), t('tutorialRedeemTip2'), t('tutorialRedeemTip3')]
  },
  {
    id: 'vip',
    title: t('tutorialVipTitle'),
    subtitle: t('tutorialVipSubtitle'),
    description: t('tutorialVipDesc'),
    animation: <VIPAnimation />,
    mascot: { emotion: 'cool', message: t('mascotVip') },
    color: 'from-amber-500 to-yellow-600',
    tips: [t('tutorialVipTip1'), t('tutorialVipTip2'), t('tutorialVipTip3')]
  },
  {
    id: 'ready',
    title: t('tutorialReadyTitle'),
    subtitle: t('tutorialReadySubtitle'),
    description: t('tutorialReadyDesc'),
    animation: <ReadyAnimation />,
    mascot: { emotion: 'celebrating', message: t('mascotReady') },
    color: 'from-green-500 to-emerald-600',
    tips: [t('tutorialReadyTip1'), t('tutorialReadyTip2'), t('tutorialReadyTip3')]
  }
];

const AppTutorial = ({ onComplete, showSkip = true }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);
  const { t, language } = useLanguage();
  
  // Memoize slides to regenerate when language changes
  const tutorialSlides = useMemo(() => getTutorialSlides(t), [t, language]);

  const nextSlide = () => {
    if (currentSlide < tutorialSlides.length - 1) {
      setDirection(1);
      setCurrentSlide(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('tutorial_completed', 'true');
    if (onComplete) onComplete();
  };

  const slide = tutorialSlides[currentSlide];

  const slideVariants = {
    enter: (direction) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0
    })
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl relative"
      >
        {/* Header with gradient */}
        <div className={`bg-gradient-to-r ${slide.color} p-6 text-white relative overflow-visible`}>
          {showSkip && (
            <button
              onClick={handleComplete}
              className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
              data-testid="tutorial-skip-btn"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          
          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mb-4">
            {tutorialSlides.map((_, idx) => (
              <motion.div
                key={idx}
                className={`h-1.5 rounded-full ${idx === currentSlide ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`}
                animate={{ width: idx === currentSlide ? 24 : 6 }}
                data-testid={`tutorial-progress-dot-${idx}`}
              />
            ))}
          </div>

          {/* Animation area */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentSlide}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="py-4"
            >
              {slide.animation}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Mascot positioned at the corner */}
          {slide.mascot && (
            <div className="absolute -top-16 right-4 z-20">
              <ParasBuddy emotion={slide.mascot.emotion} message={slide.mascot.message} />
            </div>
          )}
          
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-1" data-testid="tutorial-slide-title">{slide.title}</h2>
              <p className="text-sm text-gray-500 mb-3" data-testid="tutorial-slide-subtitle">{slide.subtitle}</p>
              <p className="text-gray-700 mb-4" data-testid="tutorial-slide-description">{slide.description}</p>

              {/* Tips */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">{t('tutorialTips')}</p>
                <ul className="space-y-1">
                  {slide.tips.map((tip, idx) => (
                    <motion.li
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="text-sm text-gray-600 flex items-center gap-2"
                      data-testid={`tutorial-tip-${idx}`}
                    >
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                      {tip}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className="flex items-center gap-1"
              data-testid="tutorial-prev-btn"
            >
              <ChevronLeft className="w-4 h-4" />
              {t('tutorialPrev')}
            </Button>

            <span className="text-sm text-gray-400" data-testid="tutorial-slide-counter">
              {currentSlide + 1} / {tutorialSlides.length}
            </span>

            <Button
              onClick={nextSlide}
              className={`bg-gradient-to-r ${slide.color} text-white flex items-center gap-1`}
              data-testid="tutorial-next-btn"
            >
              {currentSlide === tutorialSlides.length - 1 ? t('tutorialStart') : t('tutorialNext')}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AppTutorial;
