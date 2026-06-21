/**
 * mall/SaverProgressBar.js
 * --------------------------------------------------------------
 * "💎 You've saved X PRC! 200 more to unlock SMARTPHONE"
 *
 * Polls /api/mall/v2/saver-progress and renders a motivating progress bar
 * with the next-affordable product target.
 */
import { useEffect, useState } from "react";
import axios from "axios";
import { Sparkles, Gem } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmt = (n) => Number(n || 0).toLocaleString("en-IN");

export default function SaverProgressBar({ refreshKey = 0 }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: res } = await axios.get(`${API}/mall/v2/saver-progress`);
        if (!cancelled) setData(res);
      } catch (_) {
        /* silent — widget is a nice-to-have */
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (!data || !data.next_target) return null;
  const t = data.next_target;
  const pct = Math.min(100, t.percent || 0);

  return (
    <div
      data-testid="saver-progress-bar"
      className="mx-3 mt-3 rounded-2xl p-3 bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-purple-500/15 ring-1 ring-amber-300/30 backdrop-blur"
    >
      <div className="flex items-center gap-2 mb-2">
        <Gem className="w-4 h-4 text-amber-300" />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-amber-100 leading-tight truncate">
            {t.remaining > 0 ? (
              <>Saving for <span className="text-white">{t.product?.name}</span></>
            ) : (
              <>You can book <span className="text-white">{t.product?.name}</span> now!</>
            )}
          </p>
          <p className="text-[10px] text-amber-200/80">
            {t.remaining > 0
              ? `${fmt(t.have)} / ${fmt(t.needed)} PRC saved — ${fmt(t.remaining)} more to go`
              : `${fmt(t.have)} PRC available`}
          </p>
        </div>
        <span className="text-[11px] font-bold text-amber-100">{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-800/60 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-400 via-rose-400 to-purple-400 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {data.affordable_count > 0 && t.remaining > 0 && (
        <p className="mt-2 text-[10px] text-amber-200/70 inline-flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> You can already book {data.affordable_count} smaller items
        </p>
      )}
    </div>
  );
}
