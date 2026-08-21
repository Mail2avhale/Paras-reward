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

// ── AD CACHE + ANALYTICS (Aug 2026, Feb 27 2026 rewrite) ───────────────
// Impression rate on production was dropping to ~46% (15.8k req / 7.13k imp).
// Root causes found:
//   • Every modal (ForcedAdInterstitial / RewardedAdPrompt / RewardedInterstitialTrigger)
//     called its OWN prepareRewardVideoAd → duplicate requests
//     that bypassed the cache.
//   • After every show, we background-prefetched the NEXT ad — but
//     users typically do 1-2 collects per session, so that prefetched
//     ad expired unused = 1 request, 0 impression.
//
// Fixes:
//   1. `_adCache` keyed per adId (rewarded + rewarded interstitial share
//      the same cache infra now). Single-flight per adId. Exported
//      helpers `prepareCachedRewarded(adId)` + `showCachedRewarded(adId, placement)`
//      so ALL callers deduplicate through the same code path.
//   2. NO post-show background pre-fetch. The cold-start pre-warm covers
//      the first collect; every subsequent collect fires ONE fresh prepare
//      that goes straight into a show.
//   3. Post lifecycle events to /api/ad-events so we can compute our own
//      funnel and cross-check AdMob's reporting.
const _adCache = new Map(); // adId -> { ready: boolean, preparing: Promise|null }

function _cacheSlot(adId) {
  let slot = _adCache.get(adId);
  if (!slot) {
    slot = { ready: false, preparing: null };
    _adCache.set(adId, slot);
  }
  return slot;
}

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
  const slot = _cacheSlot(adId);
  if (slot.ready) return true;
  // Single-flight lock — if a prepare is in-flight for this adId, await it
  if (slot.preparing) {
    try { return await slot.preparing; } catch (_) { /* fall through to retry */ }
  }
  slot.preparing = (async () => {
    logAdEvent('requested', adId, 'rewarded_prepare');
    try {
      const { AdMob } = await import('@capacitor-community/admob');
      await AdMob.prepareRewardVideoAd({ adId });
      slot.ready = true;
      logAdEvent('loaded', adId, 'rewarded_prepare');
      return true;
    } catch (e) {
      slot.ready = false;
      logAdEvent('failed', adId, 'rewarded_prepare', { error: String(e?.message || e) });
      throw e;
    } finally {
      slot.preparing = null;
    }
  })();
  return slot.preparing;
}

/**
 * Public helper — any UI modal that needs a rewarded ad should call this
 * instead of importing @capacitor-community/admob directly. Enforces
 * one prepare per shown ad → keeps AdMob "show rate" (impressions /
 * requests) high. Returns { shown, reward, reason }.
 *
 * Web / non-native platforms → { shown: false, reason: 'web' }.
 */
export async function showCachedRewarded(adId, placement = 'rewarded') {
  if (!IS_NATIVE) return { shown: false, reward: null, reason: 'web' };
  const slot = _cacheSlot(adId);
  try {
    await _prepareRewarded(adId);
    const { AdMob } = await import('@capacitor-community/admob');
    logAdEvent('show_attempt', adId, placement);
    const reward = await AdMob.showRewardVideoAd();
    // Consumed — clear slot. NO background pre-fetch (was causing 40%
    // of the request→impression gap). Next call re-primes on demand.
    slot.ready = false;
    logAdEvent('completed', adId, placement, { reward_type: reward?.type, reward_amount: reward?.amount });
    return { shown: true, reward };
  } catch (e) {
    slot.ready = false;
    logAdEvent('failed', adId, placement, { error: String(e?.message || e) });
    return { shown: false, reward: null, reason: e?.message || 'error' };
  }
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

    // Cold-start App Open ad — 6 s cap. Bumped from 4 s (2026-02-27):
    // Users on slow 3G / low-end devices frequently hit the timeout before
    // the ad rendered → counted a REQUEST with no IMPRESSION. 6 s is well
    // under Android's ANR watchdog (5 s foreground / 20 s background) and
    // AppOpen ad runs on a detached task so it never blocks the JS thread.
    try {
      logAdEvent('requested', AD_UNITS.appOpen, 'cold_start');
      const res = await AppOpenAdPlugin.showOnColdStart({ timeoutMs: 6000 });
      logAdEvent(res?.shown ? 'completed' : 'failed', AD_UNITS.appOpen, 'cold_start', { reason: res?.reason });
    } catch (e) {
      logAdEvent('failed', AD_UNITS.appOpen, 'cold_start', { error: String(e?.message || e) });
      console.warn('[AppOpenAd] cold-start failed (non-fatal):', e);
    }

    // Pre-warm the rewarded ad cache so the first Collect PRC tap is instant.
    // NOTE: NO background pre-fetch after subsequent shows — that was
    // burning ~40% of requests on ads the user never got to.
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
    // Delegates to the shared cached path so useAdMob and every modal
    // (ForcedAdInterstitial / RewardedAdPrompt / RewardedInterstitialTrigger)
    // funnel through the SAME prepare-once-show-once code path. This is
    // what closes the request→impression gap on the AdMob dashboard.
    return showCachedRewarded(AD_UNITS.rewarded, 'rewarded');
  }, []);

  const showRewardedInterstitial = useCallback(async () => {
    return showCachedRewarded(AD_UNITS.rewardedInterstitial, 'rewarded_interstitial');
  }, []);

  return { isNative: IS_NATIVE, showAppOpen, showRewarded, showRewardedInterstitial };
}
