import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, Search, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { API } from '../../../lib/api';

const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('en-IN');
const SERVICE_LABEL = { mobile: 'Mobile Recharge', dth: 'DTH Recharge', mobile_recharge: 'Mobile Recharge', dish_recharge: 'DTH Recharge' };

const Stat = ({ label, value, tone, testId }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
    <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
    <p data-testid={testId} className={`text-base font-bold ${tone}`}>{value}</p>
  </div>
);

const RefundAuditPanel = () => {
  const [run, setRun] = useState(null);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState(null);

  const load = useCallback(async () => {
    const r = (await axios.get(`${API}/admin/refund-audit/latest`)).data.run;
    setRun(r);
    if (r && r.status !== 'running') {
      const it = await axios.get(`${API}/admin/refund-audit/items`, { params: { run_id: r.run_id, category: 'missing', limit: 100 } });
      setItems(it.data.items || []);
    }
    return r;
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  useEffect(() => {
    if (run?.status !== 'running') return undefined;
    const t = setInterval(() => load().catch(() => {}), 4000);
    return () => clearInterval(t);
  }, [run?.status, load]);

  const start = async (apply) => {
    if (apply && !window.confirm('Refund PRC for ALL failed transactions that were never refunded? Each transaction is refunded only once.')) return;
    setBusy(true);
    try {
      await axios.post(`${API}/admin/refund-audit/run`, { apply });
      toast.success(apply ? 'Refund run started' : 'Scan started');
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not start');
    } finally {
      setBusy(false);
    }
  };

  const refundOne = async (it) => {
    setRowBusy(it.request_id);
    try {
      const res = await axios.post(`${API}/admin/refund-audit/refund-one`, { collection: it.collection, request_id: it.request_id });
      toast.success(`${fmt(res.data.amount)} PRC refunded`);
      setItems((xs) => xs.map((x) => (x.request_id === it.request_id ? { ...x, action: 'refunded' } : x)));
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Refund failed');
    } finally {
      setRowBusy(null);
    }
  };

  const s = run?.summary || {};
  const running = run?.status === 'running';
  const pendingItems = items.filter((i) => i.action !== 'refunded');

  return (
    <div data-testid="refund-audit-panel" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /> Failed Transaction Refund Audit</h3>
          <p className="text-xs text-slate-500">
            Auto-runs every 2 hours. Last run: {run ? `${new Date(run.started_at).toLocaleString('en-IN')} · ${run.auto ? 'Auto' : run.apply ? 'Refund run' : 'Scan only'} · ${run.status}` : 'never'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={busy || running} onClick={() => start(false)} data-testid="refund-audit-scan-btn">
            {running ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />} Scan
          </Button>
          <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white" disabled={busy || running} onClick={() => start(true)} data-testid="refund-audit-apply-btn">
            <RefreshCw className="h-4 w-4 mr-1" /> Refund All Missing
          </Button>
        </div>
      </div>

      {run && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
          <Stat label="Found not refunded" value={`${s.missing || 0} · ${fmt(s.missing_prc)} PRC`} tone="text-red-600" testId="audit-missing" />
          <Stat label="Refunded this run" value={`${s.refunded_now || 0} · ${fmt(s.refunded_now_prc)} PRC`} tone="text-emerald-600" testId="audit-refunded-now" />
          <Stat label="Already refunded" value={s.already_refunded || 0} tone="text-slate-800" testId="audit-already" />
          <Stat label="Needs review" value={s.review || 0} tone="text-amber-600" testId="audit-review" />
          <Stat label="Eko refund pending" value={s.refund_pending || 0} tone="text-slate-800" testId="audit-refund-pending" />
          <Stat label="Stuck checked (Eko)" value={`${s.stuck_checked || 0} · ${s.stuck_failed || 0} failed`} tone="text-slate-800" testId="audit-stuck" />
        </div>
      )}

      {!running && pendingItems.length > 0 && (
        <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-600 sticky top-0">
              <tr><th className="text-left p-2">User</th><th className="text-left p-2">Service</th><th className="text-left p-2">Date</th><th className="text-right p-2">PRC</th><th className="p-2" /></tr>
            </thead>
            <tbody>
              {pendingItems.map((it) => (
                <tr key={`${it.collection}-${it.request_id}`} className="border-t border-slate-100" data-testid={`audit-row-${it.request_id}`}>
                  <td className="p-2">{it.user_name || it.user_id}<div className="text-slate-400">{it.user_mobile}</div></td>
                  <td className="p-2">{SERVICE_LABEL[it.service] || String(it.service || '-').replace(/_/g, ' ')}<div className="text-slate-400">{it.status} · ₹{it.amount_inr || '-'}</div></td>
                  <td className="p-2">{it.created_at ? new Date(it.created_at).toLocaleDateString('en-IN') : '-'}</td>
                  <td className="p-2 text-right font-bold text-red-600">{fmt(it.prc_amount)}</td>
                  <td className="p-2 text-right">
                    <Button size="sm" className="h-7 bg-red-500 hover:bg-red-600 text-white" disabled={rowBusy === it.request_id} onClick={() => refundOne(it)} data-testid={`audit-row-refund-${it.request_id}`}>
                      {rowBusy === it.request_id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refund'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!running && run && pendingItems.length === 0 && (
        <p data-testid="audit-all-clear" className="text-sm text-emerald-700 font-semibold">
          All failed transactions in the last scan are refunded.{s.review ? ` ${s.review} need manual review.` : ''}
        </p>
      )}
    </div>
  );
};

export default RefundAuditPanel;
