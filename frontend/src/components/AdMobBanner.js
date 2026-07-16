/**
 * AdMobBanner — dual-mode banner ad renderer (Paras Reward v2.0, Feb 2026)
 * ========================================================================
 * On Capacitor (Android app): mounts a real Google AdMob banner using
 *   @capacitor-community/admob. Banner is shown at BOTTOM_CENTER, size ADAPTIVE_BANNER.
 *   Dismissible via a top-right close chip; auto-cleans up on unmount.
 *
 * On web browser: gracefully falls back to the admin-configured banner
 *   ad from the `popup_messages` collection (placement='partner_store_payment').
 *   If no such popup is enabled, this component renders nothing.
 *
 * Props: placement (default 'partner_store_payment')
 */
import React, { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import axios from 'axios';
import { API } from '../lib/api';

const isNative = () => {
  try {
    // Capacitor exposes window.Capacitor.isNativePlatform() in the runtime
    return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
  } catch { return false; }
};

export default function AdMobBanner({ placement = 'partner_store_payment' }) {
  const [dismissed, setDismissed] = useState(false);
  const [webAd, setWebAd] = useState(null); // fallback popup ad on web
  const [webAdLoaded, setWebAdLoaded] = useState(false);

  // ── Native AdMob path ──────────────────────────────────────────────
  useEffect(() => {
    if (!isNative() || dismissed) return;
    let mounted = true;

    (async () => {
      try {
        const { AdMob, BannerAdPosition, BannerAdSize } = await import('@capacitor-community/admob');
        await AdMob.initialize({ initializeForTesting: false });
        if (!mounted) return;
        await AdMob.showBanner({
          adId: process.env.REACT_APP_ADMOB_BANNER_UNIT_ID,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 0,
          isTesting: false,
        });
      } catch (e) {
        // Silent — no ad shown on failure
        console.warn('[AdMob] banner load failed:', e?.message || e);
      }
    })();

    return () => {
      mounted = false;
      (async () => {
        try {
          const { AdMob } = await import('@capacitor-community/admob');
          await AdMob.removeBanner();
        } catch { /* noop */ }
      })();
    };
  }, [dismissed]);

  // ── Web fallback: fetch admin popup ad for this placement ─────────
  useEffect(() => {
    if (isNative() || dismissed) return;
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get(`${API}/admin/popup/active?placement=${encodeURIComponent(placement)}`);
        if (!mounted) return;
        if (res.data?.has_popup) setWebAd(res.data.data);
        setWebAdLoaded(true);
      } catch (e) {
        if (mounted) setWebAdLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, [placement, dismissed]);

  const handleDismiss = useCallback(async () => {
    setDismissed(true);
    if (isNative()) {
      try {
        const { AdMob } = await import('@capacitor-community/admob');
        await AdMob.removeBanner();
      } catch { /* noop */ }
    }
  }, []);

  if (dismissed) return null;

  // NATIVE — banner is rendered by the Capacitor plugin at BOTTOM_CENTER
  // We render an invisible spacer here so the layout reserves height +
  // adds a floating dismiss chip.
  if (isNative()) {
    return (
      <div className="w-full flex justify-end mt-3" data-testid="admob-native-slot">
        <button
          onClick={handleDismiss}
          className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 px-2 py-1 rounded bg-slate-900/60"
          data-testid="admob-dismiss-btn"
        >
          <X className="w-3 h-3" /> Close ad
        </button>
        {/* 60px reserved space so bottom AdMob banner doesn't cover CTAs */}
        <div className="w-full h-14" aria-hidden />
      </div>
    );
  }

  // WEB fallback — show admin popup banner (if any is enabled)
  if (!webAdLoaded || !webAd) return null;

  return (
    <div
      className="mt-4 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 relative"
      data-testid="web-fallback-ad"
    >
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-black/70 hover:bg-black text-white grid place-items-center"
        aria-label="Close ad"
        data-testid="web-ad-dismiss-btn"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="text-[9px] uppercase tracking-wider text-slate-500 px-3 pt-2">Sponsored</div>
      {webAd.image_url && (
        <img
          src={webAd.image_url.startsWith('http') ? webAd.image_url : `${API}${webAd.image_url.replace(/^\/api/, '')}`}
          alt={webAd.title || 'Advertisement'}
          className="w-full max-h-40 object-cover"
        />
      )}
      <div className="p-3">
        <p className="text-white font-bold text-sm mb-1" data-testid="web-ad-title">{webAd.title}</p>
        {webAd.message_html ? (
          <div
            className="text-slate-300 text-xs prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: webAd.message_html }}
          />
        ) : (
          <p className="text-slate-300 text-xs">{webAd.message}</p>
        )}
        {webAd.button_link && (
          <a
            href={webAd.button_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            data-testid="web-ad-cta-btn"
          >
            {webAd.button_text || 'Learn more'}
          </a>
        )}
      </div>
    </div>
  );
}
