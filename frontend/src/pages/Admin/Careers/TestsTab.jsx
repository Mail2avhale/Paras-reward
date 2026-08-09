// Careers module — Test bank tab + create-test modal + HR quick-action modal
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Trash2, X, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { API } from '../../../lib/api';

const TestsTab = ({ tests, onCreate, onDelete }) => (
  <div>
    <div className="flex items-center justify-between mb-3">
      <p className="text-sm text-slate-500">Total: <span className="font-semibold text-slate-900">{tests.length}</span> tests</p>
      <button onClick={onCreate} className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm" data-testid="create-test-btn">
        <Plus className="w-4 h-4" /> Create Test
      </button>
    </div>
    {tests.length === 0 ? (
      <div className="text-center py-10 text-slate-500 text-sm" data-testid="tests-empty">No tests created yet. Click &ldquo;Create Test&rdquo; to build one.</div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="tests-table">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left">Test ID</th>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Department</th>
              <th className="px-3 py-2 text-left">Questions</th>
              <th className="px-3 py-2 text-left">Marks</th>
              <th className="px-3 py-2 text-left">Duration</th>
              <th className="px-3 py-2 text-left">Pass %</th>
              <th className="px-3 py-2 text-left">Active</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tests.map(t => (
              <tr key={t.test_id} className="border-b border-slate-200 hover:bg-slate-50" data-testid={`test-row-${t.test_id}`}>
                <td className="px-3 py-2 text-xs text-slate-500 font-mono">{t.test_id}</td>
                <td className="px-3 py-2 font-medium text-slate-900">{t.title}</td>
                <td className="px-3 py-2 text-slate-700">{t.department}</td>
                <td className="px-3 py-2 text-slate-700">{t.question_count}</td>
                <td className="px-3 py-2 text-slate-700">{t.total_marks}</td>
                <td className="px-3 py-2 text-slate-700">{t.duration_minutes}m</td>
                <td className="px-3 py-2 text-slate-700">{t.passing_marks}%</td>
                <td className="px-3 py-2">{t.is_active ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-slate-400" />}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => onDelete(t.test_id)} className="p-1.5 text-slate-500 hover:text-red-500" data-testid={`delete-test-${t.test_id}`}>
                    <Trash2 className="w-4 h-4" />
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


const TestBankModal = ({ onClose, onSaved, adminId }) => {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('Technology');
  const [duration, setDuration] = useState(30);
  const [pass, setPass] = useState(50);
  const [questions, setQuestions] = useState([{ text: '', options: ['', ''], correct_index: 0, marks: 1 }]);
  const [saving, setSaving] = useState(false);

  const addQ = () => setQuestions(qs => [...qs, { text: '', options: ['', ''], correct_index: 0, marks: 1 }]);
  const removeQ = (i) => setQuestions(qs => qs.length > 1 ? qs.filter((_, idx) => idx !== i) : qs);
  const upd = (i, key, val) => setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, [key]: val } : q));
  const addOpt = (i) => upd(i, 'options', [...(questions[i].options || []), '']);
  const setOpt = (i, oi, val) => upd(i, 'options', questions[i].options.map((o, idx) => idx === oi ? val : o));

  const save = async () => {
    if (!title.trim()) return toast.error('Title required');
    if (questions.some(q => !q.text.trim() || q.options.length < 2 || q.options.some(o => !o.trim()))) return toast.error('All questions need text and at least 2 non-empty options');
    setSaving(true);
    try {
      await axios.post(`${API}/public/tests`, {
        title, department, duration_minutes: Number(duration), passing_marks: Number(pass),
        questions: questions.map(q => ({ ...q, marks: Number(q.marks) || 1, correct_index: Number(q.correct_index) })),
        admin_id: adminId,
      });
      toast.success('Test created');
      onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} data-testid="test-modal">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-900">Create Test</h3>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Test title" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="test-title" />
            <input value={department} onChange={e => setDepartment(e.target.value)} placeholder="Department" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="test-department" />
            <input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="Duration (minutes)" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="test-duration" />
            <input type="number" value={pass} onChange={e => setPass(e.target.value)} placeholder="Passing %" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="test-pass" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-900">Questions ({questions.length})</p>
              <button onClick={addQ} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg" data-testid="add-question-btn">
                <Plus className="w-3.5 h-3.5" /> Add Question
              </button>
            </div>
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2" data-testid={`question-${i}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-slate-500 mt-2 shrink-0">Q{i+1}.</span>
                    <input value={q.text} onChange={e => upd(i, 'text', e.target.value)} placeholder="Question text" className="flex-1 px-2.5 py-2 border border-slate-200 bg-white rounded-lg text-sm text-slate-900" data-testid={`q-text-${i}`} />
                    <input type="number" value={q.marks} onChange={e => upd(i, 'marks', e.target.value)} placeholder="Marks" className="w-20 px-2.5 py-2 border border-slate-200 bg-white rounded-lg text-sm text-slate-900" data-testid={`q-marks-${i}`} />
                    <button onClick={() => removeQ(i)} disabled={questions.length <= 1} className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-30" data-testid={`remove-q-${i}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="ml-8 space-y-1.5">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input type="radio" name={`correct-${i}`} checked={q.correct_index === oi} onChange={() => upd(i, 'correct_index', oi)} data-testid={`q-correct-${i}-${oi}`} />
                        <input value={opt} onChange={e => setOpt(i, oi, e.target.value)} placeholder={`Option ${oi+1}`} className="flex-1 px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-sm text-slate-900" data-testid={`q-opt-${i}-${oi}`} />
                      </div>
                    ))}
                    <button onClick={() => addOpt(i)} className="text-[11px] text-blue-600 hover:underline" data-testid={`add-opt-${i}`}>+ Add option</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm disabled:opacity-50" data-testid="save-test-btn">
            {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Save Test'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ========== Phase B/C/Employee: Quick Action Modal ========== */
const QuickActionModal = ({ kind, app, tests, adminId, onClose, onDone, onNeedTests }) => {
  useEffect(() => { if (kind === 'test' && tests.length === 0) onNeedTests(); }, [kind, tests.length, onNeedTests]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => {
    if (kind === 'test') return { test_id: '', deadline_hours: 72 };
    if (kind === 'interview') return { kind: 'hr', scheduled_at: '', mode: 'online', meet_link: '', panelists: '' };
    if (kind === 'offer') return { hiring_type: 'Direct Hire', designation: '', department: '', work_location: 'Chatrapati Sambhaji Nagar', joining_date: '', salary_ctc: '', probation_months: 0, additional_notes: '' };
    if (kind === 'convert') return { reports_to: '' };
    return {};
  });

  const submit = async () => {
    setSaving(true);
    try {
      if (kind === 'test') {
        if (!form.test_id) { toast.error('Pick a test'); setSaving(false); return; }
        const r = await axios.post(`${API}/public/tests/assign`, { application_id: app.application_id, test_id: form.test_id, deadline_hours: Number(form.deadline_hours), admin_id: adminId });
        toast.success(`Test assigned. Candidate URL: ${r.data.candidate_url}`);
      } else if (kind === 'interview') {
        if (!form.scheduled_at) { toast.error('Pick a schedule time'); setSaving(false); return; }
        await axios.post(`${API}/public/interviews/schedule`, {
          application_id: app.application_id,
          kind: form.kind, scheduled_at: form.scheduled_at, mode: form.mode,
          meet_link: form.meet_link || null,
          panelists: form.panelists ? form.panelists.split(',').map(p => p.trim()) : [],
          admin_id: adminId,
        });
        toast.success('Interview scheduled');
      } else if (kind === 'offer') {
        if (!form.designation || !form.department || !form.joining_date || !form.salary_ctc) { toast.error('Fill designation / department / joining date / CTC'); setSaving(false); return; }
        const r = await axios.post(`${API}/public/offers/generate`, { ...form, application_id: app.application_id, salary_ctc: Number(form.salary_ctc), probation_months: Number(form.probation_months) || 0, admin_id: adminId });
        toast.success(`Offer generated: ${r.data.offer_id}. PDF ready.`);
      } else if (kind === 'convert') {
        const r = await axios.post(`${API}/public/employees/from-application`, { application_id: app.application_id, reports_to: form.reports_to || null, admin_id: adminId });
        toast.success(r.data.already_exists ? `Employee already exists: ${r.data.employee.employee_id}` : `Created ${r.data.employee.employee_id}`);
      }
      onDone();
    } catch (e) { toast.error(e.response?.data?.detail || 'Action failed'); }
    finally { setSaving(false); }
  };

  const title = { test: 'Assign Test', interview: 'Schedule Interview', offer: 'Generate Offer Letter', convert: 'Convert to Employee' }[kind];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} data-testid={`quick-action-${kind}-modal`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">{app.name} • {app.application_id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {kind === 'test' && (
            <>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Test</label>
                <select value={form.test_id} onChange={e => setForm(f => ({ ...f, test_id: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="qa-test-select">
                  <option value="">Select test…</option>
                  {tests.map(t => <option key={t.test_id} value={t.test_id}>{t.title} ({t.question_count} Q, {t.duration_minutes}m)</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Deadline (hours)</label>
                <input type="number" value={form.deadline_hours} onChange={e => setForm(f => ({ ...f, deadline_hours: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="qa-test-deadline" />
              </div>
            </>
          )}
          {kind === 'interview' && (
            <>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Interview type</label>
                <select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="qa-interview-kind">
                  <option value="hr">HR Round</option>
                  <option value="department">Department / Manager Round</option>
                  <option value="panel">Panel Interview</option>
                  <option value="practical">Practical Test</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Scheduled at (ISO)</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="qa-interview-time" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="qa-interview-mode">
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
                <input value={form.meet_link} onChange={e => setForm(f => ({ ...f, meet_link: e.target.value }))} placeholder="Meet link (optional)" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="qa-interview-link" />
              </div>
              <input value={form.panelists} onChange={e => setForm(f => ({ ...f, panelists: e.target.value }))} placeholder="Panelists (comma-separated)" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="qa-interview-panelists" />
            </>
          )}
          {kind === 'offer' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <select value={form.hiring_type} onChange={e => setForm(f => ({ ...f, hiring_type: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="qa-offer-hiring-type">
                  {['Fresher / Trainee', 'Internship', 'Direct Hire', 'Probation', 'Contract'].map(x => <option key={x} value={x}>{x}</option>)}
                </select>
                <input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} placeholder="Designation" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="qa-offer-designation" />
                <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Department" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="qa-offer-department" />
                <input value={form.work_location} onChange={e => setForm(f => ({ ...f, work_location: e.target.value }))} placeholder="Work location" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="qa-offer-location" />
                <input type="date" value={form.joining_date} onChange={e => setForm(f => ({ ...f, joining_date: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="qa-offer-joining" />
                <input type="number" value={form.salary_ctc} onChange={e => setForm(f => ({ ...f, salary_ctc: e.target.value }))} placeholder="Annual CTC" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="qa-offer-ctc" />
                <input type="number" value={form.probation_months} onChange={e => setForm(f => ({ ...f, probation_months: e.target.value }))} placeholder="Probation months" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="qa-offer-probation" />
              </div>
              <textarea value={form.additional_notes} onChange={e => setForm(f => ({ ...f, additional_notes: e.target.value }))} placeholder="Additional notes" rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 resize-none" data-testid="qa-offer-notes" />
            </>
          )}
          {kind === 'convert' && (
            <>
              <p className="text-sm text-slate-500">This will create an Employee record (<span className="font-mono">PR-EMP-#####</span>) using the accepted offer details, and move the application to <span className="font-medium text-slate-800">joined</span>.</p>
              <input value={form.reports_to} onChange={e => setForm(f => ({ ...f, reports_to: e.target.value }))} placeholder="Reports to (manager email or name)" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="qa-convert-manager" />
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm disabled:opacity-50" data-testid="qa-submit-btn">
            {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};


export { TestsTab, TestBankModal, QuickActionModal };
