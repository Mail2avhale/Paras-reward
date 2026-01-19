import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import Pagination from '../components/Pagination';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
  Wallet, TrendingUp, TrendingDown, ArrowRight, ArrowLeft,
  Plus, RefreshCw, Download, AlertTriangle, DollarSign,
  CreditCard, Gift, Building, Smartphone, ArrowUpDown, Eye
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

const AdminCompanyWallets = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [totalBalance, setTotalBalance] = useState(0);
  
  // Transfer modal
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({
    from_wallet: '',
    to_wallet: '',
    amount: '',
    description: ''
  });
  
  // Adjust modal
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    wallet_type: '',
    type: 'credit',
    amount: '',
    description: ''
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchWallets();
  }, [user, navigate]);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/admin/finance/company-wallets`);
      setWallets(response.data.wallets || []);
      setTransactions(response.data.recent_transactions || []);
      setTotalBalance(response.data.total_balance || 0);
    } catch (error) {
      toast.error('Failed to load wallets');
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferForm.from_wallet || !transferForm.to_wallet || !transferForm.amount) {
      toast.error('Please fill all required fields');
      return;
    }
    
    try {
      await axios.post(`${API}/api/admin/finance/company-wallet/transfer`, {
        ...transferForm,
        amount: parseFloat(transferForm.amount),
        admin_id: user.uid
      });
      toast.success('Transfer completed!');
      setShowTransfer(false);
      setTransferForm({ from_wallet: '', to_wallet: '', amount: '', description: '' });
      fetchWallets();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Transfer failed');
    }
  };

  const handleAdjust = async () => {
    if (!adjustForm.wallet_type || !adjustForm.amount) {
      toast.error('Please fill all required fields');
      return;
    }
    
    try {
      await axios.post(`${API}/api/admin/finance/company-wallet/adjust`, {
        ...adjustForm,
        amount: parseFloat(adjustForm.amount),
        admin_id: user.uid
      });
      toast.success('Adjustment completed!');
      setShowAdjust(false);
      setAdjustForm({ wallet_type: '', type: 'credit', amount: '', description: '' });
      fetchWallets();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Adjustment failed');
    }
  };

  const getWalletIcon = (type) => {
    switch (type) {
      case 'ads_revenue': return <Smartphone className="h-6 w-6" />;
      case 'subscription': return <CreditCard className="h-6 w-6" />;
      case 'redeem_reserve': return <Gift className="h-6 w-6" />;
      case 'charity': return <Building className="h-6 w-6" />;
      case 'profit': return <DollarSign className="h-6 w-6" />;
      default: return <Wallet className="h-6 w-6" />;
    }
  };

  const getWalletColor = (type) => {
    switch (type) {
      case 'ads_revenue': return 'bg-blue-500/100/20 text-blue-600';
      case 'subscription': return 'bg-purple-500/100/20 text-purple-600';
      case 'redeem_reserve': return 'bg-green-500/100/20 text-green-600';
      case 'charity': return 'bg-pink-500/100/20 text-pink-600';
      case 'profit': return 'bg-yellow-500/100/20 text-yellow-600';
      default: return 'bg-gray-800 text-gray-400';
    }
  };

  if (loading) {
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
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="h-6 w-6 text-purple-600" />
            Company Master Wallets
          </h1>
          <p className="text-sm text-gray-500">Manage internal company wallets</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchWallets}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowTransfer(true)}>
            <ArrowUpDown className="h-4 w-4 mr-2" />
            Transfer
          </Button>
          <Button variant="outline" onClick={() => setShowAdjust(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adjust
          </Button>
        </div>
      </div>

      {/* Total Balance Card */}
      <Card className="p-6 mb-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-100 text-sm">Total Company Balance</p>
            <h2 className="text-4xl font-bold mt-1">₹{totalBalance.toLocaleString('en-IN')}</h2>
          </div>
          <div className="bg-gray-900/20 p-4 rounded-xl">
            <Wallet className="h-10 w-10" />
          </div>
        </div>
      </Card>

      {/* Wallet Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        {wallets.map((wallet) => (
          <Card key={wallet.wallet_type} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg ${getWalletColor(wallet.wallet_type)}`}>
                {getWalletIcon(wallet.wallet_type)}
              </div>
            </div>
            <h3 className="font-semibold text-white text-sm">{wallet.wallet_name}</h3>
            <p className="text-2xl font-bold text-white mt-1">
              ₹{wallet.balance.toLocaleString('en-IN')}
            </p>
            <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
              <span className="text-green-600">+₹{wallet.total_credit?.toLocaleString('en-IN') || 0}</span>
              <span className="text-red-600">-₹{wallet.total_debit?.toLocaleString('en-IN') || 0}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Wallet Distribution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-6">
          <h3 className="font-semibold text-white mb-4">Wallet Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={wallets.filter(w => w.balance > 0)}
                  dataKey="balance"
                  nameKey="wallet_name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                >
                  {wallets.map((entry, index) => (
                    <Cell key={entry.wallet_type} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Recent Transactions */}
        <Card className="p-6">
          <h3 className="font-semibold text-white mb-4">Recent Transactions</h3>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No transactions yet
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {transactions.map((txn, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${txn.type === 'credit' ? 'bg-green-500/100/20' : 'bg-red-500/100/20'}`}>
                      {txn.type === 'credit' ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{txn.description || 'Transaction'}</p>
                      <p className="text-xs text-gray-500">
                        {txn.from_wallet || txn.wallet_type} → {txn.to_wallet || '-'}
                      </p>
                    </div>
                  </div>
                  <span className={`font-semibold ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                    {txn.type === 'credit' ? '+' : '-'}₹{txn.amount?.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Transfer Modal */}
      {showTransfer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5 text-purple-600" />
              Transfer Between Wallets
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300">From Wallet</label>
                <select
                  value={transferForm.from_wallet}
                  onChange={(e) => setTransferForm({...transferForm, from_wallet: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                >
                  <option value="">Select wallet</option>
                  {wallets.map(w => (
                    <option key={w.wallet_type} value={w.wallet_type}>
                      {w.wallet_name} (₹{w.balance.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">To Wallet</label>
                <select
                  value={transferForm.to_wallet}
                  onChange={(e) => setTransferForm({...transferForm, to_wallet: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                >
                  <option value="">Select wallet</option>
                  {wallets.filter(w => w.wallet_type !== transferForm.from_wallet).map(w => (
                    <option key={w.wallet_type} value={w.wallet_type}>{w.wallet_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Amount (₹)</label>
                <input
                  type="number"
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm({...transferForm, amount: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                  placeholder="Enter amount"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Description</label>
                <input
                  type="text"
                  value={transferForm.description}
                  onChange={(e) => setTransferForm({...transferForm, description: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                  placeholder="Optional note"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowTransfer(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleTransfer}>
                Transfer
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Adjust Modal */}
      {showAdjust && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-purple-600" />
              Manual Adjustment
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300">Wallet</label>
                <select
                  value={adjustForm.wallet_type}
                  onChange={(e) => setAdjustForm({...adjustForm, wallet_type: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                >
                  <option value="">Select wallet</option>
                  {wallets.map(w => (
                    <option key={w.wallet_type} value={w.wallet_type}>{w.wallet_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Type</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="credit"
                      checked={adjustForm.type === 'credit'}
                      onChange={(e) => setAdjustForm({...adjustForm, type: e.target.value})}
                    />
                    <span className="text-green-600">Credit (+)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="debit"
                      checked={adjustForm.type === 'debit'}
                      onChange={(e) => setAdjustForm({...adjustForm, type: e.target.value})}
                    />
                    <span className="text-red-600">Debit (-)</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Amount (₹)</label>
                <input
                  type="number"
                  value={adjustForm.amount}
                  onChange={(e) => setAdjustForm({...adjustForm, amount: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                  placeholder="Enter amount"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Description</label>
                <input
                  type="text"
                  value={adjustForm.description}
                  onChange={(e) => setAdjustForm({...adjustForm, description: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                  placeholder="Reason for adjustment"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowAdjust(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleAdjust}>
                Apply
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminCompanyWallets;
