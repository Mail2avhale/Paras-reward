/**
 * RewardedAdPrompt.js
 * ──────────────────────────────────────────────────────────────────
 * Google AdMob-compliant rewarded-ad opt-in flow.
 *
 * UX:
 *   1. Caller opens the modal with: <RewardedAdPrompt open onClose placement onSkip onComplete />
 *   2. Modal asks: "Watch a quick ad for +N bonus PRC?"  (N comes from server)
 *   3. User taps "Watch Ad" → AdMob rewarded video plays → on complete the
 *      server credits the bonus PRC and onComplete(bonusPrc) fires.
 *   4. User taps "Skip" → onSkip() fires immediately (no ad, no bonus).
 *
 * Google policy compliance:
 *   - Reward amount disclosed before the ad starts
 *   - Explicit opt-in (Watch Ad button)
 *   - User can dismiss with Skip — never blocks core PRC collect flow
 *   - Daily quota (10 ads/user/day) enforced server-side
 *
 * Web behaviour:
 *   AdMob plugin is a no-op on web — we still call /start + /credit so
 *   testers / desktop users get the bonus once, but production revenue
 *   only comes from the Android AAB.
 */
import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Gift, X, Play, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { showCachedRewarded, AD_UNITS } from '@/hooks/useAdMob';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function showRewardedAd(placement) {
  // Route through the shared cached path in useAdMob so we don't
  // duplicate `prepareRewardVideoAd` — closes the AdMob request→impression
  // gap (Feb 27 2026).
  return showCachedRewarded(AD_UNITS.rewarded, placement || 'rewarded_prompt');
}

export const RewardedAdPrompt = ({
  open,
  onClose,
  onSkip,
  onComplete,
  placement = 'other',
  title = 'Earn Bonus PRC',
}) => {
  const [bonusPreview, setBonusPreview] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | requesting | watching | crediting | done
  const [viewToken, setViewToken] = useState(null);

  // Fetch quota + bonus preview when the modal opens
  useEffect(() => {
    if (!open) {
      setPhase('idle');
      setBonusPreview(null);
      setViewToken(null);
      return;
    }
    let cancelled = false;
    const init = async () => {
      try {
        const token = localStorage.getItem('token');
        const startRes = await axios.post(
          `${API}/ads/rewarded/start`,
          { placement },
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (cancelled) return;
        if (!startRes.data?.allowed) {
          setPhase('quota');
          setRemaining(0);
          return;
        }
        setBonusPreview(startRes.data.bonus_prc);
        setRemaining(startRes.data.remaining);
        setViewToken(startRes.data.view_token);
      } catch (e) {
        if (!cancelled) {
          // Silently skip on error so user is never blocked
          onSkip?.();
          onClose?.();
        }
      }
    };
    init();
    return () => { cancelled = true; };
  }, [open, placement, onSkip, onClose]);

  const handleWatch = async () => {
    if (!viewToken) return;
    setPhase('watching');
    const result = await showRewardedAd(placement);

    // On web (no AdMob) we still credit so testers can exercise the flow.
    // On native, only credit if AdMob fired the reward callback.
    const eligible = result.shown || !Capacitor.isNativePlatform();
    if (!eligible) {
      toast.error('Ad could not load. Skipped.');
      onSkip?.();
      onClose?.();
      return;
    }

    setPhase('crediting');
    try {
      const token = localStorage.getItem('token');
      const creditRes = await axios.post(
        `${API}/ads/rewarded/credit`,
        { view_token: viewToken },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (creditRes.data?.success) {
        const amount = creditRes.data.credited;
        toast.success(`🎁 +${amount} bonus PRC credited!`);
        onComplete?.(amount);
        setPhase('done');
        onClose?.();
      } else {
        onSkip?.();
        onClose?.();
      }
    } catch (e) {
      const detail = e?.response?.data?.detail || 'Could not credit bonus';
      toast.error(detail);
      onSkip?.();
      onClose?.();
    }
  };

  const handleSkip = () => {
    onSkip?.();
    onClose?.();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleSkip}
      data-testid="rewarded-ad-prompt-backdrop"
    >
      <div
        className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-amber-500/30 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 m-0 sm:m-4 shadow-2xl shadow-amber-500/10 animate-in slide-in-from-bottom-5 duration-300"
        onClick={(e) => e.stopPropagation()}
        data-testid="rewarded-ad-prompt"
      >
        <div className="flex items-start justify-between mb-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 grid place-items-center shadow-lg shadow-amber-500/30">
            <Gift className="w-6 h-6 text-black" />
          </div>
          <button
            onClick={handleSkip}
            className="text-zinc-500 hover:text-zinc-300 p-1"
            aria-label="Skip"
            data-testid="rewarded-ad-prompt-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h3 className="text-white text-xl font-bold mt-3 mb-1">{title}</h3>
        {phase === 'quota' ? (
          <p className="text-zinc-400 text-sm leading-relaxed mb-5">
            You&rsquo;ve claimed all 10 ad bonuses for today. Come back tomorrow for more!
          </p>
        ) : (
          <p className="text-zinc-400 text-sm leading-relaxed mb-5">
            Watch a short ad and earn{' '}
            <span className="text-amber-300 font-bold">
              +{bonusPreview != null ? bonusPreview : '5–10'} bonus PRC
            </span>
            {remaining != null && ` • ${remaining} ad${remaining === 1 ? '' : 's'} left today`}
          </p>
        )}

        {phase !== 'quota' && (
          <button
            onClick={handleWatch}
            disabled={!viewToken || phase === 'watching' || phase === 'crediting'}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold py-3.5 rounded-xl text-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 transition-all active:scale-95"
            data-testid="rewarded-ad-prompt-watch"
          >
            {phase === 'watching' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Loading ad…</>
            ) : phase === 'crediting' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Crediting bonus…</>
            ) : (
              <><Play className="w-4 h-4 fill-black" /> Watch Ad &amp; Earn Bonus</>
            )}
          </button>
        )}

        <button
          onClick={handleSkip}
          className="w-full text-zinc-400 hover:text-zinc-200 text-xs font-medium mt-3 py-2"
          data-testid="rewarded-ad-prompt-skip"
        >
          {phase === 'quota' ? 'Close' : 'Skip — Collect without bonus'}
        </button>
      </div>
    </div>
  );
};

export default RewardedAdPrompt;
