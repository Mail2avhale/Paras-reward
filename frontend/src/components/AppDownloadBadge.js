/**
 * AppDownloadBadge — "Get it on Google Play" pill button.
 *
 * Variants:
 *   - "default" : large hero/CTA-friendly badge
 *   - "compact" : footer-friendly smaller pill
 *   - "icon"    : icon-only (mobile nav, etc.)
 *
 * Hides itself when running inside the Capacitor native app (the user is
 * already on the installed app, no need to show "download" CTA).
 */
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.parasreward.prc';

// Inline Google Play "play" triangle as SVG (no network dependency).
const PlayGlyph = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="pg1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00C2FF" />
        <stop offset="100%" stopColor="#0066FF" />
      </linearGradient>
      <linearGradient id="pg2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFB300" />
        <stop offset="100%" stopColor="#FF6F00" />
      </linearGradient>
      <linearGradient id="pg3" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FF3D00" />
        <stop offset="100%" stopColor="#D50000" />
      </linearGradient>
      <linearGradient id="pg4" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00E676" />
        <stop offset="100%" stopColor="#00C853" />
      </linearGradient>
    </defs>
    <path d="M3.5 2.2L13.4 12 3.5 21.8c-.3-.3-.5-.7-.5-1.2V3.4c0-.5.2-.9.5-1.2z" fill="url(#pg1)" />
    <path d="M17.5 7.9L14.4 11l-.3.3.3.3 3.1 3.1 4.2-2.4c1.1-.6 1.1-2.2 0-2.8l-4.2-2.6z" fill="url(#pg2)" />
    <path d="M3.5 2.2c.3-.3.8-.4 1.3-.1L17.5 7.9 14.1 11.3 3.5 2.2z" fill="url(#pg4)" />
    <path d="M14.1 11.7l3.4 3.4-12.7 6.8c-.5.3-1 .2-1.3-.1l10.6-10.1z" fill="url(#pg3)" />
  </svg>
);

const handleClick = async (e) => {
  e.preventDefault();
  try {
    const { Browser } = await import('@capacitor/browser').catch(() => ({ Browser: null }));
    if (Browser && Capacitor.isNativePlatform()) {
      await Browser.open({ url: PLAY_STORE_URL });
      return;
    }
  } catch (err) {
    // fall through to window.open
  }
  window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer');
};

export const AppDownloadBadge = ({ variant = 'default', className = '' }) => {
  // Hide inside the Capacitor native app — user is already in the app.
  const [hide, setHide] = useState(false);
  useEffect(() => {
    if (Capacitor.isNativePlatform()) setHide(true);
  }, []);
  if (hide) return null;

  if (variant === 'icon') {
    return (
      <a
        href={PLAY_STORE_URL}
        onClick={handleClick}
        aria-label="Get the Paras Reward app on Google Play"
        data-testid="app-download-badge-icon"
        className={`inline-flex items-center justify-center w-11 h-11 rounded-xl bg-black hover:bg-gray-900 transition-colors ${className}`}
      >
        <PlayGlyph className="w-5 h-5" />
      </a>
    );
  }

  if (variant === 'compact') {
    return (
      <a
        href={PLAY_STORE_URL}
        onClick={handleClick}
        data-testid="app-download-badge-compact"
        className={`inline-flex items-center gap-2.5 bg-black hover:bg-gray-900 text-white px-4 py-2.5 rounded-xl transition-all border border-gray-700 hover:border-gray-500 ${className}`}
      >
        <PlayGlyph className="w-6 h-6" />
        <div className="text-left leading-tight">
          <div className="text-[9px] uppercase tracking-wider text-gray-300">Get it on</div>
          <div className="text-sm font-semibold">Google Play</div>
        </div>
      </a>
    );
  }

  // Default (hero CTA)
  return (
    <a
      href={PLAY_STORE_URL}
      onClick={handleClick}
      data-testid="app-download-badge"
      className={`inline-flex items-center gap-3 bg-black hover:bg-gray-900 text-white px-5 py-3 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 border border-white/10 ${className}`}
    >
      <PlayGlyph className="w-8 h-8" />
      <div className="text-left leading-tight">
        <div className="text-[10px] uppercase tracking-widest text-gray-300">Get it on</div>
        <div className="text-lg font-bold">Google Play</div>
      </div>
    </a>
  );
};

export default AppDownloadBadge;
