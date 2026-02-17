import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Crown, Users, TrendingUp, Rocket, Clock, CheckCircle, XCircle,
  Search, RefreshCw, Eye, Edit, Trash2, X, Calendar, CreditCard, AlertCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminSubscriptionManagement = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [processing, setProcessing] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [viewModal, setViewModal] = useState({ show: false, payment: null });
  const [editModal, setEditModal] = useState({ show: false, payment: null });
  const [rejectModal, setRejectModal] = useState({ show: false, payment: null });
  const [imageModal, setImageModal] = useState({ show: false, url: null });
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const ITEMS_PER_PAGE = 15;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchData();
  }, [activeTab, page, debouncedSearch]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch stats and payments with search
      const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';
      const [statsRes, paymentsRes] = await Promise.allSettled([
        axios.get(`${API}/admin/subscription-stats`),
        axios.get(`${API}/admin/vip-payments?status=${activeTab}&page=${page}&limit=${ITEMS_PER_PAGE}${searchParam}`)
      ]);

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data);
      }

      if (paymentsRes.status === 'fulfilled') {
        setPayments(paymentsRes.value.data?.payments || []);
        setTotal(paymentsRes.value.data?.total || 0);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (paymentId) => {
    setProcessing(paymentId);
    try {
      const res = await axios.post(`${API}/admin/vip-payment/${paymentId}/approve`, {});
      toast.success(res.data?.message || 'Payment approved!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Approval failed');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (paymentId, reason) => {
    if (!reason) {
      toast.error('Please enter rejection reason');
      return;
    }
    setProcessing(paymentId);
    try {
      await axios.post(`${API}/admin/vip-payment/${paymentId}/reject`, { reason });
      toast.success('Payment rejected');
      setRejectModal({ show: false, payment: null });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Rejection failed');
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (paymentId) => {
    if (!window.confirm('Delete this payment record?')) return;
    setProcessing(paymentId);
    try {
      await axios.delete(`${API}/admin/vip-payments/${paymentId}`);
      toast.success('Payment deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Delete failed');
    } finally {
      setProcessing(null);
    }
  };

  const handleEdit = async (paymentId, updates) => {
    setProcessing(paymentId);
    try {
      await axios.put(`${API}/admin/vip-payments/${paymentId}`, updates);
      toast.success('Updated successfully');
      setEditModal({ show: false, payment: null });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Update failed');
    } finally {
      setProcessing(null);
    }
  };

  // Sorting for display (approved latest on top)
  const filteredPayments = [...payments].sort((a, b) => {
    if (a.status === 'approved' && b.status === 'approved') {
      return new Date(b.processed_at || b.created_at) - new Date(a.processed_at || a.created_at);
    }
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const planCounts = stats?.plan_counts || {};
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  if (loading && payments.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
          <p className="text-gray-400 text-sm">Manage VIP subscriptions</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" className="border-gray-700">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={<Users />} label="Explorer" value={planCounts.explorer || 0} color="gray" />
        <StatCard icon={<Rocket />} label="Startup" value={planCounts.startup || 0} color="blue" />
        <StatCard icon={<TrendingUp />} label="Growth" value={planCounts.growth || 0} color="green" />
        <StatCard icon={<Crown />} label="Elite" value={planCounts.elite || 0} color="amber" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {['pending', 'approved', 'rejected'].map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setPage(1); }}
            className={`px-4 py-2 rounded-lg font-medium capitalize transition-all ${
              activeTab === tab
                ? tab === 'pending' ? 'bg-amber-500 text-black'
                : tab === 'approved' ? 'bg-green-500 text-black'
                : 'bg-red-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {tab === 'pending' && <Clock className="w-4 h-4 inline mr-2" />}
            {tab === 'approved' && <CheckCircle className="w-4 h-4 inline mr-2" />}
            {tab === 'rejected' && <XCircle className="w-4 h-4 inline mr-2" />}
            {tab}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          placeholder="Search by name, email, UTR..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-gray-800 border-gray-700 text-white"
        />
      </div>

      {/* Payments List */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        {filteredPayments.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-400">No {activeTab} payments</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filteredPayments.map(payment => (
              <PaymentCard
                key={payment.payment_id}
                payment={payment}
                tab={activeTab}
                processing={processing === payment.payment_id}
                onApprove={() => handleApprove(payment.payment_id)}
                onReject={() => setRejectModal({ show: true, payment })}
                onEdit={() => setEditModal({ show: true, payment })}
                onView={() => setViewModal({ show: true, payment })}
                onDelete={() => handleDelete(payment.payment_id)}
                onImageClick={() => setImageModal({ show: true, url: payment.screenshot_url })}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-800 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Page {page} of {totalPages} ({total} total)
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                variant="outline"
                size="sm"
                className="border-gray-700"
              >
                Previous
              </Button>
              <Button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                variant="outline"
                size="sm"
                className="border-gray-700"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* View Modal */}
      {viewModal.show && (
        <ViewModal 
          payment={viewModal.payment} 
          onClose={() => setViewModal({ show: false, payment: null })} 
        />
      )}

      {/* Edit Modal */}
      {editModal.show && (
        <EditModal
          payment={editModal.payment}
          processing={processing === editModal.payment?.payment_id}
          onClose={() => setEditModal({ show: false, payment: null })}
          onSave={(updates) => handleEdit(editModal.payment.payment_id, updates)}
        />
      )}

      {/* Reject Modal */}
      {rejectModal.show && (
        <RejectModal
          payment={rejectModal.payment}
          processing={processing === rejectModal.payment?.payment_id}
          onClose={() => setRejectModal({ show: false, payment: null })}
          onReject={(reason) => handleReject(rejectModal.payment.payment_id, reason)}
        />
      )}

      {/* Image Modal */}
      {imageModal.show && imageModal.url && (
        <div 
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4"
          onClick={() => setImageModal({ show: false, url: null })}
        >
          <button className="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full">
            <X className="w-6 h-6" />
          </button>
          <img 
            src={imageModal.url} 
            alt="Screenshot" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

// Stat Card
const StatCard = ({ icon, label, value, color }) => {
  const colors = {
    gray: 'from-gray-600 to-gray-700',
    blue: 'from-blue-500 to-indigo-600',
    green: 'from-emerald-500 to-teal-600',
    amber: 'from-amber-500 to-orange-600'
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white`}>
          {React.cloneElement(icon, { className: 'w-5 h-5' })}
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-sm text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
};

// Payment Card
const PaymentCard = ({ payment, tab, processing, onApprove, onReject, onEdit, onView, onDelete, onImageClick }) => {
  const planColors = {
    startup: 'bg-blue-500/20 text-blue-400',
    growth: 'bg-emerald-500/20 text-emerald-400',
    elite: 'bg-amber-500/20 text-amber-400'
  };

  const plan = payment.subscription_plan || payment.plan || '';

  return (
    <div className="p-4 hover:bg-gray-800/50 transition-colors">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Screenshot */}
        <div className="w-full md:w-32 flex-shrink-0">
          {payment.screenshot_url ? (
            <button onClick={onImageClick} className="w-full group relative">
              <img 
                src={payment.screenshot_url} 
                alt="Screenshot" 
                className="w-full h-32 object-cover rounded-lg border border-gray-700 group-hover:border-purple-500"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center">
                <Eye className="w-6 h-6 text-white" />
              </div>
            </button>
          ) : (
            <div className="w-full h-32 bg-gray-800 rounded-lg border border-dashed border-gray-700 flex items-center justify-center">
              <p className="text-gray-500 text-xs">No Image</p>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-white font-bold">{payment.user_name || 'Unknown'}</h3>
              <p className="text-gray-400 text-sm">{payment.user_email}</p>
            </div>
            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${planColors[plan] || 'bg-gray-700 text-gray-400'}`}>
              {plan?.toUpperCase() || 'N/A'}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <div className="bg-gray-800/50 rounded-lg p-2">
              <p className="text-gray-500 text-xs">Amount</p>
              <p className="text-green-400 font-bold">₹{payment.amount || 0}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-2">
              <p className="text-gray-500 text-xs">Duration</p>
              <p className="text-white capitalize">{payment.duration || payment.plan_type || 'monthly'}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-2">
              <p className="text-gray-500 text-xs">UTR</p>
              <p className="text-white font-mono text-sm truncate">{payment.utr_number || 'N/A'}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-2">
              <p className="text-gray-500 text-xs">Date</p>
              <p className="text-white text-sm">
                {payment.submitted_at ? new Date(payment.submitted_at).toLocaleDateString() : '-'}
              </p>
            </div>
          </div>

          {/* Rejection reason for rejected tab */}
          {tab === 'rejected' && payment.rejection_reason && (
            <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{payment.rejection_reason}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {tab === 'pending' && (
              <>
                <Button
                  onClick={onApprove}
                  disabled={processing}
                  className="bg-green-600 hover:bg-green-700 h-9"
                  data-testid="approve-btn"
                >
                  {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4 mr-1" /> Approve</>}
                </Button>
                <Button
                  onClick={onReject}
                  disabled={processing}
                  variant="outline"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10 h-9"
                  data-testid="reject-btn"
                >
                  <XCircle className="w-4 h-4 mr-1" /> Reject
                </Button>
              </>
            )}
            {tab === 'approved' && (
              <>
                <Button onClick={onView} size="sm" variant="outline" className="border-gray-600 h-9">
                  <Eye className="w-4 h-4" />
                </Button>
                <Button onClick={onEdit} size="sm" variant="outline" className="border-blue-500/50 text-blue-400 h-9">
                  <Edit className="w-4 h-4" />
                </Button>
                <Button onClick={onDelete} disabled={processing} size="sm" variant="outline" className="border-red-500/50 text-red-400 h-9">
                  {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </Button>
              </>
            )}
            {tab === 'rejected' && (
              <>
                <Button onClick={onApprove} disabled={processing} className="bg-green-600 hover:bg-green-700 h-9">
                  {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4 mr-1" /> Re-approve</>}
                </Button>
                <Button onClick={onView} size="sm" variant="outline" className="border-gray-600 h-9">
                  <Eye className="w-4 h-4" />
                </Button>
                <Button onClick={onDelete} disabled={processing} size="sm" variant="outline" className="border-red-500/50 text-red-400 h-9">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// View Modal
const ViewModal = ({ payment, onClose }) => (
  <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 max-w-lg w-full">
      <div className="flex justify-between mb-4">
        <h3 className="text-xl font-bold text-white">Payment Details</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><p className="text-gray-500">User</p><p className="text-white">{payment.user_name}</p></div>
        <div><p className="text-gray-500">Email</p><p className="text-white">{payment.user_email}</p></div>
        <div><p className="text-gray-500">Plan</p><p className="text-white capitalize">{payment.plan || payment.subscription_plan}</p></div>
        <div><p className="text-gray-500">Amount</p><p className="text-white">₹{payment.amount}</p></div>
        <div><p className="text-gray-500">Duration</p><p className="text-white capitalize">{payment.duration || payment.plan_type}</p></div>
        <div><p className="text-gray-500">UTR</p><p className="text-white font-mono">{payment.utr_number || 'N/A'}</p></div>
        <div><p className="text-gray-500">Expiry</p><p className="text-white">{payment.new_expiry ? new Date(payment.new_expiry).toLocaleDateString() : 'N/A'}</p></div>
        <div><p className="text-gray-500">Status</p><p className="text-white capitalize">{payment.status}</p></div>
      </div>

      <Button onClick={onClose} className="w-full mt-6 bg-gray-800 hover:bg-gray-700">Close</Button>
    </div>
  </div>
);

// Edit Modal
const EditModal = ({ payment, processing, onClose, onSave }) => {
  const [form, setForm] = useState({
    plan: payment.subscription_plan || payment.plan || 'startup',
    duration: payment.plan_type || payment.duration || 'monthly',
    amount: payment.amount || 0,
    expires_at: payment.new_expiry?.split('T')[0] || ''
  });

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 max-w-md w-full">
        <div className="flex justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Edit Subscription</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm block mb-1">Plan</label>
            <select
              value={form.plan}
              onChange={(e) => setForm({...form, plan: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white"
            >
              <option value="startup">Startup</option>
              <option value="growth">Growth</option>
              <option value="elite">Elite</option>
            </select>
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-1">Duration</label>
            <select
              value={form.duration}
              onChange={(e) => setForm({...form, duration: e.target.value})}
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
              value={form.amount}
              onChange={(e) => setForm({...form, amount: parseInt(e.target.value) || 0})}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-1">Expiry Date</label>
            <Input
              type="date"
              value={form.expires_at}
              onChange={(e) => setForm({...form, expires_at: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button onClick={onClose} variant="outline" className="flex-1 border-gray-700">Cancel</Button>
          <Button 
            onClick={() => onSave(form)} 
            disabled={processing}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Reject Modal
const RejectModal = ({ payment, processing, onClose, onReject }) => {
  const [reason, setReason] = useState('');
  const reasons = [
    'Invalid UTR Number',
    'Screenshot not clear',
    'Amount mismatch',
    'Duplicate Payment',
    'Payment verification failed'
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 max-w-md w-full">
        <div className="flex justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            Reject Payment
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-800 rounded-lg">
          <p className="text-white font-medium">{payment.user_name}</p>
          <p className="text-gray-400 text-sm">₹{payment.amount} - {payment.plan?.toUpperCase()}</p>
        </div>

        <div className="space-y-2 mb-4">
          {reasons.map(r => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                reason === r 
                  ? 'bg-red-500/20 border-red-500 text-red-400'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <Input
          placeholder="Or type custom reason..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="bg-gray-800 border-gray-700 text-white mb-4"
        />

        <div className="flex gap-3">
          <Button onClick={onClose} variant="outline" className="flex-1 border-gray-700">Cancel</Button>
          <Button
            onClick={() => onReject(reason)}
            disabled={processing || !reason}
            className="flex-1 bg-red-600 hover:bg-red-700"
          >
            {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Reject'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminSubscriptionManagement;
