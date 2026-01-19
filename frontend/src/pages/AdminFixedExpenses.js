import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import Pagination from '../components/Pagination';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  DollarSign, Plus, Trash2, Edit2, RefreshCw, Download, 
  Building, Server, Users, FileText, CheckCircle, Clock,
  Calendar, Filter, Save
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

const EXPENSE_CATEGORIES = [
  { id: 'server', label: 'Server/Hosting', icon: Server },
  { id: 'salary', label: 'Salaries', icon: Users },
  { id: 'legal', label: 'Legal/CA', icon: FileText },
  { id: 'office', label: 'Office/Admin', icon: Building },
  { id: 'marketing', label: 'Marketing', icon: DollarSign },
  { id: 'other', label: 'Other', icon: DollarSign },
];

const AdminFixedExpenses = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState('');
  
  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [form, setForm] = useState({
    category: 'server',
    description: '',
    amount: '',
    month: new Date().toISOString().slice(0, 7),
    vendor: '',
    paid_status: 'pending',
    payment_date: '',
    recurring: true
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchExpenses();
  }, [user, navigate, page, selectedMonth]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      let url = `${API}/api/admin/finance/fixed-expenses?page=${page}&limit=20`;
      if (selectedMonth) url += `&month=${selectedMonth}`;
      
      const response = await axios.get(url);
      setExpenses(response.data.expenses || []);
      setMonthlySummary(response.data.monthly_summary || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.description || !form.amount) {
      toast.error('Description and amount are required');
      return;
    }
    
    try {
      if (editingExpense) {
        await axios.put(`${API}/api/admin/finance/fixed-expense/${editingExpense.expense_id}`, {
          ...form,
          amount: parseFloat(form.amount),
          admin_id: user.uid
        });
        toast.success('Expense updated!');
      } else {
        await axios.post(`${API}/api/admin/finance/fixed-expense`, {
          ...form,
          amount: parseFloat(form.amount),
          admin_id: user.uid
        });
        toast.success('Expense added!');
      }
      
      closeModal();
      fetchExpenses();
    } catch (error) {
      toast.error('Failed to save expense');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingExpense(null);
    setForm({
      category: 'server',
      description: '',
      amount: '',
      month: new Date().toISOString().slice(0, 7),
      vendor: '',
      paid_status: 'pending',
      payment_date: '',
      recurring: true
    });
  };

  const openEdit = (expense) => {
    setEditingExpense(expense);
    setForm({
      category: expense.expense_category,
      description: expense.description,
      amount: expense.amount,
      month: expense.month,
      vendor: expense.vendor || '',
      paid_status: expense.paid_status,
      payment_date: expense.payment_date || '',
      recurring: expense.recurring
    });
    setShowModal(true);
  };

  // Calculate totals by category
  const categoryTotals = expenses.reduce((acc, exp) => {
    const cat = exp.expense_category || 'other';
    acc[cat] = (acc[cat] || 0) + (exp.amount || 0);
    return acc;
  }, {});

  const pieData = Object.entries(categoryTotals).map(([key, value]) => ({
    name: EXPENSE_CATEGORIES.find(c => c.id === key)?.label || key,
    value: value
  }));

  const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const paidAmount = expenses.filter(e => e.paid_status === 'paid').reduce((sum, e) => sum + (e.amount || 0), 0);
  const pendingAmount = totalAmount - paidAmount;

  // Generate month options
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }

  if (loading && expenses.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-800/50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building className="h-6 w-6 text-orange-600" />
            Fixed Expenses Management
          </h1>
          <p className="text-sm text-gray-500">Track monthly recurring expenses</p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">All Months</option>
            {months.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <Button variant="outline" onClick={fetchExpenses}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Expenses</p>
              <p className="text-2xl font-bold text-gray-900">₹{totalAmount.toLocaleString('en-IN')}</p>
            </div>
            <div className="p-3 bg-purple-500/100/20 rounded-lg">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Paid</p>
              <p className="text-2xl font-bold text-green-600">₹{paidAmount.toLocaleString('en-IN')}</p>
            </div>
            <div className="p-3 bg-green-500/100/20 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">₹{pendingAmount.toLocaleString('en-IN')}</p>
            </div>
            <div className="p-3 bg-yellow-500/100/20 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Entries</p>
              <p className="text-2xl font-bold text-gray-900">{total}</p>
            </div>
            <div className="p-3 bg-blue-500/100/20 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      {pieData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Expense Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
          
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Category Breakdown</h3>
            <div className="space-y-3">
              {EXPENSE_CATEGORIES.map((cat) => {
                const amount = categoryTotals[cat.id] || 0;
                const percentage = totalAmount > 0 ? (amount / totalAmount * 100) : 0;
                const Icon = cat.icon;
                return (
                  <div key={cat.id} className="flex items-center gap-3">
                    <div className="p-2 bg-gray-700 rounded-lg">
                      <Icon className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{cat.label}</span>
                        <span className="text-sm text-gray-600">₹{amount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Expenses Table */}
      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">All Expenses</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-3">Month</th>
                <th className="pb-3">Category</th>
                <th className="pb-3">Description</th>
                <th className="pb-3">Vendor</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => {
                const cat = EXPENSE_CATEGORIES.find(c => c.id === expense.expense_category);
                return (
                  <tr key={expense.expense_id} className="border-b hover:bg-gray-800/50">
                    <td className="py-3">{expense.month}</td>
                    <td className="py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-700">
                        {cat?.label || expense.expense_category}
                      </span>
                    </td>
                    <td className="py-3">{expense.description}</td>
                    <td className="py-3 text-gray-600">{expense.vendor || '-'}</td>
                    <td className="py-3 font-semibold">₹{expense.amount?.toLocaleString('en-IN')}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        expense.paid_status === 'paid' 
                          ? 'bg-green-500/100/20 text-green-400' 
                          : 'bg-yellow-500/100/20 text-yellow-400'
                      }`}>
                        {expense.paid_status}
                      </span>
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => openEdit(expense)}
                        className="p-2 text-blue-600 hover:bg-blue-500/100/10 rounded-lg"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No expenses found. Click "Add Expense" to start tracking.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {total > 20 && (
          <div className="mt-4">
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / 20)}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              {editingExpense ? <Edit2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {editingExpense ? 'Edit Expense' : 'Add New Expense'}
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({...form, category: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300">Month</label>
                  <input
                    type="month"
                    value={form.month}
                    onChange={(e) => setForm({...form, month: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300">Description *</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                  placeholder="e.g., AWS Server Hosting"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300">Amount (₹) *</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({...form, amount: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300">Vendor</label>
                  <input
                    type="text"
                    value={form.vendor}
                    onChange={(e) => setForm({...form, vendor: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                    placeholder="e.g., Amazon Web Services"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300">Payment Status</label>
                  <select
                    value={form.paid_status}
                    onChange={(e) => setForm({...form, paid_status: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300">Payment Date</label>
                  <input
                    type="date"
                    value={form.payment_date}
                    onChange={(e) => setForm({...form, payment_date: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={form.recurring}
                  onChange={(e) => setForm({...form, recurring: e.target.checked})}
                  className="rounded"
                />
                <label htmlFor="recurring" className="text-sm text-gray-300">
                  Recurring monthly expense
                </label>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={closeModal}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                {editingExpense ? 'Update' : 'Add'} Expense
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminFixedExpenses;
