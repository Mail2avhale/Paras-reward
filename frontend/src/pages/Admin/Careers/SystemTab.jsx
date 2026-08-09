// Careers module — System tab: Audit log + RBAC + Notification templates (spec §7, §46-53)
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  RefreshCw, Loader2, ShieldCheck, ScrollText, Bell,
  Plus, Edit2, Trash2, X, CheckCircle, XCircle,
} from 'lucide-react';
import { API } from '../../../lib/api';

const SystemTab = ({ adminId }) => {
  const [sub, setSub] = useState('audit');
  const subs = [
    ['audit', 'Audit Log', ScrollText],
    ['rbac', 'Roles & Access', ShieldCheck],
    ['templates', 'Notification Templates', Bell],
  ];
  return (
    <div>
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-4 max-w-md">
        {subs.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setSub(id)} className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-md text-xs font-medium ${sub === id ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`} data-testid={`system-sub-${id}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      {sub === 'audit' && <AuditLogPane />}
      {sub === 'rbac' && <RbacPane adminId={adminId} />}
      {sub === 'templates' && <TemplatesPane adminId={adminId} />}
    </div>
  );
};

const AuditLogPane = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (action) params.set('action', action);
      if (entityType) params.set('entity_type', entityType);
      params.set('limit', '200');
      const r = await axios.get(`${API}/public/audit?${params.toString()}`);
      setLogs(r.data?.logs || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [action, entityType]);
  useEffect(() => { load(); }, [load]);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input value={action} onChange={e => setAction(e.target.value)} placeholder="Action prefix (e.g. appraisal.)" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" data-testid="audit-action-filter" />
        <input value={entityType} onChange={e => setEntityType(e.target.value)} placeholder="Entity type" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" data-testid="audit-entity-filter" />
        <button onClick={load} className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700" data-testid="audit-refresh"><RefreshCw className="w-4 h-4" /> Refresh</button>
        <p className="ml-auto text-sm text-slate-500">Showing <span className="font-semibold text-slate-900">{logs.length}</span> entries</p>
      </div>
      {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" /> : logs.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm" data-testid="audit-empty">No audit entries for this filter.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="audit-table">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">Time (UTC)</th>
                <th className="px-3 py-2 text-left">Actor</th>
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Entity</th>
                <th className="px-3 py-2 text-left">Fields Changed</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.log_id} className="border-b border-slate-200 hover:bg-slate-50" data-testid={`audit-row-${l.log_id}`}>
                  <td className="px-3 py-2 text-[11px] font-mono text-slate-500">{l.ts?.slice(0, 19).replace('T', ' ')}</td>
                  <td className="px-3 py-2 text-slate-700">{l.actor}</td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded text-[11px] font-mono">{l.action}</span></td>
                  <td className="px-3 py-2 text-[11px] text-slate-500 font-mono">{l.entity_type}<br />{l.entity_id}</td>
                  <td className="px-3 py-2 text-[11px] text-slate-600">{(l.diff || []).slice(0, 3).map(d => d.field).join(', ') || '—'}{(l.diff || []).length > 3 ? `, +${l.diff.length - 3}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const RbacPane = ({ adminId }) => {
  const [roles, setRoles] = useState([]);
  const [bindings, setBindings] = useState([]);
  const [user, setUser] = useState('');
  const [role, setRole] = useState('');
  const load = useCallback(async () => {
    try {
      const [r, b] = await Promise.all([
        axios.get(`${API}/public/rbac/roles`),
        axios.get(`${API}/public/rbac/bindings`),
      ]);
      setRoles(r.data?.roles || []);
      setBindings(b.data?.bindings || []);
      if (!role && r.data?.roles?.length) setRole(r.data.roles[0].role);
    } catch { /* silent */ }
  }, [role]);
  useEffect(() => { load(); }, [load]);

  const bind = async () => {
    if (!user || !role) return toast.error('User & role required');
    try {
      const r = await axios.post(`${API}/public/rbac/bind`, { user, role, admin_id: adminId });
      toast.success(r.data.already_bound ? 'Already bound' : 'Role bound');
      setUser('');
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };
  const unbind = async (binding_id) => {
    if (!window.confirm('Remove this role binding?')) return;
    try {
      await axios.delete(`${API}/public/rbac/bind/${binding_id}`);
      toast.success('Unbound');
      load();
    } catch { toast.error('Failed'); }
  };
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-900 mb-2">Role Matrix (7 roles)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {roles.map(r => (
            <div key={r.role} className="p-3 border border-slate-200 rounded-lg bg-white" data-testid={`role-card-${r.role}`}>
              <p className="font-medium text-slate-900">{r.label}</p>
              <p className="text-[11px] font-mono text-slate-500 mb-1">{r.role}</p>
              <div className="flex flex-wrap gap-1">
                {(r.permissions || []).map((p, i) => (
                  <span key={i} className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">{p}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900 mb-2">Bind Role</p>
        <div className="flex flex-wrap items-center gap-2">
          <input value={user} onChange={e => setUser(e.target.value)} placeholder="User email / uid" className="flex-1 min-w-[220px] px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="rbac-user-input" />
          <select value={role} onChange={e => setRole(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="rbac-role-select">
            {roles.map(r => <option key={r.role} value={r.role}>{r.label}</option>)}
          </select>
          <button onClick={bind} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm" data-testid="rbac-bind-btn">Bind</button>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900 mb-2">Active Bindings ({bindings.length})</p>
        {bindings.length === 0 ? (
          <p className="text-sm text-slate-500" data-testid="rbac-empty">No bindings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="rbac-bindings-table">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Assigned At</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bindings.map(b => (
                  <tr key={b.binding_id} className="border-b border-slate-200 hover:bg-slate-50" data-testid={`rbac-binding-${b.binding_id}`}>
                    <td className="px-3 py-2 text-slate-800">{b.user}</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 font-mono text-slate-700">{b.role}</span></td>
                    <td className="px-3 py-2 text-[11px] text-slate-500">{b.assigned_at?.slice(0, 19).replace('T', ' ')}</td>
                    <td className="px-3 py-2 text-right"><button onClick={() => unbind(b.binding_id)} className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-700 bg-red-500/10 hover:bg-red-500/20 rounded" data-testid={`rbac-unbind-${b.binding_id}`}><Trash2 className="w-3.5 h-3.5" /> Unbind</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const TemplatesPane = ({ adminId }) => {
  const [templates, setTemplates] = useState([]);
  const [keys, setKeys] = useState([]);
  const [channels, setChannels] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/public/notifications/templates`);
      setTemplates(r.data?.templates || []);
      setKeys(r.data?.keys || []);
      setChannels(r.data?.channels || []);
    } catch { /* silent */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500">Total: <span className="font-semibold text-slate-900">{templates.length}</span> templates</p>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm" data-testid="new-template-btn"><Plus className="w-4 h-4" /> New Template</button>
      </div>
      {templates.length === 0 ? (
        <p className="text-center py-8 text-slate-500 text-sm" data-testid="templates-empty">No templates yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="templates-table">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">Key</th>
                <th className="px-3 py-2 text-left">Channel</th>
                <th className="px-3 py-2 text-left">Subject</th>
                <th className="px-3 py-2 text-left">Variables</th>
                <th className="px-3 py-2 text-left">Active</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.template_id} className="border-b border-slate-200 hover:bg-slate-50" data-testid={`template-row-${t.template_id}`}>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{t.key}</td>
                  <td className="px-3 py-2 text-slate-700">{t.channel}</td>
                  <td className="px-3 py-2 text-slate-800 truncate max-w-[280px]">{t.subject}</td>
                  <td className="px-3 py-2 text-[11px] text-slate-500">{(t.variables || []).join(', ') || '—'}</td>
                  <td className="px-3 py-2">{t.is_active ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-slate-400" />}</td>
                  <td className="px-3 py-2 text-right"><button onClick={() => { setEditing(t); setShowForm(true); }} className="p-1.5 text-slate-500 hover:text-slate-800" data-testid={`edit-template-${t.template_id}`}><Edit2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && (
        <TemplateFormModal template={editing} keys={keys} channels={channels} adminId={adminId} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
    </div>
  );
};

const TemplateFormModal = ({ template, keys, channels, adminId, onClose, onSaved }) => {
  const [form, setForm] = useState({
    key: template?.key || keys[0] || 'birthday',
    channel: template?.channel || 'email',
    subject: template?.subject || '',
    body: template?.body || '',
    is_active: template?.is_active ?? true,
  });
  const [preview, setPreview] = useState(null);
  const [ctxJson, setCtxJson] = useState('{"name":"Test User"}');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      if (template?.template_id) {
        await axios.put(`${API}/public/notifications/templates/${template.template_id}`, { subject: form.subject, body: form.body, is_active: form.is_active, admin_id: adminId });
      } else {
        await axios.post(`${API}/public/notifications/templates`, { ...form, admin_id: adminId });
      }
      toast.success('Template saved');
      onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };
  const doPreview = async () => {
    try {
      const ctx = JSON.parse(ctxJson || '{}');
      const r = await axios.post(`${API}/public/notifications/render`, { key: form.key, channel: form.channel, context: ctx });
      setPreview(r.data);
    } catch (e) { toast.error(e.response?.data?.detail || 'Invalid JSON or missing template'); }
  };
  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()} data-testid="template-form-modal">
        <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-900">{template ? 'Edit' : 'New'} Template</h3><button onClick={onClose} className="text-slate-500"><X className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <select disabled={!!template} value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="template-key">
              {keys.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <select disabled={!!template} value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="template-channel">
              {channels.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Subject (use {var} placeholders)" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="template-subject" />
          <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={6} placeholder="Body — use {var} placeholders like {name}, {job_title}" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="template-body" />
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} data-testid="template-active" /> Active</label>
          <div className="border-t border-slate-200 pt-3">
            <p className="text-xs text-slate-500 mb-1">Preview (test render with context JSON)</p>
            <textarea value={ctxJson} onChange={e => setCtxJson(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-900" data-testid="template-ctx" />
            <button onClick={doPreview} className="mt-1 px-3 py-1.5 bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 rounded-lg text-xs" data-testid="template-preview-btn">Preview</button>
            {preview && (
              <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs" data-testid="template-preview-output">
                <p className="font-semibold text-slate-900">Subject: {preview.subject}</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{preview.body}</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <button onClick={onClose} className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm" data-testid="template-save-btn">{saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};


export { SystemTab };
