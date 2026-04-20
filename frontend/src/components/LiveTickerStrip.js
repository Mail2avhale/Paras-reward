import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { CheckCircle2, Smartphone, Tv, Banknote, Crown, MapPin } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ICON_MAP = {
  mobile: Smartphone,
  dth: Tv,
  bank: Banknote,
  crown: Crown,
};

const ICON_BG = {
  mobile: 'bg-blue-500/20 text-blue-400',
  dth: 'bg-purple-500/20 text-purple-400',
  bank: 'bg-emerald-500/20 text-emerald-400',
  crown: 'bg-amber-500/20 text-amber-400',
};

const LiveTickerStrip = () => {
  const [items, setItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hidden, setHidden] = useState(false);
  const intervalRef = useRef(null);

  // Fetch ticker items (refresh every 45s)
  useEffect(() => {
    let mounted = true;
    const fetchTicker = async () => {
      try {
        const res = await axios.get(`${API}/public/live-transactions`, { timeout: 6000 });
        if (mounted && res.data?.items) {
          setItems(res.data.items);
        }
      } catch (e) {
        // Silently fail — ticker is optional, non-critical UI
      }
    };
    fetchTicker();
    const refreshTimer = setInterval(fetchTicker, 45000);
    return () => { mounted = false; clearInterval(refreshTimer); };
  }, []);

  // Vertical slide: cycle every 3.2 seconds
  useEffect(() => {
    if (items.length === 0) return;
    intervalRef.current = setInterval(() => {
      setCurrentIndex(i => (i + 1) % items.length);
    }, 3200);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [items.length]);

  if (hidden || items.length === 0) return null;

  const current = items[currentIndex];
  const IconCmp = ICON_MAP[current?.icon] || CheckCircle2;
  const iconBg = ICON_BG[current?.icon] || 'bg-slate-500/20 text-slate-400';

  return (
    <div
      data-testid="live-ticker-strip"
      className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
      style={{ marginBottom: 'var(--bottom-nav-height, 0px)' }}
    >
      <div className="pointer-events-auto mx-auto max-w-3xl mb-[76px] sm:mb-0 px-2 sm:px-4">
        <div className="bg-black/85 backdrop-blur-sm border border-emerald-500/20 rounded-t-xl sm:rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 h-[42px]">
            {/* LIVE badge */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span className="text-[10px] font-bold text-rose-400 tracking-wider">LIVE</span>
            </div>

            {/* Vertical slide window */}
            <div className="relative flex-1 overflow-hidden h-[24px]">
              <div
                key={currentIndex}
                data-testid="live-ticker-item"
                className="flex items-center gap-2 h-full animate-slideUpFadeIn"
              >
                <span className={`flex items-center justify-center w-5 h-5 rounded-md flex-shrink-0 ${iconBg}`}>
                  <IconCmp className="w-3 h-3" />
                </span>
                <span className="text-white/90 text-xs sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis min-w-0">
                  <span className="font-mono font-semibold text-white">{current?.mobile}</span>
                  <span className="text-white/50 mx-1.5">•</span>
                  <span className="text-white/90">{current?.service}</span>
                  <span className="text-white/50 mx-1.5">•</span>
                  <span className="font-semibold text-amber-300">₹{Number(current?.amount || 0).toLocaleString('en-IN')}</span>
                  {current?.city && (
                    <>
                      <span className="text-white/50 mx-1.5">•</span>
                      <span className="inline-flex items-center gap-0.5 text-white/70">
                        <MapPin className="w-2.5 h-2.5" />{current.city}
                      </span>
                    </>
                  )}
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              </div>
            </div>

            {/* Dismiss */}
            <button
              onClick={() => setHidden(true)}
              aria-label="Dismiss live feed"
              data-testid="live-ticker-close-btn"
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-white/40 hover:text-white/90 hover:bg-white/10 transition"
            >
              <span className="text-sm leading-none">×</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUpFadeIn {
          0% { transform: translateY(100%); opacity: 0; }
          15% { transform: translateY(0); opacity: 1; }
          85% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-100%); opacity: 0; }
        }
        .animate-slideUpFadeIn {
          animation: slideUpFadeIn 3.2s ease-in-out both;
        }
      `}</style>
    </div>
  );
};

export default LiveTickerStrip;
