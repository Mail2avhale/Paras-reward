import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import Pagination from '@/components/Pagination';
import { 
  ArrowLeft, Clock, CheckCircle, XCircle, Search, Filter, 
  RefreshCw, Loader2, Phone, Zap, Tv, Droplet, CreditCard,
  Eye, User
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';
const ITEMS_PER_PAGE = 10;
const AUTO_REFRESH_INTERVAL = 30000;

const AdminBillPayments = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, completed: 0, rejected: 0 });
  const [filter, setFilter] = useState('pending'); // Default to pending
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await axios.get(`${API}/api/admin/bill-payment/requests?${params.toString()}`);
      setRequests(response.data.requests || []);
      setStats(response.data.stats || {});
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [filter, searchTerm]);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/admin');
      return;
    }
    fetchRequests();
  }, [user, navigate, fetchRequests]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchRequests, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchRequests]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRequests();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchTerm]);

  // Sort requests - Pending first
  const sortedRequests = React.useMemo(() => {
    return [...requests].sort((a, b) => {
      const statusOrder = { pending: 0, approved: 1, completed: 2, rejected: 3 };
      const statusDiff = (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [requests]);

  // Pagination
  const totalPages = Math.ceil(sortedRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = sortedRequests.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleProcess = async (requestId, action) => {
    setProcessing(true);
    try {
      await axios.post(`${API}/api/admin/bill-payment/process`, {
        request_id: requestId,
        action,
        admin_notes: adminNotes,
        admin_uid: user.uid
      });

      const actionText = action === 'reject' ? 'rejected' : action === 'approve' ? 'approved' : 'completed';
      toast.success(`Request ${actionText} successfully!`);
      setSelectedRequest(null);
      setAdminNotes('');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to process request');
    } finally {
      setProcessing(false);
    }
  };

  // Quick actions
  const handleQuickApprove = async (req, e) => {
    e.stopPropagation();
    if (!window.confirm(`Approve bill payment of ₹${req.amount_inr} for ${req.user_name || req.user_id}?`)) return;
    
    try {
      setProcessing(true);
      await axios.post(`${API}/api/admin/bill-payment/process`, {
        request_id: req.request_id,
        action: 'approve',
        admin_uid: user.uid
      });
      toast.success('Request approved!');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setProcessing(false);
    }
  };

  const handleQuickReject = async (req, e) => {
    e.stopPropagation();
    const reason = window.prompt('Rejection reason:');
    if (reason === null) return;
    
    try {
      setProcessing(true);
      await axios.post(`${API}/api/admin/bill-payment/process`, {
        request_id: req.request_id,
        action: 'reject',
        admin_notes: reason,
        admin_uid: user.uid
      });
      toast.success('Request rejected');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    } finally {
      setProcessing(false);
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      mobile_recharge: <Phone className="w-5 h-5 text-blue-400" />,
      electricity: <Zap className="w-5 h-5 text-yellow-400" />,
      dth: <Tv className="w-5 h-5 text-purple-400" />,
      water: <Droplet className="w-5 h-5 text-cyan-400" />,
      default: <CreditCard className="w-5 h-5 text-gray-400" />
    };
    return icons[type] || icons.default;
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      approved: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      completed: 'bg-green-500/20 text-green-400 border-green-500/50',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/50'
    };
    return badges[status] || 'bg-gray-500/20 text-gray-400';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-4 md:p-6 bg-gray-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="text-gray-400">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <CreditCard className="w-7 h-7 text-green-400" />
              Bill Payment Requests
            </h1>
            <p className="text-gray-400 text-sm">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchRequests} variant="outline" size="sm" disabled={loading} className="border-gray-700">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-600"
            />
            Auto-refresh
          </label>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card 
          className={`p-4 cursor-pointer transition-all ${filter === 'pending' ? 'ring-2 ring-yellow-500' : ''} bg-yellow-500/10 border-yellow-500/30`}
          onClick={() => setFilter('pending')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-400 text-sm font-medium">Pending</p>
              <p className="text-3xl font-bold text-yellow-300">{stats.pending || 0}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500/50" />
          </div>
        </Card>
        <Card 
          className={`p-4 cursor-pointer transition-all ${filter === 'approved' ? 'ring-2 ring-blue-500' : ''} bg-blue-500/10 border-blue-500/30`}
          onClick={() => setFilter('approved')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-400 text-sm font-medium">Approved</p>
              <p className="text-3xl font-bold text-blue-300">{stats.approved || 0}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-blue-500/50" />
          </div>
        </Card>
        <Card 
          className={`p-4 cursor-pointer transition-all ${filter === 'completed' ? 'ring-2 ring-green-500' : ''} bg-green-500/10 border-green-500/30`}
          onClick={() => setFilter('completed')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-400 text-sm font-medium">Completed</p>
              <p className="text-3xl font-bold text-green-300">{stats.completed || 0}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500/50" />
          </div>
        </Card>
        <Card 
          className={`p-4 cursor-pointer transition-all ${filter === 'rejected' ? 'ring-2 ring-red-500' : ''} bg-red-500/10 border-red-500/30`}
          onClick={() => setFilter('rejected')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-400 text-sm font-medium">Rejected</p>
              <p className="text-3xl font-bold text-red-300">{stats.rejected || 0}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-500/50" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6 bg-gray-900 border-gray-800">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search by name, email, mobile, request ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', 'pending', 'approved', 'completed', 'rejected'].map((status) => (
              <Button
                key={status}
                variant={filter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(status)}
                className={filter === status ? 'bg-blue-600' : 'border-gray-700 text-gray-300'}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Showing {paginatedRequests.length} of {sortedRequests.length} requests
        </div>
      </Card>

      {/* Requests List */}
      {loading && paginatedRequests.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : paginatedRequests.length === 0 ? (
        <Card className="p-12 text-center bg-gray-900 border-gray-800">
          <CreditCard className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">No requests found</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {paginatedRequests.map((req) => (
            <Card
              key={req.request_id}
              className={`p-4 bg-gray-900 border-gray-800 hover:border-gray-700 transition-all cursor-pointer ${
                req.status === 'pending' ? 'border-l-4 border-l-yellow-500' : ''
              }`}
              onClick={() => setSelectedRequest(req)}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                    {getTypeIcon(req.request_type)}
                  </div>
                  <div>
                    <p className="font-medium text-white">{req.user_name || 'Unknown User'}</p>
                    <p className="text-sm text-gray-400">{req.user_mobile || req.user_email || req.user_id}</p>
                    <div className="flex gap-4 mt-1 text-xs text-gray-500">
                      <span className="capitalize">{req.request_type?.replace('_', ' ')}</span>
                      <span>₹{req.amount_inr}</span>
                      <span>{req.total_prc_deducted} PRC</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(req.status)}`}>
                    {req.status?.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(req.created_at)}
                  </span>
                  
                  {/* Quick Actions */}
                  {req.status === 'pending' && (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 h-8"
                        onClick={(e) => handleQuickApprove(req, e)}
                        disabled={processing}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8"
                        onClick={(e) => handleQuickReject(req, e)}
                        disabled={processing}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  
                  <Button size="sm" variant="ghost" className="text-gray-400">
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedRequest(null)}>
          <Card className="w-full max-w-lg bg-gray-900 border-gray-700 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Request Details</h2>
                <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(null)}>
                  <XCircle className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* User Information Section */}
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    User Information
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-gray-500 text-xs">Name</p>
                      <p className="text-white font-medium">{selectedRequest.user_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Mobile</p>
                      <p className="text-white font-medium">{selectedRequest.user_mobile || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Email</p>
                      <p className="text-white font-medium text-sm">{selectedRequest.user_email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Subscription</p>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        selectedRequest.user_subscription === 'elite' ? 'bg-purple-500/20 text-purple-400' :
                        selectedRequest.user_subscription === 'growth' ? 'bg-blue-500/20 text-blue-400' :
                        selectedRequest.user_subscription === 'startup' ? 'bg-green-500/20 text-green-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {selectedRequest.user_subscription?.toUpperCase() || 'EXPLORER'}
                      </span>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">PRC Balance</p>
                      <p className="text-amber-400 font-medium">{selectedRequest.user_prc_balance?.toFixed(2) || '0.00'} PRC</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">KYC Status</p>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        selectedRequest.user_kyc_status === 'verified' ? 'bg-green-500/20 text-green-400' :
                        selectedRequest.user_kyc_status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {selectedRequest.user_kyc_status?.toUpperCase() || 'PENDING'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Request Details Section */}
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Payment Details
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-gray-500 text-xs">Type</p>
                      <p className="text-white font-medium capitalize">{selectedRequest.request_type?.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Amount</p>
                      <p className="text-white font-medium">₹{selectedRequest.amount_inr}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">PRC Deducted</p>
                      <p className="text-amber-400 font-medium">{selectedRequest.total_prc_deducted} PRC</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Status</p>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusBadge(selectedRequest.status)}`}>
                        {selectedRequest.status?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Request Date</p>
                      <p className="text-white text-sm">{formatDate(selectedRequest.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Request ID</p>
                      <p className="text-gray-400 text-xs font-mono">{selectedRequest.request_id?.slice(0, 12)}...</p>
                    </div>
                  </div>
                </div>
                
                {/* Service Specific Details Section */}
                <div className="bg-yellow-900/20 rounded-lg p-4 border border-yellow-700/50">
                  <h3 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Service Details - {selectedRequest.request_type?.replace('_', ' ').toUpperCase()}
                  </h3>
                  
                  {/* Mobile Recharge */}
                  {selectedRequest.request_type === 'mobile_recharge' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-gray-400 text-xs">Mobile Number</p>
                        <p className="text-white font-medium text-lg">{selectedRequest.phone_number || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Operator</p>
                        <p className="text-white font-medium">{selectedRequest.operator || 'N/A'}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* DTH Recharge */}
                  {selectedRequest.request_type === 'dth_recharge' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-gray-400 text-xs">Subscriber ID</p>
                        <p className="text-white font-medium text-lg font-mono">{selectedRequest.subscriber_id || selectedRequest.phone_number || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">DTH Operator</p>
                        <p className="text-white font-medium">{selectedRequest.dth_operator || selectedRequest.operator || 'N/A'}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Electricity Bill */}
                  {selectedRequest.request_type === 'electricity_bill' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-gray-400 text-xs">Consumer Number</p>
                        <p className="text-white font-medium text-lg font-mono">{selectedRequest.consumer_number || selectedRequest.account_number || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Provider/Biller</p>
                        <p className="text-white font-medium">{selectedRequest.biller_name || 'N/A'}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Credit Card Payment */}
                  {selectedRequest.request_type === 'credit_card' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-gray-400 text-xs">Card Number (Last 4)</p>
                        <p className="text-white font-medium text-lg">**** **** **** {selectedRequest.card_last4 || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Bank Name</p>
                        <p className="text-white font-medium">{selectedRequest.bank_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Cardholder Name</p>
                        <p className="text-white font-medium">{selectedRequest.cardholder_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Card Type</p>
                        <p className="text-white font-medium">{selectedRequest.card_type || 'N/A'}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Loan/EMI Payment */}
                  {selectedRequest.request_type === 'loan_emi' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-gray-400 text-xs">Loan Account Number</p>
                        <p className="text-white font-medium text-lg font-mono">{selectedRequest.loan_account || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Bank Name</p>
                        <p className="text-white font-medium">{selectedRequest.bank_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Borrower Name</p>
                        <p className="text-white font-medium">{selectedRequest.borrower_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Loan Type</p>
                        <p className="text-white font-medium">{selectedRequest.loan_type || 'N/A'}</p>
                      </div>
                      {selectedRequest.ifsc_code && (
                        <div>
                          <p className="text-gray-400 text-xs">IFSC Code</p>
                          <p className="text-white font-mono">{selectedRequest.ifsc_code}</p>
                        </div>
                      )}
                      {selectedRequest.emi_amount && (
                        <div>
                          <p className="text-gray-400 text-xs">EMI Amount</p>
                          <p className="text-white font-medium">₹{selectedRequest.emi_amount}</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Fallback for any other type */}
                  {!['mobile_recharge', 'dth_recharge', 'electricity_bill', 'credit_card', 'loan_emi'].includes(selectedRequest.request_type) && (
                    <div className="grid grid-cols-2 gap-3">
                      {selectedRequest.phone_number && (
                        <div>
                          <p className="text-gray-400 text-xs">Phone/Account</p>
                          <p className="text-white font-medium">{selectedRequest.phone_number}</p>
                        </div>
                      )}
                      {selectedRequest.operator && (
                        <div>
                          <p className="text-gray-400 text-xs">Operator/Provider</p>
                          <p className="text-white font-medium">{selectedRequest.operator}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {selectedRequest.status === 'pending' && (
                  <>
                    <div>
                      <p className="text-gray-500 text-sm mb-2">Admin Notes</p>
                      <Input
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Add notes (optional)..."
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleProcess(selectedRequest.request_id, 'approve')}
                        disabled={processing}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleProcess(selectedRequest.request_id, 'reject')}
                        disabled={processing}
                        variant="destructive"
                        className="flex-1"
                      >
                        {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                        Reject
                      </Button>
                    </div>
                  </>
                )}
                
                {selectedRequest.status === 'approved' && (
                  <Button
                    onClick={() => handleProcess(selectedRequest.request_id, 'complete')}
                    disabled={processing}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    Mark as Completed
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminBillPayments;
