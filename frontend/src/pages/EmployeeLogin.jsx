// Employee Self-Service Login (Employee ID + password)
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Loader2, Building2, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { API } from '../lib/api';

const EMP_TOKEN_KEY = 'paras_emp_token';
const EMP_INFO_KEY = 'paras_emp_info';

const EmployeeLogin = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem(EMP_TOKEN_KEY)) navigate('/employee/portal', { replace: true });
  }, [navigate]);

  const submit = async (e) => {
    e.preventDefault();
    if (!employeeId.trim() || !password) {
      toast.error('Employee ID and password are required');
      return;
    }
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/public/employee/login`, {
        employee_id: employeeId.trim().toUpperCase(), password,
      });
      localStorage.setItem(EMP_TOKEN_KEY, data.token);
      localStorage.setItem(EMP_INFO_KEY, JSON.stringify(data.employee));
      toast.success(`Welcome, ${data.employee.name}`);
      navigate('/employee/portal', { replace: true });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/40 flex items-center justify-center p-4" data-testid="employee-login-page">
      <Toaster position="top-right" richColors />
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-amber-500/20 items-center justify-center mb-3">
            <Building2 className="w-7 h-7 text-amber-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Employee Portal</h1>
          <p className="text-sm text-slate-500 mt-1">Paras Reward Technologies Pvt. Ltd.</p>
        </div>

        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Employee ID</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g. PR-EMP-00001"
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none uppercase"
                data-testid="employee-id-input"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none"
                data-testid="employee-password-input"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold rounded-lg text-sm transition-colors disabled:opacity-60"
            data-testid="employee-login-submit"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
          </button>

          <p className="text-xs text-center text-slate-500 pt-2 border-t border-slate-100">
            Forgot password? Contact your HR administrator to reset.
          </p>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Not an employee?{' '}
          <a href="/careers" className="text-amber-600 hover:underline">Explore openings</a>
        </p>
      </div>
    </div>
  );
};

export default EmployeeLogin;
