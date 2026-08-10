// Portal Access Tab — enable/reset employee portal passwords + Announcements
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, KeyRound, Megaphone, Trash2, Plus, X, Shield, Lock, Copy } from 'lucide-react';
import { API } from '../../../lib/api';

const PortalTab = ({ adminId }) => {
  const [sub, setSub] = useState('access');   // access | announcements
  return (
    <div data-testid="portal-tab">
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-4 w-fit">
        {[{ id: 'access', label: 'Portal Access', icon: Shield }, { id: 'announcements', label: 'Announcements', icon: Megaphone }].map(t => (
          <button key={t.id} onClick={() => setSub(t.id)} data-testid={`portal-sub-${t.id}`} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${sub === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>
      {sub === 'access' && <PortalAccess adminId={adminId} />}
      {sub === 'announcements' && <Announcements adminId={adminId} />}
    </div>
  );
};

const PortalAccess = ({ adminId }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pwModal, setPwModal] = useState(null);   // employee obj

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/public/hr/employees/credentials`);
      setRows(data.employees || []);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Employee Portal Access</h2>
          <p className="text-xs text-slate-500">Set or reset employee login passwords</p>
        </div>
      </div>
      {loading ? (
        <div className="text-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" /></div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-xs" data-testid="portal-access-table">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-left">Department</th>
                <th className="px-3 py-2 text-left">Access</th>
                <th className="px-3 py-2 text-left">Password Set</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.employee_id} className="border-b border-slate-100">
                  <td className="px-3 py-2">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-[10px] text-slate-400">{r.employee_id}</p>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.department}</td>
                  <td className="px-3 py-2">
                    {r.locked ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">LOCKED</span>
                    ) : r.portal_enabled ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">ENABLED</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-semibold">DISABLED</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-500 text-[10px]">
                    {r.password_set_at ? new Date(r.password_set_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setPwModal(r)} className="text-xs text-amber-600 hover:underline flex items-center gap-1 ml-auto" data-testid={`set-pw-${r.employee_id}`}>
                      <KeyRound className="w-3 h-3" /> {r.portal_enabled ? 'Reset Password' : 'Enable Portal'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pwModal && <SetPasswordModal employee={pwModal} adminId={adminId} onClose={() => setPwModal(null)} onSaved={() => { setPwModal(null); fetchAll(); }} />}
    </>
  );
};

const SetPasswordModal = ({ employee, adminId, onClose, onSaved }) => {
  const [pw, setPw] = useState(() => Math.random().toString(36).slice(-8) + 'A1!');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (pw.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/public/hr/employees/set-password`, {
        employee_id: employee.employee_id, password: pw, admin_id: adminId,
      });
      toast.success('Password set. Share securely with employee.');
      onSaved();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); } finally { setBusy(false); }
  };

  const copy = () => {
    navigator.clipboard.writeText(pw);
    toast.success('Password copied to clipboard');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()} data-testid="set-pw-modal">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Set Portal Password</h3>
            <p className="text-xs text-slate-500">For: {employee.name} ({employee.employee_id})</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Temporary Password</label>
            <div className="flex gap-2">
              <input type="text" value={pw} onChange={(e) => setPw(e.target.value)} className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" data-testid="new-pw-input" />
              <button onClick={copy} className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50" title="Copy">
                <Copy className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              <Lock className="w-3 h-3 inline mr-1" /> Employee should change password after first login.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={save} disabled={busy} className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg font-semibold disabled:opacity-60" data-testid="save-pw">
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Set Password'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Announcements = ({ adminId }) => {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/public/hr/announcements`);
      setItems(data.announcements || []);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const del = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await axios.delete(`${API}/public/hr/announcements/${id}`);
      toast.success('Deleted');
      fetchAll();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Company Announcements</h2>
          <p className="text-xs text-slate-500">Published to employee self-service portal</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-xs font-semibold" data-testid="new-ann-btn">
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-sm text-slate-500">No announcements yet</div>
        ) : items.map(a => (
          <div key={a.announcement_id} className="bg-white border border-slate-200 rounded-lg p-3 flex items-start justify-between gap-3" data-testid={`ann-${a.announcement_id}`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {a.pinned && <span className="text-[10px] px-1.5 py-0.5 bg-amber-500 text-white rounded font-semibold">PINNED</span>}
                <h3 className="text-sm font-bold">{a.title}</h3>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">{(a.published_at || '').slice(0, 10)} • {a.audience}</p>
              <p className="text-xs text-slate-700 mt-1 line-clamp-2">{a.body}</p>
            </div>
            <button onClick={() => del(a.announcement_id)} className="text-slate-400 hover:text-red-600 p-1" data-testid={`del-ann-${a.announcement_id}`}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      {showModal && <AnnouncementModal adminId={adminId} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchAll(); }} />}
    </>
  );
};

const AnnouncementModal = ({ adminId, onClose, onSaved }) => {
  const [form, setForm] = useState({ title: '', body: '', audience: 'all', pinned: false, expires_at: '' });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) { toast.error('Title and body required'); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/public/hr/announcements`, { ...form, published_by: adminId, expires_at: form.expires_at || null });
      toast.success('Announcement published');
      onSaved();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()} data-testid="ann-modal">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-slate-900">New Announcement</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="ann-title" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Body</label>
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" data-testid="ann-body" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Audience</label>
              <input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="all or department:Technology" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="ann-audience" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Expires (optional)</label>
              <input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="ann-expires" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} data-testid="ann-pinned" />
            Pin to top
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={save} disabled={busy} className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg font-semibold disabled:opacity-60" data-testid="ann-save">
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
};

export { PortalTab };
