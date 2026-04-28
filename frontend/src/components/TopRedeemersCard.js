import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Trophy, MapPin, Crown, TrendingUp, Loader2, ShieldCheck } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RANK_STYLE = (rank) => {
  if (rank === 1) return { badge: 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg shadow-amber-500/30', border: 'border-amber-300' };
  if (rank === 2) return { badge: 'bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-md', border: 'border-slate-300' };
  if (rank === 3) return { badge: 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-md', border: 'border-orange-300' };
  return { badge: 'bg-slate-100 text-slate-700', border: 'border-slate-200' };
};

const LeaderRow = ({ r, expanded = false }) => {
  const style = RANK_STYLE(r.rank);
  return (
    <div
      data-testid={`top-redeemer-row-${r.rank}`}
      className={`flex items-center gap-3 px-3 py-2.5 border ${style.border} rounded-xl bg-white hover:shadow-md transition-shadow`}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${style.badge}`}>
        {r.rank <= 3 ? <Trophy className="w-4 h-4" /> : `#${r.rank}`}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 truncate">
          <span className="font-semibold text-slate-900 truncate">{r.name_masked}</span>
          {r.subscription_plan === 'elite' && (
            <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" title="Elite" />
          )}
        </div>
        {(r.city || expanded) && (
          <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
            {r.city && (
              <>
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{r.city}</span>
              </>
            )}
          </div>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-bold text-emerald-600 text-sm">₹{Number(r.total_redeemed_inr || 0).toLocaleString('en-IN')}</div>
        <div className="text-[10px] text-slate-400">{Number(r.total_redeemed_prc || 0).toLocaleString('en-IN')} PRC</div>
      </div>
    </div>
  );
};

const TopRedeemersCard = ({ compact = false, limit = 50 }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(!compact);
  const [refreshedAt, setRefreshedAt] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get(`${API}/leaderboard/top-redeemers?limit=${limit}`, { timeout: 8000 });
        if (!mounted) return;
        setRows(res.data?.leaderboard || []);
        setRefreshedAt(res.data?.refreshed_at ? new Date(res.data.refreshed_at * 1000) : null);
      } catch (e) {
        // silently fail
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [limit]);

  const displayed = showAll ? rows : rows.slice(0, 10);

  return (
    <div
      data-testid="top-redeemers-card"
      className="bg-gradient-to-br from-amber-50 via-white to-orange-50 rounded-2xl border border-amber-200 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          <div>
            <h3 className="font-bold text-base leading-tight">Top Redeemers</h3>
            <p className="text-[11px] text-white/80">Community lifetime leaderboard</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-white/20 px-2 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="text-[10px] font-semibold">Verified</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading leaders...
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm">
            No data yet — be the first to redeem!
          </div>
        ) : (
          displayed.map((r) => <LeaderRow key={r.rank} r={r} expanded />)
        )}
      </div>

      {/* Footer */}
      {rows.length > 10 && (
        <div className="px-3 pb-3">
          <button
            onClick={() => setShowAll((s) => !s)}
            data-testid="top-redeemers-toggle-btn"
            className="w-full py-2 rounded-xl border border-amber-300 bg-white hover:bg-amber-50 text-amber-700 text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <TrendingUp className="w-4 h-4" />
            {showAll ? 'Show Top 10' : `Show All Top ${rows.length}`}
          </button>
        </div>
      )}

      {refreshedAt && !loading && (
        <div className="px-4 pb-2.5 text-[10px] text-slate-400">
          Refreshed {refreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · Updates every 30 min
        </div>
      )}
    </div>
  );
};

export default TopRedeemersCard;
