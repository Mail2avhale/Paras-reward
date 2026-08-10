// Org Chart Tab — Visual hierarchy tree + set manager
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Users, ChevronRight, ChevronDown, UserCog, X, Search } from 'lucide-react';
import { API } from '../../../lib/api';

const OrgChartTab = ({ adminId }) => {
  const [tree, setTree] = useState(null);
  const [flat, setFlat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dept, setDept] = useState('');
  const [editing, setEditing] = useState(null);   // employee obj
  const [search, setSearch] = useState('');

  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const url = dept ? `/public/orgchart/tree?department=${encodeURIComponent(dept)}` : '/public/orgchart/tree';
      const { data } = await axios.get(`${API}${url}`);
      setTree(data);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to load org chart'); }
    finally { setLoading(false); }
  }, [dept]);

  const fetchFlat = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/public/orgchart/flat`);
      setFlat(data.employees || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchTree(); fetchFlat(); }, [fetchTree, fetchFlat]);

  const departments = [...new Set(flat.map(e => e.department).filter(Boolean))].sort();

  return (
    <div data-testid="orgchart-tab">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Organisation Chart</h2>
          <p className="text-xs text-slate-500">
            {tree ? `${tree.total_employees} employees • ${tree.max_depth} levels deep` : 'Loading...'}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={dept} onChange={(e) => setDept(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs" data-testid="orgchart-dept-filter">
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {loading || !tree ? (
        <div className="text-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" /></div>
      ) : tree.tree.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
          No employees to show. Convert applicants to employees to build the chart.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
          <div className="min-w-fit space-y-1">
            {tree.tree.map(node => (
              <OrgNode key={node.employee_id} node={node} depth={0} onEdit={setEditing} />
            ))}
          </div>
          {tree.orphans?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-xs text-yellow-700 font-semibold mb-1">Orphans (manager set but manager doesn&apos;t exist):</p>
              <ul className="text-xs text-slate-600 space-y-0.5">
                {tree.orphans.map(o => <li key={o.employee_id}>• {o.name} ({o.employee_id})</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {editing && <SetManagerModal employee={editing} flat={flat} adminId={adminId} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); fetchTree(); fetchFlat(); }} />}
    </div>
  );
};

const OrgNode = ({ node, depth, onEdit }) => {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.reports && node.reports.length > 0;

  return (
    <div style={{ marginLeft: depth * 24 }} data-testid={`org-node-${node.employee_id}`}>
      <div className="flex items-center gap-2 hover:bg-slate-50 rounded px-2 py-1.5 group">
        {hasChildren ? (
          <button onClick={() => setOpen(!open)} className="text-slate-400">
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-3.5" />
        )}
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${depth === 0 ? 'bg-amber-500 text-slate-900' : depth === 1 ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}`}>
          {(node.name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {node.name}
            {hasChildren && <span className="ml-1.5 text-[10px] text-slate-400">({node.reports.length} report{node.reports.length !== 1 ? 's' : ''})</span>}
          </p>
          <p className="text-[10px] text-slate-500 truncate">
            {node.designation} • {node.department} • {node.employee_id}
          </p>
        </div>
        <button onClick={() => onEdit(node)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-amber-600 p-1" data-testid={`edit-manager-${node.employee_id}`}>
          <UserCog className="w-3.5 h-3.5" />
        </button>
      </div>
      {open && hasChildren && (
        <div>
          {node.reports.map(c => <OrgNode key={c.employee_id} node={c} depth={depth + 1} onEdit={onEdit} />)}
        </div>
      )}
    </div>
  );
};

const SetManagerModal = ({ employee, flat, adminId, onClose, onSaved }) => {
  const [reportsTo, setReportsTo] = useState(employee.reports_to || '');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const options = flat.filter(e =>
    e.employee_id !== employee.employee_id &&
    (search === '' || e.name?.toLowerCase().includes(search.toLowerCase()) || e.employee_id.toLowerCase().includes(search.toLowerCase())),
  );

  const save = async () => {
    setBusy(true);
    try {
      await axios.patch(`${API}/public/orgchart/employees/${employee.employee_id}`, {
        reports_to: reportsTo || null, admin_id: adminId,
      });
      toast.success('Manager updated');
      onSaved();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()} data-testid="set-manager-modal">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Set Reporting Manager</h3>
            <p className="text-xs text-slate-500">For: {employee.name} ({employee.employee_id})</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="manager-search" />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg space-y-0.5 p-1">
          <label className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded text-xs cursor-pointer">
            <input type="radio" name="mgr" checked={!reportsTo} onChange={() => setReportsTo('')} />
            <span className="font-semibold">— None (top-level) —</span>
          </label>
          {options.map(e => (
            <label key={e.employee_id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded text-xs cursor-pointer">
              <input type="radio" name="mgr" checked={reportsTo === e.employee_id} onChange={() => setReportsTo(e.employee_id)} data-testid={`radio-${e.employee_id}`} />
              <span>
                <span className="font-medium">{e.name}</span>
                <span className="text-slate-400 ml-1">— {e.designation}, {e.department}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={save} disabled={busy} className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg font-semibold disabled:opacity-60" data-testid="save-manager">
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export { OrgChartTab };
