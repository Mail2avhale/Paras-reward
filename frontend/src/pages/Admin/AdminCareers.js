import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Briefcase, Plus, Edit2, Trash2, Users, FileText, Download,
  Loader2, X, Eye, Power, PowerOff, Search, Filter, RefreshCw,
  MessageSquare, Mail, Phone, Calendar, Building2, Clock,
  CheckCircle, XCircle, UserCheck
} from 'lucide-react';

import { API } from "../../lib/api";

const STATUS_COLORS = {
  new: 'bg-blue-500/20 text-blue-600',
  reviewed: 'bg-yellow-500/20 text-yellow-600',
  shortlisted: 'bg-emerald-500/20 text-emerald-600',
  interview: 'bg-purple-500/20 text-purple-600',
  hired: 'bg-green-500/30 text-green-600',
  rejected: 'bg-red-500/20 text-red-600'
};

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
            { id: 'applications', label: 'Applications', icon: Users }
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
          {activeTab === 'jobs' ? (
            <JobsTab
              jobs={filteredJobs} loading={loading}
              filterActive={filterActive} setFilterActive={setFilterActive}
              search={jobSearch} setSearch={setJobSearch}
              onEdit={openEditModal} onToggle={toggleJobActive} onDelete={deleteJob}
            />
          ) : (
            <ApplicationsTab
              apps={filteredApps} loading={loading}
              jobs={jobs}
              filterStatus={filterStatus} setFilterStatus={setFilterStatus}
              filterJob={filterJob} setFilterJob={setFilterJob}
              search={appSearch} setSearch={setAppSearch}
              onView={setViewApp} onUpdateStatus={updateAppStatus} onDownloadResume={downloadResume}
            />
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
        {['new','reviewed','shortlisted','interview','hired','rejected'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
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
                    {a.status}
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
                  {['new','reviewed','shortlisted','interview','hired','rejected'].map(s => <option key={s} value={s}>{s}</option>)}
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

const ApplicationModal = ({ app, onClose, onUpdateStatus, onAddNote, onDownloadResume }) => {
  const [note, setNote] = useState('');
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

          <div>
            <p className="text-xs text-slate-500 mb-1">Status</p>
            <div className="flex gap-2 flex-wrap">
              {['new','reviewed','shortlisted','interview','hired','rejected'].map(s => (
                <button key={s} onClick={() => onUpdateStatus(app.application_id, s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${app.status === s ? STATUS_COLORS[s] + ' ring-2 ring-current' : 'bg-white text-slate-500 hover:text-white'}`} data-testid={`modal-status-${s}`}>
                  {s.charAt(0).toUpperCase()+s.slice(1)}
                </button>
              ))}
            </div>
          </div>

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

export default AdminCareers;
