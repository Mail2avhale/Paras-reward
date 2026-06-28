package com.parasreward.prc;

import android.app.Activity;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.ProcessLifecycleOwner;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.appopen.AppOpenAd;

import java.util.Date;

/**
 * App Open Ad Capacitor plugin for Paras Reward.
 *
 * The official @capacitor-community/admob plugin (v7.x) does NOT expose
 * App Open ad format. This custom plugin wraps the Google Mobile Ads SDK
 * AppOpenAd class directly (play-services-ads 24.7+, pulled in transitively
 * via the community AdMob plugin).
 *
 * Usage from JS:
 *   const AppOpenAd = registerPlugin('AppOpenAd');
 *   await AppOpenAd.initialize({ adUnitId: 'ca-app-pub-.../...', autoShowOnResume: true });
 *   await AppOpenAd.show();   // manual trigger; no-op if no ad cached
 *
 * Lifecycle:
 *   - On initialize(): loads first ad in background.
 *   - When app moves to foreground (ProcessLifecycleOwner.onStart), auto-shows
 *     the cached ad (if any) and pre-loads the next one.
 *   - Ads expire after 4 hours per Google policy; we silently reload.
 */
@CapacitorPlugin(name = "AppOpenAd")
public class AppOpenAdPlugin extends Plugin {

    private static final String LOG_TAG = "AppOpenAd";
    private static final long AD_TIMEOUT_MS = 4 * 60 * 60 * 1000L; // 4h per policy

    private AppOpenAd appOpenAd = null;
    private boolean isLoading = false;
    private boolean isShowing = false;
    private boolean lifecycleAttached = false;
    private boolean skipNextForeground = true; // skip cold-start (ad not loaded yet)
    private long loadTime = 0;
    private String adUnitId = null;

    @PluginMethod
    public void initialize(PluginCall call) {
        adUnitId = call.getString("adUnitId");
        final boolean autoShow = Boolean.TRUE.equals(call.getBoolean("autoShowOnResume", true));

        if (adUnitId == null || adUnitId.isEmpty()) {
            call.reject("adUnitId is required");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                MobileAds.initialize(getContext(), status -> Log.d(LOG_TAG, "MobileAds initialized"));
            } catch (Exception e) {
                Log.w(LOG_TAG, "MobileAds.initialize threw: " + e.getMessage());
            }
            // Pre-load first ad
            loadAd();

            if (autoShow && !lifecycleAttached) {
                lifecycleAttached = true;
                ProcessLifecycleOwner.get().getLifecycle().addObserver(new DefaultLifecycleObserver() {
                    @Override
                    public void onStart(@NonNull LifecycleOwner owner) {
                        // Skip the very first foreground tick (cold start) — ad not loaded yet.
                        if (skipNextForeground) {
                            skipNextForeground = false;
                            return;
                        }
                        showAdIfAvailable();
                    }
                });
            }

            JSObject ret = new JSObject();
            ret.put("initialized", true);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void show(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }
        activity.runOnUiThread(() -> {
            boolean shown = showAdIfAvailable();
            JSObject ret = new JSObject();
            ret.put("shown", shown);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void load(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }
        activity.runOnUiThread(() -> {
            loadAd();
            JSObject ret = new JSObject();
            ret.put("loading", isLoading);
            ret.put("cached", isAdAvailable());
            call.resolve(ret);
        });
    }

    private boolean isAdAvailable() {
        return appOpenAd != null && (new Date().getTime() - loadTime) < AD_TIMEOUT_MS;
    }

    private void loadAd() {
        if (isLoading || isAdAvailable() || adUnitId == null) return;
        isLoading = true;

        AdRequest request = new AdRequest.Builder().build();
        AppOpenAd.load(
            getContext(),
            adUnitId,
            request,
            new AppOpenAd.AppOpenAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull AppOpenAd ad) {
                    appOpenAd = ad;
                    isLoading = false;
                    loadTime = new Date().getTime();
                    Log.d(LOG_TAG, "App Open ad loaded");
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError error) {
                    isLoading = false;
                    appOpenAd = null;
                    Log.w(LOG_TAG, "App Open ad failed to load: " + error.getMessage());
                }
            }
        );
    }

    private boolean showAdIfAvailable() {
        if (isShowing) return false;
        if (!isAdAvailable()) {
            loadAd();
            return false;
        }
        final Activity activity = getActivity();
        if (activity == null) return false;

        appOpenAd.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                appOpenAd = null;
                isShowing = false;
                loadAd();
            }

            @Override
            public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                Log.w(LOG_TAG, "App Open show failed: " + adError.getMessage());
                appOpenAd = null;
                isShowing = false;
                loadAd();
            }

            @Override
            public void onAdShowedFullScreenContent() {
                isShowing = true;
                Log.d(LOG_TAG, "App Open ad shown");
            }
        });

        appOpenAd.show(activity);
        return true;
    }
}
