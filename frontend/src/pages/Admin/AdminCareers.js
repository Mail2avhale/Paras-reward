import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Briefcase, Users, LayoutGrid, ClipboardList, UserCheck,
  CalendarDays, Coffee, Settings, BarChart3, Loader2,
  RefreshCw, Plus, Calculator, Network, Shield,
} from 'lucide-react';

import { API } from "../../lib/api";

// Modularised Careers tabs (spec §5-80). See PRD.md for the phase-by-phase build log.
import { JobsTab, JobModal } from './Careers/JobsTab';
import { ApplicationsTab, ApplicationModal } from './Careers/ApplicationsTab';
import { KanbanTab } from './Careers/KanbanTab';
import { TestsTab, TestBankModal, QuickActionModal } from './Careers/TestsTab';
import { EmployeesTab, EmployeeToolModal } from './Careers/EmployeesTab';
import { AttendanceTab } from './Careers/AttendanceTab';
import { LeavesTab } from './Careers/LeavesTab';
import { SystemTab } from './Careers/SystemTab';
import { ReportsTab } from './Careers/ReportsTab';
import { PayrollTab } from './Careers/PayrollTab';
import { OrgChartTab } from './Careers/OrgChartTab';
import { PortalTab } from './Careers/PortalTab';
import { StatPill } from './Careers/shared';

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
            { id: 'payroll', label: 'Payroll', icon: Calculator },
            { id: 'orgchart', label: 'Org Chart', icon: Network },
            { id: 'portal', label: 'Portal Access', icon: Shield },
            { id: 'system', label: 'System', icon: Settings },
            { id: 'reports', label: 'Reports', icon: BarChart3 }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              data-testid={`tab-${t.id}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
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
          {activeTab === 'payroll' && (
            <PayrollTab employees={employees} onNeedEmployees={fetchEmployees} adminId={adminId} />
          )}
          {activeTab === 'orgchart' && (
            <OrgChartTab adminId={adminId} />
          )}
          {activeTab === 'portal' && (
            <PortalTab adminId={adminId} />
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


export default AdminCareers;
