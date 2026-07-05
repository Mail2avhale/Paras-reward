/**
 * Downline Live Feed — Realtime commission earnings from downline mining.
 *
 * Route: /referrals/live-feed  (linked from Referrals card)
 * Polls /api/referrals/live-feed/{uid} every 30s so new referral rewards
 * surface without the user needing to refresh manually.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Gift, RefreshCw, TrendingUp, Users, Clock } from 'lucide-react';
import { API } from '../lib/api';

const POLL_INTERVAL_MS = 30_000;

function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const secs = Math.max(0, Math.floor((now - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const DownlineLiveFeed = ({ user }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [windowHours, setWindowHours] = useState(24);

  const fetchFeed = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const res = await axios.get(
        `${API}/api/referrals/live-feed/${user.uid}?hours=${windowHours}&limit=100`,
        { timeout: 12_000 }
      );
      if (res.data?.success) setData(res.data);
    } catch (err) {
      console.error('[LiveFeed] fetch failed', err?.message);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, windowHours]);

  useEffect(() => {
    fetchFeed();
    const id = setInterval(fetchFeed, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchFeed]);

  const feed = data?.feed || [];
  const totalEarned = data?.total_earned_prc || 0;
  const distinctDownlines = data?.distinct_downlines || 0;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 pb-24"
      data-testid="downline-live-feed-page"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur border-b border-purple-500/20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/referrals')}
            className="p-2 rounded-lg hover:bg-white/5 text-white"
            data-testid="live-feed-back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-semibold text-base leading-tight">Downline Live Feed</h1>
            <p className="text-gray-400 text-[11px] leading-tight">
              Real-time referral rewards from downline mining
            </p>
          </div>
          <button
            onClick={fetchFeed}
            className="p-2 rounded-lg hover:bg-white/5 text-fuchsia-300"
            data-testid="live-feed-refresh-btn"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Summary Card */}
        <div
          className="bg-gradient-to-br from-fuchsia-900/40 to-purple-900/40 border border-fuchsia-500/30 rounded-2xl p-5"
          data-testid="live-feed-summary-card"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-fuchsia-500/20 flex items-center justify-center">
                <Gift className="w-5 h-5 text-fuchsia-400" />
              </div>
              <div>
                <p className="text-gray-400 text-[10px] uppercase tracking-wider">Total Earned</p>
                <p
                  className="text-white font-bold text-2xl tabular-nums"
                  data-testid="live-feed-total-earned"
                >
                  {totalEarned.toFixed(4)} <span className="text-gray-400 text-base">PRC</span>
                </p>
              </div>
            </div>
            {/* Window selector */}
            <div className="flex gap-1 bg-black/30 rounded-lg p-1">
              {[24, 72, 168].map((h) => (
                <button
                  key={h}
                  onClick={() => setWindowHours(h)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    windowHours === h
                      ? 'bg-fuchsia-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  data-testid={`live-feed-window-${h}h`}
                >
                  {h === 24 ? '24H' : h === 72 ? '3D' : '7D'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/30 border border-fuchsia-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-3.5 h-3.5 text-fuchsia-400" />
                <p className="text-gray-400 text-[10px] uppercase tracking-wider">Downlines</p>
              </div>
              <p
                className="text-white font-bold text-lg tabular-nums"
                data-testid="live-feed-distinct-downlines"
              >
                {distinctDownlines}
              </p>
            </div>
            <div className="bg-black/30 border border-fuchsia-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <p className="text-gray-400 text-[10px] uppercase tracking-wider">Events</p>
              </div>
              <p
                className="text-white font-bold text-lg tabular-nums"
                data-testid="live-feed-event-count"
              >
                {feed.length}
              </p>
            </div>
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-2" data-testid="live-feed-list">
          {loading && feed.length === 0 && (
            <div className="text-center py-10">
              <RefreshCw className="w-8 h-8 text-fuchsia-400 animate-spin mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Loading feed…</p>
            </div>
          )}

          {!loading && feed.length === 0 && (
            <div
              className="text-center py-12 bg-black/20 border border-slate-800 rounded-2xl"
              data-testid="live-feed-empty-state"
            >
              <Gift className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-white font-medium mb-1">No rewards yet in this window</p>
              <p className="text-gray-400 text-sm px-6">
                Once someone in your downline collects mining PRC, their referral
                reward will appear here in real time. Grow your Elite network to
                start earning.
              </p>
            </div>
          )}

          {feed.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 bg-slate-900/60 border border-purple-500/20 rounded-xl p-3 hover:bg-slate-900/80 transition-colors"
              data-testid={`live-feed-row-${row.id}`}
            >
              {/* Avatar / initial */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0">
                {row.downline_profile_pic ? (
                  <img
                    src={row.downline_profile_pic}
                    alt=""
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  (row.downline_name || 'U').charAt(0).toUpperCase()
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">
                  <span className="text-fuchsia-300">{row.downline_name}</span>
                  <span className="text-gray-400 font-normal"> collected mining PRC</span>
                </p>
                <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                  <span className="bg-fuchsia-500/15 text-fuchsia-300 px-1.5 py-0.5 rounded font-semibold">
                    Tier {row.tier}
                  </span>
                  <span>•</span>
                  <span>{Number(row.tier_percent || 0).toFixed(2)}% of {row.downline_collect_amount.toFixed(4)}</span>
                  <span>•</span>
                  <Clock className="w-3 h-3" />
                  <span>{timeAgo(row.timestamp)}</span>
                </div>
              </div>

              {/* Amount */}
              <div className="text-right shrink-0">
                <p className="text-emerald-400 font-bold tabular-nums text-sm">
                  +{row.amount.toFixed(4)}
                </p>
                <p className="text-gray-500 text-[10px]">PRC</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DownlineLiveFeed;
