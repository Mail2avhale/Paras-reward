import React from 'react';

const RewardLoader = ({ message = 'Loading...', size = 'default' }) => {
  const sizeClasses = {
    small: 'w-8 h-8',
    default: 'w-14 h-14',
    large: 'w-20 h-20'
  };
  
  const coinSize = sizeClasses[size] || sizeClasses.default;
  
  return (
    <div data-testid="reward-loader" className="flex flex-col items-center justify-center py-12 gap-4">
      {/* Animated PRC Coin */}
      <div className="relative">
        {/* Outer glow ring */}
        <div className={`${coinSize} rounded-full absolute inset-0 bg-gradient-to-r from-amber-400/30 to-yellow-300/30 animate-ping`} />
        
        {/* Spinning coin */}
        <div className={`${coinSize} relative`}>
          <div 
            className="w-full h-full rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 shadow-lg shadow-amber-500/30 flex items-center justify-center"
            style={{
              animation: 'coinFlip 1.8s ease-in-out infinite',
            }}
          >
            {/* PRC text on coin */}
            <span 
              className="font-black text-amber-900 select-none"
              style={{ fontSize: size === 'small' ? '0.5rem' : size === 'large' ? '0.85rem' : '0.65rem' }}
            >
              PRC
            </span>
          </div>
          
          {/* Sparkle particles */}
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-300 rounded-full" style={{ animation: 'sparkle 1.5s ease-in-out infinite' }} />
          <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5 bg-amber-300 rounded-full" style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.5s' }} />
          <div className="absolute top-0 -left-2 w-1 h-1 bg-yellow-200 rounded-full" style={{ animation: 'sparkle 1.5s ease-in-out infinite 1s' }} />
        </div>
      </div>
      
      {/* Loading message */}
      {message && (
        <p className="text-sm text-gray-500 font-medium tracking-wide" style={{ animation: 'fadeInOut 2s ease-in-out infinite' }}>
          {message}
        </p>
      )}
      
      {/* CSS Animations */}
      <style>{`
        @keyframes coinFlip {
          0%, 100% { transform: rotateY(0deg) scale(1); }
          25% { transform: rotateY(90deg) scale(0.9); }
          50% { transform: rotateY(180deg) scale(1); }
          75% { transform: rotateY(270deg) scale(0.9); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1.5); }
        }
        @keyframes fadeInOut {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default RewardLoader;
