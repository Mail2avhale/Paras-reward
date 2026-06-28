package com.parasreward.prc;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom Capacitor plugins BEFORE super.onCreate so they
        // are available on first JS bridge ready event.
        registerPlugin(AppOpenAdPlugin.class);
        registerPlugin(InstallReferrerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
