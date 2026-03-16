import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, Plus, Trash2,
  Calendar, RefreshCw, FileText, PieChart as PieIcon,
  ArrowUpRight, ArrowDownRight, Receipt, CreditCard, Building,
  Smartphone, Megaphone, Users, Wallet, AlertTriangle, CheckCircle,
  Info, ChevronRight, Loader2, Heart, Crown, Zap,
  BarChart3, Target, Clock
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#06b6d4', '#84cc16'];

const EXPENSE_CATEGORIES = [
  { value: 'server_hosting', label: 'Server/Hosting', icon: Building },
  { value: 'payment_gateway_fees', label: 'Payment Gateway Fees', icon: CreditCard },
  { value: 'sms_email_services', label: 'SMS/Email Services', icon: Smartphone },
  { value: 'marketing', label: 'Marketing', icon: Megaphone },
  { value: 'staff_salary', label: 'Staff Salary', icon: Users },
  { value: 'office_rent', label: 'Office Rent', icon: Building },
  { value: 'miscellaneous', label: 'Miscellaneous', icon: FileText }
];

const AdminProfitLoss = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [expenseForm, setExpenseForm] = useState({
    category: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });
  
  // NEW: Additional analytics state
  const [monthComparison, setMonthComparison] = useState(null);
  const [subscriptionRevenue, setSubscriptionRevenue] = useState(null);
  const [prcLiability, setPrcLiability] = useState(null);
  const [cashFlowProjection, setCashFlowProjection] = useState(null);
  const [paidWalletSummary, setPaidWalletSummary] = useState(null);

  useEffect(() => {
    fetchPLData();
    fetchExpenses();
    fetchFixedExpenses();
    fetchAnalyticsData();
  }, [period, selectedYear, selectedMonth]);
  
  const fetchAnalyticsData = async () => {
    try {
      const [monthComp, subRev, liability, cashFlow, walletSum] = await Promise.all([
        axios.get(`${API}/admin/finance/month-comparison`).catch(() => ({ data: null })),
        axios.get(`${API}/admin/finance/subscription-revenue-details`).catch(() => ({ data: null })),
        axios.get(`${API}/admin/finance/prc-liability`).catch(() => ({ data: null })),
        axios.get(`${API}/admin/finance/cash-flow-projection`).catch(() => ({ data: null })),
        axios.get(`${API}/admin/paid-users-wallet-summary`).catch(() => ({ data: null }))
      ]);
      
      setMonthComparison(monthComp.data);
      setSubscriptionRevenue(subRev.data);
      setPrcLiability(liability.data);
      setCashFlowProjection(cashFlow.data);
      setPaidWalletSummary(walletSum.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };


  const fetchPLData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ period });
      if (period === 'month') {
        params.append('year', selectedYear);
        params.append('month', selectedMonth);
      } else if (period === 'year') {
        params.append('year', selectedYear);
      }
      
      const response = await axios.get(`${API}/admin/finance/profit-loss?${params}`);
      setData(response.data);
    } catch (error) {
      console.error('Error fetching P&L data:', error);
      toast.error('Failed to load P&L data');
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      const response = await axios.get(`${API}/admin/finance/expenses?limit=20`);
      setExpenses(response.data.expenses || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  };

  const fetchFixedExpenses = async () => {
    try {
      const response = await axios.get(`${API}/admin/finance/fixed-expenses`);
      setFixedExpenses(response.data.expenses || []);
    } catch (error) {
      console.error('Error fetching fixed expenses:', error);
    }
  };

  const handleAddExpense = async () => {
    if (!expenseForm.category || !expenseForm.amount) {
      toast.error('Category and Amount are required');
      return;
    }
    
    try {
      await axios.post(`${API}/admin/finance/expense`, {
        ...expenseForm,
        amount: parseFloat(expenseForm.amount),
        admin_id: user?.uid
      });
      toast.success('Expense added!');
      setShowAddExpense(false);
      setExpenseForm({ category: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
      fetchExpenses();
      fetchPLData();
    } catch (error) {
      toast.error('Failed to add expense');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Delete this expense?')) return;
    
    try {
      await axios.delete(`${API}/admin/finance/expense/${expenseId}`);
      toast.success('Expense deleted');
      fetchExpenses();
      fetchPLData();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  if (loading && !data) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-500 mx-auto" />
          <p className="text-gray-400 mt-4">Loading P&L Data...</p>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {};
  const revenue = data?.revenue || {};
  const expensesData = data?.expenses || {};
  const insights = data?.insights || [];

  // Prepare chart data
  const revenueChartData = Object.entries(revenue.breakdown || {})
    .filter(([_, v]) => v > 0)
    .map(([key, value]) => ({
      name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: value
    }));

  const expenseChartData = Object.entries(expensesData.breakdown || {})
    .filter(([_, v]) => v > 0)
    .map(([key, value]) => ({
      name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: value
    }));

  return (
    <div className="p-4 lg:p-6 space-y-6 bg-gray-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-green-500" />
            Profit & Loss Statement
          </h1>
          <p className="text-gray-500">{data?.period_label || 'Financial Overview'}</p>
        </div>
        
        {/* Period Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {['day', 'week', 'month', 'year'].map((p) => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'outline'}
              onClick={() => setPeriod(p)}
              size="sm"
              className={period === p ? 'bg-purple-600 hover:bg-purple-700' : 'border-gray-700'}
            >
              {p === 'day' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'This Year'}
            </Button>
          ))}
          
          {(period === 'month' || period === 'year') && (
            <select
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {[2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
          
          {period === 'month' && (
            <select
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                <option key={i+1} value={i+1}>{m}</option>
              ))}
            </select>
          )}
          
          <Button onClick={fetchPLData} variant="outline" size="sm" className="border-gray-700">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main Status Card */}
      <Card className={`p-6 ${
        summary.status === 'profit' ? 'bg-gradient-to-r from-green-900/50 to-emerald-900/50 border-green-500/50' :
        summary.status === 'loss' ? 'bg-gradient-to-r from-red-900/50 to-rose-900/50 border-red-500/50' :
        'bg-gradient-to-r from-yellow-900/50 to-amber-900/50 border-yellow-500/50'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">{summary.status_emoji || '📊'}</span>
              <div>
                <h2 className="text-3xl font-bold text-white">
                  {summary.status === 'profit' ? 'PROFIT' : summary.status === 'loss' ? 'LOSS' : 'BREAKEVEN'}
                </h2>
                <p className="text-gray-300">{summary.status_message}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <p className="text-xs text-gray-400">Revenue</p>
                <p className="text-xl font-bold text-green-400">{formatCurrency(summary.gross_revenue)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Expenses</p>
                <p className="text-xl font-bold text-red-400">{formatCurrency(summary.total_expenses)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Net</p>
                <p className={`text-xl font-bold ${summary.net_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(summary.net_profit)}
                </p>
              </div>
            </div>
          </div>
          
          {/* Health Score */}
          <div className="text-center">
            <div className="relative w-32 h-32 mx-auto">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle cx="64" cy="64" r="56" stroke="rgba(255,255,255,0.1)" strokeWidth="12" fill="none" />
                <circle cx="64" cy="64" r="56" 
                  stroke={summary.health_score > 70 ? '#22c55e' : summary.health_score > 40 ? '#eab308' : '#ef4444'} 
                  strokeWidth="12" fill="none"
                  strokeDasharray={`${(summary.health_score || 0) * 3.52} 352`}
                  strokeLinecap="round" 
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white">{summary.health_score || 0}</span>
                <span className="text-xs text-gray-400">Health Score</span>
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-2">Profit Margin: {summary.profit_margin || 0}%</p>
          </div>
        </div>
      </Card>

      {/* Insights */}
      {insights.length > 0 && (
        <Card className="p-4 bg-blue-900/20 border-blue-500/30">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-300 mb-2">Insights</h3>
              <ul className="space-y-1">
                {insights.map((insight, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Revenue & Expense Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Revenue Card */}
        <Card className="p-6 bg-green-900/20 border-green-500/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-green-400 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Revenue (Income)
            </h3>
            <span className="text-2xl font-bold text-green-400">{formatCurrency(revenue.total)}</span>
          </div>
          
          <div className="space-y-3">
            {Object.entries(revenue.breakdown || {}).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between py-2 border-b border-gray-700/50">
                <span className="text-sm text-gray-300">
                  {key === 'processing_fees' ? '🔧 Processing Fees (₹10 × services)' :
                   key === 'admin_charges' ? '💼 Admin Charges (20%)' :
                   key === 'vip_memberships' ? '👑 VIP Memberships' :
                   key === 'service_charges' ? '📋 Service Charges' :
                   key === 'delivery_charges' ? '🚚 Delivery Charges' :
                   key === 'ad_revenue' ? '📢 Ad Revenue' :
                   key === 'other_income' ? '📦 Other Income' :
                   key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
                <span className="font-medium text-green-400">{formatCurrency(value)}</span>
              </div>
            ))}
          </div>
          
          {/* Revenue Details */}
          {revenue.details && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-500">
                VIP Members: {revenue.details.vip_count || 0} | 
                Bill Payments: {revenue.details.bill_payments_count || 0} |
                Gift Vouchers: {revenue.details.gift_voucher_count || 0}
              </p>
            </div>
          )}
        </Card>

        {/* Expense Card */}
        <Card className="p-6 bg-red-900/20 border-red-500/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              Expenses (Outflow)
            </h3>
            <span className="text-2xl font-bold text-red-400">{formatCurrency(expensesData.total)}</span>
          </div>
          
          <div className="space-y-3">
            {Object.entries(expensesData.breakdown || {}).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between py-2 border-b border-gray-700/50">
                <span className="text-sm text-gray-300">
                  {key === 'bill_payment_payouts' ? '📄 Bill Payment Payouts (INR)' :
                   key === 'gift_voucher_payouts' ? '🎁 Gift Voucher Payouts (INR)' :
                   key === 'withdrawal_payouts' ? '💸 PRC Redeem Payouts (INR)' :
                   key === 'bank_withdrawal_payouts' ? '🏦 Bank Redeem Payouts (INR)' :
                   key === 'luxury_claim_payouts' ? '✨ Luxury Claim Payouts (INR)' :
                   key === 'payment_gateway_fees' ? '🏧 Payment Gateway Fees' :
                   key === 'server_hosting' ? '🖥️ Server Hosting' :
                   key === 'sms_email_services' ? '📧 SMS/Email Services' :
                   key === 'marketing' ? '📢 Marketing' :
                   key === 'cashback_referral' ? '🎯 Cashback & Referral' :
                   key === 'prc_rewards' ? '💎 PRC Rewards' :
                   key === 'staff_salary' ? '👥 Staff Salary' :
                   key === 'office_rent' ? '🏢 Office Rent' :
                   key === 'fixed_expenses' ? '📋 Fixed Expenses' :
                   key === 'miscellaneous' ? '📦 Miscellaneous' :
                   key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
                <span className="font-medium text-red-400">{formatCurrency(value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Service-wise Fee Breakdown (NEW) */}
      {revenue.details && (revenue.details.bill_payments_count > 0 || revenue.details.gift_voucher_count > 0 || revenue.details.luxury_claims_count > 0 || revenue.details.withdrawal_count > 0 || revenue.details.bank_withdrawal_rev_count > 0) && (
        <Card className="p-6 bg-purple-900/20 border-purple-500/30">
          <h3 className="text-lg font-bold text-purple-400 flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5" />
            Service-wise Fee Breakdown (₹10 + 20%)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Bill Payments */}
            {revenue.details.bill_payments_count > 0 && (
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <span className="font-medium text-white">Bill Payments</span>
                </div>
                <p className="text-2xl font-bold text-blue-400">{revenue.details.bill_payments_count}</p>
                <div className="mt-2 text-xs text-gray-400 space-y-1">
                  <p>Processing: {formatCurrency(revenue.details.bill_processing_fees || 0)}</p>
                  <p>Admin (20%): {formatCurrency(revenue.details.bill_admin_charges || 0)}</p>
                </div>
              </div>
            )}
            
            {/* Gift Vouchers */}
            {revenue.details.gift_voucher_count > 0 && (
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-5 h-5 text-pink-400" />
                  <span className="font-medium text-white">Gift Vouchers</span>
                </div>
                <p className="text-2xl font-bold text-pink-400">{revenue.details.gift_voucher_count}</p>
                <div className="mt-2 text-xs text-gray-400 space-y-1">
                  <p>Processing: {formatCurrency(revenue.details.gift_processing_fees || 0)}</p>
                  <p>Admin (20%): {formatCurrency(revenue.details.gift_admin_charges || 0)}</p>
                </div>
              </div>
            )}
            
            {/* Luxury Claims */}
            {revenue.details.luxury_claims_count > 0 && (
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                  <span className="font-medium text-white">Luxury Claims</span>
                </div>
                <p className="text-2xl font-bold text-amber-400">{revenue.details.luxury_claims_count}</p>
                <div className="mt-2 text-xs text-gray-400 space-y-1">
                  <p>Processing: {formatCurrency(revenue.details.luxury_processing_fees || 0)}</p>
                  <p>Admin (20%): {formatCurrency(revenue.details.luxury_admin_charges || 0)}</p>
                </div>
              </div>
            )}
            
            {/* Withdrawals */}
            {revenue.details.withdrawal_count > 0 && (
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-5 h-5 text-green-400" />
                  <span className="font-medium text-white">Withdrawals</span>
                </div>
                <p className="text-2xl font-bold text-green-400">{revenue.details.withdrawal_count}</p>
                <div className="mt-2 text-xs text-gray-400 space-y-1">
                  <p>Processing: {formatCurrency(revenue.details.withdrawal_processing_fees || 0)}</p>
                  <p>Admin (20%): {formatCurrency(revenue.details.withdrawal_admin_charges || 0)}</p>
                </div>
              </div>
            )}
            
            {/* Bank Redeems (PRC to Bank) */}
            {revenue.details.bank_withdrawal_rev_count > 0 && (
              <div className="p-4 bg-gray-800/50 rounded-lg border border-cyan-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Building className="w-5 h-5 text-cyan-400" />
                  <span className="font-medium text-white">Bank Redeems</span>
                </div>
                <p className="text-2xl font-bold text-cyan-400">{revenue.details.bank_withdrawal_rev_count}</p>
                <div className="mt-2 text-xs text-gray-400 space-y-1">
                  <p>Processing: {formatCurrency(revenue.details.bank_withdrawal_processing_fees || 0)}</p>
                  <p>Admin (20%): {formatCurrency(revenue.details.bank_withdrawal_admin_charges || 0)}</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Total Fee Revenue */}
          <div className="mt-4 pt-4 border-t border-purple-500/30 flex justify-between items-center">
            <span className="text-gray-300">Total Fee Revenue:</span>
            <span className="text-xl font-bold text-purple-400">
              {formatCurrency((revenue.breakdown?.processing_fees || 0) + (revenue.breakdown?.admin_charges || 0))}
            </span>
          </div>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Pie */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-white mb-4">Revenue Breakdown</h3>
          {revenueChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={revenueChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {revenueChartData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-500">No revenue data</div>
          )}
        </Card>

        {/* Expense Pie */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-white mb-4">Expense Breakdown</h3>
          {expenseChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={expenseChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {expenseChartData.map((_, index) => (
                    <Cell key={index} fill={COLORS[(index + 3) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-500">No expense data</div>
          )}
        </Card>
      </div>

      {/* Expense Management */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Receipt className="h-5 w-5 text-purple-500" />
            Manual Expenses (Personal Expenses)
          </h3>
          <Button onClick={() => setShowAddExpense(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="h-4 w-4 mr-2" /> Add Expense
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400">Date</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400">Category</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400">Description</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400">Amount</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    No expenses recorded. Click "Add Expense" to start tracking.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.expense_id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-3 px-4 text-sm text-gray-300">
                      {new Date(exp.date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-white">
                      {exp.category?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400 max-w-xs truncate">
                      {exp.description || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm font-bold text-right text-red-400">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-400" onClick={() => handleDeleteExpense(exp.expense_id)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Fixed Monthly Expenses */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-amber-500" />
            Fixed Monthly Expenses (Regular Expenses)
          </h3>
          <Button variant="outline" size="sm" className="border-gray-700" onClick={() => window.location.href = '/admin/fixed-expenses'}>
            Manage
          </Button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {fixedExpenses.length > 0 ? fixedExpenses.map((fe) => (
            <div key={fe.expense_id} className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-sm text-gray-400">{fe.name}</p>
              <p className="text-lg font-bold text-amber-400">{formatCurrency(fe.monthly_amount)}/mo</p>
            </div>
          )) : (
            <div className="col-span-4 text-center py-4 text-gray-500">
              No fixed expenses set. Add your monthly recurring costs.
            </div>
          )}
        </div>
        
        {fixedExpenses.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between">
            <span className="text-gray-400">Total Monthly Fixed Cost:</span>
            <span className="font-bold text-amber-400">
              {formatCurrency(fixedExpenses.reduce((sum, fe) => sum + (fe.monthly_amount || 0), 0))}
            </span>
          </div>
        )}
      </Card>

      {/* ===== NEW ANALYTICS SECTIONS ===== */}
      
      {/* Month-over-Month Comparison */}
      {monthComparison && !monthComparison.error && (
        <Card className="p-6 bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border-blue-500/30">
          <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5" />
            Month-over-Month Comparison
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-sm text-gray-400 mb-1">{monthComparison.current_month?.label}</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(monthComparison.current_month?.revenue)}</p>
              <div className="mt-2 text-xs text-gray-400">
                <p>New Users: {monthComparison.current_month?.new_users}</p>
                <p>New Paid: {monthComparison.current_month?.new_paid_users}</p>
              </div>
            </div>
            
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-sm text-gray-400 mb-1">{monthComparison.previous_month?.label}</p>
              <p className="text-2xl font-bold text-gray-400">{formatCurrency(monthComparison.previous_month?.revenue)}</p>
              <div className="mt-2 text-xs text-gray-400">
                <p>New Users: {monthComparison.previous_month?.new_users}</p>
                <p>New Paid: {monthComparison.previous_month?.new_paid_users}</p>
              </div>
            </div>
            
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-sm text-gray-400 mb-2">Growth</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Revenue</span>
                  <span className={`font-bold ${monthComparison.changes?.revenue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {monthComparison.changes?.revenue >= 0 ? '+' : ''}{monthComparison.changes?.revenue}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Users</span>
                  <span className={`font-bold ${monthComparison.changes?.new_users >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {monthComparison.changes?.new_users >= 0 ? '+' : ''}{monthComparison.changes?.new_users}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
      
      {/* Paid Users Wallet Summary */}
      {paidWalletSummary && paidWalletSummary.summary && (
        <Card className="p-6 bg-gradient-to-r from-amber-900/30 to-orange-900/30 border-amber-500/30">
          <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2 mb-4">
            <Crown className="w-5 h-5" />
            Paid Users Wallet Summary
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-gray-800/50 rounded-lg text-center">
              <p className="text-3xl font-bold text-amber-400">{paidWalletSummary.summary.total_paid_users}</p>
              <p className="text-xs text-gray-400">Paid Users</p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-purple-400">{paidWalletSummary.summary.total_prc_balance?.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Total PRC Balance</p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-400">{formatCurrency(paidWalletSummary.summary.total_prc_inr_value)}</p>
              <p className="text-xs text-gray-400">INR Value</p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-400">{formatCurrency(paidWalletSummary.summary.total_redeemed_inr)}</p>
              <p className="text-xs text-gray-400">Total Redeemed</p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(paidWalletSummary.balance_by_plan || {}).map(([plan, data]) => (
              <div key={plan} className="p-3 bg-gray-800/30 rounded-lg">
                <span className="font-medium text-white capitalize">{plan}</span>
                <p className="text-lg font-bold text-white">{data.total_prc?.toLocaleString()} PRC</p>
                <p className="text-xs text-gray-400">{data.user_count} users</p>
              </div>
            ))}
          </div>
        </Card>
      )}
      
      {/* Subscription Revenue Details */}
      {subscriptionRevenue && !subscriptionRevenue.error && (
        <Card className="p-6 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-purple-500/30">
          <h3 className="text-lg font-bold text-purple-400 flex items-center gap-2 mb-4">
            <Target className="w-5 h-5" />
            Subscription Revenue ({subscriptionRevenue.period})
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-gray-800/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-400">{formatCurrency(subscriptionRevenue.total_revenue)}</p>
              <p className="text-xs text-gray-400">Total Revenue</p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-white">{subscriptionRevenue.total_subscriptions}</p>
              <p className="text-xs text-gray-400">Total Subs</p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-400">{subscriptionRevenue.new_vs_renewal?.new?.count || 0}</p>
              <p className="text-xs text-gray-400">New</p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-amber-400">{subscriptionRevenue.new_vs_renewal?.renewal_rate || 0}%</p>
              <p className="text-xs text-gray-400">Renewal Rate</p>
            </div>
          </div>
        </Card>
      )}
      
      {/* PRC Liability Tracker */}
      {prcLiability && !prcLiability.error && (
        <Card className="p-6 bg-gradient-to-r from-red-900/30 to-rose-900/30 border-red-500/30">
          <h3 className="text-lg font-bold text-red-400 flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5" />
            PRC Liability Tracker
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-4 bg-gray-800/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-purple-400">{prcLiability.total_prc_in_circulation?.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Total PRC</p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-400">{formatCurrency(prcLiability.total_inr_liability)}</p>
              <p className="text-xs text-gray-400">INR Liability</p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-400">+{prcLiability.rates_30d?.daily_mining?.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Daily Mining</p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-orange-400">-{prcLiability.rates_30d?.daily_burn?.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Daily Burn</p>
            </div>
          </div>
          
          <div className="p-4 bg-gray-800/30 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">Liability Projections</p>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-gray-500">30 Days</p>
                <p className="text-lg font-bold text-yellow-400">{formatCurrency(prcLiability.projection?.['30_day_liability_inr'])}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">90 Days</p>
                <p className="text-lg font-bold text-orange-400">{formatCurrency(prcLiability.projection?.['90_day_liability_inr'])}</p>
              </div>
            </div>
          </div>
        </Card>
      )}
      
      {/* Cash Flow Projection */}
      {cashFlowProjection && !cashFlowProjection.error && (
        <Card className="p-6 bg-gradient-to-r from-cyan-900/30 to-teal-900/30 border-cyan-500/30">
          <h3 className="text-lg font-bold text-cyan-400 flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5" />
            Cash Flow Projection (3 Months)
          </h3>
          
          <div className="grid grid-cols-3 gap-4">
            {cashFlowProjection.projections?.map((proj, idx) => (
              <div key={idx} className="p-4 bg-gray-800/50 rounded-lg">
                <p className="text-sm text-gray-400 mb-2">{proj.month}</p>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-400">Revenue</span>
                    <span className="text-green-400">{formatCurrency(proj.projected_revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-400">Profit</span>
                    <span className={proj.projected_profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {formatCurrency(proj.projected_profit)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-gray-900 border-gray-700">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Add New Expense</h2>
                <button onClick={() => setShowAddExpense(false)} className="text-gray-500 hover:text-gray-300 text-2xl">&times;</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Category *</label>
                  <select
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({...expenseForm, category: e.target.value})}
                  >
                    <option value="">Select Category</option>
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-gray-400 block mb-1">Amount (₹) *</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 block mb-1">Date</label>
                  <Input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 block mb-1">Description</label>
                  <Input
                    placeholder="What was this expense for?"
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => setShowAddExpense(false)} className="flex-1 border-gray-700">
                    Cancel
                  </Button>
                  <Button onClick={handleAddExpense} className="flex-1 bg-purple-600 hover:bg-purple-700">
                    Add Expense
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminProfitLoss;
