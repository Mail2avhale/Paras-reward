import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

// =====================================================
// SPEEDOMETER GAUGE - Mining Speed Display
// =====================================================
export const SpeedometerGauge = ({ value, maxValue = 10, label = "PRC/hr", boostActive = false }) => {
  const percentage = Math.min((value / maxValue) * 100, 100);
  const rotation = -135 + (percentage * 2.7); // -135 to 135 degrees
  
  return (
    <div className="relative flex flex-col items-center">
      <p className="text-cyan-400/80 text-xs font-medium mb-2 uppercase tracking-wider">Mining Speed</p>
      
      <div className="relative w-32 h-20">
        {/* Background arc */}
        <svg className="w-full h-full" viewBox="0 0 120 70">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Track background */}
          <path
            d="M 15 60 A 45 45 0 0 1 105 60"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          
          {/* Colored arc */}
          <path
            d="M 15 60 A 45 45 0 0 1 105 60"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            filter="url(#glow)"
          />
          
          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map((tick, i) => {
            const angle = (-135 + tick * 2.7) * (Math.PI / 180);
            const x1 = 60 + 35 * Math.cos(angle);
            const y1 = 60 + 35 * Math.sin(angle);
            const x2 = 60 + 42 * Math.cos(angle);
            const y2 = 60 + 42 * Math.sin(angle);
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
            );
          })}
          
          {/* Labels */}
          <text x="20" y="68" fill="rgba(255,255,255,0.5)" fontSize="8" fontWeight="bold">LOW</text>
          <text x="52" y="25" fill="rgba(255,255,255,0.5)" fontSize="8" fontWeight="bold">MID</text>
          <text x="88" y="68" fill="rgba(255,255,255,0.5)" fontSize="8" fontWeight="bold">HIGH</text>
        </svg>
        
        {/* Needle */}
        <motion.div 
          className="absolute bottom-2 left-1/2 origin-bottom"
          style={{ 
            width: '3px', 
            height: '32px',
            marginLeft: '-1.5px',
            background: 'linear-gradient(to top, #f97316, #fbbf24)',
            borderRadius: '2px',
            boxShadow: '0 0 10px #f97316'
          }}
          animate={{ rotate: rotation }}
          transition={{ type: "spring", stiffness: 60, damping: 15 }}
        />
        
        {/* Center dot */}
        <div className="absolute bottom-1 left-1/2 w-3 h-3 -ml-1.5 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 shadow-lg" />
      </div>
      
      {/* Value display */}
      <div className="text-center mt-2">
        <p className="text-2xl font-bold text-white">{value.toFixed(2)}</p>
        <p className="text-cyan-400/60 text-xs">{label}</p>
      </div>
      
      {/* Boost indicator */}
      {boostActive && (
        <div className="flex items-center gap-1 mt-2 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30">
          <span className="text-amber-400 text-[10px] font-medium">⚡ Referral Boost Active</span>
        </div>
      )}
    </div>
  );
};


// =====================================================
// CIRCULAR TIMER - Mining Session with Tap to Collect
// =====================================================
export const CircularTimer = ({ 
  timeRemaining, 
  totalTime = 86400, 
  currentPRC = 0,
  onCollect,
  isCollecting = false,
  canCollect = true
}) => {
  const progress = Math.max(0, Math.min(100, ((totalTime - timeRemaining) / totalTime) * 100));
  const strokeDasharray = 2 * Math.PI * 70; // circumference
  const strokeDashoffset = strokeDasharray - (progress / 100) * strokeDasharray;
  
  const hours = Math.floor(timeRemaining / 3600);
  const minutes = Math.floor((timeRemaining % 3600) / 60);
  const seconds = timeRemaining % 60;
  
  const formatTime = () => {
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const handleTap = () => {
    if (canCollect && currentPRC >= 0.01 && onCollect) {
      onCollect();
    }
  };
  
  return (
    <div className="relative flex flex-col items-center">
      <p className="text-cyan-400/80 text-xs font-medium mb-3 uppercase tracking-wider">Mining Session</p>
      
      <motion.div 
        className="relative cursor-pointer"
        whileTap={{ scale: 0.95 }}
        onClick={handleTap}
      >
        {/* Outer glow ring */}
        <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-xl" style={{ transform: 'scale(1.1)' }} />
        
        <svg width="180" height="180" className="transform -rotate-90">
          <defs>
            <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#67e8f9" />
            </linearGradient>
            <filter id="timerGlow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Background circle */}
          <circle
            cx="90"
            cy="90"
            r="70"
            fill="none"
            stroke="rgba(6, 182, 212, 0.1)"
            strokeWidth="10"
          />
          
          {/* Outer decorative ring */}
          <circle
            cx="90"
            cy="90"
            r="80"
            fill="none"
            stroke="rgba(6, 182, 212, 0.2)"
            strokeWidth="2"
            strokeDasharray="8 4"
          />
          
          {/* Progress arc */}
          <motion.circle
            cx="90"
            cy="90"
            r="70"
            fill="none"
            stroke="url(#timerGradient)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            filter="url(#timerGlow)"
            initial={{ strokeDashoffset: strokeDasharray }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.5 }}
          />
          
          {/* Inner decorative circle */}
          <circle
            cx="90"
            cy="90"
            r="55"
            fill="none"
            stroke="rgba(6, 182, 212, 0.15)"
            strokeWidth="1"
          />
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Timer display */}
          <p className="text-4xl font-bold text-white tracking-wider" style={{ fontFamily: 'monospace' }}>
            {formatTime()}
          </p>
          
          {/* PRC earned */}
          <p className="text-cyan-400 text-sm mt-1">
            +{currentPRC.toFixed(2)} PRC
          </p>
          
          {/* Collect indicator */}
          {currentPRC >= 0.01 && (
            <motion.p 
              className="text-emerald-400 text-xs mt-2 font-medium"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {isCollecting ? '⏳ Collecting...' : '👆 Tap to Collect'}
            </motion.p>
          )}
        </div>
        
        {/* Animated ring pulse when ready to collect */}
        {currentPRC >= 0.01 && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-emerald-400"
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </motion.div>
    </div>
  );
};


// =====================================================
// ODOMETER - Total PRC Mined Display
// =====================================================
const OdometerDigit = ({ digit, delay = 0 }) => {
  return (
    <div className="relative w-7 h-10 bg-gradient-to-b from-zinc-800 to-zinc-900 rounded overflow-hidden border border-zinc-700 shadow-inner">
      {/* Flip effect line */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-zinc-700 z-10" />
      
      <motion.div
        className="flex flex-col items-center justify-center h-full"
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        transition={{ delay, duration: 0.3, type: "spring" }}
      >
        <span className="text-2xl font-bold text-amber-400" style={{ fontFamily: 'monospace', textShadow: '0 0 10px rgba(251, 191, 36, 0.5)' }}>
          {digit}
        </span>
      </motion.div>
    </div>
  );
};

export const OdometerDisplay = ({ value, digits = 8, label = "Total PRC Mined" }) => {
  const valueStr = Math.floor(value).toString().padStart(digits, '0');
  
  return (
    <div className="flex flex-col items-center">
      <p className="text-cyan-400/80 text-xs font-medium mb-2 uppercase tracking-wider">{label}</p>
      
      <div className="flex gap-0.5 p-2 bg-zinc-950 rounded-lg border border-zinc-800 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
        {valueStr.split('').map((digit, index) => (
          <OdometerDigit key={index} digit={digit} delay={index * 0.05} />
        ))}
      </div>
      
      <p className="text-zinc-500 text-xs mt-2">PRC</p>
    </div>
  );
};


// =====================================================
// MAIN MINING DASHBOARD COMPONENT
// =====================================================
export const MiningDashboard = ({
  isMining,
  timeRemaining,
  currentPRC,
  totalPRCMined,
  miningRate,
  boostActive,
  onCollect,
  isCollecting
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a0f1a] via-[#0f172a] to-[#0a0f1a] border border-cyan-500/20 p-6">
      {/* Background grid effect */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }}
      />
      
      {/* Top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Main Timer - Center (Tappable) */}
        <div className="flex justify-center mb-6">
          <CircularTimer
            timeRemaining={timeRemaining}
            currentPRC={currentPRC}
            onCollect={onCollect}
            isCollecting={isCollecting}
            canCollect={isMining}
          />
        </div>
        
        {/* Speed and Total - Side by Side */}
        <div className="flex justify-between items-start gap-4">
          <SpeedometerGauge
            value={miningRate}
            maxValue={10}
            boostActive={boostActive}
          />
          
          <OdometerDisplay
            value={totalPRCMined}
            digits={8}
          />
        </div>
      </div>
      
      {/* Bottom decorative line */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
    </div>
  );
};

export default MiningDashboard;
