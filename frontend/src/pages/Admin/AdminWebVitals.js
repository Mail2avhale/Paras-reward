/**
 * Admin → Web Vitals (Real-User Monitoring)
 * --------------------------------------------------------------------------
 * Shows aggregated p50/p75/p95 + good/needs-improvement/poor distribution
 * for the 5 Web Vitals captured by `WebVitalsReporter`:
 *   • LCP   — Largest Contentful Paint (load speed)
 *   • INP   — Interaction to Next Paint (responsiveness)
 *   • CLS   — Cumulative Layout Shift  (visual stability)
 *   • FCP   — First Contentful Paint   (bonus)
 *   • TTFB  — Time To First Byte       (bonus)
 *
 * Plus: Top 5 worst-performing pages by LCP p75. 14-day TTL on docs.
 */
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Activity, RefreshCw, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RATING_BG = {
  good: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  'needs-improvement': 'bg-amber-50 border-amber-200 text-amber-700',
  poor: 'bg-red-50 border-red-200 text-red-700',
};
const HOUR_OPTIONS = [
  { v: 1, label: 'Last 1h' },
  { v: 24, label: 'Last 24h' },
  { v: 168, label: 'Last 7d' },
  { v: 720, label: 'Last 30d' },
];

function authHeader() {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function fmtMs(v, name) {
  if (v == null) return '—';
  if (name === 'CLS') return v.toFixed(3);
  return `${Math.round(v)} ms`;
}

function pickRating(p75, name) {
  if (p75 == null) return 'unknown';
  if (name === 'LCP') return p75 <= 2500 ? 'good' : p75 <= 4000 ? 'needs-improvement' : 'poor';
  if (name === 'INP') return p75 <= 200 ? 'good' : p75 <= 500 ? 'needs-improvement' : 'poor';
  if (name === 'CLS') return p75 <= 0.1 ? 'good' : p75 <= 0.25 ? 'needs-improvement' : 'poor';
  if (name === 'FCP') return p75 <= 1800 ? 'good' : p75 <= 3000 ? 'needs-improvement' : 'poor';
  if (name === 'TTFB') return p75 <= 800 ? 'good' : p75 <= 1800 ? 'needs-improvement' : 'poor';
  return 'unknown';
}

const METRIC_DESC = {
  LCP: 'Largest Contentful Paint — load speed',
  INP: 'Interaction to Next Paint — responsiveness',
  CLS: 'Cumulative Layout Shift — visual stability',
  FCP: 'First Contentful Paint',
  TTFB: 'Time To First Byte',
};

export default function AdminWebVitals() {
  const [hours, setHours] = useState(24);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async (h) => {
    setLoading(true);
    setErr(null);
    try {
      const { data } = await axios.get(`${API}/admin/web-vitals/summary`, {
        params: { hours: h, refresh: 1 },
        headers: authHeader(),
      });
      setData(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(hours);
  }, [hours, load]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6" data-testid="admin-web-vitals-page">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Web Vitals — Real User Monitoring</h1>
            <p className="text-sm text-slate-500">
              Core Web Vitals captured from real production users. p75 is what Google ranks SEO on.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            data-testid="window-select"
          >
            {HOUR_OPTIONS.map(o => (
              <option key={o.v} value={o.v}>{o.label}</option>
            ))}
          </select>
          <Button onClick={() => load(hours)} disabled={loading} variant="outline" data-testid="refresh-btn">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {err && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm" data-testid="error-msg">
          {err}
        </div>
      )}

      {/* Total samples banner */}
      {data && (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between" data-testid="samples-banner">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Samples in window</p>
            <p className="text-2xl font-bold text-slate-900">{(data.total_samples || 0).toLocaleString('en-IN')}</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Window: {data.window_hours}h</p>
            <p>Updated: {new Date(data.generated_at).toLocaleTimeString()}</p>
          </div>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6" data-testid="metric-grid">
        {['LCP', 'INP', 'CLS'].map(name => (
          <MetricCard key={name} name={name} metric={data?.metrics?.[name]} />
        ))}
      </div>

      {/* Bonus row: FCP + TTFB */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {['FCP', 'TTFB'].map(name => (
          <MetricCard key={name} name={name} metric={data?.metrics?.[name]} compact />
        ))}
      </div>

      {/* Worst pages */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5" data-testid="worst-pages-card">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown className="w-5 h-5 text-red-500" />
          <h2 className="text-base font-semibold text-slate-900">Top 5 Worst Pages by LCP (avg)</h2>
        </div>
        {(!data?.worst_pages_by_lcp || data.worst_pages_by_lcp.length === 0) ? (
          <p className="text-sm text-slate-500">Not enough data yet — needs 3+ LCP samples per page in the window.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="text-left py-2">Page</th>
                <th className="text-right py-2">Avg LCP</th>
                <th className="text-right py-2">Samples</th>
              </tr>
            </thead>
            <tbody>
              {data.worst_pages_by_lcp.map((p, i) => (
                <tr key={i} className="border-b border-slate-100" data-testid={`worst-row-${i}`}>
                  <td className="py-2 font-mono text-xs text-slate-700">{p.path || '/'}</td>
                  <td className="py-2 text-right font-semibold">{Math.round(p.avg_lcp_ms)} ms</td>
                  <td className="py-2 text-right text-slate-500">{p.samples}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function MetricCard({ name, metric, compact }) {
  const rating = metric ? pickRating(metric.p75, name) : 'unknown';
  const bg = RATING_BG[rating] || 'bg-slate-50 border-slate-200 text-slate-700';
  const samples = metric?.samples || 0;
  const total = samples || 1;
  const goodPct = Math.round(((metric?.good || 0) / total) * 100);
  const niPct = Math.round(((metric?.needs_improvement || 0) / total) * 100);
  const poorPct = Math.round(((metric?.poor || 0) / total) * 100);

  return (
    <div
      className={`rounded-2xl border p-5 ${bg}`}
      data-testid={`metric-card-${name.toLowerCase()}`}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs uppercase tracking-wider opacity-70">{name}</p>
        {rating === 'good' && <CheckCircle2 className="w-4 h-4 opacity-60" />}
        {rating === 'poor' && <AlertTriangle className="w-4 h-4 opacity-60" />}
      </div>
      {!compact && <p className="text-xs opacity-60 mb-2">{METRIC_DESC[name]}</p>}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat label="p50" value={fmtMs(metric?.p50, name)} testid={`${name.toLowerCase()}-p50`} />
        <Stat label="p75" value={fmtMs(metric?.p75, name)} testid={`${name.toLowerCase()}-p75`} primary />
        <Stat label="p95" value={fmtMs(metric?.p95, name)} testid={`${name.toLowerCase()}-p95`} />
      </div>
      <div className="text-xs flex items-center gap-2 mb-1">
        <span className="font-semibold opacity-80">{samples} samples</span>
      </div>
      {/* Distribution bar */}
      {samples > 0 && (
        <div className="w-full h-2 rounded-full bg-white/40 overflow-hidden flex">
          <div className="bg-emerald-500" style={{ width: `${goodPct}%` }} title={`Good ${goodPct}%`} />
          <div className="bg-amber-500" style={{ width: `${niPct}%` }} title={`Needs improvement ${niPct}%`} />
          <div className="bg-red-500" style={{ width: `${poorPct}%` }} title={`Poor ${poorPct}%`} />
        </div>
      )}
      {samples > 0 && (
        <div className="flex justify-between text-[10px] opacity-70 mt-1">
          <span>{goodPct}% good</span>
          <span>{niPct}% needs imp.</span>
          <span>{poorPct}% poor</span>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, primary, testid }) {
  return (
    <div>
      <p className="text-[10px] uppercase opacity-60">{label}</p>
      <p className={`font-bold ${primary ? 'text-lg' : 'text-base'}`} data-testid={testid}>{value}</p>
    </div>
  );
}
