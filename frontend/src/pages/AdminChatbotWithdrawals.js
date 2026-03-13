import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  RefreshCw, Search, Clock, CheckCircle, XCircle, 
  AlertTriangle, Banknote, User, Building, Hash,
  Calendar, IndianRupee, Send, Eye, Filter,
  UserPlus, MessageSquare, Phone, Shield, Loader2
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const AdminChatbotWithdrawals = ({ user }) => {
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  // Eko Customer Registration states
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [customerStatus, setCustomerStatus] = useState(null);
  const [checkingCustomer, setCheckingCustomer] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const [requestsRes, statsRes] = await Promise.all([
        fetch(`${API}/chatbot-redeem/admin/all?status=${statusFilter}&limit=100`),
        fetch(`${API}/chatbot-redeem/admin/stats`)
      ]);
      
      const requestsData = await requestsRes.json();
      const statsData = await statsRes.json();
      
      setRequests(requestsData.requests || []);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load withdrawal requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (requestId) => {
    setProcessing(true);
    try {
      const response = await fetch(`${API}/chatbot-redeem/admin/process/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_uid: user.uid,
          action: 'approve'
        })
      });
      
      if (response.ok) {
        toast.success('Request approved! Ready for DMT processing.');
        fetchRequests();
        setSelectedRequest(null);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to approve');
      }
    } catch (error) {
      toast.error('Error processing request');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (requestId) => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide rejection reason');
      return;
    }
    
    setProcessing(true);
    try {
      const response = await fetch(`${API}/chatbot-redeem/admin/process/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_uid: user.uid,
          action: 'reject',
          rejection_reason: rejectionReason
        })
      });
      
      if (response.ok) {
        toast.success('Request rejected. PRC refunded to user.');
        fetchRequests();
        setSelectedRequest(null);
        setShowRejectModal(false);
        setRejectionReason('');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to reject');
      }
    } catch (error) {
      toast.error('Error processing request');
    } finally {
      setProcessing(false);
    }
  };

  const handleCompleteDMT = async (requestId, dmtTxnId) => {
    setProcessing(true);
    try {
      const response = await fetch(`${API}/chatbot-redeem/admin/process/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_uid: user.uid,
          action: 'complete_dmt',
          dmt_transaction_id: dmtTxnId
        })
      });
      
      if (response.ok) {
        toast.success('Withdrawal completed successfully!');
        fetchRequests();
        setSelectedRequest(null);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to complete');
      }
    } catch (error) {
      toast.error('Error completing request');
    } finally {
      setProcessing(false);
    }
  };

  // Auto DMT Transfer via Eko API
  const handleExecuteAutoDMT = async (requestId) => {
    if (!confirm('Are you sure you want to execute Auto DMT transfer?\n\nThis will:\n1. Call Eko DMT API\n2. Transfer money to bank account\n3. Generate UTR automatically')) {
      return;
    }
    
    setProcessing(true);
    try {
      const response = await fetch(`${API}/chatbot-redeem/admin/execute-dmt/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_uid: user.uid,
          transfer_mode: 'IMPS'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Transfer Successful! UTR: ${result.data?.utr_number || 'Generated'}`);
        fetchRequests();
        setSelectedRequest(null);
      } else {
        // Show detailed error
        const errorMsg = result.message || 'Transfer failed';
        const errorType = result.error_type || 'UNKNOWN';
        toast.error(`${errorMsg}\n(Error: ${errorType})`, { duration: 8000 });
        
        // Refresh to show updated error in request
        fetchRequests();
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Check Eko Customer Status
  const checkCustomerStatus = async (mobile) => {
    setCheckingCustomer(true);
    setCustomerStatus(null);
    try {
      const response = await fetch(`${API}/chatbot-redeem/admin/customer-status/${mobile}`);
      const result = await response.json();
      setCustomerStatus(result);
      
      if (result.verified) {
        toast.success('✅ Customer verified in Eko. Ready for DMT!');
      } else if (result.registered && result.otp_pending) {
        toast.warning('⚠️ Customer registered but OTP pending');
      } else if (!result.registered) {
        toast.info('ℹ️ Customer not registered in Eko');
      }
    } catch (error) {
      toast.error('Failed to check customer status');
      setCustomerStatus({ success: false, message: 'Check failed' });
    } finally {
      setCheckingCustomer(false);
    }
  };

  // Register Customer in Eko (sends OTP)
  const handleRegisterCustomer = async (requestId) => {
    if (!confirm('This will send OTP to customer\'s mobile.\n\nAfter OTP is sent, you need to:\n1. Call/WhatsApp the customer\n2. Ask them for the OTP\n3. Enter OTP to verify\n\nContinue?')) {
      return;
    }
    
    setProcessing(true);
    try {
      const response = await fetch(`${API}/chatbot-redeem/admin/register-customer/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_uid: user.uid })
      });
      
      const result = await response.json();
      
      if (result.success) {
        if (result.already_registered && result.customer_verified) {
          toast.success('✅ Customer already verified! Proceed with DMT.');
          setCustomerStatus({ registered: true, verified: true });
        } else if (result.otp_sent) {
          toast.success(`📱 OTP sent to customer! Ask them for the OTP.`);
          setShowOtpModal(true);
          setCustomerStatus({ registered: true, verified: false, otp_pending: true });
        } else if (result.already_registered) {
          toast.info('Customer already registered. Try DMT or verify OTP.');
          setCustomerStatus({ registered: true, verified: false });
        }
      } else {
        toast.error(result.message || 'Registration failed');
      }
      
      fetchRequests();
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Verify Customer OTP
  const handleVerifyOtp = async (requestId) => {
    if (!otpValue || otpValue.length < 4) {
      toast.error('Please enter valid OTP (4-6 digits)');
      return;
    }
    
    setProcessing(true);
    try {
      const response = await fetch(`${API}/chatbot-redeem/admin/verify-customer-otp/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_uid: user.uid,
          otp: otpValue
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.verified) {
        toast.success('✅ Customer verified! You can now execute DMT.');
        setShowOtpModal(false);
        setOtpValue('');
        setCustomerStatus({ registered: true, verified: true });
        fetchRequests();
      } else {
        toast.error(result.message || 'Invalid OTP. Try again.');
      }
    } catch (error) {
      toast.error('Verification failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-500/20 text-yellow-400', icon: Clock, label: 'Pending' },
      processing: { color: 'bg-blue-500/20 text-blue-400', icon: RefreshCw, label: 'Processing' },
      completed: { color: 'bg-green-500/20 text-green-400', icon: CheckCircle, label: 'Completed' },
      rejected: { color: 'bg-red-500/20 text-red-400', icon: XCircle, label: 'Rejected' }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const filteredRequests = requests.filter(req => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      req.request_id?.toLowerCase().includes(query) ||
      req.user_name?.toLowerCase().includes(query) ||
      req.user_mobile?.includes(query) ||
      req.account_number?.includes(query)
    );
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Banknote className="w-7 h-7 text-green-400" />
            Chatbot Withdrawals
          </h1>
          <p className="text-gray-400 mt-1">Process bank withdrawal requests from chatbot</p>
        </div>
        <Button onClick={fetchRequests} disabled={loading} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4 bg-yellow-500/10 border-yellow-500/30">
            <div className="text-yellow-400 text-sm">Pending</div>
            <div className="text-2xl font-bold text-white">{stats.counts?.pending || 0}</div>
          </Card>
          <Card className="p-4 bg-blue-500/10 border-blue-500/30">
            <div className="text-blue-400 text-sm">Processing</div>
            <div className="text-2xl font-bold text-white">{stats.counts?.processing || 0}</div>
          </Card>
          <Card className="p-4 bg-green-500/10 border-green-500/30">
            <div className="text-green-400 text-sm">Completed</div>
            <div className="text-2xl font-bold text-white">{stats.counts?.completed || 0}</div>
          </Card>
          <Card className="p-4 bg-red-500/10 border-red-500/30">
            <div className="text-red-400 text-sm">Rejected</div>
            <div className="text-2xl font-bold text-white">{stats.counts?.rejected || 0}</div>
          </Card>
          <Card className="p-4 bg-purple-500/10 border-purple-500/30">
            <div className="text-purple-400 text-sm">Total Processed</div>
            <div className="text-2xl font-bold text-white">₹{stats.completed_summary?.total_amount?.toLocaleString() || 0}</div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2">
          {['pending', 'processing', 'completed', 'rejected'].map(status => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by ID, name, mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Request ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">User</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Bank Details</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredRequests.map(req => (
                <tr key={req.request_id} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-blue-400">{req.request_id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{req.user_name}</div>
                    <div className="text-gray-400 text-sm">{req.user_mobile}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white">{req.bank_name}</div>
                    <div className="text-gray-400 text-sm font-mono">
                      ****{req.account_number?.slice(-4)} | {req.ifsc_code}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-green-400 font-bold">₹{req.amount_inr}</div>
                    <div className="text-gray-500 text-xs">Net: ₹{req.net_amount}</div>
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(req.status)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {new Date(req.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedRequest(req)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {req.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleApprove(req.request_id)}
                            disabled={processing}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedRequest(req);
                              setShowRejectModal(true);
                            }}
                            disabled={processing}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {req.status === 'processing' && (
                        <>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handleExecuteAutoDMT(req.request_id)}
                            disabled={processing}
                            title="Execute Auto DMT via Eko"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const txnId = prompt('Enter UTR (12 digits):');
                              if (txnId) handleCompleteDMT(req.request_id, txnId);
                            }}
                            disabled={processing}
                            title="Enter UTR Manually"
                          >
                            <Hash className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedRequest(req);
                              setShowRejectModal(true);
                            }}
                            disabled={processing}
                            title="Reject & Refund"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No withdrawal requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Request Detail Modal */}
      {selectedRequest && !showRejectModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-bold text-white">Withdrawal Request Details</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(null)}>×</Button>
            </div>
            
            <div className="space-y-4">
              {/* Request Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm">Request ID</label>
                  <div className="text-blue-400 font-mono">{selectedRequest.request_id}</div>
                </div>
                <div>
                  <label className="text-gray-400 text-sm">Status</label>
                  <div>{getStatusBadge(selectedRequest.status)}</div>
                </div>
              </div>

              {/* User Info */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" /> User Details
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-400">Name:</span> <span className="text-white">{selectedRequest.user_name}</span></div>
                  <div><span className="text-gray-400">Mobile:</span> <span className="text-white">{selectedRequest.user_mobile}</span></div>
                  <div><span className="text-gray-400">UID:</span> <span className="text-gray-300 font-mono text-xs">{selectedRequest.uid}</span></div>
                </div>
              </div>

              {/* Bank Info */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                  <Building className="w-4 h-4" /> Bank Details
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-400">Account Holder:</span> <span className="text-white">{selectedRequest.account_holder_name}</span></div>
                  <div><span className="text-gray-400">Bank:</span> <span className="text-white">{selectedRequest.bank_name}</span></div>
                  <div><span className="text-gray-400">Account No:</span> <span className="text-white font-mono">{selectedRequest.account_number}</span></div>
                  <div><span className="text-gray-400">IFSC:</span> <span className="text-white font-mono">{selectedRequest.ifsc_code}</span></div>
                </div>
              </div>

              {/* Amount Info */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                  <IndianRupee className="w-4 h-4" /> Amount Details
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-400">Amount:</span> <span className="text-green-400 font-bold">₹{selectedRequest.amount_inr}</span></div>
                  <div><span className="text-gray-400">Processing Fee:</span> <span className="text-white">₹{selectedRequest.processing_fee}</span></div>
                  <div><span className="text-gray-400">Admin Charge (20%):</span> <span className="text-white">₹{selectedRequest.admin_charge}</span></div>
                  <div><span className="text-gray-400">Net Amount:</span> <span className="text-green-400 font-bold">₹{selectedRequest.net_amount}</span></div>
                  <div><span className="text-gray-400">PRC Deducted:</span> <span className="text-yellow-400">{selectedRequest.prc_deducted} PRC</span></div>
                </div>
              </div>

              {/* Timeline */}
              <div className="text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Created: {new Date(selectedRequest.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })} IST
                </div>
                {selectedRequest.processed_at && (
                  <div className="flex items-center gap-2 mt-1">
                    <CheckCircle className="w-4 h-4" />
                    Processed: {new Date(selectedRequest.processed_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })} IST
                  </div>
                )}
              </div>

              {/* Rejection Reason */}
              {selectedRequest.rejection_reason && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <h3 className="text-red-400 font-medium mb-1">Rejection Reason</h3>
                  <p className="text-white">{selectedRequest.rejection_reason}</p>
                </div>
              )}

              {/* DMT Status/Error */}
              {(selectedRequest.last_dmt_error || selectedRequest.utr_number) && (
                <div className={`rounded-lg p-4 ${selectedRequest.utr_number ? 'bg-green-500/10 border border-green-500/30' : 'bg-orange-500/10 border border-orange-500/30'}`}>
                  <h3 className={`font-medium mb-2 ${selectedRequest.utr_number ? 'text-green-400' : 'text-orange-400'}`}>
                    {selectedRequest.utr_number ? '✅ Transfer Completed' : '⚠️ Last DMT Attempt'}
                  </h3>
                  {selectedRequest.utr_number && (
                    <p className="text-white font-mono">UTR: {selectedRequest.utr_number}</p>
                  )}
                  {selectedRequest.eko_tid && (
                    <p className="text-gray-300 text-sm">Eko TID: {selectedRequest.eko_tid}</p>
                  )}
                  {selectedRequest.last_dmt_error && !selectedRequest.utr_number && (
                    <p className="text-orange-300">{selectedRequest.last_dmt_error}</p>
                  )}
                  {selectedRequest.dmt_attempt_count > 0 && (
                    <p className="text-gray-400 text-sm mt-1">Attempts: {selectedRequest.dmt_attempt_count}</p>
                  )}
                </div>
              )}

              {/* Eko Customer Registration Section - Show for processing requests with DMT errors */}
              {selectedRequest.status === 'processing' && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <h3 className="text-purple-400 font-medium mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Eko Customer Verification
                  </h3>
                  
                  {/* Customer Status Check */}
                  <div className="mb-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => checkCustomerStatus(selectedRequest.user_mobile)}
                      disabled={checkingCustomer}
                      className="mr-2"
                    >
                      {checkingCustomer ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4 mr-2" />
                      )}
                      Check Eko Status
                    </Button>
                    
                    {customerStatus && (
                      <span className={`text-sm ml-2 ${
                        customerStatus.verified ? 'text-green-400' :
                        customerStatus.registered ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {customerStatus.verified ? '✅ Verified' :
                         customerStatus.otp_pending ? '⏳ OTP Pending' :
                         customerStatus.registered ? '📝 Registered' : '❌ Not Registered'}
                      </span>
                    )}
                  </div>
                  
                  {/* Registration / OTP Buttons */}
                  {(!customerStatus || !customerStatus.verified) && (
                    <div className="flex flex-wrap gap-2">
                      {(!customerStatus || !customerStatus.registered) && (
                        <Button
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700"
                          onClick={() => handleRegisterCustomer(selectedRequest.request_id)}
                          disabled={processing}
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Register & Send OTP
                        </Button>
                      )}
                      
                      {customerStatus?.otp_pending && (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => setShowOtpModal(true)}
                          disabled={processing}
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Enter OTP
                        </Button>
                      )}
                    </div>
                  )}
                  
                  {/* Help Text */}
                  <p className="text-gray-400 text-xs mt-3">
                    <Phone className="w-3 h-3 inline mr-1" />
                    If customer not verified, register them first. OTP will be sent to their mobile ({selectedRequest.user_mobile}).
                    Call/WhatsApp them to get OTP.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-700">
                {selectedRequest.status === 'pending' && (
                  <>
                    <Button
                      className="bg-green-600 hover:bg-green-700 flex-1"
                      onClick={() => handleApprove(selectedRequest.request_id)}
                      disabled={processing}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve & Process
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => setShowRejectModal(true)}
                      disabled={processing}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </>
                )}
                {selectedRequest.status === 'processing' && (
                  <>
                    {/* Auto DMT Transfer Button */}
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 flex-1"
                      onClick={() => handleExecuteAutoDMT(selectedRequest.request_id)}
                      disabled={processing}
                    >
                      {processing ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Execute Auto DMT
                    </Button>
                    
                    {/* Manual UTR Entry Button */}
                    <Button
                      variant="outline"
                      className="flex-1 border-blue-500 text-blue-400 hover:bg-blue-500/20"
                      onClick={() => {
                        const txnId = prompt('Enter UTR/Transaction ID (12 digits):');
                        if (txnId) handleCompleteDMT(selectedRequest.request_id, txnId);
                      }}
                      disabled={processing}
                    >
                      <Hash className="w-4 h-4 mr-2" />
                      Enter UTR Manual
                    </Button>
                    
                    {/* Reject Button for Processing */}
                    <Button
                      variant="destructive"
                      onClick={() => setShowRejectModal(true)}
                      disabled={processing}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-4">Reject Withdrawal</h2>
            <p className="text-gray-400 mb-4">
              Request: <span className="text-blue-400">{selectedRequest.request_id}</span>
              <br />
              Amount: <span className="text-green-400">₹{selectedRequest.amount_inr}</span>
            </p>
            <p className="text-yellow-400 text-sm mb-4">
              Note: PRC will be refunded to user's balance
            </p>
            <div className="mb-4">
              <label className="text-gray-400 text-sm block mb-2">Rejection Reason *</label>
              <Input
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => handleReject(selectedRequest.request_id)}
                disabled={processing || !rejectionReason.trim()}
              >
                Confirm Reject
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* OTP Verification Modal */}
      {showOtpModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              Verify Customer OTP
            </h2>
            
            <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
              <p className="text-gray-400 text-sm">
                <span className="text-white font-medium">Customer:</span> {selectedRequest.user_name}
              </p>
              <p className="text-gray-400 text-sm">
                <span className="text-white font-medium">Mobile:</span> {selectedRequest.user_mobile}
              </p>
            </div>
            
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
              <p className="text-blue-300 text-sm">
                📱 OTP has been sent to customer's mobile. Call or WhatsApp them to get the OTP.
              </p>
            </div>
            
            <div className="mb-4">
              <label className="text-gray-400 text-sm block mb-2">Enter OTP (4-6 digits) *</label>
              <Input
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter OTP received by customer"
                className="text-center text-xl tracking-widest"
                maxLength={6}
              />
            </div>
            
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => handleVerifyOtp(selectedRequest.request_id)}
                disabled={processing || otpValue.length < 4}
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Verify OTP
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowOtpModal(false);
                  setOtpValue('');
                }}
              >
                Cancel
              </Button>
            </div>
            
            <p className="text-gray-500 text-xs mt-3 text-center">
              After verification, you can proceed with Auto DMT transfer.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminChatbotWithdrawals;
