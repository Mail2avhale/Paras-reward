import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  TrendingUp, Users, Zap, BarChart3, Shield, Globe, Target,
  ArrowUpRight, Lock, Download, Send, Loader2, CheckCircle,
  Building2, DollarSign, Layers, Award, ChevronRight, Eye
} from 'lucide-react';
import { HiringBadge } from '../components/HiringBadge';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MILESTONES = [
  { year: '2025', title: 'Founded', desc: 'Paras Reward Technologies Pvt Ltd incorporated in Maharashtra' },
  { year: '2025', title: 'Product Launch', desc: 'PRC ecosystem launched with mining, subscriptions, and recharge services' },
  { year: '2026', title: 'Growth Phase', desc: 'Rapid user acquisition with Elite subscription model and BBPS integration' },
  { year: '2026', title: 'Community', desc: 'Community forum and Employee Management System launched' }
];

const REVENUE_STREAMS = [
  { icon: Zap, title: 'Subscription Revenue', desc: 'Monthly Elite/VIP subscription plans with auto-renewal' },
  { icon: DollarSign, title: 'Transaction Fees', desc: 'Commission on bill payments, recharges, and BBPS services via Eko API' },
  { icon: Layers, title: 'Platform Economy', desc: 'PRC token ecosystem with mining, rewards, and marketplace' },
  { icon: Globe, title: 'Marketplace', desc: 'Digital products and gift voucher marketplace with PRC payments' }
];

const ADVANTAGES = [
  { icon: Shield, title: 'First Mover', desc: 'Unique PRC reward mining ecosystem in Indian market' },
  { icon: Users, title: 'Network Effects', desc: 'Referral-driven growth with subscription-based network rewards' },
  { icon: Target, title: 'Recurring Revenue', desc: 'Subscription model ensures predictable monthly revenue' },
  { icon: Award, title: 'Regulatory Compliance', desc: 'Full Indian statutory compliance (PF, ESI, TDS, GST)' }
];

const InvestorsPage = () => {
  const [metrics, setMetrics] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [faqs, setFaqs] = useState([]);
  const [team, setTeam] = useState([]);
  const [press, setPress] = useState([]);
  const [openFaq, setOpenFaq] = useState(null);
  const [showContact, setShowContact] = useState(false);
  const [contacting, setContacting] = useState(false);
  const [contacted, setContacted] = useState(false);
  const [passwordModal, setPasswordModal] = useState(null);
  const [docPassword, setDocPassword] = useState('');
  const [downloading, setDownloading] = useState(null);

  const [contactForm, setContactForm] = useState({
    name: '', email: '', phone: '', organization: '', investment_range: '', message: ''
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [metricsRes, docsRes, faqRes, teamRes, pressRes] = await Promise.all([
        axios.get(`${API}/public/investors/metrics`),
        axios.get(`${API}/public/investors/documents`),
        axios.get(`${API}/public/investors/faq`),
        axios.get(`${API}/public/investors/team`),
        axios.get(`${API}/public/investors/press`)
      ]);
      setMetrics(metricsRes.data?.metrics || {});
      setDocuments(docsRes.data?.documents || []);
      setFaqs(faqRes.data?.faqs || []);
      setTeam(teamRes.data?.team || []);
      setPress(pressRes.data?.press || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleContact = async () => {
    if (!contactForm.name || !contactForm.email) { toast.error('Name and email required'); return; }
    setContacting(true);
    try {
      const res = await axios.post(`${API}/public/investors/contact`, contactForm);
      if (res.data?.success) { setContacted(true); toast.success('Inquiry submitted!'); }
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setContacting(false); }
  };

  const handleDocDownload = async (doc) => {
    if (doc.is_protected) {
      setPasswordModal(doc);
      setDocPassword('');
      return;
    }
    downloadDoc(doc.doc_id, '');
  };

  const downloadDoc = async (docId, password) => {
    setDownloading(docId);
    try {
      const res = await axios.post(`${API}/public/investors/documents/${docId}/download`,
        { password }, { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `document-${docId}.pdf`;
      link.click();
      setPasswordModal(null);
      toast.success('Download started');
    } catch (err) {
      if (err.response?.status === 403) toast.error('Incorrect password');
      else toast.error('Download failed');
    }
    finally { setDownloading(null); }
  };

  const MetricCard = ({ label, value, suffix = '', icon: Icon, color = 'blue' }) => (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-5 h-5 text-${color}-500`} />
        <ArrowUpRight className="w-4 h-4 text-emerald-500" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{typeof value === 'number' ? value.toLocaleString() : value}{suffix}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-800 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-blue-400 text-sm font-medium mb-2 uppercase tracking-wider">Investor Relations</p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Building the Future of Digital Rewards</h1>
          <p className="text-slate-300 text-base max-w-2xl mx-auto mb-6">
            Paras Reward Technologies is creating India's first PRC-powered digital reward ecosystem
            with subscriptions, mining, and integrated financial services.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowContact(true)} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700" data-testid="contact-btn">
              Connect With Us
            </button>
            <a href="#metrics" className="px-6 py-2.5 border border-slate-600 text-slate-300 rounded-lg font-medium hover:border-slate-400">
              View Metrics
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-14">
        {/* Real Metrics */}
        <div id="metrics">
          <h2 className="text-xl font-bold text-slate-900 mb-2 text-center">Platform Metrics</h2>
          <p className="text-slate-500 text-sm text-center mb-6">Real-time data from our production platform</p>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : metrics ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Total Users" value={metrics.total_users} icon={Users} color="blue" />
              <MetricCard label="Active Subscribers" value={metrics.active_subscribers} icon={Zap} color="purple" />
              <MetricCard label="Monthly Active" value={metrics.monthly_active_users} icon={TrendingUp} color="emerald" />
              <MetricCard label="Total Transactions" value={metrics.total_transactions} icon={BarChart3} color="orange" />
              <MetricCard label="PRC in Circulation" value={Math.round(metrics.prc_in_circulation)} icon={DollarSign} color="yellow" />
              <MetricCard label="User Growth" value={metrics.user_growth_rate} suffix="%" icon={TrendingUp} color="emerald" />
              <MetricCard label="New This Month" value={metrics.this_month_signups} icon={Users} color="blue" />
              <MetricCard label="Subscription Rate" value={metrics.active_subscribers > 0 ? Math.round(metrics.active_subscribers / metrics.total_users * 100) : 0} suffix="%" icon={Target} color="purple" />
            </div>
          ) : null}
        </div>

        {/* Revenue Streams */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Revenue Streams</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {REVENUE_STREAMS.map((r, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <r.icon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">{r.title}</h3>
                  <p className="text-slate-500 text-xs mt-1">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Competitive Advantages */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Competitive Advantages</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ADVANTAGES.map((a, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <a.icon className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">{a.title}</h3>
                  <p className="text-slate-500 text-xs mt-1">{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Milestones */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Key Milestones</h2>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
            <div className="space-y-6">
              {MILESTONES.map((m, i) => (
                <div key={i} className="flex gap-4 relative">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 z-10">
                    {i + 1}
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-blue-600 font-semibold">{m.year}</span>
                      <h3 className="font-semibold text-slate-900 text-sm">{m.title}</h3>
                    </div>
                    <p className="text-slate-500 text-xs">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Leadership Team */}
        {team.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Leadership Team</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {team.map((t, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">
                    {t.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <h3 className="font-bold text-slate-900">{t.name}</h3>
                  <p className="text-blue-600 text-sm font-medium">{t.role}</p>
                  <p className="text-slate-500 text-xs mt-2">{t.bio}</p>
                  {t.linkedin && (
                    <a href={t.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-xs hover:underline mt-2 inline-block">LinkedIn Profile</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Press & News */}
        {press.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Press & News</h2>
            <div className="space-y-3">
              {press.map((p, i) => (
                <a key={i} href={p.url || '#'} target="_blank" rel="noopener noreferrer" className="block bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">{p.title}</h3>
                      <p className="text-slate-500 text-xs mt-1">{p.summary}</p>
                      <p className="text-slate-400 text-[10px] mt-1">{p.source} | {p.date}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* FAQ */}
        {faqs.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Frequently Asked Questions</h2>
            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full p-4 text-left flex items-center justify-between"
                  >
                    <span className="font-medium text-slate-900 text-sm pr-4">{faq.question}</span>
                    <ChevronRight className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-90' : ''}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-4 pb-4 text-slate-600 text-sm border-t border-slate-100 pt-3">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documents */}
        {documents.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Documents</h2>
            <div className="space-y-3">
              {documents.map(doc => (
                <div key={doc.doc_id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {doc.is_protected ? <Lock className="w-5 h-5 text-orange-500" /> : <Download className="w-5 h-5 text-blue-500" />}
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{doc.title}</p>
                      <p className="text-xs text-slate-400">{doc.doc_type} {doc.is_protected ? '(Password Protected)' : ''} | {doc.download_count} downloads</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDocDownload(doc)}
                    disabled={downloading === doc.doc_id}
                    className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200"
                    data-testid={`download-${doc.doc_id}`}
                  >
                    {downloading === doc.doc_id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Download'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact / Inquiry CTA */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-8 text-center text-white">
          <h2 className="text-xl font-bold mb-2">Interested in Investing?</h2>
          <p className="text-slate-300 text-sm mb-4">Get in touch with our team to learn more about investment opportunities.</p>
          <button onClick={() => setShowContact(true)} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
            Contact Our Team
          </button>
        </div>
      </div>

      {/* Contact Modal */}
      {showContact && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowContact(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="contact-modal">
            {contacted ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-slate-900 mb-2">Thank You!</h2>
                <p className="text-slate-600">We have received your inquiry and will get back to you shortly.</p>
                <button onClick={() => { setShowContact(false); setContacted(false); }} className="mt-4 px-4 py-2 bg-slate-200 rounded-lg text-sm">Close</button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-slate-900 mb-4">Investor Inquiry</h2>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Name *</label>
                      <input type="text" value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" data-testid="inv-name" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Email *</label>
                      <input type="email" value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" data-testid="inv-email" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Phone</label>
                      <input type="tel" value={contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Organization</label>
                      <input type="text" value={contactForm.organization} onChange={e => setContactForm(p => ({ ...p, organization: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Investment Range</label>
                    <select value={contactForm.investment_range} onChange={e => setContactForm(p => ({ ...p, investment_range: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white">
                      <option value="">Select Range</option>
                      <option value="1-5L">1 - 5 Lakhs</option>
                      <option value="5-25L">5 - 25 Lakhs</option>
                      <option value="25L-1Cr">25 Lakhs - 1 Crore</option>
                      <option value="1Cr+">1 Crore+</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Message</label>
                    <textarea value={contactForm.message} onChange={e => setContactForm(p => ({ ...p, message: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white resize-none" rows={3} placeholder="Tell us about your investment interest..." />
                  </div>
                </div>
                <button onClick={handleContact} disabled={contacting} className="mt-4 w-full py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50" data-testid="submit-inquiry">
                  {contacting ? <Loader2 className="w-5 h-5 animate-spin inline" /> : 'Submit Inquiry'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Password Modal */}
      {passwordModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPasswordModal(null)}>
          <div className="bg-white rounded-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900 mb-2">Password Required</h3>
            <p className="text-slate-500 text-sm mb-3">This document is password protected.</p>
            <input
              type="password"
              value={docPassword}
              onChange={e => setDocPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && downloadDoc(passwordModal.doc_id, docPassword)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white mb-3"
              placeholder="Enter password"
              autoFocus
              data-testid="doc-password"
            />
            <div className="flex gap-2">
              <button onClick={() => downloadDoc(passwordModal.doc_id, docPassword)} disabled={downloading} className="flex-1 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {downloading ? 'Downloading...' : 'Download'}
              </button>
              <button onClick={() => setPasswordModal(null)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="bg-slate-900 text-white py-8 px-4 text-center">
        <p className="text-slate-400 text-sm">Paras Reward Technologies Private Limited</p>
        <p className="text-slate-500 text-xs mt-1">B-18, Bizz Tower, Chatrapati Sambhaji Nagar, Maharashtra 431006</p>
        <p className="text-slate-500 text-xs mt-1">www.parasreward.com</p>
      </div>

      {/* Floating We're Hiring CTA */}
      <HiringBadge variant="floating" />
    </div>
  );
};

export default InvestorsPage;
