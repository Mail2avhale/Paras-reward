import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  AlertTriangle, RefreshCw, Search, Filter, Loader2, ArrowLeft,
  CheckCircle, XCircle, Clock, RotateCcw, Wallet, User, Phone,
  Mail, Calendar, CreditCard, Zap, Download, ChevronLeft, ChevronRight,
  Eye, Ban, Check, X, FileText, IndianRupee
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Modal Component
const Modal = ({ show, onClose, title, children, size = "md" }) => {
  if (!show) return null;
  const sizeClasses = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-xl", "2xl": "max-w-2xl" };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className={`bg-white border border-slate-200 rounded-2xl p-6 w-full ${sizeClasses[size]} mx-4 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white text-slate-500">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
};

const getStatusBadge = (status, refunded) => {
  if (refunded) return { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Refunded' };
  const badges = {
    failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' },
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Pending' },
    processing: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Processing' },
    retry_failed: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Retry Failed' },
    resolved: { bg: 'bg-gray-500/20', text: 'text-slate-500', label: 'Resolved' },
    refunded: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Refunded' }
  };
  return badges[status] || { bg: 'bg-gray-500/20', text: 'text-slate-500', label: status };
};

const AdminFailedTransactions = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [daysFilter, setDaysFilter] = useState(30);
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceTypes, setServiceTypes] = useState([]);
  
  // Modals
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/failed-transactions/list`, {
        params: { status: statusFilter, service_type: serviceFilter, days: daysFilter, page, limit: 50 },
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      
      setTransactions(response.data.transactions || []);
      setStats(response.data.stats || {});
      setTotal(response.data.total || 0);
      setPages(response.data.pages || 1);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error(error.response?.data?.detail || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, serviceFilter, daysFilter, page, user?.token]);

  // Fetch service types
  const fetchServiceTypes = async () => {
    try {
      const response = await axios.get(`${API}/admin/failed-transactions/service-types`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      setServiceTypes(response.data.service_types || []);
    } catch (error) {
      console.error('Error fetching service types:', error);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchServiceTypes();
  }, [fetchTransactions]);

  // Handle refund
  const handleRefund = async () => {
    if (!selectedTxn) return;
    
    const amount = parseFloat(refundAmount) || selectedTxn.prc_amount || selectedTxn.total_prc;
    if (!amount || amount <= 0) {
      toast.error('Please enter valid refund amount');
      return;
    }
    
    setActionLoading(true);
    try {
      const response = await axios.post(`${API}/admin/failed-transactions/refund`, {
        request_id: selectedTxn.request_id,
        user_id: selectedTxn.user_id,
        amount,
        reason: refundReason || 'Admin manual refund',
        admin_id: user?.uid
      }, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      
      toast.success(response.data.message);
      setShowRefundModal(false);
      setSelectedTxn(null);
      setRefundAmount('');
      setRefundReason('');
      fetchTransactions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Refund failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle bulk refund
  const handleBulkRefund = async () => {
    if (selectedIds.length === 0) {
      toast.error('Select transactions to refund');
      return;
    }
    
    if (!window.confirm(`Refund ${selectedIds.length} transactions?`)) return;
    
    setActionLoading(true);
    try {
      const response = await axios.post(`${API}/admin/failed-transactions/bulk-refund`, {
        request_ids: selectedIds,
        admin_id: user?.uid
      }, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      
      toast.success(response.data.message);
      setSelectedIds([]);
      fetchTransactions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Bulk refund failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle mark resolved
  const handleMarkResolved = async (txn) => {
    const note = window.prompt('Resolution note (optional):');
    if (note === null) return;
    
    try {
      await axios.post(`${API}/admin/failed-transactions/mark-resolved/${txn.request_id}`, {
        note: note || 'Resolved by admin',
        admin_id: user?.uid
      }, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      
      toast.success('Marked as resolved');
      fetchTransactions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark resolved');
    }
  };

  // Handle retry
  const handleRetry = async (txn) => {
    if (!window.confirm('Retry this transaction?')) return;
    
    try {
      await axios.post(`${API}/admin/failed-transactions/retry/${txn.request_id}`, {
        admin_id: user?.uid
      }, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      
      toast.success('Transaction queued for retry');
      fetchTransactions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Retry failed');
    }
  };

  // Toggle selection
  const toggleSelection = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Select all not refunded
  const selectAllNotRefunded = () => {
    const notRefunded = transactions.filter(t => !t.prc_refunded).map(t => t.request_id);
    setSelectedIds(notRefunded);
  };

  // Filter transactions locally by search
  const filteredTransactions = searchQuery
    ? transactions.filter(t => 
        t.request_id?.includes(searchQuery) ||
        t.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.consumer_number?.includes(searchQuery)
      )
    : transactions;

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin')} className="text-slate-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-red-400" />
              Failed & Pending Transactions
            </h1>
            <p className="text-sm text-slate-500">Manual refund and resolution management</p>
          </div>
        </div>
        <Button onClick={fetchTransactions} disabled={loading} variant="outline" className="border-slate-200">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-red-500/10 border-red-500/30 p-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-400" />
            <div>
              <p className="text-2xl font-bold text-red-400">{stats.total_failed || 0}</p>
              <p className="text-xs text-slate-500">Failed</p>
            </div>
          </div>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/30 p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-400" />
            <div>
              <p className="text-2xl font-bold text-yellow-400">{stats.total_pending || 0}</p>
              <p className="text-xs text-slate-500">Pending</p>
            </div>
          </div>
        </Card>
        <Card className="bg-green-500/10 border-green-500/30 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-green-400">{stats.total_refunded || 0}</p>
              <p className="text-xs text-slate-500">Refunded</p>
            </div>
          </div>
        </Card>
        <Card className="bg-orange-500/10 border-orange-500/30 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-orange-400" />
            <div>
              <p className="text-2xl font-bold text-orange-400">{stats.total_not_refunded || 0}</p>
              <p className="text-xs text-slate-500">Not Refunded</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search by ID, name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-slate-200"
              />
            </div>
          </div>
          
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-800">
            <option value="all">All Status</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
            <option value="retry_failed">Retry Failed</option>
          </select>
          
          <select value={serviceFilter} onChange={(e) => { setServiceFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-800">
            <option value="all">All Services</option>
            {serviceTypes.map(st => (
              <option key={st.service_type} value={st.service_type}>
                {st.service_type} ({st.count})
              </option>
            ))}
          </select>
          
          <select value={daysFilter} onChange={(e) => { setDaysFilter(parseInt(e.target.value)); setPage(1); }}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-800">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        
        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-200">
            <span className="text-sm text-slate-500">{selectedIds.length} selected</span>
            <Button onClick={handleBulkRefund} disabled={actionLoading} className="bg-green-600 hover:bg-green-700">
              <Wallet className="h-4 w-4 mr-2" /> Bulk Refund
            </Button>
            <Button onClick={() => setSelectedIds([])} variant="outline" className="border-gray-600">
              Clear Selection
            </Button>
          </div>
        )}
      </Card>

      {/* Transactions Table */}
      <Card className="bg-white border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No transactions found</p>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <span className="text-sm text-slate-500">Showing {filteredTransactions.length} of {total}</span>
              <Button onClick={selectAllNotRefunded} size="sm" variant="outline" className="border-gray-600 text-xs">
                Select All Not Refunded
              </Button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                    <th className="p-3 w-10">
                      <input type="checkbox" 
                        checked={selectedIds.length === filteredTransactions.filter(t => !t.prc_refunded).length && selectedIds.length > 0}
                        onChange={(e) => e.target.checked ? selectAllNotRefunded() : setSelectedIds([])}
                        className="rounded bg-gray-700 border-gray-600"
                      />
                    </th>
                    <th className="p-3">User</th>
                    <th className="p-3">Service</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((txn) => {
                    const status = getStatusBadge(txn.status, txn.prc_refunded);
                    return (
                      <tr key={txn.request_id} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3">
                          {!txn.prc_refunded && (
                            <input type="checkbox"
                              checked={selectedIds.includes(txn.request_id)}
                              onChange={() => toggleSelection(txn.request_id)}
                              className="rounded bg-gray-700 border-gray-600"
                            />
                          )}
                        </td>
                        <td className="p-3">
                          <div>
                            <p className="text-slate-800 font-medium">{txn.user?.name || 'Unknown'}</p>
                            <p className="text-slate-500 text-xs">{txn.user?.email}</p>
                            <p className="text-gray-600 text-xs font-mono">{txn.request_id?.slice(0, 8)}...</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <div>
                            <p className="text-slate-800 capitalize">{txn.service_type || 'N/A'}</p>
                            <p className="text-slate-500 text-xs">{txn.consumer_number || txn.number || '-'}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <div>
                            <p className="text-amber-400 font-bold">{(txn.prc_amount || txn.total_prc || 0).toFixed(2)} PRC</p>
                            <p className="text-slate-500 text-xs">₹{txn.amount_inr || txn.amount || 0}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs ${status.bg} ${status.text}`}>
                            {status.label}
                          </span>
                          {txn.error_message && (
                            <p className="text-red-400 text-xs mt-1 truncate max-w-32" title={txn.error_message}>
                              {txn.error_message.slice(0, 30)}...
                            </p>
                          )}
                        </td>
                        <td className="p-3">
                          <p className="text-slate-600 text-xs">{formatDate(txn.created_at)}</p>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {!txn.prc_refunded && txn.status !== 'refunded' && (
                              <Button size="sm" onClick={() => { setSelectedTxn(txn); setRefundAmount(txn.prc_amount || txn.total_prc || ''); setShowRefundModal(true); }}
                                className="bg-green-600 hover:bg-green-700 text-xs px-2 py-1 h-7">
                                <Wallet className="h-3 w-3 mr-1" /> Refund
                              </Button>
                            )}
                            {txn.status === 'failed' && !txn.prc_refunded && (
                              <Button size="sm" onClick={() => handleRetry(txn)} variant="outline"
                                className="border-blue-500/50 text-blue-400 text-xs px-2 py-1 h-7">
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            )}
                            {!txn.prc_refunded && txn.status !== 'resolved' && (
                              <Button size="sm" onClick={() => handleMarkResolved(txn)} variant="outline"
                                className="border-gray-600 text-xs px-2 py-1 h-7">
                                <Check className="h-3 w-3" />
                              </Button>
                            )}
                            <Button size="sm" onClick={() => { setSelectedTxn(txn); setShowDetailModal(true); }} variant="ghost"
                              className="text-slate-500 text-xs px-2 py-1 h-7">
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div className="flex justify-center items-center gap-4 p-4 border-t border-slate-200">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="border-slate-200">
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <span className="text-slate-500 text-sm">Page {page} of {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                className="border-slate-200">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* Refund Modal */}
      <Modal show={showRefundModal} onClose={() => { setShowRefundModal(false); setSelectedTxn(null); }} title="Manual Refund" size="md">
        {selectedTxn && (
          <div className="space-y-4">
            <div className="p-3 bg-white rounded-lg">
              <p className="text-slate-500 text-sm">User</p>
              <p className="text-slate-800 font-medium">{selectedTxn.user?.name || 'Unknown'}</p>
              <p className="text-slate-500 text-xs">{selectedTxn.user?.email}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-lg">
                <p className="text-slate-500 text-xs">Service</p>
                <p className="text-slate-800 capitalize">{selectedTxn.service_type}</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-slate-500 text-xs">Original Amount</p>
                <p className="text-amber-400 font-bold">{(selectedTxn.prc_amount || selectedTxn.total_prc || 0).toFixed(2)} PRC</p>
              </div>
            </div>
            
            {selectedTxn.error_message && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{selectedTxn.error_message}</p>
              </div>
            )}
            
            <div>
              <label className="text-slate-500 text-sm">Refund Amount (PRC)</label>
              <Input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="Enter amount" className="mt-1 bg-white border-slate-200" />
            </div>
            
            <div>
              <label className="text-slate-500 text-sm">Reason</label>
              <Input value={refundReason} onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Reason for refund" className="mt-1 bg-white border-slate-200" />
            </div>
            
            <div className="flex gap-3">
              <Button onClick={() => setShowRefundModal(false)} variant="outline" className="flex-1 border-gray-600">
                Cancel
              </Button>
              <Button onClick={handleRefund} disabled={actionLoading} className="flex-1 bg-green-600 hover:bg-green-700">
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Refund'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal show={showDetailModal} onClose={() => { setShowDetailModal(false); setSelectedTxn(null); }} title="Transaction Details" size="lg">
        {selectedTxn && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-lg">
                <p className="text-slate-500 text-xs">Request ID</p>
                <p className="text-slate-800 font-mono text-sm">{selectedTxn.request_id}</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-slate-500 text-xs">Status</p>
                <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(selectedTxn.status, selectedTxn.prc_refunded).bg} ${getStatusBadge(selectedTxn.status, selectedTxn.prc_refunded).text}`}>
                  {getStatusBadge(selectedTxn.status, selectedTxn.prc_refunded).label}
                </span>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-slate-500 text-xs">Service Type</p>
                <p className="text-slate-800 capitalize">{selectedTxn.service_type}</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-slate-500 text-xs">Consumer Number</p>
                <p className="text-slate-800">{selectedTxn.consumer_number || selectedTxn.number || 'N/A'}</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-slate-500 text-xs">PRC Amount</p>
                <p className="text-amber-400 font-bold">{(selectedTxn.prc_amount || selectedTxn.total_prc || 0).toFixed(2)} PRC</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-slate-500 text-xs">INR Amount</p>
                <p className="text-slate-800">₹{selectedTxn.amount_inr || selectedTxn.amount || 0}</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-slate-500 text-xs">Created At</p>
                <p className="text-slate-800 text-sm">{formatDate(selectedTxn.created_at)}</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-slate-500 text-xs">Operator</p>
                <p className="text-slate-800">{selectedTxn.operator || selectedTxn.operator_name || 'N/A'}</p>
              </div>
            </div>
            
            {selectedTxn.error_message && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-slate-500 text-xs mb-1">Error Message</p>
                <p className="text-red-400">{selectedTxn.error_message}</p>
              </div>
            )}
            
            {selectedTxn.prc_refunded && (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-400 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Refunded: {selectedTxn.refund_amount} PRC
                  {selectedTxn.refunded_at && ` on ${formatDate(selectedTxn.refunded_at)}`}
                </p>
              </div>
            )}
            
            {/* User Info */}
            <div className="p-3 bg-white rounded-lg">
              <p className="text-slate-500 text-xs mb-2">User Details</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
                  {selectedTxn.user?.name?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="text-slate-800 font-medium">{selectedTxn.user?.name || 'Unknown'}</p>
                  <p className="text-slate-500 text-xs">{selectedTxn.user?.email}</p>
                  <p className="text-slate-500 text-xs">Balance: {(selectedTxn.user?.prc_balance || 0).toFixed(2)} PRC</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminFailedTransactions;
