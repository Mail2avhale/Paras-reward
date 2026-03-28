/**
 * UnifiedRedeemLimit - Dynamic Growth Network based redeem limit display
 * Shows: Unlock%, Total Earned, Redeemable, Used, Available
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Lock, Unlock, TrendingUp, Users } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LEVEL_THRESHOLDS = [
  { size: 2, level: 1, percent: 10 },
  { size: 6, level: 2, percent: 20 },
  { size: 14, level: 3, percent: 30 },
  { size: 30, level: 4, percent: 40 },
  { size: 62, level: 5, percent: 50 },
  { size: 126, level: 6, percent: 60 },
  { size: 254, level: 7, percent: 70 },
  { size: 454, level: 8, percent: 80 },
  { size: 654, level: 9, percent: 90 },
  { size: 800, level: 10, percent: 100 },
];

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
            const available = res.data.limit.effective_available || res.data.limit.effective_remaining || 0;
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

  const unlockPercent = limitData.unlock_percent || 0;
  const networkSize = limitData.network_size || 0;
  const totalEarned = limitData.total_earned || 0;
  const redeemable = limitData.redeemable || 0;
  const totalRedeemed = limitData.total_redeemed || 0;
  const available = limitData.effective_available || limitData.available || 0;

  // Find next level threshold
  const nextLevel = LEVEL_THRESHOLDS.find(t => networkSize < t.size);
  const usersNeeded = nextLevel ? nextLevel.size - networkSize : 0;

  return (
    <div data-testid="unified-redeem-limit" className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-5 border border-zinc-700/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          {unlockPercent > 0 ? <Unlock className="h-4 w-4 text-emerald-400" /> : <Lock className="h-4 w-4 text-amber-400" />}
          Redeem Limit
        </h3>
        <span data-testid="unlock-percent-badge" className={`px-2.5 py-1 rounded-full text-xs font-bold ${
          unlockPercent >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
          unlockPercent >= 40 ? 'bg-blue-500/20 text-blue-400' :
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
            style={{ width: `${unlockPercent}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-zinc-800/60 rounded-xl p-3">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Total Earned</p>
          <p data-testid="total-earned" className="text-sm font-bold text-zinc-200 tabular-nums">{totalEarned.toLocaleString()} PRC</p>
        </div>
        <div className="bg-zinc-800/60 rounded-xl p-3">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Redeemable</p>
          <p data-testid="redeemable-prc" className="text-sm font-bold text-blue-400 tabular-nums">{redeemable.toLocaleString()} PRC</p>
        </div>
        <div className="bg-zinc-800/60 rounded-xl p-3">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Used</p>
          <p data-testid="total-used" className="text-sm font-bold text-orange-400 tabular-nums">{totalRedeemed.toLocaleString()} PRC</p>
        </div>
        <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
          <p className="text-[10px] text-emerald-500 uppercase tracking-wider">Available</p>
          <p data-testid="available-prc" className="text-sm font-bold text-emerald-400 tabular-nums">{available.toLocaleString()} PRC</p>
        </div>
      </div>

      {/* Network Info */}
      <div className="bg-zinc-800/40 rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-purple-400" />
          <span className="text-xs text-zinc-400">
            Growth Network: <span className="text-zinc-200 font-semibold">{networkSize}</span> members
          </span>
        </div>
        {nextLevel && (
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-cyan-400" />
            <span className="text-[10px] text-cyan-400">{usersNeeded} more for {nextLevel.percent}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Backward compatible export
const CategoryLimitsDisplay = UnifiedRedeemLimit;
export const CategoryLimitBadge = () => null;
export default CategoryLimitsDisplay;
