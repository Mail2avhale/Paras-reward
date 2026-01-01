import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Rain Drop Component - RANDOM COLORS, NO TYPE HINTS
const RainDrop = ({ drop, onTap, disabled }) => {
  const [tapped, setTapped] = useState(false);
  const [showResult, setShowResult] = useState(null);

  const handleTap = () => {
    if (tapped || disabled) return;
    setTapped(true);
    onTap(drop, (result) => {
      setShowResult(result);
      setTimeout(() => setShowResult(null), 1000);
    });
  };

  return (
    <div
      className={`absolute cursor-pointer transition-all duration-150 ${tapped ? 'scale-150 opacity-0' : 'hover:scale-110'}`}
      style={{
        left: `${drop.x}%`,
        top: `${drop.y}%`,
        transform: `translateZ(${drop.z}px) scale(${drop.scale})`,
        animation: tapped ? 'none' : `fall ${drop.duration}s linear forwards`,
        zIndex: Math.floor(drop.z),
      }}
      onClick={handleTap}
    >
      {/* Drop Visual - Just color, no type indication */}
      <div
        className="w-12 h-16 rounded-full relative"
        style={{
          background: `radial-gradient(ellipse at 30% 30%, ${drop.color}dd, ${drop.color})`,
          boxShadow: `0 4px 20px ${drop.color}80, inset 0 -4px 12px rgba(0,0,0,0.3), inset 0 4px 12px rgba(255,255,255,0.4)`,
          clipPath: 'polygon(50% 0%, 100% 55%, 85% 100%, 15% 100%, 0% 55%)',
        }}
      >
        {/* Shine effect */}
        <div className="absolute top-2 left-3 w-3 h-3 bg-white/60 rounded-full blur-sm" />
        <div className="absolute top-4 left-2 w-2 h-2 bg-white/40 rounded-full" />
      </div>

      {/* Result popup - SURPRISE! */}
      {showResult && (
        <div
          className={`absolute -top-10 left-1/2 -translate-x-1/2 font-bold text-xl whitespace-nowrap ${
            showResult.prc_change >= 0 ? 'text-green-400' : 'text-red-400'
          }`}
          style={{ 
            textShadow: '0 0 15px currentColor, 0 0 30px currentColor',
            animation: 'popUp 0.5s ease-out'
          }}
        >
          {showResult.prc_change >= 0 ? '🎉 +' : '💔 '}{showResult.prc_change.toFixed(1)} PRC
        </div>
      )}
    </div>
  );
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
  const dropIdRef = useRef(0);
  const timerRef = useRef(null);
  const spawnRef = useRef(null);
  const checkIntervalRef = useRef(null);

  // Check for rain trigger
  const checkRainTrigger = useCallback(async () => {
    if (isActive || !user?.uid) return;
    
    try {
      const response = await axios.get(`${API}/api/prc-rain/check/${user.uid}`);
      if (response.data.should_rain) {
        startRain(response.data);
      }
    } catch (error) {
      console.error('Error checking rain:', error);
    }
  }, [isActive, user?.uid]);

  // Start rain session
  const startRain = (data) => {
    setIsActive(true);
    setSession({ id: data.session_id });
    setDropColors(data.drop_colors || ['#22c55e', '#3b82f6', '#eab308', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']);
    setTapsRemaining(data.max_taps || 15);
    setTimeRemaining(data.duration_seconds || 30);
    setSummary(null);
    setDrops([]);

    // Play start sound
    playSound('start');
    
    // Vibrate
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }

    toast.success('🌧️ PRC Rain Started! Tap drops to win!', { duration: 3000 });
  };

  // Spawn drops with RANDOM colors
  useEffect(() => {
    if (!isActive || dropColors.length === 0) return;

    const spawnDrop = () => {
      // Random color from available colors
      const randomColor = dropColors[Math.floor(Math.random() * dropColors.length)];
      
      const newDrop = {
        id: dropIdRef.current++,
        color: randomColor,
        x: Math.random() * 85 + 5, // 5-90% horizontal
        y: -10,
        z: Math.random() * 50 + 10,
        scale: 0.7 + Math.random() * 0.5,
        duration: 2.5 + Math.random() * 2,
      };

      setDrops(prev => [...prev.slice(-25), newDrop]); // Keep max 25 drops
    };

    spawnRef.current = setInterval(spawnDrop, 350); // Spawn every 350ms

    return () => {
      if (spawnRef.current) clearInterval(spawnRef.current);
    };
  }, [isActive, dropColors]);

  // Timer countdown
  useEffect(() => {
    if (!isActive || timeRemaining <= 0) return;

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
  }, [isActive]);

  // Check for rain every 2 minutes
  useEffect(() => {
    checkRainTrigger(); // Initial check
    checkIntervalRef.current = setInterval(checkRainTrigger, 120000); // Every 2 minutes

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [checkRainTrigger]);

  // Handle drop tap - RANDOM PRC, SURPRISE!
  const handleTap = async (drop, callback) => {
    if (!session?.id || tapsRemaining <= 0) return;

    try {
      const response = await axios.post(`${API}/api/prc-rain/tap`, {
        session_id: session.id,
        user_id: user.uid,
        drop_color: drop.color
      });

      const result = response.data;
      callback(result);

      // Update taps remaining
      setTapsRemaining(result.taps_remaining);

      // Play sound based on result - SURPRISE MOMENT!
      if (result.prc_change >= 0) {
        playSound('positive');
        if (navigator.vibrate) navigator.vibrate(50);
      } else {
        playSound('negative');
        if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 50]);
      }

      // Remove tapped drop
      setDrops(prev => prev.filter(d => d.id !== drop.id));

      // End if no taps remaining
      if (result.taps_remaining <= 0) {
        setTimeout(endRain, 500);
      }
    } catch (error) {
      console.error('Error tapping drop:', error);
    }
  };

  // End rain session
  const endRain = async () => {
    if (!session?.id) return;

    if (spawnRef.current) clearInterval(spawnRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const response = await axios.post(`${API}/api/prc-rain/end-session`, {
        session_id: session.id,
        user_id: user.uid
      });

      setSummary(response.data.summary);
      playSound('end');

      // Show summary for 4 seconds
      setTimeout(() => {
        setIsActive(false);
        setSession(null);
        setDrops([]);
        setSummary(null);
        if (onComplete) onComplete();
      }, 4000);
    } catch (error) {
      console.error('Error ending session:', error);
      setIsActive(false);
    }
  };

  // Sound effects using Web Audio API
  const playSound = (type) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      gainNode.gain.value = 0.1;

      switch (type) {
        case 'start':
          oscillator.frequency.value = 600;
          oscillator.type = 'sine';
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          break;
        case 'positive':
          oscillator.frequency.value = 880;
          oscillator.type = 'sine';
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
          break;
        case 'negative':
          oscillator.frequency.value = 150;
          oscillator.type = 'sawtooth';
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
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
  };

  if (!isActive) return null;

  return (
    <>
      {/* Rain Overlay */}
      <div 
        className="fixed inset-0 z-50 overflow-hidden"
        style={{ 
          background: 'linear-gradient(180deg, rgba(0,0,30,0.85) 0%, rgba(20,0,50,0.9) 100%)',
          backdropFilter: 'blur(8px)'
        }}
        data-testid="prc-rain-overlay"
      >
        {/* Animated Background Stars */}
        <div className="absolute inset-0 opacity-30">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`
              }}
            />
          ))}
        </div>

        {/* Header Info */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-4 z-10">
          <div className="bg-black/60 backdrop-blur px-5 py-2.5 rounded-full flex items-center gap-2 border border-white/20">
            <span className="text-yellow-400 text-lg">⏱️</span>
            <span className="font-bold text-2xl text-white">{timeRemaining}s</span>
          </div>
          <div className="bg-black/60 backdrop-blur px-5 py-2.5 rounded-full flex items-center gap-2 border border-white/20">
            <span className="text-blue-400 text-lg">👆</span>
            <span className="font-bold text-2xl text-white">{tapsRemaining}</span>
          </div>
        </div>

        {/* Main Title - NO COLOR HINTS! */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 text-center">
          <div className="text-3xl font-bold text-white animate-pulse" style={{ textShadow: '0 0 20px rgba(255,255,255,0.5)' }}>
            🌧️ TAP THE DROPS! 🌧️
          </div>
          <div className="text-sm text-gray-300 mt-2 opacity-80">
            Every drop is a surprise! Good luck! 🍀
          </div>
        </div>

        {/* Rain Drops */}
        <div className="relative w-full h-full" style={{ perspective: '1000px' }}>
          {drops.map(drop => (
            <RainDrop
              key={drop.id}
              drop={drop}
              onTap={handleTap}
              disabled={tapsRemaining <= 0}
            />
          ))}
        </div>

        {/* Summary Modal */}
        {summary && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="p-8 rounded-3xl text-white text-center animate-scale-in"
              style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.95) 0%, rgba(99,102,241,0.95) 50%, rgba(59,130,246,0.95) 100%)',
                boxShadow: '0 0 60px rgba(124,58,237,0.5)',
                border: '2px solid rgba(255,255,255,0.3)'
              }}
            >
              <h2 className="text-4xl font-bold mb-6">🌧️ Rain Complete!</h2>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white/10 p-4 rounded-xl backdrop-blur">
                  <div className="text-sm text-gray-300">Taps</div>
                  <div className="text-3xl font-bold">{summary.taps}</div>
                </div>
                <div className="bg-green-500/30 p-4 rounded-xl backdrop-blur">
                  <div className="text-sm text-green-200">Won</div>
                  <div className="text-3xl font-bold text-green-300">+{summary.prc_gained?.toFixed(1)}</div>
                </div>
                <div className="bg-red-500/30 p-4 rounded-xl backdrop-blur">
                  <div className="text-sm text-red-200">Lost</div>
                  <div className="text-3xl font-bold text-red-300">-{summary.prc_lost?.toFixed(1)}</div>
                </div>
              </div>
              <div className={`text-4xl font-bold ${summary.net_prc >= 0 ? 'text-green-300' : 'text-red-300'}`}
                   style={{ textShadow: '0 0 20px currentColor' }}>
                Net: {summary.net_prc >= 0 ? '🎉 +' : '💔 '}{summary.net_prc?.toFixed(1)} PRC
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fall {
          0% { transform: translateY(-50px) rotate(0deg); opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
        @keyframes scale-in {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes popUp {
          0% { transform: translateX(-50%) translateY(0) scale(0.5); opacity: 0; }
          50% { transform: translateX(-50%) translateY(-20px) scale(1.2); }
          100% { transform: translateX(-50%) translateY(-10px) scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.4s ease-out forwards;
        }
      `}</style>
    </>
  );
};

export default PRCRain;
