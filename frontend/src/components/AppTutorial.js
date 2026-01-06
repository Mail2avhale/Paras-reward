import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, ChevronLeft, X, Coins, Users, ShoppingBag, 
  Gift, Zap, CloudRain, TrendingUp, Shield, Smartphone, Check,
  Sparkles, Star, Heart, Rocket
} from 'lucide-react';
import { Button } from './ui/button';

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

// Tutorial Slides Data with Mascot Integration
const tutorialSlides = [
  {
    id: 'welcome',
    title: 'Paras Reward मध्ये स्वागत! 🎉',
    subtitle: 'तुमचा reward journey सुरू करा',
    description: 'Mining करा, Refer करा, आणि exciting rewards मिळवा!',
    animation: <AnimatedCoin />,
    mascot: { emotion: 'waving', message: 'नमस्कार! मी Paras Buddy!' },
    color: 'from-yellow-500 to-orange-600',
    tips: ['दररोज mining करा', 'Friends ना refer करा', 'VIP बना आणि जास्त कमवा']
  },
  {
    id: 'mining',
    title: 'PRC Mining ⛏️',
    subtitle: 'तुमचे PRC कमवा',
    description: 'Dashboard वर "Start Mining" button दाबा आणि automatic PRC कमवायला सुरुवात करा.',
    animation: (
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
    ),
    mascot: { emotion: 'mining', message: 'Mining सुरू करा!' },
    color: 'from-purple-600 to-blue-600',
    tips: ['VIP members ला 2x PRC मिळतो', 'Referrals वाढवा = Mining speed वाढते', 'दररोज login करा']
  },
  {
    id: 'referral',
    title: '5-Level Referral System 👥',
    subtitle: 'Team बनवा, जास्त कमवा',
    description: 'तुमचा referral code share करा. तुमच्या 5 levels पर्यंतच्या team च्या mining वर bonus मिळतो!',
    animation: <AnimatedNetwork />,
    mascot: { emotion: 'excited', message: 'Team बनवा!' },
    color: 'from-blue-600 to-cyan-500',
    tips: ['Level 1: Direct referrals', 'Level 2-5: Indirect bonus', 'Active referrals = जास्त bonus']
  },
  {
    id: 'rain',
    title: 'PRC Rain Drop 🌧️',
    subtitle: 'Surprise rewards!',
    description: 'Random वेळी colorful drops पडतात. Tap करा आणि PRC जिंका! पण सावधान - काही drops negative असतात! 🎲',
    animation: <AnimatedRain />,
    mascot: { emotion: 'celebrating', message: 'Tap करा! 🎯' },
    color: 'from-indigo-600 to-purple-600',
    tips: ['कोणताही color = surprise PRC', 'जितके जास्त taps, तितके जास्त chances', 'Daily limit आहे']
  },
  {
    id: 'marketplace',
    title: 'Marketplace 🛒',
    subtitle: 'PRC ने shopping करा',
    description: 'तुमचे PRC वापरून real products खरेदी करा. VIP members साठी exclusive deals!',
    animation: <AnimatedShop />,
    mascot: { emotion: 'rich', message: 'Shopping time!' },
    color: 'from-green-600 to-teal-500',
    tips: ['PRC = Real value', 'Home delivery available', 'VIP exclusive products']
  },
  {
    id: 'redeem',
    title: 'Gift Vouchers & Bill Pay 🎁',
    subtitle: 'PRC चे रुपये करा',
    description: 'PhonePe vouchers घ्या किंवा Mobile/Electricity bills भरा - सर्व PRC ने!',
    animation: <AnimatedGift />,
    mascot: { emotion: 'happy', message: 'Rewards मिळवा!' },
    color: 'from-pink-600 to-rose-500',
    tips: ['₹100 पासून vouchers', 'Bills instant pay', 'KYC verified असणे आवश्यक']
  },
  {
    id: 'vip',
    title: 'VIP Membership 👑',
    subtitle: 'Premium benefits unlock करा',
    description: 'VIP बना आणि 2x mining, marketplace access, gift vouchers, bill payments सर्व unlock करा!',
    animation: (
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
    ),
    mascot: { emotion: 'cool', message: 'VIP बना!' },
    color: 'from-amber-500 to-yellow-600',
    tips: ['Monthly/Quarterly/Yearly plans', 'सर्व features unlock', 'Priority support']
  },
  {
    id: 'ready',
    title: 'तुम्ही Ready आहात! 🚀',
    subtitle: 'आता सुरुवात करा',
    description: 'Dashboard वर जा आणि तुमचा reward journey सुरू करा. शुभेच्छा! 🍀',
    animation: (
      <motion.div 
        className="w-32 h-32 mx-auto flex items-center justify-center"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
          <Check className="w-12 h-12 text-white" />
        </div>
      </motion.div>
    ),
    mascot: { emotion: 'celebrating', message: 'Let\'s go! 🚀' },
    color: 'from-green-500 to-emerald-600',
    tips: ['Daily login bonus', 'Refer & earn', 'Support: Help section मध्ये']
  }
];

const AppTutorial = ({ onComplete, showSkip = true }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

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
        className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Header with gradient */}
        <div className={`bg-gradient-to-r ${slide.color} p-6 text-white relative`}>
          {showSkip && (
            <button
              onClick={handleComplete}
              className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
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
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{slide.title}</h2>
              <p className="text-sm text-gray-500 mb-3">{slide.subtitle}</p>
              <p className="text-gray-700 mb-4">{slide.description}</p>

              {/* Tips */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">💡 Tips:</p>
                <ul className="space-y-1">
                  {slide.tips.map((tip, idx) => (
                    <motion.li
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="text-sm text-gray-600 flex items-center gap-2"
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
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>

            <span className="text-sm text-gray-400">
              {currentSlide + 1} / {tutorialSlides.length}
            </span>

            <Button
              onClick={nextSlide}
              className={`bg-gradient-to-r ${slide.color} text-white flex items-center gap-1`}
            >
              {currentSlide === tutorialSlides.length - 1 ? 'Start' : 'Next'}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AppTutorial;
