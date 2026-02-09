import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// PLMEOverlay - Paras Living Moments Engine
// Shows real animal images/videos as an overlay on the dashboard
const PLMEOverlay = ({ user }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentMoment, setCurrentMoment] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef(null);
  const timeoutRef = useRef(null);
  const durationTimeoutRef = useRef(null);
  const hasTriggeredRef = useRef(false);

  // Random position generator for overlay
  const getRandomPosition = useCallback(() => {
    const positions = [
      { x: '5%', y: '15%' },
      { x: '60%', y: '10%' },
      { x: '5%', y: '45%' },
      { x: '55%', y: '40%' },
      { x: '10%', y: '60%' },
      { x: '50%', y: '55%' },
    ];
    return positions[Math.floor(Math.random() * positions.length)];
  }, []);

  // Handle moment end (close overlay)
  const handleMomentEnd = useCallback(() => {
    setIsVisible(false);
    
    // Clear any pending duration timeout
    if (durationTimeoutRef.current) {
      clearTimeout(durationTimeoutRef.current);
    }
    
    // Record view in backend
    if (currentMoment && user?.uid) {
      axios.post(`${API}/api/plme/record-view/${user.uid}`, {
        asset_id: currentMoment.id,
        reward: currentMoment.reward || 0
      }).catch(console.error);
    }
    
    // Reset for next trigger after 45 seconds
    setTimeout(() => {
      hasTriggeredRef.current = false;
      fetchNextMoment();
    }, 45000);
  }, [currentMoment, user?.uid]);

  // Fetch next moment from backend
  const fetchNextMoment = useCallback(async () => {
    if (!user?.uid || hasTriggeredRef.current) return;
    
    try {
      const response = await axios.get(`${API}/api/plme/next-moment/${user.uid}`);
      
      if (response.data?.show_moment && response.data?.moment) {
        const moment = response.data.moment;
        setCurrentMoment(moment);
        
        // Schedule the moment to appear (use shorter delay for testing: 10-30 seconds)
        const triggerDelay = Math.min(moment.trigger_delay || 30, 30) * 1000;
        
        timeoutRef.current = setTimeout(() => {
          hasTriggeredRef.current = true;
          setIsLoading(true);
          setPosition(getRandomPosition());
          setIsVisible(true);
          
          // Set auto-hide timeout based on duration
          const duration = (moment.duration || 15) * 1000;
          durationTimeoutRef.current = setTimeout(() => {
            handleMomentEnd();
          }, duration);
        }, triggerDelay);
      }
    } catch (error) {
      console.error('PLME fetch error:', error);
    }
  }, [user?.uid, getRandomPosition, handleMomentEnd]);

  // Initial fetch after mount
  useEffect(() => {
    // Wait 3 seconds after dashboard loads, then fetch
    const initialDelay = setTimeout(() => {
      fetchNextMoment();
    }, 3000);
    
    return () => {
      clearTimeout(initialDelay);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (durationTimeoutRef.current) clearTimeout(durationTimeoutRef.current);
    };
  }, [fetchNextMoment]);

  // Handle image/video load complete
  const handleMediaLoaded = () => {
    setIsLoading(false);
  };

  // Handle close button
  const handleClose = () => {
    handleMomentEnd();
  };

  // Handle tap/click interaction - gentle bounce effect
  const handleTap = () => {
    const element = document.getElementById('plme-media');
    if (element) {
      element.style.transform = 'scale(1.08)';
      setTimeout(() => {
        if (element) element.style.transform = 'scale(1)';
      }, 200);
    }
  };

  if (!isVisible || !currentMoment) return null;

  const isVideo = currentMoment.asset_type === 'video';
  const isImage = currentMoment.asset_type === 'image' || !currentMoment.asset_type;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.3 }}
        transition={{ type: 'spring', duration: 0.6, bounce: 0.4 }}
        className="fixed z-[100] pointer-events-auto"
        style={{ left: position.x, top: position.y }}
        onClick={handleTap}
        data-testid="plme-overlay"
      >
        <div className="relative">
          {/* Glow effect behind media */}
          <div 
            className="absolute -inset-4 rounded-3xl blur-2xl opacity-60"
            style={{
              background: 'radial-gradient(circle, rgba(255, 200, 100, 0.5) 0%, rgba(255, 150, 50, 0.3) 50%, transparent 100%)'
            }}
          />
          
          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="absolute -top-2 -right-2 z-20 w-7 h-7 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center transition-colors shadow-lg"
            data-testid="plme-close-btn"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Media container with gentle breathing animation for images */}
          <motion.div 
            className="relative w-32 h-32 sm:w-40 sm:h-40 overflow-hidden rounded-2xl shadow-2xl border-2 border-white/30"
            animate={isImage ? {
              scale: [1, 1.02, 1],
            } : {}}
            transition={isImage ? {
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            } : {}}
          >
            {/* Loading spinner */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
                <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            
            {/* Render image or video based on asset_type */}
            {isVideo ? (
              <video
                ref={videoRef}
                id="plme-media"
                src={currentMoment.url}
                className="w-full h-full object-cover transition-transform duration-200"
                muted
                playsInline
                autoPlay
                onLoadedData={handleMediaLoaded}
                onEnded={handleMomentEnd}
                onError={(e) => {
                  console.error('Video load error:', e);
                  handleMomentEnd();
                }}
              />
            ) : (
              <img
                id="plme-media"
                src={currentMoment.url}
                alt={currentMoment.name}
                className="w-full h-full object-cover transition-transform duration-200"
                onLoad={handleMediaLoaded}
                onError={(e) => {
                  console.error('Image load error:', e);
                  handleMomentEnd();
                }}
              />
            )}
            
            {/* Gradient overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/70 to-transparent" />
          </motion.div>
          
          {/* Moment name tooltip */}
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap"
          >
            <span className="text-xs text-white bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm font-medium shadow-lg">
              {currentMoment.name}
            </span>
          </motion.div>
          
          {/* Reward indicator (if enabled) */}
          {currentMoment.reward > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, type: 'spring' }}
              className="absolute -top-3 -left-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg"
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
