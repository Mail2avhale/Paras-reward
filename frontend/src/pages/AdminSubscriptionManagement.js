import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Crown, Users, TrendingUp, Rocket, Clock, CheckCircle, XCircle,
  Search, RefreshCw, Eye, ChevronRight, AlertCircle, Edit, Trash2, X,
  Calendar, CreditCard
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminSubscriptionManagement = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [approvedPayments, setApprovedPayments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState(null);
  const [activeTab, setActiveTab] = useState('pending'); // pending, approved
  const [editModal, setEditModal] = useState({ show: false, payment: null });
  const [viewModal, setViewModal] = useState({ show: false, payment: null });

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, pendingRes, approvedRes] = await Promise.all([
        axios.get(`${API}/api/admin/subscription-stats`),
        axios.get(`${API}/api/admin/vip-payments?status=pending&limit=20`),
        axios.get(`${API}/api/admin/vip-payments?status=approved&limit=50`)
      ]);
      setStats(statsRes.data);
      setPendingPayments(pendingRes.data?.payments || []);
      setApprovedPayments(approvedRes.data?.payments || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (paymentId) => {
    setProcessing(paymentId);
    try {
      await axios.post(`${API}/api/admin/vip-payments/${paymentId}/approve`);
      toast.success('Payment approved!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (paymentId) => {
    if (!confirm('Reject this payment?')) return;
    setProcessing(paymentId);
    try {
      await axios.post(`${API}/api/admin/vip-payments/${paymentId}/reject`, {
        reason: 'Payment verification failed'
      });
      toast.success('Payment rejected');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (paymentId) => {
    if (!confirm('Are you sure you want to delete this subscription? This action cannot be undone.')) return;
    setProcessing(paymentId);
    try {
      await axios.delete(`${API}/api/admin/vip-payments/${paymentId}`);
      toast.success('Subscription deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    } finally {
      setProcessing(null);
    }
  };

  const handleEdit = async (paymentId, updates) => {
    setProcessing(paymentId);
    try {
      await axios.put(`${API}/api/admin/vip-payments/${paymentId}`, updates);
      toast.success('Subscription updated');
      setEditModal({ show: false, payment: null });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-2" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const planCounts = stats?.plan_counts || {};

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
          <p className="text-gray-400 text-sm">Manage user subscriptions</p>
        </div>
        <Button 
          onClick={fetchData} 
          variant="outline" 
          size="sm"
          className="border-gray-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards - Simple Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Explorer"
          value={planCounts.explorer || 0}
          color="gray"
          subtitle="Free"
        />
        <StatCard
          icon={<Rocket className="w-5 h-5" />}
          label="Startup"
          value={planCounts.startup || 0}
          color="blue"
          subtitle="₹299/mo"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Growth"
          value={planCounts.growth || 0}
          color="emerald"
          subtitle="₹549/mo"
        />
        <StatCard
          icon={<Crown className="w-5 h-5" />}
          label="Elite"
          value={planCounts.elite || 0}
          color="amber"
          subtitle="₹799/mo"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'pending'
              ? 'bg-amber-500 text-black'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          Pending ({pendingPayments.length})
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'approved'
              ? 'bg-green-500 text-black'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          <CheckCircle className="w-4 h-4 inline mr-2" />
          Approved ({approvedPayments.length})
        </button>
      </div>

      {/* Pending Payments Section */}
      {activeTab === 'pending' && (
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-white">
              Pending Approvals
            </h2>
            {pendingPayments.length > 0 && (
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                {pendingPayments.length}
              </span>
            )}
          </div>
          
          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search by name, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-gray-800 border-gray-700 text-white text-sm h-9"
            />
          </div>
        </div>

        {/* Payments List */}
        <div className="divide-y divide-gray-800">
          {pendingPayments.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-400">No pending payments</p>
              <p className="text-gray-500 text-sm">All caught up!</p>
            </div>
          ) : (
            pendingPayments
              .filter(p => 
                !searchQuery || 
                p.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.utr_number?.includes(searchQuery)
              )
              .map((payment) => (
                <PaymentRow
                  key={payment.payment_id}
                  payment={payment}
                  onApprove={() => handleApprove(payment.payment_id)}
                  onReject={() => handleReject(payment.payment_id)}
                  processing={processing === payment.payment_id}
                  type="pending"
                />
              ))
          )}
        </div>
      </div>
      )}

      {/* Approved Subscriptions Section */}
      {activeTab === 'approved' && (
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-semibold text-white">
              Approved Subscriptions
            </h2>
          </div>
          
          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search subscriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-gray-800 border-gray-700 text-white text-sm h-9"
            />
          </div>
        </div>

        {/* Approved List */}
        <div className="divide-y divide-gray-800">
          {approvedPayments.length === 0 ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">No approved subscriptions</p>
            </div>
          ) : (
            approvedPayments
              .filter(p => 
                !searchQuery || 
                p.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.utr_number?.includes(searchQuery)
              )
              .map((payment) => (
                <ApprovedRow
                  key={payment.payment_id}
                  payment={payment}
                  onView={() => setViewModal({ show: true, payment })}
                  onEdit={() => setEditModal({ show: true, payment })}
                  onDelete={() => handleDelete(payment.payment_id)}
                  processing={processing === payment.payment_id}
                />
              ))
          )}
        </div>
      </div>
      )}

      {/* Quick Stats Footer */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <QuickStat 
          label="Total Users" 
          value={stats?.total_users || 0} 
        />
        <QuickStat 
          label="VIP Users" 
          value={stats?.vip_users || 0} 
        />
        <QuickStat 
          label="Monthly Revenue" 
          value={`₹${(stats?.monthly_revenue || 0).toLocaleString()}`} 
        />
      </div>

      {/* View Modal */}
      {viewModal.show && viewModal.payment && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Subscription Details</h3>
              <button 
                onClick={() => setViewModal({ show: false, payment: null })}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 text-sm">User</p>
                  <p className="text-white font-medium">{viewModal.payment.user_name}</p>
                  <p className="text-gray-400 text-sm">{viewModal.payment.user_email}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Plan</p>
                  <p className="text-white font-medium capitalize">{viewModal.payment.plan}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Amount</p>
                  <p className="text-white font-medium">₹{viewModal.payment.amount}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Duration</p>
                  <p className="text-white font-medium capitalize">{viewModal.payment.duration}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">UTR Number</p>
                  <p className="text-white font-mono">{viewModal.payment.utr_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Approved At</p>
                  <p className="text-white">{viewModal.payment.approved_at ? new Date(viewModal.payment.approved_at).toLocaleString() : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Expires At</p>
                  <p className="text-white">{viewModal.payment.expires_at ? new Date(viewModal.payment.expires_at).toLocaleString() : 'N/A'}</p>
                </div>
              </div>
              
              {viewModal.payment.screenshot_url && (
                <div>
                  <p className="text-gray-500 text-sm mb-2">Screenshot</p>
                  <a 
                    href={viewModal.payment.screenshot_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300"
                  >
                    <Eye className="w-4 h-4" />
                    View Payment Screenshot
                  </a>
                </div>
              )}
            </div>
            
            <Button 
              onClick={() => setViewModal({ show: false, payment: null })}
              className="w-full mt-6 bg-gray-800 hover:bg-gray-700"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal.show && editModal.payment && (
        <EditSubscriptionModal
          payment={editModal.payment}
          onClose={() => setEditModal({ show: false, payment: null })}
          onSave={(updates) => handleEdit(editModal.payment.payment_id, updates)}
          processing={processing === editModal.payment.payment_id}
        />
      )}
    </div>
  );
};

// Edit Modal Component
const EditSubscriptionModal = ({ payment, onClose, onSave, processing }) => {
  const [formData, setFormData] = useState({
    plan: payment.plan || 'startup',
    duration: payment.duration || 'monthly',
    amount: payment.amount || 0,
    expires_at: payment.expires_at ? payment.expires_at.split('T')[0] : ''
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Edit Subscription</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm block mb-1">Plan</label>
            <select
              value={formData.plan}
              onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white"
            >
              <option value="startup">Startup (₹299)</option>
              <option value="growth">Growth (₹549)</option>
              <option value="elite">Elite (₹799)</option>
            </select>
          </div>
          
          <div>
            <label className="text-gray-400 text-sm block mb-1">Duration</label>
            <select
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="half_yearly">Half Yearly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          
          <div>
            <label className="text-gray-400 text-sm block mb-1">Amount (₹)</label>
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>
          
          <div>
            <label className="text-gray-400 text-sm block mb-1">Expires At</label>
            <Input
              type="date"
              value={formData.expires_at}
              onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>
        </div>
        
        <div className="flex gap-3 mt-6">
          <Button 
            onClick={onClose}
            variant="outline"
            className="flex-1 border-gray-700"
          >
            Cancel
          </Button>
          <Button 
            onClick={() => onSave(formData)}
            disabled={processing}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Simple Stat Card Component
const StatCard = ({ icon, label, value, color, subtitle }) => {
  const colors = {
    gray: 'from-gray-600 to-gray-700 text-gray-400',
    blue: 'from-blue-500 to-indigo-600 text-blue-400',
    emerald: 'from-emerald-500 to-teal-600 text-emerald-400',
    amber: 'from-amber-500 to-orange-600 text-amber-400'
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color].split(' ')[0]} ${colors[color].split(' ')[1]} flex items-center justify-center text-white`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className={`text-sm ${colors[color].split(' ')[2]}`}>{label}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
};

// Payment Row Component
const PaymentRow = ({ payment, onApprove, onReject, processing, type = 'pending' }) => {
  const planColors = {
    startup: 'text-blue-400 bg-blue-500/10',
    growth: 'text-emerald-400 bg-emerald-500/10',
    elite: 'text-amber-400 bg-amber-500/10'
  };

  return (
    <div className="p-4 hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center justify-between">
        {/* User Info */}
        <div className="flex items-center gap-4 flex-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
            {payment.user_name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">
              {payment.user_name || 'Unknown User'}
            </p>
            <p className="text-gray-500 text-sm truncate">
              {payment.user_email || payment.user_id}
            </p>
          </div>
        </div>

        {/* Plan Badge */}
        <div className="px-3">
          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${planColors[payment.plan] || 'text-gray-400 bg-gray-700'}`}>
            {payment.plan?.toUpperCase() || 'N/A'}
          </span>
        </div>

        {/* Amount */}
        <div className="px-4 text-right">
          <p className="text-white font-bold">₹{payment.amount}</p>
          <p className="text-gray-500 text-xs">{payment.duration || 'monthly'}</p>
        </div>

        {/* UTR */}
        <div className="px-4 w-36">
          <p className="text-gray-300 text-sm font-mono truncate" title={payment.utr_number}>
            {payment.utr_number || 'No UTR'}
          </p>
          <p className="text-gray-500 text-xs">
            {new Date(payment.submitted_at).toLocaleDateString()}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={onApprove}
            disabled={processing}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white h-9 px-4"
          >
            {processing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-1" />
                Approve
              </>
            )}
          </Button>
          <Button
            onClick={onReject}
            disabled={processing}
            size="sm"
            variant="outline"
            className="border-red-500/50 text-red-400 hover:bg-red-500/10 h-9 px-4"
          >
            <XCircle className="w-4 h-4 mr-1" />
            Reject
          </Button>
        </div>
      </div>

      {/* Screenshot Preview (if available) */}
      {payment.screenshot_url && (
        <div className="mt-3 ml-14 flex items-center gap-3">
          <a 
            href={payment.screenshot_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="relative group"
          >
            <img 
              src={payment.screenshot_url} 
              alt="Payment Screenshot" 
              className="w-16 h-16 object-cover rounded-lg border border-gray-700 group-hover:border-purple-500 transition-all"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-all">
              <Eye className="w-5 h-5 text-white" />
            </div>
          </a>
          <a 
            href={payment.screenshot_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
          >
            View Full Size
            <ChevronRight className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
};

// Approved Row Component
const ApprovedRow = ({ payment, onView, onEdit, onDelete, processing }) => {
  const planColors = {
    startup: 'text-blue-400 bg-blue-500/10',
    growth: 'text-emerald-400 bg-emerald-500/10',
    elite: 'text-amber-400 bg-amber-500/10'
  };

  const isExpired = payment.expires_at && new Date(payment.expires_at) < new Date();

  return (
    <div className="p-4 hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center justify-between">
        {/* User Info */}
        <div className="flex items-center gap-4 flex-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold">
            {payment.user_name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">
              {payment.user_name || 'Unknown User'}
            </p>
            <p className="text-gray-500 text-sm truncate">
              {payment.user_email || payment.user_id}
            </p>
          </div>
        </div>

        {/* Plan Badge */}
        <div className="px-3">
          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${planColors[payment.plan] || 'text-gray-400 bg-gray-700'}`}>
            {payment.plan?.toUpperCase() || 'N/A'}
          </span>
        </div>

        {/* Amount */}
        <div className="px-4 text-right">
          <p className="text-white font-bold">₹{payment.amount}</p>
          <p className="text-gray-500 text-xs">{payment.duration || 'monthly'}</p>
        </div>

        {/* Status */}
        <div className="px-4 w-32">
          {isExpired ? (
            <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-lg">
              Expired
            </span>
          ) : (
            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-lg">
              Active
            </span>
          )}
          <p className="text-gray-500 text-xs mt-1">
            {payment.approved_at ? new Date(payment.approved_at).toLocaleDateString() : '-'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={onView}
            size="sm"
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-700 h-9 px-3"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            onClick={onEdit}
            size="sm"
            variant="outline"
            className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10 h-9 px-3"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            onClick={onDelete}
            disabled={processing}
            size="sm"
            variant="outline"
            className="border-red-500/50 text-red-400 hover:bg-red-500/10 h-9 px-3"
          >
            {processing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Quick Stat Component
const QuickStat = ({ label, value }) => (
  <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-3 text-center">
    <p className="text-xl font-bold text-white">{value}</p>
    <p className="text-xs text-gray-500">{label}</p>
  </div>
);

export default AdminSubscriptionManagement;
