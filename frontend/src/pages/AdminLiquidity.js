import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Wallet, TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  RefreshCw, DollarSign, Coins, ArrowUpRight, ArrowDownRight,
  Clock, Shield, Target, Activity, Zap, Info, Save
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminLiquidity = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [showUpdateReserves, setShowUpdateReserves] = useState(false);
  const [reserveForm, setReserveForm] = useState({
    bank_balance: '',
    cash_in_hand: '',
    payment_gateway_balance: '',
    notes: ''
  });

  useEffect(() => {
    fetchLiquidityData();
  }, []);

  const fetchLiquidityData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/admin/liquidity/dashboard`);
      setData(response.data);
      
      // Pre-fill reserve form
      if (response.data.reserves) {
        setReserveForm({
          bank_balance: response.data.reserves.bank_balance || '',
          cash_in_hand: response.data.reserves.cash_in_hand || '',
          payment_gateway_balance: response.data.reserves.payment_gateway || '',
          notes: ''
        });
      }
    } catch (error) {
      console.error('Error fetching liquidity data:', error);
      toast.error('Failed to load liquidity data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateReserves = async () => {
    try {
      await axios.post(`${API}/admin/liquidity/update-reserves`, {
        ...reserveForm,
        bank_balance: parseFloat(reserveForm.bank_balance) || 0,
        cash_in_hand: parseFloat(reserveForm.cash_in_hand) || 0,
        payment_gateway_balance: parseFloat(reserveForm.payment_gateway_balance) || 0,
        admin_id: user?.uid
      });
      toast.success('Reserves updated successfully');
      setShowUpdateReserves(false);
      fetchLiquidityData();
    } catch (error) {
      toast.error('Failed to update reserves');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getHealthColor = (status) => {
    switch (status) {
      case 'excellent': return 'from-green-500 to-emerald-600';
      case 'good': return 'from-blue-500 to-indigo-600';
      case 'warning': return 'from-yellow-500 to-orange-600';
      case 'critical': return 'from-red-500 to-rose-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getHealthIcon = (status) => {
    switch (status) {
      case 'excellent': return <CheckCircle className="h-8 w-8" />;
      case 'good': return <Shield className="h-8 w-8" />;
      case 'warning': return <AlertTriangle className="h-8 w-8" />;
      case 'critical': return <AlertTriangle className="h-8 w-8" />;
      default: return <Activity className="h-8 w-8" />;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading Liquidity Data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <Wallet className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Failed to load liquidity data</p>
          <Button onClick={fetchLiquidityData} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </Card>
      </div>
    );
  }

  const { summary, reserves, liabilities, ratios, health, daily_averages, flow_data, alerts, recommendations } = data;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="h-7 w-7 text-purple-600" />
            Liquidity Management
          </h1>
          <p className="text-gray-500">Monitor cash flow and manage reserves</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowUpdateReserves(true)} className="bg-purple-600 hover:bg-purple-700">
            <Save className="h-4 w-4 mr-2" /> Update Reserves
          </Button>
          <Button onClick={fetchLiquidityData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Health Status Banner */}
      <Card className={`p-6 bg-gradient-to-r ${getHealthColor(health.status)} text-white`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {getHealthIcon(health.status)}
            <div>
              <h2 className="text-2xl font-bold capitalize">{health.status} Liquidity</h2>
              <p className="opacity-90">{health.message}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold">{health.score}/100</p>
            <p className="text-sm opacity-80">Health Score</p>
          </div>
        </div>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="p-4 border-orange-200 bg-orange-50">
          <h3 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Active Alerts
          </h3>
          <div className="space-y-2">
            {alerts.map((alert, idx) => (
              <div key={idx} className={`p-3 rounded-lg ${
                alert.severity === 'high' ? 'bg-red-100 text-red-800' :
                alert.severity === 'medium' ? 'bg-orange-100 text-orange-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">{alert.message}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-purple-50 border-purple-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Coins className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-purple-600">Total PRC in System</p>
              <p className="text-2xl font-bold text-purple-700">
                {summary.total_prc_in_system?.toLocaleString()}
              </p>
              <p className="text-xs text-purple-500">≈ {formatCurrency(summary.prc_inr_value)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-xl">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-green-600">Total Cash Reserves</p>
              <p className="text-2xl font-bold text-green-700">
                {formatCurrency(summary.total_cash_reserves)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-red-50 border-red-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-xl">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-red-600">Total Liabilities</p>
              <p className="text-2xl font-bold text-red-700">
                {formatCurrency(summary.total_liabilities)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-blue-50 border-blue-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Wallet className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600">Available Liquidity</p>
              <p className={`text-2xl font-bold ${summary.available_liquidity >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                {formatCurrency(summary.available_liquidity)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Ratios & Reserves */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ratios */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-600" />
            Key Ratios
          </h3>
          
          <div className="space-y-6">
            {/* Reserve Ratio */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Reserve Ratio</span>
                <span className={`font-bold ${ratios.reserve_ratio >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                  {ratios.reserve_ratio?.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full ${ratios.reserve_ratio >= 80 ? 'bg-green-500' : ratios.reserve_ratio >= 50 ? 'bg-blue-500' : ratios.reserve_ratio >= 30 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, ratios.reserve_ratio)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Cash / PRC Value (Target: 50%+)</p>
            </div>

            {/* Liquidity Ratio */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Liquidity Ratio</span>
                <span className={`font-bold ${ratios.liquidity_ratio >= 2 ? 'text-green-600' : 'text-red-600'}`}>
                  {ratios.liquidity_ratio?.toFixed(2)}x
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full ${ratios.liquidity_ratio >= 3 ? 'bg-green-500' : ratios.liquidity_ratio >= 2 ? 'bg-blue-500' : ratios.liquidity_ratio >= 1 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, ratios.liquidity_ratio * 20)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Cash / Liabilities (Target: 2x+)</p>
            </div>

            {/* PRC Coverage */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">PRC Coverage</span>
                <span className={`font-bold ${ratios.prc_coverage >= 100 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {ratios.prc_coverage?.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full ${ratios.prc_coverage >= 100 ? 'bg-green-500' : ratios.prc_coverage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, ratios.prc_coverage)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">% of PRC backed by cash</p>
            </div>
          </div>
        </Card>

        {/* Cash Reserves Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Cash Reserves
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <span className="font-medium">Bank Balance</span>
              </div>
              <span className="text-lg font-bold text-blue-600">
                {formatCurrency(reserves.bank_balance)}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Wallet className="h-5 w-5 text-green-600" />
                </div>
                <span className="font-medium">Cash in Hand</span>
              </div>
              <span className="text-lg font-bold text-green-600">
                {formatCurrency(reserves.cash_in_hand)}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Zap className="h-5 w-5 text-purple-600" />
                </div>
                <span className="font-medium">Payment Gateway</span>
              </div>
              <span className="text-lg font-bold text-purple-600">
                {formatCurrency(reserves.payment_gateway)}
              </span>
            </div>

            {reserves.last_updated && (
              <p className="text-xs text-gray-500 text-center">
                Last updated: {new Date(reserves.last_updated).toLocaleString()}
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Liabilities & Daily Averages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Liabilities */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-600" />
            Pending Liabilities
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Pending Withdrawals</p>
                <p className="text-xs text-gray-500">{liabilities.withdrawal_count} requests</p>
              </div>
              <span className="text-lg font-bold text-red-600">
                {formatCurrency(liabilities.pending_withdrawals)}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Pending Bill Payments</p>
                <p className="text-xs text-gray-500">{liabilities.bill_count} requests</p>
              </div>
              <span className="text-lg font-bold text-red-600">
                {formatCurrency(liabilities.pending_bill_payments)}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Pending Gift Vouchers</p>
                <p className="text-xs text-gray-500">{liabilities.voucher_count} requests</p>
              </div>
              <span className="text-lg font-bold text-red-600">
                {formatCurrency(liabilities.pending_gift_vouchers)}
              </span>
            </div>
          </div>
        </Card>

        {/* Daily Averages */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-600" />
            Daily Averages (30 days)
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">PRC Creation</span>
              <span className="font-bold text-green-600">+{daily_averages.prc_creation?.toLocaleString()} PRC/day</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Cash Inflow</span>
              <span className="font-bold text-blue-600">{formatCurrency(daily_averages.cash_inflow)}/day</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Cash Outflow</span>
              <span className="font-bold text-red-600">{formatCurrency(daily_averages.cash_outflow)}/day</span>
            </div>
            
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-gray-900 font-medium">Runway</span>
                <span className={`text-2xl font-bold ${daily_averages.runway_days > 90 ? 'text-green-600' : daily_averages.runway_days > 30 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {daily_averages.runway_days} days
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Days of operation without new revenue</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Cash Flow Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">30-Day Cash Flow</h3>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={flow_data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Legend />
            <Area type="monotone" dataKey="cash_inflow" name="Cash Inflow" stroke="#10b981" fill="#10b98133" />
            <Area type="monotone" dataKey="cash_outflow" name="Cash Outflow" stroke="#ef4444" fill="#ef444433" />
            <Line type="monotone" dataKey="net_flow" name="Net Flow" stroke="#8b5cf6" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            Recommendations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((rec, idx) => (
              <div key={idx} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-3">
                  <div className={`px-2 py-1 rounded text-xs font-bold ${
                    rec.impact === 'high' ? 'bg-red-100 text-red-700' :
                    rec.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {rec.impact.toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Update Reserves Modal */}
      {showUpdateReserves && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Update Cash Reserves</h2>
                <button onClick={() => setShowUpdateReserves(false)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600">Bank Balance (₹)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={reserveForm.bank_balance}
                    onChange={(e) => setReserveForm({...reserveForm, bank_balance: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600">Cash in Hand (₹)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={reserveForm.cash_in_hand}
                    onChange={(e) => setReserveForm({...reserveForm, cash_in_hand: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600">Payment Gateway Balance (₹)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={reserveForm.payment_gateway_balance}
                    onChange={(e) => setReserveForm({...reserveForm, payment_gateway_balance: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600">Notes (optional)</label>
                  <Input
                    placeholder="Any notes about this update..."
                    value={reserveForm.notes}
                    onChange={(e) => setReserveForm({...reserveForm, notes: e.target.value})}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => setShowUpdateReserves(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateReserves} className="flex-1 bg-purple-600 hover:bg-purple-700">
                    Save Reserves
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

export default AdminLiquidity;
