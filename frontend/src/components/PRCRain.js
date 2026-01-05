import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Realistic Rain Drop Component with Gain/Loss Feedback
const RainDrop = ({ drop, onTap, disabled }) => {
  const [tapped, setTapped] = useState(false);
  const [showResult, setShowResult] = useState(null);
  const dropRef = useRef(null);

  const handleTap = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (tapped || disabled) return;
    setTapped(true);
    
    onTap(drop, (result) => {
      setShowResult(result);
      setTimeout(() => setShowResult(null), 1500);
    });
  };

  // Handle both touch and mouse events for desktop/mobile
  const handleInteraction = (e) => {
    e.preventDefault();
    handleTap(e);
  };

  return (
    <div
      ref={dropRef}
      className={`absolute transition-all duration-200 select-none ${tapped ? 'pointer-events-none' : 'cursor-pointer'}`}
      style={{
        left: `${drop.x}%`,
        top: `${drop.y}%`,
        transform: `scale(${drop.scale})`,
        animation: tapped ? 'none' : `rainFall ${drop.duration}s linear forwards`,
        zIndex: tapped ? 1000 : Math.floor(drop.z),
        opacity: tapped ? 0 : 1,
        pointerEvents: tapped || disabled ? 'none' : 'auto',
        touchAction: 'manipulation',
      }}
      onClick={handleInteraction}
      onTouchStart={handleInteraction}
      onMouseDown={handleInteraction}
      data-testid="rain-drop"
    >
      {/* Realistic Water Drop Shape */}
      <div className="relative">
        {/* Main Drop Body - Teardrop Shape */}
        <svg 
          width="48" 
          height="64" 
          viewBox="0 0 48 64" 
          className={`drop-shadow-lg transition-transform duration-100 ${!tapped ? 'hover:scale-125 active:scale-90' : ''}`}
          style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }}
        >
          <defs>
            {/* Water Gradient */}
            <linearGradient id={`dropGrad-${drop.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={`${drop.color}ee`} />
              <stop offset="50%" stopColor={drop.color} />
              <stop offset="100%" stopColor={`${drop.color}88`} />
            </linearGradient>
            {/* Shine Gradient */}
            <radialGradient id={`shine-${drop.id}`} cx="30%" cy="30%" r="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          
          {/* Drop Shape - Teardrop */}
          <path
            d="M24 4 C24 4, 44 28, 44 40 C44 52, 35 60, 24 60 C13 60, 4 52, 4 40 C4 28, 24 4, 24 4 Z"
            fill={`url(#dropGrad-${drop.id})`}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1"
          />
          
          {/* Inner Shine - Top Left */}
          <ellipse cx="16" cy="28" rx="8" ry="12" fill={`url(#shine-${drop.id})`} opacity="0.6" />
          
          {/* Small Highlight */}
          <circle cx="14" cy="24" r="3" fill="rgba(255,255,255,0.7)" />
          <circle cx="18" cy="30" r="2" fill="rgba(255,255,255,0.4)" />
          
          {/* Bottom Reflection */}
          <ellipse cx="24" cy="50" rx="10" ry="4" fill="rgba(255,255,255,0.15)" />
        </svg>

        {/* Ripple Effect on Tap */}
        {tapped && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="absolute w-20 h-20 rounded-full border-4 animate-ripple"
              style={{ borderColor: drop.color }}
            />
            <div 
              className="absolute w-16 h-16 rounded-full border-2 animate-ripple"
              style={{ borderColor: drop.color, animationDelay: '0.1s' }}
            />
          </div>
        )}
      </div>

      {/* Result Popup - GAIN or LOSS with clear feedback */}
      {showResult && (
        <div 
          className="absolute left-1/2 z-[9999] pointer-events-none"
          style={{ 
            top: '-80px',
            transform: 'translateX(-50%)',
          }}
        >
          {/* Result Card */}
          <div 
            className={`relative px-5 py-3 rounded-2xl font-bold text-center whitespace-nowrap animate-resultPop ${
              showResult.prc_change >= 0 
                ? 'bg-gradient-to-br from-green-400 to-emerald-600' 
                : 'bg-gradient-to-br from-red-400 to-rose-600'
            }`}
            style={{ 
              boxShadow: showResult.prc_change >= 0 
                ? '0 0 30px rgba(34,197,94,0.8), 0 0 60px rgba(34,197,94,0.4)' 
                : '0 0 30px rgba(239,68,68,0.8), 0 0 60px rgba(239,68,68,0.4)',
            }}
          >
            {/* Icon */}
            <div className="text-3xl mb-1">
              {showResult.prc_change >= 0 ? '🎉' : '💔'}
            </div>
            
            {/* Label */}
            <div className={`text-xs uppercase tracking-wider mb-1 ${
              showResult.prc_change >= 0 ? 'text-green-100' : 'text-red-100'
            }`}>
              {showResult.prc_change >= 0 ? 'WIN!' : 'LOSS!'}
            </div>
            
            {/* Amount */}
            <div className="text-2xl font-black text-white">
              {showResult.prc_change >= 0 ? '+' : ''}{showResult.prc_change.toFixed(1)}
            </div>
            <div className="text-xs text-white/80">PRC</div>
            
            {/* Arrow Pointer */}
            <div 
              className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 ${
                showResult.prc_change >= 0 ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Generate random positions once
const generateRandomPositions = (count, seed = 1) => {
  const positions = [];
  let rand = seed;
  const pseudoRandom = () => {
    rand = (rand * 9301 + 49297) % 233280;
    return rand / 233280;
  };
  
  for (let i = 0; i < count; i++) {
    positions.push({
      left: pseudoRandom() * 100,
      height: 20 + pseudoRandom() * 30,
      top: pseudoRandom() * 100,
      duration: 1 + pseudoRandom(),
      delay: pseudoRandom() * 2,
      opacity: 0.3 + pseudoRandom() * 0.4
    });
  }
  return positions;
};

const generateStarPositions = (count, seed = 2) => {
  const positions = [];
  let rand = seed;
  const pseudoRandom = () => {
    rand = (rand * 9301 + 49297) % 233280;
    return rand / 233280;
  };
  
  for (let i = 0; i < count; i++) {
    positions.push({
      left: pseudoRandom() * 100,
      top: pseudoRandom() * 100,
      duration: 2 + pseudoRandom() * 2,
      delay: pseudoRandom() * 2
    });
  }
  return positions;
};

// Main PRC Rain Component
const PRCRain = ({ user, onComplete }) => {
  const [isActive, setIsActive] = useState(false);
  const [session, setSession] = useState(null);
  const [drops, setDrops] = useState([]);
  const [tapsRemaining, setTapsRemaining] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [summary, setSummary] = useState(null);
  const [dropColors, setDropColors] = useState([]);
  const [totalGained, setTotalGained] = useState(0);
  const [totalLost, setTotalLost] = useState(0);
  const dropIdRef = useRef(0);
  const timerRef = useRef(null);
  const spawnRef = useRef(null);
  const checkIntervalRef = useRef(null);
  const isActiveRef = useRef(false);
  const sessionRef = useRef(null);

  // Pre-generate random positions for background elements
  const bgRainPositions = useMemo(() => generateRandomPositions(50, 1), []);
  const starPositions = useMemo(() => generateStarPositions(30, 2), []);

  // Sound effects
  const playSound = useCallback((type) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      gainNode.gain.value = 0.15;

      switch (type) {
        case 'start':
          oscillator.frequency.value = 600;
          oscillator.type = 'sine';
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          break;
        case 'positive':
          oscillator.frequency.value = 880;
          oscillator.type = 'sine';
          oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
          break;
        case 'negative':
          oscillator.frequency.value = 400;
          oscillator.type = 'sawtooth';
          oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.2);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
          break;
        case 'end':
          oscillator.frequency.value = 520;
          oscillator.type = 'triangle';
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
          break;
        default:
          oscillator.frequency.value = 440;
      }

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      // Audio not supported
    }
  }, []);

  // End rain session
  const endRain = useCallback(async () => {
    if (!sessionRef.current) return;

    if (spawnRef.current) clearTimeout(spawnRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const response = await axios.post(`${API}/api/prc-rain/end-session`, {
        session_id: sessionRef.current,
        user_id: user.uid
      });

      setSummary(response.data.summary);
      playSound('end');

      setTimeout(() => {
        setIsActive(false);
        isActiveRef.current = false;
        setSession(null);
        sessionRef.current = null;
        setDrops([]);
        setSummary(null);
        if (onComplete) onComplete();
      }, 5000);
    } catch (error) {
      console.error('Error ending session:', error);
      setIsActive(false);
      isActiveRef.current = false;
    }
  }, [user?.uid, onComplete, playSound]);

  // Start rain session
  const startRain = useCallback((data) => {
    setIsActive(true);
    isActiveRef.current = true;
    setSession({ id: data.session_id });
    sessionRef.current = data.session_id;
    setDropColors(data.drop_colors || ['#22c55e', '#3b82f6', '#eab308', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']);
    setTapsRemaining(data.max_taps || 15);
    setTimeRemaining(data.duration_seconds || 30);
    setSummary(null);
    setDrops([]);
    setTotalGained(0);
    setTotalLost(0);

    playSound('start');
    
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }

    toast.success('🌧️ PRC Rain Started! Tap drops to win!', { duration: 3000 });
  }, [playSound]);

  // Check for rain trigger
  const checkRainTrigger = useCallback(async () => {
    if (isActiveRef.current || !user?.uid) return;
    
    try {
      const response = await axios.get(`${API}/api/prc-rain/check/${user.uid}`);
      if (response.data.should_rain) {
        startRain(response.data);
      }
    } catch (error) {
      console.error('Error checking rain:', error);
    }
  }, [user?.uid, startRain]);

  // Spawn drops with realistic rain effect
  useEffect(() => {
    if (!isActive || dropColors.length === 0) return;

    const spawnDrop = () => {
      const randomColor = dropColors[Math.floor(Math.random() * dropColors.length)];
      
      const newDrop = {
        id: dropIdRef.current++,
        color: randomColor,
        x: Math.random() * 80 + 10,
        y: -15,
        z: Math.random() * 50 + 10,
        scale: 0.6 + Math.random() * 0.6,
        duration: 3 + Math.random() * 2,
        wobble: Math.random() * 10 - 5,
      };

      setDrops(prev => [...prev.slice(-30), newDrop]);
    };

    const spawnWithVariation = () => {
      spawnDrop();
      spawnRef.current = setTimeout(spawnWithVariation, 200 + Math.random() * 300);
    };

    spawnWithVariation();

    return () => {
      if (spawnRef.current) clearTimeout(spawnRef.current);
    };
  }, [isActive, dropColors]);

  // Timer countdown
  useEffect(() => {
    if (!isActive) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          endRain();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, endRain]);

  // Check for rain every 30 seconds
  useEffect(() => {
    checkRainTrigger();
    checkIntervalRef.current = setInterval(checkRainTrigger, 30000);

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [checkRainTrigger]);

  // Handle drop tap
  const handleTap = useCallback(async (drop, callback) => {
    if (!sessionRef.current || tapsRemaining <= 0) return;

    try {
      const response = await axios.post(`${API}/api/prc-rain/tap`, {
        session_id: sessionRef.current,
        user_id: user.uid,
        drop_color: drop.color
      });

      const result = response.data;
      callback(result);

      setTapsRemaining(result.taps_remaining);

      if (result.prc_change >= 0) {
        setTotalGained(prev => prev + result.prc_change);
        playSound('positive');
        if (navigator.vibrate) navigator.vibrate(50);
      } else {
        setTotalLost(prev => prev + Math.abs(result.prc_change));
        playSound('negative');
        if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 50]);
      }

      setDrops(prev => prev.filter(d => d.id !== drop.id));

      if (result.taps_remaining <= 0) {
        setTimeout(endRain, 500);
      }
    } catch (error) {
      console.error('Error tapping drop:', error);
    }
  }, [user?.uid, tapsRemaining, playSound, endRain]);

  if (!isActive) return null;

  const netPRC = totalGained - totalLost;

  return (
    <>
      {/* Rain Overlay */}
      <div 
        className="fixed inset-0 z-50 overflow-hidden"
        style={{ 
          background: 'linear-gradient(180deg, #0a0a1a 0%, #1a0a2e 50%, #0a1a3a 100%)',
        }}
        data-testid="prc-rain-overlay"
      >
        {/* Animated Rain Background Effect */}
        <div className="absolute inset-0 overflow-hidden opacity-30">
          {bgRainPositions.map((pos, i) => (
            <div
              key={i}
              className="absolute w-0.5 bg-gradient-to-b from-transparent via-blue-400 to-transparent"
              style={{
                left: `${pos.left}%`,
                height: `${pos.height}px`,
                top: `${pos.top}%`,
                animation: `bgRainFall ${pos.duration}s linear infinite`,
                animationDelay: `${pos.delay}s`,
                opacity: pos.opacity
              }}
            />
          ))}
        </div>

        {/* Stars */}
        <div className="absolute inset-0 opacity-40">
          {starPositions.map((pos, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                left: `${pos.left}%`,
                top: `${pos.top}%`,
                animation: `twinkle ${pos.duration}s ease-in-out infinite`,
                animationDelay: `${pos.delay}s`
              }}
            />
          ))}
        </div>

        {/* Header Info - Timer and Taps */}
        <div className="absolute top-4 left-0 right-0 flex justify-center gap-4 z-20 px-4">
          <div className="bg-black/70 backdrop-blur-md px-6 py-3 rounded-2xl flex items-center gap-3 border border-blue-500/30 shadow-lg shadow-blue-500/20">
            <span className="text-2xl">⏱️</span>
            <span className="font-black text-3xl text-white">{timeRemaining}</span>
            <span className="text-white/60 text-sm">sec</span>
          </div>
          
          <div className="bg-black/70 backdrop-blur-md px-6 py-3 rounded-2xl flex items-center gap-3 border border-purple-500/30 shadow-lg shadow-purple-500/20">
            <span className="text-2xl">👆</span>
            <span className="font-black text-3xl text-white">{tapsRemaining}</span>
            <span className="text-white/60 text-sm">taps</span>
          </div>
        </div>

        {/* Live Score Strip */}
        <div className="absolute top-24 left-0 right-0 flex justify-center z-20 px-4">
          <div className="bg-black/60 backdrop-blur-md rounded-xl px-4 py-2 flex items-center gap-4 border border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-green-400 text-sm">🎉</span>
              <span className="text-green-400 font-bold">+{totalGained.toFixed(1)}</span>
            </div>
            <div className="w-px h-6 bg-white/20" />
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-sm">💔</span>
              <span className="text-red-400 font-bold">-{totalLost.toFixed(1)}</span>
            </div>
            <div className="w-px h-6 bg-white/20" />
            <div className={`font-bold ${netPRC >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              Net: {netPRC >= 0 ? '+' : ''}{netPRC.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Main Title */}
        <div className="absolute top-36 left-1/2 -translate-x-1/2 text-center z-10">
          <div 
            className="text-2xl sm:text-3xl font-black text-white mb-2"
            style={{ textShadow: '0 0 30px rgba(99,102,241,0.8), 0 4px 12px rgba(0,0,0,0.5)' }}
          >
            🌧️ TAP THE DROPS! 🌧️
          </div>
          <div className="text-sm text-gray-300/80">
            Each drop is a surprise - Gain or Loss! 🍀
          </div>
        </div>

        {/* Rain Drops Container */}
        <div 
          className="absolute inset-0 z-30"
          style={{ 
            top: '180px',
            perspective: '1000px',
          }}
        >
          {drops.map(drop => (
            <RainDrop
              key={drop.id}
              drop={drop}
              onTap={handleTap}
              disabled={tapsRemaining <= 0}
            />
          ))}
        </div>

        {/* Instruction for Desktop */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center z-10">
          <div className="bg-black/50 backdrop-blur rounded-full px-6 py-2 text-white/70 text-sm">
            💡 Click or tap on drops to collect PRC
          </div>
        </div>

        {/* Summary Modal */}
        {summary && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
            <div 
              className="p-8 rounded-3xl text-white text-center animate-scale-in max-w-sm mx-4"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.95) 0%, rgba(139,92,246,0.95) 50%, rgba(168,85,247,0.95) 100%)',
                boxShadow: '0 0 80px rgba(139,92,246,0.6), 0 20px 60px rgba(0,0,0,0.5)',
                border: '2px solid rgba(255,255,255,0.2)'
              }}
            >
              <div className="text-6xl mb-4">🌧️</div>
              <h2 className="text-3xl font-black mb-6">Rain Complete!</h2>
              
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur">
                  <div className="text-xs text-gray-300 mb-1">Taps</div>
                  <div className="text-3xl font-black">{summary.taps}</div>
                </div>
                <div className="bg-green-500/30 p-4 rounded-2xl backdrop-blur border border-green-400/30">
                  <div className="text-xs text-green-200 mb-1">Won</div>
                  <div className="text-3xl font-black text-green-300">+{summary.prc_gained?.toFixed(1)}</div>
                </div>
                <div className="bg-red-500/30 p-4 rounded-2xl backdrop-blur border border-red-400/30">
                  <div className="text-xs text-red-200 mb-1">Lost</div>
                  <div className="text-3xl font-black text-red-300">-{summary.prc_lost?.toFixed(1)}</div>
                </div>
              </div>
              
              {/* Net Result */}
              <div 
                className={`text-5xl font-black py-4 rounded-2xl ${
                  summary.net_prc >= 0 
                    ? 'bg-green-500/30 text-green-300 border border-green-400/30' 
                    : 'bg-red-500/30 text-red-300 border border-red-400/30'
                }`}
                style={{ textShadow: '0 0 30px currentColor' }}
              >
                {summary.net_prc >= 0 ? '🎉' : '💔'} {summary.net_prc >= 0 ? '+' : ''}{summary.net_prc?.toFixed(1)} PRC
              </div>
              
              <p className="text-white/60 text-sm mt-4">
                {summary.net_prc >= 0 ? 'Great job! Keep it up! 🚀' : 'Better luck next time! 💪'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes rainFall {
          0% { 
            transform: translateY(-50px) rotate(0deg); 
            opacity: 0; 
          }
          10% {
            opacity: 1;
          }
          85% { 
            opacity: 1; 
          }
          100% { 
            transform: translateY(calc(100vh - 180px)) rotate(10deg); 
            opacity: 0; 
          }
        }
        
        @keyframes bgRainFall {
          0% { 
            transform: translateY(-100%); 
          }
          100% { 
            transform: translateY(100vh); 
          }
        }
        
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }
        
        @keyframes ripple {
          0% { 
            transform: scale(0.5); 
            opacity: 1; 
          }
          100% { 
            transform: scale(2.5); 
            opacity: 0; 
          }
        }
        
        @keyframes scale-in {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        
        @keyframes resultPop {
          0% { 
            transform: translateX(-50%) translateY(20px) scale(0.3); 
            opacity: 0; 
          }
          40% { 
            transform: translateX(-50%) translateY(-10px) scale(1.2); 
            opacity: 1;
          }
          60% {
            transform: translateX(-50%) translateY(0) scale(1);
          }
          100% { 
            transform: translateX(-50%) translateY(0) scale(1); 
            opacity: 1; 
          }
        }
        
        .animate-scale-in {
          animation: scale-in 0.5s ease-out forwards;
        }
        
        .animate-ripple {
          animation: ripple 0.6s ease-out forwards;
        }
        
        .animate-resultPop {
          animation: resultPop 0.4s ease-out forwards;
        }
      `}</style>
    </>
  );
};

export default PRCRain;
