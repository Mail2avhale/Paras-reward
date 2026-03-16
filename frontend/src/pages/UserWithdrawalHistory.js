import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import {
  ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle,
  Wallet, Loader2, RefreshCw, Trash2, Ban, Filter,
  ChevronDown, Building2, IndianRupee
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const UserWithdrawalHistory = ({ user }) => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [cancelling, setCancelling] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const fetchRequests = async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    try {
      const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const response = await axios.get(`${API}/chatbot-redeem/all/${user.uid}?limit=100${statusParam}`);
      
      if (response.data.success) {
        setRequests(response.data.requests || []);
        setStatusCounts(response.data.status_counts || {});
      }
    } catch (error) {
      toast.error('Failed to load requests');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user?.uid, statusFilter]);

  const toggleSelect = (requestId) => {
    setSelectedIds(prev => 
      prev.includes(requestId) 
        ? prev.filter(id => id !== requestId)
        : [...prev, requestId]
    );
  };

  const selectAllPending = () => {
    const pendingIds = requests
      .filter(r => r.status === 'pending')
      .map(r => r.request_id);
    setSelectedIds(pendingIds);
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const cancelSingle = async (requestId) => {
    setCancelling(true);
    try {
      const response = await axios.post(`${API}/chatbot-redeem/cancel/${requestId}`, {
        uid: user?.uid
      });
      
      if (response.data.success) {
        toast.success(`Request cancelled! ${response.data.data.prc_refunded} PRC refunded`);
        fetchRequests();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  const cancelSelected = async () => {
    if (selectedIds.length === 0) {
      toast.error('Please select requests');
      return;
    }

    setCancelling(true);
    try {
      const response = await axios.post(`${API}/chatbot-redeem/cancel-selected`, {
        uid: user?.uid,
        request_ids: selectedIds
      });
      
      if (response.data.success) {
        toast.success(`${response.data.data.cancelled_count} requests cancelled! ${response.data.data.prc_refunded} PRC refunded`);
        setSelectedIds([]);
        fetchRequests();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  const cancelAll = async () => {
    setCancelling(true);
    try {
      const response = await axios.post(`${API}/chatbot-redeem/cancel-all/${user?.uid}`, {});
      
      if (response.data.success) {
        toast.success(`${response.data.data.cancelled_count} requests cancelled! ${response.data.data.prc_refunded} PRC refunded`);
        setSelectedIds([]);
        fetchRequests();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'processing': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled_by_user': return <Ban className="w-4 h-4 text-gray-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'processing': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'completed': return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'cancelled_by_user': return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
      case 'rejected': return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'failed': return 'bg-red-500/10 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  const pendingCount = statusCounts.pending || 0;
  const selectedPendingCount = selectedIds.filter(id => 
    requests.find(r => r.request_id === id && r.status === 'pending')
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">My Withdrawal Requests</h1>
          <p className="text-gray-500 text-sm">View and manage your requests</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchRequests}
          disabled={loading}
          className="border-gray-700 text-gray-400"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <Card 
          className={`p-3 cursor-pointer transition-all ${statusFilter === 'all' ? 'bg-purple-500/20 border-purple-500' : 'bg-gray-800/50 border-gray-700'}`}
          onClick={() => setStatusFilter('all')}
        >
          <p className="text-xl font-bold text-white">{Object.values(statusCounts).reduce((a, b) => a + b, 0)}</p>
          <p className="text-xs text-gray-400">All</p>
        </Card>
        <Card 
          className={`p-3 cursor-pointer transition-all ${statusFilter === 'pending' ? 'bg-yellow-500/20 border-yellow-500' : 'bg-gray-800/50 border-gray-700'}`}
          onClick={() => setStatusFilter('pending')}
        >
          <p className="text-xl font-bold text-yellow-400">{statusCounts.pending || 0}</p>
          <p className="text-xs text-gray-400">Pending</p>
        </Card>
        <Card 
          className={`p-3 cursor-pointer transition-all ${statusFilter === 'completed' ? 'bg-green-500/20 border-green-500' : 'bg-gray-800/50 border-gray-700'}`}
          onClick={() => setStatusFilter('completed')}
        >
          <p className="text-xl font-bold text-green-400">{statusCounts.completed || 0}</p>
          <p className="text-xs text-gray-400">Done</p>
        </Card>
        <Card 
          className={`p-3 cursor-pointer transition-all ${statusFilter === 'cancelled_by_user' ? 'bg-gray-500/20 border-gray-500' : 'bg-gray-800/50 border-gray-700'}`}
          onClick={() => setStatusFilter('cancelled_by_user')}
        >
          <p className="text-xl font-bold text-gray-400">{statusCounts.cancelled_by_user || 0}</p>
          <p className="text-xs text-gray-400">Cancelled</p>
        </Card>
      </div>

      {/* Action Buttons - Only show if pending requests exist */}
      {pendingCount > 0 && (
        <Card className="p-3 mb-4 bg-gray-800/50 border-gray-700">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllPending}
                className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
              >
                Select All Pending ({pendingCount})
              </Button>
              {selectedIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="text-gray-400"
                >
                  Clear ({selectedIds.length})
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={cancelSelected}
                  disabled={cancelling || selectedPendingCount === 0}
                  className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50"
                >
                  {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                  Cancel Selected ({selectedPendingCount})
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={cancelAll}
                disabled={cancelling || pendingCount === 0}
                className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50"
              >
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4 mr-1" />}
                Cancel All
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <Card className="p-8 bg-gray-800/50 border-gray-700 text-center">
          <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No withdrawal requests found</p>
          <Button
            className="mt-4 bg-purple-600 hover:bg-purple-700"
            onClick={() => navigate('/redeem')}
          >
            Create New Request
          </Button>
        </Card>
      ) : (
        /* Request List */
        <div className="space-y-3">
          {requests.map((req) => (
            <Card 
              key={req.request_id} 
              className={`p-4 bg-gray-800/50 border transition-all ${
                selectedIds.includes(req.request_id) 
                  ? 'border-purple-500 bg-purple-500/10' 
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox for pending */}
                {req.status === 'pending' && (
                  <div className="pt-1">
                    <Checkbox
                      checked={selectedIds.includes(req.request_id)}
                      onCheckedChange={() => toggleSelect(req.request_id)}
                      className="border-gray-600 data-[state=checked]:bg-purple-600"
                    />
                  </div>
                )}
                
                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-300">{req.bank_name || 'Bank'}</span>
                      <span className="text-xs text-gray-500">{req.account_number_masked || req.account_number}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 ${getStatusColor(req.status)}`}>
                      {getStatusIcon(req.status)}
                      {req.status === 'pending' ? 'Pending' : 
                       req.status === 'completed' ? 'Done' :
                       req.status === 'cancelled_by_user' ? 'Cancelled' :
                       req.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1 text-white font-semibold">
                        <IndianRupee className="w-4 h-4" />
                        <span>{req.inr_amount?.toLocaleString() || '0'}</span>
                      </div>
                      <p className="text-xs text-gray-500">{req.prc_deducted?.toLocaleString()} PRC</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {new Date(req.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit'
                        })}
                      </p>
                      <p className="text-xs text-gray-600">
                        {new Date(req.created_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  
                  {/* Cancel button for single pending request */}
                  {req.status === 'pending' && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelSingle(req.request_id)}
                        disabled={cancelling}
                        className="w-full text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Cancel & Refund PRC
                      </Button>
                    </div>
                  )}
                  
                  {/* Show cancellation info */}
                  {req.status === 'cancelled_by_user' && req.cancelled_at && (
                    <p className="text-xs text-gray-500 mt-2">
                      Cancelled on {new Date(req.cancelled_at).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserWithdrawalHistory;
