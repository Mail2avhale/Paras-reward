import React from 'react';
import { motion } from 'framer-motion';

/**
 * Redeem Tier Badge — gamified progression card for Bank Redeem.
 *
 * Tiers (May 2026):
 *   • Bronze   — min < ₹1,000      → next milestone: ₹1,000
 *   • Silver   — ₹1k ≤ min < ₹10k  → next milestone: ₹10,000
 *   • Gold     — ₹10k ≤ min < ₹50k → next milestone: ₹50,000
 *   • Diamond  — ₹50k ≤ min < ₹1L  → next milestone: ₹1,00,000
 *   • Platinum — min ≥ ₹1,00,000   → max tier
 *
 * Props:
 *   minimum (number)  — user's current progressive minimum withdrawal in INR
 *   nextPreview (number, optional) — projected next-min if the user redeems
 *                                     exactly at the current minimum
 */
const TIERS = [
  {
    key: 'bronze',
    name: 'Bronze',
    icon: '🥉',
    floor: 0,
    ceiling: 1000,
    gradient: 'from-orange-700 via-amber-700 to-yellow-800',
    border: 'border-amber-700/40',
    text: 'text-amber-200',
    sub: 'text-amber-300/70',
    track: 'bg-amber-900/40',
    bar: 'from-orange-500 to-amber-400',
  },
  {
    key: 'silver',
    name: 'Silver',
    icon: '🥈',
    floor: 1000,
    ceiling: 10000,
    gradient: 'from-slate-500 via-slate-400 to-zinc-500',
    border: 'border-slate-400/40',
    text: 'text-slate-100',
    sub: 'text-slate-200/80',
    track: 'bg-slate-800/40',
    bar: 'from-slate-300 to-zinc-200',
  },
  {
    key: 'gold',
    name: 'Gold',
    icon: '🥇',
    floor: 10000,
    ceiling: 50000,
    gradient: 'from-yellow-600 via-amber-500 to-yellow-700',
    border: 'border-yellow-500/50',
    text: 'text-yellow-100',
    sub: 'text-yellow-200/80',
    track: 'bg-yellow-900/40',
    bar: 'from-yellow-300 to-amber-400',
  },
  {
    key: 'diamond',
    name: 'Diamond',
    icon: '💎',
    floor: 50000,
    ceiling: 100000,
    gradient: 'from-cyan-500 via-sky-500 to-blue-600',
    border: 'border-cyan-400/50',
    text: 'text-cyan-50',
    sub: 'text-cyan-100/80',
    track: 'bg-cyan-900/40',
    bar: 'from-cyan-300 to-sky-400',
  },
  {
    key: 'platinum',
    name: 'Platinum',
    icon: '👑',
    floor: 100000,
    ceiling: Number.POSITIVE_INFINITY,
    gradient: 'from-fuchsia-600 via-purple-600 to-indigo-700',
    border: 'border-fuchsia-400/50',
    text: 'text-fuchsia-50',
    sub: 'text-fuchsia-100/80',
    track: 'bg-fuchsia-900/40',
    bar: 'from-fuchsia-300 to-purple-300',
  },
];

function getTier(minimum) {
  return TIERS.find((t) => minimum >= t.floor && minimum < t.ceiling) || TIERS[TIERS.length - 1];
}

function formatINR(n) {
  if (!isFinite(n)) return '∞';
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

export function RedeemTierBadge({ minimum, nextPreview }) {
  if (!Number.isFinite(Number(minimum))) return null;
  const min = Math.max(0, Number(minimum));
  const tier = getTier(min);
  const nextTier = TIERS[TIERS.indexOf(tier) + 1] || null;
  const isMax = !nextTier;

  // Progress inside current tier (0–100)
  const span = tier.ceiling - tier.floor;
  const within = Math.min(span, Math.max(0, min - tier.floor));
  const progressPct = isMax ? 100 : Math.round((within / span) * 100);

  return (
    <motion.div
      data-testid="redeem-tier-badge"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border ${tier.border}
                  bg-gradient-to-br ${tier.gradient} p-4 sm:p-5 shadow-lg`}
    >
      {/* Subtle shine sweep */}
      <div className="pointer-events-none absolute inset-y-0 -inset-x-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] animate-[shine_4s_linear_infinite]" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl sm:text-4xl drop-shadow-lg" aria-hidden="true">
            {tier.icon}
          </div>
          <div>
            <p className={`text-xs uppercase tracking-wider ${tier.sub}`}>Your Redeem Tier</p>
            <p
              className={`text-lg sm:text-xl font-extrabold ${tier.text}`}
              data-testid="redeem-tier-name"
            >
              {tier.name}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-[10px] uppercase tracking-wider ${tier.sub}`}>Minimum</p>
          <p
            className={`text-base sm:text-lg font-bold ${tier.text} font-mono`}
            data-testid="redeem-tier-minimum"
          >
            {formatINR(min)}
          </p>
        </div>
      </div>

      {/* Progress to next tier */}
      <div className="relative mt-3.5">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className={tier.sub}>
            {isMax ? 'Top tier reached!' : `Next: ${nextTier.icon} ${nextTier.name}`}
          </span>
          <span className={`font-mono ${tier.text}`}>
            {isMax ? 'MAX' : `${progressPct}%`}
          </span>
        </div>
        <div className={`h-2 rounded-full overflow-hidden ${tier.track}`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full bg-gradient-to-r ${tier.bar}`}
            data-testid="redeem-tier-progress"
          />
        </div>
        {!isMax && (
          <p className={`text-[11px] mt-1.5 ${tier.sub}`}>
            Reach {formatINR(nextTier.floor)} minimum to unlock {nextTier.name}.
          </p>
        )}
      </div>

      {/* Hint */}
      {Number.isFinite(nextPreview) && nextPreview > min && (
        <p
          className={`relative text-[11px] mt-2 ${tier.sub}`}
          data-testid="redeem-tier-next-preview"
        >
          Redeeming at minimum will lift your floor to{' '}
          <span className={`${tier.text} font-semibold`}>{formatINR(nextPreview)}</span> next time.
        </p>
      )}

      <style>{`
        @keyframes shine {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </motion.div>
  );
}

export default RedeemTierBadge;
