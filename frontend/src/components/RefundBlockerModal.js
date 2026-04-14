import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertTriangle, RefreshCw, Shield, CheckCircle2, Loader2, Phone, IndianRupee, Clock, Send } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RefundBlockerModal = ({ userId, onAllRefundsComplete }) => {
  const [pendingRefunds, setPendingRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingStates, setProcessingStates] = useState({});

  const fetchPendingRefunds = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/recharge/pending-refunds/${userId}`);
      if (res.data?.success) {
        setPendingRefunds(res.data.pending_refunds || []);
        if ((res.data.pending_refunds || []).length === 0) {
          onAllRefundsComplete();
        }
      }
    } catch (err) {
      console.error('Failed to fetch pending refunds:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, onAllRefundsComplete]);

  useEffect(() => {
    fetchPendingRefunds();
  }, [fetchPendingRefunds]);

  // ONE-CLICK: Calls /refund/process/{tid} which does OTP + Refund in one shot
  const handleProcessRefund = async (tid) => {
    setProcessingStates(prev => ({ ...prev, [tid]: { processing: true } }));
    try {
      const res = await axios.post(`${API}/recharge/refund/process/${tid}`, { user_id: userId });
      if (res.data?.success) {
        toast.success(`Refund of ₹${res.data.refunded_amount || ''} completed!`);
        setProcessingStates(prev => ({ ...prev, [tid]: { processing: false, completed: true } }));
        setTimeout(() => fetchPendingRefunds(), 1500);
      } else if (res.data?.requires_manual_otp) {
        // Fallback: API couldn't get OTP from response, need manual input
        toast.info('OTP sent to customer mobile. Please enter OTP below.');
        setProcessingStates(prev => ({
          ...prev,
          [tid]: { processing: false, manualOtp: true, otp: '', error: '' }
        }));
      } else {
        const msg = res.data?.message || res.data?.error || 'Refund failed';
        toast.error(msg);
        setProcessingStates(prev => ({ ...prev, [tid]: { processing: false, error: msg } }));
      }
    } catch (err) {
      toast.error('Refund failed. Please try again.');
      setProcessingStates(prev => ({ ...prev, [tid]: { processing: false, error: 'Network error' } }));
    }
  };

  // MANUAL FALLBACK: If auto-process couldn't get OTP, user enters it manually
  const handleManualVerify = async (tid) => {
    const otp = processingStates[tid]?.otp || '';
    if (!otp || otp.length < 4) {
      toast.error('Please enter a valid OTP');
      return;
    }
    setProcessingStates(prev => ({ ...prev, [tid]: { ...prev[tid], verifying: true } }));
    try {
      const res = await axios.post(`${API}/recharge/refund/verify-otp/${tid}`, {
        user_id: userId,
        otp: otp,
      });
      if (res.data?.success) {
        toast.success(`Refund completed for TID ${tid}!`);
        setProcessingStates(prev => ({ ...prev, [tid]: { ...prev[tid], verifying: false, completed: true } }));
        setTimeout(() => fetchPendingRefunds(), 1500);
      } else {
        const msg = res.data?.message || res.data?.error || 'OTP verification failed';
        toast.error(msg);
        setProcessingStates(prev => ({ ...prev, [tid]: { ...prev[tid], verifying: false, error: msg } }));
      }
    } catch (err) {
      toast.error('Verification failed. Please try again.');
      setProcessingStates(prev => ({ ...prev, [tid]: { ...prev[tid], verifying: false, error: 'Network error' } }));
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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md" data-testid="refund-blocker-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/20 rounded-full p-2">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white" data-testid="refund-blocker-title">
              Action Required: Pending Refunds
            </h2>
          </div>
          <p className="text-white/90 text-sm">
            You have {pendingRefunds.length} transaction(s) requiring refund.
            Click "Process Refund" to complete each one automatically.
          </p>
        </div>

        {/* Transaction list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" data-testid="refund-list">
          {pendingRefunds.map((txn, idx) => {
            const tid = txn.eko_tid;
            const state = processingStates[tid] || {};

            return (
              <div
                key={tid}
                className={`border rounded-xl p-4 transition-all ${
                  state.completed
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-gray-50 hover:border-amber-300'
                }`}
                data-testid={`refund-item-${tid}`}
              >
                {/* Transaction info */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                        TID: {tid}
                      </span>
                      <span className="text-xs text-gray-400">#{idx + 1}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {txn.phone || 'N/A'}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-gray-800">
                        <IndianRupee className="w-3.5 h-3.5" />
                        {txn.amount_inr || 0}
                      </span>
                    </div>
                    {txn.operator && (
                      <p className="text-xs text-gray-500 mt-1">{txn.operator}</p>
                    )}
                  </div>

                  {state.completed ? (
                    <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                      <CheckCircle2 className="w-5 h-5" />
                      Refunded
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                      <Clock className="w-4 h-4" />
                      Pending
                    </div>
                  )}
                </div>

                {/* Action area */}
                {!state.completed && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    {!state.manualOtp ? (
                      /* ONE-CLICK Process Refund button */
                      <div>
                        <button
                          onClick={() => handleProcessRefund(tid)}
                          disabled={state.processing}
                          className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
                          data-testid={`process-refund-btn-${tid}`}
                        >
                          {state.processing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          {state.processing ? 'Processing Refund...' : 'Process Refund'}
                        </button>
                        {state.error && (
                          <p className="text-xs text-red-500 mt-2" data-testid={`refund-error-${tid}`}>
                            {state.error}
                          </p>
                        )}
                      </div>
                    ) : (
                      /* MANUAL OTP fallback */
                      <div className="space-y-2">
                        <div className="flex items-center gap-1 text-sm text-blue-600 mb-2">
                          <Shield className="w-4 h-4" />
                          OTP sent to customer's mobile. Enter below:
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={10}
                            placeholder="Enter OTP"
                            value={state.otp || ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setProcessingStates(prev => ({
                                ...prev,
                                [tid]: { ...prev[tid], otp: val, error: '' }
                              }));
                            }}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-center text-lg font-mono tracking-widest focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                            data-testid={`otp-input-${tid}`}
                          />
                          <button
                            onClick={() => handleManualVerify(tid)}
                            disabled={state.verifying || !state.otp}
                            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                            data-testid={`verify-otp-btn-${tid}`}
                          >
                            {state.verifying ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            Verify
                          </button>
                        </div>
                        {state.error && (
                          <p className="text-xs text-red-500 mt-1">{state.error}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 px-6 py-4 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            Refunds are processed automatically via Eko.
            Your wallet balance will be restored upon successful refund.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RefundBlockerModal;
