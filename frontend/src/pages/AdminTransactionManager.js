import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Search, Pencil, Trash2, RotateCcw, ArrowUpRight, ArrowDownLeft,
  ChevronLeft, ChevronRight, Loader2, X, Check, AlertTriangle,
  Filter, RefreshCw, FileText, Eye, Undo2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TYPE_COLORS = {
  'Reward': 'bg-emerald-100 text-emerald-700',
  'Recharge': 'bg-blue-100 text-blue-700',
  'Bill Pay': 'bg-violet-100 text-violet-700',
  'Voucher Redeem': 'bg-orange-100 text-orange-700',
  'Bank Redeem': 'bg-cyan-100 text-cyan-700',
  'Refund': 'bg-lime-100 text-lime-700',
  'Burn': 'bg-red-100 text-red-700',
  'Admin Credit': 'bg-amber-100 text-amber-700',
  'Admin Debit': 'bg-rose-100 text-rose-700',
  'Admin': 'bg-amber-100 text-amber-700',
  'Subscription': 'bg-purple-100 text-purple-700',
  'Redeem': 'bg-teal-100 text-teal-700',
  'Other': 'bg-slate-100 text-slate-700',
};

const FILTER_TYPES = ['all', 'mining_collect', 'burn', 'prc_burn', 'bank_withdrawal_request', 'subscription_prc', 'admin_refund', 'admin_credit', 'admin_debit', 'daily_streak', 'achievement', 'gift_subscription', 'dmt_refund'];

// ========== MODAL ==========
const Modal = ({ show, onClose, title, children }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" data-testid="txn-modal-overlay">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default function AdminTransactionManager({ user }) {
  const [searchUid, setSearchUid] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [editModal, setEditModal] = useState(false);
  const [refundModal, setRefundModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [editForm, setEditForm] = useState({ description: '', amount: '', reason: '' });
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const token = user?.token || localStorage.getItem('token');

  const headers = { Authorization: `Bearer ${token}` };

  const fetchTransactions = useCallback(async (page = 1) => {
    if (!searchUid.trim()) return toast.error('User ID / UID enter kara');
    setLoading(true);
    try {
      const params = { page, limit: 20, txn_type: filterType };
      const { data } = await axios.get(`${API}/admin/transactions/${searchUid.trim()}`, { headers, params });
      setTransactions(data.transactions || []);
      setPagination(data.pagination || { page: 1, total: 0, total_pages: 1 });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, [searchUid, filterType, token]);

  const handleSearch = (e) => { e.preventDefault(); fetchTransactions(1); };

  const openEdit = (txn) => {
    setSelectedTxn(txn);
    setEditForm({ description: txn.description || '', amount: txn.amount || 0, reason: '' });
    setEditModal(true);
  };

  const submitEdit = async () => {
    if (!editForm.reason.trim()) return toast.error('Reason required');
    setActionLoading(true);
    try {
      const txnId = selectedTxn._txn_id;
      await axios.put(`${API}/admin/transactions/${txnId}`, {
        description: editForm.description,
        amount: parseFloat(editForm.amount),
        admin_id: user?.uid || 'admin',
        reason: editForm.reason
      }, { headers });
      toast.success('Transaction updated');
      setEditModal(false);
      fetchTransactions(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Edit failed');
    } finally {
      setActionLoading(false);
    }
  };

  const openRefund = (txn) => { setSelectedTxn(txn); setActionReason(''); setRefundModal(true); };

  const submitRefund = async () => {
    if (!actionReason.trim()) return toast.error('Reason required');
    setActionLoading(true);
    try {
      const txnId = selectedTxn._txn_id;
      const { data } = await axios.post(`${API}/admin/transactions/${txnId}/refund`, {
        admin_id: user?.uid || 'admin',
        reason: actionReason
      }, { headers });
      toast.success(`${data.refund_amount} PRC refunded`);
      setRefundModal(false);
      fetchTransactions(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Refund failed');
    } finally {
      setActionLoading(false);
    }
  };

  const openDelete = (txn) => { setSelectedTxn(txn); setActionReason(''); setDeleteModal(true); };

  const submitDelete = async () => {
    if (!actionReason.trim()) return toast.error('Reason required');
    setActionLoading(true);
    try {
      const txnId = selectedTxn._txn_id;
      await axios.delete(`${API}/admin/transactions/${txnId}`, {
        headers,
        data: { admin_id: user?.uid || 'admin', reason: actionReason }
      });
      toast.success('Transaction deleted');
      setDeleteModal(false);
      fetchTransactions(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (txn) => {
    try {
      await axios.post(`${API}/admin/transactions/${txn._txn_id}/restore?admin_id=${user?.uid || 'admin'}`, {}, { headers });
      toast.success('Transaction restored');
      fetchTransactions(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Restore failed');
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch { return d; }
  };

  return (
    <div className="space-y-6" data-testid="admin-transaction-manager">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Transaction Manager</h1>
        <p className="text-sm text-slate-500 mt-1">Search, view, edit, delete & refund user transactions</p>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              value={searchUid}
              onChange={(e) => setSearchUid(e.target.value)}
              placeholder="Enter User UID..."
              className="h-11"
              data-testid="txn-search-input"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-11 px-3 rounded-lg border border-slate-200 text-sm bg-white"
            data-testid="txn-filter-select"
          >
            {FILTER_TYPES.map(t => (
              <option key={t} value={t}>{t === 'all' ? 'All Types' : t.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <Button type="submit" disabled={loading} className="h-11 px-6 bg-slate-800 hover:bg-slate-700" data-testid="txn-search-btn">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Search
          </Button>
        </form>
      </Card>

      {/* Results */}
      {transactions.length > 0 && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">
              {pagination.total} transactions found
            </span>
            <Button variant="ghost" size="sm" onClick={() => fetchTransactions(pagination.page)} data-testid="txn-refresh-btn">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="txn-table">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((txn, i) => {
                  const amt = txn.amount || 0;
                  const isCredit = amt > 0;
                  const isDeleted = txn.deleted;
                  const isRefunded = txn.refunded;

                  return (
                    <tr key={i} className={`hover:bg-slate-50/50 transition-colors ${isDeleted ? 'opacity-40 line-through' : ''}`} data-testid={`txn-row-${i}`}>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{formatDate(txn.created_at || txn.timestamp)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[txn.type] || TYPE_COLORS['Other']}`}>
                          {txn.type || 'Other'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-[250px] truncate" title={txn.description}>{txn.description || '-'}</td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold whitespace-nowrap ${isCredit ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isCredit ? '+' : ''}{amt.toFixed(2)} PRC
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded">{txn._source_collection}</span>
                      </td>
                      <td className="px-4 py-3">
                        {isDeleted && <span className="text-xs text-red-500 font-medium">Deleted</span>}
                        {isRefunded && <span className="text-xs text-amber-500 font-medium">Refunded</span>}
                        {!isDeleted && !isRefunded && <span className="text-xs text-emerald-500 font-medium">Active</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setSelectedTxn(txn); setDetailModal(true); }} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500" title="View" data-testid={`txn-view-${i}`}>
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {!isDeleted && (
                            <>
                              <button onClick={() => openEdit(txn)} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500" title="Edit" data-testid={`txn-edit-${i}`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              {!isCredit && !isRefunded && (
                                <button onClick={() => openRefund(txn)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500" title="Refund" data-testid={`txn-refund-${i}`}>
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button onClick={() => openDelete(txn)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Delete" data-testid={`txn-delete-${i}`}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          {isDeleted && (
                            <button onClick={() => handleRestore(txn)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-500" title="Restore" data-testid={`txn-restore-${i}`}>
                              <Undo2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between" data-testid="txn-pagination">
              <span className="text-xs text-slate-500">Page {pagination.page} of {pagination.total_pages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchTransactions(pagination.page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.total_pages} onClick={() => fetchTransactions(pagination.page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {!loading && transactions.length === 0 && searchUid && (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No transactions found</p>
        </Card>
      )}

      {/* Detail Modal */}
      <Modal show={detailModal} onClose={() => setDetailModal(false)} title="Transaction Details">
        {selectedTxn && (
          <div className="space-y-3 text-sm" data-testid="txn-detail-modal">
            {Object.entries(selectedTxn).filter(([k]) => !k.startsWith('_') && k !== 'edit_history').map(([k, v]) => (
              <div key={k} className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">{k}</span>
                <span className="text-slate-800 text-right max-w-[250px] truncate">{typeof v === 'object' ? JSON.stringify(v) : String(v ?? '-')}</span>
              </div>
            ))}
            {selectedTxn.edit_history?.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-bold text-slate-700 mb-2">Edit History</h4>
                {selectedTxn.edit_history.map((h, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-3 mb-2 text-xs">
                    <p className="text-slate-600">By: {h.edited_by} | {h.edited_at}</p>
                    <p className="text-slate-500">Reason: {h.reason}</p>
                    <p className="text-slate-400">Old: {JSON.stringify(h.old_values)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal show={editModal} onClose={() => setEditModal(false)} title="Edit Transaction">
        <div className="space-y-4" data-testid="txn-edit-modal">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Description</label>
            <Input value={editForm.description} onChange={(e) => setEditForm(f => ({...f, description: e.target.value}))} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Amount (PRC)</label>
            <Input type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm(f => ({...f, amount: e.target.value}))} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Reason *</label>
            <Input value={editForm.reason} onChange={(e) => setEditForm(f => ({...f, reason: e.target.value}))} placeholder="Why are you editing this?" data-testid="edit-reason-input" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditModal(false)}>Cancel</Button>
            <Button className="flex-1 bg-amber-600 hover:bg-amber-500" onClick={submitEdit} disabled={actionLoading} data-testid="edit-submit-btn">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Pencil className="h-4 w-4 mr-2" /> Save</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Refund Modal */}
      <Modal show={refundModal} onClose={() => setRefundModal(false)} title="Refund Transaction">
        {selectedTxn && (
          <div className="space-y-4" data-testid="txn-refund-modal">
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
              <p className="text-sm text-emerald-700">Refund Amount: <span className="font-bold">{Math.abs(selectedTxn.amount || 0).toFixed(2)} PRC</span></p>
              <p className="text-xs text-emerald-600 mt-1">{selectedTxn.description}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Reason *</label>
              <Input value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder="Refund reason..." data-testid="refund-reason-input" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setRefundModal(false)}>Cancel</Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500" onClick={submitRefund} disabled={actionLoading} data-testid="refund-submit-btn">
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RotateCcw className="h-4 w-4 mr-2" /> Refund</>}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Modal */}
      <Modal show={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Transaction">
        {selectedTxn && (
          <div className="space-y-4" data-testid="txn-delete-modal">
            <div className="bg-red-50 rounded-xl p-4 border border-red-200">
              <div className="flex items-center gap-2 text-red-700 mb-2">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Soft Delete</span>
              </div>
              <p className="text-sm text-red-600">Transaction wallet madhun hide hoil pan DB madhun delete honar nahi. Admin restore karu shakto.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Reason *</label>
              <Input value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder="Delete reason..." data-testid="delete-reason-input" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteModal(false)}>Cancel</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-500 text-white" onClick={submitDelete} disabled={actionLoading} data-testid="delete-submit-btn">
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4 mr-2" /> Delete</>}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
