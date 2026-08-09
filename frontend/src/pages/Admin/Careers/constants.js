// Careers module — shared constants (30-status pipeline, colors, formatters)

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

export { STATUS_COLORS, formatStatus, CANONICAL_STATUSES };
