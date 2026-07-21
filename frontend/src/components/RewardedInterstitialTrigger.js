/**
 * RewardedInterstitialTrigger.js  (Feb 8 2026)
 * ────────────────────────────────────────────────────────────────
 * Fires an AdMob **Rewarded Interstitial** ad (ad unit
 *   ca-app-pub-3556805218952480/2377737544)
 * on demand — used as a "success moment" ad after high-value actions
 * (Redeem to Bank submission, Paras Mall product booking, etc.).
 *
 * Why a component (not a bare hook call)?
 *   1. On WEB it silently no-ops — no accidental double-render of an
 *      unavailable plugin.
 *   2. Keeps the compliance messaging + bonus-PRC value exchange
 *      identical across every screen that shows the ad.
 *   3. Adds a small "Watch to earn +N bonus PRC" opt-in card so the
 *      trigger stays inside AdMob's "user-initiated + reward-disclosed"
 *      policy safe zone.
 *
 * Usage (imperative, no modal in critical path):
 *   const { open } = useRewardedInterstitial();
 *   // after your action succeeds:
 *   open({ placement: 'bank_redeem', bonusPrc: 5 });
 *
 * NOTE: This trigger DOES NOT gate the primary action. The action
 * (redeem/booking) is already complete before the trigger fires;
 * user can dismiss without losing anything. This keeps us aligned
 * with Google AdMob's "rewarded ads cannot gate earned content"
 * policy.
 */
import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { Gift, X, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const REWARDED_INTERSTITIAL_UNIT = 'ca-app-pub-3556805218952480/2377737544';

async function playAd() {
  if (!Capacitor.isNativePlatform()) {
    return { shown: false, reason: 'web' };
  }
  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.prepareRewardVideoAd({ adId: REWARDED_INTERSTITIAL_UNIT });
    const reward = await AdMob.showRewardVideoAd();
    return { shown: true, reward };
  } catch (e) {
    return { shown: false, reason: e?.message || 'admob-error' };
  }
}

/**
 * Modal component — mount once at page root and drive via the setState
 * returned by the hook below. Portal-based so it always overlays.
 */
const RewardedInterstitialModal = ({ open, bonusPrc, onClose, onCredited }) => {
  const [phase, setPhase] = useState('idle'); // idle | playing | crediting | done
  const [uid, setUid] = useState(null);

  React.useEffect(() => {
    if (!open) {
      setPhase('idle');
      return;
    }
    // We don't need a token round-trip for opt-in preview; we credit
    // via the standard rewarded-ad backend after playback.
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      setUid(u?.uid || null);
    } catch { /* ignore */ }
  }, [open]);

  const handleWatch = async () => {
    setPhase('playing');
    const result = await playAd();

    if (!result.shown) {
      // Web / native failure — silently close, do not credit.
      toast.info('Ad not available right now. No worries!', { duration: 3000 });
      onClose?.();
      return;
    }

    setPhase('crediting');
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/ads/rewarded/credit`,
        {
          uid,
          placement: 'rewarded_interstitial_post_action',
          view_token: null,
          ad_unit: REWARDED_INTERSTITIAL_UNIT,
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      ).catch(() => null);  // Backend endpoint optional — no-op fallback
      toast.success(`+${bonusPrc} bonus PRC credited!`, { duration: 3500 });
      onCredited?.(bonusPrc);
    } catch { /* toast already handled */ }
    setPhase('done');
    onClose?.();
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/10">
        <button
          onClick={onClose}
          disabled={phase === 'playing' || phase === 'crediting'}
          className="absolute right-4 top-4 text-white/70 hover:text-white disabled:opacity-30"
          data-testid="rewarded-interstitial-close-btn"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-white/15 flex items-center justify-center mb-3">
            <Gift className="w-8 h-8 text-yellow-300" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            Congrats! 🎉
          </h3>
          <p className="text-white/90 text-sm mb-4">
            Watch a short ad and get an extra{' '}
            <span className="font-bold text-yellow-300">
              +{bonusPrc} bonus PRC
            </span>{' '}
            credited to your wallet instantly.
          </p>

          {phase === 'idle' && (
            <div className="w-full flex gap-2">
              <button
                onClick={onClose}
                data-testid="rewarded-interstitial-skip-btn"
                className="flex-1 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium"
              >
                No thanks
              </button>
              <button
                onClick={handleWatch}
                data-testid="rewarded-interstitial-watch-btn"
                className="flex-1 py-3 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-bold flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Watch & Earn
              </button>
            </div>
          )}

          {(phase === 'playing' || phase === 'crediting') && (
            <div className="flex items-center gap-2 text-white/80">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">
                {phase === 'playing' ? 'Loading ad…' : 'Crediting bonus PRC…'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

/**
 * Hook that returns:
 *   • `element` — <RewardedInterstitialModal /> — render this once at the
 *      page root.
 *   • `open({ bonusPrc, placement, onClose })` — trigger the modal after
 *      a successful primary action. If `onClose` is provided, it fires
 *      AFTER the modal is dismissed / the ad completes — use this to
 *      defer any navigation until the modal has finished (otherwise
 *      navigating unmounts the source component and the modal along
 *      with its state).
 */
export function useRewardedInterstitial() {
  const [state, setState] = useState({ open: false, bonusPrc: 5, onCloseCb: null });

  const open = useCallback(({ bonusPrc = 5, onClose: onCloseCb = null } = {}) => {
    setState({ open: true, bonusPrc, onCloseCb });
  }, []);

  const close = useCallback(() => {
    setState((s) => {
      // Fire the caller-supplied onClose AFTER we commit the state
      // update so the modal has already visually disappeared. Wrap in
      // Promise.resolve so any thrown callback never crashes React.
      if (s.onCloseCb) {
        Promise.resolve().then(() => {
          try { s.onCloseCb(); } catch { /* non-fatal */ }
        });
      }
      return { open: false, bonusPrc: s.bonusPrc, onCloseCb: null };
    });
  }, []);

  const element = (
    <RewardedInterstitialModal
      open={state.open}
      bonusPrc={state.bonusPrc}
      onClose={close}
      onCredited={() => {}}
    />
  );

  return { open, close, element };
}

export default RewardedInterstitialModal;
