import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, Sparkles, Trophy, Gift } from 'lucide-react';

const AnimatedFeedback = ({ 
  message, 
  type = 'info', // 'success', 'error', 'warning', 'info', 'special'
  icon: CustomIcon,
  onClose,
  duration = 3000,
  position = 'center' // 'top', 'center', 'bottom'
}) => {
  useEffect(() => {
    if (duration && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getStyles = () => {
    switch (type) {
      case 'success':
        return {
          gradient: 'from-green-500 via-emerald-500 to-teal-500',
          border: 'border-green-600',
          icon: <CheckCircle className="h-8 w-8 md:h-10 md:w-10 text-white" />,
          animation: 'animate-bounce'
        };
      case 'error':
        return {
          gradient: 'from-red-500 via-rose-500 to-pink-500',
          border: 'border-red-600',
          icon: <XCircle className="h-8 w-8 md:h-10 md:w-10 text-white" />,
          animation: 'animate-bounce'
        };
      case 'warning':
        return {
          gradient: 'from-orange-500 via-amber-500 to-yellow-500',
          border: 'border-orange-600',
          icon: <AlertCircle className="h-8 w-8 md:h-10 md:w-10 text-white" />,
          animation: 'animate-pulse'
        };
      case 'special':
        return {
          gradient: 'from-purple-600 via-pink-600 to-fuchsia-600',
          border: 'border-yellow-400',
          icon: <Trophy className="h-8 w-8 md:h-10 md:w-10 text-yellow-300" />,
          animation: 'animate-bounce'
        };
      default: // info
        return {
          gradient: 'from-blue-500 via-cyan-500 to-sky-500',
          border: 'border-blue-600',
          icon: <Info className="h-8 w-8 md:h-10 md:w-10 text-white" />,
          animation: 'animate-pulse'
        };
    }
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'top-4 left-1/2 -translate-x-1/2';
      case 'bottom':
        return 'bottom-4 left-1/2 -translate-x-1/2';
      default: // center
        return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
    }
  };

  const styles = getStyles();
  const Icon = CustomIcon || (() => styles.icon);

  return (
    <div className={`fixed ${getPositionClasses()} z-[9999] max-w-2xl w-full px-4 animate-fadeIn`}>
      <div className={`
        bg-gradient-to-r ${styles.gradient} 
        border-4 ${styles.border}
        rounded-2xl shadow-2xl p-6 md:p-8
        ${styles.animation}
        transform hover:scale-105 transition-transform
      `}>
        <div className="flex items-center gap-4">
          {/* Icon with pulse ring */}
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-25"></div>
            <div className="relative bg-white/20 backdrop-blur-sm p-3 rounded-full">
              <Icon />
            </div>
          </div>
          
          {/* Message */}
          <div className="flex-1">
            <p className="text-white text-xl md:text-3xl font-black drop-shadow-2xl whitespace-pre-line leading-tight">
              {message}
            </p>
          </div>
          
          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="flex-shrink-0 bg-white/20 hover:bg-white/30 rounded-full p-2 transition-colors"
            >
              <XCircle className="h-6 w-6 text-white" />
            </button>
          )}
        </div>
        
        {/* Sparkle effects */}
        <div className="absolute top-2 right-2 w-3 h-3 bg-white rounded-full animate-ping opacity-50"></div>
        <div className="absolute bottom-2 left-2 w-2 h-2 bg-white rounded-full animate-ping opacity-50" style={{ animationDelay: '0.5s' }}></div>
        
        {/* Progress bar if duration is set */}
        {duration && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 rounded-b-xl overflow-hidden">
            <div 
              className="h-full bg-white/50 animate-shrink-width"
              style={{ animationDuration: `${duration}ms` }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimatedFeedback;
