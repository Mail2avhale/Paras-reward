import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RefreshCw, Info, X } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// PLME Demo Page - Preview real animal videos
const PLMEDemo = () => {
  const [currentVideo, setCurrentVideo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [error, setError] = useState(null);
  const [allAssets, setAllAssets] = useState({ cute_playful: [], calm_nature: [] });
  const [selectedCategory, setSelectedCategory] = useState('cute_playful');

  // Fetch PLME config to get available assets
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await axios.get(`${API}/api/plme/next-moment/demo-user`);
        if (response.data?.moment) {
          setCurrentVideo(response.data.moment);
        }
      } catch (err) {
        console.error('Failed to fetch PLME config:', err);
      }
    };
    fetchConfig();
  }, []);

  // Fetch next random video
  const fetchNextVideo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API}/api/plme/next-moment/demo-${Date.now()}`);
      if (response.data?.moment) {
        setCurrentVideo(response.data.moment);
      }
    } catch (err) {
      setError('Failed to load video');
    } finally {
      setIsLoading(false);
    }
  };

  // Show overlay demo
  const triggerOverlay = () => {
    setShowOverlay(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/30 to-gray-950 p-4">
      {/* Header */}
      <div className="text-center mb-8 pt-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          🎬 PLME Preview
        </h1>
        <p className="text-gray-400 text-sm">Paras Living Moments Engine</p>
        <p className="text-amber-400 text-xs mt-1">Real Animal Videos on Your Dashboard!</p>
      </div>

      {/* Current Video Preview */}
      <div className="max-w-sm mx-auto mb-6">
        <div className="bg-gray-900/50 rounded-2xl p-4 border border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Current Video</span>
            <span className={`px-2 py-1 rounded-full text-xs ${
              currentVideo?.category === 'cute_playful' 
                ? 'bg-pink-500/20 text-pink-400' 
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              {currentVideo?.category === 'cute_playful' ? '🎀 Cute' : '🌿 Calm'}
            </span>
          </div>

          {/* Video Preview Area */}
          <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-800 mb-3">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : currentVideo ? (
              <video
                key={currentVideo.id}
                src={currentVideo.url}
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                onError={(e) => setError('Video failed to load')}
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
          </div>

          {/* Video Info */}
          {currentVideo && (
            <div className="text-center mb-4">
              <p className="text-white font-medium">{currentVideo.name}</p>
              <p className="text-gray-500 text-xs">Duration: {currentVideo.duration}s</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={fetchNextVideo}
              disabled={isLoading}
              className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Next Video
            </button>
            <button
              onClick={triggerOverlay}
              className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-medium rounded-xl hover:opacity-90 transition-opacity"
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
              <span>After you log in, a cute animal video appears randomly</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400">2.</span>
              <span>Videos play for 12-25 seconds then disappear</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400">3.</span>
              <span>70% cute animals, 30% calm nature scenes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400">4.</span>
              <span>Different videos every time - no repeats!</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Overlay Demo */}
      <AnimatePresence>
        {showOverlay && currentVideo && (
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
                  className="absolute -inset-4 rounded-3xl blur-2xl opacity-50"
                  style={{
                    background: 'radial-gradient(circle, rgba(255, 200, 100, 0.4) 0%, rgba(255, 150, 50, 0.2) 50%, transparent 100%)'
                  }}
                />
                
                {/* Close button */}
                <button
                  onClick={() => setShowOverlay(false)}
                  className="absolute -top-2 -right-2 z-20 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-3 h-3 text-white" />
                </button>

                {/* Video container */}
                <div className="relative w-36 h-36 overflow-hidden rounded-2xl shadow-2xl border-2 border-white/20">
                  <video
                    src={currentVideo.url}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    playsInline
                    onEnded={() => setShowOverlay(false)}
                  />
                  <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
                
                {/* Label */}
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap"
                >
                  <span className="text-xs text-white/90 bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm font-medium">
                    {currentVideo.name}
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
