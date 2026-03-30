import React from 'react';

const RewardLoader = ({ message = 'Loading...', size = 'default' }) => {
  const sizes = {
    small: { coin: 48, text: 'text-xs' },
    default: { coin: 72, text: 'text-sm' },
    large: { coin: 96, text: 'text-base' }
  };
  
  const s = sizes[size] || sizes.default;
  
  return (
    <div data-testid="reward-loader" className="flex flex-col items-center justify-center py-12 gap-5">
      {/* Spinning Paras Ecoin */}
      <div className="relative" style={{ width: s.coin, height: s.coin }}>
        {/* Outer pulse glow */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(251,191,36,0.25) 0%, transparent 70%)',
            animation: 'coinPulse 2s ease-in-out infinite',
          }}
        />
        
        {/* Coin with 3D spin */}
        <div
          className="relative rounded-full overflow-hidden shadow-lg"
          style={{
            width: s.coin,
            height: s.coin,
            animation: 'coinSpin 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
            boxShadow: '0 0 20px rgba(251,191,36,0.3), 0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <img 
            src="/assets/paras-ecoin-small.webp" 
            alt="Paras Ecoin"
            className="w-full h-full object-cover rounded-full"
            draggable={false}
          />
        </div>

        {/* Sparkle dots */}
        <div className="absolute -top-1 right-0 w-1.5 h-1.5 bg-yellow-300 rounded-full" style={{ animation: 'sparkle 1.8s ease-in-out infinite' }} />
        <div className="absolute bottom-0 -left-1 w-1 h-1 bg-amber-300 rounded-full" style={{ animation: 'sparkle 1.8s ease-in-out infinite 0.6s' }} />
        <div className="absolute -top-0.5 -left-1.5 w-1 h-1 bg-yellow-200 rounded-full" style={{ animation: 'sparkle 1.8s ease-in-out infinite 1.2s' }} />
      </div>
      
      {/* Loading text */}
      {message && (
        <p className={`${s.text} text-gray-400 font-medium tracking-wide`} style={{ animation: 'textPulse 2s ease-in-out infinite' }}>
          {message}
        </p>
      )}
      
      <style>{`
        @keyframes coinSpin {
          0%   { transform: perspective(400px) rotateY(0deg); }
          50%  { transform: perspective(400px) rotateY(180deg); }
          100% { transform: perspective(400px) rotateY(360deg); }
        }
        @keyframes coinPulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50%      { transform: scale(1.4); opacity: 0.8; }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50%      { opacity: 1; transform: scale(1.8); }
        }
        @keyframes textPulse {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default RewardLoader;
