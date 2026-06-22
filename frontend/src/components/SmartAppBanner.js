/**
 * SmartAppBanner — Floating "Get the App" sticky banner for Android web visitors.
 *
 * Shows ONLY when ALL of these are true:
 *   1. NOT running inside the Capacitor native app
 *   2. User-agent indicates Android phone (mobile web)
 *   3. User hasn't dismissed this banner in the last 7 days
 *
 * Position: fixed bottom, above mobile nav (z-index 60). Slides up on mount.
 */
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { X, Smartphone } from 'lucide-react';
import { PLAY_STORE_URL } from './AppDownloadBadge';

const DISMISS_KEY = 'paras_smart_banner_dismissed_until';

export const SmartAppBanner = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const ua = (navigator.userAgent || '').toLowerCase();
    const isAndroid = /android/.test(ua) && /mobile/.test(ua);
    if (!isAndroid) return;

    const dismissUntil = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
    if (Date.now() < dismissUntil) return;

    // Small delay so the banner doesn't feel intrusive on first paint.
    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const handleOpen = (e) => {
    e.preventDefault();
    window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer');
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    localStorage.setItem(
      DISMISS_KEY,
      String(Date.now() + 7 * 24 * 60 * 60 * 1000)
    );
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed left-3 right-3 bottom-20 sm:bottom-6 z-[60] animate-in slide-in-from-bottom-5 fade-in duration-300"
      data-testid="smart-app-banner"
    >
      <div className="mx-auto max-w-md bg-gradient-to-r from-blue-700 to-purple-700 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 border border-white/10">
        <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur grid place-items-center flex-shrink-0">
          <Smartphone className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold leading-tight">Get the Paras Reward app</div>
          <div className="text-[11px] text-blue-100/90 leading-tight mt-0.5">
            Faster &amp; better experience on Android
          </div>
        </div>
        <button
          onClick={handleOpen}
          className="bg-white text-blue-700 font-extrabold text-xs px-3.5 py-2 rounded-lg hover:bg-blue-50 transition-colors flex-shrink-0"
          data-testid="smart-app-banner-install-btn"
        >
          INSTALL
        </button>
        <button
          onClick={handleDismiss}
          className="text-white/70 hover:text-white p-1 flex-shrink-0"
          aria-label="Dismiss"
          data-testid="smart-app-banner-dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default SmartAppBanner;
