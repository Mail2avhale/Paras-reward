/**
 * ForcedAdInterstitial.js  (rev — Jun 24, 2026 v3)
 * ─────────────────────────────────────────────────────────────────
 * Direct rewarded ad after PRC collect.
 *
 * Dual-mode:
 *   • NATIVE (Android AAB / Capacitor): AdMob rewarded video plays
 *     directly. AdMob's built-in close button is the skip path.
 *   • WEB (parasreward.com browser): renders a Google AdSense
 *     interstitial ad unit inside the modal. A mandatory 5-second
 *     view-time enforces ad impression compliance; after 5s a
 *     "Skip" link appears. Auto-closes after 20s if user does nothing.
 *
 * Why a custom web overlay instead of relying on AdSense Auto Ads?
 *   AdSense Auto Ads choose page placements automatically; we cannot
 *   reliably trigger them on a user action. A manually-injected
 *   adsbygoogle slot inside our own modal lets us:
 *     • Tie the ad impression to a specific "collect" event,
 *     • Enforce a 5-second view-time before the skip option,
 *     • Credit the bonus PRC only after the user actually saw the ad.
 *
 * The slot id comes from REACT_APP_ADSENSE_INTERSTITIAL_SLOT (env).
 * Without that env, the overlay still runs the timer + credits the
 * bonus, but only the AdSense "Auto Ad" fallback renders inside it.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { Capacitor } from '@capacitor/core';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ADSENSE_CLIENT = 'ca-pub-3556805218952480';
const ADSENSE_SLOT = process.env.REACT_APP_ADSENSE_INTERSTITIAL_SLOT || '';
const MIN_VIEW_SECONDS = 5;
const MAX_VIEW_SECONDS = 20;

async function showNativeRewardedAd() {
  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.prepareRewardVideoAd({ adId: 'ca-app-pub-3556805218952480/7314369451' });
    const reward = await AdMob.showRewardVideoAd();
    return { shown: true, reward };
  } catch (e) {
    return { shown: false, reason: e?.message || 'admob-error' };
  }
}

const AdSenseSlot = () => {
  const insRef = useRef(null);
  useEffect(() => {
    try {
      // Push to AdSense queue so the slot fills.
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (_) {
      /* ignored — AdSense will load when script is ready */
    }
  }, []);
  return (
    <ins
      ref={insRef}
      className="adsbygoogle"
      style={{ display: 'block', minWidth: 250, minHeight: 250, width: '100%' }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={ADSENSE_SLOT || ''}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
};

const ForcedAdInterstitial = ({ open, onClose, onAdCompleted, placement = 'main_mining_collect' }) => {
  const [phase, setPhase] = useState('init');     // init | playing | done
  const [secsLeft, setSecsLeft] = useState(MIN_VIEW_SECONDS);
  const [nativeFallback, setNativeFallback] = useState(false); // true when native ad fails
  const startedRef = useRef(false);
  const viewTokenRef = useRef(null);
  const closedRef = useRef(false);
  const adCompletedRef = useRef(false);   // true only if ad watched to completion

  // Reset state when the modal opens/closes
  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      closedRef.current = false;
      viewTokenRef.current = null;
      adCompletedRef.current = false;
      setPhase('init');
      setSecsLeft(MIN_VIEW_SECONDS);
      setNativeFallback(false);
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    (async () => {
      // Step 1 — mint view_token (bonus PRC tracking, best-effort)
      try {
        const token = localStorage.getItem('token');
        const startRes = await axios.post(
          `${API}/ads/rewarded/start`,
          { placement },
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (!cancelled && startRes.data?.allowed) {
          viewTokenRef.current = startRes.data.view_token;
        }
      } catch (_) {
        // best-effort — bonus tracking failure shouldn't block collect
      }

      if (cancelled) return;

      // Step 2 — play the ad. Ad completion is a HARD requirement for
      // onAdCompleted to fire. If the ad fails or user closes early,
      // onClose runs but onAdCompleted does NOT — so PRC won't be collected.
      if (Capacitor.isNativePlatform()) {
        setPhase('playing');
        const result = await showNativeRewardedAd();
        if (cancelled) return;
        if (result.shown) {
          adCompletedRef.current = true;
          if (viewTokenRef.current) await creditBonus();
          if (!closedRef.current) {
            closedRef.current = true;
            onAdCompleted?.();   // ✅ credit PRC
            onClose?.();
          }
        } else {
          // Native AdMob failed — inventory empty, module missing, or SDK
          // error. Fall back to the web-style 5s modal so user isn't stuck
          // seeing nothing. Show a soft notice.
          console.warn('[ForcedAd] native ad failed, falling back to web mode:', result.reason);
          try { toast.info('Loading reward…'); } catch (_) { /* noop */ }
          setNativeFallback(true);
          // secsLeft already at MIN_VIEW_SECONDS — the web countdown effect
          // will pick this up and let the user proceed after 5s.
        }
      } else {
        // Web: AdSense slot renders inside modal. User must watch MIN_VIEW_SECONDS.
        setPhase('playing');
      }
    })();

    return () => { cancelled = true; };
  }, [open, placement]);

  // Countdown timer for web Skip path (also drives native fallback)
  useEffect(() => {
    if (!open || phase !== 'playing') return;
    // On native without fallback, the countdown is not needed — AdMob drives closure
    if (Capacitor.isNativePlatform() && !nativeFallback) return;
    if (secsLeft <= 0) return;
    const t = setTimeout(() => setSecsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [open, phase, secsLeft, nativeFallback]);

  // Hard cap — auto-close after MAX_VIEW_SECONDS
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      if (closedRef.current) return;
      closedRef.current = true;
      // Web OR native fallback MAX_VIEW_SECONDS hit → treat as completed
      const nonNativeFlow = !Capacitor.isNativePlatform() || nativeFallback;
      if (nonNativeFlow) {
        adCompletedRef.current = true;
        if (viewTokenRef.current) await creditBonus();
      }
      if (adCompletedRef.current) onAdCompleted?.();
      onClose?.();
    }, MAX_VIEW_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [open, nativeFallback]);

  const creditBonus = async () => {
    if (!viewTokenRef.current) return;
    try {
      const token = localStorage.getItem('token');
      const creditRes = await axios.post(
        `${API}/ads/rewarded/credit`,
        { view_token: viewTokenRef.current },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (creditRes.data?.success) {
        toast.success(`+${creditRes.data.credited} bonus PRC credited!`);
      }
    } catch (_) {
      /* best-effort */
    }
  };

  const handleSkip = async () => {
    if (closedRef.current) return;
    closedRef.current = true;
    // User watched the minimum 5s on web — count as completed, credit bonus + collect PRC.
    adCompletedRef.current = true;
    if (viewTokenRef.current) await creditBonus();
    onAdCompleted?.();
    onClose?.();
  };

  if (!open) return null;

  const isNative = Capacitor.isNativePlatform();
  // Native fallback mode = act like web (show countdown + skip button)
  const showWebOverlay = !isNative || nativeFallback;
  const canSkip = showWebOverlay && secsLeft <= 0;

  const overlay = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-sm"
      data-testid="forced-ad-overlay"
    >
      <div
        className="relative w-full max-w-md mx-4 bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl"
        data-testid="forced-ad-modal"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <span className="text-zinc-400 text-xs uppercase tracking-widest font-semibold">
            {nativeFallback ? 'Preparing Reward' : 'Bonus Ad'}
          </span>
          {canSkip ? (
            <button
              onClick={handleSkip}
              className="text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800"
              data-testid="forced-ad-skip"
            >
              {nativeFallback ? 'Continue' : 'Skip'} <X className="w-3 h-3" />
            </button>
          ) : (
            <span
              className="text-amber-400 text-xs font-mono tabular-nums"
              data-testid="forced-ad-countdown"
            >
              {nativeFallback ? 'Ready in' : 'Skip in'} {secsLeft}s
            </span>
          )}
        </div>

        {/* Ad body */}
        <div className="p-4 min-h-[280px] flex items-center justify-center bg-zinc-900/40">
          {phase === 'init' && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <p className="text-zinc-500 text-xs">Loading bonus ad…</p>
            </div>
          )}
          {phase === 'playing' && isNative && !nativeFallback && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <p className="text-zinc-500 text-xs">Playing ad…</p>
            </div>
          )}
          {phase === 'playing' && !isNative && (
            <div className="w-full">
              <AdSenseSlot />
            </div>
          )}
          {phase === 'playing' && nativeFallback && (
            <div className="flex flex-col items-center gap-3 text-center px-4">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <p className="text-zinc-300 text-sm font-semibold">Ad unavailable right now</p>
              <p className="text-zinc-500 text-xs">
                We&apos;ll credit your reward directly. Please continue in {secsLeft}s.
              </p>
            </div>
          )}
        </div>

        {/* Footer reassurance */}
        <div className="px-4 py-2 border-t border-zinc-800 text-center">
          <p className="text-zinc-600 text-[10px]">
            Your PRC is already collected · Watch to earn +5–10 bonus PRC
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};

export default ForcedAdInterstitial;
