// Payroll Tab — Salary structure setup, Monthly run, Payslip download, Statutory + NEFT CSVs
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Play, Download, X, Settings, Calculator, Trash2, FileDown } from 'lucide-react';
import { API } from '../../../lib/api';

const currencyFmt = (n) => `₹ ${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PayrollTab = ({ employees, onNeedEmployees, adminId }) => {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [showStructModal, setShowStructModal] = useState(null);  // employee object
  const [showRunDetail, setShowRunDetail] = useState(null);       // run id
  const [showConfig, setShowConfig] = useState(false);

  const fetchRuns = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/public/payroll/runs`);
      setRuns(data.runs || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to load runs');
    }
  }, []);

  useEffect(() => {
    if (employees.length === 0) onNeedEmployees?.();
    fetchRuns();
  }, [employees.length, onNeedEmployees, fetchRuns]);

  const cancelRun = async (run) => {
    if (!window.confirm(`Delete payroll run ${run.run_id}? Payslips will be removed.`)) return;
    try {
      await axios.delete(`${API}/public/payroll/run/${run.run_id}`);
      toast.success('Run cancelled');
      fetchRuns();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  const downloadReport = (path, filename) => {
    window.open(`${API}${path}`, '_blank');
    toast.success(`Downloading ${filename}`);
  };

  return (
    <div data-testid="payroll-tab">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Payroll & Compliance</h2>
          <p className="text-xs text-slate-500">Monthly salary runs, payslips, statutory reports</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowConfig(true)} className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs" data-testid="payroll-config-btn">
            <Settings className="w-3.5 h-3.5" /> Config
          </button>
          <button onClick={() => setShowRunModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-xs font-semibold" data-testid="payroll-run-btn">
            <Play className="w-3.5 h-3.5" /> Run Payroll
          </button>
        </div>
      </div>

      {/* Salary Structures section */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-slate-600 mb-2 uppercase">Salary Structures</h3>
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-xs" data-testid="payroll-employees-table">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-left">Department</th>
                <th className="px-3 py-2 text-left">Designation</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-6 text-slate-500">No employees found. Convert applicants to employees first.</td></tr>
              ) : employees.map(e => (
                <tr key={e.employee_id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium">{e.name} <span className="text-slate-400 text-[10px]">({e.employee_id})</span></td>
                  <td className="px-3 py-2 text-slate-600">{e.department}</td>
                  <td className="px-3 py-2 text-slate-600">{e.designation}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setShowStructModal(e)} className="text-xs text-amber-600 hover:underline" data-testid={`edit-struct-${e.employee_id}`}>
                      Edit Salary
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payroll Runs section */}
      <div>
        <h3 className="text-xs font-semibold text-slate-600 mb-2 uppercase">Payroll Runs</h3>
        {runs.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
            No payroll runs yet. Click <span className="font-semibold">Run Payroll</span> to start.
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map(r => (
              <div key={r.run_id} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between flex-wrap gap-2" data-testid={`run-${r.run_id}`}>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{r.month} <span className="text-xs text-slate-400 font-normal">({r.run_id})</span></p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {r.total_employees} employees • Gross {currencyFmt(r.total_gross)} • Net {currencyFmt(r.total_net)} •
                    <span className={`ml-1 ${r.status === 'cancelled' ? 'text-red-500' : 'text-emerald-600'}`}>{r.status?.toUpperCase()}</span>
                  </p>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={() => setShowRunDetail(r.run_id)} className="text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded" data-testid={`view-run-${r.run_id}`}>View</button>
                  <button onClick={() => downloadReport(`/public/payroll/reports/neft?run_id=${r.run_id}`, 'NEFT.csv')} className="text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1">
                    <FileDown className="w-3 h-3" /> NEFT
                  </button>
                  <button onClick={() => downloadReport(`/public/payroll/reports/pf?month=${r.month}`, 'PF.csv')} className="text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded">PF</button>
                  <button onClick={() => downloadReport(`/public/payroll/reports/esi?month=${r.month}`, 'ESI.csv')} className="text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded">ESI</button>
                  <button onClick={() => downloadReport(`/public/payroll/reports/pt?month=${r.month}`, 'PT.csv')} className="text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded">PT</button>
                  {r.status !== 'cancelled' && (
                    <button onClick={() => cancelRun(r)} className="text-xs px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded" data-testid={`cancel-run-${r.run_id}`}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showRunModal && <RunPayrollModal employees={employees} adminId={adminId} onClose={() => setShowRunModal(false)} onDone={() => { setShowRunModal(false); fetchRuns(); }} />}
      {showStructModal && <SalaryStructureModal employee={showStructModal} adminId={adminId} onClose={() => setShowStructModal(null)} />}
      {showRunDetail && <RunDetailModal runId={showRunDetail} onClose={() => setShowRunDetail(null)} />}
      {showConfig && <ConfigModal onClose={() => setShowConfig(false)} />}
    </div>
  );
};

const RunPayrollModal = ({ employees, adminId, onClose, onDone }) => {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedIds, setSelectedIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const toggleAll = () => {
    if (selectedIds.length === employees.length) setSelectedIds([]);
    else setSelectedIds(employees.map(e => e.employee_id));
  };

  const submit = async () => {
    setBusy(true);
    try {
      const body = { month, admin_id: adminId };
      if (selectedIds.length > 0 && selectedIds.length < employees.length) body.employee_ids = selectedIds;
      const { data } = await axios.post(`${API}/public/payroll/run`, body);
      setResult(data);
      toast.success(`Payroll run created: ${data.payslips_generated} payslips`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Payroll run failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="run-payroll-modal">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-slate-900">Run Monthly Payroll</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        {result ? (
          <div className="space-y-3" data-testid="run-payroll-result">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-emerald-800">Payroll ran successfully</p>
              <p className="text-xs text-emerald-700 mt-1">
                Run ID: <span className="font-mono">{result.run.run_id}</span><br />
                Payslips generated: {result.payslips_generated}<br />
                Total gross: {currencyFmt(result.run.total_gross)}<br />
                Total net payable: {currencyFmt(result.run.total_net)}
              </p>
            </div>
            {result.run.skipped?.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-yellow-800 mb-1">{result.run.skipped.length} employees skipped:</p>
                <ul className="text-xs text-yellow-700 space-y-0.5">
                  {result.run.skipped.map((s, i) => <li key={i}>• {s.name} ({s.employee_id}): {s.reason}</li>)}
                </ul>
              </div>
            )}
            <button onClick={onDone} className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-sm font-semibold">Close</button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="text-xs text-slate-500 block mb-1">Payroll Month</label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="run-month" />
            </div>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-slate-500">Include Employees</label>
                <button onClick={toggleAll} className="text-xs text-amber-600 hover:underline">
                  {selectedIds.length === employees.length ? 'Clear all' : 'Select all'}
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                {employees.map(e => (
                  <label key={e.employee_id} className="flex items-center gap-2 text-xs hover:bg-slate-50 px-2 py-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(e.employee_id)}
                      onChange={() => setSelectedIds(prev => prev.includes(e.employee_id) ? prev.filter(id => id !== e.employee_id) : [...prev, e.employee_id])}
                    />
                    <span>{e.name} <span className="text-slate-400">({e.employee_id})</span></span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Leave empty to run for ALL active employees</p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={submit} disabled={busy} className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg font-semibold disabled:opacity-60" data-testid="run-submit">
                {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : <>Run <Calculator className="w-3.5 h-3.5 inline ml-1" /></>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const SalaryStructureModal = ({ employee, adminId, onClose }) => {
  const [form, setForm] = useState({
    monthly_ctc: '', bank_account: '', ifsc: '', pan: '', pf_uan: '', esi_number: '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/public/payroll/salary-structure/${employee.employee_id}`);
        setForm({
          monthly_ctc: data.salary_structure.monthly_ctc || '',
          bank_account: data.salary_structure.bank_account || '',
          ifsc: data.salary_structure.ifsc || '',
          pan: data.salary_structure.pan || '',
          pf_uan: data.salary_structure.pf_uan || '',
          esi_number: data.salary_structure.esi_number || '',
        });
      } catch { /* new record */ }
    })();
  }, [employee.employee_id]);

  const save = async () => {
    if (!form.monthly_ctc || Number(form.monthly_ctc) <= 0) { toast.error('Monthly CTC required'); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/public/payroll/salary-structure/${employee.employee_id}`, {
        ...form, monthly_ctc: Number(form.monthly_ctc), admin_id: adminId,
      });
      toast.success('Salary structure saved');
      onClose();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Save failed'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()} data-testid="struct-modal">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Salary Structure</h3>
            <p className="text-xs text-slate-500">{employee.name} • {employee.employee_id}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <Field label="Monthly CTC (₹)" value={form.monthly_ctc} onChange={(v) => setForm({ ...form, monthly_ctc: v })} type="number" testid="struct-ctc" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank A/c" value={form.bank_account} onChange={(v) => setForm({ ...form, bank_account: v })} testid="struct-bank" />
            <Field label="IFSC" value={form.ifsc} onChange={(v) => setForm({ ...form, ifsc: v.toUpperCase() })} testid="struct-ifsc" />
          </div>
          <Field label="PAN" value={form.pan} onChange={(v) => setForm({ ...form, pan: v.toUpperCase() })} testid="struct-pan" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="PF UAN" value={form.pf_uan} onChange={(v) => setForm({ ...form, pf_uan: v })} testid="struct-uan" />
            <Field label="ESI Number" value={form.esi_number} onChange={(v) => setForm({ ...form, esi_number: v })} testid="struct-esi" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={save} disabled={busy} className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg font-semibold disabled:opacity-60" data-testid="struct-save">
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, type = 'text', testid }) => (
  <div>
    <label className="text-xs text-slate-500 block mb-1">{label}</label>
    <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid={testid} />
  </div>
);

const RunDetailModal = ({ runId, onClose }) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await axios.get(`${API}/public/payroll/run/${runId}`);
        setData(d);
      } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
    })();
  }, [runId]);

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="run-detail-modal">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-slate-900">Payroll Run — {data?.run?.month || '...'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        {!data ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-2 py-2 text-left">Employee</th>
                  <th className="px-2 py-2 text-right">Gross</th>
                  <th className="px-2 py-2 text-right">PF</th>
                  <th className="px-2 py-2 text-right">ESI</th>
                  <th className="px-2 py-2 text-right">PT</th>
                  <th className="px-2 py-2 text-right">TDS</th>
                  <th className="px-2 py-2 text-right">LOP</th>
                  <th className="px-2 py-2 text-right">Net</th>
                  <th className="px-2 py-2 text-right">Slip</th>
                </tr>
              </thead>
              <tbody>
                {data.payslips.map(p => (
                  <tr key={p.payslip_id} className="border-b border-slate-100">
                    <td className="px-2 py-1.5">
                      <p className="font-medium">{p.employee_name}</p>
                      <p className="text-[10px] text-slate-400">{p.employee_id}</p>
                    </td>
                    <td className="px-2 py-1.5 text-right">{p.earnings.gross.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 text-right">{p.deductions.pf.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 text-right">{p.deductions.esi.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 text-right">{p.deductions.professional_tax.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 text-right">{p.deductions.tds.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 text-right">{p.deductions.lop.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{p.net_pay.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 text-right">
                      <a href={`${API}/public/payroll/payslip/${p.payslip_id}/pdf`} target="_blank" rel="noreferrer" className="text-amber-600 hover:underline flex items-center gap-1 justify-end">
                        <Download className="w-3 h-3" /> PDF
                      </a>
                    </td>
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

const ConfigModal = ({ onClose }) => {
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    (async () => {
      const { data } = await axios.get(`${API}/public/payroll/config`);
      setCfg(data.config);
    })();
  }, []);
  const save = async () => {
    setBusy(true);
    try {
      const patch = {
        basic_pct: Number(cfg.basic_pct), hra_pct_of_basic: Number(cfg.hra_pct_of_basic),
        pf_pct: Number(cfg.pf_pct), pf_wage_cap: Number(cfg.pf_wage_cap),
        esi_pct: Number(cfg.esi_pct), esi_gross_cap: Number(cfg.esi_gross_cap),
        pt_amount: Number(cfg.pt_amount), pt_amount_feb: Number(cfg.pt_amount_feb),
        std_deduction_annual: Number(cfg.std_deduction_annual),
      };
      await axios.put(`${API}/public/payroll/config`, patch);
      toast.success('Config updated');
      onClose();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Save failed'); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()} data-testid="config-modal">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-slate-900">Payroll Config</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        {!cfg ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
              {['basic_pct', 'hra_pct_of_basic', 'pf_pct', 'pf_wage_cap', 'esi_pct', 'esi_gross_cap', 'pt_amount', 'pt_amount_feb', 'std_deduction_annual'].map(k => (
                <Field key={k} label={k.replace(/_/g, ' ')} value={cfg[k]} onChange={(v) => setCfg({ ...cfg, [k]: v })} type="number" testid={`cfg-${k}`} />
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-3">Pct fields expect decimals: 0.5 = 50%. Wage caps in ₹.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={save} disabled={busy} className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg font-semibold disabled:opacity-60" data-testid="cfg-save">
                {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export { PayrollTab };
