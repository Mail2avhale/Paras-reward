import React, { useState, useEffect, useRef } from 'react';
import { Flame, AlertTriangle, Crown } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL;

const BurningIndicator = ({ user, variant = 'compact' }) => {
  const [burnData, setBurnData] = useState(null);
  const [liveBurned, setLiveBurned] = useState(0);
  const timerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.uid) return;
    fetchBurnStatus();
    const interval = setInterval(fetchBurnStatus, 30000);
    return () => clearInterval(interval);
  }, [user?.uid]);

  useEffect(() => {
    if (!burnData?.burning_active || burnData.per_second_rate <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    setLiveBurned(0);
    timerRef.current = setInterval(() => {
      setLiveBurned(prev => prev + burnData.per_second_rate);
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [burnData]);

  const fetchBurnStatus = async () => {
    try {
      const res = await axios.get(`${API}/api/burning/status/${user.uid}`);
      setBurnData(res.data);
    } catch { }
  };

  if (!burnData?.burning_active) return null;

  const currentBalance = Math.max(0, (burnData.balance || 0) - liveBurned);
  const dailyBurn = burnData.daily_burn_rate || 0;

  // Compact variant (Dashboard card)
  if (variant === 'compact') {
    return (
      <div data-testid="burning-indicator-compact" className="bg-gradient-to-r from-red-950/80 to-orange-950/60 rounded-2xl p-4 border border-red-500/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(239,68,68,0.12),transparent_60%)]" />
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                <Flame className="w-5 h-5 text-red-400 animate-pulse" />
              </div>
              <div>
                <p className="text-red-300 text-xs font-semibold">PRC Burning Active</p>
                <p className="text-red-400/60 text-[10px]">No active subscription</p>
              </div>
            </div>
            <span className="text-red-400 font-bold text-lg">-{dailyBurn.toFixed(1)}/day</span>
          </div>

          <div className="flex items-center justify-between text-xs mt-2">
            <span className="text-zinc-400">Burning now</span>
            <span className="text-red-400 font-mono">-{liveBurned.toFixed(4)} PRC</span>
          </div>

          <button
            onClick={() => navigate('/subscription')}
            data-testid="burning-renew-btn"
            className="mt-3 w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:from-amber-400 hover:to-orange-400 transition-all"
          >
            <Crown className="w-3.5 h-3.5" /> Renew Elite to Stop Burning
          </button>
        </div>
      </div>
    );
  }

  // Full variant (Mining page)
  return (
    <div data-testid="burning-indicator-full" className="bg-gradient-to-br from-red-950/90 to-orange-950/60 rounded-2xl p-5 border border-red-500/30 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(239,68,68,0.15),transparent_60%)]" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <Flame className="w-6 h-6 text-red-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-red-300 font-bold text-sm">PRC Auto-Burning Active</h3>
            <p className="text-red-400/60 text-xs">Your PRC is burning at {burnData.daily_burn_percent}% per day</p>
          </div>
        </div>

        <div className="bg-black/30 rounded-xl p-3 space-y-2 mb-3">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Current Balance</span>
            <span className="text-white font-bold">{currentBalance.toFixed(2)} PRC</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Daily Burn Rate</span>
            <span className="text-red-400 font-bold">-{dailyBurn.toFixed(2)} PRC/day</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Burning Now</span>
            <span className="text-red-400 font-mono animate-pulse">-{liveBurned.toFixed(6)} PRC</span>
          </div>
        </div>

        <div className="flex items-start gap-2 bg-amber-500/10 rounded-xl p-3 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-200/80 text-xs leading-relaxed">
            Your subscription has expired. Your PRC balance is decreasing every second. 
            Renew Elite subscription to stop burning and start earning!
          </p>
        </div>

        <button
          onClick={() => navigate('/subscription')}
          data-testid="burning-renew-btn"
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
        >
          <Crown className="w-4 h-4" /> Renew Elite Subscription
        </button>
      </div>
    </div>
  );
};

export default BurningIndicator;
