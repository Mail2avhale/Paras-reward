import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Building2, RefreshCw, Plus, X, Check, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Calendar, Search, Filter,
  IndianRupee, Clock, CheckCircle2, XCircle, ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminAccountsReceivable = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    customer_name: '',
    customer_id: '',
    description: '',
    amount: '',
    due_date: '',
    category: 'vip_fee'
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate, filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/api/admin/accounting/receivables`, {
        params: { status: filter }
      });
      setData(response.data);
    } catch (error) {
      console.error('Error fetching AR:', error);
      toast.error('Failed to load receivables');
    } finally {
      setLoading(false);
    }
  };

  const handleAddReceivable = async () => {
    if (!form.customer_name || !form.amount) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      await axios.post(`${API}/api/admin/accounting/receivables`, null, {
        params: {
          customer_name: form.customer_name,
          customer_id: form.customer_id,
          description: form.description,
          amount: parseFloat(form.amount),
          due_date: form.due_date || undefined,
          category: form.category,
          admin_id: user.uid
        }
      });
      toast.success('Receivable created!');
      setShowAddModal(false);
      setForm({ customer_name: '', customer_id: '', description: '', amount: '', due_date: '', category: 'vip_fee' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create receivable');
    }
  };

  const handleMarkPaid = async (invoiceId) => {
    try {
      await axios.put(`${API}/api/admin/accounting/receivables/${invoiceId}/status`, null, {
        params: { status: 'paid', admin_id: user.uid }
      });
      toast.success('Marked as paid!');
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const summary = data?.summary || {};

  return (
    <div className="min-h-screen bg-gray-800/50 p-4 md:p-6" data-testid="admin-ar">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowDownRight className="h-7 w-7 text-green-600" />
            Accounts Receivable (AR)
          </h1>
          <p className="text-sm text-gray-500 mt-1">येणे बाकी - Money owed TO your business</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowAddModal(true)} size="sm" className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-5 bg-gradient-to-br from-amber-500 to-orange-600 text-white">
          <p className="text-amber-100 text-sm">Pending</p>
          <h2 className="text-2xl font-bold mt-1">{formatCurrency(summary.total_pending)}</h2>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-red-500 to-rose-600 text-white">
          <p className="text-red-100 text-sm">Overdue</p>
          <h2 className="text-2xl font-bold mt-1">{formatCurrency(summary.total_overdue)}</h2>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-green-500 to-emerald-600 text-white">
          <p className="text-green-100 text-sm">Collected</p>
          <h2 className="text-2xl font-bold mt-1">{formatCurrency(summary.total_collected)}</h2>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <p className="text-blue-100 text-sm">Total Outstanding</p>
          <h2 className="text-2xl font-bold mt-1">{formatCurrency(summary.total_outstanding)}</h2>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['all', 'pending', 'overdue', 'paid'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === f ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Description</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Due Date</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {!data?.receivables?.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    No receivables found
                  </td>
                </tr>
              ) : (
                data.receivables.map((item) => (
                  <tr key={item.invoice_id} className="hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">{item.invoice_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.customer_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.description || '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(item.amount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(item.due_date)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        item.status === 'paid' ? 'bg-green-100 text-green-700' :
                        item.status === 'overdue' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.status !== 'paid' && (
                        <Button size="sm" variant="outline" onClick={() => handleMarkPaid(item.invoice_id)}>
                          <Check className="h-4 w-4 mr-1" />
                          Paid
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold">New Invoice</h3>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Customer Name *</label>
                  <input
                    type="text"
                    value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="Customer name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Amount (₹) *</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="Enter amount"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="e.g., VIP Membership Fee"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Due Date</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="vip_fee">VIP Membership Fee</option>
                    <option value="ads_income">Ads Income</option>
                    <option value="service_charge">Service Charge</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="p-6 border-t flex gap-3">
                <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleAddReceivable} className="flex-1 bg-green-600 hover:bg-green-700">
                  Create Invoice
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminAccountsReceivable;
