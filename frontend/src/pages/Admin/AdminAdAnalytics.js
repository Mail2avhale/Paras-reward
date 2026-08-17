// Admin — AdMob Analytics (our-side funnel to diagnose request→impression gap)
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { BarChart3, RefreshCw, TrendingDown, TrendingUp, MonitorPlay } from 'lucide-react';
import { API } from '../../lib/api';

const pct = (n) => `${(n || 0).toFixed(1)}%`;
const num = (n) => (n || 0).toLocaleString('en-IN');

const AdminAdAnalytics = () => {
  const [summary, setSummary] = useState(null);
  const [funnel, setFunnel] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, f, p] = await Promise.all([
        axios.get(`${API}/admin/ad-analytics/summary?days=${days}`),
        axios.get(`${API}/admin/ad-analytics/funnel`),
        axios.get(`${API}/admin/ad-analytics/placements?days=${days}`),
      ]);
      setSummary(s.data);
      setFunnel(f.data.days || []);
      setPlacements(p.data.placements || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto" data-testid="admin-ad-analytics-page">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">AdMob Analytics — Our Side</h1>
            <p className="text-xs text-slate-500">Client-side ad funnel to diagnose the request → impression gap vs AdMob dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="px-2 py-1.5 border border-slate-200 rounded-md text-xs" data-testid="days-filter">
            <option value={1}>Last 1 day</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button onClick={load} className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50" data-testid="refresh-btn">
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {summary && (
        <>
          {/* Impression rate hero */}
          <div className={`rounded-2xl p-5 mb-4 border ${summary.impression_rate >= 80 ? 'bg-emerald-50 border-emerald-200' : summary.impression_rate >= 60 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Impression Rate — Last {days} Day{days !== 1 ? 's' : ''}</p>
                <p className={`text-4xl font-bold mt-1 ${summary.impression_rate >= 80 ? 'text-emerald-600' : summary.impression_rate >= 60 ? 'text-yellow-700' : 'text-red-600'}`}>
                  {pct(summary.impression_rate)}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {num(summary.totals?.completed)} impressions from {num(summary.totals?.requested)} requests
                  <span className="ml-2 text-red-600 font-semibold">— {num(summary.our_gap_absolute)} lost</span>
                </p>
              </div>
              {summary.impression_rate >= 80 ? <TrendingUp className="w-16 h-16 text-emerald-300" /> : <TrendingDown className="w-16 h-16 text-red-300" />}
            </div>
          </div>

          {/* Funnel counts */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-5">
            {['requested', 'loaded', 'show_attempt', 'completed', 'failed', 'dismissed'].map(e => (
              <div key={e} className="bg-white border border-slate-200 rounded-xl p-3" data-testid={`stat-${e}`}>
                <p className="text-[10px] uppercase font-semibold text-slate-500">{e.replace('_', ' ')}</p>
                <p className="text-lg font-bold text-slate-900">{num(summary.totals?.[e])}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Placement breakdown */}
      <h3 className="text-sm font-bold text-slate-800 mt-6 mb-2">By Placement (Last {days} Days)</h3>
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto mb-5">
        <table className="w-full text-xs" data-testid="placements-table">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left">Placement</th>
              <th className="px-3 py-2 text-right">Requested</th>
              <th className="px-3 py-2 text-right">Completed</th>
              <th className="px-3 py-2 text-right">Failed</th>
              <th className="px-3 py-2 text-right">Impression Rate</th>
            </tr>
          </thead>
          <tbody>
            {placements.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-6 text-slate-500">No events yet — deploy this build to production and wait for real traffic.</td></tr>
            ) : placements.map(p => (
              <tr key={p.placement} className="border-b border-slate-100">
                <td className="px-3 py-2 font-mono">{p.placement}</td>
                <td className="px-3 py-2 text-right">{num(p.requested)}</td>
                <td className="px-3 py-2 text-right text-emerald-600 font-semibold">{num(p.completed)}</td>
                <td className="px-3 py-2 text-right text-red-500">{num(p.failed)}</td>
                <td className={`px-3 py-2 text-right font-bold ${p.impression_rate >= 80 ? 'text-emerald-600' : p.impression_rate >= 60 ? 'text-yellow-700' : 'text-red-600'}`}>
                  {pct(p.impression_rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Daily funnel */}
      <h3 className="text-sm font-bold text-slate-800 mt-4 mb-2">Daily Funnel</h3>
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-xs" data-testid="daily-funnel-table">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-right">Req</th>
              <th className="px-3 py-2 text-right">Loaded</th>
              <th className="px-3 py-2 text-right">Attempt</th>
              <th className="px-3 py-2 text-right">Completed</th>
              <th className="px-3 py-2 text-right">Failed</th>
              <th className="px-3 py-2 text-right">Dismissed</th>
              <th className="px-3 py-2 text-right">Rate</th>
            </tr>
          </thead>
          <tbody>
            {funnel.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-6 text-slate-500">No data yet.</td></tr>
            ) : funnel.map(d => (
              <tr key={d.date} className="border-b border-slate-100">
                <td className="px-3 py-2 font-mono">{d.date}</td>
                <td className="px-3 py-2 text-right">{num(d.requested)}</td>
                <td className="px-3 py-2 text-right">{num(d.loaded)}</td>
                <td className="px-3 py-2 text-right">{num(d.show_attempt)}</td>
                <td className="px-3 py-2 text-right text-emerald-600 font-semibold">{num(d.completed)}</td>
                <td className="px-3 py-2 text-right text-red-500">{num(d.failed)}</td>
                <td className="px-3 py-2 text-right text-yellow-600">{num(d.dismissed)}</td>
                <td className={`px-3 py-2 text-right font-bold ${d.impression_rate >= 80 ? 'text-emerald-600' : d.impression_rate >= 60 ? 'text-yellow-700' : 'text-red-600'}`}>
                  {pct(d.impression_rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 bg-slate-50 border border-slate-200 rounded-xl p-3">
        <p className="text-[10px] text-slate-600">
          <MonitorPlay className="w-3 h-3 inline mr-1" />
          <b>What good looks like:</b> Impression rate ≥ 80%. Below 60% means many requests never render — check network / low-end devices / preload timing.
          <br />
          <b>How AdMob and this differ:</b> AdMob counts an impression only when its own SDK confirms ~1 s of visible render.
          This dashboard tracks OUR client-side lifecycle — the difference between the two is your true drop-off.
        </p>
      </div>
    </div>
  );
};

export default AdminAdAnalytics;
