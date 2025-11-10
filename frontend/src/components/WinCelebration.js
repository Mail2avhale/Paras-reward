import React, { useEffect, useState } from 'react';
import { Trophy, Sparkles, Star, Coins } from 'lucide-react';

const WinCelebration = ({ 
  amount, 
  percentage, 
  message = "YOU WON!", 
  onClose,
  duration = 5000 
}) => {
  const [show, setShow] = useState(true);
  const [confetti, setConfetti] = useState([]);

  useEffect(() => {
    // Generate confetti particles
    const particles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 2,
      rotation: Math.random() * 360,
      color: ['#FFD700', '#FF1493', '#00CED1', '#FF69B4', '#FFA500'][Math.floor(Math.random() * 5)]
    }));
    setConfetti(particles);

    // Auto close after duration
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(() => onClose && onClose(), 500);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn">
      {/* Confetti Animation */}
      {confetti.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-3 h-3 rounded-full animate-confettiFall pointer-events-none"
          style={{
            left: `${particle.left}%`,
            top: '-20px',
            backgroundColor: particle.color,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            transform: `rotate(${particle.rotation}deg)`
          }}
        />
      ))}

      {/* Main Celebration Card */}
      <div className="relative z-10 text-center px-6 py-8 animate-bounceIn">
        {/* Animated Trophy */}
        <div className="relative mb-6 flex justify-center">
          <div className="absolute inset-0 animate-ping">
            <div className="w-32 h-32 bg-yellow-400/30 rounded-full mx-auto"></div>
          </div>
          <div className="relative bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 p-6 rounded-full shadow-2xl animate-pulse">
            <Trophy className="w-20 h-20 text-white animate-wiggle" />
          </div>
          
          {/* Floating Stars */}
          <Star className="absolute top-0 left-0 w-8 h-8 text-yellow-400 animate-float" />
          <Star className="absolute top-0 right-0 w-6 h-6 text-pink-400 animate-float" style={{ animationDelay: '0.2s' }} />
          <Sparkles className="absolute bottom-0 left-4 w-7 h-7 text-cyan-400 animate-float" style={{ animationDelay: '0.4s' }} />
          <Sparkles className="absolute bottom-0 right-4 w-6 h-6 text-purple-400 animate-float" style={{ animationDelay: '0.6s' }} />
        </div>

        {/* Message */}
        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 mb-4 animate-pulse tracking-wider">
          {message}
        </h1>

        {/* Percentage Badge */}
        <div className="inline-block bg-gradient-to-r from-green-400 to-emerald-600 px-8 py-3 rounded-full shadow-2xl mb-4 animate-scaleIn">
          <div className="text-5xl font-black text-white drop-shadow-lg flex items-center gap-2">
            <Sparkles className="w-10 h-10 animate-spin" />
            {percentage}% CASHBACK
            <Sparkles className="w-10 h-10 animate-spin" style={{ animationDirection: 'reverse' }} />
          </div>
        </div>

        {/* Amount Won */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl px-8 py-6 mb-6 border-4 border-yellow-400 animate-scaleIn" style={{ animationDelay: '0.2s' }}>
          <p className="text-2xl font-bold text-gray-700 mb-2">You Earned</p>
          <div className="flex items-center justify-center gap-3">
            <Coins className="w-12 h-12 text-yellow-500 animate-bounce" />
            <span className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-500 via-emerald-600 to-teal-600">
              ₹{amount}
            </span>
          </div>
          <p className="text-lg text-gray-600 mt-3 animate-pulse">
            💰 Added to your Cashback Wallet!
          </p>
        </div>

        {/* Success Message */}
        <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white px-6 py-3 rounded-full shadow-xl animate-pulse text-lg font-bold">
          🎊 Congratulations! Keep Playing! 🎊
        </div>

        {/* Close Button */}
        <button
          onClick={() => {
            setShow(false);
            setTimeout(() => onClose && onClose(), 500);
          }}
          className="mt-6 px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full text-sm font-semibold transition-all"
        >
          Continue
        </button>
      </div>

      {/* Additional Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Rotating Rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border-4 border-yellow-400/30 rounded-full animate-spinSlow"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border-4 border-pink-400/20 rounded-full animate-spinSlowReverse"></div>
      </div>
    </div>
  );
};

export default WinCelebration;
