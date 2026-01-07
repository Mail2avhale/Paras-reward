import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { 
  ChevronRight, ChevronLeft, X, Coins, Users, ShoppingBag, 
  Gift, Zap, TrendingUp, Smartphone, Check,
  Sparkles, Star, Crown, Rocket, Globe, Bot, Gamepad2,
  ArrowRight, Play, Volume2
} from 'lucide-react';
import { Button } from './ui/button';
import { useLanguage } from '../contexts/LanguageContext';

// ============================================
// FLOATING PARTICLES BACKGROUND
// ============================================
const FloatingParticles = ({ color = 'white', count = 20 }) => {
  const particles = useMemo(() => 
    Array.from({ length: count }, (_, i) => ({
      id: i,
      size: Math.random() * 6 + 2,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 10 + 10,
      delay: Math.random() * 5,
    })), [count]
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            background: color === 'white' 
              ? 'rgba(255,255,255,0.3)' 
              : `rgba(139, 92, 246, 0.3)`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.2, 0.6, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

// ============================================
// MESH GRADIENT BACKGROUND
// ============================================
const MeshGradientBg = ({ colors, animate = true }) => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient */}
      <div 
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2] || colors[1]} 100%)`,
        }}
      />
      
      {/* Animated mesh blobs */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full opacity-40 blur-3xl"
        style={{
          background: `radial-gradient(circle, ${colors[0]} 0%, transparent 70%)`,
          top: '-200px',
          left: '-200px',
        }}
        animate={animate ? {
          scale: [1, 1.2, 1],
          x: [0, 50, 0],
          y: [0, 30, 0],
        } : {}}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full opacity-30 blur-3xl"
        style={{
          background: `radial-gradient(circle, ${colors[1]} 0%, transparent 70%)`,
          bottom: '-150px',
          right: '-150px',
        }}
        animate={animate ? {
          scale: [1.2, 1, 1.2],
          x: [0, -40, 0],
          y: [0, -20, 0],
        } : {}}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full opacity-25 blur-3xl"
        style={{
          background: `radial-gradient(circle, ${colors[2] || '#ffffff'} 0%, transparent 70%)`,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        animate={animate ? {
          scale: [1, 1.3, 1],
        } : {}}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
};

// ============================================
// GLASSMORPHISM CARD
// ============================================
const GlassCard = ({ children, className = '', intensity = 'medium' }) => {
  const bgOpacity = intensity === 'high' ? '0.25' : intensity === 'low' ? '0.1' : '0.15';
  return (
    <div 
      className={`relative backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl ${className}`}
      style={{
        background: `rgba(255, 255, 255, ${bgOpacity})`,
      }}
    >
      {children}
    </div>
  );
};

// ============================================
// ANIMATED 3D COIN
// ============================================
const Animated3DCoin = () => {
  return (
    <div className="relative w-32 h-32 mx-auto perspective-1000">
      <motion.div
        className="relative w-28 h-28 mx-auto"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ 
          rotateY: [0, 360],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      >
        {/* Coin front */}
        <div 
          className="absolute inset-0 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(145deg, #ffd700, #ffaa00, #ff8c00)',
            boxShadow: '0 0 40px rgba(255, 215, 0, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.3)',
            backfaceVisibility: 'hidden',
          }}
        >
          <span className="text-5xl font-black text-yellow-900 drop-shadow-lg">₿</span>
        </div>
        {/* Coin back */}
        <div 
          className="absolute inset-0 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(145deg, #ff8c00, #ffaa00, #ffd700)',
            boxShadow: '0 0 40px rgba(255, 215, 0, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.3)',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <Star className="w-12 h-12 text-yellow-900" />
        </div>
      </motion.div>
      
      {/* Sparkles around coin */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            top: '50%',
            left: '50%',
          }}
          animate={{
            x: [0, Math.cos((i * 60 * Math.PI) / 180) * 70],
            y: [0, Math.sin((i * 60 * Math.PI) / 180) * 70],
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
          }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
        >
          <Sparkles className="w-4 h-4 text-yellow-300" />
        </motion.div>
      ))}
    </div>
  );
};

// ============================================
// MINING ANIMATION (Advanced)
// ============================================
const AdvancedMiningAnimation = () => {
  return (
    <div className="relative w-36 h-36 mx-auto">
      {/* Glowing core */}
      <motion.div
        className="absolute inset-0 rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, #8b5cf6, #6366f1, #3b82f6)',
          boxShadow: '0 0 60px rgba(139, 92, 246, 0.6)',
        }}
        animate={{
          boxShadow: [
            '0 0 30px rgba(139, 92, 246, 0.4)',
            '0 0 60px rgba(139, 92, 246, 0.8)',
            '0 0 30px rgba(139, 92, 246, 0.4)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      
      {/* Icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Zap className="w-16 h-16 text-yellow-300 drop-shadow-lg" />
        </motion.div>
      </div>
      
      {/* Floating coins */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl"
          style={{
            top: '50%',
            left: `${20 + i * 20}%`,
          }}
          animate={{
            y: [0, -60, -80],
            opacity: [0, 1, 0],
            scale: [0.5, 1, 0.8],
          }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4 }}
        >
          🪙
        </motion.div>
      ))}
      
      {/* +PRC indicator */}
      <motion.div
        className="absolute -top-2 -right-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold"
        animate={{ scale: [1, 1.2, 1], y: [0, -5, 0] }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        +5 PRC
      </motion.div>
    </div>
  );
};

// ============================================
// NETWORK ANIMATION (Advanced)
// ============================================
const AdvancedNetworkAnimation = () => {
  return (
    <div className="relative w-40 h-40 mx-auto">
      {/* Center hub */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full z-10 flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
          boxShadow: '0 0 40px rgba(59, 130, 246, 0.5)',
        }}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Users className="w-8 h-8 text-white" />
      </motion.div>
      
      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full">
        {[0, 72, 144, 216, 288].map((angle, i) => (
          <motion.line
            key={i}
            x1="50%"
            y1="50%"
            x2={`${50 + Math.cos((angle * Math.PI) / 180) * 45}%`}
            y2={`${50 + Math.sin((angle * Math.PI) / 180) * 45}%`}
            stroke="rgba(59, 130, 246, 0.4)"
            strokeWidth="2"
            strokeDasharray="5,5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: i * 0.2 }}
          />
        ))}
      </svg>
      
      {/* Orbiting nodes */}
      {[0, 72, 144, 216, 288].map((angle, i) => (
        <motion.div
          key={i}
          className="absolute w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
          style={{
            background: ['#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'][i],
            boxShadow: `0 0 20px ${['#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'][i]}50`,
            top: `${50 + Math.sin((angle * Math.PI) / 180) * 40}%`,
            left: `${50 + Math.cos((angle * Math.PI) / 180) * 40}%`,
            transform: 'translate(-50%, -50%)',
          }}
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        >
          {i + 1}
        </motion.div>
      ))}
    </div>
  );
};

// ============================================
// MARKETPLACE ANIMATION (Advanced)
// ============================================
const AdvancedMarketplaceAnimation = () => {
  const products = ['📱', '🎧', '⌚', '💻'];
  
  return (
    <div className="relative w-36 h-36 mx-auto">
      {/* Shopping bag */}
      <motion.div
        className="relative mx-auto w-24 h-28"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div 
          className="absolute inset-0 rounded-b-3xl"
          style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            boxShadow: '0 10px 40px rgba(16, 185, 129, 0.4)',
          }}
        />
        {/* Bag handle */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-6 border-4 border-emerald-700 rounded-t-full" />
        <ShoppingBag className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 text-white/80" />
      </motion.div>
      
      {/* Flying products */}
      {products.map((emoji, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl"
          style={{
            top: '30%',
            left: `${10 + i * 22}%`,
          }}
          animate={{
            y: [20, -40, -60],
            x: [0, (i - 1.5) * 10, (i - 1.5) * 15],
            opacity: [0, 1, 0],
            rotate: [0, 360],
          }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
        >
          {emoji}
        </motion.div>
      ))}
    </div>
  );
};

// ============================================
// GAMES ANIMATION (Advanced)
// ============================================
const AdvancedGamesAnimation = () => {
  return (
    <div className="relative w-36 h-36 mx-auto">
      {/* Game controller */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ rotate: [-5, 5, -5], scale: [1, 1.05, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <div 
          className="w-24 h-20 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
            boxShadow: '0 10px 40px rgba(244, 63, 94, 0.4)',
          }}
        >
          <Gamepad2 className="w-12 h-12 text-white" />
        </div>
      </motion.div>
      
      {/* Flying rewards */}
      {['🎁', '💰', '⭐', '🏆'].map((emoji, i) => (
        <motion.div
          key={i}
          className="absolute text-xl"
          style={{
            top: '50%',
            left: '50%',
          }}
          animate={{
            x: [0, Math.cos((i * 90 * Math.PI) / 180) * 60],
            y: [0, Math.sin((i * 90 * Math.PI) / 180) * 60],
            opacity: [0, 1, 0],
            scale: [0.5, 1.2, 0.5],
          }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.25 }}
        >
          {emoji}
        </motion.div>
      ))}
    </div>
  );
};

// ============================================
// VIP ANIMATION (Advanced)
// ============================================
const AdvancedVIPAnimation = () => {
  return (
    <div className="relative w-36 h-36 mx-auto">
      {/* Crown glow */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ 
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div 
          className="w-28 h-28 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)',
            boxShadow: '0 0 60px rgba(251, 191, 36, 0.6)',
          }}
        >
          <motion.div
            animate={{ y: [0, -5, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Crown className="w-14 h-14 text-yellow-900" />
          </motion.div>
        </div>
      </motion.div>
      
      {/* Sparkle ring */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-3 h-3 bg-yellow-300 rounded-full"
          style={{
            top: '50%',
            left: '50%',
          }}
          animate={{
            x: [0, Math.cos((i * 45 * Math.PI) / 180) * 75],
            y: [0, Math.sin((i * 45 * Math.PI) / 180) * 75],
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
          }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
      
      {/* VIP Badge */}
      <motion.div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        VIP ✨
      </motion.div>
    </div>
  );
};

// ============================================
// AI BOT ANIMATION (Advanced)
// ============================================
const AdvancedAIAnimation = () => {
  return (
    <div className="relative w-36 h-36 mx-auto">
      {/* AI Bot head */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div 
          className="w-24 h-24 rounded-3xl flex items-center justify-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #8b5cf6, #a855f7, #d946ef)',
            boxShadow: '0 10px 40px rgba(139, 92, 246, 0.5)',
          }}
        >
          <Bot className="w-12 h-12 text-white" />
          
          {/* Scanning line */}
          <motion.div
            className="absolute inset-x-0 h-1 bg-white/50"
            animate={{ top: ['0%', '100%', '0%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </motion.div>
      
      {/* Chat bubbles */}
      {['💬', '🤖', '✨'].map((emoji, i) => (
        <motion.div
          key={i}
          className="absolute text-lg bg-white/90 p-2 rounded-xl shadow-lg"
          style={{
            top: `${20 + i * 15}%`,
            left: i % 2 === 0 ? '-10%' : '80%',
          }}
          animate={{
            opacity: [0, 1, 1, 0],
            x: i % 2 === 0 ? [-20, 0, 0, -20] : [20, 0, 0, 20],
            scale: [0.8, 1, 1, 0.8],
          }}
          transition={{ duration: 3, repeat: Infinity, delay: i * 0.8 }}
        >
          {emoji}
        </motion.div>
      ))}
    </div>
  );
};

// ============================================
// SUCCESS ANIMATION (Advanced)
// ============================================
const AdvancedSuccessAnimation = () => {
  return (
    <div className="relative w-36 h-36 mx-auto">
      {/* Success circle */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        <motion.div 
          className="w-28 h-28 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #22c55e, #16a34a, #15803d)',
            boxShadow: '0 0 50px rgba(34, 197, 94, 0.5)',
          }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            <Check className="w-14 h-14 text-white" strokeWidth={3} />
          </motion.div>
        </motion.div>
      </motion.div>
      
      {/* Confetti */}
      {['🎉', '🎊', '⭐', '✨', '🌟', '💫'].map((emoji, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl"
          style={{
            top: '50%',
            left: '50%',
          }}
          animate={{
            x: [0, Math.cos((i * 60 * Math.PI) / 180) * 80],
            y: [0, Math.sin((i * 60 * Math.PI) / 180) * 80 - 20],
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
            rotate: [0, 360],
          }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
        >
          {emoji}
        </motion.div>
      ))}
    </div>
  );
};

// ============================================
// LANGUAGE SELECTION (Advanced)
// ============================================
const AdvancedLanguageSelection = ({ onSelect, onSkip }) => {
  const languages = [
    { code: 'mr', name: 'मराठी', subtitle: 'Marathi', emoji: '🇮🇳', gradient: ['#ff6b35', '#f7c59f'] },
    { code: 'hi', name: 'हिंदी', subtitle: 'Hindi', emoji: '🇮🇳', gradient: ['#2ecc71', '#27ae60'] },
    { code: 'en', name: 'English', subtitle: 'English', emoji: '🌐', gradient: ['#3498db', '#2980b9'] },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Background */}
      <MeshGradientBg colors={['#1a1a2e', '#16213e', '#0f3460']} />
      <FloatingParticles color="white" count={30} />
      
      {/* Content */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative z-10 w-full max-w-md"
      >
        <GlassCard className="overflow-hidden" intensity="medium">
          {/* Header */}
          <div className="relative p-8 text-center">
            <button
              onClick={onSkip}
              className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-all"
              data-testid="language-skip-btn"
            >
              <X className="w-5 h-5 text-white/70" />
            </button>
            
            {/* Animated Globe */}
            <motion.div 
              className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05))',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              }}
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <Globe className="w-10 h-10 text-white" />
            </motion.div>
            
            <h2 className="text-3xl font-bold text-white mb-2">Choose Language</h2>
            <p className="text-white/60 text-sm">भाषा निवडा • भाषा चुनें</p>
          </div>

          {/* Language Options */}
          <div className="p-6 pt-0 space-y-3">
            {languages.map((lang, i) => (
              <motion.button
                key={lang.code}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.1 }}
                onClick={() => onSelect(lang.code)}
                className="w-full p-4 rounded-2xl transition-all group relative overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                whileHover={{ scale: 1.02, background: 'rgba(255,255,255,0.15)' }}
                whileTap={{ scale: 0.98 }}
                data-testid={`language-option-${lang.code}`}
              >
                <div className="flex items-center gap-4 relative z-10">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{
                      background: `linear-gradient(135deg, ${lang.gradient[0]}, ${lang.gradient[1]})`,
                    }}
                  >
                    {lang.emoji}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-lg font-bold text-white">{lang.name}</p>
                    <p className="text-sm text-white/50">{lang.subtitle}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
              </motion.button>
            ))}
            
            <p className="text-center text-xs text-white/40 mt-4">
              You can change this anytime in Settings
            </p>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};

// ============================================
// TUTORIAL SLIDES DATA
// ============================================
const getTutorialSlides = (t) => [
  {
    id: 'welcome',
    title: t('tutorialWelcomeTitle') || 'Welcome to PARAS REWARD! 🎉',
    subtitle: t('tutorialWelcomeSubtitle') || 'Your journey to earning starts here',
    description: t('tutorialWelcomeDesc') || 'Earn PRC coins by mining, playing games, and referring friends. Redeem for real products!',
    animation: <Animated3DCoin />,
    colors: ['#fbbf24', '#f59e0b', '#d97706'],
    icon: Coins,
    tips: [
      t('tutorialWelcomeTip1') || '🎁 Earn daily rewards automatically',
      t('tutorialWelcomeTip2') || '🔄 Coins never expire',
      t('tutorialWelcomeTip3') || '💯 100% free to use',
    ],
  },
  {
    id: 'mining',
    title: t('tutorialMiningTitle') || 'Start Mining ⚡',
    subtitle: t('tutorialMiningSubtitle') || 'Earn PRC every second',
    description: t('tutorialMiningDesc') || 'Tap the mining button and watch your PRC grow. The longer you mine, the more you earn!',
    animation: <AdvancedMiningAnimation />,
    colors: ['#8b5cf6', '#6366f1', '#4f46e5'],
    icon: Zap,
    tips: [
      t('tutorialMiningTip1') || '⛏️ Mine up to 8 hours non-stop',
      t('tutorialMiningTip2') || '📈 VIP members earn 2x faster',
      t('tutorialMiningTip3') || '🔔 Get notified when mining stops',
    ],
  },
  {
    id: 'referral',
    title: t('tutorialReferralTitle') || 'Invite & Earn 👥',
    subtitle: t('tutorialReferralSubtitle') || 'Build your team',
    description: t('tutorialReferralDesc') || 'Share your referral code and earn bonus PRC for every friend who joins!',
    animation: <AdvancedNetworkAnimation />,
    colors: ['#06b6d4', '#0891b2', '#0e7490'],
    icon: Users,
    tips: [
      t('tutorialReferralTip1') || '👥 Earn 100 PRC per referral',
      t('tutorialReferralTip2') || '🔗 Share via WhatsApp, SMS, etc.',
      t('tutorialReferralTip3') || '🏆 Top referrers get special rewards',
    ],
  },
  {
    id: 'marketplace',
    title: t('tutorialMarketplaceTitle') || 'Redeem Rewards 🛒',
    subtitle: t('tutorialMarketplaceSubtitle') || 'Shop with your PRC',
    description: t('tutorialMarketplaceDesc') || 'Browse our marketplace and redeem your coins for amazing products and vouchers!',
    animation: <AdvancedMarketplaceAnimation />,
    colors: ['#10b981', '#059669', '#047857'],
    icon: ShoppingBag,
    tips: [
      t('tutorialMarketplaceTip1') || '📱 Phones, gadgets & more',
      t('tutorialMarketplaceTip2') || '🎫 Gift vouchers available',
      t('tutorialMarketplaceTip3') || '🚚 Free delivery on orders',
    ],
  },
  {
    id: 'games',
    title: t('tutorialGamesTitle') || 'Play & Win 🎮',
    subtitle: t('tutorialGamesSubtitle') || 'Fun ways to earn',
    description: t('tutorialGamesDesc') || 'Play exciting games like Tap Challenge and Scratch Cards to win bonus PRC!',
    animation: <AdvancedGamesAnimation />,
    colors: ['#f43f5e', '#e11d48', '#be123c'],
    icon: Gamepad2,
    tips: [
      t('tutorialGamesTip1') || '🎯 Daily tap challenges',
      t('tutorialGamesTip2') || '🎰 Lucky scratch cards',
      t('tutorialGamesTip3') || '🏅 Win up to 500 PRC',
    ],
  },
  {
    id: 'vip',
    title: t('tutorialVipTitle') || 'Go VIP 👑',
    subtitle: t('tutorialVipSubtitle') || 'Unlock premium benefits',
    description: t('tutorialVipDesc') || 'Upgrade to VIP for exclusive perks: 2x mining speed, priority support, and special rewards!',
    animation: <AdvancedVIPAnimation />,
    colors: ['#fbbf24', '#f59e0b', '#d97706'],
    icon: Crown,
    tips: [
      t('tutorialVipTip1') || '⚡ 2x mining speed',
      t('tutorialVipTip2') || '🎁 Exclusive VIP rewards',
      t('tutorialVipTip3') || '💎 Priority customer support',
    ],
  },
  {
    id: 'ai',
    title: t('tutorialAITitle') || 'AI Assistant 🤖',
    subtitle: t('tutorialAISubtitle') || 'Help anytime you need',
    description: t('tutorialAIDesc') || 'Got questions? Our AI assistant is always ready to help you navigate the app!',
    animation: <AdvancedAIAnimation />,
    colors: ['#8b5cf6', '#a855f7', '#d946ef'],
    icon: Bot,
    tips: [
      t('tutorialAITip1') || '💬 Ask anything, anytime',
      t('tutorialAITip2') || '🌐 Available in Marathi, Hindi, English',
      t('tutorialAITip3') || '🎓 Learn app features easily',
    ],
  },
  {
    id: 'ready',
    title: t('tutorialReadyTitle') || "You're Ready! 🚀",
    subtitle: t('tutorialReadySubtitle') || 'Start earning now',
    description: t('tutorialReadyDesc') || 'You know everything you need! Tap below to start your earning journey.',
    animation: <AdvancedSuccessAnimation />,
    colors: ['#22c55e', '#16a34a', '#15803d'],
    icon: Rocket,
    tips: [
      t('tutorialReadyTip1') || '✅ Start mining immediately',
      t('tutorialReadyTip2') || '📱 Complete your profile for bonuses',
      t('tutorialReadyTip3') || '🎉 Enjoy earning with PARAS REWARD!',
    ],
  },
];

// ============================================
// MAIN TUTORIAL COMPONENT
// ============================================
const AppTutorialAdvanced = ({ onComplete, showSkip = true }) => {
  const [showLanguageSelect, setShowLanguageSelect] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);
  const { t, language, changeLanguage } = useLanguage();
  
  const tutorialSlides = useMemo(() => getTutorialSlides(t), [t, language]);

  const handleLanguageSelect = useCallback((langCode) => {
    changeLanguage(langCode);
    setShowLanguageSelect(false);
  }, [changeLanguage]);

  const handleSkipLanguage = useCallback(() => {
    setShowLanguageSelect(false);
  }, []);

  const nextSlide = useCallback(() => {
    if (currentSlide < tutorialSlides.length - 1) {
      setDirection(1);
      setCurrentSlide(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentSlide, tutorialSlides.length]);

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide(prev => prev - 1);
    }
  }, [currentSlide]);

  const handleComplete = useCallback(() => {
    localStorage.setItem('tutorial_completed', 'true');
    if (onComplete) onComplete();
  }, [onComplete]);

  const goToSlide = useCallback((index) => {
    setDirection(index > currentSlide ? 1 : -1);
    setCurrentSlide(index);
  }, [currentSlide]);

  // Language selection
  if (showLanguageSelect) {
    return (
      <AdvancedLanguageSelection 
        onSelect={handleLanguageSelect}
        onSkip={handleSkipLanguage}
      />
    );
  }

  const slide = tutorialSlides[currentSlide];
  const isLastSlide = currentSlide === tutorialSlides.length - 1;

  const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? 300 : -300, opacity: 0, scale: 0.9 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (dir) => ({ x: dir < 0 ? 300 : -300, opacity: 0, scale: 0.9 }),
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Dynamic background */}
      <MeshGradientBg colors={slide.colors} animate={true} />
      <FloatingParticles color="white" count={25} />
      
      {/* Main card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 w-full max-w-md"
      >
        <GlassCard className="overflow-hidden" intensity="medium">
          {/* Skip button */}
          {showSkip && (
            <button
              onClick={handleComplete}
              className="absolute top-4 right-4 z-20 p-2 hover:bg-white/20 rounded-full transition-all"
              data-testid="tutorial-skip-btn"
            >
              <X className="w-5 h-5 text-white/70" />
            </button>
          )}
          
          {/* Progress bar */}
          <div className="relative h-1 bg-white/10">
            <motion.div 
              className="absolute h-full bg-white/80 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentSlide + 1) / tutorialSlides.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 pt-4 pb-2">
            {tutorialSlides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goToSlide(idx)}
                className="focus:outline-none"
                data-testid={`tutorial-progress-dot-${idx}`}
              >
                <motion.div
                  className={`h-2 rounded-full transition-all ${
                    idx === currentSlide ? 'bg-white w-8' : 'bg-white/30 w-2'
                  }`}
                  whileHover={{ scale: 1.2 }}
                />
              </button>
            ))}
          </div>

          {/* Animation area */}
          <div className="relative h-48 overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentSlide}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="absolute inset-0 flex items-center justify-center"
              >
                {slide.animation}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Content */}
          <div className="p-6 pt-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Title */}
                <h2 
                  className="text-2xl font-bold text-white mb-1 text-center"
                  data-testid="tutorial-slide-title"
                >
                  {slide.title}
                </h2>
                <p 
                  className="text-white/60 text-sm mb-4 text-center"
                  data-testid="tutorial-slide-subtitle"
                >
                  {slide.subtitle}
                </p>
                <p 
                  className="text-white/80 text-center mb-6"
                  data-testid="tutorial-slide-description"
                >
                  {slide.description}
                </p>

                {/* Tips */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-6">
                  <ul className="space-y-2">
                    {slide.tips.map((tip, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="text-sm text-white/90 flex items-center gap-2"
                        data-testid={`tutorial-tip-${idx}`}
                      >
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
                className="text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
                data-testid="tutorial-prev-btn"
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                {t('tutorialPrev') || 'Back'}
              </Button>

              <span className="text-sm text-white/50" data-testid="tutorial-slide-counter">
                {currentSlide + 1} / {tutorialSlides.length}
              </span>

              <Button
                onClick={nextSlide}
                className="bg-white text-gray-900 hover:bg-white/90 font-semibold px-6"
                data-testid="tutorial-next-btn"
              >
                {isLastSlide ? (t('tutorialStart') || "Let's Go!") : (t('tutorialNext') || 'Next')}
                {isLastSlide ? <Rocket className="w-4 h-4 ml-2" /> : <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};

export default AppTutorialAdvanced;
