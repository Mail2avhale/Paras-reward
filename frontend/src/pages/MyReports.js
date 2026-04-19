import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  User, Calendar, DollarSign, Clock, Award, FileText, Download,
  Loader2, RefreshCw, CheckCircle, XCircle, AlertCircle, ArrowLeft,
  Building2, Mail, Phone, Briefcase, TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const STATUS_COLORS = {
  present: 'bg-emerald-100 text-emerald-700',
  absent: 'bg-red-100 text-red-700',
  half_day: 'bg-amber-100 text-amber-700',
  leave: 'bg-blue-100 text-blue-700',
  holiday: 'bg-indigo-100 text-indigo-700'
};

const MyReports = ({ user }) => {
  const u = user || JSON.parse(localStorage.getItem('paras_user') || '{}');
  const userId = u?.uid || u?.user_id || u?.id;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [downloading, setDownloading] = useState('');

  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selFY, setSelFY] = useState(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1);

  const [ytdData, setYtdData] = useState(null);
  const [poolHistory, setPoolHistory] = useState([]);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [attendance, setAttendance] = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      setLoading(true);
      const res = await axios.get(`${API}/employees/reports/my/profile?user_id=${userId}`);
      setProfile(res.data);
    } catch (e) {
      if (e?.response?.status === 404) {
        setProfile({ notEmployee: true });
      } else {
        toast.error('Failed to load profile');
      }
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const download = async (path, filename, key) => {
    setDownloading(key);
    try {
      const res = await axios.get(`${API}${path}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url; link.download = filename;
      document.body.appendChild(link); link.click(); link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${filename} downloaded`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Download failed');
    } finally { setDownloading(''); }
  };

  const fetchYtd = async () => {
    try {
      const res = await axios.get(`${API}/employees/reports/my/ytd?user_id=${userId}&fy_start_year=${selFY}`);
      setYtdData(res.data);
    } catch { toast.error('Failed to load YTD'); }
  };

  const fetchPoolHistory = async () => {
    try {
      const res = await axios.get(`${API}/employees/reports/my/pool-history?user_id=${userId}&limit=100`);
      setPoolHistory(res.data?.transactions || []);
    } catch { toast.error('Failed'); }
  };

  const fetchLeaveHistory = async () => {
    try {
      const res = await axios.get(`${API}/employees/reports/my/leave-history?user_id=${userId}&limit=100`);
      setLeaveHistory(res.data?.leaves || []);
    } catch { toast.error('Failed'); }
  };

  const fetchAttendance = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/employees/reports/my/attendance?user_id=${userId}&month=${selMonth}&year=${selYear}`);
      setAttendance(res.data);
    } catch { toast.error('Failed'); }
  }, [userId, selMonth, selYear]);

  useEffect(() => {
    if (activeTab === 'ytd' && !ytdData) fetchYtd();
    else if (activeTab === 'pool' && poolHistory.length === 0) fetchPoolHistory();
    else if (activeTab === 'leave' && leaveHistory.length === 0) fetchLeaveHistory();
    else if (activeTab === 'attendance' && !attendance) fetchAttendance();
    // eslint-disable-next-line
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'attendance') fetchAttendance();
  }, [selMonth, selYear, activeTab, fetchAttendance]);

  const years = [];
  for (let y = now.getFullYear() - 3; y <= now.getFullYear() + 1; y++) years.push(y);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (profile?.notEmployee) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md text-center bg-white rounded-xl shadow p-6">
          <Briefcase className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">Not an Employee</h2>
          <p className="text-sm text-slate-600 mb-4">
            This portal is for Paras Reward employees only. Your account is not linked to an employee record.
          </p>
          <Link to="/dashboard" className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const emp = profile?.employee || {};
  const lb = profile?.leave_balance || {};

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white px-4 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/dashboard" className="p-2 bg-white/10 hover:bg-white/20 rounded-lg">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold">My Employee Portal</h1>
              <p className="text-xs text-white/80">Payslips · YTD Earnings · Form 16 · Attendance · Leaves</p>
            </div>
            <button onClick={fetchProfile} data-testid="refresh-btn" className="p-2 bg-white/10 hover:bg-white/20 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Profile Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 mt-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">
                {emp.name?.[0] || 'E'}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold">{emp.name}</h2>
                <p className="text-xs text-white/80">{emp.designation} · {emp.department}</p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-white/70">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" />{emp.employee_id}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Joined {String(emp.joining_date || '').slice(0, 10)}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-white/70">Monthly Salary</p>
                <p className="text-xl font-bold">INR {emp.monthly_salary?.toLocaleString() || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto p-4">
        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 -mt-4">
          <MiniCard icon={Award} color="amber" label="Pool (This Month)" value={`${profile?.pool_this_month?.amount?.toFixed(4) || 0} PRC`} sub={`${profile?.pool_this_month?.count || 0} credits`} />
          <MiniCard icon={TrendingUp} color="emerald" label="Pool YTD" value={`${profile?.pool_ytd?.amount?.toFixed(4) || 0} PRC`} sub={`${profile?.pool_ytd?.count || 0} credits`} />
          <MiniCard icon={Clock} color="blue" label="CL Balance" value={lb.cl?.remaining ?? 0} sub={`${lb.cl?.used || 0} used of ${lb.cl?.total || 0}`} />
          <MiniCard icon={Briefcase} color="purple" label="EL Balance" value={lb.el?.remaining ?? 0} sub={`${lb.el?.used || 0} used of ${lb.el?.total || 0}`} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-lg mb-4 overflow-x-auto shadow-sm">
          {[
            { id: 'overview', label: 'Overview', icon: User },
            { id: 'downloads', label: 'Downloads', icon: Download },
            { id: 'ytd', label: 'YTD Summary', icon: TrendingUp },
            { id: 'attendance', label: 'Attendance', icon: Clock },
            { id: 'leave', label: 'Leaves', icon: Calendar },
            { id: 'pool', label: 'Pool History', icon: Award }
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} data-testid={`tab-${t.id}`}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition ${
                activeTab === t.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2"><User className="w-4 h-4" />Personal Information</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <Field label="Employee ID" value={emp.employee_id} />
                <Field label="Full Name" value={emp.name} />
                <Field label="Email" value={emp.email} icon={Mail} />
                <Field label="Mobile" value={emp.mobile} icon={Phone} />
                <Field label="Department" value={emp.department} icon={Building2} />
                <Field label="Designation" value={emp.designation} />
                <Field label="Joining Date" value={String(emp.joining_date || '').slice(0, 10)} />
                <Field label="PAN" value={emp.pan} />
                <Field label="PF UAN" value={emp.pf_uan} />
                <Field label="ESI IP" value={emp.esi_ip} />
                <Field label="Bank Account" value={emp.bank_account} />
                <Field label="IFSC" value={emp.bank_ifsc} />
              </div>

              <div className="border-t pt-4">
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Calendar className="w-4 h-4" />Leave Balance Summary</h3>
                <div className="grid grid-cols-3 gap-3">
                  {['cl', 'sl', 'el'].map(t => (
                    <div key={t} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <p className="text-xs text-slate-500 uppercase">{t === 'cl' ? 'Casual' : t === 'sl' ? 'Sick' : 'Earned'} Leave</p>
                      <p className="text-xl font-bold text-slate-900">{lb[t]?.remaining ?? 0} <span className="text-sm text-slate-400">/ {lb[t]?.total ?? 0}</span></p>
                      <p className="text-[10px] text-slate-500 mt-1">{lb[t]?.used ?? 0} days used this year</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* DOWNLOADS */}
          {activeTab === 'downloads' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-wrap gap-3 items-end">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Month</label>
                  <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))} className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm" data-testid="month-select">
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Year</label>
                  <select value={selYear} onChange={e => setSelYear(Number(e.target.value))} className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm" data-testid="year-select">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Financial Year</label>
                  <select value={selFY} onChange={e => setSelFY(Number(e.target.value))} className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm" data-testid="fy-select">
                    {years.map(y => <option key={y} value={y}>FY {y}-{(y + 1).toString().slice(-2)}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <DLCard
                  icon={FileText} color="blue"
                  title="Payslip (Monthly)"
                  description="Download your monthly salary slip PDF with complete breakdown of earnings, deductions and net pay."
                  btnLabel={`Download ${MONTHS[selMonth - 1]} ${selYear}`}
                  isLoading={downloading === 'payslip'}
                  onDownload={() => download(
                    `/employees/reports/my/payslip?user_id=${userId}&month=${selMonth}&year=${selYear}`,
                    `Payslip_${emp.name?.replace(/\s+/g, '_')}_${MONTHS[selMonth - 1]}_${selYear}.pdf`,
                    'payslip'
                  )}
                  testid="dl-payslip"
                />
                <DLCard
                  icon={Award} color="rose"
                  title="Form 16 (Annual TDS)"
                  description="Annual TDS certificate issued by employer. Required for ITR filing. Part A + Part B."
                  btnLabel={`Download FY ${selFY}-${(selFY + 1).toString().slice(-2)}`}
                  isLoading={downloading === 'form16'}
                  onDownload={() => download(
                    `/employees/reports/my/form-16?user_id=${userId}&fy_start_year=${selFY}`,
                    `Form16_${emp.name?.replace(/\s+/g, '_')}_FY${selFY}-${(selFY + 1).toString().slice(-2)}.pdf`,
                    'form16'
                  )}
                  testid="dl-form16"
                />
              </div>
            </div>
          )}

          {/* YTD */}
          {activeTab === 'ytd' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <select value={selFY} onChange={e => { setSelFY(Number(e.target.value)); setYtdData(null); }} className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm">
                  {years.map(y => <option key={y} value={y}>FY {y}-{(y + 1).toString().slice(-2)}</option>)}
                </select>
                <button onClick={fetchYtd} className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800">Load</button>
              </div>

              {ytdData && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    {[
                      { label: 'Gross YTD', val: ytdData.totals?.gross, color: 'text-emerald-600' },
                      { label: 'Net YTD', val: ytdData.totals?.net, color: 'text-blue-600' },
                      { label: 'PF YTD', val: ytdData.totals?.pf, color: 'text-amber-600' },
                      { label: 'ESI YTD', val: ytdData.totals?.esi, color: 'text-orange-600' },
                      { label: 'TDS YTD', val: ytdData.totals?.tds, color: 'text-rose-600' },
                      { label: 'PT YTD', val: ytdData.totals?.pt, color: 'text-purple-600' }
                    ].map(k => (
                      <div key={k.label} className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-slate-500">{k.label}</p>
                        <p className={`text-sm font-bold ${k.color}`}>INR {k.val?.toLocaleString() || 0}</p>
                      </div>
                    ))}
                  </div>

                  {ytdData.monthly?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border border-slate-200 rounded-lg">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="py-2 px-2 text-left font-semibold text-slate-700">Month</th>
                            <th className="py-2 px-2 text-right font-semibold text-slate-700">Days</th>
                            <th className="py-2 px-2 text-right font-semibold text-slate-700">Gross</th>
                            <th className="py-2 px-2 text-right font-semibold text-slate-700">PF</th>
                            <th className="py-2 px-2 text-right font-semibold text-slate-700">TDS</th>
                            <th className="py-2 px-2 text-right font-semibold text-slate-700">LOP</th>
                            <th className="py-2 px-2 text-right font-semibold text-slate-700">Net</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ytdData.monthly.map((m, i) => (
                            <tr key={i} className="border-t border-slate-100">
                              <td className="py-1.5 px-2">{m.month} {m.year}</td>
                              <td className="py-1.5 px-2 text-right">{m.days_paid}</td>
                              <td className="py-1.5 px-2 text-right text-emerald-600">{m.gross?.toLocaleString()}</td>
                              <td className="py-1.5 px-2 text-right text-amber-600">{m.pf?.toLocaleString()}</td>
                              <td className="py-1.5 px-2 text-right text-rose-600">{m.tds?.toLocaleString()}</td>
                              <td className="py-1.5 px-2 text-right text-orange-600">{m.lop?.toLocaleString()}</td>
                              <td className="py-1.5 px-2 text-right text-blue-600 font-semibold">{m.net?.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic text-center py-8">No salary data for this FY yet</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="space-y-3">
              <div className="flex gap-2 mb-2">
                <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))} className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm">
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select value={selYear} onChange={e => setSelYear(Number(e.target.value))} className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm">
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {attendance?.summary && (
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                    <p className="font-bold text-emerald-700 text-lg">{attendance.summary.present}</p>
                    <p className="text-emerald-600">Present</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <p className="font-bold text-amber-700 text-lg">{attendance.summary.half_day}</p>
                    <p className="text-amber-600">Half Day</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                    <p className="font-bold text-blue-700 text-lg">{attendance.summary.leave}</p>
                    <p className="text-blue-600">Leave</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    <p className="font-bold text-red-700 text-lg">{attendance.summary.absent}</p>
                    <p className="text-red-600">Absent</p>
                  </div>
                </div>
              )}
              {attendance?.days?.length > 0 ? (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {attendance.days.map(d => (
                    <div key={d.date} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-xs">
                      <span className="font-medium text-slate-700">{d.date}</span>
                      <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status] || 'bg-slate-100 text-slate-600'}`}>
                        {d.status?.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic text-center py-8">No attendance records for this month</p>
              )}
            </div>
          )}

          {/* LEAVE */}
          {activeTab === 'leave' && (
            <div className="space-y-2">
              {leaveHistory.length === 0 ? (
                <p className="text-sm text-slate-500 italic text-center py-8">No leave requests yet</p>
              ) : (
                leaveHistory.map(l => (
                  <div key={l.leave_id} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-slate-900 text-sm">{l.leave_type?.toUpperCase() || 'LEAVE'}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            l.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            l.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {l.status === 'approved' ? <CheckCircle className="inline w-3 h-3 mr-1" /> :
                             l.status === 'rejected' ? <XCircle className="inline w-3 h-3 mr-1" /> :
                             <AlertCircle className="inline w-3 h-3 mr-1" />}
                            {l.status}
                          </span>
                          <span className="text-[10px] text-slate-500">{l.days} day{l.days > 1 ? 's' : ''}</span>
                        </div>
                        <p className="text-xs text-slate-600">{l.from_date} → {l.to_date}</p>
                        {l.reason && <p className="text-xs text-slate-500 mt-1 italic">"{l.reason}"</p>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* POOL HISTORY */}
          {activeTab === 'pool' && (
            <div className="space-y-2">
              {poolHistory.length === 0 ? (
                <p className="text-sm text-slate-500 italic text-center py-8">No pool distributions yet</p>
              ) : (
                poolHistory.map((t, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <Award className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">Pool Distribution</p>
                        <p className="text-[10px] text-slate-500">{String(t.timestamp || '').slice(0, 16).replace('T', ' ')}</p>
                      </div>
                    </div>
                    <span className="font-bold text-emerald-600">+{Number(t.amount || 0).toFixed(4)} PRC</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============ Components ============ */
const MiniCard = ({ icon: Icon, color, label, value, sub }) => {
  const colors = {
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700'
  };
  return (
    <div className={`rounded-xl border p-3 ${colors[color]}`}>
      <Icon className="w-4 h-4 opacity-70 mb-1" />
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] opacity-80">{label}</p>
      {sub && <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
};

const Field = ({ label, value, icon: Icon }) => (
  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
    <p className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center gap-1">
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </p>
    <p className="text-sm text-slate-900 font-medium truncate">{value || '—'}</p>
  </div>
);

const DLCard = ({ icon: Icon, color, title, description, btnLabel, isLoading, onDownload, testid }) => {
  const colors = {
    blue: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
    rose: 'bg-rose-100 text-rose-700 hover:bg-rose-200'
  };
  const iconBg = { blue: 'bg-blue-50 text-blue-600', rose: 'bg-rose-50 text-rose-600' };
  return (
    <div className="border border-slate-200 rounded-xl p-4 flex flex-col">
      <div className="flex items-start gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-slate-900">{title}</h4>
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        </div>
      </div>
      <button onClick={onDownload} disabled={isLoading} data-testid={testid}
        className={`mt-auto w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 ${colors[color]}`}>
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {isLoading ? 'Preparing...' : btnLabel}
      </button>
    </div>
  );
};

export default MyReports;
