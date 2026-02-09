import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// PLMEOverlay - Paras Living Moments Engine
// Shows real animal video clips as an overlay on the dashboard
const PLMEOverlay = ({ user }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentMoment, setCurrentMoment] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef(null);
  const timeoutRef = useRef(null);
  const hasTriggeredRef = useRef(false);

  // Random position generator for overlay
  const getRandomPosition = useCallback(() => {
    const positions = [
      { x: '5%', y: '15%' },
      { x: '65%', y: '10%' },
      { x: '5%', y: '45%' },
      { x: '60%', y: '40%' },
      { x: '10%', y: '65%' },
      { x: '55%', y: '60%' },
    ];
    return positions[Math.floor(Math.random() * positions.length)];
  }, []);

  // Fetch next moment from backend
  const fetchNextMoment = useCallback(async () => {
    if (!user?.uid || hasTriggeredRef.current) return;
    
    try {
      const response = await axios.get(`${API}/api/plme/next-moment/${user.uid}`);
      
      if (response.data?.show_moment && response.data?.moment) {
        const moment = response.data.moment;
        setCurrentMoment(moment);
        
        // Schedule the moment to appear
        const triggerDelay = (moment.trigger_delay || 60) * 1000;
        
        timeoutRef.current = setTimeout(() => {
          hasTriggeredRef.current = true;
          setIsLoading(true);
          setPosition(getRandomPosition());
          setIsVisible(true);
        }, triggerDelay);
      }
    } catch (error) {
      console.error('PLME fetch error:', error);
    }
  }, [user?.uid, getRandomPosition]);

  // Initial fetch after mount
  useEffect(() => {
    // For testing: set to 2 seconds, production should be 5+ seconds
    const initialDelay = setTimeout(() => {
      fetchNextMoment();
    }, 2000); // Wait 2 seconds after dashboard loads
    
    return () => {
      clearTimeout(initialDelay);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fetchNextMoment]);

  // Handle video load
  const handleVideoLoaded = () => {
    setIsLoading(false);
    if (videoRef.current) {
      videoRef.current.play().catch(console.error);
    }
  };

  // Handle video end
  const handleVideoEnded = useCallback(() => {
    setIsVisible(false);
    
    // Record view in backend
    if (currentMoment && user?.uid) {
      axios.post(`${API}/api/plme/record-view/${user.uid}`, {
        asset_id: currentMoment.id,
        reward: currentMoment.reward || 0
      }).catch(console.error);
    }
    
    // Reset for next trigger after 30 seconds
    setTimeout(() => {
      hasTriggeredRef.current = false;
      fetchNextMoment();
    }, 30000);
  }, [currentMoment, user?.uid, fetchNextMoment]);

  // Handle tap/click interaction
  const handleTap = () => {
    if (videoRef.current) {
      // Add a gentle bounce effect
      videoRef.current.style.transform = 'scale(1.1)';
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.style.transform = 'scale(1)';
        }
      }, 200);
    }
  };

  // Handle close button
  const handleClose = () => {
    setIsVisible(false);
    handleVideoEnded();
  };

  if (!isVisible || !currentMoment) return null;

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
          {/* Glow effect behind video */}
          <div 
            className="absolute -inset-4 rounded-3xl blur-2xl opacity-50"
            style={{
              background: 'radial-gradient(circle, rgba(255, 200, 100, 0.4) 0%, rgba(255, 150, 50, 0.2) 50%, transparent 100%)'
            }}
          />
          
          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="absolute -top-2 -right-2 z-20 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
            data-testid="plme-close-btn"
          >
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Video container */}
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 overflow-hidden rounded-2xl shadow-2xl border-2 border-white/20">
            {/* Loading spinner */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
                <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            
            {/* Video element */}
            <video
              ref={videoRef}
              src={currentMoment.url}
              className="w-full h-full object-cover transition-transform duration-200"
              style={{ transform: 'scale(1)' }}
              muted
              playsInline
              autoPlay
              onLoadedData={handleVideoLoaded}
              onEnded={handleVideoEnded}
              onError={(e) => {
                console.error('Video load error:', e);
                handleVideoEnded();
              }}
            />
            
            {/* Gradient overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
          
          {/* Moment name tooltip */}
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap"
          >
            <span className="text-xs text-white/90 bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm font-medium">
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
