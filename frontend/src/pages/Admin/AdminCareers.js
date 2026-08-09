import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Briefcase, Plus, Edit2, Trash2, Users, FileText, Download,
  Loader2, X, Eye, Power, PowerOff, Search, Filter, RefreshCw,
  MessageSquare, Mail, Phone, Calendar, Building2, Clock,
  CheckCircle, XCircle, UserCheck, LayoutGrid, ArrowRight,
  ClipboardList, Video, FileSignature, UserPlus, Send,
  Check, CalendarDays, Coffee, ListChecks, FileBadge,
  ShieldCheck, ScrollText, Bell, Settings,
  BarChart3, LogOut, TrendingUp, AlertCircle
} from 'lucide-react';

import { API } from "../../lib/api";

// Phase A: 30-status color map (spec §10). Legacy statuses aliased for
// backwards compat so existing applications still render nicely.
const STATUS_COLORS = {
  // Legacy aliases (mapped server-side to canonical names)
  new: 'bg-blue-500/20 text-blue-600',
  reviewed: 'bg-yellow-500/20 text-yellow-600',
  interview: 'bg-purple-500/20 text-purple-600',
  hired: 'bg-green-500/30 text-green-600',
  // Canonical 30 statuses
  application_received: 'bg-blue-500/20 text-blue-600',
  under_screening: 'bg-yellow-500/20 text-yellow-700',
  shortlisted: 'bg-emerald-500/20 text-emerald-600',
  test_assigned: 'bg-indigo-500/20 text-indigo-600',
  test_completed: 'bg-indigo-500/30 text-indigo-700',
  test_failed: 'bg-red-500/20 text-red-600',
  hr_interview_scheduled: 'bg-purple-500/20 text-purple-600',
  hr_interview_completed: 'bg-purple-500/30 text-purple-700',
  department_interview_scheduled: 'bg-fuchsia-500/20 text-fuchsia-600',
  department_interview_completed: 'bg-fuchsia-500/30 text-fuchsia-700',
  management_review: 'bg-amber-500/20 text-amber-700',
  selected: 'bg-emerald-500/30 text-emerald-700',
  waitlisted: 'bg-yellow-500/30 text-yellow-700',
  documents_requested: 'bg-sky-500/20 text-sky-600',
  documents_under_verification: 'bg-sky-500/30 text-sky-700',
  documents_verified: 'bg-teal-500/30 text-teal-700',
  documents_rejected: 'bg-red-500/30 text-red-700',
  offer_generated: 'bg-lime-500/20 text-lime-700',
  offer_sent: 'bg-lime-500/30 text-lime-800',
  offer_accepted: 'bg-green-500/30 text-green-700',
  offer_declined: 'bg-red-500/25 text-red-700',
  joining_scheduled: 'bg-cyan-500/20 text-cyan-700',
  joined: 'bg-green-600/30 text-green-800',
  internship: 'bg-violet-500/20 text-violet-700',
  trainee: 'bg-violet-500/30 text-violet-800',
  probation: 'bg-orange-500/20 text-orange-700',
  regular_employee: 'bg-emerald-600/30 text-emerald-800',
  rejected: 'bg-red-500/20 text-red-600',
  application_withdrawn: 'bg-slate-400/30 text-slate-600',
  application_closed: 'bg-slate-500/30 text-slate-700',
};

const formatStatus = (s) => (s || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// Phase A: canonical 30 statuses (spec §10). Legacy 6-status shorthand is
// still accepted server-side but the admin UI drives the full list.
const CANONICAL_STATUSES = [
  'application_received', 'under_screening', 'shortlisted',
  'test_assigned', 'test_completed', 'test_failed',
  'hr_interview_scheduled', 'hr_interview_completed',
  'department_interview_scheduled', 'department_interview_completed',
  'management_review', 'selected', 'waitlisted',
  'documents_requested', 'documents_under_verification', 'documents_verified', 'documents_rejected',
  'offer_generated', 'offer_sent', 'offer_accepted', 'offer_declined',
  'joining_scheduled', 'joined',
  'internship', 'trainee', 'probation', 'regular_employee',
  'rejected', 'application_withdrawn', 'application_closed'
];

const AdminCareers = () => {
  const admin = JSON.parse(localStorage.getItem('paras_user') || '{}');
  const adminId = admin?.uid || admin?.user_id || admin?.id || 'admin';

  const [activeTab, setActiveTab] = useState('jobs');
  const [loading, setLoading] = useState(false);

  // Jobs
  const [jobs, setJobs] = useState([]);
  const [showJobModal, setShowJobModal] = useState(false);
  const [editJob, setEditJob] = useState(null);
  const [meta, setMeta] = useState({ departments: [], job_types: [] });
  const [filterActive, setFilterActive] = useState('all');
  const [jobSearch, setJobSearch] = useState('');

  // Applications
  const [applications, setApplications] = useState([]);
  const [appStats, setAppStats] = useState({});
  const [filterStatus, setFilterStatus] = useState('');
  const [filterJob, setFilterJob] = useState('');
  const [appSearch, setAppSearch] = useState('');
  const [viewApp, setViewApp] = useState(null);
  // Phase A: Kanban pipeline (spec §12)
  const [board, setBoard] = useState([]);
  const [kanbanJob, setKanbanJob] = useState('');
  const [kanbanLoading, setKanbanLoading] = useState(false);

  // Phase B: Tests
  const [tests, setTests] = useState([]);
  const [showTestModal, setShowTestModal] = useState(false);

  // Phase C: Employees
  const [employees, setEmployees] = useState([]);

  // Phase D: Attendance & Leaves
  const [attendance, setAttendance] = useState({ roster: [], by_status: {}, total: 0 });
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaves, setLeaves] = useState([]);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('requested');
  const [employeeToolModal, setEmployeeToolModal] = useState(null); // { employee, kind: 'onboarding'|'letters' }

  // Application quick-actions (Phase B/C/Employee)
  const [actionModal, setActionModal] = useState(null); // { kind: 'test'|'interview'|'offer'|'convert', app }
  const newJobForm = {
    title: '', department: '', location: 'Chatrapati Sambhaji Nagar, Maharashtra',
    job_type: 'Full-time', experience_min: 0, experience_max: 0,
    salary_min: '', salary_max: '', show_salary: false,
    description: '', requirements: '', responsibilities: '', benefits: '',
    is_active: true
  };
  const [form, setForm] = useState(newJobForm);

  /* Fetchers */
  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/public/careers/jobs?active_only=false`);
      setJobs(res.data?.jobs || []);
    } catch { toast.error('Failed to load jobs'); }
    finally { setLoading(false); }
  }, []);

  const fetchMeta = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/public/careers/meta`);
      setMeta(res.data || {});
    } catch {}
  }, []);

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterJob) params.append('job_id', filterJob);
      const res = await axios.get(`${API}/public/careers/applications?${params}`);
      setApplications(res.data?.applications || []);
      // Fetch unfiltered stats separately to keep pill counts global
      if (filterStatus || filterJob) {
        const statsRes = await axios.get(`${API}/public/careers/applications`);
        setAppStats(statsRes.data?.stats || {});
      } else {
        setAppStats(res.data?.stats || {});
      }
    } catch { toast.error('Failed to load applications'); }
    finally { setLoading(false); }
  }, [filterStatus, filterJob]);

  useEffect(() => { fetchJobs(); fetchMeta(); }, [fetchJobs, fetchMeta]);
  useEffect(() => {
    if (activeTab === 'applications') fetchApplications();
  }, [activeTab, fetchApplications]);

  // Phase A: Kanban board fetcher
  const fetchKanban = useCallback(async () => {
    try {
      setKanbanLoading(true);
      const params = kanbanJob ? `?job_id=${encodeURIComponent(kanbanJob)}` : '';
      const res = await axios.get(`${API}/public/careers/kanban${params}`);
      setBoard(res.data?.board || []);
    } catch { toast.error('Failed to load pipeline'); }
    finally { setKanbanLoading(false); }
  }, [kanbanJob]);

  useEffect(() => {
    if (activeTab === 'kanban') fetchKanban();
  }, [activeTab, fetchKanban]);

  // Phase B/C: Tests & Employees fetchers
  const fetchTests = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/public/tests`);
      setTests(res.data?.tests || []);
    } catch { /* silent */ }
  }, []);
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/public/employees`);
      setEmployees(res.data?.employees || []);
    } catch { /* silent */ }
  }, []);
  useEffect(() => {
    if (activeTab === 'tests') fetchTests();
    if (activeTab === 'employees') fetchEmployees();
  }, [activeTab, fetchTests, fetchEmployees]);

  // Phase D: Attendance + Leaves fetchers
  const fetchAttendance = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/public/attendance/roster?date=${attendanceDate}`);
      setAttendance(res.data || { roster: [], by_status: {}, total: 0 });
    } catch { /* silent */ }
  }, [attendanceDate]);
  const fetchLeaves = useCallback(async () => {
    try {
      const params = leaveStatusFilter ? `?status=${leaveStatusFilter}` : '';
      const res = await axios.get(`${API}/public/leaves${params}`);
      setLeaves(res.data?.leaves || []);
    } catch { /* silent */ }
  }, [leaveStatusFilter]);
  useEffect(() => {
    if (activeTab === 'attendance') fetchAttendance();
    if (activeTab === 'leaves') fetchLeaves();
  }, [activeTab, fetchAttendance, fetchLeaves]);

  /* Job Actions */
  const openCreateModal = () => {
    setEditJob(null);
    setForm({ ...newJobForm, department: meta.departments?.[0] || '' });
    setShowJobModal(true);
  };

  const openEditModal = (job) => {
    setEditJob(job);
    setForm({
      ...newJobForm,
      ...job,
      salary_min: job.salary_min ?? '',
      salary_max: job.salary_max ?? ''
    });
    setShowJobModal(true);
  };

  const saveJob = async () => {
    if (!form.title || !form.department || !form.description) {
      toast.error('Title, Department, and Description are required');
      return;
    }
    const payload = {
      ...form,
      experience_min: parseInt(form.experience_min) || 0,
      experience_max: parseInt(form.experience_max) || 0,
      salary_min: form.salary_min ? parseInt(form.salary_min) : null,
      salary_max: form.salary_max ? parseInt(form.salary_max) : null,
      admin_id: adminId
    };
    try {
      if (editJob) {
        await axios.put(`${API}/public/careers/jobs/${editJob.job_id}`, payload);
        toast.success('Job updated');
      } else {
        await axios.post(`${API}/public/careers/jobs/create`, payload);
        toast.success('Job posted');
      }
      setShowJobModal(false);
      fetchJobs();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to save');
    }
  };

  const toggleJobActive = async (job) => {
    try {
      await axios.put(`${API}/public/careers/jobs/${job.job_id}`, { is_active: !job.is_active });
      toast.success(job.is_active ? 'Job deactivated' : 'Job activated');
      fetchJobs();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  const deleteJob = async (job_id) => {
    if (!window.confirm('Delete this job permanently? This does not remove applications.')) return;
    try {
      await axios.delete(`${API}/public/careers/jobs/${job_id}`);
      toast.success('Job deleted');
      fetchJobs();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  /* Application Actions */
  const updateAppStatus = async (app_id, status) => {
    try {
      await axios.put(`${API}/public/careers/applications/${app_id}/status`, { status });
      toast.success(`Status updated to ${status}`);
      fetchApplications();
      if (viewApp?.application_id === app_id) setViewApp({ ...viewApp, status });
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  const addNote = async (app_id, note) => {
    if (!note.trim()) return;
    try {
      await axios.post(`${API}/public/careers/applications/${app_id}/note`, {
        note, admin_id: adminId
      });
      toast.success('Note added');
      fetchApplications();
      if (viewApp?.application_id === app_id) {
        const updated = applications.find(a => a.application_id === app_id);
        setViewApp(updated ? { ...updated, admin_notes: [...(updated.admin_notes || []), { note, admin_id: adminId, created_at: new Date().toISOString() }] } : viewApp);
      }
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  const downloadResume = (app_id) => {
    window.open(`${API}/public/careers/applications/${app_id}/resume`, '_blank');
  };

  const downloadDocument = (app_id, kind) => {
    window.open(`${API}/public/careers/applications/${app_id}/document/${kind}`, '_blank');
  };

  /* Filtered lists */
  const filteredJobs = jobs.filter(j => {
    if (filterActive === 'active' && !j.is_active) return false;
    if (filterActive === 'inactive' && j.is_active) return false;
    if (jobSearch && !j.title?.toLowerCase().includes(jobSearch.toLowerCase())) return false;
    return true;
  });

  const filteredApps = applications.filter(a => {
    if (!appSearch) return true;
    const q = appSearch.toLowerCase();
    return a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q) || a.phone?.includes(q);
  });

  return (
    <div className="min-h-screen bg-white text-slate-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Careers Management</h1>
              <p className="text-xs text-slate-500">Manage job postings & applicants</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { fetchJobs(); if (activeTab === 'applications') fetchApplications(); }} data-testid="refresh-btn" className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-sm">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            {activeTab === 'jobs' && (
              <button onClick={openCreateModal} data-testid="create-job-btn" className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-sm font-semibold">
                <Plus className="w-4 h-4" /> New Job
              </button>
            )}
          </div>
        </div>

        {/* Stats (Applications tab only) */}
        {activeTab === 'applications' && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
            <StatPill label="Total" value={appStats.total || 0} color="slate" />
            <StatPill label="New" value={appStats.new || 0} color="blue" />
            <StatPill label="Reviewed" value={appStats.reviewed || 0} color="yellow" />
            <StatPill label="Shortlisted" value={appStats.shortlisted || 0} color="emerald" />
            <StatPill label="Interview" value={appStats.interview || 0} color="purple" />
            <StatPill label="Hired" value={appStats.hired || 0} color="green" />
          </div>
        )}
        {activeTab === 'jobs' && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatPill label="Total Jobs" value={jobs.length} color="slate" />
            <StatPill label="Active" value={jobs.filter(j => j.is_active).length} color="emerald" />
            <StatPill label="Inactive" value={jobs.filter(j => !j.is_active).length} color="red" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-4">
          {[
            { id: 'jobs', label: 'Job Postings', icon: Briefcase },
            { id: 'applications', label: 'Applications', icon: Users },
            { id: 'kanban', label: 'Pipeline', icon: LayoutGrid },
            { id: 'tests', label: 'Tests', icon: ClipboardList },
            { id: 'employees', label: 'Employees', icon: UserCheck },
            { id: 'attendance', label: 'Attendance', icon: CalendarDays },
            { id: 'leaves', label: 'Leaves', icon: Coffee },
            { id: 'system', label: 'System', icon: Settings },
            { id: 'reports', label: 'Reports', icon: BarChart3 }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              data-testid={`tab-${t.id}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === t.id ? 'bg-slate-200 text-white' : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          {activeTab === 'jobs' && (
            <JobsTab
              jobs={filteredJobs} loading={loading}
              filterActive={filterActive} setFilterActive={setFilterActive}
              search={jobSearch} setSearch={setJobSearch}
              onEdit={openEditModal} onToggle={toggleJobActive} onDelete={deleteJob}
            />
          )}
          {activeTab === 'applications' && (
            <ApplicationsTab
              apps={filteredApps} loading={loading}
              jobs={jobs}
              filterStatus={filterStatus} setFilterStatus={setFilterStatus}
              filterJob={filterJob} setFilterJob={setFilterJob}
              search={appSearch} setSearch={setAppSearch}
              onView={setViewApp} onUpdateStatus={updateAppStatus} onDownloadResume={downloadResume}
            />
          )}
          {activeTab === 'kanban' && (
            <KanbanTab
              board={board}
              loading={kanbanLoading}
              jobs={jobs}
              kanbanJob={kanbanJob}
              setKanbanJob={setKanbanJob}
              onView={setViewApp}
              onUpdateStatus={async (appId, status) => { await updateAppStatus(appId, status); fetchKanban(); }}
            />
          )}
          {activeTab === 'tests' && (
            <TestsTab tests={tests} onCreate={() => setShowTestModal(true)} onDelete={async (id) => {
              if (!window.confirm('Delete this test?')) return;
              try { await axios.delete(`${API}/public/tests/${id}`); toast.success('Deleted'); fetchTests(); } catch { toast.error('Delete failed'); }
            }} />
          )}
          {activeTab === 'employees' && (
            <EmployeesTab employees={employees} onOpenTool={(employee, kind) => setEmployeeToolModal({ employee, kind })} />
          )}
          {activeTab === 'attendance' && (
            <AttendanceTab
              attendance={attendance}
              date={attendanceDate}
              setDate={setAttendanceDate}
              employees={employees}
              onEmployeesRefresh={fetchEmployees}
              onRefresh={fetchAttendance}
              adminId={adminId}
            />
          )}
          {activeTab === 'leaves' && (
            <LeavesTab
              leaves={leaves}
              status={leaveStatusFilter}
              setStatus={setLeaveStatusFilter}
              onRefresh={fetchLeaves}
              adminId={adminId}
            />
          )}
          {activeTab === 'system' && (
            <SystemTab adminId={adminId} />
          )}
          {activeTab === 'reports' && (
            <ReportsTab adminId={adminId} employees={employees} onNeedEmployees={fetchEmployees} />
          )}
        </div>
      </div>

      {/* Job Modal */}
      {showJobModal && (
        <JobModal
          form={form} setForm={setForm} meta={meta}
          editJob={editJob}
          onSave={saveJob}
          onClose={() => setShowJobModal(false)}
        />
      )}

      {/* Application Detail Modal */}
      {viewApp && (
        <ApplicationModal
          app={viewApp}
          onClose={() => setViewApp(null)}
          onUpdateStatus={updateAppStatus}
          onAddNote={addNote}
          onDownloadResume={() => downloadResume(viewApp.application_id)}
          onDownloadDocument={(kind) => downloadDocument(viewApp.application_id, kind)}
          onQuickAction={(kind) => setActionModal({ kind, app: viewApp })}
        />
      )}

      {/* Phase B: Create test modal */}
      {showTestModal && (
        <TestBankModal onClose={() => setShowTestModal(false)} onSaved={() => { setShowTestModal(false); fetchTests(); }} adminId={adminId} />
      )}

      {/* Phase B/C/Employee: Quick action modals from application detail */}
      {actionModal && (
        <QuickActionModal
          kind={actionModal.kind}
          app={actionModal.app}
          tests={tests}
          adminId={adminId}
          onClose={() => setActionModal(null)}
          onDone={() => { setActionModal(null); fetchApplications(); if (activeTab === 'kanban') fetchKanban(); if (activeTab === 'employees') fetchEmployees(); }}
          onNeedTests={fetchTests}
        />
      )}

      {/* Phase D: Employee tools modal (Onboarding checklist + Letters) */}
      {employeeToolModal && (
        <EmployeeToolModal
          employee={employeeToolModal.employee}
          initialTab={employeeToolModal.kind}
          adminId={adminId}
          onClose={() => setEmployeeToolModal(null)}
        />
      )}
    </div>
  );
};

/* ========== Sub-Components ========== */
const StatPill = ({ label, value, color }) => {
  const colors = {
    slate: 'bg-white border-slate-200',
    blue: 'bg-blue-500/10 border-blue-500/30',
    yellow: 'bg-yellow-500/10 border-yellow-500/30',
    emerald: 'bg-emerald-500/10 border-emerald-500/30',
    purple: 'bg-purple-500/10 border-purple-500/30',
    green: 'bg-green-500/15 border-green-500/40',
    red: 'bg-red-500/10 border-red-500/30'
  };
  return (
    <div className={`rounded-xl border p-3 ${colors[color]}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
    </div>
  );
};

const JobsTab = ({ jobs, loading, filterActive, setFilterActive, search, setSearch, onEdit, onToggle, onDelete }) => (
  <div>
    <div className="flex flex-wrap gap-2 mb-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs by title..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" data-testid="search-jobs" />
      </div>
      <select value={filterActive} onChange={e => setFilterActive(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" data-testid="filter-active">
        <option value="all">All</option>
        <option value="active">Active only</option>
        <option value="inactive">Inactive only</option>
      </select>
    </div>

    {loading ? (
      <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
    ) : jobs.length === 0 ? (
      <div className="text-center py-12 text-slate-500">No jobs found. Click "New Job" to create one.</div>
    ) : (
      <div className="space-y-2">
        {jobs.map(j => (
          <div key={j.job_id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 hover:border-slate-600" data-testid={`job-${j.job_id}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`w-2 h-2 rounded-full ${j.is_active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  <h3 className="font-semibold text-slate-900">{j.title}</h3>
                  <span className="text-xs text-slate-500">• {j.job_id}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{j.department}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{j.job_type}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{j.application_count || 0} applied</span>
                  {j.show_salary && j.salary_min && (
                    <span className="text-emerald-600">{j.salary_min?.toLocaleString()} - {j.salary_max?.toLocaleString()} INR</span>
                  )}
                </div>
                <p className="text-sm text-slate-500 line-clamp-1 mt-2">{j.description}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => onToggle(j)} title={j.is_active ? 'Deactivate' : 'Activate'} className={`p-2 rounded-lg ${j.is_active ? 'text-emerald-600 hover:bg-emerald-500/10' : 'text-slate-500 hover:bg-slate-100'}`} data-testid={`toggle-${j.job_id}`}>
                  {j.is_active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                </button>
                <button onClick={() => onEdit(j)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg" data-testid={`edit-${j.job_id}`}>
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(j.job_id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-lg" data-testid={`delete-${j.job_id}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const ApplicationsTab = ({ apps, loading, jobs, filterStatus, setFilterStatus, filterJob, setFilterJob, search, setSearch, onView, onUpdateStatus, onDownloadResume }) => (
  <div>
    <div className="flex flex-wrap gap-2 mb-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, phone..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" data-testid="search-applications" />
      </div>
      <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" data-testid="filter-status">
        <option value="">All Statuses</option>
        {CANONICAL_STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
      </select>
      <select value={filterJob} onChange={e => setFilterJob(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" data-testid="filter-job">
        <option value="">All Jobs</option>
        {jobs.map(j => <option key={j.job_id} value={j.job_id}>{j.title}</option>)}
      </select>
    </div>

    {loading ? (
      <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
    ) : apps.length === 0 ? (
      <div className="text-center py-12 text-slate-500">No applications found</div>
    ) : (
      <div className="space-y-2">
        {apps.map(a => (
          <div key={a.application_id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:border-slate-600 cursor-pointer" onClick={() => onView(a)} data-testid={`app-${a.application_id}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h4 className="font-semibold text-slate-900">{a.name}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[a.status] || 'bg-slate-200 text-slate-700'}`}>
                    {formatStatus(a.status)}
                  </span>
                  <span className="text-xs text-slate-500">• Applied for {a.job_title}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{a.email}</span>
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{a.phone}</span>
                  <span>{a.experience_years}y exp</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{a.created_at?.slice(0, 10)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <select
                  value={a.status}
                  onChange={e => onUpdateStatus(a.application_id, e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                  data-testid={`status-${a.application_id}`}
                >
                  {CANONICAL_STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
                </select>
                <button onClick={() => onDownloadResume(a.application_id)} title="Download Resume" className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg" data-testid={`resume-${a.application_id}`}>
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const JobModal = ({ form, setForm, meta, editJob, onSave, onClose }) => (
  <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <h3 className="font-bold text-slate-900">{editJob ? 'Edit Job' : 'Create New Job'}</h3>
        <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-50 rounded-lg"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-4 overflow-y-auto flex-1 space-y-3">
        <Input label="Title *" value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))} testid="job-title" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Department *" value={form.department} onChange={v => setForm(p => ({ ...p, department: v }))} options={meta.departments || []} testid="job-dept" />
          <Select label="Job Type" value={form.job_type} onChange={v => setForm(p => ({ ...p, job_type: v }))} options={meta.job_types || []} testid="job-type" />
        </div>
        <Input label="Location" value={form.location} onChange={v => setForm(p => ({ ...p, location: v }))} testid="job-location" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Min Experience (yrs)" type="number" value={form.experience_min} onChange={v => setForm(p => ({ ...p, experience_min: v }))} />
          <Input label="Max Experience (yrs)" type="number" value={form.experience_max} onChange={v => setForm(p => ({ ...p, experience_max: v }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Salary Min (INR/mo)" type="number" value={form.salary_min} onChange={v => setForm(p => ({ ...p, salary_min: v }))} />
          <Input label="Salary Max (INR/mo)" type="number" value={form.salary_max} onChange={v => setForm(p => ({ ...p, salary_max: v }))} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.show_salary} onChange={e => setForm(p => ({ ...p, show_salary: e.target.checked }))} />
          Show salary publicly
        </label>
        <Textarea label="Description *" value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} rows={3} testid="job-description" />
        <Textarea label="Responsibilities" value={form.responsibilities} onChange={v => setForm(p => ({ ...p, responsibilities: v }))} rows={3} />
        <Textarea label="Requirements" value={form.requirements} onChange={v => setForm(p => ({ ...p, requirements: v }))} rows={3} />
        <Textarea label="Benefits" value={form.benefits} onChange={v => setForm(p => ({ ...p, benefits: v }))} rows={2} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} data-testid="job-active" />
          Active (visible on public Careers page)
        </label>
      </div>
      <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
        <button onClick={onClose} className="px-4 py-2 bg-slate-200 hover:bg-slate-600 rounded-lg text-sm">Cancel</button>
        <button onClick={onSave} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-sm font-semibold" data-testid="save-job-btn">
          {editJob ? 'Update Job' : 'Create Job'}
        </button>
      </div>
    </div>
  </div>
);

const ApplicationModal = ({ app, onClose, onUpdateStatus, onAddNote, onDownloadResume, onDownloadDocument, onQuickAction }) => {
  const [note, setNote] = useState('');
  const hasAadhaar = !!app.aadhaar_path;
  const hasPan = !!app.pan_path;
  const hasMarksheet = !!app.marksheet_path;
  const education = Array.isArray(app.education) ? app.education : [];
  const workHistory = Array.isArray(app.work_history) ? app.work_history : [];
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-900">{app.name}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-50 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Email" value={app.email} />
            <Field label="Phone" value={app.phone} />
            <Field label="Experience" value={`${app.experience_years} years`} />
            <Field label="Applied For" value={app.job_title} />
            <Field label="Applied On" value={app.created_at?.slice(0, 10)} />
            <Field label="LinkedIn" value={app.linkedin || '—'} />
          </div>
          {app.cover_letter && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Cover Letter</p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap">{app.cover_letter}</div>
            </div>
          )}

          {/* Phase 3 extended — Supporting Docs quick download */}
          {(hasAadhaar || hasPan || hasMarksheet) && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Supporting Documents</p>
              <div className="flex flex-wrap gap-2">
                {hasAadhaar && (
                  <button onClick={() => onDownloadDocument && onDownloadDocument('aadhaar')} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs text-slate-700" data-testid="download-aadhaar-btn">
                    <Download className="w-3.5 h-3.5" /> Aadhaar
                  </button>
                )}
                {hasPan && (
                  <button onClick={() => onDownloadDocument && onDownloadDocument('pan')} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs text-slate-700" data-testid="download-pan-btn">
                    <Download className="w-3.5 h-3.5" /> PAN
                  </button>
                )}
                {hasMarksheet && (
                  <button onClick={() => onDownloadDocument && onDownloadDocument('marksheet')} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs text-slate-700" data-testid="download-marksheet-btn">
                    <Download className="w-3.5 h-3.5" /> Marksheet
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Phase 3 extended — Education */}
          {education.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Education</p>
              <div className="space-y-2">
                {education.map((e, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700">
                    <p className="font-semibold text-slate-900">{e.degree || '—'} <span className="font-normal text-slate-500">• {e.institution || '—'}</span></p>
                    <p className="text-slate-500">Year: {e.year || '—'} • Marks: {e.marks || '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Phase 3 extended — Work History */}
          {workHistory.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Work Experience</p>
              <div className="space-y-2">
                {workHistory.map((w, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700">
                    <p className="font-semibold text-slate-900">{w.role || '—'} <span className="font-normal text-slate-500">@ {w.company || '—'}</span></p>
                    <p className="text-slate-500">{w.from || '—'} → {w.to || '—'}</p>
                    {w.description && <p className="text-slate-700 mt-1 whitespace-pre-wrap">{w.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-slate-500 mb-1">Status</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1.5 rounded-lg text-xs font-medium ring-2 ring-current ${STATUS_COLORS[app.status] || 'bg-slate-100 text-slate-600'}`} data-testid="current-status-badge">
                {formatStatus(app.status)}
              </span>
              <select
                value=""
                onChange={e => { if (e.target.value) onUpdateStatus(app.application_id, e.target.value); }}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
                data-testid="modal-status-select"
              >
                <option value="">Move to…</option>
                {CANONICAL_STATUSES.filter(s => s !== app.status).map(s => (
                  <option key={s} value={s}>{formatStatus(s)}</option>
                ))}
              </select>
            </div>
            {Array.isArray(app.status_history) && app.status_history.length > 0 && (
              <details className="mt-2 text-xs text-slate-500">
                <summary className="cursor-pointer hover:text-slate-700" data-testid="status-history-toggle">
                  View history ({app.status_history.length})
                </summary>
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-2">
                  {app.status_history.slice().reverse().map((h, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="text-slate-400 shrink-0">{h.at?.slice(0, 16).replace('T', ' ')}</span>
                      <span className="text-slate-600">
                        {h.from ? formatStatus(h.from) : '—'} → <span className="font-semibold text-slate-800">{formatStatus(h.to)}</span>
                      </span>
                      <span className="text-slate-400">by {h.by || 'system'}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* Phase B/C/Employee: HR quick actions */}
          {onQuickAction && (
            <div>
              <p className="text-xs text-slate-500 mb-2">HR Actions</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button onClick={() => onQuickAction('test')} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-medium" data-testid="hr-action-assign-test">
                  <ClipboardList className="w-4 h-4" /> Assign Test
                </button>
                <button onClick={() => onQuickAction('interview')} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-200 text-purple-700 rounded-lg text-xs font-medium" data-testid="hr-action-schedule-interview">
                  <Video className="w-4 h-4" /> Schedule Interview
                </button>
                <button onClick={() => onQuickAction('offer')} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-medium" data-testid="hr-action-generate-offer">
                  <FileSignature className="w-4 h-4" /> Generate Offer
                </button>
                <button onClick={() => onQuickAction('convert')} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-200 text-amber-700 rounded-lg text-xs font-medium" data-testid="hr-action-convert-employee">
                  <UserPlus className="w-4 h-4" /> Convert to Employee
                </button>
              </div>
            </div>
          )}


          <div>
            <p className="text-xs text-slate-500 mb-1">Admin Notes ({app.admin_notes?.length || 0})</p>
            {app.admin_notes?.length > 0 && (
              <div className="space-y-2 mb-2 max-h-40 overflow-y-auto">
                {app.admin_notes.map((n, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs">
                    <p className="text-slate-700">{n.note}</p>
                    <p className="text-slate-500 mt-1">— {n.admin_id} • {n.created_at?.slice(0, 16).replace('T', ' ')}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Add internal note..." className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" data-testid="note-input" />
              <button onClick={() => { onAddNote(app.application_id, note); setNote(''); }} className="px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm text-white" data-testid="add-note-btn">Add</button>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
          <button onClick={onDownloadResume} className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm" data-testid="download-resume-btn">
            <Download className="w-4 h-4" /> Download Resume
          </button>
        </div>
      </div>
    </div>
  );
};

const Input = ({ label, value, onChange, type = 'text', testid }) => (
  <div>
    <label className="text-xs text-slate-500 mb-1 block">{label}</label>
    <input
      type={type} value={value ?? ''} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900"
      data-testid={testid}
    />
  </div>
);
const Select = ({ label, value, onChange, options, testid }) => (
  <div>
    <label className="text-xs text-slate-500 mb-1 block">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900" data-testid={testid}>
      <option value="">Select...</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);
const Textarea = ({ label, value, onChange, rows = 2, testid }) => (
  <div>
    <label className="text-xs text-slate-500 mb-1 block">{label}</label>
    <textarea
      value={value ?? ''} onChange={e => onChange(e.target.value)}
      rows={rows}
      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 resize-none"
      data-testid={testid}
    />
  </div>
);
const Field = ({ label, value }) => (
  <div>
    <p className="text-xs text-slate-500">{label}</p>
    <p className="text-sm text-slate-200 truncate">{value || '—'}</p>
  </div>
);

/* ========== Phase A: Recruitment Pipeline (Kanban) ========== */
const KanbanTab = ({ board, loading, jobs, kanbanJob, setKanbanJob, onView, onUpdateStatus }) => {
  if (loading) return <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto" /></div>;

  const nonEmpty = board.filter(col => col.count > 0);
  const totalApps = board.reduce((s, c) => s + c.count, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={kanbanJob}
          onChange={e => setKanbanJob(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900"
          data-testid="kanban-job-filter"
        >
          <option value="">All jobs</option>
          {jobs.map(j => (
            <option key={j.job_id} value={j.job_id}>
              {j.title} {j.job_code ? `(${j.job_code})` : ''}
            </option>
          ))}
        </select>
        <p className="text-sm text-slate-500">
          Showing <span className="font-semibold text-slate-900">{totalApps}</span> applications across{' '}
          <span className="font-semibold text-slate-900">{nonEmpty.length}</span> active stages
        </p>
      </div>

      {totalApps === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm" data-testid="kanban-empty">
          No applications yet for the selected filter.
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3" data-testid="kanban-board">
          {board.map(col => (
            <div key={col.status} className="min-w-[260px] w-[260px] shrink-0 bg-white border border-slate-200 rounded-lg" data-testid={`kanban-col-${col.status}`}>
              <div className={`flex items-center justify-between px-3 py-2 border-b border-slate-200 rounded-t-lg ${STATUS_COLORS[col.status] || 'bg-slate-100 text-slate-700'}`}>
                <span className="text-xs font-semibold uppercase tracking-wide truncate">{col.label}</span>
                <span className="text-xs font-bold bg-white/70 text-slate-800 px-1.5 py-0.5 rounded">{col.count}</span>
              </div>
              <div className="p-2 space-y-2 max-h-[520px] overflow-y-auto">
                {col.applications.length === 0 && (
                  <p className="text-[11px] text-slate-400 text-center py-3">Empty</p>
                )}
                {col.applications.map(a => (
                  <div key={a.application_id} className="bg-slate-50 border border-slate-200 hover:border-amber-400 rounded-lg p-2 cursor-pointer" onClick={() => onView(a)} data-testid={`kanban-card-${a.application_id}`}>
                    <p className="text-sm font-semibold text-slate-900 truncate">{a.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{a.application_id}</p>
                    <p className="text-[11px] text-slate-500 truncate">{a.job_title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-slate-400">{a.recruitment_source || 'Website'}</span>
                      <KanbanQuickMove appId={a.application_id} current={col.status} onUpdateStatus={onUpdateStatus} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const _KANBAN_QUICK_TRANSITIONS = [
  'under_screening', 'shortlisted', 'test_assigned', 'hr_interview_scheduled',
  'selected', 'documents_verified', 'offer_generated', 'offer_accepted',
  'joined', 'rejected', 'application_withdrawn'
];

const KanbanQuickMove = ({ appId, current, onUpdateStatus }) => (
  <select
    value=""
    onChange={e => { e.stopPropagation(); if (e.target.value) onUpdateStatus(appId, e.target.value); }}
    onClick={e => e.stopPropagation()}
    className="text-[10px] px-1 py-0.5 bg-white border border-slate-300 rounded"
    data-testid={`kanban-move-${appId}`}
  >
    <option value="">Move…</option>
    {_KANBAN_QUICK_TRANSITIONS.filter(s => s !== current).map(s => (
      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
    ))}
  </select>
);

/* ========== Phase B: Test Bank Tab ========== */
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

/* ========== Phase D skeleton: Employees Tab ========== */
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

/* ========== Phase B: Create Test Modal ========== */
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

/* ========== Phase D: Attendance Tab ========== */
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

/* ========== Phase D: Leaves Tab ========== */
const LeavesTab = ({ leaves, status, setStatus, onRefresh, adminId }) => {
  const [busy, setBusy] = useState(null);
  const decide = async (leave_id, action) => {
    const comment = action === 'reject' ? (window.prompt('Reason for rejection?') || '') : '';
    setBusy(leave_id);
    try {
      await axios.post(`${API}/public/leaves/${leave_id}/decision`, { action, approver: adminId, comment });
      toast.success(`Leave ${action}d`);
      onRefresh();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setBusy(null); }
  };
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" data-testid="leaves-status-filter">
          <option value="">All</option>
          {['requested', 'approved', 'rejected', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={onRefresh} className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700" data-testid="leaves-refresh"><RefreshCw className="w-4 h-4" /> Refresh</button>
        <p className="ml-auto text-sm text-slate-500">Total: <span className="font-semibold text-slate-900">{leaves.length}</span></p>
      </div>
      {leaves.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm" data-testid="leaves-empty">No leaves found for this filter.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="leaves-table">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">Leave ID</th>
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Dates</th>
                <th className="px-3 py-2 text-left">Days</th>
                <th className="px-3 py-2 text-left">Reason</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map(l => (
                <tr key={l.leave_id} className="border-b border-slate-200 hover:bg-slate-50" data-testid={`leave-row-${l.leave_id}`}>
                  <td className="px-3 py-2 text-xs font-mono text-slate-500">{l.leave_id}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{l.employee_name}<br /><span className="text-[11px] text-slate-500 font-mono">{l.employee_id}</span></td>
                  <td className="px-3 py-2 text-slate-700 uppercase">{l.leave_type}</td>
                  <td className="px-3 py-2 text-slate-700">{l.from_date} → {l.to_date}</td>
                  <td className="px-3 py-2 text-slate-700">{l.days}</td>
                  <td className="px-3 py-2 text-slate-700 truncate max-w-[200px]">{l.reason || '—'}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[11px] uppercase font-semibold ${l.status === 'approved' ? 'bg-emerald-500/20 text-emerald-700' : l.status === 'rejected' ? 'bg-red-500/20 text-red-700' : l.status === 'cancelled' ? 'bg-slate-300 text-slate-700' : 'bg-amber-500/20 text-amber-700'}`}>{l.status}</span></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {l.status === 'requested' && (
                      <>
                        <button disabled={busy === l.leave_id} onClick={() => decide(l.leave_id, 'approve')} className="inline-flex items-center gap-1 px-2 py-1 text-xs text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 rounded disabled:opacity-50" data-testid={`leave-approve-${l.leave_id}`}><Check className="w-3.5 h-3.5" /> Approve</button>
                        <button disabled={busy === l.leave_id} onClick={() => decide(l.leave_id, 'reject')} className="ml-1 inline-flex items-center gap-1 px-2 py-1 text-xs text-red-700 bg-red-500/10 hover:bg-red-500/20 rounded disabled:opacity-50" data-testid={`leave-reject-${l.leave_id}`}><X className="w-3.5 h-3.5" /> Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ========== Phase D: Employee Tools (Onboarding checklist + Letters) ========== */
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

/* ========== Phase G: System tab — Audit + RBAC + Templates ========== */
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

/* ========== Phase H: Reports tab — Analytics + Separations ========== */
const ReportsTab = ({ adminId, employees, onNeedEmployees }) => {
  const [sub, setSub] = useState('analytics');
  useEffect(() => { if (employees.length === 0) onNeedEmployees && onNeedEmployees(); }, [employees.length, onNeedEmployees]);
  return (
    <div>
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-4 max-w-md">
        {[['analytics', 'HR Analytics', BarChart3], ['separations', 'Separations', LogOut]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setSub(id)} className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-md text-xs font-medium ${sub === id ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`} data-testid={`reports-sub-${id}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      {sub === 'analytics' && <AnalyticsPane />}
      {sub === 'separations' && <SeparationsPane employees={employees} adminId={adminId} />}
    </div>
  );
};

const AnalyticsPane = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ from: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/public/reports/hr-dashboard?from_date=${range.from}&to_date=${range.to}`);
      setData(r.data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  }, [range]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto my-8" />;
  if (!data) return <div className="text-center py-8 text-slate-500 text-sm" data-testid="analytics-empty">No report available.</div>;

  const t = data.totals || {};
  return (
    <div className="space-y-4" data-testid="analytics-pane">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" data-testid="analytics-from" />
        <input type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" data-testid="analytics-to" />
        <button onClick={load} className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700" data-testid="analytics-refresh"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          ['Applications', t.applications, 'bg-blue-500/10 text-blue-700'],
          ['Active Employees', t.active_employees, 'bg-emerald-500/10 text-emerald-700'],
          ['Open Jobs', t.open_jobs, 'bg-purple-500/10 text-purple-700'],
          ['Total Vacancies', t.total_vacancies, 'bg-amber-500/10 text-amber-700'],
          ['Filled', t.vacancies_filled, 'bg-teal-500/10 text-teal-700'],
          ['Remaining', t.vacancies_remaining, 'bg-fuchsia-500/10 text-fuchsia-700'],
        ].map(([label, val, cls], i) => (
          <div key={i} className={`p-3 rounded-lg ${cls}`} data-testid={`kpi-${label.toLowerCase().replace(/ /g, '-')}`}>
            <p className="text-[10px] uppercase font-semibold">{label}</p>
            <p className="text-2xl font-bold">{val ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Time-to-hire + attrition */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-lg" data-testid="time-to-hire-card">
          <p className="text-xs text-slate-500 uppercase font-semibold">Avg Time-to-Hire</p>
          <p className="text-2xl font-bold text-slate-900 flex items-baseline gap-1"><Clock className="w-5 h-5 text-slate-400" /> {data.time_to_hire?.average_days ?? 0} <span className="text-sm font-normal text-slate-500">days</span></p>
          <p className="text-[11px] text-slate-500">sample: {data.time_to_hire?.sample_size ?? 0}</p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg" data-testid="attrition-card">
          <p className="text-xs text-slate-500 uppercase font-semibold">Attrition</p>
          <p className="text-2xl font-bold text-slate-900 flex items-baseline gap-1"><TrendingUp className="w-5 h-5 text-slate-400" /> {data.attrition?.attrition_pct ?? 0}<span className="text-sm font-normal text-slate-500">%</span></p>
          <p className="text-[11px] text-slate-500">separated: {data.attrition?.separated_in_range ?? 0}</p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg" data-testid="pending-actions-card">
          <p className="text-xs text-slate-500 uppercase font-semibold">Pending HR Actions</p>
          <div className="mt-1 space-y-0.5 text-xs">
            {Object.entries(data.pending_hr_actions || {}).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-slate-600">{k.replace(/_/g, ' ')}</span>
                <span className="font-semibold text-slate-900">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Funnel */}
      <div className="p-3 bg-white border border-slate-200 rounded-lg" data-testid="funnel-card">
        <p className="text-sm font-semibold text-slate-900 mb-2">Recruitment Funnel</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(data.recruitment_funnel || {}).sort((a, b) => b[1] - a[1]).map(([s, c]) => (
            <span key={s} className="px-2 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700" data-testid={`funnel-${s}`}>
              {s.replace(/_/g, ' ')}: <span className="font-bold text-slate-900">{c}</span>
            </span>
          ))}
          {!Object.keys(data.recruitment_funnel || {}).length && <p className="text-xs text-slate-500">No applications in range.</p>}
        </div>
      </div>

      {/* Source ROI */}
      <div className="p-3 bg-white border border-slate-200 rounded-lg" data-testid="source-roi-card">
        <p className="text-sm font-semibold text-slate-900 mb-2">Recruitment Source ROI</p>
        {(data.source_roi || []).length === 0 ? <p className="text-xs text-slate-500">No source data yet.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr><th className="px-2 py-1.5 text-left">Source</th><th className="px-2 py-1.5 text-left">Applications</th><th className="px-2 py-1.5 text-left">Joined</th><th className="px-2 py-1.5 text-left">Conversion</th></tr>
            </thead>
            <tbody>
              {data.source_roi.map((s, i) => (
                <tr key={`${s.source}-${i}`} className="border-b border-slate-100" data-testid={`source-row-${s.source}`}>
                  <td className="px-2 py-1.5 text-slate-800">{s.source}</td>
                  <td className="px-2 py-1.5 text-slate-700">{s.applications}</td>
                  <td className="px-2 py-1.5 text-slate-700">{s.joined}</td>
                  <td className="px-2 py-1.5 text-slate-700">{s.conversion_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Department distribution */}
      <div className="p-3 bg-white border border-slate-200 rounded-lg" data-testid="departments-card">
        <p className="text-sm font-semibold text-slate-900 mb-2">Headcount by Department</p>
        {(data.headcount_by_department || []).length === 0 ? <p className="text-xs text-slate-500">No employees yet.</p> : (
          <div className="flex flex-wrap gap-1.5">
            {data.headcount_by_department.map(d => (
              <span key={d.department} className="px-2 py-1 rounded-full text-[11px] bg-slate-100 text-slate-700" data-testid={`dept-${d.department}`}>{d.department}: <span className="font-bold text-slate-900">{d.count}</span></span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const SeparationsPane = ({ employees, adminId }) => {
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [showInit, setShowInit] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = statusFilter ? `?status=${statusFilter}` : '';
      const r = await axios.get(`${API}/public/separations${p}`);
      setRows(r.data?.separations || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [statusFilter]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" data-testid="sep-status-filter">
          <option value="">All statuses</option>
          {['initiated', 'in_clearance', 'cleared', 'fnf_calculated', 'fnf_paid', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700" data-testid="sep-refresh"><RefreshCw className="w-4 h-4" /> Refresh</button>
        <button onClick={() => setShowInit(true)} className="ml-auto flex items-center gap-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm" data-testid="sep-initiate-btn"><Plus className="w-4 h-4" /> Initiate Separation</button>
      </div>
      {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" /> : rows.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm" data-testid="sep-empty">No separations for this filter.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="sep-table">
            <thead className="bg-slate-100 text-slate-700">
              <tr><th className="px-3 py-2 text-left">ID</th><th className="px-3 py-2 text-left">Employee</th><th className="px-3 py-2 text-left">Kind</th><th className="px-3 py-2 text-left">LWD</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.separation_id} className="border-b border-slate-200 hover:bg-slate-50" data-testid={`sep-row-${r.separation_id}`}>
                  <td className="px-3 py-2 text-[11px] font-mono text-slate-500">{r.separation_id}</td>
                  <td className="px-3 py-2 text-slate-800">{r.employee_name}<br /><span className="text-[11px] text-slate-500 font-mono">{r.employee_id}</span></td>
                  <td className="px-3 py-2 text-slate-700">{r.kind}</td>
                  <td className="px-3 py-2 text-slate-700">{r.actual_last_working_day || r.requested_last_working_day || '—'}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[11px] uppercase font-semibold ${r.status === 'completed' ? 'bg-emerald-500/20 text-emerald-700' : r.status === 'cancelled' ? 'bg-slate-300 text-slate-700' : 'bg-amber-500/20 text-amber-700'}`}>{r.status.replace(/_/g, ' ')}</span></td>
                  <td className="px-3 py-2 text-right"><button onClick={() => setDetail(r)} className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded" data-testid={`sep-open-${r.separation_id}`}><Eye className="w-3.5 h-3.5" /> Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detail && (
        <SeparationDetailModal separation={detail} adminId={adminId} onClose={() => setDetail(null)} onRefresh={() => { setDetail(null); load(); }} />
      )}
      {showInit && (
        <SeparationInitModal employees={employees} adminId={adminId} onClose={() => setShowInit(false)} onSaved={() => { setShowInit(false); load(); }} />
      )}
    </div>
  );
};

const SeparationInitModal = ({ employees, adminId, onClose, onSaved }) => {
  const [form, setForm] = useState({ employee_id: '', kind: 'resignation', reason: '', notice_period_days: 30, requested_last_working_day: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.employee_id) return toast.error('Select an employee');
    setSaving(true);
    try {
      await axios.post(`${API}/public/separations/initiate`, { ...form, notice_period_days: Number(form.notice_period_days), requested_last_working_day: form.requested_last_working_day || null, admin_id: adminId });
      toast.success('Separation initiated');
      onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-4" onClick={e => e.stopPropagation()} data-testid="sep-init-modal">
        <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-900">Initiate Separation</h3><button onClick={onClose} className="text-slate-500"><X className="w-5 h-5" /></button></div>
        <div className="space-y-2">
          <select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="sep-init-employee">
            <option value="">Select employee…</option>
            {employees.filter(e => e.status === 'active').map(e => <option key={e.employee_id} value={e.employee_id}>{e.name} ({e.employee_id})</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="sep-init-kind">
              {['resignation', 'termination', 'retirement', 'end_of_contract', 'absconding'].map(k => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
            </select>
            <input type="number" value={form.notice_period_days} onChange={e => setForm(f => ({ ...f, notice_period_days: e.target.value }))} placeholder="Notice days" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="sep-init-notice" />
          </div>
          <input type="date" value={form.requested_last_working_day} onChange={e => setForm(f => ({ ...f, requested_last_working_day: e.target.value }))} placeholder="Last working day" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="sep-init-lwd" />
          <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason" rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="sep-init-reason" />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm" data-testid="sep-init-save">{saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Initiate'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SeparationDetailModal = ({ separation, adminId, onClose, onRefresh }) => {
  const [sep, setSep] = useState(separation);
  const [busy, setBusy] = useState(false);
  const [fnfForm, setFnfForm] = useState({ gross_dues: '', deductions: '' });

  const reload = async () => {
    try {
      const r = await axios.get(`${API}/public/separations/${sep.separation_id}`);
      setSep(r.data.separation);
    } catch { /* */ }
  };

  const toggleClearance = async (item, done) => {
    setBusy(true);
    try {
      await axios.patch(`${API}/public/separations/${sep.separation_id}/clearance/${item}`, { done, admin_id: adminId });
      await reload();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };
  const calcFnf = async () => {
    if (!fnfForm.gross_dues) return toast.error('Gross dues required');
    setBusy(true);
    try {
      await axios.post(`${API}/public/separations/${sep.separation_id}/fnf`, { gross_dues: Number(fnfForm.gross_dues), deductions: Number(fnfForm.deductions) || 0, admin_id: adminId });
      toast.success('F&F calculated');
      await reload();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };
  const markPaid = async () => {
    setBusy(true);
    try {
      await axios.post(`${API}/public/separations/${sep.separation_id}/pay`, { payment_reference: window.prompt('Payment reference?') || '', admin_id: adminId });
      toast.success('Marked paid');
      await reload();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };
  const complete = async () => {
    if (!window.confirm('Complete separation? This will issue the experience letter and mark employee as separated.')) return;
    setBusy(true);
    try {
      await axios.post(`${API}/public/separations/${sep.separation_id}/complete`, { admin_id: adminId });
      toast.success('Separation completed');
      onRefresh();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };

  const canFnf = ['cleared', 'in_clearance', 'fnf_calculated'].includes(sep.status);
  const canPay = sep.status === 'fnf_calculated';
  const canComplete = ['fnf_paid', 'cleared', 'fnf_calculated'].includes(sep.status);

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="sep-detail-modal">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-900">{sep.employee_name} — Separation</h3>
            <p className="text-xs text-slate-500 font-mono">{sep.separation_id} • {sep.kind} • status: <span className="font-semibold text-slate-800">{sep.status}</span></p>
          </div>
          <button onClick={onClose} className="text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-900 mb-2">Clearance Checklist</p>
            <div className="space-y-1.5">
              {(sep.clearances || []).map(c => (
                <label key={c.item} className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer" data-testid={`sep-clr-${c.item}`}>
                  <input type="checkbox" checked={c.done} disabled={busy} onChange={e => toggleClearance(c.item, e.target.checked)} data-testid={`sep-clr-chk-${c.item}`} />
                  <div className="flex-1">
                    <p className={`text-sm ${c.done ? 'text-slate-400 line-through' : 'text-slate-800 font-medium'}`}>{c.owner}</p>
                    <p className="text-[11px] text-slate-500">{c.description}</p>
                  </div>
                  {c.done_at && <span className="text-[10px] text-slate-400">{c.done_at.slice(0, 10)}</span>}
                </label>
              ))}
            </div>
          </div>

          <div className="p-3 border border-slate-200 rounded-lg" data-testid="sep-fnf-card">
            <p className="text-sm font-semibold text-slate-900 mb-2">Full &amp; Final Settlement</p>
            {sep.fnf ? (
              <div className="text-sm text-slate-700 space-y-1">
                <p>Gross Dues: <span className="font-semibold">₹ {sep.fnf.gross_dues?.toLocaleString()}</span></p>
                <p>Deductions: <span className="font-semibold">₹ {sep.fnf.deductions?.toLocaleString()}</span></p>
                <p>Net Payable: <span className="font-semibold text-emerald-600">₹ {sep.fnf.net_payable?.toLocaleString()}</span></p>
                <p className="text-[11px] text-slate-500">Status: {sep.fnf.status} {sep.fnf.paid_at && `• Paid ${sep.fnf.paid_at.slice(0, 10)}`}</p>
                {canPay && <button onClick={markPaid} disabled={busy} className="mt-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 rounded-lg text-xs" data-testid="sep-mark-paid">Mark as Paid</button>}
              </div>
            ) : canFnf ? (
              <div className="grid grid-cols-3 gap-2">
                <input type="number" value={fnfForm.gross_dues} onChange={e => setFnfForm(f => ({ ...f, gross_dues: e.target.value }))} placeholder="Gross dues" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="sep-fnf-gross" />
                <input type="number" value={fnfForm.deductions} onChange={e => setFnfForm(f => ({ ...f, deductions: e.target.value }))} placeholder="Deductions" className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="sep-fnf-deductions" />
                <button onClick={calcFnf} disabled={busy} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm" data-testid="sep-fnf-calc-btn">Calculate</button>
              </div>
            ) : (
              <p className="text-xs text-slate-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Complete at least one clearance before calculating F&amp;F.</p>
            )}
          </div>

          {canComplete && (
            <button onClick={complete} disabled={busy} className="w-full px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold" data-testid="sep-complete-btn">
              Complete Separation &amp; Issue Experience Letter
            </button>
          )}
          {sep.experience_letter_id && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center gap-2" data-testid="sep-letter-issued">
              <CheckCircle className="w-4 h-4" /> Experience letter issued: <span className="font-mono">{sep.experience_letter_id}</span>
              <a href={`${API}/public/employees/${sep.employee_id}/letters/${sep.experience_letter_id}/pdf`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs bg-white/60 hover:bg-white rounded" data-testid="sep-letter-download">
                <Download className="w-3.5 h-3.5" /> PDF
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCareers;
