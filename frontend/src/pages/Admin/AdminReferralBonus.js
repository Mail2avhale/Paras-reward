// Admin — Referral Bonus Campaign (₹200 limited-time offer)
// Campaign config + report + CSV download + mark-paid + top referrers
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Gift, Settings, Calendar, RefreshCw, Download, CheckCircle,
  Trophy, Users, IndianRupee, X, Loader2, ChevronDown, Copy, Search, PlayCircle, AlertCircle,
} from 'lucide-react';
import { API } from '../../lib/api';

const currencyFmt = (n) => `₹ ${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const copy = (v, label) => {
  navigator.clipboard.writeText(v || '');
  toast.success(`${label} copied`);
};

const AdminReferralBonus = () => {
  const [campaign, setCampaign] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showBackfill, setShowBackfill] = useState(false);
  const [showDiagnose, setShowDiagnose] = useState(false);
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [topRefs, setTopRefs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

  const fetchCampaign = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/admin/referral-bonus/campaign`);
      setCampaign(data.campaign);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to load campaign'); }
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from_date', fromDate);
      if (toDate) params.set('to_date', toDate);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const { data } = await axios.get(`${API}/admin/referral-bonus/report?${params}`);
      setRows(data.rows || []);
      setTotals(data.totals || {});
      setSelectedIds([]);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to load report'); }
    finally { setLoading(false); }
  }, [fromDate, toDate, statusFilter]);

  const fetchSummary = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/admin/referral-bonus/summary`);
      setTopRefs(data.top_referrers || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchCampaign();
    fetchReport();
    fetchSummary();
  }, [fetchCampaign, fetchReport, fetchSummary]);

  const downloadCSV = () => {
    const params = new URLSearchParams();
    if (fromDate) params.set('from_date', fromDate);
    if (toDate) params.set('to_date', toDate);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    // Trigger download via new tab with axios auth header — use fetch since browsers can't attach headers on plain <a>
    const token = localStorage.getItem('token');
    fetch(`${API}/admin/referral-bonus/report/csv?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(b => {
        const url = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = url;
        a.download = `referral_bonus_${fromDate || 'all'}_${toDate || 'all'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV downloaded');
      })
      .catch(() => toast.error('Download failed'));
  };

  const togglePending = () => {
    const pending = rows.filter(r => r.status === 'pending').map(r => r.bonus_id);
    setSelectedIds(selectedIds.length === pending.length ? [] : pending);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto" data-testid="admin-referral-bonus-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Gift className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">Referral Bonus Campaign</h1>
            <p className="text-xs text-slate-500">₹200 to referrer on every NEW paid subscription (Razorpay + Manual only)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowDiagnose(true)} className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium" data-testid="diagnose-btn">
            <Search className="w-3.5 h-3.5" /> Diagnose User
          </button>
          <button onClick={() => setShowBackfill(true)} className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium" data-testid="backfill-btn">
            <PlayCircle className="w-3.5 h-3.5" /> Backfill
          </button>
          <button onClick={() => setShowConfig(true)} className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium" data-testid="campaign-config-btn">
            <Settings className="w-3.5 h-3.5" /> Campaign Config
          </button>
        </div>
      </div>

      {/* Campaign status banner */}
      {campaign && (
        <div className={`mb-4 rounded-xl p-4 border ${campaign.enabled ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-100 border-slate-200'}`} data-testid="campaign-status-banner">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${campaign.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {campaign.enabled ? 'Campaign LIVE' : 'Campaign PAUSED'}
                  <span className="ml-2 text-slate-500 font-normal text-xs">
                    Bonus: {currencyFmt(campaign.bonus_amount)}
                  </span>
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {campaign.start_date && campaign.end_date ? (
                    <>Duration: <span className="font-medium">{campaign.start_date}</span> → <span className="font-medium">{campaign.end_date}</span></>
                  ) : 'No date range set — will run indefinitely once enabled'}
                  {campaign.notes && <span className="ml-2 italic">• {campaign.notes}</span>}
                </p>
              </div>
            </div>
            <button onClick={fetchCampaign} className="p-1.5 hover:bg-slate-200 rounded" data-testid="refresh-campaign">
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
            </button>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard color="yellow" icon={Clock} label="Pending Payout" value={currencyFmt(totals.pending)} testid="stat-pending" />
        <StatCard color="emerald" icon={CheckCircle} label="Paid" value={currencyFmt(totals.paid)} testid="stat-paid" />
        <StatCard color="red" icon={X} label="Reversed" value={currencyFmt(totals.reversed)} testid="stat-reversed" />
        <StatCard color="blue" icon={IndianRupee} label="Grand Total" value={currencyFmt(totals.grand_total)} testid="stat-grand" />
      </div>

      {/* Top referrers */}
      {topRefs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5" data-testid="top-referrers">
          <h3 className="text-xs font-bold text-slate-600 uppercase mb-3 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-500" /> Top 10 Referrers
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {topRefs.map((r, i) => (
              <div key={r.referrer_uid} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold ${i < 3 ? 'bg-amber-500 text-slate-900' : 'bg-slate-200 text-slate-700'}`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{r.referrer_name || '—'}</p>
                    <p className="text-[10px] text-slate-500 truncate">{r.referrer_email}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-emerald-600">{currencyFmt(r.total_bonus)}</p>
                  <p className="text-[10px] text-slate-500">{r.activations} activation{r.activations > 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters + Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-3 flex flex-wrap items-center gap-2">
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder="From" className="px-2 py-1.5 border border-slate-200 rounded-md text-xs" data-testid="filter-from" />
        <span className="text-slate-400">→</span>
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} placeholder="To" className="px-2 py-1.5 border border-slate-200 rounded-md text-xs" data-testid="filter-to" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded-md text-xs" data-testid="filter-status">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="reversed">Reversed</option>
        </select>
        <button onClick={fetchReport} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-xs" data-testid="apply-filters">
          <RefreshCw className={`w-3 h-3 inline mr-1 ${loading ? 'animate-spin' : ''}`} /> Apply
        </button>
        <div className="flex-1" />
        <button onClick={downloadCSV} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-xs" data-testid="download-csv">
          <Download className="w-3 h-3 inline mr-1" /> Download CSV
        </button>
        {selectedIds.length > 0 && (
          <button onClick={() => setShowPayModal(true)} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-xs font-semibold" data-testid="mark-paid-btn">
            <CheckCircle className="w-3 h-3 inline mr-1" /> Mark {selectedIds.length} Paid
          </button>
        )}
      </div>

      {/* Report Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-xs" data-testid="bonus-table">
          <thead className="bg-slate-100 text-slate-700 sticky top-0">
            <tr>
              <th className="px-2 py-2 text-left w-8">
                <input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === rows.filter(r => r.status === 'pending').length} onChange={togglePending} data-testid="toggle-all" />
              </th>
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Referrer</th>
              <th className="px-2 py-2 text-left">Mobile</th>
              <th className="px-2 py-2 text-left">New User</th>
              <th className="px-2 py-2 text-left">Plan</th>
              <th className="px-2 py-2 text-left">Method</th>
              <th className="px-2 py-2 text-right">Bonus</th>
              <th className="px-2 py-2 text-left">Bank Details</th>
              <th className="px-2 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-10 text-sm text-slate-500">No bonus records match your filters.</td></tr>
            ) : rows.map(r => (
              <tr key={r.bonus_id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`bonus-row-${r.bonus_id}`}>
                <td className="px-2 py-2">
                  {r.status === 'pending' && (
                    <input type="checkbox" checked={selectedIds.includes(r.bonus_id)} onChange={() => setSelectedIds(prev => prev.includes(r.bonus_id) ? prev.filter(x => x !== r.bonus_id) : [...prev, r.bonus_id])} data-testid={`select-${r.bonus_id}`} />
                  )}
                </td>
                <td className="px-2 py-2 text-slate-700 font-mono">{(r.earned_at || '').slice(0, 10)}</td>
                <td className="px-2 py-2">
                  <p className="font-medium text-slate-900">{r.referrer_name || '—'}</p>
                  <p className="text-[10px] text-slate-500">{r.referrer_email}</p>
                </td>
                <td className="px-2 py-2">
                  <button onClick={() => copy(r.referrer_mobile, 'Mobile')} className="flex items-center gap-1 hover:text-emerald-600">
                    {r.referrer_mobile} <Copy className="w-2.5 h-2.5" />
                  </button>
                </td>
                <td className="px-2 py-2">
                  <p className="font-medium text-slate-900">{r.new_user_name || '—'}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{r.new_user_uid?.slice(0, 8)}</p>
                </td>
                <td className="px-2 py-2 capitalize text-slate-600">{r.subscription_plan}</td>
                <td className="px-2 py-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${r.payment_method === 'razorpay' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {r.payment_method === 'manual_activation' ? 'MANUAL' : 'RAZORPAY'}
                  </span>
                </td>
                <td className="px-2 py-2 text-right font-bold text-emerald-600">{currencyFmt(r.bonus_amount)}</td>
                <td className="px-2 py-2">
                  {r.referrer_bank_account ? (
                    <div className="text-[10px]">
                      <p className="font-mono">{r.referrer_bank_account} • {r.referrer_bank_ifsc}</p>
                      <p className="text-slate-500">{r.referrer_bank_name}</p>
                    </div>
                  ) : <span className="text-[10px] text-red-500 font-semibold">⚠ Missing</span>}
                </td>
                <td className="px-2 py-2">
                  <StatusPill status={r.status} />
                  {r.status === 'paid' && r.payout_reference && (
                    <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{r.payout_reference}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showConfig && <ConfigModal campaign={campaign} onClose={() => setShowConfig(false)} onSaved={() => { setShowConfig(false); fetchCampaign(); }} />}
      {showPayModal && <MarkPaidModal bonusIds={selectedIds} onClose={() => setShowPayModal(false)} onDone={() => { setShowPayModal(false); fetchReport(); }} />}
      {showBackfill && <BackfillModal onClose={() => setShowBackfill(false)} onDone={() => { setShowBackfill(false); fetchReport(); fetchSummary(); }} />}
      {showDiagnose && <DiagnoseModal onClose={() => setShowDiagnose(false)} />}
    </div>
  );
};

// Backfill Modal — retroactively credit bonuses on already-activated payments
const BackfillModal = ({ onClose, onDone }) => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    setBusy(true); setResult(null);
    try {
      const { data } = await axios.post(`${API}/admin/referral-bonus/backfill`, {
        from_date: fromDate || null, to_date: toDate || null, dry_run: dryRun,
      });
      setResult(data);
      toast.success(`${dryRun ? 'Dry-run' : 'Backfill'} complete — ${dryRun ? data.would_credit : data.credited} to credit, ${data.skipped} skipped`);
      if (!dryRun) onDone();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Backfill failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="backfill-modal">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Backfill Missing Bonuses</h3>
            <p className="text-xs text-slate-500">Retroactively credit ₹200 for already-activated users whose hook missed</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">From Date (optional)</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="backfill-from" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">To Date (optional)</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="backfill-to" />
          </div>
        </div>
        <label className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer">
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} data-testid="backfill-dry-run" />
          <div>
            <p className="text-xs font-semibold text-yellow-900">Dry Run</p>
            <p className="text-[10px] text-yellow-700">Preview what WOULD be credited without any DB writes. Uncheck to actually credit.</p>
          </div>
        </label>
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={run} disabled={busy} className={`px-4 py-2 text-sm rounded-lg font-semibold disabled:opacity-60 ${dryRun ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`} data-testid="backfill-run">
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : <>{dryRun ? 'Preview' : 'Credit Now'}</>}
          </button>
        </div>
        {result && (
          <div className="mt-4 border-t border-slate-200 pt-4 space-y-3" data-testid="backfill-result">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 rounded-lg p-2"><p className="text-[10px] text-slate-500">Scanned</p><p className="font-bold">{result.scanned}</p></div>
              <div className="bg-emerald-50 rounded-lg p-2"><p className="text-[10px] text-emerald-700">{result.dry_run ? 'Would Credit' : 'Credited'}</p><p className="font-bold text-emerald-700">{result.dry_run ? result.would_credit : result.credited}</p></div>
              <div className="bg-yellow-50 rounded-lg p-2"><p className="text-[10px] text-yellow-700">Skipped</p><p className="font-bold text-yellow-700">{result.skipped}</p></div>
            </div>
            {result.credited_list?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-700 mb-1">✓ {result.dry_run ? 'Would credit' : 'Credited'}:</p>
                <div className="max-h-40 overflow-y-auto text-[10px] bg-emerald-50 rounded-lg p-2 space-y-0.5">
                  {result.credited_list.map((c, i) => (
                    <div key={i}>• {c.name || c.user_id} → referrer: <span className="font-semibold">{c.referrer_name}</span> {c.amount && `(₹${c.amount})`}</div>
                  ))}
                </div>
              </div>
            )}
            {result.skipped_list?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-yellow-700 mb-1">⚠ Skipped:</p>
                <div className="max-h-40 overflow-y-auto text-[10px] bg-yellow-50 rounded-lg p-2 space-y-0.5">
                  {result.skipped_list.map((s, i) => (
                    <div key={i}>• {s.name || s.user_id?.slice(0, 12)}: {s.reason}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Diagnose Modal — check why a specific user didn't get their bonus
const DiagnoseModal = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);

  const run = async () => {
    if (!query.trim()) { toast.error('Enter user UID or email'); return; }
    setBusy(true); setData(null);
    try {
      const { data: d } = await axios.get(`${API}/admin/referral-bonus/diagnose/${encodeURIComponent(query.trim())}`);
      setData(d);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Not found'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="diagnose-modal">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Diagnose Missing Bonus</h3>
            <p className="text-xs text-slate-500">Check why a user didn&apos;t get their referral bonus credited</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="flex gap-2 mb-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder="User UID or email (e.g. franklinfashion9741@gmail.com)" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="diagnose-query" />
          <button onClick={run} disabled={busy} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-sm font-semibold disabled:opacity-60" data-testid="diagnose-run">
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Check'}
          </button>
        </div>
        {data && (
          <div className="border-t border-slate-200 pt-3 space-y-3" data-testid="diagnose-result">
            <div className={`p-3 rounded-lg ${data.would_credit_now ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={`text-sm font-bold ${data.would_credit_now ? 'text-emerald-800' : 'text-red-800'}`}>
                {data.would_credit_now ? '✓ Bonus SHOULD be credited (run Backfill)' : '✗ Bonus will NOT credit'}
              </p>
              <ul className="mt-2 text-xs space-y-1">
                {data.reasons.map((r, i) => (
                  <li key={i} className={data.would_credit_now ? 'text-emerald-700' : 'text-red-700'}>• {r}</li>
                ))}
              </ul>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold text-slate-700">User</summary>
              <pre className="bg-slate-50 p-2 rounded mt-1 overflow-x-auto text-[10px]">{JSON.stringify(data.user, null, 2)}</pre>
            </details>
            {data.referrer && (
              <details className="text-xs">
                <summary className="cursor-pointer font-semibold text-slate-700">Referrer</summary>
                <pre className="bg-slate-50 p-2 rounded mt-1 overflow-x-auto text-[10px]">{JSON.stringify(data.referrer, null, 2)}</pre>
              </details>
            )}
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold text-slate-700">Paid Subscriptions ({data.paid_subscriptions?.length || 0})</summary>
              <pre className="bg-slate-50 p-2 rounded mt-1 overflow-x-auto text-[10px]">{JSON.stringify(data.paid_subscriptions, null, 2)}</pre>
            </details>
            {data.existing_bonus && (
              <details className="text-xs">
                <summary className="cursor-pointer font-semibold text-emerald-700">Existing Bonus</summary>
                <pre className="bg-emerald-50 p-2 rounded mt-1 overflow-x-auto text-[10px]">{JSON.stringify(data.existing_bonus, null, 2)}</pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Clock = ({ className }) => (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>);

const StatCard = ({ color, icon: Icon, label, value, testid }) => {
  const bgs = { yellow: 'bg-yellow-100 text-yellow-600', emerald: 'bg-emerald-100 text-emerald-600', red: 'bg-red-100 text-red-600', blue: 'bg-blue-100 text-blue-600' };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3" data-testid={testid}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p>
        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${bgs[color]}`}><Icon className="w-3.5 h-3.5" /></div>
      </div>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
};

const StatusPill = ({ status }) => {
  const styles = { pending: 'bg-yellow-100 text-yellow-700', paid: 'bg-emerald-100 text-emerald-700', reversed: 'bg-red-100 text-red-700' };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${styles[status] || 'bg-slate-100 text-slate-700'}`}>{status?.toUpperCase()}</span>;
};

const ConfigModal = ({ campaign, onClose, onSaved }) => {
  const [form, setForm] = useState({
    enabled: campaign?.enabled || false,
    bonus_amount: campaign?.bonus_amount || 200,
    start_date: campaign?.start_date || '',
    end_date: campaign?.end_date || '',
    notes: campaign?.notes || '',
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await axios.put(`${API}/admin/referral-bonus/campaign`, form);
      toast.success('Campaign updated');
      onSaved();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Save failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()} data-testid="config-modal">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-slate-900">Campaign Config</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} data-testid="cfg-enabled" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Enable Campaign</p>
              <p className="text-[10px] text-slate-500">When ON, referral bonuses will be automatically credited on new paid subscriptions.</p>
            </div>
          </label>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Bonus Amount (₹)</label>
            <input type="number" value={form.bonus_amount} onChange={(e) => setForm({ ...form, bonus_amount: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="cfg-amount" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Start Date</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="cfg-start" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">End Date</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="cfg-end" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Notes (internal)</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" placeholder="e.g. Diwali launch bonus" data-testid="cfg-notes" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={save} disabled={busy} className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg font-semibold disabled:opacity-60" data-testid="cfg-save">
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

const MarkPaidModal = ({ bonusIds, onClose, onDone }) => {
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/admin/referral-bonus/mark-paid`, { bonus_ids: bonusIds, payout_reference: ref });
      toast.success(`${data.marked_paid} bonuses marked paid`);
      onDone();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()} data-testid="mark-paid-modal">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-slate-900">Mark {bonusIds.length} Bonus{bonusIds.length !== 1 ? 'es' : ''} Paid</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Payout Reference (NEFT UTR / Transaction ID)</label>
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. HDFC/N/12345678 or optional" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="pay-ref" />
            <p className="text-[10px] text-slate-500 mt-1">Enter the bank NEFT reference or leave empty. This will be stored against each bonus.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={submit} disabled={busy} className="px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold disabled:opacity-60" data-testid="pay-confirm">
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Confirm Paid'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminReferralBonus;
