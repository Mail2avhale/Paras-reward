/**
 * ForcedAdInterstitial.js  (rev — Jun 24, 2026 v2)
 * ─────────────────────────────────────────────────────────────────
 * "Direct rewarded ad" — Google AdMob compliant.
 *
 * UX:
 *   1. Caller mounts this component with `open={true}` right AFTER
 *      primary PRC collection succeeds.
 *   2. We auto-call /api/ads/rewarded/start to get a view_token, then
 *      IMMEDIATELY play the AdMob rewarded video (on native Android).
 *      No intermediate "Watch Ad / Skip" buttons.
 *   3. AdMob provides the standard built-in Close (X) button inside
 *      the video player — that's the user's skip path. This matches
 *      Google AdMob policy for rewarded interstitials.
 *   4. On web (Capacitor is not native): we show a short "Loading
 *      bonus ad…" overlay for 2 seconds then dismiss with no bonus.
 *      Web has no AdMob inventory anyway — production revenue comes
 *      from the Android AAB.
 *   5. If AdMob completes the video → POST /credit → toast "+N bonus PRC".
 *   6. If AdMob is closed early or fails → dismiss silently. Primary
 *      PRC was already collected, so the user is never blocked.
 *
 * Renders via React Portal at document.body so it can never be hidden
 * by an ancestor's render state.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { Capacitor } from '@capacitor/core';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function showRewardedAd() {
  if (!Capacitor.isNativePlatform()) return { shown: false, reason: 'web' };
  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.prepareRewardVideoAd({ adId: 'ca-app-pub-3556805218952480/7314369451' });
    const reward = await AdMob.showRewardVideoAd();
    return { shown: true, reward };
  } catch (e) {
    return { shown: false, reason: e?.message || 'admob-error' };
  }
}

const ForcedAdInterstitial = ({ open, onClose, placement = 'main_mining_collect' }) => {
  const [status, setStatus] = useState('loading'); // loading | playing | done
  const startedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      setStatus('loading');
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    (async () => {
      let viewToken = null;
      // Step 1: ask server for a view_token + bonus preview
      try {
        const token = localStorage.getItem('token');
        const startRes = await axios.post(
          `${API}/ads/rewarded/start`,
          { placement },
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (!cancelled && startRes.data?.allowed) {
          viewToken = startRes.data.view_token;
        }
      } catch (_) {
        // /start failed (quota, auth, network) — silently dismiss.
        // Primary PRC is already collected, so it's safe to skip.
      }

      if (!viewToken) {
        if (!cancelled) onClose?.();
        return;
      }

      // Step 2: play the rewarded ad directly. No intermediate UI.
      setStatus('playing');
      const result = await showRewardedAd();

      // On web AdMob is a no-op. We still call /credit so non-native
      // testers can see the bonus path work. Native: only credit on
      // AdMob's reward callback.
      const eligible = result.shown || !Capacitor.isNativePlatform();

      if (eligible) {
        try {
          const token = localStorage.getItem('token');
          const creditRes = await axios.post(
            `${API}/ads/rewarded/credit`,
            { view_token: viewToken },
            { headers: token ? { Authorization: `Bearer ${token}` } : {} }
          );
          if (!cancelled && creditRes.data?.success) {
            const amount = creditRes.data.credited;
            toast.success(`+${amount} bonus PRC credited!`);
          }
        } catch (_) {
          // best-effort credit — silent on failure
        }
      }

      if (!cancelled) onClose?.();
    })();

    return () => { cancelled = true; };
  }, [open, placement, onClose]);

  // Auto-dismiss after 8s on web (no real AdMob inventory).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => onClose?.(), 8000);
    return () => clearTimeout(t);
  }, [open, onClose]);

  if (!open) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      data-testid="forced-ad-overlay"
    >
      <div className="flex flex-col items-center gap-4 px-6 py-8 rounded-2xl bg-zinc-900/80 border border-amber-500/20">
        <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
        <p className="text-white text-sm font-semibold tracking-wide">
          {status === 'playing' ? 'Bonus ad playing…' : 'Loading bonus ad…'}
        </p>
        <p className="text-zinc-500 text-xs">Your PRC is already collected.</p>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};

export default ForcedAdInterstitial;
