import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Briefcase, MapPin, Clock, ChevronRight, Search, Upload,
  Building2, Users, Heart, Star, Zap, BookOpen, Award,
  Loader2, X, CheckCircle, ArrowLeft
} from 'lucide-react';
import { HiringBadge } from '../components/HiringBadge';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BENEFITS = [
  { icon: Heart, title: 'Health Insurance', desc: 'Comprehensive health coverage for you and your family' },
  { icon: BookOpen, title: 'Learning & Growth', desc: 'Continuous learning opportunities and skill development programs' },
  { icon: Zap, title: 'Performance Bonus', desc: 'Rewarding excellence with competitive performance bonuses' },
  { icon: Users, title: 'Team Culture', desc: 'Collaborative environment with regular team activities' },
  { icon: Star, title: 'PF & ESI', desc: 'Statutory benefits including Provident Fund and ESI coverage' },
  { icon: Award, title: 'Career Growth', desc: 'Clear career paths with mentorship and promotion opportunities' }
];

const VALUES = [
  { title: 'Innovation', desc: 'We push boundaries and embrace new ideas to build the future of digital rewards.' },
  { title: 'Integrity', desc: 'We believe in transparency and honesty in everything we do.' },
  { title: 'Customer First', desc: 'Every decision starts with how it impacts our users.' },
  { title: 'Collaboration', desc: 'We achieve more together. Every voice matters here.' }
];

const CareersPage = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('All');
  const [showApply, setShowApply] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showStatusCheck, setShowStatusCheck] = useState(false);
  const [statusEmail, setStatusEmail] = useState('');
  const [statusResults, setStatusResults] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', experience_years: 0, cover_letter: '', linkedin: ''
  });
  const [resume, setResume] = useState(null);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/public/careers/jobs?active_only=true`);
      setJobs(res.data?.jobs || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const checkApplicationStatus = async () => {
    if (!statusEmail) { toast.error('Enter your email'); return; }
    setCheckingStatus(true);
    try {
      const res = await axios.get(`${API}/public/careers/check-status?email=${encodeURIComponent(statusEmail)}`);
      setStatusResults(res.data);
    } catch { toast.error('Failed to check status'); }
    finally { setCheckingStatus(false); }
  };

  const handleApply = async () => {
    if (!form.name || !form.email || !form.phone || !resume) {
      toast.error('Please fill name, email, phone and upload resume');
      return;
    }
    setApplying(true);
    try {
      const fd = new FormData();
      fd.append('job_id', selectedJob.job_id);
      fd.append('name', form.name);
      fd.append('email', form.email);
      fd.append('phone', form.phone);
      fd.append('experience_years', form.experience_years);
      fd.append('cover_letter', form.cover_letter);
      fd.append('linkedin', form.linkedin);
      fd.append('resume', resume);

      const res = await axios.post(`${API}/public/careers/apply`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        setApplied(true);
        toast.success('Application submitted!');
      }
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to submit'); }
    finally { setApplying(false); }
  };

  const departments = ['All', ...new Set(jobs.map(j => j.department))];
  const filtered = jobs.filter(j => {
    if (filterDept !== 'All' && j.department !== filterDept) return false;
    if (searchQuery && !j.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Job Detail View
  if (selectedJob) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <button onClick={() => { setSelectedJob(null); setShowApply(false); setApplied(false); }} className="flex items-center gap-1 text-sm text-blue-600 hover:underline mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Careers
          </button>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{selectedJob.title}</h1>
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-500">
                  <span className="flex items-center gap-1"><Building2 className="w-4 h-4" />{selectedJob.department}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{selectedJob.location}</span>
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{selectedJob.job_type}</span>
                </div>
                {selectedJob.show_salary && selectedJob.salary_min && (
                  <p className="mt-2 text-emerald-600 font-semibold">
                    {selectedJob.salary_min?.toLocaleString()} - {selectedJob.salary_max?.toLocaleString()} INR/month
                  </p>
                )}
                {selectedJob.experience_max > 0 && (
                  <p className="text-sm text-slate-500 mt-1">Experience: {selectedJob.experience_min}-{selectedJob.experience_max} years</p>
                )}
              </div>
              {!showApply && !applied && (
                <button onClick={() => setShowApply(true)} className="px-6 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800" data-testid="apply-btn">
                  Apply Now
                </button>
              )}
            </div>

            {selectedJob.description && (
              <div className="mb-4">
                <h3 className="font-semibold text-slate-900 mb-2">About the Role</h3>
                <p className="text-slate-600 text-sm whitespace-pre-wrap">{selectedJob.description}</p>
              </div>
            )}
            {selectedJob.responsibilities && (
              <div className="mb-4">
                <h3 className="font-semibold text-slate-900 mb-2">Responsibilities</h3>
                <p className="text-slate-600 text-sm whitespace-pre-wrap">{selectedJob.responsibilities}</p>
              </div>
            )}
            {selectedJob.requirements && (
              <div className="mb-4">
                <h3 className="font-semibold text-slate-900 mb-2">Requirements</h3>
                <p className="text-slate-600 text-sm whitespace-pre-wrap">{selectedJob.requirements}</p>
              </div>
            )}
            {selectedJob.benefits && (
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Benefits</h3>
                <p className="text-slate-600 text-sm whitespace-pre-wrap">{selectedJob.benefits}</p>
              </div>
            )}
          </div>

          {/* Application Form */}
          {showApply && !applied && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6" data-testid="apply-form">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Apply for {selectedJob.title}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Full Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" placeholder="Your full name" data-testid="apply-name" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" placeholder="your@email.com" data-testid="apply-email" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Phone *</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" placeholder="9876543210" data-testid="apply-phone" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Experience (years)</label>
                  <input type="number" value={form.experience_years} onChange={e => setForm(p => ({ ...p, experience_years: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" min="0" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">LinkedIn Profile</label>
                  <input type="url" value={form.linkedin} onChange={e => setForm(p => ({ ...p, linkedin: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" placeholder="https://linkedin.com/in/yourprofile" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">Cover Letter</label>
                  <textarea value={form.cover_letter} onChange={e => setForm(p => ({ ...p, cover_letter: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white resize-none" rows={3} placeholder="Tell us why you'd be a great fit..." />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">Resume * (PDF, max 5MB)</label>
                  <input type="file" ref={fileRef} accept=".pdf,.doc,.docx" className="hidden" onChange={e => setResume(e.target.files?.[0])} />
                  <button onClick={() => fileRef.current?.click()} className="w-full px-3 py-3 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2" data-testid="upload-resume">
                    <Upload className="w-4 h-4" />
                    {resume ? resume.name : 'Click to upload resume'}
                  </button>
                </div>
              </div>
              <button onClick={handleApply} disabled={applying} className="mt-4 w-full py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50" data-testid="submit-application">
                {applying ? <Loader2 className="w-5 h-5 animate-spin inline" /> : 'Submit Application'}
              </button>
            </div>
          )}

          {/* Success State */}
          {applied && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900 mb-2">Application Submitted!</h2>
              <p className="text-slate-600">Thank you for your interest. Our team will review your application and get back to you soon.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-slate-900 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-5">
            <HiringBadge
              variant="ribbon"
              jobCount={jobs.length}
              onClick={() => {
                const el = document.getElementById('positions');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Join Our Mission</h1>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto mb-2">Build the future of digital rewards with Paras Reward Technologies</p>
          <p className="text-slate-400 text-sm">B-18, Bizz Tower, Chatrapati Sambhaji Nagar, Maharashtra</p>
          <div className="flex gap-3 justify-center mt-4 flex-wrap">
            <a href="#positions" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">View Open Positions</a>
            <button onClick={() => setShowStatusCheck(!showStatusCheck)} className="px-6 py-2.5 border border-slate-600 text-slate-300 rounded-lg font-medium hover:border-slate-400" data-testid="check-status-btn">
              Check Application Status
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-12">
        {/* Application Status Check */}
        {showStatusCheck && (
          <div className="bg-white border border-slate-200 rounded-xl p-6" data-testid="status-check-section">
            <h3 className="font-bold text-slate-900 mb-3">Check Your Application Status</h3>
            <div className="flex gap-2">
              <input
                type="email"
                value={statusEmail}
                onChange={e => setStatusEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && checkApplicationStatus()}
                placeholder="Enter your email address"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white"
                data-testid="status-email-input"
              />
              <button onClick={checkApplicationStatus} disabled={checkingStatus} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {checkingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check'}
              </button>
            </div>
            {statusResults && (
              <div className="mt-4">
                {!statusResults.found ? (
                  <p className="text-slate-500 text-sm">No applications found for this email.</p>
                ) : (
                  <div className="space-y-2">
                    {statusResults.applications.map(app => (
                      <div key={app.application_id} className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{app.job_title}</p>
                          <p className="text-xs text-slate-400">Applied: {app.created_at?.slice(0, 10)}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          app.status === 'new' ? 'bg-blue-100 text-blue-700' :
                          app.status === 'reviewed' ? 'bg-yellow-100 text-yellow-700' :
                          app.status === 'shortlisted' ? 'bg-emerald-100 text-emerald-700' :
                          app.status === 'interview' ? 'bg-purple-100 text-purple-700' :
                          app.status === 'hired' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {app.status?.charAt(0).toUpperCase() + app.status?.slice(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {/* Values */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Our Values</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {VALUES.map((v, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="font-bold text-slate-900 mb-1">{v.title}</h3>
                <p className="text-slate-500 text-sm">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Why Work With Us</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {BENEFITS.map((b, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                <b.icon className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <h3 className="font-semibold text-slate-900 text-sm mb-1">{b.title}</h3>
                <p className="text-slate-400 text-xs">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Open Positions */}
        <div id="positions">
          <h2 className="text-xl font-bold text-slate-900 mb-4 text-center">Open Positions</h2>

          {/* Filter */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <div className="flex-1 min-w-[150px] relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search jobs..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" data-testid="search-jobs" />
            </div>
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white">
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No open positions right now</p>
              <p className="text-slate-400 text-sm mt-1">Check back soon or send your resume to {BENEFITS[0]?.desc ? 'info@parasreward.com' : ''}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(job => (
                <div key={job.job_id} onClick={() => setSelectedJob(job)} className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all flex items-center justify-between" data-testid={`job-${job.job_id}`}>
                  <div>
                    <h3 className="font-semibold text-slate-900">{job.title}</h3>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{job.department}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{job.job_type}</span>
                      {job.experience_max > 0 && <span>{job.experience_min}-{job.experience_max} yrs</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-900 text-white py-8 px-4 text-center">
        <p className="text-slate-400 text-sm">Paras Reward Technologies Private Limited</p>
        <p className="text-slate-500 text-xs mt-1">www.parasreward.com</p>
      </div>
    </div>
  );
};

export default CareersPage;
