// Careers module — Employees tab + per-employee Onboarding & Letters tools
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, X, Plus, Download, ListChecks, FileBadge } from 'lucide-react';
import { API } from '../../../lib/api';

const EmployeesTab = ({ employees, onOpenTool }) => (
  <div>
    <p className="text-sm text-slate-500 mb-3">Total: <span className="font-semibold text-slate-900">{employees.length}</span> employees</p>
    {employees.length === 0 ? (
      <div className="text-center py-10 text-slate-500 text-sm" data-testid="employees-empty">No employees yet. Convert a &ldquo;joined&rdquo; applicant from the Applications tab to create the first record.</div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="employees-table">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left">Employee ID</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Department</th>
              <th className="px-3 py-2 text-left">Designation</th>
              <th className="px-3 py-2 text-left">Hiring Type</th>
              <th className="px-3 py-2 text-left">Joining Date</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Tools</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(e => (
              <tr key={e.employee_id} className="border-b border-slate-200 hover:bg-slate-50" data-testid={`employee-row-${e.employee_id}`}>
                <td className="px-3 py-2 text-xs text-slate-500 font-mono">{e.employee_id}</td>
                <td className="px-3 py-2 font-medium text-slate-900">{e.name}</td>
                <td className="px-3 py-2 text-slate-700">{e.department}</td>
                <td className="px-3 py-2 text-slate-700">{e.designation}</td>
                <td className="px-3 py-2 text-slate-700">{e.hiring_type}</td>
                <td className="px-3 py-2 text-slate-700">{e.joining_date?.slice(0, 10)}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${e.status === 'active' ? 'bg-emerald-500/20 text-emerald-700' : 'bg-slate-300 text-slate-700'}`}>{e.status}</span>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => onOpenTool && onOpenTool(e, 'onboarding')} className="inline-flex items-center gap-1 px-2 py-1 text-xs text-indigo-700 bg-indigo-500/10 hover:bg-indigo-500/20 rounded" data-testid={`emp-onboarding-${e.employee_id}`}>
                    <ListChecks className="w-3.5 h-3.5" /> Onboarding
                  </button>
                  <button onClick={() => onOpenTool && onOpenTool(e, 'letters')} className="ml-1 inline-flex items-center gap-1 px-2 py-1 text-xs text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 rounded" data-testid={`emp-letters-${e.employee_id}`}>
                    <FileBadge className="w-3.5 h-3.5" /> Letters
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);


const EmployeeToolModal = ({ employee, initialTab, adminId, onClose }) => {
  const [tab, setTab] = useState(initialTab || 'onboarding');
  const [onboarding, setOnboarding] = useState(null);
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLetterForm, setShowLetterForm] = useState(false);

  const loadOnboarding = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/public/employees/${employee.employee_id}/onboarding`);
      setOnboarding(r.data.onboarding);
    } catch { setOnboarding(null); }
  }, [employee.employee_id]);

  const loadLetters = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/public/employees/${employee.employee_id}/letters`);
      setLetters(r.data.letters || []);
    } catch { setLetters([]); }
  }, [employee.employee_id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadOnboarding(), loadLetters()]).finally(() => setLoading(false));
  }, [loadOnboarding, loadLetters]);

  const initOnboarding = async () => {
    try {
      await axios.post(`${API}/public/employees/${employee.employee_id}/onboarding/init`, { admin_id: adminId });
      toast.success('Onboarding initialised');
      loadOnboarding();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };
  const toggleTask = async (task_id, done) => {
    try {
      await axios.patch(`${API}/public/employees/${employee.employee_id}/onboarding/${task_id}`, { done, admin_id: adminId });
      loadOnboarding();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="employee-tool-modal">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div><h3 className="font-bold text-slate-900">{employee.name}</h3><p className="text-xs text-slate-500 font-mono">{employee.employee_id} • {employee.designation}</p></div>
          <button onClick={onClose} className="text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mx-4 mt-4">
          {[['onboarding', 'Onboarding', ListChecks], ['letters', 'HR Letters', FileBadge]].map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-md text-xs font-medium ${tab === id ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`} data-testid={`emp-tool-tab-${id}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" /> : (
            <>
              {tab === 'onboarding' && (
                <div>
                  {!onboarding ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-slate-500 mb-3">No onboarding checklist yet.</p>
                      <button onClick={initOnboarding} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm" data-testid="onboarding-init-btn">Initialise Checklist</button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-slate-700">Progress: <span className="font-semibold text-slate-900">{onboarding.progress?.done}/{onboarding.progress?.total}</span> ({onboarding.progress?.percent}%)</p>
                        {onboarding.completed_at && <span className="text-xs text-emerald-600 font-medium">Completed</span>}
                      </div>
                      <div className="space-y-1.5">
                        {onboarding.tasks.map(t => (
                          <label key={t.task_id} className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer" data-testid={`onb-task-${t.task_id}`}>
                            <input type="checkbox" checked={t.done} onChange={e => toggleTask(t.task_id, e.target.checked)} data-testid={`onb-chk-${t.task_id}`} />
                            <span className={`text-sm ${t.done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{t.title}</span>
                            {t.done_at && <span className="ml-auto text-[10px] text-slate-400">{t.done_at.slice(0, 10)}</span>}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {tab === 'letters' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-slate-500">Issued Letters: <span className="font-semibold text-slate-900">{letters.length}</span></p>
                    <button onClick={() => setShowLetterForm(true)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs" data-testid="generate-letter-btn"><Plus className="w-3.5 h-3.5" /> Generate Letter</button>
                  </div>
                  {letters.length === 0 ? (
                    <p className="text-center py-6 text-slate-500 text-sm">No letters issued yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {letters.map(l => (
                        <div key={l.letter_id} className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg" data-testid={`letter-row-${l.letter_id}`}>
                          <FileBadge className="w-4 h-4 text-slate-500" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900 capitalize">{l.kind} Letter</p>
                            <p className="text-[11px] text-slate-500 font-mono">{l.letter_id} • Issued {l.issued_at?.slice(0, 10)}</p>
                          </div>
                          <a href={`${API}/public/employees/${employee.employee_id}/letters/${l.letter_id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded" data-testid={`download-letter-${l.letter_id}`}>
                            <Download className="w-3.5 h-3.5" /> PDF
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                  {showLetterForm && (
                    <GenerateLetterForm employee={employee} adminId={adminId} onClose={() => setShowLetterForm(false)} onDone={() => { setShowLetterForm(false); loadLetters(); }} />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const GenerateLetterForm = ({ employee, adminId, onClose, onDone }) => {
  const [kind, setKind] = useState('appointment');
  const [payload, setPayload] = useState({});
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const clean = {};
      Object.keys(payload).forEach(k => { const v = payload[k]; if (v !== '' && v != null) clean[k] = (['previous_ctc', 'new_ctc'].includes(k) ? Number(v) : v); });
      await axios.post(`${API}/public/employees/${employee.employee_id}/letters/generate`, { kind, payload: clean, admin_id: adminId });
      toast.success('Letter generated');
      onDone();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full p-4" onClick={e => e.stopPropagation()} data-testid="letter-form-modal">
        <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-900">Generate Letter</h3><button onClick={onClose} className="text-slate-500"><X className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <select value={kind} onChange={e => { setKind(e.target.value); setPayload({}); }} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="letter-kind">
            {['appointment', 'confirmation', 'increment', 'promotion', 'experience'].map(k => <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
          </select>
          {kind === 'confirmation' && (
            <input value={payload.confirmation_date || ''} onChange={e => setPayload(p => ({ ...p, confirmation_date: e.target.value }))} placeholder="Confirmation date (e.g. 01 March 2026)" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="letter-confirmation-date" />
          )}
          {kind === 'increment' && (
            <div className="grid grid-cols-3 gap-2">
              <input type="number" value={payload.previous_ctc || ''} onChange={e => setPayload(p => ({ ...p, previous_ctc: e.target.value }))} placeholder="Previous CTC" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="letter-prev-ctc" />
              <input type="number" value={payload.new_ctc || ''} onChange={e => setPayload(p => ({ ...p, new_ctc: e.target.value }))} placeholder="New CTC" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="letter-new-ctc" />
              <input value={payload.effective_from || ''} onChange={e => setPayload(p => ({ ...p, effective_from: e.target.value }))} placeholder="Effective from" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="letter-effective" />
            </div>
          )}
          {kind === 'promotion' && (
            <div className="grid grid-cols-2 gap-2">
              <input value={payload.new_designation || ''} onChange={e => setPayload(p => ({ ...p, new_designation: e.target.value }))} placeholder="New designation" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="letter-new-desig" />
              <input type="number" value={payload.new_ctc || ''} onChange={e => setPayload(p => ({ ...p, new_ctc: e.target.value }))} placeholder="New CTC (optional)" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="letter-promo-ctc" />
              <input value={payload.new_department || ''} onChange={e => setPayload(p => ({ ...p, new_department: e.target.value }))} placeholder="New department (optional)" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="letter-new-dept" />
              <input value={payload.effective_from || ''} onChange={e => setPayload(p => ({ ...p, effective_from: e.target.value }))} placeholder="Effective from" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="letter-promo-eff" />
            </div>
          )}
          {kind === 'experience' && (
            <input value={payload.relieving_date || ''} onChange={e => setPayload(p => ({ ...p, relieving_date: e.target.value }))} placeholder="Relieving date (e.g. 30 April 2027)" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="letter-relieving-date" />
          )}
          {kind === 'appointment' && <p className="text-xs text-slate-500">Uses accepted offer + employee profile. No extra input needed.</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm" data-testid="letter-save-btn">{saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Generate PDF'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};


export { EmployeesTab, EmployeeToolModal, GenerateLetterForm };
