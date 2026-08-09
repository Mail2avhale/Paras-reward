// Careers module — Reports tab: HR analytics dashboard + Separations workflow (spec §49-50, §69)
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  BarChart3, LogOut, RefreshCw, Loader2, Plus, X, Eye,
  Clock, TrendingUp, CheckCircle, Download, AlertCircle,
} from 'lucide-react';
import { API } from '../../../lib/api';

const ReportsTab = ({ adminId, employees, onNeedEmployees }) => {
  const [sub, setSub] = useState('analytics');
  useEffect(() => { if (employees.length === 0) onNeedEmployees && onNeedEmployees(); }, [employees.length, onNeedEmployees]);
  return (
    <div>
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-4 max-w-md">
        {[['analytics', 'HR Analytics', BarChart3], ['separations', 'Separations', LogOut]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setSub(id)} className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-md text-xs font-medium ${sub === id ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`} data-testid={`reports-sub-${id}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      {sub === 'analytics' && <AnalyticsPane />}
      {sub === 'separations' && <SeparationsPane employees={employees} adminId={adminId} />}
    </div>
  );
};

const AnalyticsPane = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ from: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/public/reports/hr-dashboard?from_date=${range.from}&to_date=${range.to}`);
      setData(r.data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  }, [range]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto my-8" />;
  if (!data) return <div className="text-center py-8 text-slate-500 text-sm" data-testid="analytics-empty">No report available.</div>;

  const t = data.totals || {};
  return (
    <div className="space-y-4" data-testid="analytics-pane">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" data-testid="analytics-from" />
        <input type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" data-testid="analytics-to" />
        <button onClick={load} className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700" data-testid="analytics-refresh"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          ['Applications', t.applications, 'bg-blue-500/10 text-blue-700'],
          ['Active Employees', t.active_employees, 'bg-emerald-500/10 text-emerald-700'],
          ['Open Jobs', t.open_jobs, 'bg-purple-500/10 text-purple-700'],
          ['Total Vacancies', t.total_vacancies, 'bg-amber-500/10 text-amber-700'],
          ['Filled', t.vacancies_filled, 'bg-teal-500/10 text-teal-700'],
          ['Remaining', t.vacancies_remaining, 'bg-fuchsia-500/10 text-fuchsia-700'],
        ].map(([label, val, cls], i) => (
          <div key={i} className={`p-3 rounded-lg ${cls}`} data-testid={`kpi-${label.toLowerCase().replace(/ /g, '-')}`}>
            <p className="text-[10px] uppercase font-semibold">{label}</p>
            <p className="text-2xl font-bold">{val ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Time-to-hire + attrition */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-lg" data-testid="time-to-hire-card">
          <p className="text-xs text-slate-500 uppercase font-semibold">Avg Time-to-Hire</p>
          <p className="text-2xl font-bold text-slate-900 flex items-baseline gap-1"><Clock className="w-5 h-5 text-slate-400" /> {data.time_to_hire?.average_days ?? 0} <span className="text-sm font-normal text-slate-500">days</span></p>
          <p className="text-[11px] text-slate-500">sample: {data.time_to_hire?.sample_size ?? 0}</p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg" data-testid="attrition-card">
          <p className="text-xs text-slate-500 uppercase font-semibold">Attrition</p>
          <p className="text-2xl font-bold text-slate-900 flex items-baseline gap-1"><TrendingUp className="w-5 h-5 text-slate-400" /> {data.attrition?.attrition_pct ?? 0}<span className="text-sm font-normal text-slate-500">%</span></p>
          <p className="text-[11px] text-slate-500">separated: {data.attrition?.separated_in_range ?? 0}</p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg" data-testid="pending-actions-card">
          <p className="text-xs text-slate-500 uppercase font-semibold">Pending HR Actions</p>
          <div className="mt-1 space-y-0.5 text-xs">
            {Object.entries(data.pending_hr_actions || {}).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-slate-600">{k.replace(/_/g, ' ')}</span>
                <span className="font-semibold text-slate-900">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Funnel */}
      <div className="p-3 bg-white border border-slate-200 rounded-lg" data-testid="funnel-card">
        <p className="text-sm font-semibold text-slate-900 mb-2">Recruitment Funnel</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(data.recruitment_funnel || {}).sort((a, b) => b[1] - a[1]).map(([s, c]) => (
            <span key={s} className="px-2 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700" data-testid={`funnel-${s}`}>
              {s.replace(/_/g, ' ')}: <span className="font-bold text-slate-900">{c}</span>
            </span>
          ))}
          {!Object.keys(data.recruitment_funnel || {}).length && <p className="text-xs text-slate-500">No applications in range.</p>}
        </div>
      </div>

      {/* Source ROI */}
      <div className="p-3 bg-white border border-slate-200 rounded-lg" data-testid="source-roi-card">
        <p className="text-sm font-semibold text-slate-900 mb-2">Recruitment Source ROI</p>
        {(data.source_roi || []).length === 0 ? <p className="text-xs text-slate-500">No source data yet.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr><th className="px-2 py-1.5 text-left">Source</th><th className="px-2 py-1.5 text-left">Applications</th><th className="px-2 py-1.5 text-left">Joined</th><th className="px-2 py-1.5 text-left">Conversion</th></tr>
            </thead>
            <tbody>
              {data.source_roi.map((s, i) => (
                <tr key={`${s.source}-${i}`} className="border-b border-slate-100" data-testid={`source-row-${s.source}`}>
                  <td className="px-2 py-1.5 text-slate-800">{s.source}</td>
                  <td className="px-2 py-1.5 text-slate-700">{s.applications}</td>
                  <td className="px-2 py-1.5 text-slate-700">{s.joined}</td>
                  <td className="px-2 py-1.5 text-slate-700">{s.conversion_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Department distribution */}
      <div className="p-3 bg-white border border-slate-200 rounded-lg" data-testid="departments-card">
        <p className="text-sm font-semibold text-slate-900 mb-2">Headcount by Department</p>
        {(data.headcount_by_department || []).length === 0 ? <p className="text-xs text-slate-500">No employees yet.</p> : (
          <div className="flex flex-wrap gap-1.5">
            {data.headcount_by_department.map(d => (
              <span key={d.department} className="px-2 py-1 rounded-full text-[11px] bg-slate-100 text-slate-700" data-testid={`dept-${d.department}`}>{d.department}: <span className="font-bold text-slate-900">{d.count}</span></span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const SeparationsPane = ({ employees, adminId }) => {
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [showInit, setShowInit] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = statusFilter ? `?status=${statusFilter}` : '';
      const r = await axios.get(`${API}/public/separations${p}`);
      setRows(r.data?.separations || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [statusFilter]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" data-testid="sep-status-filter">
          <option value="">All statuses</option>
          {['initiated', 'in_clearance', 'cleared', 'fnf_calculated', 'fnf_paid', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700" data-testid="sep-refresh"><RefreshCw className="w-4 h-4" /> Refresh</button>
        <button onClick={() => setShowInit(true)} className="ml-auto flex items-center gap-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm" data-testid="sep-initiate-btn"><Plus className="w-4 h-4" /> Initiate Separation</button>
      </div>
      {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" /> : rows.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm" data-testid="sep-empty">No separations for this filter.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="sep-table">
            <thead className="bg-slate-100 text-slate-700">
              <tr><th className="px-3 py-2 text-left">ID</th><th className="px-3 py-2 text-left">Employee</th><th className="px-3 py-2 text-left">Kind</th><th className="px-3 py-2 text-left">LWD</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.separation_id} className="border-b border-slate-200 hover:bg-slate-50" data-testid={`sep-row-${r.separation_id}`}>
                  <td className="px-3 py-2 text-[11px] font-mono text-slate-500">{r.separation_id}</td>
                  <td className="px-3 py-2 text-slate-800">{r.employee_name}<br /><span className="text-[11px] text-slate-500 font-mono">{r.employee_id}</span></td>
                  <td className="px-3 py-2 text-slate-700">{r.kind}</td>
                  <td className="px-3 py-2 text-slate-700">{r.actual_last_working_day || r.requested_last_working_day || '—'}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[11px] uppercase font-semibold ${r.status === 'completed' ? 'bg-emerald-500/20 text-emerald-700' : r.status === 'cancelled' ? 'bg-slate-300 text-slate-700' : 'bg-amber-500/20 text-amber-700'}`}>{r.status.replace(/_/g, ' ')}</span></td>
                  <td className="px-3 py-2 text-right"><button onClick={() => setDetail(r)} className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded" data-testid={`sep-open-${r.separation_id}`}><Eye className="w-3.5 h-3.5" /> Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detail && (
        <SeparationDetailModal separation={detail} adminId={adminId} onClose={() => setDetail(null)} onRefresh={() => { setDetail(null); load(); }} />
      )}
      {showInit && (
        <SeparationInitModal employees={employees} adminId={adminId} onClose={() => setShowInit(false)} onSaved={() => { setShowInit(false); load(); }} />
      )}
    </div>
  );
};

const SeparationInitModal = ({ employees, adminId, onClose, onSaved }) => {
  const [form, setForm] = useState({ employee_id: '', kind: 'resignation', reason: '', notice_period_days: 30, requested_last_working_day: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.employee_id) return toast.error('Select an employee');
    setSaving(true);
    try {
      await axios.post(`${API}/public/separations/initiate`, { ...form, notice_period_days: Number(form.notice_period_days), requested_last_working_day: form.requested_last_working_day || null, admin_id: adminId });
      toast.success('Separation initiated');
      onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-4" onClick={e => e.stopPropagation()} data-testid="sep-init-modal">
        <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-900">Initiate Separation</h3><button onClick={onClose} className="text-slate-500"><X className="w-5 h-5" /></button></div>
        <div className="space-y-2">
          <select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="sep-init-employee">
            <option value="">Select employee…</option>
            {employees.filter(e => e.status === 'active').map(e => <option key={e.employee_id} value={e.employee_id}>{e.name} ({e.employee_id})</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="sep-init-kind">
              {['resignation', 'termination', 'retirement', 'end_of_contract', 'absconding'].map(k => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
            </select>
            <input type="number" value={form.notice_period_days} onChange={e => setForm(f => ({ ...f, notice_period_days: e.target.value }))} placeholder="Notice days" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="sep-init-notice" />
          </div>
          <input type="date" value={form.requested_last_working_day} onChange={e => setForm(f => ({ ...f, requested_last_working_day: e.target.value }))} placeholder="Last working day" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="sep-init-lwd" />
          <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason" rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="sep-init-reason" />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm" data-testid="sep-init-save">{saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Initiate'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SeparationDetailModal = ({ separation, adminId, onClose, onRefresh }) => {
  const [sep, setSep] = useState(separation);
  const [busy, setBusy] = useState(false);
  const [fnfForm, setFnfForm] = useState({ gross_dues: '', deductions: '' });

  const reload = async () => {
    try {
      const r = await axios.get(`${API}/public/separations/${sep.separation_id}`);
      setSep(r.data.separation);
    } catch { /* */ }
  };

  const toggleClearance = async (item, done) => {
    setBusy(true);
    try {
      await axios.patch(`${API}/public/separations/${sep.separation_id}/clearance/${item}`, { done, admin_id: adminId });
      await reload();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };
  const calcFnf = async () => {
    if (!fnfForm.gross_dues) return toast.error('Gross dues required');
    setBusy(true);
    try {
      await axios.post(`${API}/public/separations/${sep.separation_id}/fnf`, { gross_dues: Number(fnfForm.gross_dues), deductions: Number(fnfForm.deductions) || 0, admin_id: adminId });
      toast.success('F&F calculated');
      await reload();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };
  const markPaid = async () => {
    setBusy(true);
    try {
      await axios.post(`${API}/public/separations/${sep.separation_id}/pay`, { payment_reference: window.prompt('Payment reference?') || '', admin_id: adminId });
      toast.success('Marked paid');
      await reload();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };
  const complete = async () => {
    if (!window.confirm('Complete separation? This will issue the experience letter and mark employee as separated.')) return;
    setBusy(true);
    try {
      await axios.post(`${API}/public/separations/${sep.separation_id}/complete`, { admin_id: adminId });
      toast.success('Separation completed');
      onRefresh();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };

  const canFnf = ['cleared', 'in_clearance', 'fnf_calculated'].includes(sep.status);
  const canPay = sep.status === 'fnf_calculated';
  const canComplete = ['fnf_paid', 'cleared', 'fnf_calculated'].includes(sep.status);

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="sep-detail-modal">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-900">{sep.employee_name} — Separation</h3>
            <p className="text-xs text-slate-500 font-mono">{sep.separation_id} • {sep.kind} • status: <span className="font-semibold text-slate-800">{sep.status}</span></p>
          </div>
          <button onClick={onClose} className="text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-900 mb-2">Clearance Checklist</p>
            <div className="space-y-1.5">
              {(sep.clearances || []).map(c => (
                <label key={c.item} className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer" data-testid={`sep-clr-${c.item}`}>
                  <input type="checkbox" checked={c.done} disabled={busy} onChange={e => toggleClearance(c.item, e.target.checked)} data-testid={`sep-clr-chk-${c.item}`} />
                  <div className="flex-1">
                    <p className={`text-sm ${c.done ? 'text-slate-400 line-through' : 'text-slate-800 font-medium'}`}>{c.owner}</p>
                    <p className="text-[11px] text-slate-500">{c.description}</p>
                  </div>
                  {c.done_at && <span className="text-[10px] text-slate-400">{c.done_at.slice(0, 10)}</span>}
                </label>
              ))}
            </div>
          </div>

          <div className="p-3 border border-slate-200 rounded-lg" data-testid="sep-fnf-card">
            <p className="text-sm font-semibold text-slate-900 mb-2">Full &amp; Final Settlement</p>
            {sep.fnf ? (
              <div className="text-sm text-slate-700 space-y-1">
                <p>Gross Dues: <span className="font-semibold">₹ {sep.fnf.gross_dues?.toLocaleString()}</span></p>
                <p>Deductions: <span className="font-semibold">₹ {sep.fnf.deductions?.toLocaleString()}</span></p>
                <p>Net Payable: <span className="font-semibold text-emerald-600">₹ {sep.fnf.net_payable?.toLocaleString()}</span></p>
                <p className="text-[11px] text-slate-500">Status: {sep.fnf.status} {sep.fnf.paid_at && `• Paid ${sep.fnf.paid_at.slice(0, 10)}`}</p>
                {canPay && <button onClick={markPaid} disabled={busy} className="mt-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 rounded-lg text-xs" data-testid="sep-mark-paid">Mark as Paid</button>}
              </div>
            ) : canFnf ? (
              <div className="grid grid-cols-3 gap-2">
                <input type="number" value={fnfForm.gross_dues} onChange={e => setFnfForm(f => ({ ...f, gross_dues: e.target.value }))} placeholder="Gross dues" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="sep-fnf-gross" />
                <input type="number" value={fnfForm.deductions} onChange={e => setFnfForm(f => ({ ...f, deductions: e.target.value }))} placeholder="Deductions" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="sep-fnf-deductions" />
                <button onClick={calcFnf} disabled={busy} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm" data-testid="sep-fnf-calc-btn">Calculate</button>
              </div>
            ) : (
              <p className="text-xs text-slate-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Complete at least one clearance before calculating F&amp;F.</p>
            )}
          </div>

          {canComplete && (
            <button onClick={complete} disabled={busy} className="w-full px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold" data-testid="sep-complete-btn">
              Complete Separation &amp; Issue Experience Letter
            </button>
          )}
          {sep.experience_letter_id && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center gap-2" data-testid="sep-letter-issued">
              <CheckCircle className="w-4 h-4" /> Experience letter issued: <span className="font-mono">{sep.experience_letter_id}</span>
              <a href={`${API}/public/employees/${sep.employee_id}/letters/${sep.experience_letter_id}/pdf`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs bg-white/60 hover:bg-white rounded" data-testid="sep-letter-download">
                <Download className="w-3.5 h-3.5" /> PDF
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { ReportsTab };
