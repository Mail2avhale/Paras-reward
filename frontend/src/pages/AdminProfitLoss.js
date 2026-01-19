import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Pagination from '@/components/Pagination';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, Plus, Edit, Trash2,
  Calendar, RefreshCw, Download, FileText, PieChart as PieIcon,
  ArrowUpRight, ArrowDownRight, Receipt, CreditCard, Building,
  Smartphone, Megaphone, Package, Gift, Users, Wallet
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#06b6d4', '#84cc16'];

const EXPENSE_CATEGORIES = [
  { value: 'server_hosting', label: 'Server/Hosting', icon: Building },
  { value: 'payment_gateway_fees', label: 'Payment Gateway Fees', icon: CreditCard },
  { value: 'sms_email_services', label: 'SMS/Email Services', icon: Smartphone },
  { value: 'marketing', label: 'Marketing', icon: Megaphone },
  { value: 'product_cost', label: 'Product Cost', icon: Package },
  { value: 'gift_voucher_cost', label: 'Gift Voucher Cost', icon: Gift },
  { value: 'cashback_referral', label: 'Cashback/Referral', icon: Users },
  { value: 'staff_salary', label: 'Staff Salary', icon: Users },
  { value: 'office_rent', label: 'Office Rent', icon: Building },
  { value: 'utilities', label: 'Utilities', icon: Building },
  { value: 'miscellaneous', label: 'Miscellaneous', icon: FileText }
];

const AdminProfitLoss = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  
  // Expense management
  const [expenses, setExpenses] = useState([]);
  const [expensePage, setExpensePage] = useState(1);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: '',
    amount: '',
    description: '',
    vendor: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchPLData();
    fetchExpenses();
  }, [period, selectedYear, selectedMonth]);

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
      const response = await axios.get(`${API}/admin/finance/expenses?page=${expensePage}&limit=10`);
      setExpenses(response.data.expenses || []);
      setExpenseTotal(response.data.total || 0);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  };

  const handleAddExpense = async () => {
    if (!expenseForm.category || !expenseForm.amount) {
      toast.error('Please fill required fields');
      return;
    }
    
    try {
      await axios.post(`${API}/admin/finance/expense`, {
        ...expenseForm,
        amount: parseFloat(expenseForm.amount),
        admin_id: user?.uid
      });
      toast.success('Expense added successfully');
      setShowAddExpense(false);
      setExpenseForm({ category: '', amount: '', description: '', vendor: '', date: new Date().toISOString().split('T')[0] });
      fetchExpenses();
      fetchPLData();
    } catch (error) {
      toast.error('Failed to add expense');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    
    try {
      await axios.delete(`${API}/admin/finance/expense/${expenseId}?admin_id=${user?.uid}`);
      toast.success('Expense deleted');
      fetchExpenses();
      fetchPLData();
    } catch (error) {
      toast.error('Failed to delete expense');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const StatCard = ({ title, value, change, icon: Icon, color, isProfit }) => (
    <Card className={`p-5 ${color}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${isProfit !== undefined ? (isProfit ? 'text-green-600' : 'text-red-600') : 'text-white'}`}>
            {formatCurrency(value)}
          </p>
          {change !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              <span>{Math.abs(change).toFixed(1)}% vs prev</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${isProfit !== undefined ? (isProfit ? 'bg-green-500/100/20' : 'bg-red-500/100/20') : 'bg-gray-800'}`}>
          <Icon className={`h-6 w-6 ${isProfit !== undefined ? (isProfit ? 'text-green-600' : 'text-red-600') : 'text-gray-400'}`} />
        </div>
      </div>
    </Card>
  );

  if (loading && !data) {
    return (
      <div className="p-6">
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading P&L Data...</p>
        </div>
      </div>
    );
  }

  const revenueData = data?.revenue?.breakdown ? Object.entries(data.revenue.breakdown)
    .filter(([_, v]) => v > 0)
    .map(([key, value]) => ({
      name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: value
    })) : [];

  const expenseData = data?.expenses?.breakdown ? Object.entries(data.expenses.breakdown)
    .filter(([_, v]) => v > 0)
    .map(([key, value]) => ({
      name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: value
    })) : [];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-green-600" />
            Profit & Loss Statement
          </h1>
          <p className="text-gray-500">{data?.period_label || 'Financial Overview'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {['day', 'week', 'month', 'year'].map((p) => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'outline'}
              onClick={() => setPeriod(p)}
              size="sm"
              className={period === p ? 'bg-purple-600 hover:bg-purple-700' : ''}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Button>
          ))}
          {period === 'month' && (
            <>
              <select
                className="px-3 py-1 border rounded-lg text-sm"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              >
                {Array.from({length: 12}, (_, i) => (
                  <option key={i+1} value={i+1}>
                    {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select
                className="px-3 py-1 border rounded-lg text-sm"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                {[2023, 2024, 2025].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </>
          )}
          <Button onClick={fetchPLData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Gross Revenue"
          value={data?.summary?.gross_revenue}
          change={data?.summary?.revenue_change}
          icon={TrendingUp}
          color="bg-green-500/100/10 border-green-500/30"
        />
        <StatCard
          title="Total Expenses"
          value={data?.summary?.total_expenses}
          icon={TrendingDown}
          color="bg-red-500/100/10 border-red-500/30"
        />
        <StatCard
          title="Net Profit/Loss"
          value={data?.summary?.net_profit}
          icon={data?.summary?.net_profit >= 0 ? TrendingUp : TrendingDown}
          color={data?.summary?.net_profit >= 0 ? "bg-emerald-500/100/10 border-emerald-200" : "bg-rose-500/10 border-rose-200"}
          isProfit={data?.summary?.net_profit >= 0}
        />
        <StatCard
          title="Profit Margin"
          value={null}
          icon={PieIcon}
          color="bg-purple-500/100/10 border-purple-500/30"
        />
      </div>

      {/* Profit Margin Display */}
      <Card className="p-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg opacity-90">Profit Margin</p>
            <p className="text-4xl font-bold mt-2">{data?.summary?.profit_margin?.toFixed(1) || 0}%</p>
            <p className="text-sm opacity-80 mt-1">
              {data?.summary?.status === 'profit' ? '📈 Profitable' : 
               data?.summary?.status === 'loss' ? '📉 Loss' : '➡️ Breakeven'}
            </p>
          </div>
          <div className="relative w-32 h-32">
            <svg className="transform -rotate-90 w-32 h-32">
              <circle cx="64" cy="64" r="56" stroke="rgba(255,255,255,0.2)" strokeWidth="12" fill="none" />
              <circle cx="64" cy="64" r="56" stroke="white" strokeWidth="12" fill="none"
                strokeDasharray={`${Math.max(0, Math.min(100, data?.summary?.profit_margin || 0)) * 3.52} 352`} 
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <DollarSign className="h-10 w-10 opacity-80" />
            </div>
          </div>
        </div>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Revenue Breakdown
          </h3>
          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={revenueData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  {revenueData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No revenue data for this period</p>
            </div>
          )}
        </Card>

        {/* Expense Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-600" />
            Expense Breakdown
          </h3>
          {expenseData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expenseData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  {expenseData.map((_, index) => (
                    <Cell key={index} fill={COLORS[(index + 3) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <TrendingDown className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No expense data for this period</p>
            </div>
          )}
        </Card>
      </div>

      {/* Monthly Trend */}
      {data?.monthly_trend?.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-bold text-white mb-4">6-Month Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.monthly_trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill="#10b981" />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" />
              <Bar dataKey="profit" name="Profit" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Expense Management */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Receipt className="h-5 w-5 text-purple-600" />
            Expense Management
          </h3>
          <Button onClick={() => setShowAddExpense(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="h-4 w-4 mr-2" /> Add Expense
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold">Date</th>
                <th className="text-left py-3 px-4 text-xs font-semibold">Category</th>
                <th className="text-left py-3 px-4 text-xs font-semibold">Description</th>
                <th className="text-left py-3 px-4 text-xs font-semibold">Vendor</th>
                <th className="text-right py-3 px-4 text-xs font-semibold">Amount</th>
                <th className="text-center py-3 px-4 text-xs font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    No expenses recorded. Click "Add Expense" to start tracking.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.expense_id} className="border-b hover:bg-gray-800/50">
                    <td className="py-3 px-4 text-sm">
                      {new Date(exp.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium">
                      {exp.category?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400 max-w-xs truncate">
                      {exp.description || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm">{exp.vendor || '-'}</td>
                    <td className="py-3 px-4 text-sm font-bold text-right text-red-600">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-red-600"
                        onClick={() => handleDeleteExpense(exp.expense_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {expenseTotal > 10 && (
          <div className="mt-4">
            <Pagination
              currentPage={expensePage}
              totalPages={Math.ceil(expenseTotal / 10)}
              totalItems={expenseTotal}
              itemsPerPage={10}
              onPageChange={setExpensePage}
            />
          </div>
        )}
      </Card>

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Add New Expense</h2>
                <button onClick={() => setShowAddExpense(false)} className="text-gray-500 hover:text-gray-300">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">Category *</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg"
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
                  <label className="text-sm text-gray-400">Amount (₹) *</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400">Date</label>
                  <Input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400">Description</label>
                  <Input
                    placeholder="What was this expense for?"
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400">Vendor/Payee</label>
                  <Input
                    placeholder="Who did you pay?"
                    value={expenseForm.vendor}
                    onChange={(e) => setExpenseForm({...expenseForm, vendor: e.target.value})}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => setShowAddExpense(false)} className="flex-1">
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
