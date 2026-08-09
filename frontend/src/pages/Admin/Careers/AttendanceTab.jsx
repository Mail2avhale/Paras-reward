// Careers module — Attendance tab + Mark-attendance modal (spec §32, §42)
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { RefreshCw, Plus, X, Loader2 } from 'lucide-react';
import { API } from '../../../lib/api';

const AttendanceTab = ({ attendance, date, setDate, employees, onEmployeesRefresh, onRefresh, adminId }) => {
  const [markOpen, setMarkOpen] = useState(false);
  useEffect(() => { if (employees.length === 0) onEmployeesRefresh && onEmployeesRefresh(); }, [employees.length, onEmployeesRefresh]);

  const by = attendance.by_status || {};
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" data-testid="attendance-date" />
        <button onClick={onRefresh} className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700" data-testid="attendance-refresh"><RefreshCw className="w-4 h-4" /> Refresh</button>
        <button onClick={() => setMarkOpen(true)} className="ml-auto flex items-center gap-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm" data-testid="attendance-mark-btn"><Plus className="w-4 h-4" /> Mark Attendance</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {[
          ['present', 'bg-emerald-500/20 text-emerald-700'],
          ['absent', 'bg-red-500/20 text-red-700'],
          ['half_day', 'bg-amber-500/20 text-amber-700'],
          ['wfh', 'bg-blue-500/20 text-blue-700'],
          ['leave', 'bg-purple-500/20 text-purple-700'],
        ].map(([s, c]) => (
          <div key={s} className={`p-3 rounded-lg ${c}`} data-testid={`att-count-${s}`}>
            <p className="text-[10px] uppercase font-semibold">{s.replace('_', ' ')}</p>
            <p className="text-lg font-bold">{by[s] || 0}</p>
          </div>
        ))}
      </div>
      {attendance.total === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm" data-testid="attendance-empty">No attendance recorded for {date}.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="attendance-table">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-left">Department</th>
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Check-in</th>
                <th className="px-3 py-2 text-left">Check-out</th>
                <th className="px-3 py-2 text-left">Hours</th>
              </tr>
            </thead>
            <tbody>
              {attendance.roster.map(r => (
                <tr key={r.attendance_id || (r.employee_id + r.date)} className="border-b border-slate-200 hover:bg-slate-50" data-testid={`att-row-${r.employee_id}`}>
                  <td className="px-3 py-2 font-medium text-slate-900">{r.employee_name}<br /><span className="text-[11px] text-slate-500 font-mono">{r.employee_id}</span></td>
                  <td className="px-3 py-2 text-slate-700">{r.department || '—'}</td>
                  <td className="px-3 py-2 text-slate-700">{r.district || '—'}</td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-800 uppercase">{r.status}</span></td>
                  <td className="px-3 py-2 text-slate-700">{r.check_in || '—'}</td>
                  <td className="px-3 py-2 text-slate-700">{r.check_out || '—'}</td>
                  <td className="px-3 py-2 text-slate-700">{r.hours_worked ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {markOpen && (
        <MarkAttendanceModal date={date} employees={employees} adminId={adminId} onClose={() => setMarkOpen(false)} onSaved={() => { setMarkOpen(false); onRefresh(); }} />
      )}
    </div>
  );
};

const MarkAttendanceModal = ({ date, employees, adminId, onClose, onSaved }) => {
  const [form, setForm] = useState({ employee_id: '', status: 'present', check_in: '09:00', check_out: '18:00', notes: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.employee_id) return toast.error('Select an employee');
    setSaving(true);
    try {
      await axios.post(`${API}/public/attendance/mark`, { ...form, date, admin_id: adminId });
      toast.success('Attendance saved');
      onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-4" onClick={e => e.stopPropagation()} data-testid="mark-attendance-modal">
        <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-900">Mark Attendance — {date}</h3><button onClick={onClose} className="text-slate-500"><X className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="mark-att-employee">
            <option value="">Select employee…</option>
            {employees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.name} ({e.employee_id})</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="mark-att-status">
              {['present', 'absent', 'half_day', 'wfh', 'leave'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="time" value={form.check_in} onChange={e => setForm(f => ({ ...f, check_in: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="mark-att-checkin" />
            <input type="time" value={form.check_out} onChange={e => setForm(f => ({ ...f, check_out: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="mark-att-checkout" />
          </div>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="mark-att-notes" />
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm" data-testid="mark-att-save">{saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};


export { AttendanceTab, MarkAttendanceModal };
