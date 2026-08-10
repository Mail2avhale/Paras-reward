// User — "My Referral Bonus" page
// Shows earned bonuses + payout status + bank details collection
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Gift, IndianRupee, CheckCircle, Clock, X, ArrowLeft, Building2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API } from '../lib/api';

const currencyFmt = (n) => `₹ ${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MyReferralBonus = ({ user }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [campaignInfo, setCampaignInfo] = useState(null);

  const uid = user?.uid;

  const fetchAll = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const [my, cam] = await Promise.all([
        axios.get(`${API}/referral-bonus/my/${uid}`),
        axios.get(`${API}/admin/referral-bonus/campaign`).catch(() => ({ data: { campaign: null } })),
      ]);
      setData(my.data);
      setCampaignInfo(cam.data?.campaign);
      if (my.data?.needs_bank_details) {
        setShowBankModal(true);
      }
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to load'); }
    finally { setLoading(false); }
  }, [uid]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (!uid) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-24" data-testid="my-referral-bonus-page">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-sm sm:text-base font-bold text-slate-900">My Referral Bonuses</h1>
            <p className="text-xs text-slate-500">Track your ₹200 bonuses on new paid activations</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Gift className="w-4 h-4 text-amber-600" />
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4">
        {/* Campaign banner */}
        {campaignInfo?.enabled && (
          <div className="bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl p-5 text-slate-900 mb-4" data-testid="campaign-banner">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Limited Time Offer</p>
                <h2 className="text-xl sm:text-2xl font-bold mt-1">Earn ₹{campaignInfo.bonus_amount} per new referral</h2>
                <p className="text-xs mt-1 opacity-90">
                  Refer friends → they pay via Razorpay or Cash → you earn instantly
                </p>
                {campaignInfo.end_date && (
                  <p className="text-xs mt-2 font-semibold">Ends: {campaignInfo.end_date}</p>
                )}
              </div>
              <Gift className="w-12 h-12 opacity-30" />
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" /></div>
        ) : !data ? null : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <StatBox color="yellow" icon={Clock} label="Pending" value={currencyFmt(data.totals?.pending)} testid="my-pending" />
              <StatBox color="emerald" icon={CheckCircle} label="Paid" value={currencyFmt(data.totals?.paid)} testid="my-paid" />
              <StatBox color="blue" icon={IndianRupee} label="Total" value={currencyFmt((data.totals?.pending || 0) + (data.totals?.paid || 0))} testid="my-total" />
            </div>

            {/* Bank details prompt */}
            {(data.totals?.pending > 0 || data.totals?.paid > 0) && !data.has_bank_details && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-4" data-testid="bank-prompt">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-200 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-red-700" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-red-900">Bank details required for payout</p>
                    <p className="text-xs text-red-700 mt-0.5">Add your bank account details so we can transfer your bonus via NEFT.</p>
                    <button onClick={() => setShowBankModal(true)} className="mt-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold" data-testid="add-bank-btn">
                      Add Bank Details
                    </button>
                  </div>
                </div>
              </div>
            )}

            {data.has_bank_details && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 flex items-center justify-between" data-testid="bank-done">
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-800 font-medium">Bank details on file</span>
                </div>
                <button onClick={() => setShowBankModal(true)} className="text-xs text-emerald-700 hover:underline" data-testid="update-bank-btn">Update</button>
              </div>
            )}

            {/* Bonus list */}
            <h3 className="text-xs font-semibold text-slate-600 uppercase mb-2 mt-4">Recent Activations</h3>
            {data.bonuses?.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                <Gift className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No bonus earnings yet.</p>
                <p className="text-xs text-slate-400 mt-1">Share your referral code with friends to start earning.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.bonuses.map(b => (
                  <div key={b.bonus_id} className="bg-white border border-slate-200 rounded-xl p-3" data-testid={`bonus-${b.bonus_id}`}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{b.new_user_name || 'New user'}</p>
                        <p className="text-[10px] text-slate-500">
                          {(b.earned_at || '').slice(0, 10)} • {b.subscription_plan} plan
                          <span className="mx-1">•</span>
                          <span className={`inline-block px-1 rounded ${b.payment_method === 'razorpay' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {b.payment_method === 'manual_activation' ? 'Manual' : 'Razorpay'}
                          </span>
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-base font-bold text-emerald-600">{currencyFmt(b.bonus_amount)}</p>
                        <StatusPill status={b.status} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showBankModal && (
        <BankDetailsModal
          uid={uid}
          userName={user?.name}
          onClose={() => setShowBankModal(false)}
          onSaved={() => { setShowBankModal(false); fetchAll(); }}
        />
      )}
    </div>
  );
};

const StatBox = ({ color, icon: Icon, label, value, testid }) => {
  const bgs = { yellow: 'bg-yellow-100 text-yellow-600', emerald: 'bg-emerald-100 text-emerald-600', blue: 'bg-blue-100 text-blue-600' };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3" data-testid={testid}>
      <div className={`w-6 h-6 rounded-md flex items-center justify-center mb-1 ${bgs[color]}`}><Icon className="w-3.5 h-3.5" /></div>
      <p className="text-[10px] uppercase text-slate-500 font-semibold">{label}</p>
      <p className="text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
};

const StatusPill = ({ status }) => {
  const styles = { pending: 'bg-yellow-100 text-yellow-700', paid: 'bg-emerald-100 text-emerald-700', reversed: 'bg-red-100 text-red-700' };
  return <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${styles[status] || 'bg-slate-100 text-slate-700'}`}>{status?.toUpperCase()}</span>;
};

const BankDetailsModal = ({ uid, userName, onClose, onSaved }) => {
  const [form, setForm] = useState({ account_number: '', ifsc: '', bank_name: '', account_holder_name: userName || '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    axios.get(`${API}/referral-bonus/bank-details/${uid}`).then(({ data }) => {
      if (data.has_details) {
        setForm({
          account_number: data.account_number || '',
          ifsc: data.ifsc || '',
          bank_name: data.bank_name || '',
          account_holder_name: data.account_holder_name || userName || '',
        });
      }
    }).catch(() => {});
  }, [uid, userName]);

  const submit = async () => {
    if (!form.account_number || form.account_number.length < 6) { toast.error('Valid account number required'); return; }
    if (!form.ifsc || form.ifsc.length < 8) { toast.error('Valid IFSC required'); return; }
    if (!form.bank_name.trim()) { toast.error('Bank name required'); return; }
    if (!form.account_holder_name.trim()) { toast.error('Account holder name required'); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/referral-bonus/bank-details/${uid}`, { ...form, ifsc: form.ifsc.toUpperCase() });
      toast.success('Bank details saved. Payouts will be processed via NEFT.');
      onSaved();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Save failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-md w-full p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="bank-modal">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Bank Account Details</h3>
            <p className="text-xs text-slate-500 mt-0.5">For NEFT payout of your referral bonuses</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Account Holder Name (as per bank)</label>
            <input value={form.account_holder_name} onChange={(e) => setForm({ ...form, account_holder_name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="bank-holder" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Account Number</label>
            <input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value.replace(/\D/g, '') })} inputMode="numeric" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" data-testid="bank-account" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">IFSC Code</label>
            <input value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })} placeholder="e.g. HDFC0001234" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" data-testid="bank-ifsc" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Bank Name</label>
            <input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="e.g. HDFC Bank" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="bank-name" />
          </div>
        </div>
        <p className="text-[10px] text-slate-500 mt-3">
          🔒 Your details are stored securely and used only for referral bonus payouts.
          Please verify carefully — incorrect details may cause payment failure.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={submit} disabled={busy} className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg font-semibold disabled:opacity-60" data-testid="bank-save">
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Save Bank Details'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MyReferralBonus;
