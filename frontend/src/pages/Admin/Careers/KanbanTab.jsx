// Careers module — Recruitment Pipeline (Kanban) tab (spec §12)
import React from 'react';
import { Loader2 } from 'lucide-react';
import { STATUS_COLORS } from './constants';

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


export { KanbanTab, KanbanQuickMove };
