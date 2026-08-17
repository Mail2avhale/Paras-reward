// Admin — PRC Redemption Service Charge Dashboard (Phase 3)
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { IndianRupee, Search, CheckCircle, Clock, Loader2, RefreshCw, X, ShieldAlert } from 'lucide-react';
import { API } from '../../lib/api';

const fmt = (n) => `₹ ${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const AdminServiceCharges = () => {
  const [summary, setSummary] = useState({ by_status: {} });
  const [pending, setPending] = useState([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);
  const [modal, setModal] = useState(null);   // manual-mark-paid modal
  const [reverseModal, setReverseModal] = useState(null);
  const [report, setReport] = useState({ series: [], total_revenue: 0, total_count: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, r] = await Promise.all([
        axios.get(`${API}/admin/redemption-service-charge/summary?days=${days}`),
        axios.get(`${API}/admin/redemption-service-charge/pending?limit=100`),
        axios.get(`${API}/admin/redemption-service-charge/revenue-report?days=${days}`).catch(() => ({ data: null })),
      ]);
      setSummary(s.data);
      setPending(p.data.pending || []);
      if (r.data) setReport(r.data);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Load failed'); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const doSearch = async () => {
    if (!search.trim()) return;
    try {
      const { data } = await axios.get(`${API}/admin/redemption-service-charge/search?q=${encodeURIComponent(search.trim())}`);
      setResults(data.results || []);
      if ((data.results || []).length === 0) toast.info('No results');
    } catch (e) { toast.error(e?.response?.data?.detail || 'Search failed'); }
  };

  const rows = search.trim() && results.length > 0 ? results : pending;
  const bs = summary.by_status || {};

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto" data-testid="admin-svc-charges-page">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <IndianRupee className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">Redemption Service Charges</h1>
            <p className="text-xs text-slate-500">20% cash fee on completed PRC redemptions · Revenue tracker</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="px-2 py-1.5 border border-slate-200 rounded-md text-xs" data-testid="days-filter">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button onClick={load} className="p-2 rounded-lg bg-white border border-slate-200" data-testid="refresh-btn">
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Revenue cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card color="yellow" icon={Clock} label="Pending" count={bs.PENDING?.count || 0} amount={bs.PENDING?.amount || 0} testid="stat-pending" />
        <Card color="emerald" icon={CheckCircle} label="Paid (Revenue)" count={bs.PAID?.count || 0} amount={bs.PAID?.amount || 0} testid="stat-paid" />
        <Card color="slate" icon={IndianRupee} label="Total Charges" count={(bs.PENDING?.count || 0) + (bs.PAID?.count || 0)} amount={(bs.PENDING?.amount || 0) + (bs.PAID?.amount || 0)} testid="stat-total" />
        <Card color="blue" icon={IndianRupee} label="Collection Rate" count={0} amount={0} customValue={`${((bs.PAID?.count || 0) / Math.max(1, (bs.PAID?.count || 0) + (bs.PENDING?.count || 0)) * 100).toFixed(0)}%`} testid="stat-rate" />
      </div>

      {/* Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-3 flex flex-wrap items-center gap-2">
        <Search className="w-4 h-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} placeholder="Search by user_id / mobile / redemption_id / charge_id / payment_id" className="flex-1 min-w-[200px] px-2 py-1 border-0 outline-none text-xs" data-testid="search-input" />
        <button onClick={doSearch} className="px-3 py-1.5 bg-slate-800 text-white rounded-md text-xs" data-testid="search-btn">Search</button>
        {search && <button onClick={() => { setSearch(''); setResults([]); }} className="text-xs text-slate-500 hover:underline">Clear</button>}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-xs" data-testid="charges-table">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-2 py-2 text-left">Charge ID</th>
              <th className="px-2 py-2 text-left">User</th>
              <th className="px-2 py-2 text-right">PRC</th>
              <th className="px-2 py-2 text-right">Value</th>
              <th className="px-2 py-2 text-right">Fee</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-left">Redemption</th>
              <th className="px-2 py-2 text-left">Created</th>
              <th className="px-2 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-slate-500">{loading ? 'Loading...' : 'No records'}</td></tr>
            ) : rows.map(r => (
              <tr key={r.charge_id} className="border-b border-slate-100" data-testid={`row-${r.charge_id}`}>
                <td className="px-2 py-2 font-mono text-slate-600">{r.charge_id}</td>
                <td className="px-2 py-2">
                  <p className="font-medium">{r.user?.name || '—'}</p>
                  <p className="text-[10px] text-slate-400">{r.user?.mobile || r.user_id?.slice(0, 12)}</p>
                </td>
                <td className="px-2 py-2 text-right">{r.prc_amount}</td>
                <td className="px-2 py-2 text-right">{fmt(r.redemption_value_inr)}</td>
                <td className="px-2 py-2 text-right font-bold text-emerald-600">{fmt(r.service_charge_amount)}</td>
                <td className="px-2 py-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${r.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.status}</span>
                </td>
                <td className="px-2 py-2 font-mono text-[10px] text-slate-500">{r.redemption_id?.slice(0, 15)}</td>
                <td className="px-2 py-2 text-slate-500">{(r.created_at || '').slice(0, 10)}</td>
                <td className="px-2 py-2 text-right">
                  {r.status === 'PENDING' && (
                    <button onClick={() => setModal(r)} className="text-xs text-amber-600 hover:underline flex items-center gap-1" data-testid={`manual-${r.charge_id}`}>
                      <ShieldAlert className="w-3 h-3" /> Mark Paid
                    </button>
                  )}
                  {r.status === 'PAID' && (
                    <button onClick={() => setReverseModal(r)} className="text-xs text-red-600 hover:underline flex items-center gap-1" data-testid={`reverse-${r.charge_id}`}>
                      <ShieldAlert className="w-3 h-3" /> Reverse
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && <ManualPaidModal charge={modal} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
      {reverseModal && <ReverseModal charge={reverseModal} onClose={() => setReverseModal(null)} onDone={() => { setReverseModal(null); load(); }} />}

      {/* Revenue mini-chart (last {days} days) */}
      <div className="mt-4 bg-white border border-slate-200 rounded-xl p-3" data-testid="revenue-chart">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase">Revenue Timeseries</h3>
            <p className="text-[10px] text-slate-500">₹{Number(report.total_revenue).toLocaleString('en-IN')} across {report.total_count} paid charges · last {days}d</p>
          </div>
        </div>
        <div className="flex items-end gap-0.5 h-24 mt-2">
          {(report.series || []).length === 0 ? (
            <p className="text-xs text-slate-400 self-center mx-auto">No paid charges in this window</p>
          ) : (report.series.map((pt) => {
            const max = Math.max(1, ...report.series.map((s) => s.revenue));
            const h = Math.max(4, (pt.revenue / max) * 90);
            return (
              <div key={pt.date} className="flex-1 flex flex-col items-center group relative">
                <div className="w-full bg-emerald-500 rounded-t hover:bg-emerald-600 transition-colors" style={{ height: `${h}px` }} />
                <span className="text-[8px] text-slate-400 mt-0.5">{pt.date.slice(5)}</span>
                <div className="absolute -top-6 hidden group-hover:block bg-slate-900 text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap">
                  ₹{pt.revenue.toLocaleString('en-IN')} · {pt.count}
                </div>
              </div>
            );
          }))}
        </div>
      </div>
    </div>
  );
};

const Card = ({ color, icon: Icon, label, count, amount, customValue, testid }) => {
  const bgs = { yellow: 'bg-yellow-100 text-yellow-600', emerald: 'bg-emerald-100 text-emerald-600', slate: 'bg-slate-100 text-slate-600', blue: 'bg-blue-100 text-blue-600' };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3" data-testid={testid}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase font-semibold text-slate-500">{label}</p>
        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${bgs[color]}`}><Icon className="w-3.5 h-3.5" /></div>
      </div>
      <p className="text-lg font-bold text-slate-900">{customValue || fmt(amount)}</p>
      {!customValue && <p className="text-[10px] text-slate-500">{count} charge{count !== 1 ? 's' : ''}</p>}
    </div>
  );
};

export default AdminServiceCharges;

const ManualPaidModal = ({ charge, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [ref, setRef] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (reason.length < 5) { toast.error('Reason must be 5+ chars'); return; }
    if (!pin) { toast.error('Finance PIN required'); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/admin/redemption-service-charge/manual-mark-paid`,
        { charge_id: charge.charge_id, reason, admin_id: 'admin', external_reference: ref },
        { headers: { 'X-Finance-Pin': pin } },
      );
      toast.success('Marked paid (audit logged)');
      onDone();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()} data-testid="manual-paid-modal">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Manual Mark Paid</h3>
            <p className="text-xs text-slate-500">{charge.charge_id} · {fmt(charge.total_payable)}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Finance PIN (X-Finance-Pin)</label>
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="finance-pin" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Reason (audit log)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" placeholder="e.g. Received cash / offline UPI / partial reconciliation" data-testid="reason-input" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">External Reference (optional)</label>
            <input value={ref} onChange={(e) => setRef(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Bank UTR / receipt no." data-testid="ref-input" />
          </div>
        </div>
        <p className="text-[10px] text-red-600 mt-3">
          This bypasses Razorpay verification. Only for reconciled offline payments. Fully audit-logged.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={submit} disabled={busy} className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold disabled:opacity-60" data-testid="submit-manual">
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Confirm Mark Paid'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ReverseModal = ({ charge, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [ref, setRef] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (reason.length < 5) { toast.error('Reason must be 5+ chars'); return; }
    if (!pin) { toast.error('Finance PIN required'); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/admin/redemption-service-charge/reverse`,
        { charge_id: charge.charge_id, reason, admin_id: 'admin', refund_reference: ref },
        { headers: { 'X-Finance-Pin': pin } },
      );
      toast.success('Charge reversed (refund logged)');
      onDone();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Reversal failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()} data-testid="reverse-modal">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-base font-bold text-red-700">Reverse / Refund Service Charge</h3>
            <p className="text-xs text-slate-500">{charge.charge_id} · {fmt(charge.total_payable)}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Finance PIN</label>
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="reverse-pin" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Reason for reversal (audit)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" placeholder="e.g. Duplicate charge / mis-calculation / customer complaint approved" data-testid="reverse-reason" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Refund reference (Razorpay refund_id / bank UTR)</label>
            <input value={ref} onChange={(e) => setRef(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="reverse-ref" />
          </div>
        </div>
        <p className="text-[10px] text-red-600 mt-3">
          Reversing marks the charge REFUNDED and notifies the user. Actual bank/Razorpay refund must be done separately.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={submit} disabled={busy} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold disabled:opacity-60" data-testid="submit-reverse">
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Confirm Reverse'}
          </button>
        </div>
      </div>
    </div>
  );
};

