import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import Pagination from '../components/Pagination';
import {
  Crown, CheckCircle, XCircle, Clock, Eye, RefreshCw,
  Download, Filter, User, Calendar, CreditCard, Search,
  AlertCircle, DollarSign, Image
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminVIPPaymentVerification = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  
  // View/Action modal
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [actionNotes, setActionNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchPayments();
    fetchStats();
  }, [user, navigate, page, statusFilter]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/admin/vip-payments?status=${statusFilter}&page=${page}&limit=20`);
      
      // Handle different response formats
      if (Array.isArray(response.data)) {
        setPayments(response.data);
      } else {
        setPayments(response.data.payments || []);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Get counts for each status
      const [pending, approved, rejected] = await Promise.all([
        axios.get(`${API}/api/admin/vip-payments?status=pending`).then(r => Array.isArray(r.data) ? r.data.length : r.data.total || 0).catch(() => 0),
        axios.get(`${API}/api/admin/vip-payments?status=approved`).then(r => Array.isArray(r.data) ? r.data.length : r.data.total || 0).catch(() => 0),
        axios.get(`${API}/api/admin/vip-payments?status=rejected`).then(r => Array.isArray(r.data) ? r.data.length : r.data.total || 0).catch(() => 0)
      ]);
      
      setStats({
        total: pending + approved + rejected,
        pending,
        approved,
        rejected
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleApprove = async (paymentId) => {
    try {
      setProcessing(true);
      await axios.post(`${API}/api/admin/vip-payment/${paymentId}/approve`, {
        admin_id: user.uid,
        notes: actionNotes
      });
      toast.success('Payment approved! User VIP membership activated.');
      setSelectedPayment(null);
      setActionNotes('');
      fetchPayments();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (paymentId) => {
    if (!actionNotes) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    
    try {
      setProcessing(true);
      await axios.post(`${API}/api/admin/vip-payment/${paymentId}/reject`, {
        admin_id: user.uid,
        reason: actionNotes
      });
      toast.success('Payment rejected.');
      setSelectedPayment(null);
      setActionNotes('');
      fetchPayments();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject payment');
    } finally {
      setProcessing(false);
    }
  };

  const getPlanLabel = (planType) => {
    const labels = {
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      half_yearly: 'Half Yearly',
      yearly: 'Yearly'
    };
    return labels[planType] || planType;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</span>;
      case 'approved':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Approved</span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1"><XCircle className="h-3 w-3" /> Rejected</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">{status}</span>;
    }
  };

  const filteredPayments = payments.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.user_email?.toLowerCase().includes(query) ||
      p.user_name?.toLowerCase().includes(query) ||
      p.transaction_id?.toLowerCase().includes(query)
    );
  });

  if (loading && payments.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Crown className="h-6 w-6 text-yellow-600" />
            VIP Payment Verification
          </h1>
          <p className="text-sm text-gray-500">Review and approve VIP membership payments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchPayments(); fetchStats(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card 
          className={`p-4 cursor-pointer transition-all ${statusFilter === '' ? 'ring-2 ring-purple-500' : ''}`}
          onClick={() => setStatusFilter('')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Crown className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>
        <Card 
          className={`p-4 cursor-pointer transition-all ${statusFilter === 'pending' ? 'ring-2 ring-yellow-500' : ''}`}
          onClick={() => setStatusFilter('pending')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </Card>
        <Card 
          className={`p-4 cursor-pointer transition-all ${statusFilter === 'approved' ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => setStatusFilter('approved')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Approved</p>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>
        <Card 
          className={`p-4 cursor-pointer transition-all ${statusFilter === 'rejected' ? 'ring-2 ring-red-500' : ''}`}
          onClick={() => setStatusFilter('rejected')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by email, name, or transaction ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
        </div>
      </Card>

      {/* Payments Table */}
      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-3">User</th>
                <th className="pb-3">Plan</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Transaction ID</th>
                <th className="pb-3">Date</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => (
                <tr key={payment.payment_id || payment._id} className="border-b hover:bg-gray-50">
                  <td className="py-3">
                    <div>
                      <p className="font-medium">{payment.user_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{payment.user_email}</p>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                      {getPlanLabel(payment.plan_type)}
                    </span>
                  </td>
                  <td className="py-3 font-semibold">₹{payment.amount?.toLocaleString('en-IN')}</td>
                  <td className="py-3">
                    <span className="text-sm font-mono text-gray-600">
                      {payment.transaction_id || '-'}
                    </span>
                  </td>
                  <td className="py-3 text-sm text-gray-600">
                    {payment.submitted_at ? new Date(payment.submitted_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-3">{getStatusBadge(payment.status)}</td>
                  <td className="py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPayment(payment)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Review
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <Crown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No {statusFilter || 'VIP'} payments found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Review Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-600" />
              Review VIP Payment
            </h3>
            
            {/* Payment Details */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">User</p>
                <p className="font-semibold">{selectedPayment.user_name}</p>
                <p className="text-sm text-gray-600">{selectedPayment.user_email}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Plan & Amount</p>
                <p className="font-semibold">{getPlanLabel(selectedPayment.plan_type)}</p>
                <p className="text-lg text-green-600 font-bold">₹{selectedPayment.amount?.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Transaction ID</p>
                <p className="font-mono text-sm">{selectedPayment.transaction_id || 'Not provided'}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Submitted On</p>
                <p className="font-semibold">
                  {selectedPayment.submitted_at ? new Date(selectedPayment.submitted_at).toLocaleString() : '-'}
                </p>
              </div>
            </div>

            {/* Payment Screenshot */}
            {selectedPayment.screenshot_url && (
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Payment Screenshot
                </p>
                <div className="border rounded-lg p-2 bg-gray-50">
                  <img 
                    src={selectedPayment.screenshot_url} 
                    alt="Payment Screenshot" 
                    className="max-h-64 mx-auto rounded"
                  />
                </div>
              </div>
            )}

            {/* Current Status */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Current Status</p>
              {getStatusBadge(selectedPayment.status)}
            </div>

            {/* Action Notes */}
            {selectedPayment.status === 'pending' && (
              <div className="mb-6">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Admin Notes {selectedPayment.status === 'pending' && '(required for rejection)'}
                </label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="Add notes about this payment..."
                />
              </div>
            )}

            {/* Previous Notes */}
            {selectedPayment.admin_notes && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-700 mb-1">Admin Notes</p>
                <p className="text-sm text-blue-600">{selectedPayment.admin_notes}</p>
              </div>
            )}

            {/* Rejection Reason */}
            {selectedPayment.rejection_reason && (
              <div className="mb-6 p-4 bg-red-50 rounded-lg">
                <p className="text-sm font-medium text-red-700 mb-1">Rejection Reason</p>
                <p className="text-sm text-red-600">{selectedPayment.rejection_reason}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => { setSelectedPayment(null); setActionNotes(''); }}
              >
                Close
              </Button>
              
              {selectedPayment.status === 'pending' && (
                <>
                  <Button 
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    onClick={() => handleReject(selectedPayment.payment_id)}
                    disabled={processing}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button 
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => handleApprove(selectedPayment.payment_id)}
                    disabled={processing}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminVIPPaymentVerification;
