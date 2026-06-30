/**
 * SkeletonCard.js
 * --------------------------------------------------------------
 * Shimmering skeleton placeholders for the Mall product grid and
 * the user's booking list. Used while data is fetching so we never
 * show "Loading…" text — matching the Amazon/Flipkart pattern.
 *
 * Two flavours:
 *   <SkeletonProductCard />  — single tall product tile (image + price tiles + CTA)
 *   <SkeletonBookingCard />  — single horizontal booking row (mining timeline)
 *
 * The shimmer keyframe lives in ParasMall.css (.mall-skel-shimmer) so the
 * existing dark/light theme tokens cascade automatically.
 */
import React from 'react';

const baseShimmer = {
  background:
    'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 100%)',
  backgroundSize: '200% 100%',
  animation: 'mallSkelShimmer 1.4s ease-in-out infinite',
  borderRadius: 12,
};

const block = (h, w = '100%', extra = {}) => ({ ...baseShimmer, height: h, width: w, ...extra });

export function SkeletonProductCard() {
  return (
    <div
      data-testid="skeleton-product-card"
      className="mall-skeleton-card"
      style={{
        padding: 16,
        borderRadius: 22,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={block(180)} />
      <div style={block(18, '70%')} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 }}>
        <div style={block(54)} />
        <div style={block(54)} />
      </div>
      <div style={block(48, '100%', { marginTop: 4 })} />
    </div>
  );
}

export function SkeletonBookingCard() {
  return (
    <div
      data-testid="skeleton-booking-card"
      style={{
        padding: 16,
        borderRadius: 18,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        marginBottom: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={block(56, 56, { borderRadius: 14 })} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={block(14, '60%')} />
          <div style={block(10, '40%')} />
        </div>
      </div>
      <div style={block(8, '100%', { borderRadius: 999 })} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={block(12, '30%')} />
        <div style={block(12, '20%')} />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 4, variant = 'product' }) {
  const Item = variant === 'booking' ? SkeletonBookingCard : SkeletonProductCard;
  return (
    <div
      data-testid="skeleton-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: variant === 'booking' ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 14,
        padding: variant === 'booking' ? '0 16px' : '0 12px',
      }}
    >
      {Array.from({ length: count }).map((_, i) => <Item key={i} />)}
    </div>
  );
}

export default SkeletonGrid;
