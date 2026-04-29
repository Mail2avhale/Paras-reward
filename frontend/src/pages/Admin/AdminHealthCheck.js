/**
 * Pre-Deploy Regression Health Check Panel
 * --------------------------------------------------------------------------
 * One-click smoke test that hits /api/admin/health/regression and renders a
 * clean PASS/FAIL table. Use this BEFORE clicking "Save to Github → Deploy"
 * to catch the kind of regressions that cost paisa & vela:
 *  - Top Redeemers returning empty
 *  - User-360 timing out
 *  - Subscription history sort crashes
 *  - Admin VIP payments list returning 404
 *
 * Mounted at /admin/health-check (admin-gated).
 */
import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Activity, Rocket, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CFG = {
  pass: { color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2, label: 'PASS' },
  fail: { color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: XCircle, label: 'FAIL' },
  warn: { color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle, label: 'WARN' },
};

const AdminHealthCheck = () => {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [deep, setDeep] = useState(false);

  const runChecks = useCallback(async () => {
    setRunning(true);
    setError(null);
    setReport(null);
    try {
      const res = await axios.get(`${API}/admin/health/regression${deep ? '?deep=true' : ''}`);
      setReport(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Health check failed');
    } finally {
      setRunning(false);
    }
  }, [deep]);

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6" data-testid="admin-health-check-page">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pre-Deploy Health Check</h1>
            <p className="text-sm text-slate-500">
              Run before deploying. Catches the regressions that have hit production previously.
            </p>
          </div>
        </div>
      </div>

      {/* Run controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            onClick={runChecks}
            disabled={running}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            data-testid="run-health-check-btn"
          >
            {running ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Running…</>
            ) : (
              <><Activity className="w-4 h-4 mr-2" /> Run Smoke Test</>
            )}
          </Button>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={deep}
              onChange={(e) => setDeep(e.target.checked)}
              disabled={running}
              className="w-4 h-4 cursor-pointer accent-emerald-500"
              data-testid="deep-toggle"
            />
            Deep mode (includes heavy User-360)
          </label>
        </div>
        {report && (
          <div
            className={`text-sm font-bold uppercase tracking-wide px-4 py-2 rounded-full border ${
              report.ok_to_deploy
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-red-50 border-red-300 text-red-700'
            }`}
            data-testid="overall-status"
          >
            {report.ok_to_deploy ? '✓ Ok to deploy' : '✗ Do NOT deploy'}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Empty state */}
      {!report && !error && !running && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
          <Rocket className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">Click "Run Smoke Test" to check production-critical endpoints.</p>
          <p className="text-xs mt-1">Catches regressions before they hit users.</p>
        </div>
      )}

      {/* Report */}
      {report && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <SummaryCard label="Total" value={report.summary.total} color="slate" />
            <SummaryCard label="Passed" value={report.summary.passed} color="emerald" />
            <SummaryCard label="Warned" value={report.summary.warned} color="amber" />
            <SummaryCard label="Failed" value={report.summary.failed} color="red" />
          </div>

          {/* Latency banner */}
          <div className="text-xs text-slate-500 mb-3 flex items-center gap-2">
            <span>Total: <span className="font-semibold text-slate-700">{report.total_latency_ms}ms</span></span>
            <span>·</span>
            <span>Checked at: {new Date(report.checked_at).toLocaleString()}</span>
          </div>

          {/* Per-check rows */}
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
            {report.results.map((r) => {
              const cfg = STATUS_CFG[r.status] || STATUS_CFG.fail;
              const Icon = cfg.icon;
              return (
                <div
                  key={r.name}
                  className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors"
                  data-testid={`check-${r.name}`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-medium text-slate-900 truncate">{r.name}</p>
                    <p className="text-xs text-slate-500 truncate">{r.message}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <span className="text-xs text-slate-400 font-mono w-16 text-right tabular-nums">
                    {r.latency_ms}ms
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

const SummaryCard = ({ label, value, color }) => {
  const colorMap = {
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <div className={`rounded-xl border p-4 text-center ${colorMap[color]}`} data-testid={`summary-${label.toLowerCase()}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs uppercase tracking-wider font-semibold mt-1">{label}</p>
    </div>
  );
};

export default AdminHealthCheck;
