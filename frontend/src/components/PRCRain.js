import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Rain Drop Component
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
      {/* Drop Visual */}
      <div
        className="w-10 h-14 rounded-full relative"
        style={{
          background: `radial-gradient(ellipse at 30% 30%, ${drop.color}dd, ${drop.color})`,
          boxShadow: `0 4px 15px ${drop.color}80, inset 0 -3px 10px rgba(0,0,0,0.3), inset 0 3px 10px rgba(255,255,255,0.3)`,
          clipPath: 'polygon(50% 0%, 100% 60%, 80% 100%, 20% 100%, 0% 60%)',
        }}
      >
        {/* Shine effect */}
        <div className="absolute top-2 left-2 w-3 h-3 bg-white/50 rounded-full blur-sm" />
      </div>

      {/* Result popup */}
      {showResult && (
        <div
          className={`absolute -top-8 left-1/2 -translate-x-1/2 font-bold text-lg whitespace-nowrap animate-bounce ${
            showResult.prc_change >= 0 ? 'text-green-400' : 'text-red-400'
          }`}
          style={{ textShadow: '0 0 10px currentColor' }}
        >
          {showResult.prc_change >= 0 ? '+' : ''}{showResult.prc_change.toFixed(1)} PRC
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
  const [dropTypes, setDropTypes] = useState({});
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
    setDropTypes(data.drop_types || {});
    setTapsRemaining(data.max_taps || 15);
    setTimeRemaining(data.duration_seconds || 30);
    setSummary(null);
    setDrops([]);

    // Play start sound
    playSound('start');
    
    // Vibrate
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    toast.success('🌧️ PRC Rain Started! Tap the drops!', { duration: 3000 });
  };

  // Spawn drops
  useEffect(() => {
    if (!isActive || !dropTypes || Object.keys(dropTypes).length === 0) return;

    const spawnDrop = () => {
      // Calculate which drop type based on probability
      const rand = Math.random() * 100;
      let cumulative = 0;
      let selectedType = 'green';
      
      for (const [type, config] of Object.entries(dropTypes)) {
        cumulative += config.probability || 0;
        if (rand <= cumulative) {
          selectedType = type;
          break;
        }
      }

      const config = dropTypes[selectedType] || dropTypes.green;
      
      const newDrop = {
        id: dropIdRef.current++,
        type: selectedType,
        color: config.color,
        x: Math.random() * 85 + 5, // 5-90% horizontal
        y: -10,
        z: Math.random() * 50 + 10,
        scale: 0.7 + Math.random() * 0.6,
        duration: 3 + Math.random() * 2,
        is_negative: config.is_negative,
      };

      setDrops(prev => [...prev.slice(-20), newDrop]); // Keep max 20 drops
    };

    spawnRef.current = setInterval(spawnDrop, 400); // Spawn every 400ms

    return () => {
      if (spawnRef.current) clearInterval(spawnRef.current);
    };
  }, [isActive, dropTypes]);

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

  // Handle drop tap
  const handleTap = async (drop, callback) => {
    if (!session?.id || tapsRemaining <= 0) return;

    try {
      const response = await axios.post(`${API}/api/prc-rain/tap`, {
        session_id: session.id,
        user_id: user.uid,
        drop_type: drop.type
      });

      const result = response.data;
      callback(result);

      // Update taps remaining
      setTapsRemaining(result.taps_remaining);

      // Play sound based on result
      if (result.prc_change >= 0) {
        playSound('positive');
        if (navigator.vibrate) navigator.vibrate(50);
      } else {
        playSound('negative');
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
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

      // Show summary for 3 seconds
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

  // Simple sound effects using Web Audio API
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
          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
          break;
        case 'negative':
          oscillator.frequency.value = 200;
          oscillator.type = 'square';
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
          break;
        case 'end':
          oscillator.frequency.value = 500;
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
          background: 'rgba(0, 0, 30, 0.7)',
          backdropFilter: 'blur(4px)'
        }}
        data-testid="prc-rain-overlay"
      >
        {/* Header Info */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-6 text-white z-10">
          <div className="bg-black/50 px-4 py-2 rounded-full flex items-center gap-2">
            <span className="text-yellow-400">⏱️</span>
            <span className="font-bold text-xl">{timeRemaining}s</span>
          </div>
          <div className="bg-black/50 px-4 py-2 rounded-full flex items-center gap-2">
            <span className="text-blue-400">👆</span>
            <span className="font-bold text-xl">{tapsRemaining} taps</span>
          </div>
        </div>

        {/* Instruction */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 text-white text-center">
          <div className="text-2xl font-bold animate-pulse">🌧️ TAP THE DROPS! 🌧️</div>
          <div className="text-sm text-gray-300 mt-1">Green/Blue/Gold = +PRC | Red/Black = -PRC</div>
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
            <div className="bg-gradient-to-br from-purple-900 to-blue-900 p-8 rounded-3xl border-2 border-white/30 text-white text-center animate-scale-in">
              <h2 className="text-3xl font-bold mb-4">🌧️ Rain Complete!</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-white/10 p-3 rounded-xl">
                  <div className="text-sm text-gray-300">Taps</div>
                  <div className="text-2xl font-bold">{summary.taps}</div>
                </div>
                <div className="bg-green-500/20 p-3 rounded-xl">
                  <div className="text-sm text-green-300">Gained</div>
                  <div className="text-2xl font-bold text-green-400">+{summary.prc_gained?.toFixed(1)}</div>
                </div>
                <div className="bg-red-500/20 p-3 rounded-xl">
                  <div className="text-sm text-red-300">Lost</div>
                  <div className="text-2xl font-bold text-red-400">-{summary.prc_lost?.toFixed(1)}</div>
                </div>
              </div>
              <div className={`text-3xl font-bold ${summary.net_prc >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                Net: {summary.net_prc >= 0 ? '+' : ''}{summary.net_prc?.toFixed(1)} PRC
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes fall {
          0% { transform: translateY(-50px) rotate(0deg); }
          100% { transform: translateY(100vh) rotate(360deg); }
        }
        @keyframes scale-in {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out forwards;
        }
      `}</style>
    </>
  );
};

export default PRCRain;
