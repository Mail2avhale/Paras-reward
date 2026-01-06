import React, { useState, useEffect } from 'react';
import { Activity, Zap } from 'lucide-react';

/**
 * Live Mining Indicator Component
 * Shows animated "Mining Active • Live" badge when mining is active
 * Google Play Compliant - Shows reward points, not money
 */
const LiveMiningIndicator = ({ isMining, miningEndTime }) => {
  const [pulse, setPulse] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    // Pulse animation every 2 seconds
    const pulseInterval = setInterval(() => {
      setPulse(prev => !prev);
    }, 2000);

    return () => clearInterval(pulseInterval);
  }, []);

  useEffect(() => {
    if (!miningEndTime) return;

    const updateTimer = () => {
      const now = new Date();
      const end = new Date(miningEndTime);
      const diff = end - now;

      if (diff <= 0) {
        setTimeRemaining('Session ended');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeRemaining(`${hours}h ${minutes}m`);
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(timerInterval);
  }, [miningEndTime]);

  if (!isMining) {
    return (
      <div className="flex items-center gap-2 bg-gray-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-400/30">
        <div className="w-2 h-2 rounded-full bg-gray-400"></div>
        <span className="text-xs text-gray-300 font-medium">Mining Paused</span>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center gap-2 bg-green-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-green-400/30"
      data-testid="live-mining-indicator"
    >
      {/* Animated Dot */}
      <div className="relative">
        <div className={`w-2 h-2 rounded-full bg-green-400 ${pulse ? 'opacity-100' : 'opacity-60'} transition-opacity duration-1000`}></div>
        <div className={`absolute inset-0 w-2 h-2 rounded-full bg-green-400 ${pulse ? 'animate-ping' : ''}`}></div>
      </div>
      
      {/* Mining Active Text */}
      <div className="flex items-center gap-1.5">
        <Activity className="w-3.5 h-3.5 text-green-300" />
        <span className="text-xs text-green-200 font-semibold">Mining Active</span>
        <span className="text-xs text-green-400">•</span>
        <span className="text-xs text-green-300 font-medium">LIVE</span>
      </div>

      {/* Time Remaining */}
      {timeRemaining && (
        <>
          <span className="text-xs text-green-400/60">|</span>
          <span className="text-xs text-green-200/80">{timeRemaining}</span>
        </>
      )}
    </div>
  );
};

export default LiveMiningIndicator;
