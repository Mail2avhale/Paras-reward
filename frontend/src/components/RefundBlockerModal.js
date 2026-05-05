import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  AlertTriangle, RefreshCw, Shield, CheckCircle2, Loader2, Phone,
  IndianRupee, Clock, Send, Building2, CreditCard, User, Tag
} from 'lucide-react';

import { API } from "../lib/api";

const SERVICE_COLORS = {
  'Mobile Recharge': 'bg-blue-100 text-blue-700 border-blue-200',
  'Bill Payment': 'bg-purple-100 text-purple-700 border-purple-200',
  'Money Remittance (DMT)': 'bg-amber-100 text-amber-700 border-amber-200',
  'Bank Transfer': 'bg-green-100 text-green-700 border-green-200',
};

const RefundBlockerModal = ({ userId, onAllRefundsComplete }) => {
  const [pendingRefunds, setPendingRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  // state[tid] = { sending, otpSent, otp, verifying, completed, error }
  const [state, setState] = useState({});

  const fetchPendingRefunds = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/recharge/pending-refunds/${userId}`);
      if (res.data?.success) {
        const list = res.data.pending_refunds || [];
        setPendingRefunds(list);
        if (list.length === 0) {
          onAllRefundsComplete();
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch pending refunds:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, onAllRefundsComplete]);

  useEffect(() => {
    fetchPendingRefunds();
  }, [fetchPendingRefunds]);

  const setTxn = (tid, patch) =>
    setState((prev) => ({ ...prev, [tid]: { ...(prev[tid] || {}), ...patch } }));

  // STEP 1: Send OTP (Eko sends SMS to user's registered mobile)
  const handleSendOtp = async (tid) => {
    setTxn(tid, { sending: true, error: '' });
    try {
      const res = await axios.post(`${API}/recharge/refund/process/${tid}`, { user_id: userId });
      if (res.data?.success) {
        if (res.data.auto_completed) {
          // Staging: refund auto-completed
          toast.success(`Refund of ₹${res.data.refunded_amount || ''} completed!`);
          setTxn(tid, { sending: false, completed: true });
          setTimeout(() => fetchPendingRefunds(), 1500);
        } else {
          // Production: OTP sent via SMS, user must enter.
          // delivery_confirmed=false → Eko didn't return a confirmation token,
          // SMS may not actually arrive. Soften the toast + flag the row so
          // the OTP screen shows a 'Try again in 60s' hint.
          const ambiguous = res.data.delivery_confirmed === false;
          if (ambiguous) {
            toast.warning(
              res.data.message ||
              "OTP request submitted. If you don't receive an SMS within 60 seconds, tap 'Resend OTP'."
            );
          } else {
            toast.success(res.data.message || 'OTP sent to your registered mobile');
          }
          setTxn(tid, {
            sending: false,
            otpSent: true,
            mobile_hint: res.data.mobile_hint,
            delivery_confirmed: !ambiguous,
          });
        }
      } else {
        const msg = res.data?.error || res.data?.message || 'Failed to send OTP';
        toast.error(msg);
        setTxn(tid, { sending: false, error: msg });
      }
    } catch (err) {
      const msg = err?.response?.data?.error || 'Network error. Please try again.';
      toast.error(msg);
      setTxn(tid, { sending: false, error: msg });
    }
  };

  // STEP 2: Verify OTP → complete refund
  const handleVerifyOtp = async (tid) => {
    const otp = (state[tid]?.otp || '').trim();
    if (!otp || otp.length < 4) {
      toast.error('Please enter a valid OTP');
      return;
    }
    setTxn(tid, { verifying: true, error: '' });
    try {
      const res = await axios.post(`${API}/recharge/refund/verify-otp/${tid}`, {
        user_id: userId, otp,
      });
      if (res.data?.success) {
        toast.success(`Refund of ₹${res.data.refunded_amount || ''} completed!`);
        setTxn(tid, { verifying: false, completed: true });
        setTimeout(() => fetchPendingRefunds(), 1500);
      } else {
        const msg = res.data?.error || res.data?.message || 'OTP verification failed';
        toast.error(msg);
        setTxn(tid, { verifying: false, error: msg });
      }
    } catch (err) {
      const msg = err?.response?.data?.error || 'Verification failed. Please try again.';
      toast.error(msg);
      setTxn(tid, { verifying: false, error: msg });
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm" data-testid="refund-blocker-loading">
        <div className="bg-white rounded-2xl p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-3" />
          <p className="text-gray-600">Checking pending refunds...</p>
        </div>
      </div>
    );
  }

  if (pendingRefunds.length === 0) return null;

  const totalAmount = pendingRefunds.reduce(
    (sum, t) => sum + (parseFloat(t.amount_inr) || 0), 0
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4" data-testid="refund-blocker-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 px-6 py-5 flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/20 rounded-full p-2">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white" data-testid="refund-blocker-title">
              Action Required: Complete Pending Refunds
            </h2>
          </div>
          <p className="text-white/90 text-sm">
            You have <b>{pendingRefunds.length}</b> transaction(s) totalling
            <b className="mx-1">₹{totalAmount.toLocaleString('en-IN')}</b>
            awaiting refund. Complete all to unlock your dashboard.
          </p>
        </div>

        {/* Transaction list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" data-testid="refund-list">
          {pendingRefunds.map((txn, idx) => {
            const tid = txn.eko_tid;
            const s = state[tid] || {};
            const serviceClass = SERVICE_COLORS[txn.service_type] || 'bg-gray-100 text-gray-700 border-gray-200';
            const isDmt = txn.source === 'dmt' || txn.source === 'bank_transfer';

            return (
              <div
                key={tid}
                className={`border-2 rounded-xl p-4 transition-all ${
                  s.completed
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-gray-50 hover:border-amber-300'
                }`}
                data-testid={`refund-item-${tid}`}
              >
                {/* Header row: index + service badge + status */}
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500">#{idx + 1}</span>
                    <span className={`text-[11px] font-semibold px-2 py-1 rounded-full border ${serviceClass}`}>
                      <Tag className="w-3 h-3 inline mr-1" />
                      {txn.service_type || 'Transaction'}
                    </span>
                  </div>
                  {s.completed ? (
                    <span className="flex items-center gap-1 text-green-600 text-sm font-semibold">
                      <CheckCircle2 className="w-5 h-5" />
                      Refunded
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                      <Clock className="w-4 h-4" />
                      Pending Refund
                    </span>
                  )}
                </div>

                {/* Amount — prominent */}
                <div className="flex items-baseline gap-2 mb-3">
                  <IndianRupee className="w-5 h-5 text-gray-600" />
                  <span className="text-2xl font-bold text-gray-900" data-testid={`refund-amount-${tid}`}>
                    {Number(txn.amount_inr || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700 mb-3 bg-white rounded-lg p-3 border border-gray-100">
                  <div>
                    <span className="text-gray-500 block">Transaction ID</span>
                    <span className="font-mono text-gray-900 break-all">{tid}</span>
                  </div>
                  {txn.client_ref_id && txn.client_ref_id !== tid && (
                    <div>
                      <span className="text-gray-500 block">Reference</span>
                      <span className="font-mono text-gray-900 break-all">{txn.client_ref_id}</span>
                    </div>
                  )}
                  {txn.customer_mobile && (
                    <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 -mx-1">
                      <span className="text-amber-700 block flex items-center gap-1 font-semibold">
                        <Phone className="w-3 h-3" />OTP will be sent to:
                      </span>
                      <span className="font-mono text-amber-900 text-sm">+91 {txn.customer_mobile}</span>
                      <span className="block text-[10px] text-amber-600 mt-0.5">
                        (Mobile registered with Eko for this transaction)
                      </span>
                    </div>
                  )}
                  {!isDmt && txn.phone && (
                    <div>
                      <span className="text-gray-500 block flex items-center gap-1">
                        <Phone className="w-3 h-3" />Phone
                      </span>
                      <span className="font-medium text-gray-900">{txn.phone}</span>
                    </div>
                  )}
                  {!isDmt && txn.operator && (
                    <div>
                      <span className="text-gray-500 block">Operator</span>
                      <span className="font-medium text-gray-900">{txn.operator}</span>
                    </div>
                  )}
                  {isDmt && txn.beneficiary_name && (
                    <div className="sm:col-span-2">
                      <span className="text-gray-500 block flex items-center gap-1">
                        <User className="w-3 h-3" />Beneficiary
                      </span>
                      <span className="font-medium text-gray-900">{txn.beneficiary_name}</span>
                    </div>
                  )}
                  {isDmt && txn.account_number && (
                    <div>
                      <span className="text-gray-500 block flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />Account
                      </span>
                      <span className="font-mono text-gray-900">{txn.account_number}</span>
                    </div>
                  )}
                  {isDmt && (txn.bank_name || txn.ifsc) && (
                    <div>
                      <span className="text-gray-500 block flex items-center gap-1">
                        <Building2 className="w-3 h-3" />Bank
                      </span>
                      <span className="font-medium text-gray-900">
                        {txn.bank_name}{txn.ifsc ? ` · ${txn.ifsc}` : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action area */}
                {!s.completed && (
                  <div>
                    {!s.otpSent ? (
                      /* STEP 1: Send OTP */
                      <button
                        onClick={() => handleSendOtp(tid)}
                        disabled={s.sending}
                        className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
                        data-testid={`send-otp-btn-${tid}`}
                      >
                        {s.sending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        {s.sending ? 'Sending OTP...' : 'Send Refund OTP to My Mobile'}
                      </button>
                    ) : (
                      /* STEP 2: Enter OTP */
                      <div className="space-y-2">
                        <div className="flex items-center gap-1 text-xs text-blue-700 mb-1">
                          <Shield className="w-4 h-4" />
                          OTP sent via SMS {s.mobile_hint ? `to ${s.mobile_hint}` : 'to your registered mobile'}. Enter below:
                        </div>
                        {s.delivery_confirmed === false && (
                          <div
                            className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 leading-snug"
                            data-testid={`refund-delivery-warning-${tid}`}
                          >
                            Delivery not confirmed by the gateway. If you don't receive an SMS within 60 seconds, tap <span className="font-semibold">Resend OTP</span> below or contact support.
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={10}
                            placeholder="Enter OTP"
                            value={s.otp || ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setTxn(tid, { otp: val, error: '' });
                            }}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-center text-lg font-mono tracking-widest focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                            data-testid={`otp-input-${tid}`}
                          />
                          <button
                            onClick={() => handleVerifyOtp(tid)}
                            disabled={s.verifying || !s.otp}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                            data-testid={`verify-otp-btn-${tid}`}
                          >
                            {s.verifying ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            Verify
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSendOtp(tid)}
                          disabled={s.sending}
                          className="text-xs text-amber-600 hover:text-amber-700 underline disabled:opacity-50"
                          data-testid={`resend-otp-btn-${tid}`}
                        >
                          {s.sending ? 'Resending...' : 'Resend OTP'}
                        </button>
                      </div>
                    )}
                    {s.error && (
                      <p className="text-xs text-red-600 mt-2 bg-red-50 border border-red-200 rounded px-2 py-1" data-testid={`refund-error-${tid}`}>
                        {s.error}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 px-6 py-3 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            OTP is sent via SMS by Eko to your registered mobile. Your wallet balance
            will be restored automatically after each successful refund.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RefundBlockerModal;
