import React, { useEffect, useState } from 'react';

/*
 * MobileAppGate
 * -------------
 * Forces every mobile-web visitor to install the Paras Reward Android
 * app. The gate only renders when ALL of the following are true:
 *   1. The page is running inside a regular mobile browser (NOT inside
 *      the Capacitor-wrapped native APK). We detect this via
 *      `window.Capacitor?.isNativePlatform()` and the presence of the
 *      `paras-android` UA marker added by the Capacitor build.
 *   2. The user agent is an Android phone (other platforms see the
 *      site as-is — the Play Store install is Android-only).
 *   3. The kill-switch via `localStorage.paras_force_app_gate = "0"` is
 *      not active (admin / dev escape hatch).
 *
 * Desktop, iOS, tablets, and the native app pass straight through.
 */

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.parasreward.prc';
const LOGO_URL = '/paras-logo.png';

function detectAndroidWebBrowser() {
  if (typeof window === 'undefined') return false;

  // Inside Capacitor-wrapped native app → never gate.
  try {
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function') {
      if (window.Capacitor.isNativePlatform()) return false;
    }
    // Some older builds expose Capacitor without isNativePlatform()
    if (window.Capacitor?.platform && window.Capacitor.platform !== 'web') return false;
  } catch (_) {
    /* ignore, fall through to UA check */
  }

  const ua = (navigator.userAgent || '').toLowerCase();

  // Custom UA marker that the Capacitor build appends — extra safety.
  if (ua.includes('paras-android-app')) return false;

  // Only target Android phones (NOT iOS, NOT desktop, NOT tablets via Chrome desktop mode)
  const isAndroid = /android/.test(ua);
  if (!isAndroid) return false;

  // Optional dev escape hatch (admin can clear via DevTools)
  try {
    if (localStorage.getItem('paras_force_app_gate') === '0') return false;
  } catch (_) { /* ignore */ }

  return true;
}

const MobileAppGate = ({ children }) => {
  const [showGate, setShowGate] = useState(false);

  useEffect(() => {
    setShowGate(detectAndroidWebBrowser());
  }, []);

  if (!showGate) return children;

  return (
    <div
      data-testid="mobile-app-gate"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6"
      style={{
        background:
          'linear-gradient(160deg, #0f172a 0%, #1e1b4b 45%, #312e81 100%)',
      }}
    >
      {/* Logo */}
      <img
        src={LOGO_URL}
        alt="PARAS REWARD"
        className="h-24 w-24 rounded-3xl object-contain bg-white p-3 shadow-2xl mb-6"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />

      {/* Title */}
      <h1 className="text-3xl font-bold text-white text-center leading-tight">
        Get the Official<br/>PARAS REWARD App
      </h1>
      <p className="mt-3 text-sm text-slate-300 text-center max-w-sm leading-relaxed">
        For security, faster mining, and exclusive rewards — please
        continue on the official Android app. The mobile website is no
        longer supported.
      </p>

      {/* Primary CTA */}
      <a
        href={PLAY_STORE_URL}
        data-testid="mobile-app-gate-install-btn"
        className="mt-8 w-full max-w-xs rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-6 py-4 text-center font-bold text-slate-900 shadow-xl active:scale-95 transition-transform"
      >
        Install from Play Store
      </a>

      {/* "I have the app" — opens via Android intent so existing
          install launches; falls back to Play Store. */}
      <a
        href={`intent://parasreward.com/#Intent;scheme=https;package=com.parasreward.prc;S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`}
        data-testid="mobile-app-gate-open-btn"
        className="mt-3 w-full max-w-xs rounded-2xl border border-white/30 px-6 py-3 text-center font-semibold text-white/90 active:bg-white/10 transition-colors"
      >
        I already have the app · Open
      </a>

      {/* Trust strip */}
      <div className="mt-10 grid grid-cols-3 gap-4 text-center max-w-sm w-full">
        <div>
          <p className="text-2xl font-bold text-emerald-300">6,000+</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Active users</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-emerald-300">100%</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Secure</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-emerald-300">2x</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Mining boost</p>
        </div>
      </div>

      <p className="mt-10 text-[11px] text-slate-500 text-center">
        © {new Date().getFullYear()} PARAS REWARD · Android · v3.3.1
      </p>
    </div>
  );
};

export default MobileAppGate;
