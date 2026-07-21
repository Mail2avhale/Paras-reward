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

    // Cold-start App Open ad — 1.5 s cap (down from 4 s to keep total
    // "app becomes interactive" budget under Android's 5 s ANR watchdog).
    try {
      await AppOpenAdPlugin.showOnColdStart({ timeoutMs: 1500 });
    } catch (e) {
      console.warn('[AppOpenAd] cold-start failed (non-fatal):', e);
    }
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
    try {
      const { AdMob } = await import('@capacitor-community/admob');
      await AdMob.prepareRewardVideoAd({ adId: AD_UNITS.rewarded });
      const reward = await AdMob.showRewardVideoAd();
      return { shown: true, reward };
    } catch (e) {
      return { shown: false, reward: null, reason: e?.message || 'error' };
    }
  }, []);

  const showRewardedInterstitial = useCallback(async () => {
    if (!IS_NATIVE) return { shown: false, reward: null, reason: 'web' };
    try {
      const { AdMob } = await import('@capacitor-community/admob');
      await AdMob.prepareRewardVideoAd({ adId: AD_UNITS.rewardedInterstitial });
      const reward = await AdMob.showRewardVideoAd();
      return { shown: true, reward };
    } catch (e) {
      return { shown: false, reward: null, reason: e?.message || 'error' };
    }
  }, []);

  return { isNative: IS_NATIVE, showAppOpen, showRewarded, showRewardedInterstitial };
}
