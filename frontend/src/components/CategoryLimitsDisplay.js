/**
 * UnifiedRedeemLimit - Clear redeem limit display
 * Shows: Redeem Limit → Used → Balance (remaining to redeem)
 * Ultra Violet theme with bold contrast
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
      <div className="rounded-2xl p-4 animate-pulse" style={{ background: 'linear-gradient(145deg, #2e1065, #4c1d95)' }}>
        <div className="h-4 bg-white/10 rounded w-1/2 mb-3"></div>
        <div className="h-8 bg-white/10 rounded w-full"></div>
      </div>
    );
  }

  if (!limitData) return null;

  const unlockPercent = limitData.redeem_limit_percent || limitData.unlock_percent || 0;
  const redeemLimit = limitData.redeemable || 0;
  const totalUsed = limitData.total_redeemed || 0;
  const redeemBalance = limitData.effective_available || Math.max(0, redeemLimit - totalUsed);
  const isNegative = redeemBalance < 0;

  const progressWidth = Math.min(100, (unlockPercent / 94.5) * 100);

  return (
    <div
      data-testid="unified-redeem-limit"
      className="rounded-2xl p-5 border border-purple-500/30"
      style={{
        background: 'linear-gradient(145deg, #2e1065 0%, #4c1d95 40%, #5b21b6 70%, #1e1b4b 100%)',
        boxShadow: '0 10px 30px -8px rgba(139, 92, 246, 0.3)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white/90 flex items-center gap-2">
          {unlockPercent > 0 ? <Unlock className="h-4 w-4 text-yellow-300" /> : <Lock className="h-4 w-4 text-yellow-300" />}
          Redeem Limit
        </h3>
        <span data-testid="unlock-percent-badge" className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
          {unlockPercent}% Unlocked
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            data-testid="unlock-progress-bar"
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progressWidth}%`,
              background: 'linear-gradient(90deg, #fbbf24, #a78bfa, #38bdf8)'
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-white/30 font-medium">0%</span>
          <span className="text-[9px] text-white/30 font-medium">94.5% max</span>
        </div>
      </div>

      {/* 3-row breakdown: Limit → Used → Balance */}
      <div className="space-y-2">
        {/* Row 1: Redeem Limit */}
        <div className="flex items-center justify-between bg-white/8 rounded-xl p-3">
          <span className="text-white/60 text-xs font-bold uppercase tracking-wider">Total Limit</span>
          <span data-testid="redeem-limit-value" className="text-white text-sm font-extrabold tabular-nums">{redeemLimit.toLocaleString()} PRC</span>
        </div>

        {/* Row 2: Used */}
        <div className="flex items-center justify-between bg-white/8 rounded-xl p-3">
          <span className="text-white/60 text-xs font-bold uppercase tracking-wider">Used</span>
          <span data-testid="total-used" className="text-red-300 text-sm font-extrabold tabular-nums">- {totalUsed.toLocaleString()} PRC</span>
        </div>

        {/* Divider */}
        <div className="border-t border-white/20"></div>

        {/* Row 3: Remaining Balance */}
        <div className="flex items-center justify-between bg-white/8 rounded-xl p-3">
          <span className="text-white text-xs font-extrabold uppercase tracking-wider">Remaining</span>
          <span data-testid="redeem-balance" className={`text-base font-extrabold tabular-nums ${isNegative ? 'text-red-300' : 'text-yellow-300'}`}>
            {isNegative ? '-' : ''}{Math.abs(redeemBalance).toLocaleString()} PRC
          </span>
        </div>
      </div>
    </div>
  );
};

const CategoryLimitsDisplay = UnifiedRedeemLimit;
export const CategoryLimitBadge = () => null;
export default CategoryLimitsDisplay;
