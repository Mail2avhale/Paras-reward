import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Building2, ArrowUpRight, ArrowDownRight, ArrowLeftRight,
  Plus, RefreshCw, Download, Calendar, Search, Filter,
  ChevronLeft, ChevronRight, X, Check, IndianRupee, TrendingUp,
  TrendingDown, Banknote, CreditCard, Receipt, Users, ShoppingCart,
  Home, Zap, FileText, Settings, Sparkles, Lightbulb
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminCashBankBook = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('summary'); // summary, cash, bank
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [cashBook, setCashBook] = useState({ entries: [], current_balance: 0 });
  const [bankBook, setBankBook] = useState({ entries: [], current_balance: 0 });
  
  // Modal states
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showOpeningBalanceModal, setShowOpeningBalanceModal] = useState(false);
  
  // Auto-categorization state
  const [autoSuggestion, setAutoSuggestion] = useState(null);
  const [isAutoSuggesting, setIsAutoSuggesting] = useState(false);
  
  // Form states
  const [entryForm, setEntryForm] = useState({
    account: 'cash',
    entry_type: 'income',
    amount: '',
    description: '',
    category: '',
    reference_no: ''
  });
  
  const [transferForm, setTransferForm] = useState({
    from_account: 'cash',
    to_account: 'bank',
    amount: '',
    description: ''
  });
  
  const [openingBalanceForm, setOpeningBalanceForm] = useState({
    account_type: 'cash',
    amount: '',
    bank_name: '',
    account_number: ''
  });

  const categories = {
    income: [
      { value: 'capital', label: 'Capital Investment', icon: Users },
      { value: 'vip_fee', label: 'VIP Membership Fee', icon: Zap },
      { value: 'ads_income', label: 'Ads Income', icon: TrendingUp },
      { value: 'other_income', label: 'Other Income', icon: IndianRupee }
    ],
    expense: [
      { value: 'rent', label: 'Rent', icon: Home },
      { value: 'salary', label: 'Salary', icon: Users },
      { value: 'purchase', label: 'Purchase', icon: ShoppingCart },
      { value: 'utilities', label: 'Utilities (Electricity, etc.)', icon: Zap },
      { value: 'maintenance', label: 'Maintenance', icon: Settings },
      { value: 'other_expense', label: 'Other Expense', icon: Receipt }
    ]
  };

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchAllData();
  }, [user, navigate]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [summaryRes, cashRes, bankRes] = await Promise.all([
        axios.get(`${API}/api/admin/accounting/summary`),
        axios.get(`${API}/api/admin/accounting/cash-book`),
        axios.get(`${API}/api/admin/accounting/bank-book`)
      ]);
      setSummary(summaryRes.data);
      setCashBook(cashRes.data);
      setBankBook(bankRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load accounting data');
    } finally {
      setLoading(false);
    }
  };

  // Auto-categorization function with debounce
  const fetchAutoSuggestion = useCallback(async (description, amount) => {
    if (!description || description.length < 3) {
      setAutoSuggestion(null);
      return;
    }
    
    setIsAutoSuggesting(true);
    try {
      const response = await axios.post(`${API}/api/admin/accounting/auto-categorize`, null, {
        params: { description, amount: parseFloat(amount) || 0 }
      });
      setAutoSuggestion(response.data);
    } catch (error) {
      console.error('Auto-categorize error:', error);
      setAutoSuggestion(null);
    } finally {
      setIsAutoSuggesting(false);
    }
  }, []);

  // Debounced auto-suggestion
  useEffect(() => {
    const timer = setTimeout(() => {
      if (entryForm.description && showEntryModal) {
        fetchAutoSuggestion(entryForm.description, entryForm.amount);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [entryForm.description, entryForm.amount, showEntryModal, fetchAutoSuggestion]);

  const applyAutoSuggestion = () => {
    if (autoSuggestion) {
      setEntryForm(prev => ({
        ...prev,
        category: autoSuggestion.suggested_category,
        entry_type: autoSuggestion.suggested_type
      }));
      toast.success(`Applied: ${autoSuggestion.suggested_category.replace('_', ' ')}`);
    }
  };

  const handleAddEntry = async () => {
    if (!entryForm.amount || !entryForm.description) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      const endpoint = entryForm.account === 'cash' 
        ? '/api/admin/accounting/cash-book/entry'
        : '/api/admin/accounting/bank-book/entry';
      
      await axios.post(`${API}${endpoint}`, {
        entry_type: entryForm.entry_type,
        amount: parseFloat(entryForm.amount),
        description: entryForm.description,
        category: entryForm.category,
        reference_no: entryForm.reference_no
      }, { params: { admin_id: user.uid } });

      toast.success('Entry added successfully!');
      setShowEntryModal(false);
      setEntryForm({ account: 'cash', entry_type: 'income', amount: '', description: '', category: '', reference_no: '' });
      setAutoSuggestion(null);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add entry');
    }
  };

  const handleTransfer = async () => {
    if (!transferForm.amount) {
      toast.error('Please enter amount');
      return;
    }

    try {
      await axios.post(`${API}/api/admin/accounting/transfer`, {
        from_account: transferForm.from_account,
        to_account: transferForm.to_account,
        amount: parseFloat(transferForm.amount),
        description: transferForm.description
      }, { params: { admin_id: user.uid } });

      toast.success('Transfer completed!');
      setShowTransferModal(false);
      setTransferForm({ from_account: 'cash', to_account: 'bank', amount: '', description: '' });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Transfer failed');
    }
  };

  const handleSetOpeningBalance = async () => {
    if (!openingBalanceForm.amount) {
      toast.error('Please enter amount');
      return;
    }

    try {
      await axios.post(`${API}/api/admin/accounting/set-opening-balance`, null, {
        params: {
          account_type: openingBalanceForm.account_type,
          amount: parseFloat(openingBalanceForm.amount),
          bank_name: openingBalanceForm.bank_name,
          account_number: openingBalanceForm.account_number
        }
      });

      toast.success('Opening balance set!');
      setShowOpeningBalanceModal(false);
      setOpeningBalanceForm({ account_type: 'cash', amount: '', bank_name: '', account_number: '' });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to set opening balance');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-800/50 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Banknote className="h-7 w-7 text-purple-600" />
            Cash & Bank Book
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage company cash and bank transactions</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={fetchAllData} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setShowOpeningBalanceModal(true)} size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Set Opening Balance
          </Button>
          <Button onClick={() => setShowTransferModal(true)} variant="outline" size="sm">
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            Transfer
          </Button>
          <Button onClick={() => setShowEntryModal(true)} size="sm" className="bg-purple-600 hover:bg-purple-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Cash Balance Card */}
        <Card className="p-5 bg-gradient-to-br from-green-500 to-emerald-600 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">💵 Cash in Hand</p>
              <h2 className="text-3xl font-bold mt-2">{formatCurrency(summary?.cash?.current_balance)}</h2>
              <div className="flex gap-4 mt-3 text-sm">
                <span className="text-green-200">
                  <ArrowUpRight className="h-4 w-4 inline" /> {formatCurrency(summary?.cash?.total_credit)}
                </span>
                <span className="text-green-200">
                  <ArrowDownRight className="h-4 w-4 inline" /> {formatCurrency(summary?.cash?.total_debit)}
                </span>
              </div>
            </div>
            <div className="bg-gray-900/20 p-3 rounded-xl">
              <Wallet className="h-8 w-8" />
            </div>
          </div>
        </Card>

        {/* Bank Balance Card */}
        <Card className="p-5 bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">🏦 Bank Balance</p>
              <h2 className="text-3xl font-bold mt-2">{formatCurrency(summary?.bank?.current_balance)}</h2>
              <p className="text-blue-200 text-xs mt-1">{summary?.bank?.bank_name || 'No bank set'}</p>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-blue-200">
                  <ArrowUpRight className="h-4 w-4 inline" /> {formatCurrency(summary?.bank?.total_credit)}
                </span>
                <span className="text-blue-200">
                  <ArrowDownRight className="h-4 w-4 inline" /> {formatCurrency(summary?.bank?.total_debit)}
                </span>
              </div>
            </div>
            <div className="bg-gray-900/20 p-3 rounded-xl">
              <Building2 className="h-8 w-8" />
            </div>
          </div>
        </Card>

        {/* Total Balance Card */}
        <Card className="p-5 bg-gradient-to-br from-purple-500 to-pink-600 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">💰 Total Balance</p>
              <h2 className="text-3xl font-bold mt-2">{formatCurrency(summary?.total_balance)}</h2>
              <p className="text-purple-200 text-sm mt-3">Cash + Bank Combined</p>
            </div>
            <div className="bg-gray-900/20 p-3 rounded-xl">
              <IndianRupee className="h-8 w-8" />
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b">
        {[
          { id: 'summary', label: 'Summary', icon: FileText },
          { id: 'cash', label: 'Cash Book', icon: Wallet },
          { id: 'bank', label: 'Bank Book', icon: Building2 }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'summary' && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Recent Cash Transactions */}
            <Card className="p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Wallet className="h-5 w-5 text-green-600" />
                Recent Cash Transactions
              </h3>
              {cashBook.entries.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No cash transactions yet</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {cashBook.entries.slice(0, 5).map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          entry.entry_type === 'expense' || entry.entry_type === 'transfer_out'
                            ? 'bg-red-500/20' : 'bg-green-500/20'
                        }`}>
                          {entry.entry_type === 'expense' || entry.entry_type === 'transfer_out' ? (
                            <ArrowDownRight className="h-4 w-4 text-red-600" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{entry.description}</p>
                          <p className="text-xs text-gray-500">{formatDate(entry.date)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${
                          entry.entry_type === 'expense' || entry.entry_type === 'transfer_out'
                            ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {entry.entry_type === 'expense' || entry.entry_type === 'transfer_out' ? '-' : '+'}
                          {formatCurrency(entry.amount)}
                        </p>
                        <p className="text-xs text-gray-500">Bal: {formatCurrency(entry.running_balance)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Recent Bank Transactions */}
            <Card className="p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Recent Bank Transactions
              </h3>
              {bankBook.entries.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No bank transactions yet</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {bankBook.entries.slice(0, 5).map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          entry.entry_type === 'expense' || entry.entry_type === 'transfer_out'
                            ? 'bg-red-500/20' : 'bg-blue-500/20'
                        }`}>
                          {entry.entry_type === 'expense' || entry.entry_type === 'transfer_out' ? (
                            <ArrowDownRight className="h-4 w-4 text-red-600" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{entry.description}</p>
                          <p className="text-xs text-gray-500">{formatDate(entry.date)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${
                          entry.entry_type === 'expense' || entry.entry_type === 'transfer_out'
                            ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {entry.entry_type === 'expense' || entry.entry_type === 'transfer_out' ? '-' : '+'}
                          {formatCurrency(entry.amount)}
                        </p>
                        <p className="text-xs text-gray-500">Bal: {formatCurrency(entry.running_balance)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {(activeTab === 'cash' || activeTab === 'bank') && (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="overflow-hidden">
              {/* Book Header */}
              <div className={`p-4 ${activeTab === 'cash' ? 'bg-green-500/10' : 'bg-blue-500/10'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">
                      {activeTab === 'cash' ? '💵 Cash Book' : '🏦 Bank Book'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Opening Balance: {formatCurrency(activeTab === 'cash' ? cashBook.opening_balance : bankBook.opening_balance)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Current Balance</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(activeTab === 'cash' ? cashBook.current_balance : bankBook.current_balance)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Entries Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Category</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Credit (+)</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Debit (-)</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(activeTab === 'cash' ? cashBook.entries : bankBook.entries).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                          No entries yet. Click "Add Entry" to get started.
                        </td>
                      </tr>
                    ) : (
                      (activeTab === 'cash' ? cashBook.entries : bankBook.entries).map((entry, idx) => (
                        <tr key={idx} className="hover:bg-gray-800/50">
                          <td className="px-4 py-3 text-sm">{formatDate(entry.date)}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{entry.description}</p>
                            {entry.reference_no && (
                              <p className="text-xs text-gray-500">Ref: {entry.reference_no}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              entry.entry_type === 'capital' ? 'bg-purple-500/20 text-purple-400' :
                              entry.entry_type === 'income' ? 'bg-green-500/20 text-green-400' :
                              entry.entry_type === 'expense' ? 'bg-red-500/20 text-red-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {entry.category || entry.entry_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-green-600">
                            {entry.entry_type === 'capital' || entry.entry_type === 'income' || entry.entry_type === 'transfer_in'
                              ? formatCurrency(entry.amount)
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-red-600">
                            {entry.entry_type === 'expense' || entry.entry_type === 'transfer_out'
                              ? formatCurrency(entry.amount)
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                            {formatCurrency(entry.running_balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Entry Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Plus className="h-5 w-5 text-purple-600" />
                  Add New Entry
                </h3>
                <button onClick={() => setShowEntryModal(false)} className="p-2 hover:bg-gray-700 rounded-full">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Account Selection */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Account</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEntryForm({...entryForm, account: 'cash'})}
                    className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                      entryForm.account === 'cash' ? 'border-green-500 bg-green-500/10' : 'border-gray-700'
                    }`}
                  >
                    <Wallet className="h-5 w-5 text-green-600" />
                    <span>Cash</span>
                  </button>
                  <button
                    onClick={() => setEntryForm({...entryForm, account: 'bank'})}
                    className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                      entryForm.account === 'bank' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700'
                    }`}
                  >
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <span>Bank</span>
                  </button>
                </div>
              </div>

              {/* Entry Type */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Entry Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEntryForm({...entryForm, entry_type: 'income', category: ''})}
                    className={`flex-1 p-3 rounded-lg border-2 ${
                      entryForm.entry_type === 'income' || entryForm.entry_type === 'capital'
                        ? 'border-green-500 bg-green-500/10' : 'border-gray-700'
                    }`}
                  >
                    <ArrowUpRight className="h-5 w-5 text-green-600 mx-auto" />
                    <span className="block text-sm mt-1">Income/Receipt</span>
                  </button>
                  <button
                    onClick={() => setEntryForm({...entryForm, entry_type: 'expense', category: ''})}
                    className={`flex-1 p-3 rounded-lg border-2 ${
                      entryForm.entry_type === 'expense' ? 'border-red-500 bg-red-500/10' : 'border-gray-700'
                    }`}
                  >
                    <ArrowDownRight className="h-5 w-5 text-red-600 mx-auto" />
                    <span className="block text-sm mt-1">Expense/Payment</span>
                  </button>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {(entryForm.entry_type === 'expense' ? categories.expense : categories.income).map(cat => (
                    <button
                      key={cat.value}
                      onClick={() => setEntryForm({...entryForm, category: cat.value, entry_type: cat.value === 'capital' ? 'capital' : entryForm.entry_type})}
                      className={`p-2 rounded-lg border text-left flex items-center gap-2 text-sm ${
                        entryForm.category === cat.value ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 hover:bg-gray-800/50'
                      }`}
                    >
                      <cat.icon className="h-4 w-4 text-gray-600" />
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Amount (₹)</label>
                <input
                  type="number"
                  value={entryForm.amount}
                  onChange={(e) => setEntryForm({...entryForm, amount: e.target.value})}
                  className="w-full px-4 py-3 border rounded-lg text-lg font-semibold"
                  placeholder="Enter amount"
                  data-testid="entry-amount"
                />
              </div>

              {/* Description with Auto-Categorization */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Description</label>
                <input
                  type="text"
                  value={entryForm.description}
                  onChange={(e) => setEntryForm({...entryForm, description: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., Director Capital Investment, Rent, Salary"
                  data-testid="entry-description"
                />
                
                {/* Auto-suggestion indicator */}
                {isAutoSuggesting && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                    <Sparkles className="h-4 w-4 animate-pulse text-amber-500" />
                    <span>Analyzing description...</span>
                  </div>
                )}
                
                {/* Auto-suggestion result */}
                {autoSuggestion && autoSuggestion.confidence > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 p-3 bg-amber-500/10 border border-amber-200 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-400">
                          Suggested: <span className="capitalize">{autoSuggestion.suggested_category?.replace('_', ' ')}</span>
                          <span className="text-amber-600 ml-1">({autoSuggestion.suggested_type})</span>
                        </span>
                      </div>
                      <button
                        onClick={applyAutoSuggestion}
                        className="text-xs px-2 py-1 bg-amber-500/100 text-white rounded hover:bg-amber-600 transition-colors"
                        data-testid="apply-suggestion-btn"
                      >
                        Apply
                      </button>
                    </div>
                    <p className="text-xs text-amber-400 mt-1">{autoSuggestion.match_reason}</p>
                  </motion.div>
                )}
              </div>

              {/* Reference No */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Reference No (Optional)</label>
                <input
                  type="text"
                  value={entryForm.reference_no}
                  onChange={(e) => setEntryForm({...entryForm, reference_no: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., Receipt/Invoice number"
                />
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowEntryModal(false)}>
                Cancel
              </Button>
              <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={handleAddEntry}>
                <Check className="h-4 w-4 mr-2" />
                Add Entry
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-2xl max-w-md w-full"
          >
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5 text-purple-600" />
                  Transfer Between Accounts
                </h3>
                <button onClick={() => setShowTransferModal(false)} className="p-2 hover:bg-gray-700 rounded-full">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-300 mb-1 block">From</label>
                  <select
                    value={transferForm.from_account}
                    onChange={(e) => setTransferForm({...transferForm, from_account: e.target.value, to_account: e.target.value === 'cash' ? 'bank' : 'cash'})}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="cash">💵 Cash</option>
                    <option value="bank">🏦 Bank</option>
                  </select>
                </div>
                <ArrowLeftRight className="h-6 w-6 text-gray-400 mt-6" />
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-300 mb-1 block">To</label>
                  <select
                    value={transferForm.to_account}
                    onChange={(e) => setTransferForm({...transferForm, to_account: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="bank" disabled={transferForm.from_account === 'bank'}>🏦 Bank</option>
                    <option value="cash" disabled={transferForm.from_account === 'cash'}>💵 Cash</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Amount (₹)</label>
                <input
                  type="number"
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm({...transferForm, amount: e.target.value})}
                  className="w-full px-4 py-3 border rounded-lg text-lg font-semibold"
                  placeholder="Enter amount"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Description (Optional)</label>
                <input
                  type="text"
                  value={transferForm.description}
                  onChange={(e) => setTransferForm({...transferForm, description: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., Deposit to bank"
                />
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowTransferModal(false)}>
                Cancel
              </Button>
              <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={handleTransfer}>
                <Check className="h-4 w-4 mr-2" />
                Transfer
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Opening Balance Modal */}
      {showOpeningBalanceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-2xl max-w-md w-full"
          >
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Settings className="h-5 w-5 text-purple-600" />
                  Set Opening Balance
                </h3>
                <button onClick={() => setShowOpeningBalanceModal(false)} className="p-2 hover:bg-gray-700 rounded-full">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Account</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOpeningBalanceForm({...openingBalanceForm, account_type: 'cash'})}
                    className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                      openingBalanceForm.account_type === 'cash' ? 'border-green-500 bg-green-500/10' : 'border-gray-700'
                    }`}
                  >
                    <Wallet className="h-5 w-5 text-green-600" />
                    <span>Cash</span>
                  </button>
                  <button
                    onClick={() => setOpeningBalanceForm({...openingBalanceForm, account_type: 'bank'})}
                    className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                      openingBalanceForm.account_type === 'bank' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700'
                    }`}
                  >
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <span>Bank</span>
                  </button>
                </div>
              </div>

              {openingBalanceForm.account_type === 'bank' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-1 block">Bank Name</label>
                    <input
                      type="text"
                      value={openingBalanceForm.bank_name}
                      onChange={(e) => setOpeningBalanceForm({...openingBalanceForm, bank_name: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg"
                      placeholder="e.g., HDFC Bank"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-1 block">Account Number</label>
                    <input
                      type="text"
                      value={openingBalanceForm.account_number}
                      onChange={(e) => setOpeningBalanceForm({...openingBalanceForm, account_number: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg"
                      placeholder="e.g., XXXX1234"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Opening Balance (₹)</label>
                <input
                  type="number"
                  value={openingBalanceForm.amount}
                  onChange={(e) => setOpeningBalanceForm({...openingBalanceForm, amount: e.target.value})}
                  className="w-full px-4 py-3 border rounded-lg text-lg font-semibold"
                  placeholder="Enter opening balance"
                />
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowOpeningBalanceModal(false)}>
                Cancel
              </Button>
              <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={handleSetOpeningBalance}>
                <Check className="h-4 w-4 mr-2" />
                Set Balance
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminCashBankBook;
