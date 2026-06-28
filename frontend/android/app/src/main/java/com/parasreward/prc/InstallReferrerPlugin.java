package com.parasreward.prc;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Install Referrer Capacitor plugin.
 *
 * Bridges the Google Play Install Referrer Library (`com.android.installreferrer:installreferrer`)
 * to JS. Captures the referrer string that Play Store passed to the app during
 * install — this is how we attribute first-launch users back to the referrer
 * who shared the link, even when the user went through the MobileAppGate →
 * Play Store install → first-launch flow (URL params are lost in that bounce
 * unless we use Install Referrer).
 *
 * Lifetime:
 *   - The Install Referrer API returns the referrer ONLY on the first call
 *     for an app install (you have ~24h on some devices, indefinite on most).
 *   - We cache the result in SharedPreferences so subsequent JS calls return
 *     instantly without re-binding to Play Store.
 *   - JS marks the referrer as `consumed=true` once the attribution is
 *     applied (e.g., after the user registers); we keep the cached raw value
 *     for debugging but won't double-apply.
 *
 * Referrer URL format (what Play Store passes):
 *   "ref=ABC123&utm_source=whatsapp"  (raw query-string style)
 */
@CapacitorPlugin(name = "InstallReferrer")
public class InstallReferrerPlugin extends Plugin {

    private static final String LOG_TAG = "InstallReferrer";
    private static final String PREFS_NAME = "paras_install_referrer";
    private static final String KEY_REFERRER = "referrer";
    private static final String KEY_CLICK_TIME = "click_time";
    private static final String KEY_INSTALL_TIME = "install_time";
    private static final String KEY_CONSUMED = "consumed";
    private static final String KEY_FETCHED = "fetched";

    /**
     * Reads the install referrer.
     *
     * If we already cached it in SharedPreferences, return that immediately.
     * Otherwise, bind to Play Store, fetch fresh, cache, and return.
     *
     * JS receives:
     *   {
     *     referrer: "ref=ABC123&utm_source=whatsapp" | "",
     *     clickTime: <unix-seconds>,
     *     installTime: <unix-seconds>,
     *     consumed: <bool>,    // true if JS previously called markConsumed()
     *     fetched: <bool>      // true if we got a real value from Play Store
     *   }
     */
    @PluginMethod
    public void getInstallReferrer(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean alreadyFetched = prefs.getBoolean(KEY_FETCHED, false);

        if (alreadyFetched) {
            JSObject ret = new JSObject();
            ret.put("referrer", prefs.getString(KEY_REFERRER, ""));
            ret.put("clickTime", prefs.getLong(KEY_CLICK_TIME, 0));
            ret.put("installTime", prefs.getLong(KEY_INSTALL_TIME, 0));
            ret.put("consumed", prefs.getBoolean(KEY_CONSUMED, false));
            ret.put("fetched", true);
            ret.put("cached", true);
            call.resolve(ret);
            return;
        }

        // Cold-path: bind to Play Store and fetch.
        final InstallReferrerClient client = InstallReferrerClient.newBuilder(getContext()).build();
        client.startConnection(new InstallReferrerStateListener() {
            @Override
            public void onInstallReferrerSetupFinished(int responseCode) {
                String referrer = "";
                long clickTime = 0;
                long installTime = 0;
                boolean fetched = false;

                switch (responseCode) {
                    case InstallReferrerClient.InstallReferrerResponse.OK:
                        try {
                            ReferrerDetails details = client.getInstallReferrer();
                            referrer = details.getInstallReferrer() != null ? details.getInstallReferrer() : "";
                            clickTime = details.getReferrerClickTimestampSeconds();
                            installTime = details.getInstallBeginTimestampSeconds();
                            fetched = true;
                            Log.d(LOG_TAG, "Install referrer fetched: " + referrer);
                        } catch (Exception e) {
                            Log.w(LOG_TAG, "getInstallReferrer threw: " + e.getMessage());
                        }
                        break;
                    case InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED:
                        Log.w(LOG_TAG, "Install Referrer not supported on this device");
                        break;
                    case InstallReferrerClient.InstallReferrerResponse.SERVICE_UNAVAILABLE:
                        Log.w(LOG_TAG, "Play Store service unavailable");
                        break;
                    default:
                        Log.w(LOG_TAG, "Install Referrer setup failed: code=" + responseCode);
                }

                // Cache result (even empty/failed — we won't retry; Play Store
                // only serves the referrer once anyway).
                SharedPreferences.Editor editor = prefs.edit();
                editor.putString(KEY_REFERRER, referrer);
                editor.putLong(KEY_CLICK_TIME, clickTime);
                editor.putLong(KEY_INSTALL_TIME, installTime);
                editor.putBoolean(KEY_FETCHED, fetched);
                editor.apply();

                try { client.endConnection(); } catch (Exception ignored) {}

                JSObject ret = new JSObject();
                ret.put("referrer", referrer);
                ret.put("clickTime", clickTime);
                ret.put("installTime", installTime);
                ret.put("consumed", false);
                ret.put("fetched", fetched);
                ret.put("cached", false);
                call.resolve(ret);
            }

            @Override
            public void onInstallReferrerServiceDisconnected() {
                // Play Store closed the connection unexpectedly. If we already
                // resolved in onInstallReferrerSetupFinished, nothing to do.
                Log.w(LOG_TAG, "Install Referrer service disconnected");
            }
        });
    }

    /**
     * JS calls this once it has applied the referrer (e.g., after the user
     * registers and we've credited the attribution). Marks `consumed=true`
     * in SharedPreferences so subsequent calls don't re-attribute.
     *
     * The raw referrer string is kept in cache for debugging / admin tools.
     */
    @PluginMethod
    public void markConsumed(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_CONSUMED, true).apply();
        JSObject ret = new JSObject();
        ret.put("consumed", true);
        call.resolve(ret);
    }
}
