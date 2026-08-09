import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, FileSignature, Download, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { API } from '../lib/api';

const CandidateOfferRespond = () => {
  const { token } = useParams();
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/public/offers/respond/${token}`);
      setOffer(r.data.offer);
    } catch (e) {
      setError('Offer link is invalid or has already been used.');
    } finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const respond = async (action) => {
    if (action === 'decline' && !declineReason.trim()) { toast.error('Please share a brief reason'); return; }
    setSubmitting(true);
    try {
      await axios.post(`${API}/public/offers/respond`, { token, action, reason: action === 'decline' ? declineReason : '' });
      toast.success(action === 'accept' ? 'Offer accepted! Welcome aboard 🎉' : 'Offer declined. Thank you for letting us know.');
      load();
      setShowDecline(false);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" data-testid="offer-error">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 mb-2">Link no longer active</h2>
        <p className="text-sm text-slate-600">{error}</p>
      </div>
    </div>
  );

  const alreadyResponded = ['accepted', 'declined', 'withdrawn'].includes(offer.status);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6" data-testid="offer-respond-page">
      <div className="max-w-2xl mx-auto space-y-4">
        <Link to={`/candidate/${offer.application_id}`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"><ArrowLeft className="w-3.5 h-3.5" /> Back to my portal</Link>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FileSignature className="w-6 h-6 text-emerald-600" />
            <h1 className="text-xl font-bold text-slate-900">Offer Letter</h1>
          </div>

          <div className="space-y-2 text-sm">
            <Row label="Candidate" value={offer.candidate_name} />
            <Row label="Offer ID" value={<span className="font-mono text-xs">{offer.offer_id}</span>} />
            <Row label="Designation" value={offer.designation} />
            <Row label="Department" value={offer.department} />
            <Row label="Work Location" value={offer.work_location} />
            <Row label="Hiring Type" value={offer.hiring_type} />
            <Row label="Joining Date" value={offer.joining_date} />
            <Row label="Annual CTC" value={<span className="font-bold text-emerald-700">₹ {offer.salary_ctc?.toLocaleString()}</span>} />
            {offer.probation_months > 0 && <Row label="Probation" value={`${offer.probation_months} months`} />}
          </div>

          <a href={`${API}/public/offers/${offer.offer_id}/pdf`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700" data-testid="offer-download-pdf">
            <Download className="w-4 h-4" /> Download Full Offer Letter (PDF)
          </a>

          <div className="mt-6 pt-6 border-t border-slate-200">
            {alreadyResponded ? (
              <div className={`flex items-center gap-2 p-3 rounded-lg ${offer.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-100 text-slate-600'}`} data-testid="offer-already-responded">
                {offer.status === 'accepted' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                <p className="text-sm font-medium">Offer {offer.status} on {offer.responded_at?.slice(0, 10) || '—'}</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-600 mb-3">Please review the terms above and let us know your decision.</p>
                {!showDecline ? (
                  <div className="flex gap-2">
                    <button onClick={() => respond('accept')} disabled={submitting} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold disabled:opacity-50" data-testid="offer-accept-btn">
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin inline" /> : 'Accept Offer'}
                    </button>
                    <button onClick={() => setShowDecline(true)} disabled={submitting} className="flex-1 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold" data-testid="offer-decline-btn">
                      Decline
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={3} placeholder="Please share a brief reason (optional but appreciated)" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="offer-decline-reason" />
                    <div className="flex gap-2">
                      <button onClick={() => setShowDecline(false)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                      <button onClick={() => respond('decline')} disabled={submitting} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-50" data-testid="offer-confirm-decline">
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Confirm Decline'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400">This is a legally binding decision — please review carefully before confirming.</p>
      </div>
    </div>
  );
};

const Row = ({ label, value }) => (
  <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
    <span className="text-slate-500">{label}</span>
    <span className="text-slate-900 font-medium text-right">{value || '—'}</span>
  </div>
);

export default CandidateOfferRespond;
