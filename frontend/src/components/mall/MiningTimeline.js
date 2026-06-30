/**
 * MiningTimeline.js
 * --------------------------------------------------------------
 * Visual progress timeline for a Mall booking — the lifecycle:
 *
 *   Booked → Mining (NN%) → Fulfilled → Shipped → Delivered
 *
 * Each stage shows as a connected node on a horizontal track. The
 * progress between Mining and Fulfilled is animated based on
 * `paid_prc / total_prc` so the user gets a live "we're X% there"
 * read at a glance — same energy as Amazon's order-tracker tile.
 *
 * Props:
 *   booking: required mall booking dict from /api/mall/my-bookings.
 *            Reads: status, paid_prc, total_prc, daily_rate_prc.
 *   compact: if true, render in a slimmer single-line variant.
 */
import React from 'react';
import { Check, Package, Truck, Sparkles, Pickaxe, Home } from 'lucide-react';

const STAGES = [
  { key: 'booked',     label: 'Booked',     icon: Sparkles },
  { key: 'mining',     label: 'Mining',     icon: Pickaxe },
  { key: 'fulfilled',  label: 'Fulfilled',  icon: Package },
  { key: 'shipped',    label: 'Shipped',    icon: Truck },
  { key: 'delivered',  label: 'Delivered',  icon: Home },
];

function getActiveIndex(status) {
  switch ((status || '').toLowerCase()) {
    case 'mining':     return 1;
    case 'fulfilled':  return 2;
    case 'shipped':    return 3;
    case 'delivered':  return 4;
    case 'cancelled':  return -1;
    default:           return 0; // freshly booked
  }
}

export default function MiningTimeline({ booking, compact = false }) {
  if (!booking) return null;
  const status = booking.status;
  const activeIdx = getActiveIndex(status);
  const total = Number(booking.total_prc || 1);
  const paid  = Math.min(Number(booking.paid_prc || 0), total);
  const pct   = total > 0 ? Math.round((paid / total) * 100) : 0;
  const cancelled = status === 'cancelled';

  return (
    <div
      data-testid="mining-timeline"
      style={{
        padding: compact ? '10px 4px' : '14px 6px 18px',
        borderRadius: 14,
      }}
    >
      <div style={{ display: 'flex', position: 'relative', alignItems: 'flex-start' }}>
        {/* Track */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: compact ? 14 : 16,
            left: '8%',
            right: '8%',
            height: 3,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 999,
            zIndex: 0,
          }}
        />
        {/* Filled progress (proportional to overall journey) */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: compact ? 14 : 16,
            left: '8%',
            height: 3,
            width: cancelled ? '0%' : `${Math.max(0, (activeIdx / (STAGES.length - 1)) * 84)}%`,
            background: cancelled
              ? '#b91c1c'
              : 'linear-gradient(90deg, #facc15 0%, #f97316 50%, #10b981 100%)',
            borderRadius: 999,
            transition: 'width 600ms ease-out',
            zIndex: 0,
          }}
        />

        {STAGES.map((s, i) => {
          const reached = !cancelled && i <= activeIdx;
          const isCurrent = !cancelled && i === activeIdx;
          const Icon = s.icon;
          return (
            <div
              key={s.key}
              data-testid={`timeline-node-${s.key}`}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div
                style={{
                  width: compact ? 28 : 34,
                  height: compact ? 28 : 34,
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: reached
                    ? (isCurrent ? 'linear-gradient(135deg, #facc15, #f97316)' : 'linear-gradient(135deg, #10b981, #059669)')
                    : 'rgba(255,255,255,0.06)',
                  border: reached
                    ? '2px solid rgba(255,255,255,0.45)'
                    : '2px solid rgba(255,255,255,0.10)',
                  boxShadow: isCurrent ? '0 0 16px rgba(250,204,21,0.55)' : 'none',
                  transition: 'all 400ms ease',
                }}
              >
                {reached && !isCurrent ? (
                  <Check size={compact ? 14 : 18} color="#fff" strokeWidth={3} />
                ) : (
                  <Icon size={compact ? 13 : 16} color={reached ? '#fff' : 'rgba(255,255,255,0.45)'} strokeWidth={2.2} />
                )}
              </div>
              {!compact && (
                <span
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    color: reached ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)',
                    fontWeight: reached ? 700 : 500,
                    textAlign: 'center',
                    lineHeight: 1.2,
                  }}
                >
                  {s.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Inline mining % readout below timeline — only while mining */}
      {status === 'mining' && !compact && (
        <div
          data-testid="timeline-mining-pct"
          style={{
            marginTop: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            color: 'rgba(255,255,255,0.65)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>
            <strong style={{ color: '#facc15' }}>{pct}%</strong> mined
            {booking.daily_rate_prc ? (
              <span style={{ opacity: 0.6 }}> · {Math.round(booking.daily_rate_prc).toLocaleString('en-IN')} PRC/day</span>
            ) : null}
          </span>
          <span style={{ opacity: 0.6 }}>
            {Math.round(paid).toLocaleString('en-IN')} / {Math.round(total).toLocaleString('en-IN')} PRC
          </span>
        </div>
      )}

      {cancelled && (
        <p data-testid="timeline-cancelled" style={{ marginTop: 8, fontSize: 11, color: '#fca5a5', textAlign: 'center' }}>
          Booking cancelled
        </p>
      )}
    </div>
  );
}
