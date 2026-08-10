// Employee Self-Service Portal — Profile, Attendance, Leaves, Payslips, Letters, Appraisals, Announcements
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Building2, User, LogOut, Calendar, ClipboardList, FileText, Award,
  Megaphone, KeyRound, Download, Send, XCircle, Loader2, RefreshCw,
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { API } from '../lib/api';

const EMP_TOKEN_KEY = 'paras_emp_token';
const EMP_INFO_KEY = 'paras_emp_info';

const LEAVE_TYPES = ['casual', 'sick', 'earned', 'comp_off', 'lop', 'maternity', 'paternity'];

const EmployeePortal = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem(EMP_TOKEN_KEY);
  const stored = JSON.parse(localStorage.getItem(EMP_INFO_KEY) || '{}');

  const [tab, setTab] = useState('overview');
  const [profile, setProfile] = useState(stored);
  const [onboarding, setOnboarding] = useState(null);

  const [attendance, setAttendance] = useState({ days: [], summary: {}, total_hours: 0 });
  const [attMonth, setAttMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const [leaves, setLeaves] = useState([]);
  const [balance, setBalance] = useState([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const [payslips, setPayslips] = useState([]);
  const [letters, setLetters] = useState([]);
  const [appraisals, setAppraisals] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [showPwModal, setShowPwModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const authHdr = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const logout = useCallback(() => {
    localStorage.removeItem(EMP_TOKEN_KEY);
    localStorage.removeItem(EMP_INFO_KEY);
    navigate('/employee/login', { replace: true });
  }, [navigate]);

  const handleAxiosError = useCallback((err, fallback = 'Something went wrong') => {
    if (err?.response?.status === 401) {
      toast.error('Session expired. Please login again.');
      logout();
      return;
    }
    const d = err?.response?.data?.detail;
    toast.error(typeof d === 'string' ? d : fallback);
  }, [logout]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [me, att, lv, bal, ps, lt, ap, ann] = await Promise.all([
        axios.get(`${API}/public/employee/me`, { headers: authHdr }),
        axios.get(`${API}/public/employee/attendance?month=${attMonth}`, { headers: authHdr }),
        axios.get(`${API}/public/employee/leaves`, { headers: authHdr }),
        axios.get(`${API}/public/employee/leaves/balance`, { headers: authHdr }),
        axios.get(`${API}/public/employee/payslips`, { headers: authHdr }),
        axios.get(`${API}/public/employee/letters`, { headers: authHdr }),
        axios.get(`${API}/public/employee/appraisals`, { headers: authHdr }),
        axios.get(`${API}/public/employee/announcements`, { headers: authHdr }),
      ]);
      setProfile(me.data.employee);
      setOnboarding(me.data.onboarding_progress);
      setAttendance(att.data);
      setLeaves(lv.data.leaves || []);
      setBalance(bal.data.balance || []);
      setPayslips(ps.data.payslips || []);
      setLetters(lt.data.letters || []);
      setAppraisals(ap.data.appraisals || []);
      setAnnouncements(ann.data.announcements || []);
    } catch (err) {
      handleAxiosError(err, 'Failed to load portal data');
    } finally {
      setLoading(false);
    }
  }, [authHdr, attMonth, handleAxiosError]);

  useEffect(() => {
    if (!token) {
      navigate('/employee/login', { replace: true });
      return;
    }
    fetchAll();
  }, [token, navigate, fetchAll]);

  const downloadFile = async (url, filename) => {
    try {
      const res = await axios.get(`${API}${url}`, { headers: authHdr, responseType: 'blob' });
      const blob = new Blob([res.data]);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      handleAxiosError(err, 'Download failed');
    }
  };

  const cancelLeave = async (leaveId) => {
    if (!window.confirm('Cancel this leave request?')) return;
    try {
      await axios.post(`${API}/public/employee/leaves/${leaveId}/cancel`, {}, { headers: authHdr });
      toast.success('Leave cancelled');
      fetchAll();
    } catch (err) { handleAxiosError(err); }
  };

  if (!token) return null;

  return (
    <div className="min-h-screen bg-slate-50" data-testid="employee-portal">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">Employee Self-Service</h1>
              <p className="text-xs text-slate-500 truncate">
                {profile.name} • {profile.employee_id} • {profile.designation}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchAll} className="p-2 rounded-lg hover:bg-slate-100" title="Refresh" data-testid="portal-refresh">
              <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setShowPwModal(true)} className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-700 hover:bg-slate-100" data-testid="portal-change-password">
              <KeyRound className="w-3.5 h-3.5" /> Password
            </button>
            <button onClick={logout} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-red-600 hover:bg-red-50" data-testid="portal-logout">
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-lg mb-4 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: User },
            { id: 'attendance', label: 'Attendance', icon: Calendar },
            { id: 'leaves', label: 'Leaves', icon: ClipboardList },
            { id: 'payslips', label: 'Payslips', icon: FileText },
            { id: 'letters', label: 'Letters', icon: FileText },
            { id: 'appraisals', label: 'Appraisals', icon: Award },
            { id: 'announcements', label: 'News', icon: Megaphone },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={`portal-tab-${t.id}`}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.id ? 'bg-amber-500 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-5" data-testid="overview-profile">
              <h2 className="text-sm font-bold text-slate-700 mb-3">Personal Info</h2>
              <dl className="grid grid-cols-2 gap-y-3 text-sm">
                <ProfileField label="Employee ID" value={profile.employee_id} />
                <ProfileField label="Name" value={profile.name} />
                <ProfileField label="Email" value={profile.email} />
                <ProfileField label="Phone" value={profile.phone} />
                <ProfileField label="Department" value={profile.department} />
                <ProfileField label="Designation" value={profile.designation} />
                <ProfileField label="Location" value={profile.work_location} />
                <ProfileField label="Joining Date" value={(profile.joining_date || '').slice(0, 10)} />
                <ProfileField label="Hiring Type" value={profile.hiring_type} />
                <ProfileField label="Status" value={profile.status} />
              </dl>
            </div>

            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h2 className="text-sm font-bold text-slate-700 mb-3">Leave Balance ({new Date().getFullYear()})</h2>
                <div className="space-y-2">
                  {balance.filter(b => b.entitlement > 0).map(b => (
                    <div key={b.leave_type} className="flex justify-between text-sm">
                      <span className="capitalize text-slate-600">{b.leave_type.replace('_', ' ')}</span>
                      <span className="font-semibold text-slate-900">{b.remaining} / {b.entitlement}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => { setTab('leaves'); setShowLeaveModal(true); }} className="mt-4 w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-xs font-semibold" data-testid="overview-apply-leave">
                  <Send className="w-3.5 h-3.5 inline mr-1" /> Apply Leave
                </button>
              </div>

              {onboarding && onboarding.total > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5" data-testid="overview-onboarding">
                  <h2 className="text-sm font-bold text-slate-700 mb-2">Onboarding</h2>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>{onboarding.done} of {onboarding.total} tasks</span>
                    <span>{onboarding.percent}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full">
                    <div className="h-2 bg-emerald-500 rounded-full transition-all" style={{ width: `${onboarding.percent}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attendance */}
        {tab === 'attendance' && (
          <div className="bg-white border border-slate-200 rounded-xl p-5" data-testid="attendance-panel">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-sm font-bold text-slate-700">My Attendance</h2>
              <input type="month" value={attMonth} onChange={(e) => setAttMonth(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs" data-testid="attendance-month" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
              {Object.entries(attendance.summary || {}).map(([k, v]) => (
                <div key={k} className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-[10px] uppercase text-slate-500">{k.replace('_', ' ')}</p>
                  <p className="text-lg font-bold text-slate-900">{v}</p>
                </div>
              ))}
            </div>
            <div className="text-xs text-slate-500 mb-2">Total hours: <span className="font-semibold text-slate-800">{attendance.total_hours || 0}</span></div>
            {(attendance.days || []).length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No attendance records for this month.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-2 py-2 text-left">Date</th>
                      <th className="px-2 py-2 text-left">Status</th>
                      <th className="px-2 py-2 text-left">Check-in</th>
                      <th className="px-2 py-2 text-left">Check-out</th>
                      <th className="px-2 py-2 text-right">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.days.map(d => (
                      <tr key={d.date} className="border-b border-slate-100">
                        <td className="px-2 py-1.5 font-mono text-slate-700">{d.date}</td>
                        <td className="px-2 py-1.5 capitalize">{d.status?.replace('_', ' ')}</td>
                        <td className="px-2 py-1.5 text-slate-600">{d.check_in || '—'}</td>
                        <td className="px-2 py-1.5 text-slate-600">{d.check_out || '—'}</td>
                        <td className="px-2 py-1.5 text-right">{d.hours_worked ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Leaves */}
        {tab === 'leaves' && (
          <div className="bg-white border border-slate-200 rounded-xl p-5" data-testid="leaves-panel">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-700">My Leaves</h2>
              <button onClick={() => setShowLeaveModal(true)} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-xs font-semibold" data-testid="leaves-apply-btn">
                <Send className="w-3.5 h-3.5 inline mr-1" /> Apply Leave
              </button>
            </div>
            {leaves.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No leave requests yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-2 py-2 text-left">Type</th>
                      <th className="px-2 py-2 text-left">From → To</th>
                      <th className="px-2 py-2 text-right">Days</th>
                      <th className="px-2 py-2 text-left">Reason</th>
                      <th className="px-2 py-2 text-left">Status</th>
                      <th className="px-2 py-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map(lv => (
                      <tr key={lv.leave_id} className="border-b border-slate-100" data-testid={`leave-row-${lv.leave_id}`}>
                        <td className="px-2 py-1.5 capitalize">{lv.leave_type}</td>
                        <td className="px-2 py-1.5 text-slate-700">{lv.from_date} → {lv.to_date}</td>
                        <td className="px-2 py-1.5 text-right">{lv.days}</td>
                        <td className="px-2 py-1.5 text-slate-600 truncate max-w-[200px]">{lv.reason || '—'}</td>
                        <td className="px-2 py-1.5">
                          <StatusPill status={lv.status} />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {lv.status === 'requested' && (
                            <button onClick={() => cancelLeave(lv.leave_id)} className="text-xs text-red-600 hover:underline" data-testid={`cancel-${lv.leave_id}`}>
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Payslips */}
        {tab === 'payslips' && (
          <div className="bg-white border border-slate-200 rounded-xl p-5" data-testid="payslips-panel">
            <h2 className="text-sm font-bold text-slate-700 mb-4">My Payslips</h2>
            {payslips.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No payslips generated yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {payslips.map(p => (
                  <div key={p.payslip_id} className="bg-slate-50 border border-slate-200 rounded-lg p-4" data-testid={`payslip-${p.payslip_id}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-slate-500">{p.month}</p>
                        <p className="text-sm font-semibold text-slate-900 mt-0.5">
                          ₹ {p.net_pay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Gross: ₹{p.earnings.gross.toLocaleString('en-IN')} • Deducted: ₹{p.deductions.total.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <button onClick={() => downloadFile(p.pdf_url, `${p.payslip_id}.pdf`)} className="flex items-center gap-1 text-xs text-amber-600 hover:underline" data-testid={`payslip-download-${p.payslip_id}`}>
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Letters */}
        {tab === 'letters' && (
          <div className="bg-white border border-slate-200 rounded-xl p-5" data-testid="letters-panel">
            <h2 className="text-sm font-bold text-slate-700 mb-4">My Letters</h2>
            {letters.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No letters issued yet.</p>
            ) : (
              <div className="space-y-2">
                {letters.map(l => (
                  <div key={l.letter_id} className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900 capitalize">{l.kind} Letter</p>
                      <p className="text-xs text-slate-500">Issued {(l.issued_at || '').slice(0, 10)} • {l.letter_id}</p>
                    </div>
                    <button onClick={() => window.open(`${API}${l.pdf_url}`, '_blank')} className="flex items-center gap-1 text-xs text-amber-600 hover:underline" data-testid={`letter-download-${l.letter_id}`}>
                      <Download className="w-3.5 h-3.5" /> Open
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Appraisals */}
        {tab === 'appraisals' && (
          <div className="bg-white border border-slate-200 rounded-xl p-5" data-testid="appraisals-panel">
            <h2 className="text-sm font-bold text-slate-700 mb-4">Performance Appraisals</h2>
            {appraisals.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No finalised appraisals yet.</p>
            ) : (
              <div className="space-y-3">
                {appraisals.map(a => (
                  <div key={a.review_id || a.appraisal_id} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{a.period || 'Appraisal'}</p>
                        <p className="text-xs text-slate-500">Rating: <span className="font-semibold">{a.rating || a.overall_rating || '—'}</span></p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">FINALISED</span>
                    </div>
                    {a.summary && <p className="text-xs text-slate-600 mt-2">{a.summary}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Announcements */}
        {tab === 'announcements' && (
          <div className="space-y-3" data-testid="announcements-panel">
            {announcements.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">No announcements right now.</div>
            ) : (
              announcements.map(a => (
                <div key={a.announcement_id} className={`bg-white border rounded-xl p-4 ${a.pinned ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`} data-testid={`ann-${a.announcement_id}`}>
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {a.pinned && <span className="text-[10px] px-1.5 py-0.5 bg-amber-500 text-white rounded font-semibold">PINNED</span>}
                        <h3 className="text-sm font-bold text-slate-900">{a.title}</h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {(a.published_at || '').slice(0, 10)} • {a.audience === 'all' ? 'Everyone' : a.audience.replace('department:', 'Dept: ')}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{a.body}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Apply Leave Modal */}
      {showLeaveModal && (
        <ApplyLeaveModal onClose={() => setShowLeaveModal(false)} onApplied={() => { setShowLeaveModal(false); fetchAll(); }} authHdr={authHdr} onError={handleAxiosError} />
      )}

      {/* Change Password Modal */}
      {showPwModal && (
        <ChangePasswordModal onClose={() => setShowPwModal(false)} authHdr={authHdr} onError={handleAxiosError} />
      )}
    </div>
  );
};

const ProfileField = ({ label, value }) => (
  <>
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className="text-sm text-slate-900 font-medium">{value || '—'}</dd>
  </>
);

const StatusPill = ({ status }) => {
  const styles = {
    requested: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    cancelled: 'bg-slate-200 text-slate-600',
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${styles[status] || 'bg-slate-100 text-slate-700'}`}>{status?.toUpperCase()}</span>;
};

const ApplyLeaveModal = ({ onClose, onApplied, authHdr, onError }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [type, setType] = useState('casual');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!from || !to) { toast.error('Dates required'); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/public/employee/leaves/apply`, { leave_type: type, from_date: from, to_date: to, reason }, { headers: authHdr });
      toast.success('Leave request submitted');
      onApplied();
    } catch (err) { onError(err, 'Failed to submit leave'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()} data-testid="apply-leave-modal">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-slate-900">Apply for Leave</h3>
          <button onClick={onClose}><XCircle className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Leave Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="leave-type-select">
              {LEAVE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="leave-from" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="leave-to" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" placeholder="Optional but recommended" data-testid="leave-reason" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={submit} disabled={busy} className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg font-semibold disabled:opacity-60" data-testid="leave-submit">
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ChangePasswordModal = ({ onClose, authHdr, onError }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!current || next.length < 6) { toast.error('New password must be 6+ characters'); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/public/employee/change-password`, { current_password: current, new_password: next }, { headers: authHdr });
      toast.success('Password updated');
      onClose();
    } catch (err) { onError(err, 'Password change failed'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()} data-testid="change-pw-modal">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-slate-900">Change Password</h3>
          <button onClick={onClose}><XCircle className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Current Password</label>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="current-pw" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">New Password (6+ chars)</label>
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="new-pw" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={submit} disabled={busy} className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg font-semibold disabled:opacity-60" data-testid="submit-pw-change">
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Update'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeePortal;
