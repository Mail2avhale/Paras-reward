import React, { useState, useEffect, useCallback, useMemo } from 'react';

const HoliCelebration = ({ isLoggedIn = false }) => {
  const [isActive, setIsActive] = useState(false);
  const [colorSplashes, setColorSplashes] = useState([]);
  const [powderBursts, setPowderBursts] = useState([]);

  // HD Vibrant Holi colors with more variety
  const holiColors = useMemo(() => [
    '#FF1493', // Deep Pink
    '#FF6B35', // Orange
    '#FFD700', // Gold
    '#00FF7F', // Spring Green
    '#00BFFF', // Deep Sky Blue
    '#8A2BE2', // Blue Violet
    '#FF4500', // Orange Red
    '#32CD32', // Lime Green
    '#FF69B4', // Hot Pink
    '#1E90FF', // Dodger Blue
    '#FF00FF', // Magenta
    '#00CED1', // Dark Turquoise
    '#FFA500', // Orange
    '#9400D3', // Dark Violet
    '#00FA9A', // Medium Spring Green
    '#E91E63', // Pink
    '#9C27B0', // Purple
    '#673AB7', // Deep Purple
    '#3F51B5', // Indigo
    '#00BCD4', // Cyan
    '#FFEB3B', // Yellow
    '#FF5722', // Deep Orange
  ], []);

  // Generate HD quality color splashes - More particles for HD effect
  const generateSplashes = useCallback(() => {
    const splashes = [];
    // Increased from 50 to 80 for HD density
    for (let i = 0; i < 80; i++) {
      splashes.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 180 + 60, // Larger splashes
        color: holiColors[Math.floor(Math.random() * holiColors.length)],
        delay: Math.random() * 2.5,
        duration: Math.random() * 4 + 2,
        rotation: Math.random() * 360,
        blur: Math.random() * 2 + 1, // Variable blur for depth
      });
    }
    return splashes;
  }, [holiColors]);

  // Generate powder burst effects for HD quality
  const generatePowderBursts = useCallback(() => {
    const bursts = [];
    for (let i = 0; i < 25; i++) {
      bursts.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        scale: Math.random() * 2 + 1,
        color: holiColors[Math.floor(Math.random() * holiColors.length)],
        delay: Math.random() * 3,
        opacity: Math.random() * 0.6 + 0.4,
      });
    }
    return bursts;
  }, [holiColors]);

  // Check if should show celebration (every 10 min until midnight)
  // Only show for logged-in users
  useEffect(() => {
    if (!isLoggedIn) return; // Don't show for non-logged-in users

    const checkTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      // Stop after midnight (next day)
      if (hours >= 0 && hours < 6) {
        return; // Don't show between midnight and 6 AM
      }
      
      // Show every 10 minutes for 30 seconds
      if (minutes % 10 === 0) {
        setIsActive(true);
        setColorSplashes(generateSplashes());
        setPowderBursts(generatePowderBursts());
        
        // Hide after 30 seconds
        setTimeout(() => {
          setIsActive(false);
        }, 30000);
      }
    };

    // Initial check
    checkTime();
    
    // Check every minute
    const interval = setInterval(checkTime, 60000);
    
    return () => clearInterval(interval);
  }, [generateSplashes, generatePowderBursts, isLoggedIn]);

  // Show immediately on mount for logged-in users
  useEffect(() => {
    if (!isLoggedIn) return;
    
    setIsActive(true);
    setColorSplashes(generateSplashes());
    setPowderBursts(generatePowderBursts());
    setTimeout(() => setIsActive(false), 30000);
  }, [generateSplashes, generatePowderBursts, isLoggedIn]);

  // Don't render if not logged in or not active
  if (!isLoggedIn || !isActive) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      {/* HD Background overlay with multi-layer gradient */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 20% 30%, rgba(255,20,147,0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(0,191,255,0.15) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(255,215,0,0.1) 0%, transparent 60%)
          `,
          animation: 'bgPulse 4s ease-in-out infinite',
        }}
      />

      {/* HD Color splashes with variable blur for depth */}
      {colorSplashes.map((splash) => (
        <div
          key={splash.id}
          className="absolute rounded-full animate-splash"
          style={{
            left: `${splash.x}%`,
            top: `${splash.y}%`,
            width: `${splash.size}px`,
            height: `${splash.size}px`,
            background: `radial-gradient(circle, ${splash.color} 0%, ${splash.color}aa 30%, ${splash.color}55 50%, transparent 70%)`,
            animationDelay: `${splash.delay}s`,
            animationDuration: `${splash.duration}s`,
            transform: `rotate(${splash.rotation}deg)`,
            filter: `blur(${splash.blur}px)`,
            boxShadow: `0 0 ${splash.size/3}px ${splash.color}66`,
          }}
        />
      ))}

      {/* HD Powder burst effects - new layer */}
      {powderBursts.map((burst) => (
        <div
          key={`burst-${burst.id}`}
          className="absolute animate-powder-burst"
          style={{
            left: `${burst.x}%`,
            top: `${burst.y}%`,
            width: '120px',
            height: '120px',
            background: `radial-gradient(ellipse, ${burst.color}cc 0%, ${burst.color}66 30%, transparent 70%)`,
            borderRadius: '50%',
            animationDelay: `${burst.delay}s`,
            opacity: burst.opacity,
            transform: `scale(${burst.scale})`,
            filter: 'blur(3px)',
          }}
        />
      ))}

      {/* HD Floating powder particles - increased count for density */}
      {[...Array(150)].map((_, i) => {
        const size = Math.random() * 25 + 8;
        const color = holiColors[Math.floor(Math.random() * holiColors.length)];
        return (
          <div
            key={`particle-${i}`}
            className="absolute animate-float-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${size}px`,
              height: `${size}px`,
              background: `radial-gradient(circle, ${color} 0%, ${color}88 60%, transparent 100%)`,
              borderRadius: '50%',
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${Math.random() * 6 + 3}s`,
              boxShadow: `0 0 ${size/2}px ${color}88`,
            }}
          />
        );
      })}

      {/* HD Color streams - smoother gradients */}
      {[...Array(20)].map((_, i) => (
        <div
          key={`stream-${i}`}
          className="absolute animate-color-stream"
          style={{
            left: `${(i / 20) * 100}%`,
            top: '-20%',
            width: `${Math.random() * 120 + 60}px`,
            height: '150vh',
            background: `linear-gradient(180deg, 
              ${holiColors[i % holiColors.length]}bb 0%, 
              ${holiColors[(i + 5) % holiColors.length]}66 50%, 
              transparent 100%)`,
            animationDelay: `${i * 0.25}s`,
            transform: `rotate(${Math.random() * 20 - 10}deg)`,
            filter: 'blur(6px)',
          }}
        />
      ))}

      {/* HD Center celebration text with glow effect */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center animate-bounce-slow">
          <h1 
            className="text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-bold mb-4 animate-rainbow-text"
            style={{
              textShadow: `
                4px 4px 8px rgba(0,0,0,0.6), 
                0 0 60px rgba(255,255,255,0.9),
                0 0 100px rgba(255,20,147,0.6),
                0 0 150px rgba(0,191,255,0.4)
              `,
              fontFamily: '"Playfair Display", cursive, sans-serif',
              letterSpacing: '2px',
            }}
          >
            🎨 Happy Holi! 🎨
          </h1>
          <p 
            className="text-xl sm:text-2xl md:text-4xl lg:text-5xl text-white font-bold"
            style={{
              textShadow: `
                2px 2px 4px rgba(0,0,0,0.9),
                0 0 30px rgba(255,215,0,0.8),
                0 0 60px rgba(255,105,180,0.5)
              `,
              letterSpacing: '3px',
            }}
          >
            होळीच्या हार्दिक शुभेच्छा!
          </p>
          <div className="mt-6 flex justify-center gap-3 sm:gap-4">
            {['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🩷'].map((emoji, i) => (
              <span 
                key={i} 
                className="text-3xl sm:text-4xl md:text-5xl animate-bounce"
                style={{ 
                  animationDelay: `${i * 0.1}s`,
                  filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.8))',
                }}
              >
                {emoji}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* HD Pichkari water streams - more streams */}
      {[...Array(12)].map((_, i) => (
        <div
          key={`water-${i}`}
          className="absolute animate-water-spray"
          style={{
            left: i % 2 === 0 ? '-5%' : '95%',
            top: `${15 + i * 7}%`,
            width: '350px',
            height: '25px',
            background: `linear-gradient(${i % 2 === 0 ? '90deg' : '270deg'}, 
              ${holiColors[i % holiColors.length]} 0%, 
              ${holiColors[(i + 3) % holiColors.length]}88 50%,
              transparent 100%)`,
            borderRadius: '50%',
            animationDelay: `${i * 0.4}s`,
            filter: 'blur(2px)',
            boxShadow: `0 0 15px ${holiColors[i % holiColors.length]}88`,
          }}
        />
      ))}

      {/* HD Confetti rain effect - new layer */}
      {[...Array(60)].map((_, i) => {
        const color = holiColors[Math.floor(Math.random() * holiColors.length)];
        return (
          <div
            key={`confetti-${i}`}
            className="absolute animate-confetti-fall"
            style={{
              left: `${Math.random() * 100}%`,
              top: '-5%',
              width: `${Math.random() * 12 + 6}px`,
              height: `${Math.random() * 18 + 10}px`,
              background: color,
              borderRadius: '2px',
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${Math.random() * 4 + 3}s`,
              transform: `rotate(${Math.random() * 360}deg)`,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
        );
      })}

      {/* HD CSS Animations */}
      <style>{`
        @keyframes bgPulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }

        @keyframes splash {
          0% {
            transform: scale(0) rotate(0deg);
            opacity: 0;
          }
          15% {
            opacity: 0.9;
          }
          50% {
            transform: scale(1.8) rotate(180deg);
            opacity: 0.7;
          }
          100% {
            transform: scale(2.5) rotate(360deg);
            opacity: 0;
          }
        }

        @keyframes powder-burst {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          30% {
            transform: scale(1.5);
            opacity: 0.8;
          }
          60% {
            transform: scale(2.5);
            opacity: 0.5;
          }
          100% {
            transform: scale(4);
            opacity: 0;
          }
        }

        @keyframes float-particle {
          0%, 100% {
            transform: translateY(0) translateX(0) rotate(0deg) scale(1);
            opacity: 0;
          }
          10% {
            opacity: 0.9;
          }
          30% {
            transform: translateY(-60px) translateX(30px) rotate(120deg) scale(1.2);
          }
          50% {
            transform: translateY(-120px) translateX(60px) rotate(180deg) scale(1);
            opacity: 0.7;
          }
          70% {
            transform: translateY(-80px) translateX(90px) rotate(240deg) scale(0.8);
          }
          90% {
            opacity: 0.3;
          }
        }

        @keyframes color-stream {
          0% {
            transform: translateY(-100%) rotate(var(--rotation, 0deg));
            opacity: 0;
          }
          20% {
            opacity: 0.6;
          }
          50% {
            opacity: 0.8;
          }
          80% {
            opacity: 0.4;
          }
          100% {
            transform: translateY(100%) rotate(var(--rotation, 0deg));
            opacity: 0;
          }
        }

        @keyframes water-spray {
          0%, 100% {
            transform: scaleX(0) translateX(0);
            opacity: 0;
          }
          30% {
            transform: scaleX(0.7) translateX(20px);
            opacity: 0.9;
          }
          50% {
            transform: scaleX(1) translateX(40px);
            opacity: 0.85;
          }
          70% {
            transform: scaleX(0.8) translateX(30px);
            opacity: 0.6;
          }
        }

        @keyframes confetti-fall {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0.3;
          }
        }

        @keyframes rainbow-text {
          0% { color: #FF1493; text-shadow: 0 0 60px #FF1493; }
          14% { color: #FF6B35; text-shadow: 0 0 60px #FF6B35; }
          28% { color: #FFD700; text-shadow: 0 0 60px #FFD700; }
          42% { color: #00FF7F; text-shadow: 0 0 60px #00FF7F; }
          57% { color: #00BFFF; text-shadow: 0 0 60px #00BFFF; }
          71% { color: #8A2BE2; text-shadow: 0 0 60px #8A2BE2; }
          85% { color: #FF4500; text-shadow: 0 0 60px #FF4500; }
          100% { color: #FF1493; text-shadow: 0 0 60px #FF1493; }
        }

        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-25px) scale(1.02); }
        }

        .animate-splash {
          animation: splash ease-out infinite;
        }

        .animate-powder-burst {
          animation: powder-burst ease-out infinite 4s;
        }

        .animate-float-particle {
          animation: float-particle ease-in-out infinite;
        }

        .animate-color-stream {
          animation: color-stream linear infinite 10s;
        }

        .animate-water-spray {
          animation: water-spray ease-in-out infinite 2.5s;
        }

        .animate-confetti-fall {
          animation: confetti-fall linear infinite;
        }

        .animate-rainbow-text {
          animation: rainbow-text linear infinite 4s;
        }

        .animate-bounce-slow {
          animation: bounce-slow ease-in-out infinite 2.5s;
        }
      `}</style>
    </div>
  );
};

export default HoliCelebration;
