import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Crown, Search, Loader2, CheckCircle2, AlertCircle, Users,
  Lock, Gift, Wallet, Clock, ShieldCheck, ChevronRight, History
} from 'lucide-react';
import { API } from '../lib/api';

/**
 * Sale Elite Subscription
 * ------------------------
 * Active Elite users can sponsor a 28-day Elite plan for ANY registered user
 * using their own PRC balance + redeem limit.
 *
 * Steps:
 *   1) Enter beneficiary mobile -> Preview
 *   2) Confirm with login PIN -> Activate
 *   3) Success card + optional history
 */
const SaleEliteSubscription = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState(null);
  const [mobile, setMobile] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pin, setPin] = useState('');
  const [activating, setActivating] = useState(false);
  const [successPayload, setSuccessPayload] = useState(null);
  const [history, setHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const fetchEligibility = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/subscription/sale-elite/eligibility/${user.uid}`);
      setEligibility(res.data);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('sale-elite eligibility error', e);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/subscription/sale-elite/history/${user.uid}`);
      setHistory(res.data);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('sale-elite history error', e);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchEligibility();
  }, [fetchEligibility]);

  const handleLookup = async () => {
    const digits = (mobile || '').replace(/\D/g, '');
    if (digits.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    try {
      setPreviewLoading(true);
      setPreview(null);
      const res = await axios.post(`${API}/subscription/sale-elite/lookup`, {
        sender_uid: user.uid,
        beneficiary_mobile: digits,
      });
      setPreview(res.data);
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Lookup failed';
      toast.error(msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!preview) return;
    if (!pin || pin.length < 4) {
      toast.error('Enter your login PIN to confirm');
      return;
    }
    try {
      setActivating(true);
      const clientRequestId = `sale-${user.uid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const res = await axios.post(`${API}/subscription/sale-elite/activate`, {
        sender_uid: user.uid,
        beneficiary_mobile: (mobile || '').replace(/\D/g, ''),
        pin,
        client_request_id: clientRequestId,
      });
      if (res.data?.success) {
        setSuccessPayload(res.data);
        setPin('');
        toast.success(res.data.message || 'Elite subscription sponsored!');
        // Refresh eligibility (balance / daily limit changes)
        fetchEligibility();
      } else {
        toast.error('Activation failed. Try again.');
      }
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Activation failed';
      toast.error(msg);
    } finally {
      setActivating(false);
    }
  };

  const resetFlow = () => {
    setSuccessPayload(null);
    setPreview(null);
    setMobile('');
    setPin('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="sale-elite-loading">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    );
  }

  // ============ NOT ELIGIBLE STATE ============
  if (!eligibility?.is_active_elite) {
    return (
      <div className="px-5 mt-6" data-testid="sale-elite-not-eligible">
        <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 p-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Elite Feature Locked</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            Only active Elite subscribers can sponsor an Elite subscription for friends.
            Upgrade to Elite first to unlock this feature.
          </p>
        </div>
      </div>
    );
  }

  const pricing = eligibility.pricing || {};
  const sender = eligibility.sender || {};

  // ============ SUCCESS STATE ============
  if (successPayload) {
    return (
      <div className="px-5 mt-6" data-testid="sale-elite-success">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl bg-gradient-to-br from-emerald-500/15 to-green-600/5 border border-emerald-500/30 p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Success!</h3>
              <p className="text-xs text-emerald-300/80">
                {successPayload.is_upcoming ? 'Subscription queued' : 'Subscription activated'}
              </p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Beneficiary</span>
              <span className="text-white font-medium">
                {successPayload.beneficiary?.masked_name} (****{successPayload.beneficiary?.mobile_last4})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Plan</span>
              <span className="text-white font-medium">Elite · {successPayload.duration_days} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">PRC Deducted</span>
              <span className="text-amber-400 font-semibold">{Math.round(successPayload.prc_deducted).toLocaleString('en-IN')} PRC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Value</span>
              <span className="text-white">₹{Number(successPayload.inr_value).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">
                {successPayload.is_upcoming ? 'Starts On' : 'Expires On'}
              </span>
              <span className="text-white">{successPayload.expires_at}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-emerald-500/20 mt-2">
              <span className="text-gray-400">Your New Balance</span>
              <span className="text-white font-semibold">
                {Math.round(successPayload.sender_new_balance).toLocaleString('en-IN')} PRC
              </span>
            </div>
          </div>

          <button
            onClick={resetFlow}
            data-testid="sale-elite-sponsor-another-btn"
            className="w-full mt-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition-colors"
          >
            Sponsor Another
          </button>
        </motion.div>
      </div>
    );
  }

  // ============ MAIN FORM ============
  return (
    <div className="px-5 mt-6 space-y-5 pb-20" data-testid="sale-elite-tab">
      {/* Hero card */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-rose-500/5 border border-amber-500/20 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Gift className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-white mb-1">Sponsor Elite for a Friend</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Use your PRC balance to gift a 28-day Elite subscription to any registered user.
              Transaction is recorded in your PRC statement.
            </p>
          </div>
        </div>

        {/* Pricing strip */}
        <div className="grid grid-cols-3 gap-2 mt-5">
          <div className="rounded-xl bg-black/30 border border-white/5 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Cost</p>
            <p className="text-sm font-bold text-white mt-1">
              {Math.round(pricing.total_prc || 0).toLocaleString('en-IN')} PRC
            </p>
          </div>
          <div className="rounded-xl bg-black/30 border border-white/5 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">INR Value</p>
            <p className="text-sm font-bold text-white mt-1">
              ₹{Number(pricing.inr_equivalent || 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="rounded-xl bg-black/30 border border-white/5 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Duration</p>
            <p className="text-sm font-bold text-white mt-1">28 days</p>
          </div>
        </div>

        {/* Fee breakdown */}
        <div className="mt-3 text-[11px] text-gray-500 leading-relaxed">
          ₹{pricing.base_inr} Base + ₹{pricing.gst_inr} GST + ₹{pricing.processing_fee_inr} Processing + ₹{pricing.admin_charges_inr} Admin (20%)
        </div>
      </div>

      {/* Wallet / Limits */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gray-900/60 border border-white/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-blue-400" />
            <p className="text-[11px] uppercase tracking-wide text-gray-500">PRC Balance</p>
          </div>
          <p className={`text-lg font-bold ${sender.can_afford_balance !== false ? 'text-white' : 'text-red-400'}`}>
            {Math.round(sender.prc_balance || 0).toLocaleString('en-IN')}
          </p>
        </div>
        <div className="rounded-xl bg-gray-900/60 border border-white/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Redeem Limit</p>
          </div>
          <p className={`text-lg font-bold ${(sender.effective_available || 0) >= (pricing.total_prc || 0) ? 'text-white' : 'text-red-400'}`}>
            {Math.round(sender.effective_available || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">Unlock {sender.unlock_percent || 0}%</p>
        </div>
      </div>

      {/* Daily limit */}
      {!sender.daily_limit_ok && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-300">
            Daily limit reached. You can sponsor only 1 Elite subscription per day.
          </p>
        </div>
      )}

      {/* Mobile lookup */}
      <div className="rounded-2xl bg-gray-900/60 border border-white/5 p-5">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          Beneficiary Mobile Number
        </label>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <input
            type="tel"
            inputMode="numeric"
            maxLength={13}
            placeholder="10-digit mobile"
            value={mobile}
            onChange={(e) => {
              setMobile(e.target.value);
              setPreview(null);
            }}
            disabled={!sender.daily_limit_ok || previewLoading}
            data-testid="sale-elite-mobile-input"
            className="w-full sm:flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleLookup}
            disabled={previewLoading || !mobile || !sender.daily_limit_ok}
            data-testid="sale-elite-lookup-btn"
            className="w-full sm:w-auto sm:flex-shrink-0 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Look Up
          </button>
        </div>
      </div>

      {/* Preview + confirm */}
      {preview && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/20 p-5 space-y-4"
          data-testid="sale-elite-preview"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">
                {preview.beneficiary?.masked_name}
              </p>
              <p className="text-xs text-gray-400">
                Mobile: ****{preview.beneficiary?.mobile_last4} · Current: {preview.beneficiary?.current_plan}
              </p>
            </div>
          </div>

          {preview.beneficiary?.will_be_queued && (
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-300 leading-relaxed">
                This user already has an active Elite plan. Your sponsored plan will be queued
                and activate after their current plan expires.
              </p>
            </div>
          )}

          {!preview.sender?.can_afford_balance && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <p className="text-xs text-red-300">Insufficient PRC balance.</p>
            </div>
          )}
          {!preview.sender?.can_afford_redeem_limit && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <p className="text-xs text-red-300">Insufficient redeem limit.</p>
            </div>
          )}

          {/* PIN confirm */}
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Confirm with Login PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              data-testid="sale-elite-pin-input"
              className="w-full mt-2 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:outline-none tracking-widest"
            />
          </div>

          <button
            onClick={handleActivate}
            disabled={
              activating ||
              !pin ||
              !preview.sender?.can_afford_balance ||
              !preview.sender?.can_afford_redeem_limit ||
              !preview.sender?.daily_limit_ok
            }
            data-testid="sale-elite-confirm-btn"
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold flex items-center justify-center gap-2 transition-all"
          >
            {activating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Crown className="w-5 h-5" />
                Sponsor Elite for {Math.round(pricing.total_prc || 0).toLocaleString('en-IN')} PRC
              </>
            )}
          </button>
        </motion.div>
      )}

      {/* History toggle */}
      <button
        onClick={() => {
          if (!showHistory) fetchHistory();
          setShowHistory(!showHistory);
        }}
        data-testid="sale-elite-history-toggle"
        className="w-full flex items-center justify-between px-5 py-3 rounded-xl bg-gray-900/60 border border-white/5 hover:bg-gray-800/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-white">Sponsorship History</span>
        </div>
        <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showHistory ? 'rotate-90' : ''}`} />
      </button>

      {showHistory && history && (
        <div className="space-y-3" data-testid="sale-elite-history-list">
          {history.sent?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Sponsored by You ({history.sent_count})
              </p>
              {history.sent.map((s) => (
                <div
                  key={s.sale_id}
                  className="rounded-xl bg-gray-900/60 border border-white/5 p-3 mb-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-white">{s.beneficiary_name}</p>
                      <p className="text-[11px] text-gray-500">
                        {s.beneficiary_mobile} · {new Date(s.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-amber-400">
                        -{Math.round(s.prc_cost).toLocaleString('en-IN')} PRC
                      </p>
                      <p className="text-[10px] text-gray-500 capitalize">{s.status}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {history.received?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-4">
                Received from Others ({history.received_count})
              </p>
              {history.received.map((r) => (
                <div
                  key={r.sale_id}
                  className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 mb-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-white">From: {r.sender_name}</p>
                      <p className="text-[11px] text-gray-500">
                        {new Date(r.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <p className="text-[10px] text-emerald-400 capitalize">{r.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {(history.sent?.length || 0) === 0 && (history.received?.length || 0) === 0 && (
            <p className="text-center text-sm text-gray-500 py-6">No sponsorship history yet.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default SaleEliteSubscription;
