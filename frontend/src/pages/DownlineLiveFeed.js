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
import { ArrowLeft, Gift, RefreshCw, Clock } from 'lucide-react';
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
  const [summary, setSummary] = useState(null);  // 4-bucket earnings tiles

  const fetchFeed = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const [feedRes, summaryRes] = await Promise.all([
        axios.get(
          `${API}/referrals/live-feed/${user.uid}?hours=${windowHours}&limit=100`,
          { timeout: 12_000 }
        ),
        axios.get(
          `${API}/referrals/earnings-summary/${user.uid}`,
          { timeout: 12_000 }
        ).catch(() => null),
      ]);
      if (feedRes.data?.success) setData(feedRes.data);
      if (summaryRes?.data?.success) setSummary(summaryRes.data.buckets);
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

  return (
    <div
      className="min-h-screen bg-white pb-24"
      style={{ fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}
      data-testid="downline-live-feed-page"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/referrals')}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-700 transition"
            data-testid="live-feed-back-btn"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-gray-900 font-bold text-lg leading-tight tracking-tight">
              Downline Live Feed
            </h1>
            <p className="text-gray-500 text-[12px] leading-tight mt-0.5">
              Real-time referral rewards from your network
            </p>
          </div>
          <button
            onClick={fetchFeed}
            className="p-2 rounded-full hover:bg-gray-100 text-indigo-600 transition"
            data-testid="live-feed-refresh-btn"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-5 space-y-5">
        {/* 4-Bucket Earnings Tiles — light theme, unique gradients + shadow */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
          data-testid="live-feed-earnings-tiles"
        >
          {[
            { key: 'today',      label: "Today's",    ring: 'ring-emerald-100',  chip: 'bg-emerald-50 text-emerald-700',  num: 'text-emerald-700',  icon: '☀️' },
            { key: 'yesterday',  label: 'Yesterday',  ring: 'ring-sky-100',      chip: 'bg-sky-50 text-sky-700',          num: 'text-sky-700',      icon: '🕒' },
            { key: 'this_week',  label: 'This Week',  ring: 'ring-fuchsia-100',  chip: 'bg-fuchsia-50 text-fuchsia-700',  num: 'text-fuchsia-700',  icon: '📅' },
            { key: 'this_month', label: 'This Month', ring: 'ring-amber-100',    chip: 'bg-amber-50 text-amber-700',      num: 'text-amber-700',    icon: '🏆' },
          ].map((tile) => {
            const bucket = summary?.[tile.key] || { earned_prc: 0, events: 0 };
            return (
              <div
                key={tile.key}
                data-testid={`earnings-tile-${tile.key}`}
                className={`rounded-2xl p-4 bg-white ring-1 ${tile.ring} shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${tile.chip}`}>
                    {tile.label}
                  </span>
                  <span className="text-base leading-none">{tile.icon}</span>
                </div>
                <p className={`font-extrabold text-2xl tabular-nums leading-tight ${tile.num}`}>
                  {Number(bucket.earned_prc || 0).toFixed(2)}
                </p>
                <p className="text-[11px] text-gray-500 leading-tight mt-1">
                  PRC · {bucket.events} event{bucket.events === 1 ? '' : 's'}
                </p>
              </div>
            );
          })}
        </div>

        {/* Compact window switcher — controls the feed's time window. */}
        <div
          className="flex items-center justify-between gap-2 px-1"
          data-testid="live-feed-window-switcher"
        >
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
            Recent commissions
          </p>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
            {[24, 72, 168].map((h) => (
              <button
                key={h}
                onClick={() => setWindowHours(h)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                  windowHours === h
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
                data-testid={`live-feed-window-${h}h`}
              >
                {h === 24 ? '24H' : h === 72 ? '3D' : '7D'}
              </button>
            ))}
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-2" data-testid="live-feed-list">
          {loading && feed.length === 0 && (
            <div className="text-center py-14">
              <RefreshCw className="w-7 h-7 text-indigo-500 animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Loading feed…</p>
            </div>
          )}

          {!loading && feed.length === 0 && (
            <div
              className="text-center py-14 bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm"
              data-testid="live-feed-empty-state"
            >
              <div className="w-14 h-14 rounded-full bg-fuchsia-50 flex items-center justify-center mx-auto mb-3">
                <Gift className="w-7 h-7 text-fuchsia-500" />
              </div>
              <p className="text-gray-900 font-semibold mb-1">No rewards yet in this window</p>
              <p className="text-gray-500 text-sm px-6 max-w-md mx-auto">
                Once someone in your downline collects mining PRC, their referral
                reward will appear here in real time. Grow your Elite network to
                start earning.
              </p>
            </div>
          )}

          {feed.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 bg-white ring-1 ring-gray-100 rounded-2xl p-3.5 hover:ring-indigo-200 transition"
              data-testid={`live-feed-row-${row.id}`}
            >
              {/* Avatar */}
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0 text-sm shadow-sm">
                {row.downline_profile_pic ? (
                  <img src={row.downline_profile_pic} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  (row.downline_name || 'U').charAt(0).toUpperCase()
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-medium text-sm truncate">
                  <span className="text-fuchsia-700 font-semibold">{row.downline_name}</span>
                  <span className="text-gray-600 font-normal"> collected mining PRC</span>
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-1 flex-wrap">
                  <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-semibold text-[10px]">
                    Tier {row.tier}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span>{Number(row.tier_percent || 0).toFixed(2)}% of {row.downline_collect_amount.toFixed(4)}</span>
                  <span className="text-gray-300">·</span>
                  <Clock className="w-3 h-3" />
                  <span>{timeAgo(row.timestamp)}</span>
                </div>
              </div>

              {/* Amount */}
              <div className="text-right shrink-0">
                <p className="text-emerald-600 font-extrabold tabular-nums text-sm">
                  +{row.amount.toFixed(4)}
                </p>
                <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">PRC</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DownlineLiveFeed;
