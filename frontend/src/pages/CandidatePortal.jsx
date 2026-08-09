import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft, Briefcase, CheckCircle2, Circle, Clock, FileText,
  Video, MapPin, Download, ExternalLink, AlertCircle, Loader2,
  ClipboardList, FileSignature, GraduationCap, Building2, ListChecks,
  User, Share2, Copy, MessageCircle,
} from 'lucide-react';
import { API } from '../lib/api';

const STATUS_LABELS = {
  application_received: 'Application Received',
  under_screening: 'Under Screening',
  shortlisted: 'Shortlisted',
  test_assigned: 'Assessment Assigned',
  test_completed: 'Assessment Complete',
  test_failed: 'Assessment Not Cleared',
  hr_interview_scheduled: 'HR Interview Scheduled',
  hr_interview_completed: 'HR Interview Complete',
  department_interview_scheduled: 'Manager Interview Scheduled',
  department_interview_completed: 'Manager Interview Complete',
  selected: 'Selected',
  offer_generated: 'Offer Ready',
  offer_sent: 'Offer Sent',
  offer_accepted: 'Offer Accepted',
  offer_declined: 'Offer Declined',
  joining_scheduled: 'Joining Scheduled',
  joined: 'Joined',
  rejected: 'Not Selected',
};

const formatStatus = (s) => {
  if (!s) return '';
  if (STATUS_LABELS[s]) return STATUS_LABELS[s];
  return String(s).split('_').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
};
const fmtDate = (iso) => { try { return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };

const CandidatePortal = () => {
  const { appId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/public/candidate/${appId}`);
      setData(r.data);
      setError(null);
    } catch (e) {
      setError(e.response?.status === 404 ? 'Application not found. Please double-check your Application ID.' : 'Something went wrong. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, [appId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center"><Loader2 className="w-10 h-10 animate-spin text-slate-400 mx-auto" /><p className="mt-3 text-sm text-slate-500">Loading your application…</p></div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" data-testid="portal-error">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 mb-2">Cannot load your portal</h2>
        <p className="text-sm text-slate-600 mb-4">{error}</p>
        <Link to="/careers" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"><ArrowLeft className="w-4 h-4" /> Back to Careers</Link>
      </div>
    </div>
  );

  const { application, timeline, actions, assessments, interviews, offers, employee, onboarding, letters } = data;

  return (
    <div className="min-h-screen bg-slate-50" data-testid="candidate-portal">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between mb-3 gap-3">
            <div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">{application.application_id}</p>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">Hi {application.name?.split(' ')[0] || 'there'} 👋</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                Applied for <span className="font-semibold text-slate-900">{application.job_title}</span>
                {application.job_code && <span className="text-xs text-slate-500 font-mono ml-2">({application.job_code})</span>}
              </p>
            </div>
            <Link to="/careers" className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> Careers</Link>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full" data-testid="portal-current-status">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-slate-800">{formatStatus(application.status)}</span>
          </div>
        </div>

        {/* Referral share — help a friend apply too */}
        <ReferralShareCard application={application} />

        {/* Timeline strip */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" data-testid="portal-timeline">
          <div className="flex items-center justify-between">
            {timeline.map((step, i) => (
              <React.Fragment key={step.key}>
                <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0" data-testid={`timeline-step-${step.key}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${step.done ? 'bg-emerald-500 text-white' : step.active ? 'bg-blue-500 text-white ring-4 ring-blue-100' : 'bg-slate-100 text-slate-400'}`}>
                    {step.done ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                  </div>
                  <p className={`text-[11px] font-medium truncate w-full text-center ${step.active ? 'text-blue-700' : step.done ? 'text-slate-800' : 'text-slate-400'}`}>{step.label}</p>
                </div>
                {i < timeline.length - 1 && <div className={`h-0.5 flex-1 ${step.done ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Active action cards */}
        {actions.length > 0 && (
          <div className="space-y-2" data-testid="portal-actions">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 px-1">Next Steps</p>
            {actions.map((a, i) => (
              <ActionCard key={i} action={a} />
            ))}
          </div>
        )}

        {/* Assessments */}
        {assessments.length > 0 && (
          <Section title="Assessments" icon={ClipboardList} testid="portal-assessments-section">
            <div className="divide-y divide-slate-100">
              {assessments.map(a => (
                <div key={a.assignment_id} className="py-3 flex items-start gap-3" data-testid={`portal-assessment-${a.assignment_id}`}>
                  <ClipboardList className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{a.test_title || 'Assessment'}</p>
                    <p className="text-xs text-slate-500">Assigned {fmtDate(a.assigned_at)}{a.deadline && ` · Deadline ${fmtDate(a.deadline)}`}</p>
                    {a.attempt_summary && (
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded-full font-semibold ${a.attempt_summary.passed ? 'bg-emerald-500/15 text-emerald-700' : 'bg-red-500/15 text-red-700'}`}>{a.attempt_summary.passed ? 'Passed' : 'Not Cleared'}</span>
                        <span className="text-slate-600">Score: {a.attempt_summary.marks_earned}/{a.attempt_summary.max_marks} ({a.attempt_summary.percentage}%)</span>
                      </div>
                    )}
                  </div>
                  {a.token && (
                    <a href={`/careers/test/${a.token}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline font-medium shrink-0" data-testid={`portal-take-test-${a.assignment_id}`}>Take Test →</a>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Interviews */}
        {interviews.length > 0 && (
          <Section title="Interviews" icon={Video} testid="portal-interviews-section">
            <div className="divide-y divide-slate-100">
              {interviews.map(iv => (
                <div key={iv.interview_id} className="py-3 flex items-start gap-3" data-testid={`portal-interview-${iv.interview_id}`}>
                  <Video className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 capitalize">{(iv.kind || 'interview').replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-500">{fmtDate(iv.scheduled_at)} · {iv.mode}</p>
                    {iv.location && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {iv.location}</p>}
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${iv.status === 'completed' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-blue-500/15 text-blue-700'}`}>{iv.status}</span>
                  </div>
                  {iv.meet_link && iv.status === 'scheduled' && (
                    <a href={iv.meet_link} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline font-medium shrink-0 flex items-center gap-1" data-testid={`portal-join-meeting-${iv.interview_id}`}>Join <ExternalLink className="w-3 h-3" /></a>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Offers */}
        {offers.length > 0 && (
          <Section title="Offer Letters" icon={FileSignature} testid="portal-offers-section">
            <div className="divide-y divide-slate-100">
              {offers.map(o => (
                <div key={o.offer_id} className="py-3 flex items-start gap-3" data-testid={`portal-offer-${o.offer_id}`}>
                  <FileSignature className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{o.designation} · {o.department}</p>
                    <p className="text-xs text-slate-500">CTC ₹{o.salary_ctc?.toLocaleString()} · Joining {o.joining_date} · {o.hiring_type}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${o.status === 'accepted' ? 'bg-emerald-500/15 text-emerald-700' : o.status === 'declined' ? 'bg-red-500/15 text-red-700' : 'bg-amber-500/15 text-amber-700'}`}>{o.status}</span>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <a href={`${API}${o.pdf_url}`} target="_blank" rel="noreferrer" className="text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded px-2 py-1 flex items-center gap-1" data-testid={`portal-offer-pdf-${o.offer_id}`}><Download className="w-3 h-3" /> PDF</a>
                    {o.respond_url && o.token && (
                      <Link to={`/candidate/offer/${o.token}`} className="text-xs text-blue-600 hover:underline font-medium" data-testid={`portal-offer-respond-${o.offer_id}`}>Review & Respond →</Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Employee + Onboarding + Letters (post-joining) */}
        {employee && (
          <Section title="Welcome Aboard" icon={GraduationCap} testid="portal-employee-section">
            <div className="flex items-center gap-3 mb-3">
              <Building2 className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-900">{employee.employee_id}</p>
                <p className="text-xs text-slate-500">{employee.designation} · {employee.department} · Joining {employee.joining_date?.slice(0, 10)}</p>
              </div>
            </div>
            {onboarding && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-800 flex items-center gap-1"><ListChecks className="w-3.5 h-3.5" /> Onboarding checklist</p>
                  <p className="text-xs text-slate-600 font-medium">{onboarding.progress_percent}% complete</p>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${onboarding.progress_percent}%` }} />
                </div>
                <ul className="space-y-1">
                  {onboarding.tasks.map((t, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs">
                      {t.done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                      <span className={t.done ? 'text-slate-400 line-through' : 'text-slate-700'}>{t.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {letters.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-800 mb-2 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Documents</p>
                <div className="space-y-1">
                  {letters.map(l => (
                    <a key={l.letter_id} href={`${API}${l.pdf_url}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-xs" data-testid={`portal-letter-${l.letter_id}`}>
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span className="capitalize font-medium text-slate-800 flex-1">{l.kind} Letter</span>
                      <span className="text-[10px] text-slate-500">{l.issued_at?.slice(0, 10)}</span>
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* Status history — collapsible */}
        {application.status_history && application.status_history.length > 0 && (
          <details className="bg-white border border-slate-200 rounded-2xl p-4" data-testid="portal-history">
            <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900">View full history ({application.status_history.length} events)</summary>
            <div className="mt-3 space-y-1.5">
              {[...application.status_history].reverse().map((h, i) => (
                <div key={i} className="flex items-start gap-2 text-xs pb-2 border-b border-slate-100 last:border-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-slate-800">{formatStatus(h.from) || 'Started'} <span className="text-slate-400">→</span> <span className="font-semibold">{formatStatus(h.to)}</span></p>
                    <p className="text-[10px] text-slate-500">{fmtDate(h.at)} · by {h.by}{h.comment && ` · ${h.comment}`}</p>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        <p className="text-center text-xs text-slate-400 pt-4">Paras Reward Technologies — Recruitment Portal</p>
      </div>
    </div>
  );
};


const ReferralShareCard = ({ application }) => {
  const [expanded, setExpanded] = useState(false);
  const jobKey = application.job_code || application.job_id || '';
  const shareUrl = jobKey
    ? `${window.location.origin}/careers?job=${encodeURIComponent(jobKey)}&ref=${encodeURIComponent(application.application_id)}`
    : `${window.location.origin}/careers`;
  const shareText = `I just applied for ${application.job_title} at Paras Reward Technologies — think you'd be a great fit too! Check it out: ${shareUrl}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied!');
    } catch {
      toast.error('Copy failed — long-press the link to copy');
    }
  };
  const openWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
  };
  const nativeShare = async () => {
    try {
      await navigator.share({ title: `Job opening: ${application.job_title}`, text: shareText, url: shareUrl });
    } catch { /* user cancelled or unsupported */ }
  };
  const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className="bg-gradient-to-br from-blue-50 to-emerald-50 border border-blue-200 rounded-2xl p-4 shadow-sm" data-testid="portal-referral-card">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/70 flex items-center justify-center shrink-0">
          <Share2 className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">Know someone who&apos;d love this role?</p>
          <p className="text-xs text-slate-600 mt-0.5">Share this opening with a friend — they can apply in one tap.</p>
        </div>
        {!expanded && (
          <button onClick={() => setExpanded(true)} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium whitespace-nowrap shrink-0" data-testid="portal-share-toggle">
            Share
          </button>
        )}
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-blue-200 space-y-2" data-testid="portal-share-panel">
          <div className="flex items-center gap-2 p-2 bg-white/70 rounded-lg">
            <span className="flex-1 text-[11px] font-mono text-slate-600 truncate">{shareUrl}</span>
            <button onClick={copyLink} className="p-1.5 text-slate-700 hover:bg-slate-100 rounded" data-testid="portal-share-copy">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={openWhatsApp} className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5" data-testid="portal-share-whatsapp">
              <MessageCircle className="w-4 h-4" /> Share on WhatsApp
            </button>
            {hasNativeShare && (
              <button onClick={nativeShare} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5" data-testid="portal-share-native">
                <Share2 className="w-4 h-4" /> More
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


const Section = ({ title, icon: Icon, testid, children }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" data-testid={testid}>
    <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
      <Icon className="w-4 h-4 text-slate-500" /> {title}
    </h2>
    {children}
  </div>
);

const ActionCard = ({ action }) => {
  const bgClass = action.priority === 'high' ? 'bg-blue-500/10 border-blue-200' : 'bg-amber-500/10 border-amber-200';
  const isExternal = action.cta_url?.startsWith('http') || action.cta_url?.startsWith('/careers/');
  return (
    <div className={`border rounded-xl p-4 ${bgClass}`} data-testid={`portal-action-${action.kind}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/70 flex items-center justify-center shrink-0">
          {action.kind === 'test' && <ClipboardList className="w-5 h-5 text-blue-600" />}
          {action.kind === 'interview' && <Video className="w-5 h-5 text-purple-600" />}
          {action.kind === 'offer' && <FileSignature className="w-5 h-5 text-emerald-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">{action.title}</p>
          {action.hours_left != null && (
            <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3" /> {action.hours_left}h remaining</p>
          )}
        </div>
        {isExternal ? (
          <a href={action.cta_url} target="_blank" rel="noreferrer" className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1" data-testid={`portal-cta-${action.kind}`}>{action.cta_label} <ExternalLink className="w-3 h-3" /></a>
        ) : (
          <Link to={action.cta_url} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium whitespace-nowrap" data-testid={`portal-cta-${action.kind}`}>{action.cta_label}</Link>
        )}
      </div>
    </div>
  );
};

export default CandidatePortal;
