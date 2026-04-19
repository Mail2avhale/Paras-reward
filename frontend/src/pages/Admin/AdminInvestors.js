import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  TrendingUp, Plus, Edit2, Trash2, Upload, Lock, Unlock, Download,
  Users, Newspaper, HelpCircle, FileText, MessageSquare, X,
  Loader2, RefreshCw, Link as LinkIcon, Calendar, Mail, Phone,
  Building, DollarSign, Eye, EyeOff
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const INQUIRY_STATUS = {
  new: 'bg-blue-500/20 text-blue-400',
  contacted: 'bg-yellow-500/20 text-yellow-400',
  in_discussion: 'bg-purple-500/20 text-purple-400',
  closed: 'bg-green-500/30 text-green-400',
  rejected: 'bg-red-500/20 text-red-400'
};
const INQUIRY_STATUSES = ['new', 'contacted', 'in_discussion', 'closed', 'rejected'];

const AdminInvestors = () => {
  const admin = JSON.parse(localStorage.getItem('paras_user') || '{}');
  const adminId = admin?.uid || admin?.user_id || admin?.id || 'admin';

  const [activeTab, setActiveTab] = useState('faq');
  const [loading, setLoading] = useState(false);

  // FAQ
  const [faqs, setFaqs] = useState([]);
  const [editingFaq, setEditingFaq] = useState(null);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', order: 99 });
  const [showFaqModal, setShowFaqModal] = useState(false);

  // Team
  const [team, setTeam] = useState([]);
  const [editingMember, setEditingMember] = useState(null);
  const [memberForm, setMemberForm] = useState({ name: '', role: '', bio: '', photo_url: '', linkedin: '', order: 99 });
  const [showTeamModal, setShowTeamModal] = useState(false);

  // Press
  const [press, setPress] = useState([]);
  const [pressForm, setPressForm] = useState({ title: '', summary: '', url: '', source: '', date: new Date().toISOString().slice(0, 10) });
  const [showPressModal, setShowPressModal] = useState(false);

  // Documents
  const [documents, setDocuments] = useState([]);
  const [docForm, setDocForm] = useState({ title: '', doc_type: 'pitch_deck', password: '', file: null });
  const [showDocModal, setShowDocModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  // Inquiries
  const [inquiries, setInquiries] = useState([]);
  const [viewInquiry, setViewInquiry] = useState(null);
  const [inquiryFilter, setInquiryFilter] = useState('all');

  // Metrics
  const [metrics, setMetrics] = useState(null);

  /* ---------- Fetchers ---------- */
  const fetchFaqs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/public/investors/faq`);
      setFaqs(res.data?.faqs || []);
    } catch { toast.error('Failed to load FAQs'); }
    finally { setLoading(false); }
  }, []);

  const fetchTeam = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/public/investors/team`);
      setTeam(res.data?.team || []);
    } catch { toast.error('Failed to load team'); }
    finally { setLoading(false); }
  }, []);

  const fetchPress = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/public/investors/press`);
      setPress(res.data?.press || []);
    } catch { toast.error('Failed to load press'); }
    finally { setLoading(false); }
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/public/investors/documents`);
      setDocuments(res.data?.documents || []);
    } catch { toast.error('Failed to load documents'); }
    finally { setLoading(false); }
  }, []);

  const fetchInquiries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/public/investors/inquiries`);
      setInquiries(res.data?.inquiries || []);
    } catch { toast.error('Failed to load inquiries'); }
    finally { setLoading(false); }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/public/investors/metrics`);
      setMetrics(res.data?.metrics || null);
    } catch {}
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);
  useEffect(() => {
    if (activeTab === 'faq') fetchFaqs();
    else if (activeTab === 'team') fetchTeam();
    else if (activeTab === 'press') fetchPress();
    else if (activeTab === 'documents') fetchDocuments();
    else if (activeTab === 'inquiries') fetchInquiries();
  }, [activeTab, fetchFaqs, fetchTeam, fetchPress, fetchDocuments, fetchInquiries]);

  /* ---------- FAQ Actions ---------- */
  const openFaqModal = (faq = null) => {
    setEditingFaq(faq);
    setFaqForm(faq ? { question: faq.question, answer: faq.answer, order: faq.order || 99 } : { question: '', answer: '', order: 99 });
    setShowFaqModal(true);
  };
  const saveFaq = async () => {
    if (!faqForm.question || !faqForm.answer) { toast.error('Question and answer required'); return; }
    try {
      await axios.post(`${API}/public/investors/faq`, {
        faq_id: editingFaq?.faq_id,
        question: faqForm.question,
        answer: faqForm.answer,
        order: parseInt(faqForm.order) || 99
      });
      toast.success(editingFaq ? 'FAQ updated' : 'FAQ added');
      setShowFaqModal(false);
      fetchFaqs();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };
  const deleteFaq = async (faq_id) => {
    if (!window.confirm('Delete this FAQ?')) return;
    try {
      await axios.delete(`${API}/public/investors/faq/${faq_id}`);
      toast.success('FAQ deleted');
      fetchFaqs();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  /* ---------- Team Actions ---------- */
  const openTeamModal = (m = null) => {
    setEditingMember(m);
    setMemberForm(m ? { ...m, order: m.order || 99 } : { name: '', role: '', bio: '', photo_url: '', linkedin: '', order: 99 });
    setShowTeamModal(true);
  };
  const saveMember = async () => {
    if (!memberForm.name || !memberForm.role) { toast.error('Name and role required'); return; }
    try {
      await axios.post(`${API}/public/investors/team`, {
        member_id: editingMember?.member_id,
        ...memberForm,
        order: parseInt(memberForm.order) || 99
      });
      toast.success(editingMember ? 'Team member updated' : 'Member added');
      setShowTeamModal(false);
      fetchTeam();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };
  const deleteMember = async (member_id) => {
    if (!window.confirm('Remove this team member?')) return;
    try {
      await axios.delete(`${API}/public/investors/team/${member_id}`);
      toast.success('Member removed');
      fetchTeam();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  /* ---------- Press Actions ---------- */
  const openPressModal = () => {
    setPressForm({ title: '', summary: '', url: '', source: '', date: new Date().toISOString().slice(0, 10) });
    setShowPressModal(true);
  };
  const savePress = async () => {
    if (!pressForm.title || !pressForm.url) { toast.error('Title and URL required'); return; }
    try {
      await axios.post(`${API}/public/investors/press`, pressForm);
      toast.success('Press release added');
      setShowPressModal(false);
      fetchPress();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };
  const deletePress = async (press_id) => {
    if (!window.confirm('Delete this press release?')) return;
    try {
      await axios.delete(`${API}/public/investors/press/${press_id}`);
      toast.success('Deleted');
      fetchPress();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  /* ---------- Document Actions ---------- */
  const openDocModal = () => {
    setDocForm({ title: '', doc_type: 'pitch_deck', password: '', file: null });
    setShowDocModal(true);
  };
  const uploadDoc = async () => {
    if (!docForm.title || !docForm.file) { toast.error('Title and file required'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('title', docForm.title);
      fd.append('doc_type', docForm.doc_type);
      fd.append('password', docForm.password);
      fd.append('admin_id', adminId);
      fd.append('file', docForm.file);
      await axios.post(`${API}/public/investors/documents/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Document uploaded');
      setShowDocModal(false);
      fetchDocuments();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
    finally { setUploading(false); }
  };
  const deleteDoc = async (doc_id) => {
    if (!window.confirm('Delete this document and its file?')) return;
    try {
      await axios.delete(`${API}/public/investors/documents/${doc_id}`);
      toast.success('Document deleted');
      fetchDocuments();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  /* ---------- Inquiry Actions ---------- */
  const updateInquiryStatus = async (inquiry_id, status, note = '') => {
    try {
      await axios.put(`${API}/public/investors/inquiries/${inquiry_id}`, { status, note });
      toast.success('Status updated');
      fetchInquiries();
      if (viewInquiry?.inquiry_id === inquiry_id) setViewInquiry({ ...viewInquiry, status, admin_note: note || viewInquiry.admin_note });
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };
  const deleteInquiry = async (inquiry_id) => {
    if (!window.confirm('Delete this inquiry?')) return;
    try {
      await axios.delete(`${API}/public/investors/inquiries/${inquiry_id}`);
      toast.success('Deleted');
      setViewInquiry(null);
      fetchInquiries();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  const filteredInquiries = inquiryFilter === 'all'
    ? inquiries
    : inquiries.filter(i => (i.status || 'new') === inquiryFilter);

  const tabs = [
    { id: 'faq', label: 'FAQ', icon: HelpCircle, count: faqs.length },
    { id: 'team', label: 'Team', icon: Users, count: team.length },
    { id: 'press', label: 'Press', icon: Newspaper, count: press.length },
    { id: 'documents', label: 'Documents', icon: FileText, count: documents.length },
    { id: 'inquiries', label: 'Inquiries', icon: MessageSquare, count: inquiries.filter(i => (i.status || 'new') === 'new').length }
  ];

  const refreshCurrent = () => {
    fetchMetrics();
    if (activeTab === 'faq') fetchFaqs();
    else if (activeTab === 'team') fetchTeam();
    else if (activeTab === 'press') fetchPress();
    else if (activeTab === 'documents') fetchDocuments();
    else if (activeTab === 'inquiries') fetchInquiries();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Investors Management</h1>
              <p className="text-xs text-slate-400">FAQ • Team • Press • Documents • Inquiries</p>
            </div>
          </div>
          <button onClick={refreshCurrent} data-testid="refresh-btn" className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Metrics Preview */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Mini label="Total Users" value={metrics.total_users} />
            <Mini label="Active Subscribers" value={metrics.active_subscribers} />
            <Mini label="MAU (30d)" value={metrics.monthly_active_users} />
            <Mini label="Growth %" value={`${metrics.user_growth_rate}%`} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg mb-4 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              data-testid={`tab-${t.id}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === t.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
              {t.count > 0 && <span className="px-1.5 py-0.5 bg-slate-600 text-[10px] rounded-full">{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
          {activeTab === 'faq' && (
            <SectionList title="Frequently Asked Questions" loading={loading} items={faqs} onAdd={() => openFaqModal()} addLabel="Add FAQ" emptyText="No FAQs yet">
              {faqs.map(f => (
                <Row key={f.faq_id} testid={`faq-${f.faq_id}`}>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 mb-0.5">Order {f.order}</p>
                    <p className="font-semibold text-slate-100">{f.question}</p>
                    <p className="text-sm text-slate-400 line-clamp-2 mt-1">{f.answer}</p>
                  </div>
                  <RowActions onEdit={() => openFaqModal(f)} onDelete={() => deleteFaq(f.faq_id)} testidPrefix={`faq-${f.faq_id}`} />
                </Row>
              ))}
            </SectionList>
          )}

          {activeTab === 'team' && (
            <SectionList title="Leadership Team" loading={loading} items={team} onAdd={() => openTeamModal()} addLabel="Add Member" emptyText="No team members">
              {team.map(m => (
                <Row key={m.member_id} testid={`team-${m.member_id}`}>
                  <div className="flex items-center gap-3 flex-1">
                    {m.photo_url ? (
                      <img src={m.photo_url} alt={m.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-sm font-bold">{m.name?.[0]}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-100">{m.name}</p>
                      <p className="text-xs text-slate-400">{m.role}</p>
                      {m.bio && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{m.bio}</p>}
                    </div>
                  </div>
                  <RowActions onEdit={() => openTeamModal(m)} onDelete={() => deleteMember(m.member_id)} testidPrefix={`team-${m.member_id}`} />
                </Row>
              ))}
            </SectionList>
          )}

          {activeTab === 'press' && (
            <SectionList title="Press & Media" loading={loading} items={press} onAdd={openPressModal} addLabel="Add Press Release" emptyText="No press releases">
              {press.map(p => (
                <Row key={p.press_id} testid={`press-${p.press_id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-100">{p.title}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>{p.source || 'Unknown source'}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{p.date}</span>
                    </div>
                    {p.summary && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.summary}</p>}
                    <a href={p.url} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 hover:underline mt-1 inline-flex items-center gap-1"><LinkIcon className="w-3 h-3" />Open article</a>
                  </div>
                  <RowActions onDelete={() => deletePress(p.press_id)} testidPrefix={`press-${p.press_id}`} />
                </Row>
              ))}
            </SectionList>
          )}

          {activeTab === 'documents' && (
            <SectionList title="Investor Documents" loading={loading} items={documents} onAdd={openDocModal} addLabel="Upload Document" emptyText="No documents">
              {documents.map(d => (
                <Row key={d.doc_id} testid={`doc-${d.doc_id}`}>
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${d.is_protected ? 'bg-amber-500/20 text-amber-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                      {d.is_protected ? <Lock className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-100 truncate">{d.title}</p>
                      <div className="flex gap-2 text-xs text-slate-400 flex-wrap">
                        <span className="px-2 py-0.5 bg-slate-700 rounded-full">{d.doc_type}</span>
                        <span>{d.filename}</span>
                        <span className="flex items-center gap-1"><Download className="w-3 h-3" />{d.download_count || 0}</span>
                        <span>{d.created_at?.slice(0, 10)}</span>
                      </div>
                    </div>
                  </div>
                  <RowActions onDelete={() => deleteDoc(d.doc_id)} testidPrefix={`doc-${d.doc_id}`} />
                </Row>
              ))}
            </SectionList>
          )}

          {activeTab === 'inquiries' && (
            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 className="font-bold text-slate-100">Investor Inquiries</h2>
                <select value={inquiryFilter} onChange={e => setInquiryFilter(e.target.value)} className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm" data-testid="filter-inquiry">
                  <option value="all">All ({inquiries.length})</option>
                  {INQUIRY_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)} ({inquiries.filter(i => (i.status||'new') === s).length})</option>)}
                </select>
              </div>
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
              ) : filteredInquiries.length === 0 ? (
                <div className="text-center py-12 text-slate-400">No inquiries</div>
              ) : (
                <div className="space-y-2">
                  {filteredInquiries.map(i => (
                    <div key={i.inquiry_id} onClick={() => setViewInquiry(i)} className="bg-slate-900/40 border border-slate-700/40 rounded-lg p-3 hover:border-slate-600 cursor-pointer" data-testid={`inquiry-${i.inquiry_id}`}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-semibold text-slate-100">{i.name}</p>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${INQUIRY_STATUS[i.status || 'new']}`}>{i.status || 'new'}</span>
                            {i.investment_range && <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full">{i.investment_range}</span>}
                          </div>
                          <div className="flex gap-3 text-xs text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{i.email}</span>
                            {i.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{i.phone}</span>}
                            {i.organization && <span className="flex items-center gap-1"><Building className="w-3 h-3" />{i.organization}</span>}
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{i.created_at?.slice(0, 10)}</span>
                          </div>
                          <p className="text-sm text-slate-300 mt-1 line-clamp-2">{i.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FAQ Modal */}
      {showFaqModal && (
        <Modal title={editingFaq ? 'Edit FAQ' : 'Add FAQ'} onClose={() => setShowFaqModal(false)} onSave={saveFaq} saveLabel="Save FAQ">
          <Input label="Question *" value={faqForm.question} onChange={v => setFaqForm(p => ({ ...p, question: v }))} testid="faq-question" />
          <Textarea label="Answer *" value={faqForm.answer} onChange={v => setFaqForm(p => ({ ...p, answer: v }))} rows={4} testid="faq-answer" />
          <Input label="Order (lower = first)" type="number" value={faqForm.order} onChange={v => setFaqForm(p => ({ ...p, order: v }))} />
        </Modal>
      )}

      {/* Team Modal */}
      {showTeamModal && (
        <Modal title={editingMember ? 'Edit Member' : 'Add Member'} onClose={() => setShowTeamModal(false)} onSave={saveMember} saveLabel="Save Member">
          <Input label="Name *" value={memberForm.name} onChange={v => setMemberForm(p => ({ ...p, name: v }))} testid="member-name" />
          <Input label="Role *" value={memberForm.role} onChange={v => setMemberForm(p => ({ ...p, role: v }))} testid="member-role" />
          <Textarea label="Bio" value={memberForm.bio} onChange={v => setMemberForm(p => ({ ...p, bio: v }))} rows={3} />
          <Input label="Photo URL" value={memberForm.photo_url} onChange={v => setMemberForm(p => ({ ...p, photo_url: v }))} />
          <Input label="LinkedIn URL" value={memberForm.linkedin} onChange={v => setMemberForm(p => ({ ...p, linkedin: v }))} />
          <Input label="Order" type="number" value={memberForm.order} onChange={v => setMemberForm(p => ({ ...p, order: v }))} />
        </Modal>
      )}

      {/* Press Modal */}
      {showPressModal && (
        <Modal title="Add Press Release" onClose={() => setShowPressModal(false)} onSave={savePress} saveLabel="Add Press">
          <Input label="Title *" value={pressForm.title} onChange={v => setPressForm(p => ({ ...p, title: v }))} testid="press-title" />
          <Input label="Source (e.g., TechCrunch, ET)" value={pressForm.source} onChange={v => setPressForm(p => ({ ...p, source: v }))} />
          <Input label="URL *" value={pressForm.url} onChange={v => setPressForm(p => ({ ...p, url: v }))} testid="press-url" />
          <Input label="Date" type="date" value={pressForm.date} onChange={v => setPressForm(p => ({ ...p, date: v }))} />
          <Textarea label="Summary" value={pressForm.summary} onChange={v => setPressForm(p => ({ ...p, summary: v }))} rows={3} />
        </Modal>
      )}

      {/* Document Modal */}
      {showDocModal && (
        <Modal title="Upload Document" onClose={() => setShowDocModal(false)} onSave={uploadDoc} saveLabel={uploading ? 'Uploading...' : 'Upload'} saveDisabled={uploading}>
          <Input label="Title *" value={docForm.title} onChange={v => setDocForm(p => ({ ...p, title: v }))} testid="doc-title" />
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Type</label>
            <select value={docForm.doc_type} onChange={e => setDocForm(p => ({ ...p, doc_type: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100" data-testid="doc-type">
              <option value="pitch_deck">Pitch Deck</option>
              <option value="financials">Financial Report</option>
              <option value="business_plan">Business Plan</option>
              <option value="valuation">Valuation</option>
              <option value="other">Other</option>
            </select>
          </div>
          <Input label="Password (optional, leave blank for public)" type="password" value={docForm.password} onChange={v => setDocForm(p => ({ ...p, password: v }))} testid="doc-password" />
          <div>
            <label className="text-xs text-slate-400 mb-1 block">File * (PDF/DOC, max 20MB)</label>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" onChange={e => setDocForm(p => ({ ...p, file: e.target.files?.[0] }))} className="hidden" data-testid="doc-file-input" />
            <button onClick={() => fileRef.current?.click()} className="w-full px-3 py-3 border-2 border-dashed border-slate-600 rounded-lg text-sm text-slate-400 hover:border-cyan-400 hover:text-cyan-400 transition-colors flex items-center justify-center gap-2" data-testid="doc-file-btn">
              <Upload className="w-4 h-4" /> {docForm.file?.name || 'Click to select file'}
            </button>
          </div>
        </Modal>
      )}

      {/* Inquiry Detail Modal */}
      {viewInquiry && (
        <Modal title={viewInquiry.name} onClose={() => setViewInquiry(null)} hideFooter>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Email" value={viewInquiry.email} />
              <Field label="Phone" value={viewInquiry.phone || '—'} />
              <Field label="Organization" value={viewInquiry.organization || '—'} />
              <Field label="Investment Range" value={viewInquiry.investment_range || '—'} />
              <Field label="Received On" value={viewInquiry.created_at?.slice(0, 16).replace('T', ' ')} />
              <Field label="Inquiry ID" value={viewInquiry.inquiry_id} />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Message</p>
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3 text-sm text-slate-300 whitespace-pre-wrap">{viewInquiry.message}</div>
            </div>
            {viewInquiry.admin_note && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Admin Note</p>
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3 text-sm text-slate-300 whitespace-pre-wrap">{viewInquiry.admin_note}</div>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 mb-1">Update Status</p>
              <div className="flex gap-2 flex-wrap">
                {INQUIRY_STATUSES.map(s => (
                  <button key={s} onClick={() => updateInquiryStatus(viewInquiry.inquiry_id, s)} data-testid={`inq-status-${s}`} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${viewInquiry.status === s ? INQUIRY_STATUS[s] + ' ring-2 ring-current' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                    {s.charAt(0).toUpperCase()+s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-between gap-2 pt-2 border-t border-slate-700">
              <button onClick={() => deleteInquiry(viewInquiry.inquiry_id)} className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-sm" data-testid="delete-inquiry-btn">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
              <a href={`mailto:${viewInquiry.email}`} className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded-lg text-sm">
                <Mail className="w-4 h-4" /> Email Reply
              </a>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

/* ==================== Helper Components ==================== */
const Mini = ({ label, value }) => (
  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
    <p className="text-xs text-slate-400">{label}</p>
    <p className="text-xl font-bold mt-0.5">{value}</p>
  </div>
);

const SectionList = ({ title, loading, items, onAdd, addLabel, emptyText, children }) => (
  <div>
    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
      <h2 className="font-bold text-slate-100">{title}</h2>
      <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500 hover:bg-cyan-600 text-slate-900 rounded-lg text-sm font-semibold" data-testid="add-btn">
        <Plus className="w-4 h-4" /> {addLabel}
      </button>
    </div>
    {loading ? (
      <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
    ) : items.length === 0 ? (
      <div className="text-center py-12 text-slate-400">{emptyText}</div>
    ) : (
      <div className="space-y-2">{children}</div>
    )}
  </div>
);

const Row = ({ children, testid }) => (
  <div className="bg-slate-900/40 border border-slate-700/40 rounded-lg p-3 flex items-start justify-between gap-3 flex-wrap" data-testid={testid}>
    {children}
  </div>
);

const RowActions = ({ onEdit, onDelete, testidPrefix }) => (
  <div className="flex items-center gap-1 flex-shrink-0">
    {onEdit && (
      <button onClick={onEdit} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg" data-testid={`${testidPrefix}-edit`}>
        <Edit2 className="w-4 h-4" />
      </button>
    )}
    {onDelete && (
      <button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg" data-testid={`${testidPrefix}-delete`}>
        <Trash2 className="w-4 h-4" />
      </button>
    )}
  </div>
);

const Modal = ({ title, children, onClose, onSave, saveLabel = 'Save', saveDisabled, hideFooter }) => (
  <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h3 className="font-bold text-slate-100">{title}</h3>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-4 overflow-y-auto flex-1 space-y-3">{children}</div>
      {!hideFooter && (
        <div className="flex justify-end gap-2 p-4 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm">Cancel</button>
          <button onClick={onSave} disabled={saveDisabled} className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-slate-900 disabled:opacity-50 rounded-lg text-sm font-semibold" data-testid="modal-save">{saveLabel}</button>
        </div>
      )}
    </div>
  </div>
);

const Input = ({ label, value, onChange, type = 'text', testid }) => (
  <div>
    <label className="text-xs text-slate-400 mb-1 block">{label}</label>
    <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100" data-testid={testid} />
  </div>
);
const Textarea = ({ label, value, onChange, rows = 2, testid }) => (
  <div>
    <label className="text-xs text-slate-400 mb-1 block">{label}</label>
    <textarea value={value ?? ''} onChange={e => onChange(e.target.value)} rows={rows} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 resize-none" data-testid={testid} />
  </div>
);
const Field = ({ label, value }) => (
  <div>
    <p className="text-xs text-slate-500">{label}</p>
    <p className="text-sm text-slate-200 break-words">{value || '—'}</p>
  </div>
);

export default AdminInvestors;
