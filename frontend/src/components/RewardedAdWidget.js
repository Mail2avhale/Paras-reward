/**
 * RewardedAdWidget.js
 * --------------------------------------------------------------
 * Dashboard widget: "Watch ad → earn PRC".
 *
 *   1. Calls backend /api/ads/rewarded/start to mint a one-time
 *      view-token (idempotency key + remaining-quota check).
 *   2. Plays the AdMob Rewarded video via useAdMob().
 *   3. On reward callback, posts /api/ads/rewarded/credit with the
 *      view-token → backend credits PRC and decrements daily quota.
 *   4. Renders a tiny "X / 10 today" counter and disables itself
 *      when quota is exhausted.
 *
 * Hidden on the web (isNative=false).
 */
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Gift, Loader2, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAdMob } from '@/hooks/useAdMob';
import { hapticSuccess, hapticError } from '@/utils/nativeUx';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RewardedAdWidget({ onBalanceUpdate }) {
  const { isNative, showRewarded } = useAdMob();
  const [quota, setQuota] = useState({ used: 0, max: 10, reward_per_ad: 0.5 });
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(true);

  // ── Fetch today's quota on mount ───────────────────────────────────────
  const loadQuota = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/ads/rewarded/quota`);
      if (data) setQuota(data);
    } catch (_) {
      // soft fail — widget keeps showing defaults
    } finally {
      setPolling(false);
    }
  }, []);

  useEffect(() => {
    if (!isNative) return;
    loadQuota();
  }, [isNative, loadQuota]);

  // ── Watch + claim flow ─────────────────────────────────────────────────
  const watchAndEarn = async () => {
    if (loading) return;
    setLoading(true);

    // 1) Start (server returns view_token + ad_unit_id)
    let viewToken;
    try {
      const { data } = await axios.post(`${API}/ads/rewarded/start`);
      if (!data?.allowed) {
        hapticError();
        toast.error(data?.reason || 'Daily limit reached. Come back tomorrow!');
        await loadQuota();
        setLoading(false);
        return;
      }
      viewToken = data.view_token;
    } catch (e) {
      hapticError();
      toast.error(e?.response?.data?.detail || 'Could not start ad. Try again.');
      setLoading(false);
      return;
    }

    // 2) Show the rewarded video
    const result = await showRewarded();
    if (!result.shown || !result.reward) {
      // user skipped or no fill
      toast.info('Ad not completed. No PRC credited.');
      setLoading(false);
      return;
    }

    // 3) Credit
    try {
      const { data } = await axios.post(`${API}/ads/rewarded/credit`, {
        view_token: viewToken,
      });
      if (data?.success) {
        hapticSuccess();
        toast.success(`+${data.credited.toFixed(2)} PRC credited! 🎉`);
        if (onBalanceUpdate) onBalanceUpdate();
      } else {
        toast.error(data?.detail || 'Credit failed.');
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Credit failed.');
    } finally {
      await loadQuota();
      setLoading(false);
    }
  };

  // Web: render nothing (this widget is native-only)
  if (!isNative) return null;

  const remaining = Math.max(0, quota.max - quota.used);
  const exhausted = remaining === 0;

  return (
    <div
      data-testid="rewarded-ad-widget"
      className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/40 via-teal-900/40 to-slate-900/40 backdrop-blur p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-emerald-500/20 ring-2 ring-emerald-400/40 flex items-center justify-center">
          <Gift className="w-6 h-6 text-emerald-300" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-white">Watch &amp; Earn PRC</h3>
          <p className="text-xs text-emerald-100/70 mt-0.5">
            Watch a short video → earn {quota.reward_per_ad} PRC each time.
          </p>
          <p className="text-[11px] text-emerald-200/60 mt-1">
            Today: <span className="font-semibold text-emerald-200">{quota.used}/{quota.max}</span> watched
          </p>
        </div>
      </div>

      <button
        type="button"
        data-testid="rewarded-ad-watch-btn"
        onClick={watchAndEarn}
        disabled={loading || exhausted || polling}
        className={`mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition active:scale-[0.98] ${
          exhausted
            ? 'bg-slate-700/60 text-slate-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-900 hover:brightness-110'
        }`}
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Loading ad…</>
        ) : exhausted ? (
          <>Daily limit reached</>
        ) : (
          <><PlayCircle className="w-4 h-4" /> Watch &amp; Earn {quota.reward_per_ad} PRC</>
        )}
      </button>
    </div>
  );
}
