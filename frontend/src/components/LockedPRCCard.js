/**
 * LockedPRCCard — shows the user's 25k PRC lock-in vault status on Dashboard.
 *
 * Behaviour:
 *  • If user has 0 locked PRC → renders nothing (returns null).
 *  • If user has locked PRC → shows amber gradient card with:
 *      - "🔐 PRC LOCKED VAULT"
 *      - Locked amount (big number)
 *      - Days remaining + unlock date
 *      - Available PRC for spend
 *      - Linear progress bar (% unlocked so far if admin partial-unlocked)
 *
 * Polls /api/prc-lock/status/{uid} once on mount.
 *
 * Jun 9, 2026 — Owner: Paras Reward
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Lock, Unlock, Calendar } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LockedPRCCard = ({ uid }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!uid) return;
        const res = await axios.get(`${API}/prc-lock/status/${uid}`, { timeout: 8000 });
        if (mounted) setData(res.data);
      } catch (_) {
        // silent — card just won't show
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [uid]);

  if (loading || !data || !data.is_locked) return null;

  const lockedNum = Math.round(data.prc_locked || 0);
  const lockedInitial = Math.round(data.prc_locked_initial || lockedNum);
  const availableNum = Math.round(data.available_prc || 0);
  const daysRemaining = data.days_remaining ?? 0;
  const unlockDate = (data.unlock_at || '').slice(0, 10);

  // Progress bar — fraction unlocked so far (0–100)
  const unlockedSoFar = Math.max(0, lockedInitial - lockedNum);
  const progressPct = lockedInitial > 0
    ? Math.min(100, Math.round((unlockedSoFar / lockedInitial) * 100))
    : 0;

  return (
    <div
      data-testid="locked-prc-card"
      className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-900/40 via-orange-900/30 to-yellow-900/20 p-4 shadow-lg"
    >
      {/* subtle pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
           style={{
             backgroundImage: 'radial-gradient(circle at 20% 30%, #fbbf24 1px, transparent 1px), radial-gradient(circle at 80% 70%, #f59e0b 1px, transparent 1px)',
             backgroundSize: '24px 24px'
           }} />

      <div className="relative flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/40">
            <Lock className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-amber-200/80 font-semibold">
              PRC Locked Vault
            </p>
            <p className="text-[10px] text-amber-300/60">
              Auto-unlocks in {daysRemaining} day{daysRemaining === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-200">
          365-day Lock
        </span>
      </div>

      <div className="relative">
        <p className="text-3xl sm:text-4xl font-bold text-amber-100 tabular-nums leading-tight"
           data-testid="locked-prc-amount">
          {lockedNum.toLocaleString('en-IN')}
        </p>
        <p className="text-xs text-amber-300/70 -mt-0.5">PRC Locked</p>
      </div>

      {/* Progress bar (only if anything has been released) */}
      {progressPct > 0 && (
        <div className="relative mt-3">
          <div className="flex items-center justify-between text-[10px] text-amber-200/70 mb-1">
            <span>Released so far</span>
            <span className="font-semibold">{progressPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-amber-950/40 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-amber-300 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      <div className="relative mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg bg-black/20 border border-amber-500/20 p-2">
          <div className="flex items-center gap-1 text-amber-300/60 mb-0.5">
            <Unlock className="w-3 h-3" />
            <span>Available now</span>
          </div>
          <p className="text-emerald-300 font-bold tabular-nums" data-testid="available-prc">
            {availableNum.toLocaleString('en-IN')} PRC
          </p>
        </div>
        <div className="rounded-lg bg-black/20 border border-amber-500/20 p-2">
          <div className="flex items-center gap-1 text-amber-300/60 mb-0.5">
            <Calendar className="w-3 h-3" />
            <span>Unlock date</span>
          </div>
          <p className="text-amber-100 font-semibold">
            {unlockDate || '—'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LockedPRCCard;
