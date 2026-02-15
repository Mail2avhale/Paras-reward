import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Clock, AlertTriangle, Zap, Shield, TrendingDown, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Animated fire particle
const FireParticle = ({ delay, size = 'small' }) => {
  const sizeClass = size === 'large' ? 'w-8 h-8' : size === 'medium' ? 'w-6 h-6' : 'w-4 h-4';
  return (
    <motion.div
      className="absolute pointer-events-none"
      initial={{ 
        opacity: 0.8, 
        y: 0, 
        x: (Math.random() - 0.5) * 40,
        scale: 1 
      }}
      animate={{ 
        opacity: 0, 
        y: -60, 
        scale: 0.3,
        rotate: Math.random() * 360
      }}
      transition={{ duration: 1.5, delay, repeat: Infinity, ease: 'easeOut' }}
    >
      <Flame className={`${sizeClass} text-orange-500`} />
    </motion.div>
  );
};

// Circular progress ring
const ProgressRing = ({ progress, size = 120, strokeWidth = 8, isUrgent = false }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={strokeWidth}
      />
      {/* Progress circle */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={isUrgent ? '#ef4444' : '#f59e0b'}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </svg>
  );
};

// Single PRC batch card
const PRCBatchCard = ({ batch, index, onUseNow }) => {
  const hoursLeft = batch.hoursLeft;
  const isUrgent = hoursLeft < 12;
  const isCritical = hoursLeft < 6;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`relative p-4 rounded-xl border ${
        isCritical 
          ? 'bg-red-500/20 border-red-500/50' 
          : isUrgent 
            ? 'bg-orange-500/20 border-orange-500/50'
            : 'bg-yellow-500/10 border-yellow-500/30'
      }`}
    >
      {/* Fire animation for urgent batches */}
      {isUrgent && (
        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
          {[...Array(3)].map((_, i) => (
            <FireParticle key={i} delay={i * 0.3} size={isCritical ? 'medium' : 'small'} />
          ))}
        </div>
      )}
      
      <div className="flex items-center justify-between">
        <div>
          <p className={`font-bold text-lg ${
            isCritical ? 'text-red-400' : isUrgent ? 'text-orange-400' : 'text-yellow-400'
          }`}>
            {batch.amount.toFixed(2)} PRC
          </p>
          <p className="text-sm text-gray-400">
            Batch #{index + 1} • FIFO
          </p>
        </div>
        
        <div className="text-right">
          <div className={`flex items-center gap-1 ${
            isCritical ? 'text-red-400' : isUrgent ? 'text-orange-400' : 'text-yellow-400'
          }`}>
            {isCritical ? (
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>
                <AlertTriangle className="w-4 h-4" />
              </motion.div>
            ) : (
              <Clock className="w-4 h-4" />
            )}
            <span className="font-bold">
              {hoursLeft}h {batch.minutesLeft}m
            </span>
          </div>
          <p className="text-xs text-gray-500">remaining</p>
        </div>
      </div>
      
      {isCritical && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onUseNow}
          className="w-full mt-3 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg font-semibold text-sm"
        >
          🛒 Use Now Before It Burns!
        </motion.button>
      )}
    </motion.div>
  );
};

// Main PRC Burn Alert component
const PRCBurnAlert = ({ 
  expiringBatches = [], 
  totalExpiring = 0, 
  isFreeUser = true,
  isExpanded = false,
  onToggle,
  onDismiss 
}) => {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  
  // Get the most urgent batch
  const mostUrgent = expiringBatches[0];
  const isUrgent = mostUrgent?.hoursLeft < 12;
  const isCritical = mostUrgent?.hoursLeft < 6;
  
  // Calculate progress (48h = 100%, 0h = 0%)
  const progressPercent = mostUrgent 
    ? ((mostUrgent.hoursLeft * 60 + mostUrgent.minutesLeft) / (48 * 60)) * 100 
    : 100;

  // Live countdown
  useEffect(() => {
    if (!mostUrgent) return;
    
    const timer = setInterval(() => {
      const now = new Date();
      const expiryTime = new Date(now.getTime() + (mostUrgent.hoursLeft * 60 + mostUrgent.minutesLeft) * 60 * 1000);
      const diff = expiryTime - now;
      
      if (diff > 0) {
        setTimeLeft({
          hours: Math.floor(diff / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000)
        });
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [mostUrgent]);

  if (!isFreeUser || expiringBatches.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl ${
        isCritical 
          ? 'bg-gradient-to-br from-red-900/90 to-orange-900/90 border border-red-500/50' 
          : isUrgent 
            ? 'bg-gradient-to-br from-orange-900/80 to-yellow-900/80 border border-orange-500/50'
            : 'bg-gradient-to-br from-yellow-900/60 to-amber-900/60 border border-yellow-500/30'
      }`}
    >
      {/* Animated fire background for critical state */}
      {isCritical && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 flex justify-center">
            {[...Array(8)].map((_, i) => (
              <FireParticle key={i} delay={i * 0.2} size="large" />
            ))}
          </div>
        </div>
      )}
      
      {/* Dismiss button */}
      <button 
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
      >
        <X className="w-4 h-4 text-white/70" />
      </button>
      
      {/* Main content */}
      <div className="relative p-5">
        <div className="flex items-start gap-4">
          {/* Progress Ring with Time */}
          <div className="relative flex-shrink-0">
            <ProgressRing 
              progress={progressPercent} 
              size={100} 
              strokeWidth={8}
              isUrgent={isUrgent}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.div
                animate={isCritical ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                <Flame className={`w-6 h-6 ${isCritical ? 'text-red-400' : 'text-orange-400'}`} />
              </motion.div>
              <p className="text-white font-bold text-sm">
                {timeLeft.hours}:{String(timeLeft.minutes).padStart(2, '0')}
              </p>
            </div>
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isCritical ? (
                <motion.span 
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="text-red-400 font-bold"
                >
                  🔥 BURNING SOON!
                </motion.span>
              ) : isUrgent ? (
                <span className="text-orange-400 font-bold">⚠️ PRC Expiring!</span>
              ) : (
                <span className="text-yellow-400 font-bold">⏰ PRC Expiry Notice</span>
              )}
            </div>
            
            <p className="text-white text-2xl font-bold">
              {totalExpiring.toFixed(2)} PRC
            </p>
            <p className="text-white/70 text-sm">
              {expiringBatches.length} batch{expiringBatches.length > 1 ? 'es' : ''} expiring
            </p>
            
            {/* Compact view action buttons */}
            {!isExpanded && (
              <div className="flex gap-2 mt-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/redeem')}
                  className="flex-1 py-2 px-3 bg-white text-orange-600 rounded-lg font-semibold text-sm"
                >
                  🛒 Use Now
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/subscription')}
                  className="flex-1 py-2 px-3 bg-white/20 text-white rounded-lg font-semibold text-sm border border-white/30"
                >
                  <Zap className="w-4 h-4 inline mr-1" />
                  Go VIP
                </motion.button>
              </div>
            )}
          </div>
        </div>
        
        {/* Expand/Collapse button */}
        <button 
          onClick={onToggle}
          className="w-full mt-3 py-2 text-white/70 text-sm hover:text-white transition-colors"
        >
          {isExpanded ? '▲ Show Less' : `▼ View All ${expiringBatches.length} Batches`}
        </button>
        
        {/* Expanded batch list */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 mt-4 pt-4 border-t border-white/20">
                <div className="flex items-center gap-2 text-white/70 text-sm mb-2">
                  <TrendingDown className="w-4 h-4" />
                  <span>FIFO Order: First earned = First burned</span>
                </div>
                
                {expiringBatches.map((batch, index) => (
                  <PRCBatchCard 
                    key={index} 
                    batch={batch} 
                    index={index}
                    onUseNow={() => navigate('/redeem')}
                  />
                ))}
                
                {/* VIP Upgrade CTA */}
                <div className="mt-4 p-4 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-xl border border-purple-500/50">
                  <div className="flex items-center gap-3">
                    <Shield className="w-10 h-10 text-purple-400" />
                    <div className="flex-1">
                      <p className="text-white font-bold">Protect Your PRC Forever!</p>
                      <p className="text-white/70 text-sm">VIP members get lifetime PRC validity</p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => navigate('/subscription')}
                      className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-bold text-sm"
                    >
                      Upgrade
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Info footer */}
        <p className="text-white/50 text-xs mt-3 text-center">
          💡 Free users: PRC expires 48 hours after earning (FIFO)
        </p>
      </div>
    </motion.div>
  );
};

// Hook to fetch and manage PRC expiry data
export const usePRCExpiry = (userId, isFreeUser) => {
  const [expiringBatches, setExpiringBatches] = useState([]);
  const [totalExpiring, setTotalExpiring] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const fetchExpiryData = useCallback(async () => {
    if (!userId || !isFreeUser) {
      setLoading(false);
      return;
    }
    
    try {
      const API = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${API}/user/${userId}/prc-expiry`);
      const data = await response.json();
      
      if (data.expiring_batches) {
        setExpiringBatches(data.expiring_batches);
        setTotalExpiring(data.total_expiring || 0);
      }
    } catch (error) {
      console.error('Error fetching PRC expiry:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, isFreeUser]);
  
  useEffect(() => {
    fetchExpiryData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchExpiryData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchExpiryData]);
  
  return { expiringBatches, totalExpiring, loading, refresh: fetchExpiryData };
};

export default PRCBurnAlert;
