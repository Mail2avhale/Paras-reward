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
                    if (url != null && "intent".equalsIgnoreCase(url.getScheme())) {
                        try {
                            Intent intent = Intent.parseUri(url.toString(), Intent.URI_INTENT_SCHEME);
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(intent);
                            return true;
                        } catch (ActivityNotFoundException e) {
                            // Target UPI app not installed — fall through so
                            // Razorpay's fallback UI (QR / collect) can render.
                            return false;
                        } catch (Exception e) {
                            return false;
                        }
                    }
                    return super.shouldOverrideUrlLoading(view, request);
                }
            });
        }
    }
}
