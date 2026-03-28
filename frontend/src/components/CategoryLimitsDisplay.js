/**
 * UnifiedRedeemLimit - Clear redeem limit display
 * Shows: Redeem Limit → Used → Balance (remaining to redeem)
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Lock, Unlock } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const UnifiedRedeemLimit = ({ userId, onLimitCheck }) => {
  const [limitData, setLimitData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const fetchLimit = async () => {
      try {
        const res = await axios.get(`${API}/user/${userId}/redeem-limit`);
        if (res.data?.success) {
          setLimitData(res.data.limit);
          if (onLimitCheck) {
            const available = res.data.limit.effective_available || 0;
            onLimitCheck({ allowed: available > 0, available });
          }
        }
      } catch (err) {
        console.error('Error fetching redeem limit:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLimit();
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-1/2 mb-3"></div>
        <div className="h-8 bg-zinc-800 rounded w-full"></div>
      </div>
    );
  }

  if (!limitData) return null;

  const unlockPercent = limitData.redeem_limit_percent || limitData.unlock_percent || 0;
  const redeemLimit = limitData.redeemable || 0;
  const totalUsed = limitData.total_redeemed || 0;
  const redeemBalance = limitData.effective_available || Math.max(0, redeemLimit - totalUsed);

  const progressWidth = Math.min(100, (unlockPercent / 94.5) * 100);

  return (
    <div data-testid="unified-redeem-limit" className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-5 border border-zinc-700/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          {unlockPercent > 0 ? <Unlock className="h-4 w-4 text-emerald-400" /> : <Lock className="h-4 w-4 text-amber-400" />}
          Redeem Limit
        </h3>
        <span data-testid="unlock-percent-badge" className={`px-2.5 py-1 rounded-full text-xs font-bold ${
          unlockPercent >= 60 ? 'bg-emerald-500/20 text-emerald-400' :
          unlockPercent >= 30 ? 'bg-blue-500/20 text-blue-400' :
          unlockPercent > 0 ? 'bg-amber-500/20 text-amber-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {unlockPercent}% Unlocked
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
          <div
            data-testid="unlock-progress-bar"
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-emerald-500 to-cyan-500 transition-all duration-700"
            style={{ width: `${progressWidth}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-zinc-600">0%</span>
          <span className="text-[9px] text-zinc-600">94.5% max</span>
        </div>
      </div>

      {/* Clear 3-row breakdown: Limit → Used → Balance */}
      <div className="space-y-2">
        {/* Row 1: Redeem Limit */}
        <div className="flex items-center justify-between bg-zinc-800/60 rounded-xl p-3">
          <span className="text-zinc-400 text-xs font-medium">Redeem Limit</span>
          <span data-testid="redeem-limit-value" className="text-blue-400 text-sm font-bold tabular-nums">{redeemLimit.toLocaleString()} PRC</span>
        </div>

        {/* Row 2: Used */}
        <div className="flex items-center justify-between bg-zinc-800/60 rounded-xl p-3">
          <span className="text-zinc-400 text-xs font-medium">Used</span>
          <span data-testid="total-used" className="text-orange-400 text-sm font-bold tabular-nums">- {totalUsed.toLocaleString()} PRC</span>
        </div>

        {/* Row 3: Redeem Balance (what user can actually redeem) */}
        <div className="flex items-center justify-between bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
          <span className="text-emerald-400 text-xs font-semibold">Redeem Balance</span>
          <span data-testid="redeem-balance" className="text-emerald-400 text-base font-bold tabular-nums">{redeemBalance.toLocaleString()} PRC</span>
        </div>
      </div>
    </div>
  );
};

const CategoryLimitsDisplay = UnifiedRedeemLimit;
export const CategoryLimitBadge = () => null;
export default CategoryLimitsDisplay;
