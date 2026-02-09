import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, Settings } from 'lucide-react';

// ============================================
// CUTE ANIMATED SVG CHARACTERS
// ============================================

// 1. PUPPY - Walks, wags tail, tilts head
const Puppy = ({ animate }) => (
  <motion.svg 
    viewBox="0 0 120 100" 
    className="w-32 h-28"
    animate={animate ? {
      x: [0, 10, 0, -10, 0],
    } : {}}
    transition={{ duration: 2, repeat: Infinity }}
  >
    {/* Body */}
    <motion.ellipse 
      cx="60" cy="60" rx="35" ry="25" 
      fill="#D2691E"
      animate={animate ? { scaleY: [1, 0.95, 1] } : {}}
      transition={{ duration: 0.5, repeat: Infinity }}
    />
    {/* Head */}
    <circle cx="60" cy="35" r="22" fill="#D2691E"/>
    {/* Ears */}
    <motion.ellipse 
      cx="40" cy="22" rx="10" ry="16" 
      fill="#8B4513"
      animate={animate ? { rotate: [-5, 5, -5] } : {}}
      transition={{ duration: 0.8, repeat: Infinity }}
    />
    <motion.ellipse 
      cx="80" cy="22" rx="10" ry="16" 
      fill="#8B4513"
      animate={animate ? { rotate: [5, -5, 5] } : {}}
      transition={{ duration: 0.8, repeat: Infinity }}
    />
    {/* Eyes */}
    <circle cx="52" cy="32" r="5" fill="#1a1a1a"/>
    <circle cx="68" cy="32" r="5" fill="#1a1a1a"/>
    <circle cx="53" cy="30" r="2" fill="white"/>
    <circle cx="69" cy="30" r="2" fill="white"/>
    {/* Nose */}
    <ellipse cx="60" cy="42" rx="5" ry="4" fill="#1a1a1a"/>
    {/* Tongue */}
    <motion.ellipse 
      cx="60" cy="50" rx="4" ry="6" 
      fill="#FF6B6B"
      animate={animate ? { scaleY: [1, 1.2, 1], y: [0, 2, 0] } : {}}
      transition={{ duration: 0.5, repeat: Infinity }}
    />
    {/* Tail */}
    <motion.path
      d="M95 55 Q110 45 105 60 Q100 70 95 65"
      fill="#D2691E"
      animate={animate ? { rotate: [-20, 20, -20] } : {}}
      transition={{ duration: 0.3, repeat: Infinity }}
      style={{ originX: '95px', originY: '60px' }}
    />
    {/* Legs */}
    <rect x="45" y="75" width="8" height="15" rx="4" fill="#8B4513"/>
    <rect x="67" y="75" width="8" height="15" rx="4" fill="#8B4513"/>
  </motion.svg>
);

// 2. CAT - Stretches, blinks, tail flicks
const Cat = ({ animate }) => (
  <motion.svg 
    viewBox="0 0 120 100" 
    className="w-32 h-28"
  >
    {/* Body */}
    <motion.ellipse 
      cx="60" cy="60" rx="30" ry="22" 
      fill="#808080"
      animate={animate ? { scaleX: [1, 1.05, 1] } : {}}
      transition={{ duration: 2, repeat: Infinity }}
    />
    {/* Head */}
    <circle cx="60" cy="38" r="20" fill="#808080"/>
    {/* Ears - Triangles */}
    <polygon points="42,25 50,40 34,40" fill="#808080"/>
    <polygon points="78,25 86,40 70,40" fill="#808080"/>
    <polygon points="44,28 48,38 38,38" fill="#FFB6C1"/>
    <polygon points="76,28 82,38 72,38" fill="#FFB6C1"/>
    {/* Eyes */}
    <motion.ellipse 
      cx="52" cy="35" rx="5" ry="6" 
      fill="#90EE90"
      animate={animate ? { scaleY: [1, 0.1, 1] } : {}}
      transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
    />
    <motion.ellipse 
      cx="68" cy="35" rx="5" ry="6" 
      fill="#90EE90"
      animate={animate ? { scaleY: [1, 0.1, 1] } : {}}
      transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
    />
    <ellipse cx="52" cy="35" rx="2" ry="4" fill="#1a1a1a"/>
    <ellipse cx="68" cy="35" rx="2" ry="4" fill="#1a1a1a"/>
    {/* Nose */}
    <polygon points="60,44 57,48 63,48" fill="#FFB6C1"/>
    {/* Whiskers */}
    <line x1="35" y1="42" x2="48" y2="44" stroke="#666" strokeWidth="1"/>
    <line x1="35" y1="46" x2="48" y2="46" stroke="#666" strokeWidth="1"/>
    <line x1="72" y1="44" x2="85" y2="42" stroke="#666" strokeWidth="1"/>
    <line x1="72" y1="46" x2="85" y2="46" stroke="#666" strokeWidth="1"/>
    {/* Tail */}
    <motion.path
      d="M90 60 Q105 50 100 70 Q95 85 85 80"
      fill="none"
      stroke="#808080"
      strokeWidth="8"
      strokeLinecap="round"
      animate={animate ? { d: [
        "M90 60 Q105 50 100 70 Q95 85 85 80",
        "M90 60 Q110 55 105 65 Q100 80 90 78",
        "M90 60 Q105 50 100 70 Q95 85 85 80"
      ]} : {}}
      transition={{ duration: 2, repeat: Infinity }}
    />
  </motion.svg>
);

// 3. BUNNY - Hops, ears twitch
const Bunny = ({ animate }) => (
  <motion.svg 
    viewBox="0 0 100 120" 
    className="w-28 h-32"
    animate={animate ? { y: [0, -15, 0] } : {}}
    transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1 }}
  >
    {/* Body */}
    <ellipse cx="50" cy="80" rx="25" ry="20" fill="white" stroke="#ddd" strokeWidth="1"/>
    {/* Head */}
    <circle cx="50" cy="50" r="22" fill="white" stroke="#ddd" strokeWidth="1"/>
    {/* Ears */}
    <motion.ellipse 
      cx="38" cy="20" rx="8" ry="25" 
      fill="white" stroke="#ddd" strokeWidth="1"
      animate={animate ? { rotate: [-10, 0, -10] } : {}}
      transition={{ duration: 1, repeat: Infinity }}
    />
    <motion.ellipse 
      cx="62" cy="20" rx="8" ry="25" 
      fill="white" stroke="#ddd" strokeWidth="1"
      animate={animate ? { rotate: [10, 0, 10] } : {}}
      transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
    />
    {/* Inner ears */}
    <ellipse cx="38" cy="22" rx="4" ry="18" fill="#FFB6C1"/>
    <ellipse cx="62" cy="22" rx="4" ry="18" fill="#FFB6C1"/>
    {/* Eyes */}
    <circle cx="42" cy="48" r="5" fill="#1a1a1a"/>
    <circle cx="58" cy="48" r="5" fill="#1a1a1a"/>
    <circle cx="43" cy="46" r="2" fill="white"/>
    <circle cx="59" cy="46" r="2" fill="white"/>
    {/* Nose */}
    <motion.ellipse 
      cx="50" cy="58" rx="4" ry="3" 
      fill="#FFB6C1"
      animate={animate ? { scale: [1, 1.1, 1] } : {}}
      transition={{ duration: 0.5, repeat: Infinity }}
    />
    {/* Cheeks */}
    <circle cx="35" cy="55" r="5" fill="#FFE4E1" opacity="0.7"/>
    <circle cx="65" cy="55" r="5" fill="#FFE4E1" opacity="0.7"/>
  </motion.svg>
);

// 4. BUTTERFLY - Flutters, hovers
const Butterfly = ({ animate }) => (
  <motion.svg 
    viewBox="0 0 100 80" 
    className="w-28 h-24"
    animate={animate ? { y: [0, -5, 0, 5, 0], x: [0, 3, 0, -3, 0] } : {}}
    transition={{ duration: 2, repeat: Infinity }}
  >
    {/* Left wings */}
    <motion.ellipse 
      cx="30" cy="30" rx="22" ry="18" 
      fill="#FF69B4" opacity="0.8"
      animate={animate ? { scaleX: [1, 0.7, 1] } : {}}
      transition={{ duration: 0.3, repeat: Infinity }}
    />
    <motion.ellipse 
      cx="32" cy="55" rx="16" ry="14" 
      fill="#FFB6C1" opacity="0.8"
      animate={animate ? { scaleX: [1, 0.6, 1] } : {}}
      transition={{ duration: 0.3, repeat: Infinity }}
    />
    {/* Right wings */}
    <motion.ellipse 
      cx="70" cy="30" rx="22" ry="18" 
      fill="#FF69B4" opacity="0.8"
      animate={animate ? { scaleX: [1, 0.7, 1] } : {}}
      transition={{ duration: 0.3, repeat: Infinity }}
    />
    <motion.ellipse 
      cx="68" cy="55" rx="16" ry="14" 
      fill="#FFB6C1" opacity="0.8"
      animate={animate ? { scaleX: [1, 0.6, 1] } : {}}
      transition={{ duration: 0.3, repeat: Infinity }}
    />
    {/* Wing patterns */}
    <circle cx="28" cy="28" r="6" fill="#FF1493"/>
    <circle cx="72" cy="28" r="6" fill="#FF1493"/>
    {/* Body */}
    <ellipse cx="50" cy="40" rx="5" ry="25" fill="#8B4513"/>
    {/* Antennae */}
    <motion.line 
      x1="48" y1="18" x2="42" y2="8" 
      stroke="#8B4513" strokeWidth="2" strokeLinecap="round"
      animate={animate ? { x2: [42, 40, 42] } : {}}
      transition={{ duration: 1, repeat: Infinity }}
    />
    <motion.line 
      x1="52" y1="18" x2="58" y2="8" 
      stroke="#8B4513" strokeWidth="2" strokeLinecap="round"
      animate={animate ? { x2: [58, 60, 58] } : {}}
      transition={{ duration: 1, repeat: Infinity }}
    />
    <circle cx="42" cy="6" r="2" fill="#8B4513"/>
    <circle cx="58" cy="6" r="2" fill="#8B4513"/>
  </motion.svg>
);

// 5. HAPPY CLOUD - Floats, smiles
const HappyCloud = ({ animate }) => (
  <motion.svg 
    viewBox="0 0 140 80" 
    className="w-36 h-24"
    animate={animate ? { x: [0, 10, 0], y: [0, -3, 0] } : {}}
    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
  >
    {/* Cloud body */}
    <ellipse cx="50" cy="50" rx="30" ry="22" fill="white"/>
    <ellipse cx="85" cy="50" rx="35" ry="28" fill="white"/>
    <ellipse cx="115" cy="55" rx="22" ry="18" fill="white"/>
    <ellipse cx="70" cy="35" rx="25" ry="20" fill="white"/>
    {/* Face */}
    <motion.circle 
      cx="70" cy="48" r="4" 
      fill="#333"
      animate={animate ? { scaleY: [1, 0.2, 1] } : {}}
      transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 3 }}
    />
    <motion.circle 
      cx="90" cy="48" r="4" 
      fill="#333"
      animate={animate ? { scaleY: [1, 0.2, 1] } : {}}
      transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 3 }}
    />
    {/* Blush */}
    <circle cx="62" cy="55" r="5" fill="#FFB6C1" opacity="0.5"/>
    <circle cx="98" cy="55" r="5" fill="#FFB6C1" opacity="0.5"/>
    {/* Smile */}
    <motion.path 
      d="M72 58 Q80 68 88 58" 
      fill="none" 
      stroke="#333" 
      strokeWidth="3" 
      strokeLinecap="round"
      animate={animate ? { d: ["M72 58 Q80 68 88 58", "M72 60 Q80 72 88 60", "M72 58 Q80 68 88 58"] } : {}}
      transition={{ duration: 2, repeat: Infinity }}
    />
  </motion.svg>
);

// 6. SQUIRREL - Dashes with acorn
const Squirrel = ({ animate }) => (
  <motion.svg 
    viewBox="0 0 100 100" 
    className="w-28 h-28"
  >
    {/* Tail */}
    <motion.path
      d="M75 50 Q95 30 85 55 Q80 75 70 70"
      fill="#D2691E"
      animate={animate ? { d: [
        "M75 50 Q95 30 85 55 Q80 75 70 70",
        "M75 50 Q100 25 88 50 Q82 72 70 68",
        "M75 50 Q95 30 85 55 Q80 75 70 70"
      ]} : {}}
      transition={{ duration: 1.5, repeat: Infinity }}
    />
    {/* Body */}
    <ellipse cx="50" cy="60" rx="22" ry="18" fill="#D2691E"/>
    {/* Head */}
    <circle cx="50" cy="38" r="16" fill="#D2691E"/>
    {/* Ears */}
    <circle cx="38" cy="25" r="6" fill="#D2691E"/>
    <circle cx="62" cy="25" r="6" fill="#D2691E"/>
    <circle cx="38" cy="25" r="3" fill="#FFE4C4"/>
    <circle cx="62" cy="25" r="3" fill="#FFE4C4"/>
    {/* Eyes */}
    <circle cx="44" cy="36" r="4" fill="#1a1a1a"/>
    <circle cx="56" cy="36" r="4" fill="#1a1a1a"/>
    <circle cx="45" cy="34" r="1.5" fill="white"/>
    <circle cx="57" cy="34" r="1.5" fill="white"/>
    {/* Nose */}
    <circle cx="50" cy="44" r="3" fill="#1a1a1a"/>
    {/* Acorn in hands */}
    <motion.g
      animate={animate ? { rotate: [-5, 5, -5] } : {}}
      transition={{ duration: 0.5, repeat: Infinity }}
    >
      <ellipse cx="38" cy="58" rx="6" ry="8" fill="#8B4513"/>
      <rect x="34" y="50" width="8" height="4" rx="2" fill="#654321"/>
    </motion.g>
    {/* Feet */}
    <ellipse cx="40" cy="78" rx="8" ry="4" fill="#8B4513"/>
    <ellipse cx="60" cy="78" rx="8" ry="4" fill="#8B4513"/>
  </motion.svg>
);

// 7. FIREFLIES - Glowing dots
const Fireflies = ({ animate }) => (
  <motion.svg viewBox="0 0 150 100" className="w-40 h-28">
    {[
      { cx: 30, cy: 30, delay: 0 },
      { cx: 70, cy: 20, delay: 0.5 },
      { cx: 110, cy: 35, delay: 1 },
      { cx: 50, cy: 60, delay: 1.5 },
      { cx: 90, cy: 70, delay: 2 },
      { cx: 130, cy: 55, delay: 0.3 },
      { cx: 20, cy: 75, delay: 0.8 },
    ].map((dot, i) => (
      <motion.g key={i}>
        {/* Glow */}
        <motion.circle
          cx={dot.cx}
          cy={dot.cy}
          r="8"
          fill="#FFD700"
          opacity="0.3"
          animate={animate ? { 
            opacity: [0.1, 0.5, 0.1],
            r: [6, 12, 6]
          } : {}}
          transition={{ duration: 2, repeat: Infinity, delay: dot.delay }}
        />
        {/* Core */}
        <motion.circle
          cx={dot.cx}
          cy={dot.cy}
          r="3"
          fill="#FFFF00"
          animate={animate ? { 
            opacity: [0.5, 1, 0.5],
            cy: [dot.cy, dot.cy - 5, dot.cy]
          } : {}}
          transition={{ duration: 2, repeat: Infinity, delay: dot.delay }}
        />
      </motion.g>
    ))}
  </motion.svg>
);

// 8. FALLING LEAVES
const FallingLeaves = ({ animate }) => (
  <motion.svg viewBox="0 0 150 120" className="w-40 h-32">
    {[
      { x: 20, color: '#228B22', delay: 0, size: 1 },
      { x: 50, color: '#32CD32', delay: 0.5, size: 0.8 },
      { x: 80, color: '#90EE90', delay: 1, size: 1.2 },
      { x: 110, color: '#228B22', delay: 1.5, size: 0.9 },
      { x: 140, color: '#32CD32', delay: 0.3, size: 1.1 },
    ].map((leaf, i) => (
      <motion.g 
        key={i}
        animate={animate ? {
          y: [-20, 140],
          x: [leaf.x, leaf.x + 20, leaf.x - 10, leaf.x + 15, leaf.x],
          rotate: [0, 180, 360, 540, 720]
        } : {}}
        transition={{ duration: 4, repeat: Infinity, delay: leaf.delay, ease: "linear" }}
      >
        <path
          d={`M${leaf.x} 0 Q${leaf.x + 8} 8 ${leaf.x} 16 Q${leaf.x - 8} 8 ${leaf.x} 0`}
          fill={leaf.color}
          transform={`scale(${leaf.size})`}
        />
        <line x1={leaf.x} y1="8" x2={leaf.x} y2="18" stroke="#654321" strokeWidth="1"/>
      </motion.g>
    ))}
  </motion.svg>
);

// Entry/Exit Animation Variants
const entryVariants = {
  walkIn: {
    initial: { x: -150, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 150, opacity: 0 }
  },
  peekIn: {
    initial: { x: -50, opacity: 0, scale: 0.5 },
    animate: { x: 0, opacity: 1, scale: 1 },
    exit: { x: 50, opacity: 0, scale: 0.5 }
  },
  dropIn: {
    initial: { y: -100, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 100, opacity: 0 }
  },
  fadeIn: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 }
  },
  hopIn: {
    initial: { y: 50, opacity: 0, scale: 0.5 },
    animate: { y: 0, opacity: 1, scale: 1 },
    exit: { y: -50, opacity: 0, scale: 0.5 }
  }
};

// Demo Page Component
const PLMEDemo = () => {
  const [activeCharacter, setActiveCharacter] = useState('puppy');
  const [isPlaying, setIsPlaying] = useState(true);
  const [entryStyle, setEntryStyle] = useState('walkIn');
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayCharacter, setOverlayCharacter] = useState(null);

  const characters = {
    puppy: { component: Puppy, name: 'Happy Puppy', category: 'cute' },
    cat: { component: Cat, name: 'Sleepy Cat', category: 'cute' },
    bunny: { component: Bunny, name: 'Hopping Bunny', category: 'cute' },
    butterfly: { component: Butterfly, name: 'Flutter Butterfly', category: 'cute' },
    cloud: { component: HappyCloud, name: 'Happy Cloud', category: 'cute' },
    squirrel: { component: Squirrel, name: 'Squirrel with Acorn', category: 'cute' },
    fireflies: { component: Fireflies, name: 'Fireflies', category: 'calm' },
    leaves: { component: FallingLeaves, name: 'Falling Leaves', category: 'calm' },
  };

  const ActiveComponent = characters[activeCharacter].component;

  const triggerOverlay = (charKey) => {
    setOverlayCharacter(charKey);
    setShowOverlay(true);
    setTimeout(() => setShowOverlay(false), 5000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          🎬 PLME Animation Demo
        </h1>
        <p className="text-gray-400">Paras Living Moments Engine - Preview</p>
      </div>

      {/* Main Preview Area */}
      <div className="max-w-md mx-auto mb-8">
        <div className="bg-gray-800/50 rounded-3xl p-8 border border-gray-700">
          <div className="text-center mb-4">
            <span className={`px-3 py-1 rounded-full text-sm ${
              characters[activeCharacter].category === 'cute' 
                ? 'bg-pink-500/20 text-pink-400' 
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              {characters[activeCharacter].category === 'cute' ? '🎀 Cute Playful' : '🌿 Calm Nature'}
            </span>
          </div>
          
          <div className="flex justify-center items-center h-48">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCharacter}
                variants={entryVariants[entryStyle]}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.5, type: 'spring' }}
              >
                <ActiveComponent animate={isPlaying} />
              </motion.div>
            </AnimatePresence>
          </div>
          
          <p className="text-center text-white font-medium mt-4">
            {characters[activeCharacter].name}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-md mx-auto mb-8">
        <div className="flex justify-center gap-4 mb-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 ${
              isPlaying ? 'bg-red-500' : 'bg-green-500'
            } text-white`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          
          <select
            value={entryStyle}
            onChange={(e) => setEntryStyle(e.target.value)}
            className="px-4 py-2 rounded-xl bg-gray-700 text-white border border-gray-600"
          >
            <option value="walkIn">Walk In</option>
            <option value="peekIn">Peek In</option>
            <option value="dropIn">Drop In</option>
            <option value="fadeIn">Fade In</option>
            <option value="hopIn">Hop In</option>
          </select>
        </div>
      </div>

      {/* Character Grid */}
      <div className="max-w-2xl mx-auto">
        <h2 className="text-white font-bold text-xl mb-4 text-center">Select Character</h2>
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(characters).map(([key, char]) => {
            const CharComponent = char.component;
            return (
              <button
                key={key}
                onClick={() => setActiveCharacter(key)}
                className={`p-3 rounded-2xl border-2 transition-all ${
                  activeCharacter === key 
                    ? 'border-amber-500 bg-amber-500/20' 
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
                }`}
              >
                <div className="flex justify-center transform scale-50">
                  <CharComponent animate={false} />
                </div>
                <p className="text-white text-xs mt-1 truncate">{char.name}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Demo Button */}
      <div className="max-w-md mx-auto mt-8 text-center">
        <button
          onClick={() => triggerOverlay(activeCharacter)}
          className="px-6 py-3 bg-gradient-to-r from-amber-500 to-pink-500 text-white font-bold rounded-2xl hover:scale-105 transition-transform"
        >
          🎬 Show Live Demo Overlay
        </button>
        <p className="text-gray-500 text-sm mt-2">
          Click to see how it appears on dashboard
        </p>
      </div>

      {/* Overlay Demo */}
      <AnimatePresence>
        {showOverlay && overlayCharacter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-50"
          >
            <motion.div
              initial={{ x: -200, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 200, opacity: 0 }}
              transition={{ type: 'spring', duration: 1 }}
              className="absolute left-1/4 top-1/3"
            >
              <div className="relative">
                <div className="absolute inset-0 blur-2xl bg-amber-400/30 rounded-full" />
                {React.createElement(characters[overlayCharacter].component, { animate: true })}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap"
                >
                  <span className="text-sm text-white bg-black/50 px-3 py-1 rounded-full">
                    {characters[overlayCharacter].name}
                  </span>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="max-w-md mx-auto mt-8 p-4 bg-gray-800/50 rounded-2xl border border-gray-700">
        <h3 className="text-white font-bold mb-3">📊 Asset Overview</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-pink-400">Cute Playful</p>
            <p className="text-white text-2xl font-bold">6 / 35</p>
          </div>
          <div>
            <p className="text-blue-400">Calm Nature</p>
            <p className="text-white text-2xl font-bold">2 / 15</p>
          </div>
        </div>
        <p className="text-gray-500 text-xs mt-3">
          * Demo shows 8 characters. Full version will have 50 unique animations.
        </p>
      </div>
    </div>
  );
};

export default PLMEDemo;
