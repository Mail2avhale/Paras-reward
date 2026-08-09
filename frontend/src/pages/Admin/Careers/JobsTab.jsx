// Careers module — Job Postings tab + Job create/edit modal
import React from 'react';
import { Plus, Edit2, Trash2, X, Power, PowerOff, Loader2, Briefcase, Search, Building2, Clock, Users } from 'lucide-react';
import { Input, Select, Textarea } from './shared';

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

export { JobsTab, JobModal };
