/**
 * ForcedAdInterstitial.js
 * ─────────────────────────────────────────────────────────────────
 * A simple full-screen interstitial ad prompt rendered via React
 * Portal so it ALWAYS mounts at document.body regardless of any
 * parent's render state. This sidesteps the production-only issue
 * where the RewardedAdPrompt modal silently failed to mount inside
 * MiningWidget.
 *
 * UX:
 *   1. After the user collects their primary PRC, this is shown.
 *   2. User taps "Watch Ad — Earn Bonus" → AdMob rewarded video plays
 *      → server credits the bonus PRC via /ads/rewarded/credit.
 *   3. User taps "Skip" → modal closes, no bonus, primary PRC was
 *      already collected so the user is NEVER blocked.
 *   4. Auto-closes after 30 seconds if user does nothing.
 *
 * The component is intentionally tiny and dependency-light to keep
 * it bullet-proof. No useEffect cleanup-race traps, no inline-arrow
 * dep-arrays, no complex state machines.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Gift, X, Play, Loader2 } from 'lucide-react';
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
  const [bonusPreview, setBonusPreview] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [viewToken, setViewToken] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | ready | watching | crediting | quota | error
  const startedRef = useRef(false);

  // Fetch quota + view_token ONCE when modal opens. Use a ref guard so
  // duplicate effect runs in StrictMode never double-mint tokens.
  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      setPhase('loading');
      setBonusPreview(null);
      setRemaining(null);
      setViewToken(null);
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.post(
          `${API}/ads/rewarded/start`,
          { placement },
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (cancelled) return;
        if (!res.data?.allowed) {
          setPhase('quota');
          return;
        }
        setBonusPreview(res.data.bonus_prc);
        setRemaining(res.data.remaining);
        setViewToken(res.data.view_token);
        setPhase('ready');
      } catch (e) {
        if (!cancelled) setPhase('error');
      }
    })();

    return () => { cancelled = true; };
  }, [open, placement]);

  // Auto-close after 30s so the user is never visually stuck.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => onClose?.(), 30000);
    return () => clearTimeout(t);
  }, [open, onClose]);

  const handleWatch = async () => {
    if (!viewToken) return;
    setPhase('watching');
    const result = await showRewardedAd();
    const eligible = result.shown || !Capacitor.isNativePlatform();
    if (!eligible) {
      toast.error('Ad could not load.');
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
        toast.success(`+${amount} bonus PRC credited!`);
      }
    } catch (e) {
      // best-effort: silent. The primary collect already succeeded.
    }
    onClose?.();
  };

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      data-testid="forced-ad-backdrop"
    >
      <div
        className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-amber-500/30 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 m-0 sm:m-4 shadow-2xl shadow-amber-500/10"
        onClick={(e) => e.stopPropagation()}
        data-testid="forced-ad-modal"
      >
        <div className="flex items-start justify-between mb-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 grid place-items-center shadow-lg shadow-amber-500/30">
            <Gift className="w-6 h-6 text-black" />
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1"
            aria-label="Skip"
            data-testid="forced-ad-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h3 className="text-white text-xl font-bold mt-3 mb-1">Earn Bonus PRC</h3>

        {phase === 'loading' && (
          <p className="text-zinc-400 text-sm leading-relaxed mb-5">Loading bonus offer…</p>
        )}

        {phase === 'quota' && (
          <p className="text-zinc-400 text-sm leading-relaxed mb-5">
            You&rsquo;ve claimed all 10 ad bonuses for today. Come back tomorrow for more!
          </p>
        )}

        {phase === 'error' && (
          <p className="text-zinc-400 text-sm leading-relaxed mb-5">
            Bonus offer is unavailable right now. Your PRC has already been collected.
          </p>
        )}

        {(phase === 'ready' || phase === 'watching' || phase === 'crediting') && (
          <p className="text-zinc-400 text-sm leading-relaxed mb-5">
            Watch a short ad and earn{' '}
            <span className="text-amber-300 font-bold">+{bonusPreview ?? '5–10'} bonus PRC</span>
            {remaining != null && ` • ${remaining} ad${remaining === 1 ? '' : 's'} left today`}
          </p>
        )}

        {(phase === 'ready' || phase === 'watching' || phase === 'crediting') && (
          <button
            onClick={handleWatch}
            disabled={!viewToken || phase !== 'ready'}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold py-3.5 rounded-xl text-sm uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 active:scale-95"
            data-testid="forced-ad-watch"
          >
            {phase === 'watching' && <><Loader2 className="w-4 h-4 animate-spin" /> Loading ad…</>}
            {phase === 'crediting' && <><Loader2 className="w-4 h-4 animate-spin" /> Crediting bonus…</>}
            {phase === 'ready' && <><Play className="w-4 h-4 fill-black" /> Watch Ad &amp; Earn Bonus</>}
          </button>
        )}

        <button
          onClick={onClose}
          className="w-full text-zinc-400 hover:text-zinc-200 text-xs font-medium mt-3 py-2"
          data-testid="forced-ad-skip"
        >
          {phase === 'quota' || phase === 'error' ? 'Close' : 'Skip — without bonus'}
        </button>
      </div>
    </div>
  );

  // Render at document.body level so it can never be hidden by an
  // ancestor's render state.
  return createPortal(modal, document.body);
};

export default ForcedAdInterstitial;
