import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Activity, RefreshCw, TrendingUp, TrendingDown, DollarSign,
  PieChart, BarChart3, AlertTriangle, CheckCircle2, Heart,
  Gauge, ArrowUpRight, ArrowDownRight, IndianRupee
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminFinancialRatios = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

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
      const response = await axios.get(`${API}/api/admin/accounting/financial-ratios`);
      setData(response.data);
    } catch (error) {
      console.error('Error fetching ratios:', error);
      toast.error('Failed to load financial ratios');
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'good': return 'text-green-600 bg-green-100';
      case 'fair': return 'text-amber-600 bg-amber-100';
      case 'poor': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthColor = (status) => {
    switch (status) {
      case 'excellent': return 'from-green-500 to-emerald-600';
      case 'good': return 'from-blue-500 to-indigo-600';
      case 'fair': return 'from-amber-500 to-orange-600';
      case 'needs_attention': return 'from-red-500 to-rose-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const ratios = data?.ratios || {};
  const underlying = data?.underlying_data || {};

  return (
    <div className="min-h-screen bg-gray-800/50 p-4 md:p-6" data-testid="admin-financial-ratios">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-7 w-7 text-purple-600" />
            Financial Ratios & Health
          </h1>
          <p className="text-sm text-gray-500 mt-1">Business health indicators based on {data?.period}</p>
        </div>
        <Button variant="outline" onClick={fetchData} size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Health Score Card */}
      <Card className={`p-6 mb-6 bg-gradient-to-r ${getHealthColor(data?.health_status)} text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm font-medium">Business Health Score</p>
            <div className="flex items-baseline gap-2 mt-2">
              <h1 className="text-5xl font-bold">{data?.health_score}</h1>
              <span className="text-2xl font-medium">/100</span>
            </div>
            <p className="text-white/80 mt-2 capitalize font-medium">
              Status: {data?.health_status?.replace('_', ' ')}
            </p>
          </div>
          <div className="text-right">
            <Heart className="h-16 w-16 text-white/30" />
          </div>
        </div>
      </Card>

      {/* Ratio Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Current Ratio */}
        <Card className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Current Ratio</h3>
              <p className="text-xs text-gray-500 mt-1">{ratios.current_ratio?.description}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${getStatusColor(ratios.current_ratio?.status)}`}>
              {ratios.current_ratio?.status}
            </span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900">{ratios.current_ratio?.value}</p>
              <p className="text-sm text-gray-500">Benchmark: {ratios.current_ratio?.benchmark}</p>
            </div>
            <Gauge className={`h-10 w-10 ${ratios.current_ratio?.status === 'good' ? 'text-green-500' : ratios.current_ratio?.status === 'fair' ? 'text-amber-500' : 'text-red-500'}`} />
          </div>
          <div className="mt-4 p-3 bg-gray-800/50 rounded-lg text-sm text-gray-600">
            <p>Measures ability to pay short-term debts. Higher than 2.0 is ideal.</p>
          </div>
        </Card>

        {/* Quick Ratio */}
        <Card className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Quick Ratio</h3>
              <p className="text-xs text-gray-500 mt-1">{ratios.quick_ratio?.description}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${getStatusColor(ratios.quick_ratio?.status)}`}>
              {ratios.quick_ratio?.status}
            </span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900">{ratios.quick_ratio?.value}</p>
              <p className="text-sm text-gray-500">Benchmark: {ratios.quick_ratio?.benchmark}</p>
            </div>
            <BarChart3 className={`h-10 w-10 ${ratios.quick_ratio?.status === 'good' ? 'text-green-500' : 'text-red-500'}`} />
          </div>
          <div className="mt-4 p-3 bg-gray-800/50 rounded-lg text-sm text-gray-600">
            <p>Liquidity without inventory. Should be at least 1.0.</p>
          </div>
        </Card>

        {/* Profit Margin */}
        <Card className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Profit Margin</h3>
              <p className="text-xs text-gray-500 mt-1">{ratios.profit_margin?.description}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${getStatusColor(ratios.profit_margin?.status)}`}>
              {ratios.profit_margin?.status}
            </span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900">{ratios.profit_margin?.value}%</p>
              <p className="text-sm text-gray-500">Benchmark: {ratios.profit_margin?.benchmark}%</p>
            </div>
            {ratios.profit_margin?.value >= 0 ? (
              <TrendingUp className="h-10 w-10 text-green-500" />
            ) : (
              <TrendingDown className="h-10 w-10 text-red-500" />
            )}
          </div>
          <div className="mt-4 p-3 bg-gray-800/50 rounded-lg text-sm text-gray-600">
            <p>Percentage of revenue retained as profit. Higher is better.</p>
          </div>
        </Card>

        {/* Expense Ratio */}
        <Card className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Expense Ratio</h3>
              <p className="text-xs text-gray-500 mt-1">{ratios.expense_ratio?.description}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${getStatusColor(ratios.expense_ratio?.status)}`}>
              {ratios.expense_ratio?.status}
            </span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900">{ratios.expense_ratio?.value}%</p>
              <p className="text-sm text-gray-500">Benchmark: ≤{ratios.expense_ratio?.benchmark}%</p>
            </div>
            <PieChart className={`h-10 w-10 ${ratios.expense_ratio?.status === 'good' ? 'text-green-500' : ratios.expense_ratio?.status === 'fair' ? 'text-amber-500' : 'text-red-500'}`} />
          </div>
          <div className="mt-4 p-3 bg-gray-800/50 rounded-lg text-sm text-gray-600">
            <p>Percentage of revenue spent on expenses. Lower is better.</p>
          </div>
        </Card>
      </div>

      {/* Underlying Data */}
      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-gray-600" />
          Underlying Financial Data
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 bg-blue-500/10 rounded-lg text-center">
            <p className="text-xs text-gray-600 mb-1">Total Cash</p>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(underlying.total_cash)}</p>
          </div>
          <div className="p-4 bg-red-500/10 rounded-lg text-center">
            <p className="text-xs text-gray-600 mb-1">Liabilities</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(underlying.total_current_liabilities)}</p>
          </div>
          <div className="p-4 bg-green-500/10 rounded-lg text-center">
            <p className="text-xs text-gray-600 mb-1">Income</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(underlying.total_income)}</p>
          </div>
          <div className="p-4 bg-orange-500/10 rounded-lg text-center">
            <p className="text-xs text-gray-600 mb-1">Expenses</p>
            <p className="text-lg font-bold text-orange-600">{formatCurrency(underlying.total_expenses)}</p>
          </div>
          <div className={`p-4 rounded-lg text-center ${underlying.net_profit >= 0 ? 'bg-emerald-500/10' : 'bg-rose-50'}`}>
            <p className="text-xs text-gray-600 mb-1">Net Profit/Loss</p>
            <p className={`text-lg font-bold ${underlying.net_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(underlying.net_profit)}
            </p>
          </div>
        </div>
      </Card>

      {/* Tips Card */}
      <Card className="mt-6 p-5 bg-purple-500/10 border-purple-500/30">
        <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Improvement Tips
        </h3>
        <ul className="space-y-2 text-sm text-purple-800">
          {ratios.profit_margin?.status === 'poor' && (
            <li className="flex items-start gap-2">
              <ArrowUpRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Increase revenue or reduce expenses to improve profit margin</span>
            </li>
          )}
          {ratios.expense_ratio?.status === 'poor' && (
            <li className="flex items-start gap-2">
              <ArrowDownRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Review and cut unnecessary expenses to bring expense ratio below 70%</span>
            </li>
          )}
          {ratios.current_ratio?.value < 2 && (
            <li className="flex items-start gap-2">
              <DollarSign className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Improve cash reserves or reduce short-term liabilities</span>
            </li>
          )}
          {data?.health_score >= 80 && (
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
              <span>Great job! Your financial health is excellent. Keep maintaining good practices.</span>
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
};

export default AdminFinancialRatios;
