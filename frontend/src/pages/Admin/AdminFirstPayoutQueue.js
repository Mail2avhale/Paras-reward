/**
 * AdminFirstPayoutQueue — new-user-priority page focused on getting
 * every new user their first ₹1,000 bank payout as fast as possible.
 *
 * Data source: /api/bank-transfer/admin/first-payout-queue (backend
 * aggregates users with lifetime_bank_paid_inr < threshold, sorts
 * oldest-pending first).
 *
 * UX principle: Zero drop-off risk. New users get faster payouts,
 * building trust before hitting the general queue.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Copy, Check, Gift, Clock, AlertTriangle, RefreshCw, Settings2,
  CheckCircle2, XCircle, Loader2, Users, IndianRupee, Banknote,
  ArrowLeft,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const CopyableField = ({ label, value, testId }) => {
  const [copied, setCopied] = useState(false);
  const doCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch { toast.error('Copy failed'); }
  };
  return (
    <div className="flex items-center gap-2" data-testid={testId}>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-mono text-slate-800 truncate">{value || '—'}</p>
      </div>
      {value && (
        <button
          onClick={doCopy}
          className="shrink-0 p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition"
          title={`Copy ${label}`}
          data-testid={`${testId}-copy`}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
        </button>
      )}
    </div>
  );
};

const AdminFirstPayoutQueue = ({ user }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionInProgress, setActionInProgress] = useState({});   // req_id -> 'approve' | 'reject'
  const [thresholdInput, setThresholdInput] = useState('');
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const headers = { Authorization: `Bearer ${user?.token}` };

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/bank-transfer/admin/first-payout-queue?limit=200`, { headers });
      setData(res.data);
      setThresholdInput(String(res.data?.threshold_inr ?? 1000));
    } catch (e) {
      toast.error('Failed to load queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token]);

  useEffect(() => { load(); }, [load]);

  const saveThreshold = async () => {
    const v = thresholdInput.trim();
    const num = v === '' ? null : Number(v);
    if (num !== null && (Number.isNaN(num) || num < 0 || num > 5000)) {
      return toast.error('Threshold must be 0–5000 (empty = env default)');
    }
    setSavingThreshold(true);
    try {
      await axios.post(`${API}/api/bank-transfer/admin/first-payout-threshold`, { value: num }, { headers });
      toast.success('Threshold saved');
      setShowSettings(false);
      setRefreshing(true);
      load();
    } catch { toast.error('Save failed'); }
    finally { setSavingThreshold(false); }
  };

  const doAction = async (reqId, action) => {
    const url = action === 'approve'
      ? `${API}/api/bank-transfer/admin/mark-paid`
      : `${API}/api/bank-transfer/admin/mark-failed`;
    const reason = action === 'reject' ? window.prompt('Rejection reason:') : null;
    if (action === 'reject' && !reason) return;
    setActionInProgress((s) => ({ ...s, [reqId]: action }));
    try {
      const payload = { request_id: reqId, admin_id: user?.uid };
      if (reason) payload.remark = reason;
      await axios.post(url, payload, { headers });
      toast.success(action === 'approve' ? 'Marked paid ✓' : 'Marked failed');
      setData((d) => d ? { ...d, requests: d.requests.filter((r) => r.request_id !== reqId) } : d);
    } catch (e) {
      toast.error(e.response?.data?.detail || `${action} failed`);
    } finally {
      setActionInProgress((s) => { const c = { ...s }; delete c[reqId]; return c; });
    }
  };

  const refresh = () => { setRefreshing(true); load(); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50 pb-24" data-testid="admin-first-payout-page">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <button onClick={() => window.history.back()} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-xs mb-2" data-testid="back-btn">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Bank Transfers
            </button>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Gift className="w-6 h-6 text-emerald-600" /> First Payout Priority Queue
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Get new users their first ₹{data?.threshold_inr?.toLocaleString('en-IN') || '1,000'} fast — build trust, prevent drop-off.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={refresh} disabled={refreshing} className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-1.5" data-testid="refresh-btn">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={() => setShowSettings((v) => !v)} className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-1.5" data-testid="settings-toggle">
              <Settings2 className="w-4 h-4" /> Settings
            </button>
          </div>
        </div>

        {/* Settings */}
        {showSettings && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm" data-testid="threshold-settings">
            <p className="text-slate-700 font-semibold text-sm mb-1">First Payout Threshold (₹)</p>
            <p className="text-slate-500 text-xs mb-3">Users with lifetime bank payout below this go to the priority queue. Leave empty to use env default.</p>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="0"
                max="5000"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                placeholder="1000"
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                data-testid="threshold-input"
              />
              <button
                onClick={saveThreshold}
                disabled={savingThreshold}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-1.5"
                data-testid="threshold-save"
              >
                {savingThreshold ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
              </button>
            </div>
          </div>
        )}

        {/* Stats bar */}
        {data && (
          <div className="grid grid-cols-3 gap-3" data-testid="stats-bar">
            <div className="bg-white border border-emerald-200 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">In Queue</p>
              <p className="text-2xl font-bold text-emerald-700 tabular-nums" data-testid="stat-total">{data.total_in_queue}</p>
            </div>
            <div className="bg-white border border-red-200 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-500" /> Waiting &gt; 3 days
              </p>
              <p className="text-2xl font-bold text-red-600 tabular-nums" data-testid="stat-urgent">{data.urgent_count}</p>
            </div>
            <div className="bg-white border border-amber-200 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <IndianRupee className="w-3 h-3" /> To Disburse
              </p>
              <p className="text-2xl font-bold text-amber-600 tabular-nums" data-testid="stat-amount">
                ₹{Number(data.total_amount_inr || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        )}

        {/* Queue */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          </div>
        ) : data?.requests?.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center" data-testid="queue-empty">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <p className="text-slate-800 font-bold">All caught up! 🎉</p>
            <p className="text-slate-500 text-sm mt-1">No new users pending first payout.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.requests.map((r) => {
              const busy = actionInProgress[r.request_id];
              return (
                <div
                  key={r.request_id}
                  className={`bg-white border rounded-2xl p-4 shadow-sm ${r.is_urgent ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200'}`}
                  data-testid={`queue-row-${r.request_id}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wider">
                        🎁 First Payout
                      </span>
                      {r.is_urgent && (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-red-100 text-red-700 font-bold uppercase flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {r.days_waiting}d waiting
                        </span>
                      )}
                      {!r.is_urgent && r.days_waiting > 0 && (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
                          {r.days_waiting}d ago
                        </span>
                      )}
                      {r.subscription_plan && (
                        <span className={`text-[10px] px-2 py-1 rounded-full font-medium uppercase ${r.is_subscription_active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                          {r.subscription_plan}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500">Lifetime bank paid</p>
                      <p className="text-xs font-mono text-slate-700 tabular-nums">
                        ₹{Number(r.lifetime_bank_paid_inr || 0).toLocaleString('en-IN')} / ₹{Number(data.threshold_inr).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>

                  {/* Bank details grid with copy buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-3 bg-slate-50 rounded-xl">
                    <CopyableField label="Name" value={r.account_holder_name || r.user_name} testId={`f-name-${r.request_id}`} />
                    <CopyableField label="Account No" value={r.account_number} testId={`f-acc-${r.request_id}`} />
                    <CopyableField label="IFSC" value={r.ifsc_code} testId={`f-ifsc-${r.request_id}`} />
                    <CopyableField label="Bank Name" value={r.bank_name} testId={`f-bank-${r.request_id}`} />
                    <CopyableField
                      label="Amount"
                      value={`₹${Number(r.withdrawal_amount || 0).toLocaleString('en-IN')}`}
                      testId={`f-amt-${r.request_id}`}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="text-xs text-slate-500">
                      <span className="font-semibold">{r.user_name}</span>
                      <span className="text-slate-400 mx-1.5">•</span>
                      <span className="font-mono">{r.user_phone}</span>
                      <span className="text-slate-400 mx-1.5">•</span>
                      <span className="font-mono text-[10px]">{r.request_id}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => doAction(r.request_id, 'approve')}
                        disabled={!!busy}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-semibold flex items-center gap-1"
                        data-testid={`approve-${r.request_id}`}
                      >
                        {busy === 'approve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Approve
                      </button>
                      <button
                        onClick={() => doAction(r.request_id, 'reject')}
                        disabled={!!busy}
                        className="px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-40 text-xs font-semibold flex items-center gap-1"
                        data-testid={`reject-${r.request_id}`}
                      >
                        {busy === 'reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFirstPayoutQueue;
