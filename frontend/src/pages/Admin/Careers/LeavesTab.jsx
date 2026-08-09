// Careers module — Leave requests tab (spec §43)
import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { RefreshCw, Check, X } from 'lucide-react';
import { API } from '../../../lib/api';

const LeavesTab = ({ leaves, status, setStatus, onRefresh, adminId }) => {
  const [busy, setBusy] = useState(null);
  const decide = async (leave_id, action) => {
    const comment = action === 'reject' ? (window.prompt('Reason for rejection?') || '') : '';
    setBusy(leave_id);
    try {
      await axios.post(`${API}/public/leaves/${leave_id}/decision`, { action, approver: adminId, comment });
      toast.success(`Leave ${action}d`);
      onRefresh();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setBusy(null); }
  };
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" data-testid="leaves-status-filter">
          <option value="">All</option>
          {['requested', 'approved', 'rejected', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={onRefresh} className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700" data-testid="leaves-refresh"><RefreshCw className="w-4 h-4" /> Refresh</button>
        <p className="ml-auto text-sm text-slate-500">Total: <span className="font-semibold text-slate-900">{leaves.length}</span></p>
      </div>
      {leaves.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm" data-testid="leaves-empty">No leaves found for this filter.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="leaves-table">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">Leave ID</th>
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Dates</th>
                <th className="px-3 py-2 text-left">Days</th>
                <th className="px-3 py-2 text-left">Reason</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map(l => (
                <tr key={l.leave_id} className="border-b border-slate-200 hover:bg-slate-50" data-testid={`leave-row-${l.leave_id}`}>
                  <td className="px-3 py-2 text-xs font-mono text-slate-500">{l.leave_id}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{l.employee_name}<br /><span className="text-[11px] text-slate-500 font-mono">{l.employee_id}</span></td>
                  <td className="px-3 py-2 text-slate-700 uppercase">{l.leave_type}</td>
                  <td className="px-3 py-2 text-slate-700">{l.from_date} → {l.to_date}</td>
                  <td className="px-3 py-2 text-slate-700">{l.days}</td>
                  <td className="px-3 py-2 text-slate-700 truncate max-w-[200px]">{l.reason || '—'}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[11px] uppercase font-semibold ${l.status === 'approved' ? 'bg-emerald-500/20 text-emerald-700' : l.status === 'rejected' ? 'bg-red-500/20 text-red-700' : l.status === 'cancelled' ? 'bg-slate-300 text-slate-700' : 'bg-amber-500/20 text-amber-700'}`}>{l.status}</span></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {l.status === 'requested' && (
                      <>
                        <button disabled={busy === l.leave_id} onClick={() => decide(l.leave_id, 'approve')} className="inline-flex items-center gap-1 px-2 py-1 text-xs text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 rounded disabled:opacity-50" data-testid={`leave-approve-${l.leave_id}`}><Check className="w-3.5 h-3.5" /> Approve</button>
                        <button disabled={busy === l.leave_id} onClick={() => decide(l.leave_id, 'reject')} className="ml-1 inline-flex items-center gap-1 px-2 py-1 text-xs text-red-700 bg-red-500/10 hover:bg-red-500/20 rounded disabled:opacity-50" data-testid={`leave-reject-${l.leave_id}`}><X className="w-3.5 h-3.5" /> Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};


export { LeavesTab };
