// Careers module — Applications tab + Application detail modal
import React, { useState } from 'react';
import {
  Loader2, X, Eye, Users, Search, Download, MessageSquare,
  Mail, Phone, Calendar, ClipboardList, Video, FileSignature, UserPlus,
} from 'lucide-react';
import { STATUS_COLORS, formatStatus, CANONICAL_STATUSES } from './constants';
import { Field } from './shared';

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

export { ApplicationsTab, ApplicationModal };
