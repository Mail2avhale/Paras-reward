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

async function initOnce() {
  if (!IS_NATIVE || initialized) return;
  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.initialize({
      requestTrackingAuthorization: true,
      testingDevices: [],
      initializeForTesting: false,
    });
    initialized = true;
  } catch (e) {
    console.warn('[AdMob] init failed (non-fatal):', e);
  }

  // Initialize custom App Open plugin — pre-loads first ad and auto-shows
  // on every foreground/resume after cold start.
  try {
    await AppOpenAdPlugin.initialize({
      adUnitId: AD_UNITS.appOpen,
      autoShowOnResume: true,
    });
  } catch (e) {
    console.warn('[AppOpenAd] init failed (non-fatal):', e);
  }
}

export function useAdMob() {
  useEffect(() => { initOnce(); }, []);

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
