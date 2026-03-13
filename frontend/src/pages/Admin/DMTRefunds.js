import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  RefreshCw, AlertTriangle, CheckCircle, XCircle, 
  Send, Clock, Banknote, User, Hash, ChevronDown,
  ChevronUp, RotateCcw, MessageSquare
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminDMTRefunds = ({ user }) => {
  const [pendingRefunds, setPendingRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [expandedTxn, setExpandedTxn] = useState(null);
  const [otpInputs, setOtpInputs] = useState({});

  const fetchPendingRefunds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/eko/dmt/refund/pending?limit=100`);
      setPendingRefunds(res.data.pending_refunds || []);
    } catch (error) {
      toast.error('Failed to fetch pending refunds');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingRefunds();
  }, [fetchPendingRefunds]);

  // Resend OTP for refund
  const handleResendOTP = async (txn) => {
    const ekoTxnId = txn.eko_txn_id || txn.eko_tid;
    
    if (!ekoTxnId) {
      toast.error('No Eko transaction ID found. This transaction may not be eligible for refund via OTP.');
      return;
    }
    
    setProcessing(p => ({ ...p, [txn.txn_id || txn.transaction_id]: 'otp' }));
    
    try {
      const res = await axios.post(`${API}/eko/dmt/refund/resend-otp`, {
        eko_txn_id: ekoTxnId,
        user_id: user?.uid || 'admin'
      });
      
      if (res.data.success) {
        toast.success('Refund OTP sent to customer');
        setExpandedTxn(txn.txn_id || txn.transaction_id);
      } else {
        toast.error(res.data.message || 'Failed to send OTP');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to resend OTP');
    } finally {
      setProcessing(p => ({ ...p, [txn.txn_id || txn.transaction_id]: null }));
    }
  };

  // Process refund with OTP
  const handleProcessRefund = async (txn) => {
    const txnKey = txn.txn_id || txn.transaction_id;
    const ekoTxnId = txn.eko_txn_id || txn.eko_tid;
    const otp = otpInputs[txnKey];
    
    if (!ekoTxnId) {
      toast.error('No Eko transaction ID found');
      return;
    }
    
    if (!otp || otp.length < 4) {
      toast.error('Please enter valid OTP');
      return;
    }
    
    setProcessing(p => ({ ...p, [txnKey]: 'refund' }));
    
    try {
      const res = await axios.post(`${API}/eko/dmt/refund/process`, {
        eko_txn_id: ekoTxnId,
        otp: otp,
        user_id: user?.uid || 'admin'
      });
      
      if (res.data.success) {
        toast.success('Refund processed successfully!');
        setOtpInputs(o => ({ ...o, [txnKey]: '' }));
        fetchPendingRefunds();
      } else {
        toast.error(res.data.message || 'Refund failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Refund processing failed');
    } finally {
      setProcessing(p => ({ ...p, [txnKey]: null }));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'bg-green-500/20 text-green-400';
      case 'failed': return 'bg-red-500/20 text-red-400';
      case 'pending': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-500/20 rounded-xl">
            <RotateCcw className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">DMT Refunds</h1>
            <p className="text-sm text-gray-400">Process refunds for failed transactions</p>
          </div>
        </div>
        <Button
          onClick={fetchPendingRefunds}
          disabled={loading}
          variant="outline"
          className="border-gray-700 text-gray-300"
          data-testid="refresh-refunds-btn"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-500/10 border-blue-500/20 p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-400 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-medium text-blue-400 mb-1">Refund Process:</p>
            <ol className="list-decimal list-inside space-y-1 text-gray-400">
              <li>Click "Send OTP" to send refund OTP to customer's mobile</li>
              <li>Ask customer for the OTP they received</li>
              <li>Enter the OTP and click "Process Refund"</li>
              <li>This confirms cash was returned to customer and Eko will credit your account</li>
            </ol>
          </div>
        </div>
      </Card>

      {/* Pending Refunds List */}
      {loading ? (
        <Card className="bg-gray-900 border-gray-800 p-8">
          <div className="flex items-center justify-center gap-3 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Loading pending refunds...</span>
          </div>
        </Card>
      ) : pendingRefunds.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800 p-8">
          <div className="text-center text-gray-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500/50" />
            <p className="text-lg">No pending refunds</p>
            <p className="text-sm">All transactions are either successful or already refunded</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingRefunds.map((txn) => {
            const txnKey = txn.txn_id || txn.transaction_id;
            const isExpanded = expandedTxn === txnKey;
            const isProcessing = processing[txnKey];
            const hasEkoTid = txn.eko_txn_id || txn.eko_tid;
            
            return (
              <Card 
                key={txnKey} 
                className="bg-gray-900 border-gray-800 overflow-hidden"
                data-testid={`refund-card-${txnKey}`}
              >
                {/* Main Row */}
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
                  onClick={() => setExpandedTxn(isExpanded ? null : txnKey)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-red-500/20 rounded-lg">
                        <XCircle className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <p className="text-white font-mono text-sm">{txnKey}</p>
                        <div className="flex items-center gap-3 mt-1 text-sm">
                          <span className="text-gray-400">
                            <User className="w-3 h-3 inline mr-1" />
                            {txn.mobile || txn.customer_mobile || 'N/A'}
                          </span>
                          <span className="text-orange-400 font-medium">
                            ₹{(txn.amount_inr || txn.amount || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(txn.status)}`}>
                        {txn.status}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Section */}
                {isExpanded && (
                  <div className="border-t border-gray-800 p-4 bg-gray-800/30">
                    {/* Transaction Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                      <div>
                        <p className="text-gray-500">User ID</p>
                        <p className="text-white font-mono text-xs">{txn.user_id?.slice(0, 12)}...</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Recipient</p>
                        <p className="text-white">{txn.recipient_id || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Created</p>
                        <p className="text-white">{new Date(txn.created_at || txn.timestamp).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Eko TID</p>
                        <p className="text-white font-mono">{txn.eko_txn_id || txn.eko_tid || 'Not available'}</p>
                      </div>
                    </div>

                    {/* Error Message */}
                    {(txn.eko_message || txn.api_response?.message) && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                        <p className="text-red-400 text-sm">
                          <AlertTriangle className="w-4 h-4 inline mr-2" />
                          {txn.eko_message || txn.api_response?.message}
                        </p>
                      </div>
                    )}

                    {/* Refund Actions */}
                    {hasEkoTid ? (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResendOTP(txn);
                          }}
                          disabled={isProcessing === 'otp'}
                          variant="outline"
                          className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                          data-testid={`send-otp-btn-${txnKey}`}
                        >
                          {isProcessing === 'otp' ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <MessageSquare className="w-4 h-4 mr-2" />
                          )}
                          Send OTP
                        </Button>
                        
                        <div className="flex-1 flex items-center gap-2">
                          <Input
                            type="text"
                            placeholder="Enter OTP from customer"
                            value={otpInputs[txnKey] || ''}
                            onChange={(e) => setOtpInputs(o => ({ 
                              ...o, 
                              [txnKey]: e.target.value.replace(/\D/g, '').slice(0, 6) 
                            }))}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-gray-900 border-gray-700 text-white"
                            data-testid={`otp-input-${txnKey}`}
                          />
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProcessRefund(txn);
                            }}
                            disabled={isProcessing === 'refund' || !otpInputs[txnKey]}
                            className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
                            data-testid={`process-refund-btn-${txnKey}`}
                          >
                            {isProcessing === 'refund' ? (
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4 mr-2" />
                            )}
                            Process Refund
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                        <p className="text-yellow-400 text-sm">
                          <AlertTriangle className="w-4 h-4 inline mr-2" />
                          This transaction failed before reaching Eko's servers. 
                          {txn.prc_refunded ? (
                            <span className="text-green-400 ml-1">
                              PRC already refunded: {txn.prc_refunded} PRC
                            </span>
                          ) : (
                            <span className="ml-1">Manual PRC refund may be needed.</span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminDMTRefunds;
