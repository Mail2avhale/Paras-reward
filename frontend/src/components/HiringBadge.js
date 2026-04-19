import React, { useState, useEffect } from 'react';
import { Sparkles, Briefcase, ArrowRight } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * HiringBadge
 *   variant="ribbon"  -> Large hero ribbon used on Careers page
 *   variant="floating" -> Floating bottom-right pill used on public pages (links to /careers)
 */
export const HiringBadge = ({ variant = 'ribbon', jobCount: jobCountProp, onClick, className = '' }) => {
  const [jobCount, setJobCount] = useState(jobCountProp ?? null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (jobCountProp !== undefined && jobCountProp !== null) {
      setJobCount(jobCountProp);
      return;
    }
    let mounted = true;
    axios.get(`${API}/public/careers/jobs?active_only=true`)
      .then(res => { if (mounted) setJobCount(res.data?.jobs?.length || 0); })
      .catch(() => { if (mounted) setJobCount(0); });
    return () => { mounted = false; };
  }, [jobCountProp]);

  // Hide if no open roles
  if (jobCount === 0 || !visible) return null;

  const label = jobCount === null
    ? "We're Hiring"
    : jobCount === 1
      ? "We're Hiring • 1 Open Role"
      : `We're Hiring • ${jobCount} Open Roles`;

  /* --------- RIBBON (Careers Hero) --------- */
  if (variant === 'ribbon') {
    return (
      <button
        onClick={onClick}
        data-testid="hiring-ribbon"
        className={`group relative inline-flex items-center gap-2 px-5 py-2 rounded-full
                    bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400
                    text-slate-900 font-semibold text-sm shadow-lg shadow-orange-500/30
                    hover:shadow-xl hover:shadow-orange-500/50 hiring-pop overflow-hidden
                    transition-shadow ${className}`}
      >
        {/* shimmer overlay */}
        <span className="absolute inset-0 hiring-ribbon-shimmer pointer-events-none rounded-full" />
        {/* pulsing dot */}
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 hiring-pulse-dot" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
        </span>
        <Sparkles className="relative w-4 h-4" />
        <span className="relative tracking-wide">{label}</span>
        <ArrowRight className="relative w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </button>
    );
  }

  /* --------- FLOATING (Cross-page CTA) --------- */
  return (
    <div className={`fixed bottom-6 right-6 z-40 hiring-float ${className}`}>
      <button
        onClick={() => { window.location.href = '/careers'; }}
        data-testid="hiring-floating-badge"
        className="group relative inline-flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full
                   bg-slate-900 text-white font-medium text-sm shadow-2xl
                   border border-orange-400/30 hover:border-orange-400
                   hover:pr-5 transition-all overflow-hidden"
      >
        <span className="absolute inset-0 hiring-ribbon-shimmer pointer-events-none rounded-full opacity-40" />
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 hiring-pulse-dot" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
        </span>
        <Briefcase className="relative w-4 h-4 text-orange-300" />
        <span className="relative">{label}</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setVisible(false); }}
        aria-label="Dismiss hiring badge"
        data-testid="hiring-floating-dismiss"
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-700 text-slate-300
                   hover:bg-slate-600 hover:text-white text-xs leading-none shadow-md"
      >
        ×
      </button>
    </div>
  );
};

export default HiringBadge;
