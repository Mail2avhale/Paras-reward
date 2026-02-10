import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { 
  FileText, Clock, Loader2, CheckCircle, XCircle, 
  Zap, Rocket, Timer, Trophy, Sparkles
} from 'lucide-react';

// ============================================
// LIVE TIMER COMPONENT
// Shows elapsed time only for PENDING requests
// ============================================
export const LiveTimer = ({ createdAt, status }) => {
  const [timeElapsed, setTimeElapsed] = useState('');
  
  useEffect(() => {
    if (!createdAt) return;
    
    // Only run timer for pending status
    if (status !== 'pending') return;
    
    const updateTimer = () => {
      const created = new Date(createdAt);
      const now = new Date();
      const diff = now - created;
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      let timeStr = '';
      if (days > 0) timeStr += `${days}d `;
      if (hours > 0 || days > 0) timeStr += `${hours}h `;
      if (minutes > 0 || hours > 0 || days > 0) timeStr += `${minutes}m `;
      timeStr += `${seconds}s`;
      
      setTimeElapsed(timeStr);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [createdAt, status]);
  
  // Only show timer for PENDING status
  if (status !== 'pending') {
    return null;
  }
  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg border border-amber-500/30"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <Clock className="w-4 h-4 text-amber-400" />
      </motion.div>
      <span className="text-amber-300 text-sm font-mono">{timeElapsed}</span>
      <span className="text-xs text-amber-400">waiting</span>
    </motion.div>
  );
};

// ============================================
// SPEED BADGE COMPONENT
// Shows badge based on processing time
// ============================================
export const SpeedBadge = ({ processingTime }) => {
  if (!processingTime) return null;
  
  // Parse processing time to get total minutes
  const parseTime = (timeStr) => {
    if (!timeStr) return 999;
    let totalMinutes = 0;
    const dayMatch = timeStr.match(/(\d+)d/);
    const hourMatch = timeStr.match(/(\d+)h/);
    const minMatch = timeStr.match(/(\d+)m/);
    
    if (dayMatch) totalMinutes += parseInt(dayMatch[1]) * 24 * 60;
    if (hourMatch) totalMinutes += parseInt(hourMatch[1]) * 60;
    if (minMatch) totalMinutes += parseInt(minMatch[1]);
    
    return totalMinutes || 1; // At least 1 minute
  };
  
  const minutes = parseTime(processingTime);
  
  let badge = null;
  
  if (minutes <= 60) {
    badge = {
      icon: Zap,
      text: "⚡ Lightning Fast!",
      bgClass: "bg-gradient-to-r from-yellow-500/20 to-orange-500/20",
      borderClass: "border-yellow-500/50",
      textClass: "text-yellow-400",
      iconColor: '#facc15'
    };
  } else if (minutes <= 240) {
    badge = {
      icon: Rocket,
      text: "🚀 Quick Service!",
      bgClass: "bg-gradient-to-r from-blue-500/20 to-cyan-500/20",
      borderClass: "border-blue-500/50",
      textClass: "text-blue-400",
      iconColor: '#60a5fa'
    };
  } else if (minutes <= 480) {
    badge = {
      icon: Trophy,
      text: "✨ On Time!",
      bgClass: "bg-gradient-to-r from-emerald-500/20 to-green-500/20",
      borderClass: "border-emerald-500/50",
      textClass: "text-emerald-400",
      iconColor: '#34d399'
    };
  } else {
    badge = {
      icon: CheckCircle,
      text: "✓ Completed",
      bgClass: "bg-gray-500/20",
      borderClass: "border-gray-500/50",
      textClass: "text-gray-400",
      iconColor: '#9ca3af'
    };
  }
  
  const Icon = badge.icon;
  
  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${badge.bgClass} border ${badge.borderClass} shadow-lg`}
    >
      <motion.div
        animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Icon className="w-5 h-5" style={{ color: badge.iconColor }} />
      </motion.div>
      <span className={`text-sm font-bold ${badge.textClass}`}>
        {badge.text}
      </span>
    </motion.div>
  );
};

// ============================================
// FIRE CONFETTI FUNCTION
// ============================================
const fireConfetti = () => {
  const duration = 3000;
  const end = Date.now() + duration;
  const colors = ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#f59e0b'];
  
  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.8 },
      colors: colors
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.8 },
      colors: colors
    });
    
    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
  
  // Big burst in the middle
  setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 100,
      origin: { y: 0.6 },
      colors: colors
    });
  }, 500);
};

// ============================================
// REQUEST JOURNEY ANIMATION
// Main component showing request progress
// ============================================
export const RequestJourney = ({ status, createdAt, approvedAt, completedAt, processingTime }) => {
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);
  
  // Debug log
  console.log('RequestJourney rendered with status:', status, 'processingTime:', processingTime);
  
  const steps = [
    { id: 'submitted', label: 'Submitted', icon: FileText },
    { id: 'processing', label: 'Processing', icon: Loader2 },
    { id: 'completed', label: 'Completed', icon: CheckCircle }
  ];
  
  // Normalize status (backend might send 'approved' instead of 'processing')
  const normalizedStatus = status === 'approved' ? 'processing' : status;
  
  // Determine step status based on request status
  const getStepStatus = (stepId) => {
    // Handle rejected status
    if (normalizedStatus === 'rejected') {
      if (stepId === 'submitted') return 'completed';
      if (stepId === 'processing') return 'rejected';
      return 'pending';
    }
    
    // Step 1: Submitted - always completed once request exists
    if (stepId === 'submitted') {
      return 'completed';
    }
    
    // Step 2: Processing
    if (stepId === 'processing') {
      if (normalizedStatus === 'pending') return 'pending';
      if (normalizedStatus === 'processing') return 'current';
      if (normalizedStatus === 'completed') return 'completed';
      return 'pending';
    }
    
    // Step 3: Completed
    if (stepId === 'completed') {
      if (normalizedStatus === 'completed') return 'completed';
      return 'pending';
    }
    
    return 'pending';
  };
  
  // Trigger confetti ONLY when status is exactly 'completed'
  useEffect(() => {
    // Only trigger for completed status (not approved, not processing)
    const isCompleted = status === 'completed';
    
    if (isCompleted && !hasTriggeredConfetti) {
      setHasTriggeredConfetti(true);
      // Small delay to ensure UI is ready
      setTimeout(() => {
        fireConfetti();
      }, 100);
    }
  }, [status, hasTriggeredConfetti]);
  
  // Rejected state - special UI
  if (normalizedStatus === 'rejected') {
    return (
      <div className="p-4 bg-gradient-to-r from-red-500/5 to-red-500/10 rounded-xl border border-red-500/20">
        <div className="flex items-center justify-between">
          {steps.slice(0, 2).map((step, index) => {
            const Icon = step.id === 'processing' ? XCircle : step.icon;
            const stepStatus = getStepStatus(step.id);
            
            return (
              <React.Fragment key={step.id}>
                {index > 0 && (
                  <div className="flex-1 h-1 mx-2 rounded bg-red-500/30" />
                )}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.2 }}
                  className="flex flex-col items-center"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    stepStatus === 'rejected' 
                      ? 'bg-red-500/20 border-2 border-red-500' 
                      : stepStatus === 'completed'
                      ? 'bg-emerald-500/20 border-2 border-emerald-500'
                      : 'bg-gray-700/50 border-2 border-gray-600'
                  }`}>
                    <Icon className={`w-5 h-5 ${
                      stepStatus === 'rejected' ? 'text-red-400' : 
                      stepStatus === 'completed' ? 'text-emerald-400' :
                      'text-gray-400'
                    }`} />
                  </div>
                  <span className={`text-xs mt-2 ${
                    stepStatus === 'rejected' ? 'text-red-400' : 
                    stepStatus === 'completed' ? 'text-emerald-400' :
                    'text-gray-500'
                  }`}>
                    {step.id === 'processing' ? 'Rejected' : step.label}
                  </span>
                </motion.div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-xl border border-gray-700/50">
      {/* Steps */}
      <div className="flex items-center justify-between mb-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const stepStatus = getStepStatus(step.id);
          
          return (
            <React.Fragment key={step.id}>
              {index > 0 && (
                <motion.div className="flex-1 h-1 mx-2 rounded-full overflow-hidden bg-gray-700">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ 
                      width: stepStatus === 'completed' ? '100%' : 
                             stepStatus === 'current' ? '100%' : '0%'
                    }}
                    transition={{ duration: 0.5, delay: index * 0.3 }}
                    className={`h-full ${
                      stepStatus === 'completed' 
                        ? 'bg-gradient-to-r from-emerald-500 to-green-400' 
                        : 'bg-gradient-to-r from-blue-500 to-purple-500'
                    }`}
                  />
                </motion.div>
              )}
              
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.2, type: "spring" }}
                className="flex flex-col items-center relative"
              >
                {/* Pulse animation for current step */}
                {stepStatus === 'current' && (
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute w-12 h-12 rounded-full bg-blue-500/30"
                  />
                )}
                
                <motion.div 
                  animate={stepStatus === 'current' ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 1, repeat: Infinity }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center z-10 ${
                    stepStatus === 'completed' 
                      ? 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/30' 
                      : stepStatus === 'current'
                      ? 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30'
                      : 'bg-gray-700/50 border-2 border-gray-600'
                  }`}
                >
                  {stepStatus === 'current' && step.id === 'processing' ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </motion.div>
                  ) : (
                    <Icon className={`w-5 h-5 ${
                      stepStatus === 'completed' || stepStatus === 'current' 
                        ? 'text-white' 
                        : 'text-gray-500'
                    }`} />
                  )}
                </motion.div>
                
                <span className={`text-xs mt-2 font-medium ${
                  stepStatus === 'completed' 
                    ? 'text-emerald-400' 
                    : stepStatus === 'current'
                    ? 'text-blue-400'
                    : 'text-gray-500'
                }`}>
                  {step.label}
                </span>
              </motion.div>
            </React.Fragment>
          );
        })}
      </div>
      
      {/* Status-specific content */}
      {normalizedStatus === 'pending' && (
        <div className="flex justify-center">
          <LiveTimer createdAt={createdAt} status="pending" />
        </div>
      )}
      
      {normalizedStatus === 'processing' && (
        <div className="flex justify-center">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 rounded-lg border border-blue-500/30"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="w-4 h-4 text-blue-400" />
            </motion.div>
            <span className="text-blue-300 text-sm">Processing your request...</span>
          </motion.div>
        </div>
      )}
      
      {normalizedStatus === 'completed' && (
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col items-center gap-3"
        >
          {processingTime && <SpeedBadge processingTime={processingTime} />}
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <Sparkles className="w-4 h-4" />
            <span>Completed {processingTime ? `in ${processingTime}` : 'successfully!'}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// ============================================
// COMPACT VERSION FOR LIST VIEW
// ============================================
export const RequestJourneyCompact = ({ status, processingTime }) => {
  // Normalize status
  const normalizedStatus = status === 'approved' ? 'processing' : status;
  
  const getStatusInfo = () => {
    switch (normalizedStatus) {
      case 'pending':
        return { 
          icon: Clock, 
          text: 'Pending', 
          color: 'text-amber-400', 
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30'
        };
      case 'processing':
        return { 
          icon: Loader2, 
          text: 'Processing', 
          color: 'text-blue-400', 
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/30',
          animate: true
        };
      case 'completed':
        return { 
          icon: CheckCircle, 
          text: 'Completed', 
          color: 'text-emerald-400', 
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/30'
        };
      case 'rejected':
        return { 
          icon: XCircle, 
          text: 'Rejected', 
          color: 'text-red-400', 
          bg: 'bg-red-500/10',
          border: 'border-red-500/30'
        };
      default:
        return { 
          icon: Clock, 
          text: status, 
          color: 'text-gray-400', 
          bg: 'bg-gray-500/10',
          border: 'border-gray-500/30'
        };
    }
  };
  
  const info = getStatusInfo();
  const Icon = info.icon;
  
  return (
    <div className="flex items-center gap-2">
      <motion.div
        animate={info.animate ? { rotate: 360 } : {}}
        transition={info.animate ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
        className={`p-1.5 rounded-full ${info.bg} border ${info.border}`}
      >
        <Icon className={`w-3.5 h-3.5 ${info.color}`} />
      </motion.div>
      <span className={`text-xs font-medium ${info.color}`}>{info.text}</span>
      {normalizedStatus === 'completed' && processingTime && (
        <span className="text-[10px] text-gray-500">({processingTime})</span>
      )}
    </div>
  );
};

export default RequestJourney;
