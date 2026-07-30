import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Activity, Database, Zap, AlertTriangle, RefreshCw,
  TrendingUp, Server, Layers, Clock, Gauge,
} from 'lucide-react';
import { API } from '../lib/api';

/**
 * Admin Observability Dashboard — Layer 0 UI (Feb 23, 2026)
 * ==========================================================
 * One-click view of everything the backend observability middleware
 * tracks: request latency percentiles, slow-request log, DB pool health,
 * cache stats, top collection sizes, and — most importantly for the
 * Data Design Refactor — the users doc size histogram.
 */

const fmtBytes = (b) => {
  if (b == null) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const fmtNum = (n) =>
  n == null ? '—' : new Intl.NumberFormat('en-IN').format(n);

const fmtMs = (ms) => (ms == null ? '—' : `${Math.round(ms)} ms`);

const relTime = (ts) => {
  if (!ts) return '—';
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
};

const latencyColor = (ms) => {
  if (ms >= 2000) return 'text-red-600 font-semibold';
  if (ms >= 1000) return 'text-orange-600';
  if (ms >= 500) return 'text-yellow-600';
  return 'text-green-600';
};

// A tiny inline horizontal bar so we don't need a chart library.
const Bar = ({ value, max, colorClass = 'bg-blue-500' }) => {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
      <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, hint, tone = 'default', testId }) => {
  const toneClass = {
    default: 'border-slate-200 bg-white',
    good: 'border-green-200 bg-green-50',
    warn: 'border-orange-200 bg-orange-50',
    bad: 'border-red-200 bg-red-50',
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`} data-testid={testId}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="text-2xl font-semibold text-slate-800">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
};

const AdminObservability = () => {
  const [summary, setSummary] = useState(null);
  const [endpoints, setEndpoints] = useState([]);
  const [slowReqs, setSlowReqs] = useState([]);
  const [dbHealth, setDbHealth] = useState(null);
  const [cacheHealth, setCacheHealth] = useState(null);
  const [collections, setCollections] = useState([]);
  const [histogram, setHistogram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, e, sr, dh, ch, cs, h] = await Promise.allSettled([
        axios.get(`${API}/admin/observability/summary`),
        axios.get(`${API}/admin/observability/endpoints?top_n=25&sort_by=p95_ms`),
        axios.get(`${API}/admin/observability/slow-requests?limit=50`),
        axios.get(`${API}/admin/observability/db-health`),
        axios.get(`${API}/admin/observability/cache-health`),
        axios.get(`${API}/admin/observability/collection-sizes?top_n=15`),
        axios.get(`${API}/admin/observability/users-doc-histogram`),
      ]);
      if (s.status === 'fulfilled') setSummary(s.value.data?.data);
      if (e.status === 'fulfilled') setEndpoints(e.value.data?.endpoints || []);
      if (sr.status === 'fulfilled') setSlowReqs(sr.value.data?.requests || []);
      if (dh.status === 'fulfilled') setDbHealth(dh.value.data);
      if (ch.status === 'fulfilled') setCacheHealth(ch.value.data?.data);
      if (cs.status === 'fulfilled') setCollections(cs.value.data?.collections || []);
      if (h.status === 'fulfilled') setHistogram(h.value.data);
      setLastRefresh(new Date());
    } catch (err) {
      toast.error('Failed to load observability data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const iv = setInterval(fetchAll, 15000);
    return () => clearInterval(iv);
  }, [autoRefresh, fetchAll]);

  const handleReset = async () => {
    if (!window.confirm('Reset per-endpoint stats? (Slow-request buffer will be preserved.)')) return;
    try {
      await axios.post(`${API}/admin/observability/reset`);
      toast.success('Stats reset — new samples will accumulate from now');
      fetchAll();
    } catch (err) {
      toast.error('Reset failed');
    }
  };

  // Users doc size distribution — the KPI dashboard for Data Design Refactor
  const usersMax = histogram?.totals?.max_bytes || 0;
  const usersAvg = histogram?.totals?.avg_bytes || 0;
  const usersCount = histogram?.totals?.count || 0;
  const target5KB = 5120;
  const avgTargetPct = target5KB ? Math.min(100, (usersAvg / target5KB) * 100) : 0;
  const avgTone = usersAvg < target5KB ? 'good' : usersAvg < 10 * 1024 ? 'warn' : 'bad';

  const slowTone = (summary?.slow_rate_pct || 0) > 1 ? 'bad'
    : (summary?.slow_rate_pct || 0) > 0.1 ? 'warn' : 'good';
  const errorTone = (summary?.errors_5xx || 0) > 0 ? 'bad' : 'good';

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6" data-testid="admin-observability-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
            <Activity className="h-7 w-7 text-blue-600" />
            Observability
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Live app health, request latency percentiles, DB pool, cache, and Data Design Refactor progress.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {lastRefresh ? `Updated ${relTime(lastRefresh.getTime() / 1000)}` : ''}
          </span>
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            data-testid="obs-toggle-auto-refresh"
          >
            <Clock className="h-4 w-4 mr-1" />
            {autoRefresh ? 'Auto on (15s)' : 'Auto off'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAll}
            disabled={loading}
            data-testid="obs-refresh-btn"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleReset}
            data-testid="obs-reset-btn"
          >
            Reset stats
          </Button>
        </div>
      </div>

      {/* Global summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={TrendingUp}
          label="Total requests"
          value={fmtNum(summary?.requests_total)}
          hint={`Uptime ${summary ? Math.floor(summary.uptime_seconds / 60) : 0}m`}
          testId="obs-stat-requests"
        />
        <StatCard
          icon={AlertTriangle}
          label={`Slow (> ${summary?.slow_threshold_ms || 2000}ms)`}
          value={`${fmtNum(summary?.slow_requests_total)} (${summary?.slow_rate_pct || 0}%)`}
          tone={slowTone}
          testId="obs-stat-slow"
        />
        <StatCard
          icon={AlertTriangle}
          label="5xx errors"
          value={`${fmtNum(summary?.errors_5xx)} (${summary?.errors_5xx_rate_pct || 0}%)`}
          tone={errorTone}
          testId="obs-stat-5xx"
        />
        <StatCard
          icon={Layers}
          label="Endpoints tracked"
          value={fmtNum(summary?.endpoints_tracked)}
          testId="obs-stat-endpoints"
        />
      </div>

      {/* Users doc size — CRITICAL KPI for Data Design Refactor */}
      <Card className="p-5" data-testid="obs-users-histogram-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Database className="h-5 w-5 text-purple-600" />
            Users Doc Size Distribution
          </h2>
          <Badge variant={usersAvg < target5KB ? 'default' : 'destructive'}>
            {usersAvg < target5KB ? 'On target' : 'Above target'}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-xs text-slate-500 uppercase">Total users</div>
            <div className="text-xl font-semibold">{fmtNum(usersCount)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase">Average size</div>
            <div className={`text-xl font-semibold ${usersAvg < target5KB ? 'text-green-600' : 'text-orange-600'}`}>
              {fmtBytes(usersAvg)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Target: &lt; 5 KB</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase">Max (worst doc)</div>
            <div className={`text-xl font-semibold ${usersMax > 50 * 1024 ? 'text-red-600' : 'text-slate-800'}`}>
              {fmtBytes(usersMax)}
            </div>
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">Progress to &lt; 5 KB avg</div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full ${avgTargetPct <= 100 ? 'bg-green-500' : 'bg-orange-500'}`}
              style={{ width: `${Math.min(100, avgTargetPct)}%` }}
            />
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {avgTargetPct <= 100
              ? `${Math.round(100 - avgTargetPct)}% headroom to target`
              : `${Math.round(avgTargetPct - 100)}% over target — refactor needed`}
          </div>
        </div>

        <div className="mt-5">
          <div className="text-xs text-slate-500 uppercase mb-2">Size buckets</div>
          <div className="space-y-2">
            {histogram?.buckets?.map((b, idx) => {
              const maxBucketCount = Math.max(...(histogram?.buckets?.map((x) => x.count) || [1]));
              return (
                <div key={idx} className="grid grid-cols-[110px_1fr_60px] gap-3 items-center">
                  <span className="text-xs text-slate-600">{b.range}</span>
                  <Bar value={b.count} max={maxBucketCount} colorClass={
                    (b.boundary_low_bytes || 0) < 5120 ? 'bg-green-500' :
                    (b.boundary_low_bytes || 0) < 51200 ? 'bg-yellow-500' :
                    'bg-red-500'
                  } />
                  <span className="text-xs text-slate-700 text-right font-mono">{fmtNum(b.count)} users</span>
                </div>
              );
            })}
            {(!histogram || (histogram?.buckets || []).length === 0) && (
              <div className="text-xs text-slate-400">No data</div>
            )}
          </div>
        </div>
      </Card>

      {/* DB + Cache health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5" data-testid="obs-db-health-card">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Server className="h-5 w-5 text-emerald-600" />
            Database Health
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Ping</span>
              <span className={dbHealth?.ping_ok ? 'text-green-600 font-semibold' : 'text-red-600'}>
                {dbHealth?.ping_ok ? fmtMs(dbHealth.ping_ms) : (dbHealth?.ping_error || 'unknown')}
              </span>
            </div>
            {dbHealth?.motor_pool?.servers?.map((s, i) => (
              <div key={i} className="border-t pt-2">
                <div className="text-xs text-slate-500">{s.address}</div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Pool in-use</span>
                  <span className="font-mono">
                    {s.in_use_sockets ?? '—'} / {s.max_pool_size ?? '—'} max
                  </span>
                </div>
              </div>
            ))}
            {dbHealth?.users_size_guard && (
              <div className="border-t pt-2">
                <div className="text-xs text-slate-500 uppercase">Users size-guard</div>
                <div className="flex justify-between">
                  <span className="text-slate-600">find / find_one calls</span>
                  <span className="font-mono">
                    {fmtNum(dbHealth.users_size_guard.find_calls)} / {fmtNum(dbHealth.users_size_guard.find_one_calls)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Heavy-field bypasses</span>
                  <span className={`font-mono ${(dbHealth.users_size_guard.bypass_hits || 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {fmtNum(dbHealth.users_size_guard.bypass_hits)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5" data-testid="obs-cache-health-card">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Zap className="h-5 w-5 text-yellow-500" />
            Cache Health
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Backend</span>
              <span className="font-mono">{cacheHealth?.connection_type || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">L1 size</span>
              <span className="font-mono">
                {fmtNum(cacheHealth?.l1_memory?.size)} / {fmtNum(cacheHealth?.l1_memory?.max)}
                {' '}({cacheHealth?.l1_memory?.utilization_pct}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">L1 evictions</span>
              <span className="font-mono">{fmtNum(cacheHealth?.l1_memory?.evictions)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Hits / Misses</span>
              <span className="font-mono">
                {fmtNum(cacheHealth?.counters?.hits)} / {fmtNum(cacheHealth?.counters?.misses)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Circuit</span>
              <span className={`font-mono ${cacheHealth?.circuit_breaker?.state === 'closed' ? 'text-green-600' : 'text-red-600'}`}>
                {cacheHealth?.circuit_breaker?.state || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Circuit re-opens</span>
              <span className="font-mono">{fmtNum(cacheHealth?.circuit_breaker?.total_opens)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Slowest endpoints */}
      <Card className="p-5" data-testid="obs-endpoints-card">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Gauge className="h-5 w-5 text-red-600" />
          Slowest endpoints (by p95)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500 uppercase border-b">
              <tr>
                <th className="pb-2">Endpoint</th>
                <th className="pb-2 text-right">Calls</th>
                <th className="pb-2 text-right">p50</th>
                <th className="pb-2 text-right">p95</th>
                <th className="pb-2 text-right">p99</th>
                <th className="pb-2 text-right">max</th>
                <th className="pb-2 text-right">5xx</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.slice(0, 15).map((ep, i) => (
                <tr key={i} className="border-b last:border-none">
                  <td className="py-1.5 font-mono text-xs">{ep.endpoint}</td>
                  <td className="py-1.5 text-right font-mono">{fmtNum(ep.count)}</td>
                  <td className={`py-1.5 text-right font-mono ${latencyColor(ep.p50_ms)}`}>{fmtMs(ep.p50_ms)}</td>
                  <td className={`py-1.5 text-right font-mono ${latencyColor(ep.p95_ms)}`}>{fmtMs(ep.p95_ms)}</td>
                  <td className={`py-1.5 text-right font-mono ${latencyColor(ep.p99_ms)}`}>{fmtMs(ep.p99_ms)}</td>
                  <td className={`py-1.5 text-right font-mono ${latencyColor(ep.max_ms)}`}>{fmtMs(ep.max_ms)}</td>
                  <td className={`py-1.5 text-right font-mono ${ep.errors_5xx > 0 ? 'text-red-600' : ''}`}>
                    {fmtNum(ep.errors_5xx)}
                  </td>
                </tr>
              ))}
              {endpoints.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-3 text-center text-slate-400">No data yet — traffic will populate this table</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent slow requests */}
      <Card className="p-5" data-testid="obs-slow-requests-card">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Recent slow requests
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500 uppercase border-b">
              <tr>
                <th className="pb-2">When</th>
                <th className="pb-2">Method</th>
                <th className="pb-2">Path</th>
                <th className="pb-2 text-right">Elapsed</th>
                <th className="pb-2 text-right">Status</th>
                <th className="pb-2">UID</th>
                <th className="pb-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {slowReqs.map((r, i) => (
                <tr key={i} className="border-b last:border-none">
                  <td className="py-1.5 text-xs">{relTime(r.ts)}</td>
                  <td className="py-1.5 font-mono text-xs">{r.method}</td>
                  <td className="py-1.5 font-mono text-xs">{r.path}</td>
                  <td className={`py-1.5 text-right font-mono ${latencyColor(r.elapsed_ms)}`}>
                    {fmtMs(r.elapsed_ms)}
                  </td>
                  <td className={`py-1.5 text-right font-mono ${r.status >= 500 ? 'text-red-600' : ''}`}>
                    {r.status}
                  </td>
                  <td className="py-1.5 text-xs">{r.uid ? r.uid.slice(0, 8) : '—'}</td>
                  <td className="py-1.5 text-xs">{r.ip || '—'}</td>
                </tr>
              ))}
              {slowReqs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-3 text-center text-slate-400">
                    No slow requests captured yet — that&apos;s great news!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top collections */}
      <Card className="p-5" data-testid="obs-collections-card">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Database className="h-5 w-5 text-blue-600" />
          Top collections by storage
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500 uppercase border-b">
              <tr>
                <th className="pb-2">Collection</th>
                <th className="pb-2 text-right">Docs</th>
                <th className="pb-2 text-right">Avg doc</th>
                <th className="pb-2 text-right">Data</th>
                <th className="pb-2 text-right">Storage</th>
                <th className="pb-2 text-right">Indexes</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((c, i) => (
                <tr key={i} className="border-b last:border-none">
                  <td className="py-1.5 font-mono text-xs">{c.collection}</td>
                  <td className="py-1.5 text-right font-mono">{fmtNum(c.count)}</td>
                  <td className={`py-1.5 text-right font-mono ${c.avg_obj_size_bytes > 5120 ? 'text-orange-600' : ''}`}>
                    {fmtBytes(c.avg_obj_size_bytes)}
                  </td>
                  <td className="py-1.5 text-right font-mono">{fmtBytes(c.data_size_bytes)}</td>
                  <td className="py-1.5 text-right font-mono">{fmtBytes(c.storage_size_bytes)}</td>
                  <td className="py-1.5 text-right font-mono">{fmtNum(c.nindexes)}</td>
                </tr>
              ))}
              {collections.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-3 text-center text-slate-400">Loading…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AdminObservability;
