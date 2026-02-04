import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  ArrowLeft, RefreshCw, AlertTriangle, CheckCircle, XCircle,
  TrendingUp, TrendingDown, DollarSign, Coins, Shield, Users,
  PieChart, BarChart3, Clock, Settings, Download, Calendar,
  Wallet, Receipt, FileText, AlertCircle, Activity, Percent,
  Eye, LayoutGrid, Banknote, CreditCard, IndianRupee
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const AdminAccountingDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [viewMode, setViewMode] = useState('quick'); // 'quick' or 'detailed'
  
  const [dashboardData, setDashboardData] = useState(null);
  const [mintLedger, setMintLedger] = useState(null);
  const [burnLedger, setBurnLedger] = useState(null);
  const [liabilityLedger, setLiabilityLedger] = useState(null);
  const [reserveFund, setReserveFund] = useState(null);
  const [dailySummaries, setDailySummaries] = useState(null);
  const [userCostAnalysis, setUserCostAnalysis] = useState(null);
  const [accountingSettings, setAccountingSettings] = useState(null);
  const [conversionRate, setConversionRate] = useState(null);
  
  // Quick View data from new ledger endpoints
  const [quickViewData, setQuickViewData] = useState(null);

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
      const [
        dashboardRes,
        settingsRes,
        rateRes,
        masterSummaryRes,
        cashRes,
        bankRes
      ] = await Promise.all([
        axios.get(`${API}/api/admin/accounting/master-dashboard`),
        axios.get(`${API}/api/admin/accounting/settings`),
        axios.get(`${API}/api/admin/accounting/conversion-rate`),
        // New ledger endpoints for Quick View
        axios.get(`${API}/api/admin/ledger/master-summary`),
        axios.get(`${API}/api/admin/ledger/cash`),
        axios.get(`${API}/api/admin/ledger/bank`)
      ]);
      
      setDashboardData(dashboardRes.data);
      setAccountingSettings(settingsRes.data);
      setConversionRate(rateRes.data);
      
      // Set Quick View data
      setQuickViewData({
        masterSummary: masterSummaryRes.data,
        cashBalance: cashRes.data.current_balance || 0,
        bankBalance: bankRes.data.current_balance || 0
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load accounting data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTabData = async (tab) => {
    try {
      switch(tab) {
        case 'mint':
          const mintRes = await axios.get(`${API}/api/admin/accounting/prc-mint-ledger?limit=50`);
          setMintLedger(mintRes.data);
          break;
        case 'burn':
          const burnRes = await axios.get(`${API}/api/admin/accounting/prc-burn-ledger?limit=50`);
          setBurnLedger(burnRes.data);
          break;
        case 'liability':
          const liabilityRes = await axios.get(`${API}/api/admin/accounting/liability-ledger?limit=50`);
          setLiabilityLedger(liabilityRes.data);
          break;
        case 'reserve':
          const reserveRes = await axios.get(`${API}/api/admin/accounting/reserve-fund`);
          setReserveFund(reserveRes.data);
          break;
        case 'daily':
          const dailyRes = await axios.get(`${API}/api/admin/accounting/daily-summary?days=30`);
          setDailySummaries(dailyRes.data);
          break;
        case 'users':
          const usersRes = await axios.get(`${API}/api/admin/accounting/user-cost-analysis?limit=50`);
          setUserCostAnalysis(usersRes.data);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error(`Error fetching ${tab} data:`, error);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    fetchTabData(tab);
  };

  const handleGenerateDailySummary = async () => {
    setRefreshing(true);
    try {
      await axios.post(`${API}/api/admin/accounting/daily-summary/generate`, {});
      toast.success('Daily summary generated successfully!');
      fetchTabData('daily');
    } catch (error) {
      toast.error('Failed to generate daily summary');
    } finally {
      setRefreshing(false);
    }
  };

  const handleUpdateSettings = async (newSettings) => {
    try {
      await axios.post(`${API}/api/admin/accounting/settings`, newSettings);
      toast.success('Settings updated successfully!');
      setAccountingSettings({ ...accountingSettings, ...newSettings });
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const handleAddToReserveFund = async () => {
    const amount = prompt('Enter amount to add to Reserve Fund (INR):');
    if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
      try {
        await axios.post(`${API}/api/admin/accounting/reserve-fund/add`, {
          amount: parseFloat(amount),
          reason: 'Manual addition by admin'
        });
        toast.success(`₹${amount} added to Reserve Fund`);
        fetchTabData('reserve');
        fetchAllData();
      } catch (error) {
        toast.error('Failed to add to reserve fund');
      }
    }
  };

  const handleBurnInactivePRC = async () => {
    if (window.confirm('This will burn PRC for all users inactive for 180+ days. Continue?')) {
      try {
        const res = await axios.post(`${API}/api/admin/accounting/burn-inactive-prc`);
        toast.success(`Burned PRC for ${res.data.result.users_affected} users (${res.data.result.total_burned} PRC)`);
        fetchAllData();
      } catch (error) {
        toast.error('Failed to burn inactive PRC');
      }
    }
  };

  const formatCurrency = (value) => {
    return `₹${(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPRC = (value) => {
    return `${(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PRC`;
  };

  const getRiskColor = (status) => {
    switch(status) {
      case 'SAFE': return 'text-green-600 bg-green-500/20';
      case 'WARNING': return 'text-yellow-600 bg-yellow-500/20';
      case 'CRITICAL': return 'text-red-600 bg-red-500/20';
      default: return 'text-gray-400 bg-gray-800';
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: PieChart },
    { id: 'mint', label: 'PRC Mint', icon: TrendingUp },
    { id: 'burn', label: 'PRC Burn', icon: TrendingDown },
    { id: 'liability', label: 'Liability', icon: Receipt },
    { id: 'reserve', label: 'Reserve Fund', icon: Shield },
    { id: 'daily', label: 'Daily Summary', icon: Calendar },
    { id: 'users', label: 'User Analysis', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-800/50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-400">Loading Accounting Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-800/50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/admin')} size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-purple-600" />
                Fintech Accounting System
              </h1>
              <p className="text-sm text-gray-500">Advanced P&L, Liability & Risk Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-900 rounded-lg shadow-sm border overflow-hidden" data-testid="view-mode-toggle">
              <button
                onClick={() => setViewMode('quick')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'quick' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-gray-400 hover:bg-gray-800'
                }`}
                data-testid="quick-view-btn"
              >
                <Eye className="h-4 w-4" />
                Quick View
              </button>
              <button
                onClick={() => setViewMode('detailed')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'detailed' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-gray-400 hover:bg-gray-800'
                }`}
                data-testid="detailed-view-btn"
              >
                <LayoutGrid className="h-4 w-4" />
                Detailed
              </button>
            </div>
            <Button onClick={fetchAllData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* QUICK VIEW MODE */}
        {viewMode === 'quick' && quickViewData && (
          <div className="space-y-6" data-testid="quick-view-dashboard">
            {/* Main Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Total Income */}
              <Card 
                className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 border-green-500/30 cursor-pointer hover:shadow-lg transition-shadow" 
                data-testid="total-income-card"
                onClick={() => navigate('/admin/income-sources')}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-green-400">Total Income</span>
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-green-400">
                  {formatCurrency(quickViewData.masterSummary?.income?.total || 0)}
                </div>
                <div className="text-xs text-green-600 mt-1">All revenue sources</div>
              </Card>

              {/* Total Expense */}
              <Card 
                className="p-5 bg-gradient-to-br from-red-50 to-rose-50 border-red-500/30 cursor-pointer hover:shadow-lg transition-shadow" 
                data-testid="total-expense-card"
                onClick={() => navigate('/admin/expenses')}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-red-400">Total Expense</span>
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-red-400">
                  {formatCurrency(quickViewData.masterSummary?.expense?.total || 0)}
                </div>
                <div className="text-xs text-red-600 mt-1">All outflows</div>
              </Card>

              {/* Net P&L */}
              <Card 
                className={`p-5 border-2 cursor-pointer hover:shadow-lg transition-shadow ${
                  (quickViewData.masterSummary?.net_profit_loss || 0) >= 0 
                    ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-300' 
                    : 'bg-gradient-to-br from-orange-50 to-red-50 border-orange-300'
                }`} 
                data-testid="net-pl-card"
                onClick={() => navigate('/admin/financial-reports')}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm font-medium ${
                    (quickViewData.masterSummary?.net_profit_loss || 0) >= 0 ? 'text-emerald-400' : 'text-orange-400'
                  }`}>Net P&L</span>
                  <div className={`p-2 rounded-lg ${
                    (quickViewData.masterSummary?.net_profit_loss || 0) >= 0 ? 'bg-emerald-500/20' : 'bg-orange-500/20'
                  }`}>
                    <IndianRupee className={`h-5 w-5 ${
                      (quickViewData.masterSummary?.net_profit_loss || 0) >= 0 ? 'text-emerald-600' : 'text-orange-600'
                    }`} />
                  </div>
                </div>
                <div className={`text-2xl font-bold ${
                  (quickViewData.masterSummary?.net_profit_loss || 0) >= 0 ? 'text-emerald-400' : 'text-orange-400'
                }`}>
                  {formatCurrency(quickViewData.masterSummary?.net_profit_loss || 0)}
                </div>
                <div className={`text-xs mt-1 ${
                  (quickViewData.masterSummary?.net_profit_loss || 0) >= 0 ? 'text-emerald-600' : 'text-orange-600'
                }`}>
                  {(quickViewData.masterSummary?.net_profit_loss || 0) >= 0 ? '✓ Profit' : '⚠ Loss'}
                </div>
              </Card>

              {/* Cash Balance */}
              <Card 
                className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-500/30 cursor-pointer hover:shadow-lg transition-shadow" 
                data-testid="cash-balance-card"
                onClick={() => navigate('/admin/cash-bank-book')}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-blue-400">Cash Balance</span>
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Banknote className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-blue-400">
                  {formatCurrency(quickViewData.cashBalance)}
                </div>
                <div className="text-xs text-blue-600 mt-1">Cash in hand</div>
              </Card>

              {/* Bank Balance */}
              <Card 
                className="p-5 bg-gradient-to-br from-purple-50 to-violet-50 border-purple-500/30 cursor-pointer hover:shadow-lg transition-shadow" 
                data-testid="bank-balance-card"
                onClick={() => navigate('/admin/cash-bank-book')}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-purple-400">Bank Balance</span>
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <CreditCard className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-purple-400">
                  {formatCurrency(quickViewData.bankBalance)}
                </div>
                <div className="text-xs text-purple-600 mt-1">Bank accounts</div>
              </Card>
            </div>

            {/* Income & Expense Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Income Breakdown */}
              <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow" data-testid="income-breakdown" onClick={() => navigate('/admin/income-sources')}>
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-green-400">
                  <TrendingUp className="h-5 w-5" />
                  Income Breakdown
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-700 hover:bg-gray-800/50 px-2 rounded cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate('/admin/income-sources'); }}>
                    <span className="text-gray-400">Ad Revenue</span>
                    <span className="font-semibold">{formatCurrency(quickViewData.masterSummary?.income?.ad_revenue || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-700 hover:bg-gray-800/50 px-2 rounded cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate('/admin/subscription-management'); }}>
                    <span className="text-gray-400">Subscription</span>
                    <span className="font-semibold">{formatCurrency(quickViewData.masterSummary?.income?.subscription || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-700 hover:bg-gray-800/50 px-2 rounded cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate('/admin/income-sources'); }}>
                    <span className="text-gray-400">Commission</span>
                    <span className="font-semibold">{formatCurrency(quickViewData.masterSummary?.income?.commission || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-700 hover:bg-gray-800/50 px-2 rounded cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate('/admin/income-sources'); }}>
                    <span className="text-gray-400">Interest</span>
                    <span className="font-semibold">{formatCurrency(quickViewData.masterSummary?.income?.interest || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 hover:bg-gray-800/50 px-2 rounded cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate('/admin/income-sources'); }}>
                    <span className="text-gray-400">Penalty/Forfeit</span>
                    <span className="font-semibold">{formatCurrency(quickViewData.masterSummary?.income?.penalty_forfeit || 0)}</span>
                  </div>
                </div>
              </Card>

              {/* Expense Breakdown */}
              <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow" data-testid="expense-breakdown" onClick={() => navigate('/admin/expenses')}>
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-red-400">
                  <TrendingDown className="h-5 w-5" />
                  Expense Breakdown
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-700 hover:bg-gray-800/50 px-2 rounded cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate('/admin/fixed-expenses'); }}>
                    <span className="text-gray-400">Operational Expenses</span>
                    <span className="font-semibold">{formatCurrency(quickViewData.masterSummary?.expense?.operational || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 hover:bg-gray-800/50 px-2 rounded cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate('/admin/expenses'); }}>
                    <span className="text-gray-400">Redemption Payouts</span>
                    <span className="font-semibold">{formatCurrency(quickViewData.masterSummary?.expense?.redeem_payouts || 0)}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* PRC Stats */}
            <Card className="p-6" data-testid="prc-stats">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-purple-400">
                <Coins className="h-5 w-5" />
                PRC Statistics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-purple-500/10 p-4 rounded-lg text-center">
                  <div className="text-sm text-purple-600 mb-1">Total PRC in System</div>
                  <div className="text-2xl font-bold text-purple-400">
                    {(quickViewData.masterSummary?.prc_stats?.total_in_system || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-blue-500/10 p-4 rounded-lg text-center">
                  <div className="text-sm text-blue-600 mb-1">INR Liability</div>
                  <div className="text-2xl font-bold text-blue-400">
                    {formatCurrency(quickViewData.masterSummary?.prc_stats?.inr_liability || 0)}
                  </div>
                </div>
                <div className="bg-gray-800/50 p-4 rounded-lg text-center">
                  <div className="text-sm text-gray-400 mb-1">Conversion Rate</div>
                  <div className="text-2xl font-bold text-gray-300">
                    1 INR = {quickViewData.masterSummary?.prc_stats?.conversion_rate || 10} PRC
                  </div>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <div className="flex justify-center gap-4">
              <Button 
                variant="outline" 
                onClick={() => setViewMode('detailed')}
                className="flex items-center gap-2"
              >
                <LayoutGrid className="h-4 w-4" />
                View Detailed Dashboard
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/admin/finance')}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Go to Finance Section
              </Button>
            </div>
          </div>
        )}

        {/* DETAILED VIEW MODE */}
        {viewMode === 'detailed' && (
          <>
        {/* Alerts */}
        {dashboardData?.alerts?.length > 0 && (
          <div className="mb-6 space-y-2">
            {dashboardData.alerts.map((alert, idx) => (
              <div 
                key={idx} 
                className={`p-4 rounded-lg flex items-center gap-3 ${
                  alert.type === 'CRITICAL' ? 'bg-red-500/20 border-red-300 border' : 'bg-yellow-500/20 border-yellow-300 border'
                }`}
              >
                <AlertTriangle className={`h-5 w-5 ${alert.type === 'CRITICAL' ? 'text-red-600' : 'text-yellow-600'}`} />
                <span className={alert.type === 'CRITICAL' ? 'text-red-400' : 'text-yellow-400'}>{alert.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 bg-gray-900 p-2 rounded-lg shadow-sm overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && dashboardData && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Risk Score */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Risk Score</span>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getRiskColor(dashboardData.risk.status)}`}>
                    {dashboardData.risk.status}
                  </span>
                </div>
                <div className="text-3xl font-bold">{dashboardData.risk.score}/100</div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className={`h-2 rounded-full ${
                      dashboardData.risk.score >= 70 ? 'bg-green-500/10' : 
                      dashboardData.risk.score >= 40 ? 'bg-yellow-500/10' : 'bg-red-500/10'
                    }`}
                    style={{ width: `${dashboardData.risk.score}%` }}
                  />
                </div>
              </Card>

              {/* PRC Circulating */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Circulating PRC</span>
                  <Coins className="h-5 w-5 text-purple-500" />
                </div>
                <div className="text-2xl font-bold">{formatPRC(dashboardData.prc_supply.circulating)}</div>
                <div className="text-sm text-gray-500">
                  INR Value: {formatCurrency(dashboardData.prc_supply.circulating_inr_value)}
                </div>
              </Card>

              {/* INR Liability */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">INR Liability</span>
                  <Receipt className="h-5 w-5 text-red-500" />
                </div>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(dashboardData.liability.total_inr_liability)}</div>
                <div className="text-sm text-gray-500">
                  Reserve: {formatCurrency(dashboardData.liability.reserve_fund)}
                </div>
              </Card>

              {/* Backing Ratio */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Backing Ratio</span>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    dashboardData.liability.backing_status === 'SAFE' ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'
                  }`}>
                    {dashboardData.liability.backing_status}
                  </span>
                </div>
                <div className="text-2xl font-bold">
                  {dashboardData.liability.backing_ratio === '∞' ? '∞' : dashboardData.liability.backing_ratio}x
                </div>
                <div className="text-xs text-gray-500">Target: ≥ 1.0x</div>
              </Card>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PRC Supply */}
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Coins className="h-5 w-5 text-purple-600" />
                  PRC Supply Overview
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Minted</span>
                    <span className="font-semibold text-green-600">{formatPRC(dashboardData.prc_supply.total_minted)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Burned</span>
                    <span className="font-semibold text-red-600">{formatPRC(dashboardData.prc_supply.total_burned)}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between">
                    <span className="text-gray-100 font-medium">Net Circulating</span>
                    <span className="font-bold">{formatPRC(dashboardData.prc_supply.circulating)}</span>
                  </div>
                </div>
              </Card>

              {/* Monthly Financials */}
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Monthly Financials
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Revenue</span>
                    <span className="font-semibold text-green-600">{formatCurrency(dashboardData.financials.monthly_revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Expenses</span>
                    <span className="font-semibold text-red-600">{formatCurrency(dashboardData.financials.monthly_expenses)}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between">
                    <span className="text-gray-100 font-medium">Net P&L</span>
                    <span className={`font-bold ${dashboardData.financials.monthly_profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(dashboardData.financials.monthly_profit_loss)}
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Company Wallets */}
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Wallet className="h-5 w-5 text-blue-600" />
                Company Wallets
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {dashboardData.wallets?.map((wallet, idx) => (
                  <div key={idx} className="bg-gray-800/50 p-4 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">{wallet.wallet_name || wallet.wallet_type}</div>
                    <div className="text-lg font-bold">{formatCurrency(wallet.balance)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <span className="font-medium">Total Cash Available</span>
                <span className="text-xl font-bold text-green-600">{formatCurrency(dashboardData.financials.total_cash_available)}</span>
              </div>
            </Card>

            {/* Users Overview */}
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                User Overview
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-100">{dashboardData.overview.total_users}</div>
                  <div className="text-sm text-gray-500">Total Users</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">{dashboardData.overview.vip_users}</div>
                  <div className="text-sm text-gray-500">VIP Users</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-100">{dashboardData.overview.conversion_rate}</div>
                  <div className="text-sm text-gray-500">Conversion Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600">
                    {((dashboardData.overview.vip_users / dashboardData.overview.total_users) * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500">VIP Conversion</div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* PRC Mint Ledger Tab */}
        {activeTab === 'mint' && (
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              PRC Mint Ledger (Inflows)
            </h3>
            {mintLedger ? (
              <>
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-green-500/10 p-4 rounded-lg">
                    <div className="text-sm text-green-600">Total Minted</div>
                    <div className="text-2xl font-bold text-green-400">{formatPRC(mintLedger.summary.total_minted)}</div>
                  </div>
                  {Object.entries(mintLedger.summary.by_source || {}).slice(0, 3).map(([source, data]) => (
                    <div key={source} className="bg-gray-800/50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500 capitalize">{source.replace('_', ' ')}</div>
                      <div className="text-lg font-bold">{formatPRC(data.prc)}</div>
                      <div className="text-xs text-gray-400">{data.count} transactions</div>
                    </div>
                  ))}
                </div>
                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">User</th>
                        <th className="px-4 py-2 text-left">Source</th>
                        <th className="px-4 py-2 text-right">PRC Amount</th>
                        <th className="px-4 py-2 text-left">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mintLedger.entries.map((entry, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-800/50">
                          <td className="px-4 py-2">{new Date(entry.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-2 text-xs">{entry.user_id?.slice(0, 8)}...</td>
                          <td className="px-4 py-2">
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs capitalize">
                              {entry.type?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-green-600">+{entry.amount?.toFixed(2)}</td>
                          <td className="px-4 py-2 text-xs text-gray-500">{entry.description?.slice(0, 50)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">Loading mint ledger...</div>
            )}
          </Card>
        )}

        {/* PRC Burn Ledger Tab */}
        {activeTab === 'burn' && (
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              PRC Burn Ledger (Outflows)
            </h3>
            {burnLedger ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-red-500/10 p-4 rounded-lg">
                    <div className="text-sm text-red-600">Total Burned</div>
                    <div className="text-2xl font-bold text-red-400">{formatPRC(burnLedger.summary.total_burned)}</div>
                  </div>
                  {Object.entries(burnLedger.summary.by_use_type || {}).slice(0, 3).map(([type, data]) => (
                    <div key={type} className="bg-gray-800/50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500 capitalize">{type.replace('_', ' ')}</div>
                      <div className="text-lg font-bold">{formatPRC(data.prc)}</div>
                      <div className="text-xs text-gray-400">{data.count} transactions</div>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">User</th>
                        <th className="px-4 py-2 text-left">Use Type</th>
                        <th className="px-4 py-2 text-right">PRC Amount</th>
                        <th className="px-4 py-2 text-left">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {burnLedger.entries.map((entry, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-800/50">
                          <td className="px-4 py-2">{new Date(entry.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-2 text-xs">{entry.user_id?.slice(0, 8)}...</td>
                          <td className="px-4 py-2">
                            <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs capitalize">
                              {entry.type?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-red-600">-{Math.abs(entry.amount)?.toFixed(2)}</td>
                          <td className="px-4 py-2 text-xs text-gray-500">{entry.description?.slice(0, 50)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">Loading burn ledger...</div>
            )}
          </Card>
        )}

        {/* Liability Ledger Tab */}
        {activeTab === 'liability' && (
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-orange-600" />
              Liability Ledger (INR Redemptions)
            </h3>
            {liabilityLedger ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-orange-500/10 p-4 rounded-lg">
                    <div className="text-sm text-orange-600">Total INR Liability</div>
                    <div className="text-2xl font-bold text-orange-400">{formatCurrency(liabilityLedger.summary.total_inr_liability)}</div>
                  </div>
                  <div className="bg-green-500/10 p-4 rounded-lg">
                    <div className="text-sm text-green-600">INR Paid</div>
                    <div className="text-2xl font-bold text-green-400">{formatCurrency(liabilityLedger.summary.inr_paid)}</div>
                  </div>
                  <div className="bg-red-500/10 p-4 rounded-lg">
                    <div className="text-sm text-red-600">INR Pending</div>
                    <div className="text-2xl font-bold text-red-400">{formatCurrency(liabilityLedger.summary.inr_pending)}</div>
                  </div>
                  <div className="bg-gray-800/50 p-4 rounded-lg">
                    <div className="text-sm text-gray-400">Conversion Rate</div>
                    <div className="text-xl font-bold">1 INR = {liabilityLedger.summary.conversion_rate} PRC</div>
                  </div>
                </div>
                
                {/* Ageing Analysis */}
                <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
                  <h4 className="font-semibold mb-3">Liability Ageing</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{formatCurrency(liabilityLedger.ageing.safe_0_7_days)}</div>
                      <div className="text-sm text-gray-500">0-7 Days (Safe)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{formatCurrency(liabilityLedger.ageing.warning_8_30_days)}</div>
                      <div className="text-sm text-gray-500">8-30 Days (Warning)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{formatCurrency(liabilityLedger.ageing.critical_31_plus_days)}</div>
                      <div className="text-sm text-gray-500">31+ Days (Critical)</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">Loading liability ledger...</div>
            )}
          </Card>
        )}

        {/* Reserve Fund Tab */}
        {activeTab === 'reserve' && (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Reserve Fund Management
              </h3>
              <Button onClick={handleAddToReserveFund}>
                Add to Reserve Fund
              </Button>
            </div>
            {reserveFund ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-500/10 p-4 rounded-lg">
                    <div className="text-sm text-blue-600">Reserve Balance</div>
                    <div className="text-2xl font-bold text-blue-400">{formatCurrency(reserveFund.balance)}</div>
                  </div>
                  <div className="bg-orange-500/10 p-4 rounded-lg">
                    <div className="text-sm text-orange-600">Total Liability</div>
                    <div className="text-2xl font-bold text-orange-400">{formatCurrency(reserveFund.total_liability_inr)}</div>
                  </div>
                  <div className="bg-gray-800/50 p-4 rounded-lg">
                    <div className="text-sm text-gray-400">Backing Ratio</div>
                    <div className="text-2xl font-bold">{reserveFund.backing_ratio}x</div>
                  </div>
                  <div className={`p-4 rounded-lg ${reserveFund.status === 'SAFE' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    <div className={`text-sm ${reserveFund.status === 'SAFE' ? 'text-green-600' : 'text-red-600'}`}>Status</div>
                    <div className={`text-2xl font-bold ${reserveFund.status === 'SAFE' ? 'text-green-400' : 'text-red-400'}`}>
                      {reserveFund.status}
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-blue-500/10 rounded-lg mb-4">
                  <p className="text-sm text-blue-400">
                    <strong>Auto Allocation:</strong> {reserveFund.percentage}% of daily profit is automatically allocated to the reserve fund.
                    Target backing ratio is ≥ 1.0x (Reserve Fund ≥ Total Liability).
                  </p>
                </div>

                {reserveFund.history?.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Recent Activity</h4>
                    <div className="space-y-2">
                      {reserveFund.history.slice(0, 10).map((entry, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-gray-800/50 rounded">
                          <div>
                            <span className="text-sm">{entry.reason}</span>
                            <div className="text-xs text-gray-500">{new Date(entry.created_at).toLocaleString()}</div>
                          </div>
                          <span className={`font-semibold ${entry.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                            {entry.type === 'credit' ? '+' : '-'}{formatCurrency(entry.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">Loading reserve fund data...</div>
            )}
          </Card>
        )}

        {/* Daily Summary Tab */}
        {activeTab === 'daily' && (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                Daily System Summary
              </h3>
              <Button onClick={handleGenerateDailySummary} disabled={refreshing}>
                {refreshing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Activity className="h-4 w-4 mr-2" />}
                Generate Today&apos;s Summary
              </Button>
            </div>
            {dailySummaries ? (
              <>
                {dailySummaries.trends && (
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className={`p-3 rounded-lg ${dailySummaries.trends.prc_minted_change >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      <div className="text-xs text-gray-500">PRC Minted Change</div>
                      <div className={`font-bold ${dailySummaries.trends.prc_minted_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {dailySummaries.trends.prc_minted_change >= 0 ? '+' : ''}{dailySummaries.trends.prc_minted_change}
                      </div>
                    </div>
                    <div className={`p-3 rounded-lg ${dailySummaries.trends.prc_burned_change >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      <div className="text-xs text-gray-500">PRC Burned Change</div>
                      <div className={`font-bold ${dailySummaries.trends.prc_burned_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {dailySummaries.trends.prc_burned_change >= 0 ? '+' : ''}{dailySummaries.trends.prc_burned_change}
                      </div>
                    </div>
                    <div className={`p-3 rounded-lg ${dailySummaries.trends.revenue_change >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      <div className="text-xs text-gray-500">Revenue Change</div>
                      <div className={`font-bold ${dailySummaries.trends.revenue_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {dailySummaries.trends.revenue_change >= 0 ? '+' : ''}₹{dailySummaries.trends.revenue_change}
                      </div>
                    </div>
                    <div className={`p-3 rounded-lg ${dailySummaries.trends.risk_score_change >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      <div className="text-xs text-gray-500">Risk Score Change</div>
                      <div className={`font-bold ${dailySummaries.trends.risk_score_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {dailySummaries.trends.risk_score_change >= 0 ? '+' : ''}{dailySummaries.trends.risk_score_change}
                      </div>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-right">Active Users</th>
                        <th className="px-3 py-2 text-right">PRC Minted</th>
                        <th className="px-3 py-2 text-right">PRC Burned</th>
                        <th className="px-3 py-2 text-right">Revenue</th>
                        <th className="px-3 py-2 text-right">Expense</th>
                        <th className="px-3 py-2 text-right">Net P&L</th>
                        <th className="px-3 py-2 text-center">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySummaries.summaries?.map((summary, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-800/50">
                          <td className="px-3 py-2">{summary.date}</td>
                          <td className="px-3 py-2 text-right">{summary.active_users}</td>
                          <td className="px-3 py-2 text-right text-green-600">{summary.prc_minted?.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-red-600">{summary.prc_burned?.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-green-600">₹{summary.revenue_inr?.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-red-600">₹{summary.expense_inr?.toFixed(2)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${summary.net_profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ₹{summary.net_profit_loss?.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-1 rounded text-xs ${getRiskColor(summary.risk_status)}`}>
                              {summary.risk_score}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">Loading daily summaries...</div>
            )}
          </Card>
        )}

        {/* User Cost Analysis Tab */}
        {activeTab === 'users' && (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                User Cost Analysis
              </h3>
              <Button variant="destructive" onClick={handleBurnInactivePRC}>
                Burn Inactive User PRC (180+ days)
              </Button>
            </div>
            {userCostAnalysis ? (
              <>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-purple-500/10 p-4 rounded-lg">
                    <div className="text-sm text-purple-600">Total PRC Distributed (INR Value)</div>
                    <div className="text-2xl font-bold text-purple-400">{formatCurrency(userCostAnalysis.summary.total_prc_distributed_value_inr)}</div>
                  </div>
                  <div className="bg-green-500/10 p-4 rounded-lg">
                    <div className="text-sm text-green-600">Total PRC Redeemed (INR Value)</div>
                    <div className="text-2xl font-bold text-green-400">{formatCurrency(userCostAnalysis.summary.total_prc_redeemed_value_inr)}</div>
                  </div>
                  <div className={`p-4 rounded-lg ${userCostAnalysis.summary.net_system_cost >= 0 ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                    <div className={`text-sm ${userCostAnalysis.summary.net_system_cost >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      Net System Cost
                    </div>
                    <div className={`text-2xl font-bold ${userCostAnalysis.summary.net_system_cost >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {formatCurrency(Math.abs(userCostAnalysis.summary.net_system_cost))}
                      <span className="text-sm ml-1">{userCostAnalysis.summary.net_system_cost >= 0 ? '(Loss)' : '(Profit)'}</span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-left">User</th>
                        <th className="px-3 py-2 text-left">Membership</th>
                        <th className="px-3 py-2 text-right">PRC Earned</th>
                        <th className="px-3 py-2 text-right">PRC Spent</th>
                        <th className="px-3 py-2 text-right">Net Cost (INR)</th>
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userCostAnalysis.users?.map((user, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-800/50">
                          <td className="px-3 py-2">
                            <div className="font-medium">{user.name || 'N/A'}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-1 rounded text-xs ${user.membership_type === 'vip' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800'}`}>
                              {user.membership_type}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">{formatCurrency(user.earned_inr_value)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(user.spent_inr_value)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${user.net_cost > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(Math.abs(user.net_cost))}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-1 rounded text-xs ${user.status === 'LOSS' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                              {user.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">Loading user cost analysis...</div>
            )}
          </Card>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && accountingSettings && (
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5 text-gray-400" />
              Accounting Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Conversion Rate */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Coins className="h-4 w-4" />
                  Conversion Rate
                </h4>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-sm text-gray-500">PRC per 1 INR</label>
                    <input
                      type="number"
                      value={accountingSettings.prc_per_inr}
                      onChange={(e) => setAccountingSettings({ ...accountingSettings, prc_per_inr: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg mt-1"
                    />
                  </div>
                  <Button onClick={() => handleUpdateSettings({ prc_per_inr: accountingSettings.prc_per_inr })}>
                    Update
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Current: 1 INR = {accountingSettings.prc_per_inr} PRC</p>
              </div>

              {/* Reserve Fund Percentage */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Reserve Fund Allocation
                </h4>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-sm text-gray-500">% of Daily Profit</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={accountingSettings.reserve_fund_percentage}
                      onChange={(e) => setAccountingSettings({ ...accountingSettings, reserve_fund_percentage: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg mt-1"
                    />
                  </div>
                  <Button onClick={() => handleUpdateSettings({ reserve_fund_percentage: accountingSettings.reserve_fund_percentage })}>
                    Update
                  </Button>
                </div>
              </div>

              {/* Inactive Expiry Days */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  PRC Expiry for Inactive Users
                </h4>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-sm text-gray-500">Days of Inactivity</label>
                    <input
                      type="number"
                      min="30"
                      value={accountingSettings.inactive_expiry_days}
                      onChange={(e) => setAccountingSettings({ ...accountingSettings, inactive_expiry_days: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg mt-1"
                    />
                  </div>
                  <Button onClick={() => handleUpdateSettings({ inactive_expiry_days: accountingSettings.inactive_expiry_days })}>
                    Update
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">PRC will be burned after {accountingSettings.inactive_expiry_days} days of user inactivity</p>
              </div>

              {/* Liability Thresholds */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Alert Thresholds
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-500">Warning Threshold (Backing Ratio)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={accountingSettings.liability_warning_threshold}
                      onChange={(e) => setAccountingSettings({ ...accountingSettings, liability_warning_threshold: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Critical Threshold (Backing Ratio)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={accountingSettings.liability_critical_threshold}
                      onChange={(e) => setAccountingSettings({ ...accountingSettings, liability_critical_threshold: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg mt-1"
                    />
                  </div>
                  <Button onClick={() => handleUpdateSettings({ 
                    liability_warning_threshold: accountingSettings.liability_warning_threshold,
                    liability_critical_threshold: accountingSettings.liability_critical_threshold
                  })}>
                    Update Thresholds
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminAccountingDashboard;
