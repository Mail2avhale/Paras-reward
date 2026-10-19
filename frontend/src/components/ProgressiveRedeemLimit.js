/**
 * ProgressiveRedeemLimit
 * ─────────────────────────────────────────────────────────────────
 * Shows the shared daily Redeem Limit for Recharge + Bank Redeem.
 *
 * Backend formula (see /app/backend/app/services/redemption_limit_service.py):
 *   day_cap(N)    = 10 × N
 *   cumulative(N) = 5 × N × (N + 1)      PRC unlocked by day N
 *   cycle length  = 365 days (auto-rolls over)
 *
 * The same `used_prc` counter is incremented by BOTH flows (recharge
 * utility + bank redeem), so the number shown here is the *single*
 * shared ceiling for the user — exactly matching the business rule
 * ("Recharge + Redeem to Bank दोन्हीसाठी एकच limit").
 */

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Zap } from 'lucide-react';
import { API } from '../lib/api';

const ProgressiveRedeemLimit = ({ userId, onLimitCheck }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        const res = await axios.get(`${API}/redemption-limit/status/${userId}`);
        if (!alive) return;
        setData(res.data);
        if (onLimitCheck) {
          const available = Number(res.data?.available_prc || 0);
          onLimitCheck({ allowed: available > 0, available });
        }
      } catch (err) {
        console.error('[ProgressiveRedeemLimit] fetch failed:', err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  if (loading) {
    return (
      <div
        data-testid="progressive-redeem-limit-loading"
        className="rounded-2xl p-4 animate-pulse"
        style={{ background: 'linear-gradient(145deg, #2e1065, #4c1d95)' }}
      >
        <div className="h-4 bg-white/10 rounded w-1/2 mb-3"></div>
        <div className="h-8 bg-white/10 rounded w-full"></div>
      </div>
    );
  }

  if (!data || !data.cycle_start_iso) return null;

  const cap = Number(data.cumulative_cap || 0);
  const used = Number(data.used_prc || 0);
  const available = Number(data.available_prc || 0);
  const dayNumber = Number(data.day_number || 0);
  const daysRemaining = Number(data.days_remaining || 0);
  const progressPct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;

  const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  return (
    <div
      data-testid="progressive-redeem-limit"
      className="rounded-2xl p-5 border border-purple-500/30"
      style={{
        background: 'linear-gradient(145deg, #2e1065 0%, #4c1d95 40%, #5b21b6 70%, #1e1b4b 100%)',
        boxShadow: '0 10px 30px -8px rgba(139, 92, 246, 0.3)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white/90 flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-300" />
          Redeem Limit
        </h3>
        <span
          data-testid="progressive-day-badge"
          className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-yellow-400/20 text-yellow-300 border border-yellow-400/30"
        >
          Day {dayNumber}
        </span>
      </div>

      {/* Shared-limit note */}
      <p className="text-[11px] text-white/60 mb-3 leading-snug">
        Shared across Recharge, Bill Payments &amp; Redeem to Bank
      </p>

      {/* Progress bar: used / cap */}
      <div className="mb-4">
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            data-testid="progressive-progress-bar"
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #fbbf24, #a78bfa, #38bdf8)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-white/40 font-medium">0 PRC</span>
          <span className="text-[9px] text-white/40 font-medium">
            Cycle resets in {daysRemaining} day{daysRemaining === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* 3-row breakdown */}
      <div className="space-y-2">
        <div className="flex items-center justify-between bg-white/8 rounded-xl p-3">
          <span className="text-white/60 text-xs font-bold uppercase tracking-wider">Total Limit</span>
          <span
            data-testid="progressive-total-limit"
            className="text-white text-sm font-extrabold tabular-nums"
          >
            {fmt(cap)} PRC
          </span>
        </div>

        <div className="flex items-center justify-between bg-white/8 rounded-xl p-3">
          <span className="text-white/60 text-xs font-bold uppercase tracking-wider">Used</span>
          <span
            data-testid="progressive-used"
            className="text-red-300 text-sm font-extrabold tabular-nums"
          >
            {used > 0 ? '- ' : ''}{fmt(used)} PRC
          </span>
        </div>

        <div className="border-t border-white/20"></div>

        <div className="flex items-center justify-between bg-white/8 rounded-xl p-3">
          <span className="text-white text-xs font-extrabold uppercase tracking-wider">Remaining</span>
          <span
            data-testid="progressive-remaining"
            className="text-yellow-300 text-base font-extrabold tabular-nums"
          >
            {fmt(available)} PRC
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProgressiveRedeemLimit;
export { ProgressiveRedeemLimit };
