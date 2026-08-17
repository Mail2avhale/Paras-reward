/**
 * AdMob hook — wraps @capacitor-community/admob (Banner/Interstitial/Reward)
 * + custom AppOpenAd Capacitor plugin (App Open format, not in the community
 * plugin as of v7.x).
 *
 * No-op on web (only triggers on native Android).
 *
 * Ad units (from AdMob console — Paras Reward):
 *   - App ID:               ca-app-pub-3556805218952480~1933993140
 *   - App Open:             ca-app-pub-3556805218952480/2186165856
 *   - Rewarded ("PRC"):     ca-app-pub-3556805218952480/7314369451
 *   - Rewarded Interstitial:ca-app-pub-3556805218952480/2377737544
 *
 * ── ANR MITIGATION (Feb 7 2026) ────────────────────────────────────────
 * Play Console flagged 1.47 % user-perceived ANR rate (threshold 0.47%).
 * Root cause: the previous cold-start flow hid the splash ONLY AFTER
 * waiting up to 4 s for an App Open ad. On low-end devices Android's
 * ANR watchdog fires ~5s of unresponsive main thread, and the ad init
 * + splash-still-visible combination looked like a frozen app to the
 * watchdog even though JS was running.
 *
 * New flow:
 *   1. Hide the splash IMMEDIATELY on mount (< 100 ms) so the WebView
 *      becomes interactive before anything else.
 *   2. Kick off AdMob init on the next idle-frame (requestIdleCallback
 *      fallback to setTimeout 500 ms) so its ~600 ms native-bridge cost
 *      never blocks first paint.
 *   3. Cold-start App Open ad has its own 1.5 s (down from 4 s) timeout
 *      and runs completely detached — never awaited by any UI code path.
 */
import { useEffect, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

const IS_NATIVE = Capacitor.isNativePlatform();

// Custom native Capacitor plugin (see android/app/.../AppOpenAdPlugin.java)
const AppOpenAdPlugin = registerPlugin('AppOpenAd');

export const AD_UNITS = {
  appOpen: 'ca-app-pub-3556805218952480/2186165856',
  rewarded: 'ca-app-pub-3556805218952480/7314369451',
  rewardedInterstitial: 'ca-app-pub-3556805218952480/2377737544',
};

let initialized = false;
let splashHidden = false;

// ── AD CACHE + ANALYTICS (Aug 2026) ────────────────────────────────────
// Impression rate on production was dropping to ~53% (6.14k req / 3.25k imp).
// Two structural fixes:
//   1. Cache a "ready" rewarded ad so multiple UX callers don't each fire
//      a `prepareRewardVideoAd` — one prepare, one show, one impression.
//   2. Post lifecycle events to /api/ad-events so we can compute our own
//      funnel and cross-check AdMob's reporting.
const _rewardedCache = { adId: null, ready: false, preparing: null };

function logAdEvent(event_type, ad_unit, placement, extra = {}) {
  try {
    const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
    const token = (typeof localStorage !== 'undefined') ? localStorage.getItem('token') : null;
    // Fire-and-forget — never block UX on analytics
    fetch(`${API}/ad-events`, {
      method: 'POST', keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ event_type, ad_unit, placement, native: IS_NATIVE, ...extra }),
    }).catch(() => {});
  } catch (_) { /* no-op */ }
}

async function _prepareRewarded(adId) {
  if (_rewardedCache.ready && _rewardedCache.adId === adId) return true;
  // Single-flight lock — if a prepare is in-flight for this adId, await it
  if (_rewardedCache.preparing) {
    try { return await _rewardedCache.preparing; } catch (_) { /* fall through to retry */ }
  }
  _rewardedCache.preparing = (async () => {
    logAdEvent('requested', adId, 'rewarded_prepare');
    try {
      const { AdMob } = await import('@capacitor-community/admob');
      await AdMob.prepareRewardVideoAd({ adId });
      _rewardedCache.adId = adId;
      _rewardedCache.ready = true;
      logAdEvent('loaded', adId, 'rewarded_prepare');
      return true;
    } catch (e) {
      _rewardedCache.ready = false;
      logAdEvent('failed', adId, 'rewarded_prepare', { error: String(e?.message || e) });
      throw e;
    } finally {
      _rewardedCache.preparing = null;
    }
  })();
  return _rewardedCache.preparing;
}

async function hideSplashSafe() {
  if (splashHidden) return;
  splashHidden = true;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 200 });
  } catch (e) {
    console.warn('[SplashScreen] hide failed (non-fatal):', e);
  }
}

/**
 * Detached — never awaited. Runs on the next idle tick so it never blocks
 * the JS main thread during initial React reconciliation.
 */
function scheduleAdMobInit() {
  if (!IS_NATIVE || initialized) return;
  initialized = true; // set immediately to prevent double-schedule

  const kick = async () => {
    try {
      const { AdMob } = await import('@capacitor-community/admob');
      // ────────────────────────────────────────────────────────────
      // PRODUCTION-ONLY AdMob initialization (Feb 20 2026).
      // • initializeForTesting: false   → Do NOT serve test ads
      // • testingDevices:      []       → Empty list — no test devices
      // • No `setTestDeviceIds` anywhere in the codebase (audited)
      // • No Google test ad unit IDs (`ca-app-pub-3940...`) used
      // Real ad unit IDs come from process.env.REACT_APP_ADMOB_*
      // Native side (AppOpenAdPlugin.java) also explicitly calls
      // MobileAds.setRequestConfiguration() with an empty test-device
      // list, which OVERRIDES any device-level auto-test flag.
      // ────────────────────────────────────────────────────────────
      await AdMob.initialize({
        requestTrackingAuthorization: true,
        testingDevices: [],
        initializeForTesting: false,
      });
    } catch (e) {
      console.warn('[AdMob] init failed (non-fatal):', e);
    }

    try {
      await AppOpenAdPlugin.initialize({
        adUnitId: AD_UNITS.appOpen,
        autoShowOnResume: true,
      });
    } catch (e) {
      console.warn('[AppOpenAd] init failed (non-fatal):', e);
    }

    // Cold-start App Open ad — 4 s cap. Bumped from 1.5 s (2026-08-13):
    // the 1.5 s window was too tight on slow networks / low-end phones —
    // the request fired but the ad never rendered → counted a REQUEST
    // with no IMPRESSION. 4 s is well under Android's 5 s ANR watchdog
    // and covers 95%+ of real-world ad loads.
    try {
      logAdEvent('requested', AD_UNITS.appOpen, 'cold_start');
      const res = await AppOpenAdPlugin.showOnColdStart({ timeoutMs: 4000 });
      logAdEvent(res?.shown ? 'completed' : 'failed', AD_UNITS.appOpen, 'cold_start', { reason: res?.reason });
    } catch (e) {
      logAdEvent('failed', AD_UNITS.appOpen, 'cold_start', { error: String(e?.message || e) });
      console.warn('[AppOpenAd] cold-start failed (non-fatal):', e);
    }

    // Pre-warm the rewarded ad cache so the first Collect PRC tap is instant.
    _prepareRewarded(AD_UNITS.rewarded).catch(() => {});
  };

  // Prefer requestIdleCallback; fall back to a small setTimeout on browsers
  // (older Android WebViews) that don't expose it. Either way, this runs
  // AFTER first paint of the login/dashboard shell.
  const schedule = (typeof window !== 'undefined' && window.requestIdleCallback)
    ? (cb) => window.requestIdleCallback(cb, { timeout: 1500 })
    : (cb) => setTimeout(cb, 500);
  schedule(() => { kick(); /* never awaited */ });
}

export function useAdMob() {
  useEffect(() => {
    // Step 1 — hide splash IMMEDIATELY so the WebView becomes interactive
    // within the first ~100 ms of mount. Keeping the native splash up any
    // longer risks Android tagging the app as ANR when the JS bundle is
    // still evaluating on low-end devices.
    hideSplashSafe();

    // Step 2 — schedule the heavy AdMob + cold-start ad flow on an idle
    // frame so it never contends with React's first-paint reconciliation.
    scheduleAdMobInit();
  }, []);

  const showAppOpen = useCallback(async () => {
    if (!IS_NATIVE) return { shown: false, reason: 'web' };
    try {
      const res = await AppOpenAdPlugin.show();
      return { shown: !!res?.shown };
    } catch (e) {
      return { shown: false, reason: e?.message || 'error' };
    }
  }, []);

  const showRewarded = useCallback(async () => {
    if (!IS_NATIVE) return { shown: false, reward: null, reason: 'web' };
    const adId = AD_UNITS.rewarded;
    try {
      // Use the cache — if a prepared ad is already in memory this is a no-op.
      await _prepareRewarded(adId);
      const { AdMob } = await import('@capacitor-community/admob');
      logAdEvent('show_attempt', adId, 'rewarded');
      const reward = await AdMob.showRewardVideoAd();
      // Ad consumed — clear cache and pre-fetch the next one in background
      _rewardedCache.ready = false;
      _rewardedCache.adId = null;
      logAdEvent('completed', adId, 'rewarded', { reward_type: reward?.type, reward_amount: reward?.amount });
      _prepareRewarded(adId).catch(() => {});
      return { shown: true, reward };
    } catch (e) {
      _rewardedCache.ready = false;
      _rewardedCache.adId = null;
      logAdEvent('failed', adId, 'rewarded', { error: String(e?.message || e) });
      return { shown: false, reward: null, reason: e?.message || 'error' };
    }
  }, []);

  const showRewardedInterstitial = useCallback(async () => {
    if (!IS_NATIVE) return { shown: false, reward: null, reason: 'web' };
    const adId = AD_UNITS.rewardedInterstitial;
    try {
      const { AdMob } = await import('@capacitor-community/admob');
      logAdEvent('requested', adId, 'rewarded_interstitial');
      await AdMob.prepareRewardVideoAd({ adId });
      logAdEvent('show_attempt', adId, 'rewarded_interstitial');
      const reward = await AdMob.showRewardVideoAd();
      logAdEvent('completed', adId, 'rewarded_interstitial', { reward_type: reward?.type, reward_amount: reward?.amount });
      return { shown: true, reward };
    } catch (e) {
      logAdEvent('failed', adId, 'rewarded_interstitial', { error: String(e?.message || e) });
      return { shown: false, reward: null, reason: e?.message || 'error' };
    }
  }, []);

  return { isNative: IS_NATIVE, showAppOpen, showRewarded, showRewardedInterstitial };
}
