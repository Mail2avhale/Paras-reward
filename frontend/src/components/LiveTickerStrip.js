import React, { useState, useEffect } from 'react';
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

const LiveTickerItem = ({ item }) => {
  const IconCmp = ICON_MAP[item?.icon] || CheckCircle2;
  const iconBg = ICON_BG[item?.icon] || 'bg-slate-500/20 text-slate-400';
  return (
    <span
      data-testid="live-ticker-item"
      className="inline-flex items-center gap-2 px-4 whitespace-nowrap"
    >
      <span className={`flex items-center justify-center w-5 h-5 rounded-md flex-shrink-0 ${iconBg}`}>
        <IconCmp className="w-3 h-3" />
      </span>
      <span className="text-xs sm:text-sm">
        <span className="font-mono font-semibold text-white">{item?.mobile}</span>
        <span className="text-white/50 mx-1.5">•</span>
        <span className="text-white/90">{item?.service}</span>
        <span className="text-white/50 mx-1.5">•</span>
        <span className="font-semibold text-amber-300">₹{Number(item?.amount || 0).toLocaleString('en-IN')}</span>
        {item?.city && (
          <>
            <span className="text-white/50 mx-1.5">•</span>
            <span className="inline-flex items-center gap-0.5 text-white/70">
              <MapPin className="w-2.5 h-2.5" />{item.city}
            </span>
          </>
        )}
      </span>
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
      <span className="text-white/20 mx-2">|</span>
    </span>
  );
};

const LiveTickerStrip = () => {
  const [items, setItems] = useState([]);
  const [hidden, setHidden] = useState(false);
  const [paused, setPaused] = useState(false);

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

  if (hidden || items.length === 0) return null;

  // Calculate animation duration proportional to content length (readable pace ~50px/s)
  const totalItems = items.length;
  const durationSec = Math.max(30, totalItems * 6);

  return (
    <div
      data-testid="live-ticker-strip"
      className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
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

            {/* Marquee: horizontal scroll, right → left */}
            <div
              className="relative flex-1 overflow-hidden"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              onTouchStart={() => setPaused(true)}
              onTouchEnd={() => setPaused(false)}
            >
              <div
                className="inline-flex items-center whitespace-nowrap animate-marquee"
                style={{
                  animationDuration: `${durationSec}s`,
                  animationPlayState: paused ? 'paused' : 'running',
                }}
              >
                {/* Duplicate items for seamless loop */}
                {items.map((it, idx) => <LiveTickerItem key={`a-${idx}`} item={it} />)}
                {items.map((it, idx) => <LiveTickerItem key={`b-${idx}`} item={it} />)}
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
        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation-name: marquee-scroll;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  );
};

export default LiveTickerStrip;
