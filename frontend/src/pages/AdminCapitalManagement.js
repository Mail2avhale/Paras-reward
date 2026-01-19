import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Landmark, Plus, RefreshCw, TrendingUp, TrendingDown,
  Wallet, ArrowUpRight, ArrowDownRight, X, Calendar,
  FileText, IndianRupee, PiggyBank, CircleDollarSign
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminCapitalManagement = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [capitalData, setCapitalData] = useState(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryForm, setEntryForm] = useState({
    entry_type: 'opening_capital',
    amount: '',
    description: '',
    reference_no: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchCapitalData();
  }, [user, navigate]);

  const fetchCapitalData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/api/admin/accounting/capital`);
      setCapitalData(response.data);
    } catch (error) {
      console.error('Error fetching capital data:', error);
      toast.error('Failed to load capital data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async () => {
    if (!entryForm.amount || parseFloat(entryForm.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      await axios.post(`${API}/api/admin/accounting/capital/entry`, null, {
        params: {
          entry_type: entryForm.entry_type,
          amount: parseFloat(entryForm.amount),
          description: entryForm.description,
          reference_no: entryForm.reference_no,
          date: entryForm.date,
          admin_id: user.uid
        }
      });

      toast.success('Capital entry added successfully!');
      setShowEntryModal(false);
      setEntryForm({
        entry_type: 'opening_capital',
        amount: '',
        description: '',
        reference_no: '',
        date: new Date().toISOString().split('T')[0]
      });
      fetchCapitalData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add entry');
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

  const getEntryTypeLabel = (type) => {
    switch (type) {
      case 'opening_capital': return 'Opening Capital';
      case 'additional_capital': return 'Additional Capital';
      case 'drawings': return 'Drawings';
      default: return type;
    }
  };

  const getEntryTypeColor = (type) => {
    switch (type) {
      case 'opening_capital': return 'bg-green-500/20 text-green-400';
      case 'additional_capital': return 'bg-blue-500/20 text-blue-400';
      case 'drawings': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-700 text-gray-300';
    }
  };

  if (loading && !capitalData) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="capital-loading">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-800/50 p-4 md:p-6" data-testid="admin-capital-management">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Landmark className="h-7 w-7 text-emerald-600" />
            Capital & Owner's Equity
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage capital investments, additional capital, and owner's drawings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCapitalData} size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={() => setShowEntryModal(true)} 
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            data-testid="add-capital-entry-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Opening Capital */}
        <Card className="p-5 bg-gradient-to-br from-emerald-500 to-green-600 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-emerald-100 text-sm font-medium">Opening Capital</p>
              <h2 className="text-2xl font-bold mt-1">{formatCurrency(capitalData?.opening_capital)}</h2>
              <p className="text-emerald-200 text-xs mt-1">Initial investment</p>
            </div>
            <div className="bg-white/20 p-2 rounded-lg">
              <PiggyBank className="h-6 w-6" />
            </div>
          </div>
        </Card>

        {/* Additional Capital */}
        <Card className="p-5 bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Additional Capital</p>
              <h2 className="text-2xl font-bold mt-1">{formatCurrency(capitalData?.additional_capital)}</h2>
              <p className="text-blue-200 text-xs mt-1">Further investments</p>
            </div>
            <div className="bg-white/20 p-2 rounded-lg">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </Card>

        {/* Drawings */}
        <Card className="p-5 bg-gradient-to-br from-red-500 to-rose-600 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">Owner's Drawings</p>
              <h2 className="text-2xl font-bold mt-1">{formatCurrency(capitalData?.drawings)}</h2>
              <p className="text-red-200 text-xs mt-1">Withdrawn amount</p>
            </div>
            <div className="bg-white/20 p-2 rounded-lg">
              <TrendingDown className="h-6 w-6" />
            </div>
          </div>
        </Card>

        {/* Total Equity */}
        <Card className="p-5 bg-gradient-to-br from-purple-500 to-violet-600 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Total Equity</p>
              <h2 className="text-2xl font-bold mt-1">{formatCurrency(capitalData?.total_equity)}</h2>
              <p className="text-purple-200 text-xs mt-1">Net owner's equity</p>
            </div>
            <div className="bg-white/20 p-2 rounded-lg">
              <CircleDollarSign className="h-6 w-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Equity Calculation Card */}
      <Card className="p-5 mb-6 bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-dashed border-gray-300">
        <h3 className="font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-600" />
          Equity Calculation
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <p className="text-xs text-gray-500">Opening Capital</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(capitalData?.opening_capital)}</p>
          </div>
          <div className="p-3 bg-white rounded-lg shadow-sm flex items-center justify-center">
            <span className="text-2xl text-gray-400">+</span>
          </div>
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <p className="text-xs text-gray-500">Additional Capital</p>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(capitalData?.additional_capital)}</p>
          </div>
          <div className="p-3 bg-white rounded-lg shadow-sm flex items-center justify-center">
            <span className="text-2xl text-gray-400">−</span>
          </div>
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <p className="text-xs text-gray-500">Drawings</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(capitalData?.drawings)}</p>
          </div>
        </div>
        <div className="mt-4 p-3 bg-purple-500/20 rounded-lg text-center">
          <p className="text-sm text-purple-600">+ Retained Earnings: {formatCurrency(capitalData?.retained_earnings)}</p>
          <p className="text-lg font-bold text-purple-400 mt-1">= Total Equity: {formatCurrency(capitalData?.total_equity)}</p>
        </div>
      </Card>

      {/* Entries Table */}
      <Card className="overflow-hidden">
        <div className="p-4 bg-emerald-500/10 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-600" />
            Capital Entries History
          </h3>
          <span className="text-sm text-gray-500">
            {capitalData?.entries_count || 0} entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Reference</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {!capitalData?.entries?.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <PiggyBank className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No capital entries yet</p>
                    <p className="text-sm text-gray-400 mt-1">Add your opening capital to balance the books</p>
                  </td>
                </tr>
              ) : (
                capitalData.entries.map((entry, idx) => (
                  <tr key={entry.entry_id || idx} className="hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(entry.date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getEntryTypeColor(entry.entry_type)}`}>
                        {getEntryTypeLabel(entry.entry_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {entry.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {entry.reference_no || '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${entry.entry_type === 'drawings' ? 'text-red-600' : 'text-green-600'}`}>
                        {entry.entry_type === 'drawings' ? '-' : '+'}{formatCurrency(entry.amount)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Entry Modal */}
      <AnimatePresence>
        {showEntryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowEntryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-emerald-600" />
                  Add Capital Entry
                </h3>
                <button onClick={() => setShowEntryModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Entry Type */}
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">Entry Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'opening_capital', label: 'Opening Capital', icon: PiggyBank, color: 'emerald' },
                      { id: 'additional_capital', label: 'Additional', icon: TrendingUp, color: 'blue' },
                      { id: 'drawings', label: 'Drawings', icon: TrendingDown, color: 'red' }
                    ].map(type => (
                      <button
                        key={type.id}
                        onClick={() => setEntryForm({ ...entryForm, entry_type: type.id })}
                        className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${
                          entryForm.entry_type === type.id
                            ? `border-${type.color}-500 bg-${type.color}-50`
                            : 'border-gray-700 hover:border-gray-300'
                        }`}
                        data-testid={`entry-type-${type.id}`}
                      >
                        <type.icon className={`h-5 w-5 ${entryForm.entry_type === type.id ? `text-${type.color}-600` : 'text-gray-400'}`} />
                        <span className={`text-xs font-medium ${entryForm.entry_type === type.id ? `text-${type.color}-700` : 'text-gray-600'}`}>
                          {type.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-1 block">Amount (₹)</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="number"
                      value={entryForm.amount}
                      onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border rounded-lg text-lg font-semibold"
                      placeholder="Enter amount"
                      data-testid="capital-amount"
                    />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-1 block">Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="date"
                      value={entryForm.date}
                      onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-1 block">Description</label>
                  <input
                    type="text"
                    value={entryForm.description}
                    onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder={
                      entryForm.entry_type === 'opening_capital' ? 'e.g., Initial business capital' :
                      entryForm.entry_type === 'additional_capital' ? 'e.g., Additional investment by owner' :
                      'e.g., Owner withdrawal for personal use'
                    }
                  />
                </div>

                {/* Reference No */}
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-1 block">Reference No (Optional)</label>
                  <input
                    type="text"
                    value={entryForm.reference_no}
                    onChange={(e) => setEntryForm({ ...entryForm, reference_no: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="e.g., Bank transfer reference"
                  />
                </div>
              </div>

              <div className="p-6 border-t flex gap-3">
                <Button variant="outline" onClick={() => setShowEntryModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddEntry} 
                  className={`flex-1 ${entryForm.entry_type === 'drawings' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                  data-testid="submit-capital-entry"
                >
                  {entryForm.entry_type === 'drawings' ? (
                    <>
                      <ArrowDownRight className="h-4 w-4 mr-2" />
                      Record Drawings
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="h-4 w-4 mr-2" />
                      Add Capital
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminCapitalManagement;
