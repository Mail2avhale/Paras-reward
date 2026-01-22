import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import Pagination from '@/components/Pagination';
import { 
  ArrowLeft, Gift, Clock, CheckCircle, XCircle, Search, 
  RefreshCw, Loader2, Eye, User, CreditCard
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';
const ITEMS_PER_PAGE = 10;
const AUTO_REFRESH_INTERVAL = 30000;

const AdminGiftVouchers = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ pending: 0, completed: 0, rejected: 0 });
  const [filter, setFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [voucherCode, setVoucherCode] = useState('');
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
      
      const response = await axios.get(`${API}/api/admin/gift-voucher/requests?${params.toString()}`);
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
      const statusOrder = { pending: 0, completed: 1, rejected: 2 };
      const statusDiff = (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
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
    if (action === 'approve' && !voucherCode.trim()) {
      toast.error('Please enter voucher code');
      return;
    }
    
    setProcessing(true);
    try {
      await axios.post(`${API}/api/admin/gift-voucher/process`, {
        request_id: requestId,
        action,
        voucher_code: voucherCode,
        admin_notes: adminNotes,
        admin_uid: user.uid
      });
      
      toast.success(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
      setSelectedRequest(null);
      setVoucherCode('');
      setAdminNotes('');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to process request');
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
      await axios.post(`${API}/api/admin/gift-voucher/process`, {
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

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
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
              <Gift className="w-7 h-7 text-purple-400" />
              Gift Voucher Requests
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
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card 
          className={`p-4 cursor-pointer transition-all ${filter === 'pending' ? 'ring-2 ring-yellow-500' : ''} bg-yellow-500/10 border-yellow-500/30`}
          onClick={() => setFilter('pending')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-400 text-sm font-medium">Pending</p>
              <p className="text-3xl font-bold text-yellow-300">{stats.pending || 0}</p>
            </div>
            <Clock className="w-10 h-10 text-yellow-500/50" />
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
            <CheckCircle className="w-10 h-10 text-green-500/50" />
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
            <XCircle className="w-10 h-10 text-red-500/50" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6 bg-gray-900 border-gray-800">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search by name, email, request ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'pending', 'completed', 'rejected'].map((status) => (
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
          <Gift className="w-16 h-16 mx-auto text-gray-600 mb-4" />
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
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Gift className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{req.user_name || 'Unknown User'}</p>
                    <p className="text-sm text-gray-400">{req.user_email || req.user_id}</p>
                    <div className="flex gap-4 mt-1 text-xs text-gray-500">
                      <span className="text-purple-400 font-medium">₹{req.denomination} Voucher</span>
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRequest(req);
                        }}
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
          <Card className="w-full max-w-lg bg-gray-900 border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Voucher Request Details</h2>
                <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(null)}>
                  <XCircle className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-500 text-sm">User</p>
                    <p className="text-white font-medium">{selectedRequest.user_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Email</p>
                    <p className="text-white font-medium">{selectedRequest.user_email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Voucher Amount</p>
                    <p className="text-white font-medium text-lg">₹{selectedRequest.denomination}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">PRC Deducted</p>
                    <p className="text-white font-medium">{selectedRequest.total_prc_deducted} PRC</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Status</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(selectedRequest.status)}`}>
                      {selectedRequest.status?.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Requested</p>
                    <p className="text-white font-medium">{formatDate(selectedRequest.created_at)}</p>
                  </div>
                </div>

                {selectedRequest.voucher_code && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                    <p className="text-gray-500 text-sm">Voucher Code</p>
                    <p className="text-green-400 font-mono text-lg">{selectedRequest.voucher_code}</p>
                  </div>
                )}

                {selectedRequest.status === 'pending' && (
                  <>
                    <div>
                      <p className="text-gray-500 text-sm mb-2">Voucher Code *</p>
                      <Input
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value)}
                        placeholder="Enter PhonePe voucher code..."
                        className="bg-gray-800 border-gray-700 text-white font-mono"
                      />
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm mb-2">Admin Notes (optional)</p>
                      <Input
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Add notes..."
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleProcess(selectedRequest.request_id, 'approve')}
                        disabled={processing || !voucherCode.trim()}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        Approve & Send Code
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
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminGiftVouchers;
