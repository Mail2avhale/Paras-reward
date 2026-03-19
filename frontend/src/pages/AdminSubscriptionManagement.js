import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Crown, Users, TrendingUp, Rocket, Clock, CheckCircle, XCircle,
  Search, RefreshCw, Eye, Edit, Trash2, X, Calendar, CreditCard, AlertCircle,
  ArrowUpDown, Filter, SlidersHorizontal, ChevronDown
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
  
  // Date filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Advanced Sorting & Filtering
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortBy, setSortBy] = useState('created_at'); // created_at, processed_at, amount
  const [sortOrder, setSortOrder] = useState('newest'); // newest, oldest
  const [processedByFilter, setProcessedByFilter] = useState(''); // Filter by admin who processed
  const [planFilter, setPlanFilter] = useState('all'); // all, startup, growth, elite
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [subscriptionTypeFilter, setSubscriptionTypeFilter] = useState('all'); // all, new, renewal, upgrade
  
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
  }, [activeTab, page, debouncedSearch, dateFrom, dateTo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch stats and payments with search and date filter
      let searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';
      if (dateFrom) searchParam += `&date_from=${dateFrom}`;
      if (dateTo) searchParam += `&date_to=${dateTo}`;
      
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

  const handleApprove = async (paymentId, userId) => {
    setProcessing(paymentId);
    try {
      // First check for fraud risk
      if (userId) {
        try {
          const fraudCheck = await axios.get(`${API}/admin/subscription/fraud-check/${userId}?days=10`);
          if (fraudCheck.data?.has_fraud_risk) {
            const warnings = fraudCheck.data.warnings || [];
            const warningMessages = warnings.map(w => w.message).join('\n• ');
            
            const confirmApprove = window.confirm(
              `⚠️ FRAUD ALERT - ${fraudCheck.data.risk_level.toUpperCase()} RISK!\n\n` +
              `• ${warningMessages}\n\n` +
              `User: ${fraudCheck.data.user_info?.name || userId}\n` +
              `Current Plan: ${fraudCheck.data.user_info?.current_plan || 'None'}\n` +
              `Total Subscriptions: ${fraudCheck.data.user_info?.total_subscriptions || 0}\n\n` +
              `Are you sure you want to approve this subscription?`
            );
            
            if (!confirmApprove) {
              setProcessing(null);
              return;
            }
          }
        } catch (fraudErr) {
          // console.log('Fraud check failed, proceeding with approval:', fraudErr);
        }
      }
      
      const res = await axios.post(`${API}/admin/vip-payment/${paymentId}/approve`, {});
      
      // Show fraud warning if returned
      if (res.data?.fraud_warning) {
        toast.warning(res.data.fraud_warning.message, { duration: 8000 });
      }
      
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

  // Advanced filtering and sorting
  const filteredPayments = useMemo(() => {
    let filtered = [...payments];
    
    // Filter by plan
    if (planFilter !== 'all') {
      filtered = filtered.filter(p => 
        (p.subscription_plan || p.plan || '').toLowerCase() === planFilter.toLowerCase()
      );
    }
    
    // Filter by subscription type (new, renewal, upgrade)
    if (subscriptionTypeFilter !== 'all') {
      filtered = filtered.filter(p => p.subscription_type === subscriptionTypeFilter);
    }
    
    // Filter by processed by (admin name)
    if (processedByFilter && (activeTab === 'approved' || activeTab === 'rejected')) {
      const search = processedByFilter.toLowerCase();
      filtered = filtered.filter(p => 
        (p.processed_by || '').toLowerCase().includes(search) ||
        (p.processed_by_name || '').toLowerCase().includes(search) ||
        (p.approved_by || '').toLowerCase().includes(search) ||
        (p.rejected_by || '').toLowerCase().includes(search)
      );
    }
    
    // Filter by amount range
    if (amountMin) {
      filtered = filtered.filter(p => (p.amount || 0) >= parseFloat(amountMin));
    }
    if (amountMax) {
      filtered = filtered.filter(p => (p.amount || 0) <= parseFloat(amountMax));
    }
    
    // Advanced sorting
    filtered.sort((a, b) => {
      let dateA, dateB;
      
      switch (sortBy) {
        case 'processed_at':
          dateA = a.processed_at || a.approved_at || a.rejected_at || a.created_at;
          dateB = b.processed_at || b.approved_at || b.rejected_at || b.created_at;
          break;
        case 'amount':
          const amtA = a.amount || 0;
          const amtB = b.amount || 0;
          return sortOrder === 'newest' ? amtB - amtA : amtA - amtB;
        case 'created_at':
        default:
          dateA = a.created_at || a.submitted_at;
          dateB = b.created_at || b.submitted_at;
      }
      
      if (sortOrder === 'newest') {
        return new Date(dateB) - new Date(dateA);
      }
      return new Date(dateA) - new Date(dateB);
    });
    
    return filtered;
  }, [payments, planFilter, subscriptionTypeFilter, processedByFilter, amountMin, amountMax, sortBy, sortOrder, activeTab]);

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

      {/* User Subscription Edit Section */}
      <UserSubscriptionEditor onUpdate={fetchData} />

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

      {/* Search & Date Filter */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Text Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search by name, email, UTR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-gray-800 border-gray-700 text-white"
            />
          </div>
          
          {/* Date From */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <Input
              type="date"
              placeholder="From Date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="bg-gray-800 border-gray-700 text-white w-40"
            />
          </div>
          
          {/* Date To */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500">to</span>
            <Input
              type="date"
              placeholder="To Date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="bg-gray-800 border-gray-700 text-white w-40"
            />
          </div>
          
          {/* Sort Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
            className={`h-10 px-4 text-sm font-medium ${
              sortOrder === 'newest' 
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                : 'bg-gray-800 border-gray-700 text-gray-400'
            }`}
          >
            <ArrowUpDown className="w-4 h-4 mr-2" />
            {sortOrder === 'newest' ? 'Latest First' : 'Oldest First'}
          </Button>
          
          {/* Advanced Filters Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`h-10 px-4 ${
              showAdvancedFilters || processedByFilter || planFilter !== 'all' || amountMin || amountMax || subscriptionTypeFilter !== 'all'
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                : 'border-gray-700 text-gray-400'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Filters
            {(processedByFilter || planFilter !== 'all' || amountMin || amountMax || subscriptionTypeFilter !== 'all') && 
              <span className="w-2 h-2 bg-cyan-500 rounded-full ml-2"></span>
            }
          </Button>
          
          {/* Clear Filters */}
          {(dateFrom || dateTo || searchQuery) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setDateFrom(''); setDateTo(''); setSearchQuery(''); setPage(1); }}
              className="border-gray-700 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4 mr-1" /> Clear
            </Button>
          )}
        </div>
        
        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 space-y-4">
            {/* Row 1: Sort By & Plan Filter */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs text-gray-400 mb-1.5">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full h-9 px-3 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm"
                >
                  <option value="created_at">Submit Date</option>
                  <option value="processed_at">Process Date</option>
                  <option value="amount">Amount (₹)</option>
                </select>
              </div>
              
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs text-gray-400 mb-1.5">Plan</label>
                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  className="w-full h-9 px-3 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm"
                >
                  <option value="all">All Plans</option>
                  <option value="startup">Startup</option>
                  <option value="growth">Growth</option>
                  <option value="elite">Elite</option>
                </select>
              </div>
              
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs text-gray-400 mb-1.5">Subscription Type</label>
                <select
                  value={subscriptionTypeFilter}
                  onChange={(e) => setSubscriptionTypeFilter(e.target.value)}
                  className="w-full h-9 px-3 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="new">🆕 New</option>
                  <option value="renewal">🔄 Renewal</option>
                  <option value="upgrade">⬆️ Upgrade</option>
                  <option value="downgrade">⬇️ Downgrade</option>
                </select>
              </div>
            </div>

            {/* Row 2: Amount Range */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-gray-400 mb-1.5">Min Amount (₹)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={amountMin}
                  onChange={(e) => setAmountMin(e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white h-9"
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-gray-400 mb-1.5">Max Amount (₹)</label>
                <Input
                  type="number"
                  placeholder="10000"
                  value={amountMax}
                  onChange={(e) => setAmountMax(e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white h-9"
                />
              </div>
              
              {/* Quick Amount Presets */}
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setAmountMin(''); setAmountMax('999'); }} 
                  className="text-blue-400 hover:text-blue-300 h-9 px-2 text-xs">≤₹999</Button>
                <Button size="sm" variant="ghost" onClick={() => { setAmountMin('1000'); setAmountMax('2999'); }} 
                  className="text-blue-400 hover:text-blue-300 h-9 px-2 text-xs">₹1K-3K</Button>
                <Button size="sm" variant="ghost" onClick={() => { setAmountMin('3000'); setAmountMax(''); }} 
                  className="text-blue-400 hover:text-blue-300 h-9 px-2 text-xs">≥₹3K</Button>
              </div>
            </div>

            {/* Row 3: Admin Filter (Show based on status) */}
            {(activeTab === 'approved' || activeTab === 'rejected') && (
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-gray-400 mb-1.5">
                    {activeTab === 'approved' ? 'Approved By (Admin)' : 'Rejected By (Admin)'}
                  </label>
                  <Input
                    placeholder="Search by admin name..."
                    value={processedByFilter}
                    onChange={(e) => setProcessedByFilter(e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white h-9"
                  />
                </div>
              </div>
            )}

            {/* Clear All Filters */}
            {(processedByFilter || planFilter !== 'all' || amountMin || amountMax || subscriptionTypeFilter !== 'all' || sortBy !== 'created_at') && (
              <div className="pt-2 border-t border-gray-700">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setProcessedByFilter('');
                    setPlanFilter('all');
                    setSubscriptionTypeFilter('all');
                    setAmountMin('');
                    setAmountMax('');
                    setSortBy('created_at');
                    setSortOrder('newest');
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear All Filters
                </Button>
              </div>
            )}
          </div>
        )}
        
        {/* Active Filters Summary */}
        {(planFilter !== 'all' || subscriptionTypeFilter !== 'all' || processedByFilter || amountMin || amountMax) && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500">Active Filters:</span>
            {planFilter !== 'all' && (
              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full flex items-center gap-1">
                Plan: {planFilter}
                <button onClick={() => setPlanFilter('all')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {subscriptionTypeFilter !== 'all' && (
              <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full flex items-center gap-1">
                Type: {subscriptionTypeFilter}
                <button onClick={() => setSubscriptionTypeFilter('all')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {processedByFilter && (
              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                By: {processedByFilter}
                <button onClick={() => setProcessedByFilter('')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {(amountMin || amountMax) && (
              <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full flex items-center gap-1">
                ₹{amountMin || '0'} - ₹{amountMax || '∞'}
                <button onClick={() => { setAmountMin(''); setAmountMax(''); }}><X className="w-3 h-3" /></button>
              </span>
            )}
            <span className="text-gray-400 ml-2">
              Showing {filteredPayments.length} of {payments.length} payments
            </span>
          </div>
        )}
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
                onApprove={() => handleApprove(payment.payment_id, payment.user_id || payment.user_uid)}
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
            <div className="flex flex-col items-end gap-1">
              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${planColors[plan] || 'bg-gray-700 text-gray-400'}`}>
                {plan?.toUpperCase() || 'N/A'}
              </span>
              {/* NEW vs RENEWAL Badge */}
              {payment.subscription_type && (
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  payment.subscription_type === 'new' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                  payment.subscription_type === 'renewal' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  payment.subscription_type === 'upgrade' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                  payment.subscription_type === 'downgrade' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {payment.subscription_type === 'new' ? '🆕 NEW' :
                   payment.subscription_type === 'renewal' ? '🔄 RENEWAL' :
                   payment.subscription_type === 'upgrade' ? '⬆️ UPGRADE' :
                   payment.subscription_type === 'downgrade' ? '⬇️ DOWNGRADE' :
                   payment.subscription_type?.toUpperCase()}
                </span>
              )}
              {/* Show subscription count */}
              {payment.user_subscription_count > 1 && (
                <span className="text-xs text-gray-500">
                  #{payment.user_subscription_count} subscription
                </span>
              )}
            </div>
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
              <p className="text-gray-500 text-xs">Submit Date</p>
              <p className="text-white text-sm">
                {payment.submitted_at ? new Date(payment.submitted_at).toLocaleDateString() : 
                 payment.created_at ? new Date(payment.created_at).toLocaleDateString() : '-'}
              </p>
            </div>
            {/* Show current plan for pending payments - helps admin know if NEW or RENEWAL */}
            {tab === 'pending' && payment.current_plan && (
              <div className="bg-gray-800/50 rounded-lg p-2">
                <p className="text-gray-500 text-xs">Current Plan</p>
                <p className={`text-sm font-medium ${
                  payment.current_plan === 'explorer' ? 'text-gray-400' : 'text-purple-400'
                }`}>
                  {payment.current_plan === 'explorer' ? '🆕 New User' : `🔄 ${payment.current_plan?.toUpperCase()}`}
                </p>
              </div>
            )}
          </div>

          {/* Approved tab extra details - Approve Date, Expiry, Remaining Days */}
          {tab === 'approved' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2">
                <p className="text-green-400 text-xs">Approve Date</p>
                <p className="text-green-300 text-sm font-medium">
                  {payment.processed_at ? new Date(payment.processed_at).toLocaleDateString() : 
                   payment.approved_at ? new Date(payment.approved_at).toLocaleDateString() : '-'}
                </p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2">
                <p className="text-blue-400 text-xs">Expiry Date</p>
                <p className="text-blue-300 text-sm font-medium">
                  {payment.new_expiry ? new Date(payment.new_expiry).toLocaleDateString() : 
                   payment.expires_at ? new Date(payment.expires_at).toLocaleDateString() : '-'}
                </p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                <p className="text-amber-400 text-xs">Remaining Days</p>
                <p className="text-amber-300 text-sm font-medium">
                  {(() => {
                    const expiry = payment.new_expiry || payment.expires_at;
                    if (!expiry) return '-';
                    const days = Math.ceil((new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24));
                    return days > 0 ? `${days} days` : 'Expired';
                  })()}
                </p>
              </div>
            </div>
          )}

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
                  <Eye className="w-4 h-4 mr-1" /> View
                </Button>
                <Button onClick={onEdit} size="sm" variant="outline" className="border-blue-500/50 text-blue-400 h-9">
                  <Edit className="w-4 h-4 mr-1" /> Edit
                </Button>
                <Button onClick={onDelete} disabled={processing} size="sm" variant="outline" className="border-red-500/50 text-red-400 h-9">
                  {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4 mr-1" /> Delete</>}
                </Button>
              </>
            )}
            {tab === 'rejected' && (
              <>
                <Button onClick={onApprove} disabled={processing} className="bg-green-600 hover:bg-green-700 h-9">
                  {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4 mr-1" /> Re-approve</>}
                </Button>
                <Button onClick={onView} size="sm" variant="outline" className="border-gray-600 h-9">
                  <Eye className="w-4 h-4 mr-1" /> View
                </Button>
                <Button onClick={onDelete} disabled={processing} size="sm" variant="outline" className="border-red-500/50 text-red-400 h-9">
                  <Trash2 className="w-4 h-4 mr-1" /> Delete
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

// User Subscription Editor Component
const UserSubscriptionEditor = ({ onUpdate }) => {
  const [searchInput, setSearchInput] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  
  // Edit form state
  const [plan, setPlan] = useState('explorer');
  const [expiryMode, setExpiryMode] = useState('days'); // 'days' or 'date'
  const [days, setDays] = useState(30);
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  
  const searchUser = async () => {
    if (!searchInput.trim()) {
      toast.error('Enter mobile, email or UID');
      return;
    }
    
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/user-lookup/${encodeURIComponent(searchInput)}`);
      if (res.data && res.data.uid) {
        setUser(res.data);
        setPlan(res.data.subscription_plan || 'explorer');
        if (res.data.subscription_expiry) {
          const expDate = new Date(res.data.subscription_expiry);
          setExpiryDate(expDate.toISOString().split('T')[0]);
        }
        setShowEditor(true);
      } else {
        toast.error(res.data?.error || 'User not found');
        setUser(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'User not found');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };
  
  const updateSubscription = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const payload = {
        plan,
        notes,
        payment_method: 'admin_manual'
      };
      
      if (expiryMode === 'days') {
        payload.days = parseInt(days);
      } else {
        payload.use_manual_expiry = true;
        payload.expiry_date = new Date(expiryDate).toISOString();
      }
      
      const res = await axios.put(`${API}/admin/user/${user.uid}/subscription`, payload);
      
      if (res.data.success) {
        toast.success(`Subscription updated: ${plan.toUpperCase()} until ${new Date(res.data.expiry).toLocaleDateString()}`);
        setShowEditor(false);
        setUser(null);
        setSearchInput('');
        if (onUpdate) onUpdate();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update subscription');
    } finally {
      setSaving(false);
    }
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', { 
      day: 'numeric', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
  };
  
  const isExpired = (dateStr) => {
    if (!dateStr) return true;
    return new Date(dateStr) < new Date();
  };

  return (
    <div className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-800">
      <div className="flex items-center gap-2 mb-4">
        <Edit className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-semibold text-white">Edit User Subscription</h2>
      </div>
      
      {/* Search Bar */}
      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Search by Mobile / Email / UID"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && searchUser()}
          className="bg-gray-800 border-gray-700 text-white flex-1"
        />
        <Button 
          onClick={searchUser} 
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>
      
      {/* User Details & Editor */}
      {showEditor && user && (
        <div className="bg-gray-800 rounded-lg p-4">
          {/* User Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pb-4 border-b border-gray-700">
            <div>
              <p className="text-gray-500 text-xs">Name</p>
              <p className="text-white font-medium">{user.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Mobile</p>
              <p className="text-white">{user.mobile || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Current Plan</p>
              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                user.subscription_plan === 'elite' ? 'bg-amber-500/20 text-amber-400' :
                user.subscription_plan === 'growth' ? 'bg-green-500/20 text-green-400' :
                user.subscription_plan === 'startup' ? 'bg-blue-500/20 text-blue-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {(user.subscription_plan || 'explorer').toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Expiry</p>
              <p className={`font-medium ${isExpired(user.subscription_expiry) ? 'text-red-400' : 'text-green-400'}`}>
                {formatDate(user.subscription_expiry)}
              </p>
            </div>
          </div>
          
          {/* Edit Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Plan Selection */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">New Plan</label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="explorer">Explorer (Free)</option>
                <option value="startup">Startup (₹299)</option>
                <option value="growth">Growth (₹499)</option>
                <option value="elite">Elite (₹799)</option>
              </select>
            </div>
            
            {/* Expiry Mode */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Expiry Mode</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setExpiryMode('days')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${
                    expiryMode === 'days' ? 'bg-purple-600 text-white' : 'bg-gray-900 text-gray-400 border border-gray-700'
                  }`}
                >
                  Add Days
                </button>
                <button
                  onClick={() => setExpiryMode('date')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${
                    expiryMode === 'date' ? 'bg-purple-600 text-white' : 'bg-gray-900 text-gray-400 border border-gray-700'
                  }`}
                >
                  Set Date
                </button>
              </div>
            </div>
            
            {/* Days or Date Input */}
            {expiryMode === 'days' ? (
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Days to Add</label>
                <Input
                  type="number"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  min="1"
                  max="365"
                  className="bg-gray-900 border-gray-700 text-white"
                />
                <p className="text-gray-500 text-xs mt-1">
                  New expiry: {new Date(Date.now() + days * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Expiry Date</label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="bg-gray-900 border-gray-700 text-white"
                />
              </div>
            )}
            
            {/* Notes */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Admin Notes</label>
              <Input
                placeholder="Reason for change..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-gray-900 border-gray-700 text-white"
              />
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 mt-4 pt-4 border-t border-gray-700">
            <Button
              onClick={() => { setShowEditor(false); setUser(null); }}
              variant="outline"
              className="border-gray-700 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={updateSubscription}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 flex-1"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Update Subscription
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSubscriptionManagement;
