import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, TrendingUp, TrendingDown, RefreshCw, Download,
  Calendar, BarChart3, PieChart, DollarSign, Coins, Building2,
  ArrowUpRight, ArrowDownRight, Scale, ChevronDown, Wallet,
  CircleDollarSign, Flame, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminFinancialReports = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState('pnl'); // pnl, balance, prc_flow
  const [pnlData, setPnlData] = useState(null);
  const [balanceSheetData, setBalanceSheetData] = useState(null);
  const [prcFlowData, setPrcFlowData] = useState(null);
  
  // Month/Year selector
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchReports();
  }, [user, navigate, selectedMonth, selectedYear]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [pnlRes, balanceRes, prcFlowRes] = await Promise.all([
        axios.get(`${API}/api/admin/reports/profit-loss-statement`, {
          params: { month: selectedMonth, year: selectedYear }
        }),
        axios.get(`${API}/api/admin/reports/balance-sheet`),
        axios.get(`${API}/api/admin/reports/prc-flow`, {
          params: { month: selectedMonth, year: selectedYear }
        })
      ]);
      setPnlData(pnlRes.data);
      setBalanceSheetData(balanceRes.data);
      setPrcFlowData(prcFlowRes.data);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to load financial reports');
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

  const formatPRC = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (loading && !pnlData) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="reports-loading">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6" data-testid="admin-financial-reports">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-7 w-7 text-purple-600" />
            Financial Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">Monthly P&L, Balance Sheet, and PRC Flow Reports</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Month/Year Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            {months.map((month, idx) => (
              <option key={idx} value={idx + 1}>{month}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            {[2024, 2025, 2026].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <Button variant="outline" onClick={fetchReports} size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        {[
          { id: 'pnl', label: 'Profit & Loss', icon: TrendingUp },
          { id: 'balance', label: 'Balance Sheet', icon: Scale },
          { id: 'prc_flow', label: 'PRC Flow', icon: Coins }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeReport === tab.id
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid={`tab-${tab.id}`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Content */}
      <AnimatePresence mode="wait">
        {/* Profit & Loss Statement */}
        {activeReport === 'pnl' && pnlData && (
          <motion.div
            key="pnl"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* P&L Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-5 bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                <p className="text-green-100 text-sm">Total Income</p>
                <h2 className="text-2xl font-bold mt-1">{formatCurrency(pnlData.income?.total)}</h2>
                <ArrowUpRight className="h-5 w-5 mt-2 opacity-60" />
              </Card>
              <Card className="p-5 bg-gradient-to-br from-red-500 to-rose-600 text-white">
                <p className="text-red-100 text-sm">Total Expenses</p>
                <h2 className="text-2xl font-bold mt-1">{formatCurrency(pnlData.expenses?.total)}</h2>
                <ArrowDownRight className="h-5 w-5 mt-2 opacity-60" />
              </Card>
              <Card className={`p-5 text-white ${pnlData.net_profit >= 0 ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-orange-500 to-red-600'}`}>
                <p className="text-blue-100 text-sm">{pnlData.net_profit >= 0 ? 'Net Profit' : 'Net Loss'}</p>
                <h2 className="text-2xl font-bold mt-1">{formatCurrency(Math.abs(pnlData.net_profit))}</h2>
                <span className="text-sm mt-2 opacity-75">{pnlData.profit_margin}% margin</span>
              </Card>
              <Card className="p-5 bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                <p className="text-amber-100 text-sm">PRC Net Liability</p>
                <h2 className="text-2xl font-bold mt-1">{formatCurrency(pnlData.prc_metrics?.net_liability)}</h2>
                <Coins className="h-5 w-5 mt-2 opacity-60" />
              </Card>
            </div>

            {/* Income & Expense Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ArrowUpRight className="h-5 w-5 text-green-600" />
                  Income Breakdown
                </h3>
                {Object.keys(pnlData.income?.categories || {}).length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No income recorded this month</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(pnlData.income?.categories || {}).map(([category, amount]) => (
                      <div key={category} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {category.replace('_', ' ')}
                        </span>
                        <span className="font-semibold text-green-600">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ArrowDownRight className="h-5 w-5 text-red-600" />
                  Expense Breakdown
                </h3>
                {Object.keys(pnlData.expenses?.categories || {}).length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No expenses recorded this month</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(pnlData.expenses?.categories || {}).map(([category, amount]) => (
                      <div key={category} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {category.replace('_', ' ')}
                        </span>
                        <span className="font-semibold text-red-600">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* PRC Metrics */}
            <Card className="p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-600" />
                PRC Metrics for {pnlData.period}
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <p className="text-sm text-gray-600">Mined</p>
                  <p className="text-xl font-bold text-green-600">{formatPRC(pnlData.prc_metrics?.mined)} PRC</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                  <p className="text-sm text-gray-600">Consumed</p>
                  <p className="text-xl font-bold text-blue-600">{formatPRC(pnlData.prc_metrics?.consumed)} PRC</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg text-center">
                  <p className="text-sm text-gray-600">Burned</p>
                  <p className="text-xl font-bold text-red-600">{formatPRC(pnlData.prc_metrics?.burned)} PRC</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Balance Sheet */}
        {activeReport === 'balance' && balanceSheetData && (
          <motion.div
            key="balance"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Balance Check */}
            <Card className={`p-4 ${balanceSheetData.balance_check?.is_balanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-3">
                {balanceSheetData.balance_check?.is_balanced ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-600" />
                )}
                <div>
                  <p className={`font-medium ${balanceSheetData.balance_check?.is_balanced ? 'text-green-800' : 'text-red-800'}`}>
                    {balanceSheetData.balance_check?.is_balanced ? 'Balance Sheet is Balanced ✓' : 'Balance Sheet Mismatch!'}
                  </p>
                  <p className="text-sm text-gray-600">
                    Assets: {formatCurrency(balanceSheetData.balance_check?.assets)} | 
                    Liabilities + Equity: {formatCurrency(balanceSheetData.balance_check?.liabilities_plus_equity)}
                  </p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Assets */}
              <Card className="p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 border-b pb-3">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  Assets
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Current Assets</p>
                    <div className="space-y-2">
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">Cash in Hand</span>
                        <span className="font-medium">{formatCurrency(balanceSheetData.assets?.current_assets?.cash_in_hand)}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">Bank Balance</span>
                        <span className="font-medium">{formatCurrency(balanceSheetData.assets?.current_assets?.bank_balance)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total Assets</span>
                      <span className="text-blue-600">{formatCurrency(balanceSheetData.assets?.total_assets)}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Liabilities */}
              <Card className="p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 border-b pb-3">
                  <Scale className="h-5 w-5 text-red-600" />
                  Liabilities
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Current Liabilities</p>
                    <div className="space-y-2">
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">PRC Redemption Liability</span>
                        <span className="font-medium">{formatCurrency(balanceSheetData.liabilities?.current_liabilities?.prc_redemption_liability)}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-amber-50 rounded text-sm">
                        <span className="text-amber-700">PRC in Circulation</span>
                        <span className="font-medium text-amber-700">{formatPRC(balanceSheetData.liabilities?.current_liabilities?.prc_in_circulation)} PRC</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total Liabilities</span>
                      <span className="text-red-600">{formatCurrency(balanceSheetData.liabilities?.total_liabilities)}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Equity */}
              <Card className="p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 border-b pb-3">
                  <CircleDollarSign className="h-5 w-5 text-green-600" />
                  Equity
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">Capital</span>
                      <span className="font-medium">{formatCurrency(balanceSheetData.equity?.capital)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">Retained Earnings</span>
                      <span className={`font-medium ${balanceSheetData.equity?.retained_earnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(balanceSheetData.equity?.retained_earnings)}
                      </span>
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total Equity</span>
                      <span className="text-green-600">{formatCurrency(balanceSheetData.equity?.total_equity)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </motion.div>
        )}

        {/* PRC Flow Report */}
        {activeReport === 'prc_flow' && prcFlowData && (
          <motion.div
            key="prc_flow"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Flow Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-5 bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                <p className="text-green-100 text-sm">Total Inflow</p>
                <h2 className="text-2xl font-bold mt-1">{formatPRC(prcFlowData.inflow?.total)} PRC</h2>
                <p className="text-green-200 text-sm mt-1">≈ {formatCurrency(prcFlowData.inflow?.inr_value)}</p>
              </Card>
              <Card className="p-5 bg-gradient-to-br from-red-500 to-rose-600 text-white">
                <p className="text-red-100 text-sm">Total Outflow</p>
                <h2 className="text-2xl font-bold mt-1">{formatPRC(prcFlowData.outflow?.total)} PRC</h2>
                <p className="text-red-200 text-sm mt-1">≈ {formatCurrency(prcFlowData.outflow?.inr_value)}</p>
              </Card>
              <Card className={`p-5 text-white ${prcFlowData.net_flow?.prc >= 0 ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-orange-500 to-red-600'}`}>
                <p className="opacity-75 text-sm">Net Flow</p>
                <h2 className="text-2xl font-bold mt-1">{prcFlowData.net_flow?.prc >= 0 ? '+' : ''}{formatPRC(prcFlowData.net_flow?.prc)} PRC</h2>
                <p className="opacity-75 text-sm mt-1">≈ {formatCurrency(prcFlowData.net_flow?.inr_value)}</p>
              </Card>
            </div>

            {/* Inflow & Outflow Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ArrowUpRight className="h-5 w-5 text-green-600" />
                  Inflow Breakdown
                </h3>
                <div className="space-y-3">
                  {Object.entries(prcFlowData.inflow?.breakdown || {}).map(([type, amount]) => (
                    amount > 0 && (
                      <div key={type} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {type.replace('_', ' ')}
                        </span>
                        <span className="font-semibold text-green-600">+{formatPRC(amount)} PRC</span>
                      </div>
                    )
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ArrowDownRight className="h-5 w-5 text-red-600" />
                  Outflow Breakdown
                </h3>
                <div className="space-y-3">
                  {Object.entries(prcFlowData.outflow?.breakdown || {}).map(([type, amount]) => (
                    amount > 0 && (
                      <div key={type} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {type.replace('_', ' ')}
                        </span>
                        <span className="font-semibold text-red-600">-{formatPRC(amount)} PRC</span>
                      </div>
                    )
                  ))}
                </div>
              </Card>
            </div>

            {/* Daily Breakdown */}
            <Card className="p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-600" />
                Daily PRC Flow
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Date</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Inflow</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Outflow</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {prcFlowData.daily_breakdown?.slice(0, 10).map((day, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm">{day.date}</td>
                        <td className="px-4 py-2 text-right text-sm text-green-600">+{formatPRC(day.inflow)}</td>
                        <td className="px-4 py-2 text-right text-sm text-red-600">-{formatPRC(day.outflow)}</td>
                        <td className={`px-4 py-2 text-right text-sm font-medium ${day.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                          {day.net >= 0 ? '+' : ''}{formatPRC(day.net)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminFinancialReports;
