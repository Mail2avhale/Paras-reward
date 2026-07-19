/**
 * GlobalBannerAd — mounted once at App level, decides show/hide by route
 * ======================================================================
 * Feb 17 2026 — Replaces per-page <AdMobBanner /> mounts to fix two
 * production issues:
 *   1. Native AdMob banner persisted across navigations after a component
 *      unmount race, so it kept covering the Dashboard bottom nav.
 *   2. Adding <AdMobBanner /> to every page was fragile (missing pages,
 *      duplicate imports, layout drift).
 *
 * How it works:
 *   • On native (APK): mounts a real AdMob banner at BOTTOM_CENTER with a
 *     90dp margin so it clears the bottom-nav + LIVE ticker on real devices.
 *     Auto-hides on the routes listed in HIDE_ON so navigation stays clean.
 *   • On web: no-op (per-page popup ads remain untouched).
 *
 * Mount once at the top of App.js, right inside the Router. Ad units are
 * pulled from REACT_APP_ADMOB_BANNER_UNIT_ID.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Routes where the banner MUST be hidden (primary navigation surfaces or
// screens where an overlay would confuse the user).
const HIDE_ON_PREFIXES = [
  '/dashboard',           // primary nav — banner covered bottom icons
  '/login',
  '/register',
  '/otp',
  '/onboarding',
  '/splash',
  '/admin',               // admin console never shows user ads
];

const isNative = () => {
  try {
    return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
  } catch { return false; }
};

const shouldHide = (pathname) => {
  const p = (pathname || '/').toLowerCase();
  return HIDE_ON_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + '/'));
};

export default function GlobalBannerAd() {
  const location = useLocation();

  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;

    const run = async () => {
      try {
        const admobMod = await import('@capacitor-community/admob');
        const { AdMob, BannerAdPosition, BannerAdSize } = admobMod;
        // Init is idempotent — safe to call repeatedly.
        await AdMob.initialize({ initializeForTesting: false }).catch(() => {});

        if (cancelled) return;

        if (shouldHide(location.pathname)) {
          // Remove any lingering banner so Dashboard / Login stays clean.
          try { await AdMob.removeBanner(); } catch { /* noop */ }
          return;
        }

        // Ensure any previous banner is torn down before showing a fresh one
        // (protects against duplicate overlays during fast navigations).
        try { await AdMob.removeBanner(); } catch { /* noop */ }
        await AdMob.showBanner({
          adId: process.env.REACT_APP_ADMOB_BANNER_UNIT_ID,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 90, // dp — clears bottom-nav (~64) + LIVE ticker (~28)
          isTesting: false,
        });
      } catch (e) {
        console.warn('[GlobalBannerAd] non-fatal:', e?.message || e);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [location.pathname]);

  // Nothing renders in the DOM — the banner is a native overlay.
  return null;
}
