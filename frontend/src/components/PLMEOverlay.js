import React, { useState, useEffect, useCallback, useRef } from 'react';
import Lottie from 'lottie-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// Fallback Lottie animations (embedded JSON for reliability)
const FALLBACK_ANIMATIONS = {
  cute_playful: {
    // Simple bouncing circle animation
    v: "5.5.7",
    fr: 30,
    ip: 0,
    op: 60,
    w: 200,
    h: 200,
    assets: [],
    layers: [{
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Circle",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 1, k: [
          { t: 0, s: [100, 150], e: [100, 50] },
          { t: 15, s: [100, 50], e: [100, 150] },
          { t: 30, s: [100, 150], e: [100, 50] },
          { t: 45, s: [100, 50], e: [100, 150] },
          { t: 60, s: [100, 150] }
        ]},
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] }
      },
      shapes: [{
        ty: "el",
        p: { a: 0, k: [0, 0] },
        s: { a: 0, k: [60, 60] }
      }, {
        ty: "fl",
        c: { a: 0, k: [1, 0.6, 0.2, 1] },
        o: { a: 0, k: 100 }
      }]
    }]
  },
  calm_nature: {
    // Simple floating dots animation
    v: "5.5.7",
    fr: 30,
    ip: 0,
    op: 90,
    w: 200,
    h: 200,
    assets: [],
    layers: [{
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Dot1",
      ks: {
        o: { a: 1, k: [{ t: 0, s: [100] }, { t: 45, s: [30] }, { t: 90, s: [100] }] },
        p: { a: 1, k: [{ t: 0, s: [50, 180] }, { t: 90, s: [50, 20] }] },
        s: { a: 0, k: [100, 100] }
      },
      shapes: [{ ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [15, 15] } }, { ty: "fl", c: { a: 0, k: [0.4, 0.8, 1, 1] } }]
    }, {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: "Dot2",
      ks: {
        o: { a: 1, k: [{ t: 0, s: [80] }, { t: 45, s: [20] }, { t: 90, s: [80] }] },
        p: { a: 1, k: [{ t: 0, s: [100, 190] }, { t: 90, s: [100, 10] }] },
        s: { a: 0, k: [100, 100] }
      },
      shapes: [{ ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [12, 12] } }, { ty: "fl", c: { a: 0, k: [0.6, 0.9, 1, 1] } }]
    }, {
      ddd: 0,
      ind: 3,
      ty: 4,
      nm: "Dot3",
      ks: {
        o: { a: 1, k: [{ t: 0, s: [60] }, { t: 45, s: [100] }, { t: 90, s: [60] }] },
        p: { a: 1, k: [{ t: 0, s: [150, 170] }, { t: 90, s: [150, 30] }] },
        s: { a: 0, k: [100, 100] }
      },
      shapes: [{ ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [10, 10] } }, { ty: "fl", c: { a: 0, k: [0.5, 0.85, 1, 1] } }]
    }]
  }
};

// Cute character SVG components as fallback
const CuteCharacters = {
  dog: () => (
    <svg viewBox="0 0 100 100" className="w-24 h-24">
      <circle cx="50" cy="55" r="30" fill="#F4A460"/>
      <circle cx="35" cy="45" r="8" fill="#8B4513"/>
      <circle cx="65" cy="45" r="8" fill="#8B4513"/>
      <circle cx="37" cy="43" r="3" fill="white"/>
      <circle cx="67" cy="43" r="3" fill="white"/>
      <ellipse cx="50" cy="60" rx="8" ry="5" fill="#8B4513"/>
      <path d="M42 70 Q50 78 58 70" stroke="#8B4513" strokeWidth="2" fill="none"/>
      <ellipse cx="25" cy="35" rx="10" ry="15" fill="#F4A460"/>
      <ellipse cx="75" cy="35" rx="10" ry="15" fill="#F4A460"/>
    </svg>
  ),
  cat: () => (
    <svg viewBox="0 0 100 100" className="w-24 h-24">
      <circle cx="50" cy="55" r="28" fill="#808080"/>
      <polygon points="25,30 35,55 15,55" fill="#808080"/>
      <polygon points="75,30 85,55 65,55" fill="#808080"/>
      <circle cx="38" cy="50" r="6" fill="#90EE90"/>
      <circle cx="62" cy="50" r="6" fill="#90EE90"/>
      <circle cx="40" cy="48" r="3" fill="black"/>
      <circle cx="64" cy="48" r="3" fill="black"/>
      <ellipse cx="50" cy="62" rx="5" ry="3" fill="#FFB6C1"/>
      <line x1="20" y1="55" x2="35" y2="58" stroke="#808080" strokeWidth="2"/>
      <line x1="20" y1="60" x2="35" y2="60" stroke="#808080" strokeWidth="2"/>
      <line x1="80" y1="55" x2="65" y2="58" stroke="#808080" strokeWidth="2"/>
      <line x1="80" y1="60" x2="65" y2="60" stroke="#808080" strokeWidth="2"/>
    </svg>
  ),
  bunny: () => (
    <svg viewBox="0 0 100 100" className="w-24 h-24">
      <ellipse cx="50" cy="65" rx="25" ry="20" fill="white"/>
      <ellipse cx="35" cy="25" rx="8" ry="25" fill="white"/>
      <ellipse cx="65" cy="25" rx="8" ry="25" fill="white"/>
      <ellipse cx="35" cy="25" rx="4" ry="20" fill="#FFB6C1"/>
      <ellipse cx="65" cy="25" rx="4" ry="20" fill="#FFB6C1"/>
      <circle cx="40" cy="60" r="5" fill="black"/>
      <circle cx="60" cy="60" r="5" fill="black"/>
      <circle cx="42" cy="58" r="2" fill="white"/>
      <circle cx="62" cy="58" r="2" fill="white"/>
      <ellipse cx="50" cy="70" rx="4" ry="3" fill="#FFB6C1"/>
    </svg>
  ),
  butterfly: () => (
    <svg viewBox="0 0 100 100" className="w-24 h-24">
      <ellipse cx="50" cy="50" rx="5" ry="20" fill="#8B4513"/>
      <ellipse cx="30" cy="40" rx="20" ry="15" fill="#FF69B4" opacity="0.8"/>
      <ellipse cx="70" cy="40" rx="20" ry="15" fill="#FF69B4" opacity="0.8"/>
      <ellipse cx="30" cy="60" rx="15" ry="12" fill="#FFB6C1" opacity="0.8"/>
      <ellipse cx="70" cy="60" rx="15" ry="12" fill="#FFB6C1" opacity="0.8"/>
      <circle cx="25" cy="38" r="4" fill="#FF1493"/>
      <circle cx="75" cy="38" r="4" fill="#FF1493"/>
      <line x1="45" y1="30" x2="40" y2="20" stroke="#8B4513" strokeWidth="2"/>
      <line x1="55" y1="30" x2="60" y2="20" stroke="#8B4513" strokeWidth="2"/>
    </svg>
  ),
  cloud: () => (
    <svg viewBox="0 0 120 80" className="w-28 h-20">
      <ellipse cx="40" cy="50" rx="25" ry="20" fill="white"/>
      <ellipse cx="70" cy="50" rx="30" ry="25" fill="white"/>
      <ellipse cx="100" cy="55" rx="20" ry="15" fill="white"/>
      <circle cx="35" cy="45" r="4" fill="#333"/>
      <circle cx="55" cy="45" r="4" fill="#333"/>
      <path d="M40 55 Q45 60 50 55" stroke="#333" strokeWidth="2" fill="none"/>
    </svg>
  )
};

const PLMEOverlay = ({ user }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentMoment, setCurrentMoment] = useState(null);
  const [animationData, setAnimationData] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [useFallback, setUseFallback] = useState(false);
  const timeoutRef = useRef(null);
  const hasTriggeredRef = useRef(false);

  // Random position generator
  const getRandomPosition = useCallback(() => {
    const positions = [
      { x: '10%', y: '20%' },
      { x: '70%', y: '15%' },
      { x: '5%', y: '50%' },
      { x: '75%', y: '45%' },
      { x: '15%', y: '70%' },
      { x: '65%', y: '65%' },
      { x: '40%', y: '30%' },
      { x: '50%', y: '60%' },
    ];
    return positions[Math.floor(Math.random() * positions.length)];
  }, []);

  // Fetch next moment
  const fetchNextMoment = useCallback(async () => {
    if (!user?.uid || hasTriggeredRef.current) return;
    
    try {
      const response = await axios.get(`${API}/api/plme/next-moment/${user.uid}`);
      
      if (response.data?.show_moment && response.data?.moment) {
        const moment = response.data.moment;
        setCurrentMoment(moment);
        
        // Schedule the moment to appear
        const triggerDelay = (moment.trigger_delay || 60) * 1000;
        
        timeoutRef.current = setTimeout(async () => {
          hasTriggeredRef.current = true;
          
          // Try to load Lottie animation
          try {
            const animResponse = await fetch(moment.url);
            if (animResponse.ok) {
              const animJson = await animResponse.json();
              setAnimationData(animJson);
              setUseFallback(false);
            } else {
              throw new Error('Failed to load animation');
            }
          } catch (err) {
            // Use fallback animation
            setAnimationData(FALLBACK_ANIMATIONS[moment.category] || FALLBACK_ANIMATIONS.cute_playful);
            setUseFallback(true);
          }
          
          setPosition(getRandomPosition());
          setIsVisible(true);
          
          // Auto-hide after duration
          const duration = (moment.duration || 15) * 1000;
          setTimeout(() => {
            setIsVisible(false);
            
            // Record view
            axios.post(`${API}/api/plme/record-view/${user.uid}`, {
              asset_id: moment.id,
              reward: moment.reward || 0
            }).catch(console.error);
            
            // Reset for next trigger
            setTimeout(() => {
              hasTriggeredRef.current = false;
              fetchNextMoment();
            }, 30000); // Wait 30 seconds before potentially showing another
            
          }, duration);
          
        }, triggerDelay);
      }
    } catch (error) {
      console.error('PLME fetch error:', error);
    }
  }, [user?.uid, getRandomPosition]);

  // Initial fetch
  useEffect(() => {
    const initialDelay = setTimeout(() => {
      fetchNextMoment();
    }, 5000); // Wait 5 seconds after mount
    
    return () => {
      clearTimeout(initialDelay);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fetchNextMoment]);

  // Handle tap interaction
  const handleTap = () => {
    // Small bounce animation on tap
    const overlay = document.getElementById('plme-animation');
    if (overlay) {
      overlay.style.transform = 'scale(1.2)';
      setTimeout(() => {
        overlay.style.transform = 'scale(1)';
      }, 200);
    }
  };

  if (!isVisible || !currentMoment) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="fixed z-50 pointer-events-auto"
        style={{ left: position.x, top: position.y }}
        onClick={handleTap}
        data-testid="plme-overlay"
      >
        <div 
          id="plme-animation"
          className="transition-transform duration-200 cursor-pointer"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 blur-xl opacity-30 bg-gradient-to-r from-amber-400 to-pink-400 rounded-full" />
          
          {/* Animation container */}
          <div className="relative w-32 h-32 flex items-center justify-center">
            {useFallback ? (
              // Use cute SVG characters as fallback
              <motion.div
                animate={{ 
                  y: [0, -10, 0],
                  rotate: [-5, 5, -5]
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                {currentMoment.category === 'calm_nature' ? (
                  <CuteCharacters.cloud />
                ) : (
                  Math.random() > 0.5 ? <CuteCharacters.dog /> : 
                  Math.random() > 0.5 ? <CuteCharacters.cat /> :
                  Math.random() > 0.5 ? <CuteCharacters.bunny /> :
                  <CuteCharacters.butterfly />
                )}
              </motion.div>
            ) : animationData ? (
              <Lottie 
                animationData={animationData}
                loop={true}
                style={{ width: 128, height: 128 }}
              />
            ) : null}
          </div>
          
          {/* Moment name tooltip */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap"
          >
            <span className="text-xs text-white/70 bg-black/30 px-2 py-1 rounded-full backdrop-blur-sm">
              {currentMoment.name}
            </span>
          </motion.div>
          
          {/* Reward indicator (if enabled) */}
          {currentMoment.reward > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1 }}
              className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full"
            >
              +{currentMoment.reward} PRC
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PLMEOverlay;
