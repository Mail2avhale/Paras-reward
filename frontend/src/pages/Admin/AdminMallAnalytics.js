/**
 * Admin/AdminMallAnalytics.js
 * --------------------------------------------------------------
 * /admin/mall/analytics — top-level KPIs + daily timeline + top
 * products + category breakdown for PARAS MALL.
 *
 * Loads /api/mall/v2/admin/analytics?days=N. Also exposes a
 * "Download CSV" button that hits /api/mall/v2/admin/sales-export.
 */
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  ArrowLeft, ShoppingBag, TrendingUp, Users, Download, Loader2, Eye
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (n) => Number(n || 0).toLocaleString("en-IN");

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

export default function AdminMallAnalytics() {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (range) => {
    setLoading(true);
    try {
      const { data: res } = await axios.get(`${API}/mall/v2/admin/analytics?days=${range}`);
      setData(res);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  const downloadCsv = () => {
    const url = `${API}/mall/v2/admin/sales-export?days=${days}`;
    // Use form-style download so the browser auth header is included (axios default doesn't apply here)
    const token = localStorage.getItem("paras_jwt") || localStorage.getItem("access_token") || "";
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `paras-mall-sales-${days}d.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(() => {});
  };

  return (
    <div
      data-testid="admin-mall-analytics-page"
      className="min-h-screen bg-slate-50 text-slate-900"
    >
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b shadow-sm flex items-center gap-3 px-4 py-3">
        <button
          data-testid="analytics-back-btn"
          onClick={() => navigate("/admin/mall")}
          className="w-9 h-9 rounded-full hover:bg-slate-100 inline-flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-base font-semibold">Mall Analytics</h1>
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex bg-slate-100 rounded-full p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.days}
                data-testid={`analytics-range-${r.days}d`}
                onClick={() => setDays(r.days)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition ${
                  days === r.days ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            data-testid="analytics-csv-btn"
            onClick={downloadCsv}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-full"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </header>

      {loading || !data ? (
        <div className="flex items-center justify-center pt-24">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* KPI Tiles */}
          <div className="grid grid-cols-3 gap-3">
            <Kpi
              icon={<ShoppingBag className="w-4 h-4" />}
              label="Bookings"
              value={fmt(data.totals?.bookings)}
            />
            <Kpi
              icon={<TrendingUp className="w-4 h-4" />}
              label="PRC Collected"
              value={fmt(data.totals?.prc_collected)}
            />
            <Kpi
              icon={<Users className="w-4 h-4" />}
              label="Unique Buyers"
              value={fmt(data.totals?.unique_buyers)}
            />
          </div>

          {/* Top Products */}
          <section className="bg-white rounded-2xl shadow-sm border p-4">
            <h2 className="text-sm font-bold mb-3">Top Products</h2>
            <div className="space-y-2">
              {(data.top_products || []).slice(0, 10).map((p, i) => (
                <div
                  key={p._id || i}
                  data-testid={`top-product-row-${i}`}
                  className="flex items-center justify-between text-sm py-1"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex w-6 h-6 rounded-full bg-slate-100 text-slate-700 items-center justify-center text-[11px] font-semibold">
                      {i + 1}
                    </span>
                    <span className="truncate">{p.name || p._id}</span>
                  </div>
                  <div className="text-xs text-slate-500 shrink-0">
                    {fmt(p.bookings)} bookings · {fmt(p.prc)} PRC
                  </div>
                </div>
              ))}
              {(data.top_products || []).length === 0 && (
                <p className="text-xs text-slate-400">No bookings in this range.</p>
              )}
            </div>
          </section>

          {/* Category Breakdown */}
          <section className="bg-white rounded-2xl shadow-sm border p-4">
            <h2 className="text-sm font-bold mb-3">By Category</h2>
            <div className="space-y-2">
              {(data.by_category || []).map((c, i) => {
                const max = Math.max(1, ...((data.by_category || []).map((x) => x.bookings || 0)));
                const pct = Math.round(((c.bookings || 0) / max) * 100);
                return (
                  <div key={c._id || i} data-testid={`cat-row-${i}`}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="capitalize">{c._id || "general"}</span>
                      <span className="text-slate-500">{fmt(c.bookings)} bookings</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {(data.by_category || []).length === 0 && (
                <p className="text-xs text-slate-400">No data yet.</p>
              )}
            </div>
          </section>

          {/* Most Viewed (not necessarily bought) */}
          <section className="bg-white rounded-2xl shadow-sm border p-4">
            <h2 className="text-sm font-bold mb-3 inline-flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600" /> Most Viewed
            </h2>
            <div className="space-y-1">
              {(data.top_viewed || []).slice(0, 8).map((p, i) => (
                <div
                  key={p.product_id || i}
                  className="flex items-center justify-between text-sm py-1"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="text-xs text-slate-500">{fmt(p.view_count)} views</span>
                </div>
              ))}
              {(data.top_viewed || []).length === 0 && (
                <p className="text-xs text-slate-400">No views recorded yet.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon, label, value }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border p-4">
      <div className="text-slate-500 text-[11px] uppercase tracking-wider flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="text-2xl font-bold mt-1 text-slate-900">{value}</div>
    </div>
  );
}
