import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RefreshCw, Info, X } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// PLME Demo Page - Preview real animal images
const PLMEDemo = () => {
  const [currentMoment, setCurrentMoment] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [error, setError] = useState(null);

  // Fetch initial moment
  useEffect(() => {
    fetchNextMoment();
  }, []);

  // Fetch next random moment
  const fetchNextMoment = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API}/api/plme/next-moment/demo-${Date.now()}`);
      if (response.data?.moment) {
        setCurrentMoment(response.data.moment);
      }
    } catch (err) {
      setError('Failed to load content');
    } finally {
      setIsLoading(false);
    }
  };

  // Show overlay demo
  const triggerOverlay = () => {
    setShowOverlay(true);
    // Auto-hide after duration
    setTimeout(() => {
      setShowOverlay(false);
    }, (currentMoment?.duration || 15) * 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/30 to-gray-950 p-4">
      {/* Header */}
      <div className="text-center mb-8 pt-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          🎬 PLME Preview
        </h1>
        <p className="text-gray-400 text-sm">Paras Living Moments Engine</p>
        <p className="text-amber-400 text-xs mt-1">Photorealistic Animals on Your Dashboard!</p>
      </div>

      {/* Current Content Preview */}
      <div className="max-w-sm mx-auto mb-6">
        <div className="bg-gray-900/50 rounded-2xl p-4 border border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Current Moment</span>
            <span className={`px-2 py-1 rounded-full text-xs ${
              currentMoment?.category === 'cute_playful' 
                ? 'bg-pink-500/20 text-pink-400' 
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              {currentMoment?.category === 'cute_playful' ? '🎀 Cute' : '🌿 Calm'}
            </span>
          </div>

          {/* Image Preview Area */}
          <motion.div 
            className="relative aspect-square rounded-xl overflow-hidden bg-gray-800 mb-3"
            animate={{ scale: [1, 1.01, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : currentMoment ? (
              <img
                key={currentMoment.id}
                src={currentMoment.url}
                alt={currentMoment.name}
                className="w-full h-full object-cover"
                onError={(e) => setError('Image failed to load')}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                <Play className="w-12 h-12" />
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
          </motion.div>

          {/* Content Info */}
          {currentMoment && (
            <div className="text-center mb-4">
              <p className="text-white font-medium">{currentMoment.name}</p>
              <p className="text-gray-500 text-xs">Duration: {currentMoment.duration}s</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={fetchNextMoment}
              disabled={isLoading}
              className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Next Image
            </button>
            <button
              onClick={triggerOverlay}
              disabled={!currentMoment}
              className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              🎬 Demo Overlay
            </button>
          </div>
        </div>
      </div>

      {/* How it Works */}
      <div className="max-w-sm mx-auto">
        <div className="bg-gray-900/30 rounded-2xl p-4 border border-gray-800">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400" />
            How PLME Works
          </h3>
          <ul className="text-gray-400 text-sm space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-amber-400">1.</span>
              <span>After you log in, a cute animal image appears</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400">2.</span>
              <span>Images show for 15-18 seconds with gentle animation</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400">3.</span>
              <span>75% cute animals, 25% calm nature scenes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400">4.</span>
              <span>Different images every time - no repeats!</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Overlay Demo */}
      <AnimatePresence>
        {showOverlay && currentMoment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 pointer-events-none"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.3, x: -100 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.3, x: 100 }}
              transition={{ type: 'spring', duration: 0.6 }}
              className="absolute left-[10%] top-[20%] pointer-events-auto"
            >
              <div className="relative">
                {/* Glow effect */}
                <div 
                  className="absolute -inset-4 rounded-3xl blur-2xl opacity-60"
                  style={{
                    background: 'radial-gradient(circle, rgba(255, 200, 100, 0.5) 0%, rgba(255, 150, 50, 0.3) 50%, transparent 100%)'
                  }}
                />
                
                {/* Close button */}
                <button
                  onClick={() => setShowOverlay(false)}
                  className="absolute -top-2 -right-2 z-20 w-7 h-7 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center transition-colors shadow-lg"
                >
                  <X className="w-4 h-4 text-white" />
                </button>

                {/* Image container with breathing animation */}
                <motion.div 
                  className="relative w-36 h-36 overflow-hidden rounded-2xl shadow-2xl border-2 border-white/30"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <img
                    src={currentMoment.url}
                    alt={currentMoment.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/70 to-transparent" />
                </motion.div>
                
                {/* Label */}
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap"
                >
                  <span className="text-xs text-white bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm font-medium shadow-lg">
                    {currentMoment.name}
                  </span>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PLMEDemo;
