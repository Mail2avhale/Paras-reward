import React from 'react';

const RewardLoader = ({ message = 'Loading...', size = 'default', theme = 'dark' }) => {
  const sizes = {
    small: { logo: 64, text: 'text-xs' },
    default: { logo: 100, text: 'text-sm' },
    large: { logo: 140, text: 'text-base' }
  };
  
  const s = sizes[size] || sizes.default;
  const logoSrc = '/paras-logo.png';
  
  return (
    <div data-testid="reward-loader" className="flex flex-col items-center justify-center py-12 gap-5">
      {/* Logo with pulse zoom + star blink */}
      <div className="relative" style={{ width: s.logo, height: s.logo }}>
        {/* Glow ring */}
        <div 
          className="absolute inset-[-12px] rounded-full"
          style={{ animation: 'loaderGlow 2.5s ease-in-out infinite' }}
        />
        
        {/* Blinking stars around logo */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="absolute"
            style={{
              width: 6,
              height: 6,
              top: `${[5, -2, 50, 95, 102, 50][i]}%`,
              left: `${[-5, 50, 105, -5, 50, 105][i]}%`,
              animation: `starBlink 1.5s ease-in-out ${i * 0.25}s infinite`,
            }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-amber-400">
              <path d="M12 2l2.09 6.26L20.18 9l-5.09 3.74L16.18 19 12 15.27 7.82 19l1.09-6.26L3.82 9l6.09-.74L12 2z" />
            </svg>
          </div>
        ))}
        
        {/* Logo with zoom pulse */}
        <img 
          src={logoSrc}
          alt="Paras Reward"
          className="w-full h-full object-contain"
          style={{ animation: 'logoPulse 2s ease-in-out infinite' }}
          draggable={false}
        />
      </div>
      
      {/* Loading text */}
      {message && (
        <p className={`${s.text} font-medium tracking-wide ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`} style={{ animation: 'textFade 2s ease-in-out infinite' }}>
          {message}
        </p>
      )}
      
      <style>{`
        @keyframes logoPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
        @keyframes loaderGlow {
          0%, 100% { box-shadow: 0 0 15px rgba(251,191,36,0.15); }
          50%      { box-shadow: 0 0 30px rgba(251,191,36,0.35); }
        }
        @keyframes starBlink {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50%      { opacity: 1; transform: scale(1.2); }
        }
        @keyframes textFade {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default RewardLoader;
