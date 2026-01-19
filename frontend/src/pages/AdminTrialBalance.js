import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scale, RefreshCw, CheckCircle2, AlertTriangle, Download,
  ChevronDown, ChevronRight, Folder, FileText, IndianRupee,
  BarChart3, List, Building2, Wallet, TrendingUp, TrendingDown
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminTrialBalance = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('trial_balance'); // trial_balance, chart_of_accounts
  const [loading, setLoading] = useState(true);
  const [trialBalance, setTrialBalance] = useState(null);
  const [chartOfAccounts, setChartOfAccounts] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({
    assets: true,
    liabilities: true,
    equity: true,
    income: true,
    expenses: true
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [trialRes, chartRes] = await Promise.all([
        axios.get(`${API}/api/admin/accounting/trial-balance`),
        axios.get(`${API}/api/admin/accounting/chart-of-accounts`)
      ]);
      setTrialBalance(trialRes.data);
      setChartOfAccounts(chartRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load accounting data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'assets': return Building2;
      case 'liabilities': return Scale;
      case 'equity': return Wallet;
      case 'income': return TrendingUp;
      case 'expenses': return TrendingDown;
      default: return Folder;
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'assets': return 'text-blue-600 bg-blue-500/100/10';
      case 'liabilities': return 'text-red-600 bg-red-500/100/10';
      case 'equity': return 'text-purple-600 bg-purple-500/100/10';
      case 'income': return 'text-green-600 bg-green-500/100/10';
      case 'expenses': return 'text-orange-600 bg-orange-500/100/10';
      default: return 'text-gray-600 bg-gray-800/50';
    }
  };

  if (loading && !trialBalance) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="trial-balance-loading">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-800/50 p-4 md:p-6" data-testid="admin-trial-balance">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Scale className="h-7 w-7 text-indigo-600" />
            Trial Balance & Chart of Accounts
          </h1>
          <p className="text-sm text-gray-500 mt-1">Verify accounting accuracy and view account structure</p>
        </div>
        <Button variant="outline" onClick={fetchData} size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        {[
          { id: 'trial_balance', label: 'Trial Balance', icon: Scale },
          { id: 'chart_of_accounts', label: 'Chart of Accounts', icon: List }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
            data-testid={`tab-${tab.id}`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Trial Balance Tab */}
        {activeTab === 'trial_balance' && trialBalance && (
          <motion.div
            key="trial_balance"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Balance Status */}
            <Card className={`p-4 ${trialBalance.totals?.is_balanced ? 'bg-green-500/100/10 border-green-500/30' : 'bg-red-500/100/10 border-red-500/30'}`}>
              <div className="flex items-center gap-3">
                {trialBalance.totals?.is_balanced ? (
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                ) : (
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                )}
                <div>
                  <p className={`text-lg font-bold ${trialBalance.totals?.is_balanced ? 'text-green-400' : 'text-red-400'}`}>
                    {trialBalance.status}
                  </p>
                  <p className="text-sm text-gray-600">
                    As of {trialBalance.as_of_date}
                  </p>
                </div>
              </div>
            </Card>

            {/* Totals Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-5 bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                <p className="text-blue-100 text-sm font-medium">Total Debits</p>
                <h2 className="text-2xl font-bold mt-1">{formatCurrency(trialBalance.totals?.total_debit)}</h2>
              </Card>
              <Card className="p-5 bg-gradient-to-br from-purple-500 to-pink-600 text-white">
                <p className="text-purple-100 text-sm font-medium">Total Credits</p>
                <h2 className="text-2xl font-bold mt-1">{formatCurrency(trialBalance.totals?.total_credit)}</h2>
              </Card>
              <Card className={`p-5 ${trialBalance.totals?.is_balanced ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-rose-600'} text-white`}>
                <p className="text-white/80 text-sm font-medium">Difference</p>
                <h2 className="text-2xl font-bold mt-1">{formatCurrency(Math.abs(trialBalance.totals?.difference))}</h2>
              </Card>
            </div>

            {/* Trial Balance Table */}
            <Card className="overflow-hidden">
              <div className="p-4 bg-indigo-500/100/10 border-b">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                  Trial Balance Statement
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Account Name</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Debit (₹)</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Credit (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {!trialBalance?.accounts?.length ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                          No accounts with balances
                        </td>
                      </tr>
                    ) : (
                      trialBalance.accounts.map((account, idx) => (
                        <tr key={idx} className="hover:bg-gray-800/50">
                          <td className="px-4 py-3 text-sm font-mono text-gray-500">{account.code}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{account.name}</td>
                          <td className="px-4 py-3 text-right font-mono text-sm">
                            {account.debit > 0 ? (
                              <span className="text-blue-600">{formatCurrency(account.debit)}</span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm">
                            {account.credit > 0 ? (
                              <span className="text-purple-600">{formatCurrency(account.credit)}</span>
                            ) : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-gray-700 font-bold">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-sm">TOTAL</td>
                      <td className="px-4 py-3 text-right text-sm text-blue-600">
                        {formatCurrency(trialBalance.totals?.total_debit)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-purple-600">
                        {formatCurrency(trialBalance.totals?.total_credit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            {/* Help Box */}
            <Card className="p-4 bg-indigo-500/100/10 border-indigo-500/30">
              <div className="flex gap-3">
                <Scale className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-indigo-400">
                  <p className="font-medium mb-1">What is Trial Balance?</p>
                  <p>Trial Balance ensures that total debits equal total credits. If there's a difference, check for missing entries or incorrect amounts in your books.</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Chart of Accounts Tab */}
        {activeTab === 'chart_of_accounts' && chartOfAccounts && (
          <motion.div
            key="chart_of_accounts"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Summary */}
            <Card className="p-4 bg-gray-800/50">
              <p className="text-sm text-gray-600">
                Total Accounts: <span className="font-bold">{chartOfAccounts.total_accounts}</span>
              </p>
            </Card>

            {/* Account Categories */}
            {Object.entries(chartOfAccounts.chart_of_accounts || {}).map(([category, data]) => {
              const Icon = getCategoryIcon(category);
              const colorClass = getCategoryColor(category);
              
              return (
                <Card key={category} className="overflow-hidden">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className={`w-full p-4 flex items-center justify-between ${colorClass.split(' ')[1]} hover:opacity-90 transition-opacity`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900">{data.name}</h3>
                        <p className="text-xs text-gray-500">Code: {data.code} | {data.accounts.length} accounts</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-bold ${colorClass.split(' ')[0]}`}>
                        {formatCurrency(data.total)}
                      </span>
                      {expandedCategories[category] ? (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Accounts List */}
                  <AnimatePresence>
                    {expandedCategories[category] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <table className="w-full">
                          <thead className="bg-gray-800/50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Code</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Account Name</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Type</th>
                              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">Normal Balance</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {data.accounts.map((account, idx) => (
                              <tr key={idx} className="hover:bg-gray-800/50">
                                <td className="px-4 py-2 text-sm font-mono text-gray-500">{account.code}</td>
                                <td className="px-4 py-2 text-sm font-medium text-gray-900">{account.name}</td>
                                <td className="px-4 py-2">
                                  <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-600 capitalize">
                                    {account.type.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-center">
                                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                                    account.normal_balance === 'debit' 
                                      ? 'bg-blue-500/100/20 text-blue-400' 
                                      : 'bg-purple-500/100/20 text-purple-400'
                                  }`}>
                                    {account.normal_balance.toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-sm">
                                  {account.balance > 0 ? formatCurrency(account.balance) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              );
            })}

            {/* Help Box */}
            <Card className="p-4 bg-blue-500/100/10 border-blue-500/30">
              <div className="flex gap-3">
                <List className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-400">
                  <p className="font-medium mb-1">Understanding Chart of Accounts</p>
                  <p>The Chart of Accounts organizes all financial accounts into categories. <strong>Debit</strong> accounts (Assets, Expenses) increase with debits. <strong>Credit</strong> accounts (Liabilities, Equity, Income) increase with credits.</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminTrialBalance;
