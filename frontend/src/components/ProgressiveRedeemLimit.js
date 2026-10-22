// Shared progressive Redeem Limit (Recharge + Bills + Bank Redeem) from /redemption-limit/status
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Zap } from 'lucide-react';
import { API } from '../lib/api';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const Row = ({ label, value, testId, valueColor, strong }) => (
  <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: strong ? 'rgba(45, 212, 160, 0.10)' : '#FFFFFF', border: '1px solid var(--pr-line)' }}>
    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: strong ? 'var(--pr-green)' : 'var(--paras-text-mute)' }}>{label}</span>
    <span data-testid={testId} className={`${strong ? 'text-base' : 'text-sm'} font-extrabold tabular-nums`} style={{ color: valueColor }}>{value}</span>
  </div>
);

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
  }, [userId, onLimitCheck]);

  if (loading) {
    return (
      <div data-testid="progressive-redeem-limit-loading" className="rounded-2xl p-4 animate-pulse" style={{ background: 'var(--pr-surface)', border: '1px solid var(--pr-line)' }}>
        <div className="h-4 rounded w-1/2 mb-3" style={{ background: 'var(--pr-surface-2)' }}></div>
        <div className="h-8 rounded w-full" style={{ background: 'var(--pr-surface-2)' }}></div>
      </div>
    );
  }

  if (!data || !data.cycle_start_iso) return null;

  const cap = Number(data.cumulative_cap || 0);
  const used = Number(data.used_prc || 0);
  const daysRemaining = Number(data.days_remaining || 0);
  const rate = Number(data.prc_rate) || 10;
  const both = (prc) => `${fmt(prc)} PRC (₹${fmt(prc / rate)})`;
  const progressPct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;

  return (
    <div
      data-testid="progressive-redeem-limit"
      className="rounded-2xl p-5"
      style={{ background: 'linear-gradient(145deg, #1A1530 0%, #17171E 60%)', border: '1px solid var(--pr-line)', boxShadow: 'var(--paras-shadow-card)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--pr-green)' }}>
          <Zap className="h-4 w-4" style={{ color: '#CA8A04' }} />
          Redeem Limit
        </h3>
        <span data-testid="progressive-rate-badge" className="px-2.5 py-1 rounded-full text-xs font-extrabold tabular-nums" style={{ background: 'rgba(245, 196, 81, 0.15)', color: 'var(--pr-gold)', border: '1px solid rgba(245, 196, 81, 0.4)' }}>
          {rate} PRC = ₹1
        </span>
      </div>

      <p className="text-[11px] mb-3 leading-snug" style={{ color: 'var(--paras-text-mute)' }}>
        One shared limit for Recharge, Bill Payments &amp; Redeem to Bank
      </p>

      <div className="mb-4">
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--pr-surface-2)' }}>
          <div
            data-testid="progressive-progress-bar"
            className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #22C55E, #38BDF8)' }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[10px] font-medium" style={{ color: 'var(--paras-text-mute)' }}>
          <span>0 PRC</span>
          <span>Cycle resets in {daysRemaining} day{daysRemaining === 1 ? '' : 's'}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Row label="Total Limit" value={both(cap)} testId="progressive-total-limit" valueColor="#14532D" />
        <Row label="Used" value={`${used > 0 ? '- ' : ''}${both(used)}`} testId="progressive-used" valueColor="#DC2626" />
        <Row label="Remaining" value={both(data.available_prc)} testId="progressive-remaining" valueColor="#15803D" strong />
      </div>
    </div>
  );
};

export default ProgressiveRedeemLimit;
export { ProgressiveRedeemLimit };
