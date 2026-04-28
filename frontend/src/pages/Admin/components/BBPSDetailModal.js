import React from 'react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Loader2, Search, RefreshCw, Copy } from 'lucide-react';

/**
 * Detail modal for a BBPS request — shows user info, Eko details,
 * refund-info, EKO wallet refund check, OTP-based refund flow, and
 * manual PRC refund. Extracted from AdminBBPSDashboard.js.
 * Parent owns all state; this is a pure UI component.
 */
const BBPSDetailModal = ({
  selectedRequest,
  onClose,
  // Refund & check state from parent
  refundLoading,
  ekoCheckLoading,
  ekoRefundResult,
  ekoRefundStep,
  setEkoRefundStep,
  ekoRefundOtp,
  setEkoRefundOtp,
  ekoRefundResponse,
  ekoRefundLoading,
  // Handlers
  handleResendRefundOtp,
  handleVerifyRefundOtp,
  handleCheckEkoRefund,
  handleRefund,
  formatServiceName,
}) => {
  if (!selectedRequest) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800">Request Details</h2>
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-800"
              data-testid="detail-modal-close-btn"
            >
              ✕
            </Button>
          </div>

          {/* Request Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">Request ID</p>
                <p className="text-sm font-mono text-slate-800">{selectedRequest.request?.request_id}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">Service</p>
                <p className="text-sm text-slate-800">{formatServiceName(selectedRequest.request?.service_type)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">Amount</p>
                <p className="text-lg font-bold text-amber-400">₹{selectedRequest.request?.amount?.toLocaleString()}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">Status</p>
                <p className={`text-sm font-medium ${
                  selectedRequest.request?.status === 'completed' ? 'text-green-400' :
                  selectedRequest.request?.status === 'failed' ? 'text-red-400' :
                  'text-yellow-400'
                }`}>{selectedRequest.request?.status?.toUpperCase()}</p>
              </div>
            </div>

            {/* User Info */}
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-2">User</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-slate-500">Name:</span> <span className="text-slate-800">{selectedRequest.user?.name || 'N/A'}</span></div>
                <div><span className="text-slate-500">Email:</span> <span className="text-slate-800">{selectedRequest.user?.email || 'N/A'}</span></div>
                <div><span className="text-slate-500">Mobile:</span> <span className="text-slate-800">{selectedRequest.user?.mobile || 'N/A'}</span></div>
                <div><span className="text-slate-500">Plan:</span> <span className="text-slate-800">{selectedRequest.user?.subscription_plan || 'N/A'}</span></div>
              </div>
            </div>

            {/* Eko Details */}
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-2">Eko Transaction Details</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">TID:</span>
                  <span className="text-green-600 font-mono">{selectedRequest.eko_details?.tid || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Client Ref ID:</span>
                  <span className="text-blue-600 font-mono">{selectedRequest.eko_details?.client_ref_id || selectedRequest.request?.client_ref_id || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">UTR:</span>
                  <span className="text-slate-800 font-mono">{selectedRequest.eko_details?.utr || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="text-slate-800">{selectedRequest.eko_details?.status || 'N/A'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500">Message:</span>
                  <span className="text-slate-800 text-xs break-words">{selectedRequest.eko_details?.message || selectedRequest.request?.eko_error || selectedRequest.request?.failure_reason || 'N/A'}</span>
                </div>
              </div>

              {/* Copy for EKO Support */}
              <Button
                onClick={() => {
                  const tid = selectedRequest.eko_details?.tid || 'N/A';
                  const clientRef = selectedRequest.eko_details?.client_ref_id || selectedRequest.request?.client_ref_id || 'N/A';
                  const amount = selectedRequest.request?.amount || 'N/A';
                  const date = selectedRequest.request?.created_at ? new Date(selectedRequest.request.created_at).toLocaleString('en-IN') : 'N/A';
                  const status = selectedRequest.request?.status || 'N/A';
                  const reqId = selectedRequest.request?.request_id || 'N/A';
                  const consumer = selectedRequest.request?.details?.consumer_number || selectedRequest.request?.details?.mobile_number || 'N/A';
                  const operator = selectedRequest.request?.details?.operator_id || selectedRequest.request?.details?.operator || 'N/A';
                  const text = `EKO Support Details:\nTID: ${tid}\nClient Ref ID: ${clientRef}\nRequest ID: ${reqId}\nAmount: ₹${amount}\nDate: ${date}\nStatus: ${status}\nConsumer/Mobile: ${consumer}\nOperator ID: ${operator}`;
                  navigator.clipboard.writeText(text);
                  toast.success('EKO Support details copied!');
                }}
                size="sm"
                className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                data-testid="copy-eko-support-btn"
              >
                <Copy className="h-4 w-4 mr-2" /> Copy for EKO Support
              </Button>
            </div>

            {/* Refund Info */}
            {selectedRequest.refund_info?.refunded && (
              <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl p-4">
                <p className="text-xs text-orange-400 mb-2">Refund Info</p>
                <p className="text-lg font-bold text-orange-400">
                  {selectedRequest.refund_info.amount} PRC Refunded
                </p>
              </div>
            )}

            {/* Check EKO Wallet Refund Status */}
            {(selectedRequest.request?.status === 'failed' || selectedRequest.request?.status === 'FAILED' || selectedRequest.request?.status === 'refund_pending') && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs text-blue-600 mb-3 font-semibold">EKO Wallet Refund Check</p>
                <p className="text-sm text-slate-600 mb-3">
                  Check if EKO has refunded the amount to merchant wallet for this failed transaction.
                </p>
                <Button
                  onClick={() => handleCheckEkoRefund(selectedRequest.request?.request_id)}
                  disabled={ekoCheckLoading}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold mb-3"
                  data-testid="check-eko-refund-btn"
                >
                  {ekoCheckLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Checking EKO...</>
                  ) : (
                    <><Search className="h-4 w-4 mr-2" /> Check EKO Wallet Refund Status</>
                  )}
                </Button>

                {ekoRefundResult && (
                  <div className={`mt-2 p-3 rounded-lg text-sm ${
                    ekoRefundResult.eko_refunded ? 'bg-green-50 text-green-700 border border-green-200' :
                    ekoRefundResult.eko_status === 'REFUND_PENDING' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                    'bg-slate-50 text-slate-700 border border-slate-200'
                  }`}>
                    <p className="font-semibold mb-1">
                      EKO Status: {ekoRefundResult.eko_status || 'Not Found'}
                    </p>
                    {ekoRefundResult.eko_refunded && <p>EKO wallet refunded</p>}
                    {ekoRefundResult.eko_status === 'REFUND_PENDING' && <p>EKO refund is pending - will be auto-refunded</p>}
                    {ekoRefundResult.wallet_debited === false && <p>EKO wallet was NOT debited for this transaction</p>}
                    {ekoRefundResult.error && <p className="text-red-600">{ekoRefundResult.error}</p>}
                    {ekoRefundResult.eko_message && <p>Message: {ekoRefundResult.eko_message}</p>}
                  </div>
                )}
              </div>
            )}

            {/* EKO Wallet Refund via OTP */}
            {(selectedRequest.request?.status === 'failed' || selectedRequest.request?.status === 'FAILED' || selectedRequest.request?.status === 'refund_pending') && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4" data-testid="eko-wallet-refund-section">
                <p className="text-xs text-amber-700 mb-2 font-semibold">EKO Wallet Refund (OTP Flow)</p>

                {/* If no TID, allow manual entry */}
                {(!selectedRequest.eko_details?.tid || selectedRequest.eko_details?.tid === 'N/A') && ekoRefundStep !== 'manual_tid' && ekoRefundStep !== 'otp_sent' && ekoRefundStep !== 'done' ? (
                  <div>
                    <p className="text-sm text-slate-600 mb-3">
                      TID not available. Get TID from EKO Dashboard and enter manually.
                    </p>
                    <Button
                      onClick={() => setEkoRefundStep('manual_tid')}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold"
                    >
                      Enter TID Manually
                    </Button>
                  </div>
                ) : ekoRefundStep === 'manual_tid' ? (
                  <div className="space-y-3">
                    <p className="text-sm text-amber-700">Enter EKO Transaction ID:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={ekoRefundOtp}
                        onChange={(e) => setEkoRefundOtp(e.target.value)}
                        placeholder="Enter EKO TID"
                        className="flex-1 px-3 py-2 border border-amber-300 rounded-lg text-sm font-mono"
                        data-testid="eko-manual-tid-input"
                      />
                      <Button
                        onClick={() => {
                          if (!ekoRefundOtp.trim()) { toast.error('Please enter TID'); return; }
                          handleResendRefundOtp(ekoRefundOtp.trim());
                          setEkoRefundOtp('');
                        }}
                        disabled={ekoRefundLoading}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
                      >
                        {ekoRefundLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send OTP'}
                      </Button>
                    </div>
                  </div>
                ) : ekoRefundStep === 'done' ? (
                  <div className="bg-green-50 border border-green-300 rounded-lg p-3">
                    <p className="text-green-700 font-semibold">Refund Successful!</p>
                    {ekoRefundResponse?.refunded_amount && (
                      <p className="text-sm text-green-600">Amount: ₹{ekoRefundResponse.refunded_amount}</p>
                    )}
                    {ekoRefundResponse?.new_balance && (
                      <p className="text-sm text-green-600">New Balance: ₹{ekoRefundResponse.new_balance}</p>
                    )}
                  </div>
                ) : ekoRefundStep === 'otp_sent' ? (
                  <div className="space-y-3">
                    <p className="text-sm text-amber-700">OTP sent to customer. Enter OTP below:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={ekoRefundOtp}
                        onChange={(e) => setEkoRefundOtp(e.target.value)}
                        placeholder="Enter OTP"
                        className="flex-1 px-3 py-2 border border-amber-300 rounded-lg text-sm font-mono"
                        data-testid="eko-refund-otp-input"
                      />
                      <Button
                        onClick={() => handleVerifyRefundOtp(ekoRefundResponse?.tid || selectedRequest.eko_details?.tid)}
                        disabled={ekoRefundLoading}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold"
                        data-testid="eko-verify-otp-btn"
                      >
                        {ekoRefundLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Refund'}
                      </Button>
                    </div>
                    <Button
                      onClick={() => handleResendRefundOtp(ekoRefundResponse?.tid || selectedRequest.eko_details?.tid)}
                      disabled={ekoRefundLoading}
                      size="sm"
                      variant="outline"
                      className="text-amber-700 border-amber-400"
                    >
                      Resend OTP
                    </Button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-slate-600 mb-3">
                      EKO TID: <strong className="font-mono">{selectedRequest.eko_details?.tid}</strong> —
                      Send OTP to customer, verify it, and wallet refund will be processed.
                    </p>
                    <Button
                      onClick={() => handleResendRefundOtp(selectedRequest.eko_details?.tid)}
                      disabled={ekoRefundLoading}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold"
                      data-testid="eko-send-refund-otp-btn"
                    >
                      {ekoRefundLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending OTP...</>
                      ) : (
                        'Send Refund OTP to Customer'
                      )}
                    </Button>
                  </div>
                )}

                {ekoRefundResponse?.message && ekoRefundStep !== 'done' && (
                  <p className="text-xs text-slate-500 mt-2">EKO: {ekoRefundResponse.message}</p>
                )}
              </div>
            )}

            {selectedRequest.request?.status !== 'completed' &&
             selectedRequest.request?.status !== 'COMPLETED' &&
             !selectedRequest.refund_info?.refunded &&
             !selectedRequest.request?.prc_refunded && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-xs text-red-600 mb-3 font-semibold">Admin Action: Refund PRC</p>
                <p className="text-sm text-slate-600 mb-3">
                  This request is <strong>{selectedRequest.request?.status?.toUpperCase()}</strong> with no EKO transaction.
                  PRC ({selectedRequest.request?.total_prc_deducted?.toLocaleString() || 'N/A'} PRC) was deducted but service was not delivered.
                </p>
                <Button
                  onClick={() => handleRefund(
                    selectedRequest.request?.request_id,
                    `Stuck ${selectedRequest.request?.status} - EKO TID: ${selectedRequest.eko_details?.tid || 'None'}`
                  )}
                  disabled={refundLoading}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold"
                  data-testid="modal-refund-btn"
                >
                  {refundLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing Refund...</>
                  ) : (
                    <><RefreshCw className="h-4 w-4 mr-2" /> Refund {selectedRequest.request?.total_prc_deducted?.toLocaleString() || ''} PRC</>
                  )}
                </Button>
              </div>
            )}

            {/* Error Message */}
            {selectedRequest.request?.error_message && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4">
                <p className="text-xs text-red-400 mb-2">Error</p>
                <p className="text-sm text-red-300">{selectedRequest.request.error_message}</p>
              </div>
            )}

            {/* Request Details */}
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-2">Service Details</p>
              <pre className="text-xs text-slate-600 overflow-x-auto">
                {JSON.stringify(selectedRequest.request?.details, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BBPSDetailModal;
