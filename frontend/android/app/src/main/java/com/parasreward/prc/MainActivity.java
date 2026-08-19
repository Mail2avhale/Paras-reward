package com.parasreward.prc;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom Capacitor plugins BEFORE super.onCreate so they
        // are available on first JS bridge ready event.
        registerPlugin(AppOpenAdPlugin.class);
        registerPlugin(InstallReferrerPlugin.class);
        super.onCreate(savedInstanceState);

        // -----------------------------------------------------------------
        // Razorpay UPI Intent Support (Feb 2026)
        //
        // Capacitor's default WebViewClient already forwards `upi://` URLs
        // to external Intents via bridge.launchIntent(). BUT Razorpay
        // Checkout.js also uses Android intent:// scheme URIs (e.g.
        //   intent://pay?...#Intent;scheme=upi;package=com.phonepe.app;end
        // ) which need Intent.parseUri(...) with URI_INTENT_SCHEME to be
        // parsed correctly — plain Intent(ACTION_VIEW, uri) won't route to
        // the target package. We intercept only those and delegate all
        // other schemes back to the parent client so Capacitor's built-in
        // security / navigation rules keep working untouched.
        // -----------------------------------------------------------------
        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            webView.setWebViewClient(new BridgeWebViewClient(this.bridge) {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    Uri url = request.getUrl();
                    if (url != null) {
                        String scheme = url.getScheme();

                        // 1) intent:// — Razorpay's canonical deep-link format.
                        //    Parse with URI_INTENT_SCHEME so package/target survive.
                        if ("intent".equalsIgnoreCase(scheme)) {
                            try {
                                Intent intent = Intent.parseUri(url.toString(), Intent.URI_INTENT_SCHEME);
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(intent);
                                return true;
                            } catch (ActivityNotFoundException e) {
                                return false;
                            } catch (Exception e) {
                                return false;
                            }
                        }

                        // 2) Direct UPI app schemes — upi://, phonepe://, tez://,
                        //    paytmmp://, paytm://, gpay://, bhim://, credpay://
                        //    Razorpay sometimes emits these directly (esp. on
                        //    older Android or on partial fallbacks). WebView
                        //    would otherwise treat them as navigation and fail
                        //    with ERR_UNKNOWN_URL_SCHEME.
                        if (scheme != null && (
                                scheme.equalsIgnoreCase("upi")
                                || scheme.equalsIgnoreCase("phonepe")
                                || scheme.equalsIgnoreCase("tez")
                                || scheme.equalsIgnoreCase("paytmmp")
                                || scheme.equalsIgnoreCase("paytm")
                                || scheme.equalsIgnoreCase("gpay")
                                || scheme.equalsIgnoreCase("bhim")
                                || scheme.equalsIgnoreCase("credpay")
                        )) {
                            try {
                                Intent intent = new Intent(Intent.ACTION_VIEW, url);
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(intent);
                                return true;
                            } catch (ActivityNotFoundException e) {
                                return false;
                            } catch (Exception e) {
                                return false;
                            }
                        }
                    }
                    return super.shouldOverrideUrlLoading(view, request);
                }
            });
        }
    }
}
