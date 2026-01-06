import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Wallet, TrendingUp, TrendingDown, Download, Search, 
  Filter, ArrowUpCircle, ArrowDownCircle, Calendar,
  Gift, ShoppingCart, Zap, Users, AlertCircle, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BankingWallet = ({ user, walletBalance = 0 }) => {
  const [activeWallet, setActiveWallet] = useState('cashback');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    total_credit: 0,
    total_debit: 0,
    total_transactions: 0
  });
  const [filters, setFilters] = useState({
    type: '',
    startDate: '',
    endDate: '',
    searchQuery: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  useEffect(() => {
    fetchTransactions();
  }, [activeWallet, pagination.page]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API}/api/wallet/transactions/${user.uid}?wallet_type=${activeWallet}_wallet&page=${pagination.page}&limit=${pagination.limit}`
      );
      
      setTransactions(response.data.transactions || []);
      setSummary({
        total_credit: response.data.total_credit || 0,
        total_debit: response.data.total_debit || 0,
        total_transactions: response.data.total || 0
      });
      setPagination(prev => ({
        ...prev,
        total: response.data.total || 0,
        totalPages: response.data.total_pages || 0,
        hasNext: response.data.has_next || false,
        hasPrev: response.data.has_prev || false
      }));
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type) => {
    const iconMap = {
      mining: <Zap className="w-5 h-5 text-yellow-600" />,
      tap_game: <Gift className="w-5 h-5 text-purple-600" />,
      referral: <Users className="w-5 h-5 text-blue-600" />,
      order: <ShoppingCart className="w-5 h-5 text-orange-600" />,
      cashback: <ArrowDownCircle className="w-5 h-5 text-green-600" />,
      Redemption: <ArrowUpCircle className="w-5 h-5 text-red-600" />,
      Redemption_rejected: <AlertCircle className="w-5 h-5 text-yellow-600" />,
      admin_credit: <CheckCircle className="w-5 h-5 text-green-600" />,
      admin_debit: <AlertCircle className="w-5 h-5 text-red-600" />,
      delivery_charge: <TrendingDown className="w-5 h-5 text-gray-600" />,
      PRC_share: <TrendingUp className="w-5 h-5 text-green-600" />,
      scratch_card_reward: <Gift className="w-5 h-5 text-pink-600" />,
      treasure_hunt_reward: <Gift className="w-5 h-5 text-purple-600" />
    };
    return iconMap[type] || <Wallet className="w-5 h-5 text-gray-600" />;
  };

  const getTransactionLabel = (type) => {
    const labelMap = {
      mining: 'Mining Reward',
      tap_game: 'Tap Game Reward',
      referral: 'Referral Bonus',
      order: 'Product Order',
      cashback: 'Cashback Credit',
      Redemption: 'Redemption',
      Redemption_rejected: 'Redemption Refund',
      admin_credit: 'Admin Credit',
      admin_debit: 'Admin Debit',
      delivery_charge: 'Delivery Charge',
      scratch_card_reward: 'Scratch Card Cashback',
      treasure_hunt_reward: 'Treasure Hunt Cashback',
      PRC_share: 'PRC Share'
    };
    return labelMap[type] || type;
  };

  const isCredit = (type) => {
    return ['mining', 'tap_game', 'referral', 'cashback', 'Redemption_rejected', 'admin_credit', 'PRC_share', 'scratch_card_reward', 'treasure_hunt_reward'].includes(type);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCurrentBalance = () => {
    // Use the passed walletBalance prop which is fresh from the API
    return walletBalance;
  };

  const filteredTransactions = transactions.filter(t => {
    if (filters.type && t.type !== filters.type) return false;
    if (filters.searchQuery && !t.description.toLowerCase().includes(filters.searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Wallets</h1>
          <p className="text-gray-600 mt-2">Complete transaction history and balance overview</p>
        </div>

        {/* Wallet Selection */}
        <div className="flex gap-4 mb-6">
          <Button
            onClick={() => setActiveWallet('cashback')}
            className={`flex-1 h-16 ${
              activeWallet === 'cashback'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200'
            }`}
          >
            <div className="text-center">
              <div className="text-lg font-bold">Cashback Wallet</div>
              <div className="text-sm opacity-90">₹{(user?.cashback_balance || 0).toFixed(2)}</div>
            </div>
          </Button>
          
          {user?.role && ['master_stockist', 'sub_stockist', 'outlet'].includes(user.role) && (
            <Button
              onClick={() => setActiveWallet('PRC')}
              className={`flex-1 h-16 ${
                activeWallet === 'PRC'
                  ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              <div className="text-center">
                <div className="text-lg font-bold">PRC Wallet</div>
                <div className="text-sm opacity-90">₹{(user?.PRC_balance || 0).toFixed(2)}</div>
              </div>
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-green-700">Total Credit</span>
              <ArrowDownCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-green-900">₹{(summary.total_credit || 0).toFixed(2)}</div>
            <p className="text-xs text-green-700 mt-1">Money received</p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-red-50 to-red-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-red-700">Total Debit</span>
              <ArrowUpCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="text-3xl font-bold text-red-900">₹{(summary.total_debit || 0).toFixed(2)}</div>
            <p className="text-xs text-red-700 mt-1">Money spent</p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-700">Current Balance</span>
              <Wallet className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-blue-900">₹{getCurrentBalance().toFixed(2)}</div>
            <p className="text-xs text-blue-700 mt-1">{summary.total_transactions || 0} transactions</p>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters({...filters, searchQuery: e.target.value})}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <select
              value={filters.type}
              onChange={(e) => setFilters({...filters, type: e.target.value})}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            >
              <option value="">All Types</option>
              <option value="mining">Mining</option>
              <option value="tap_game">Tap Game</option>
              <option value="referral">Referral</option>
              <option value="order">Order</option>
              <option value="cashback">Cashback</option>
              <option value="Redemption">Redemption</option>
              <option value="Redemption_rejected">Refund</option>
            </select>

            <Button
              onClick={fetchTransactions}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </Card>

        {/* Transaction List */}
        <Card className="overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading transactions...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p>No transactions found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredTransactions.map((transaction, index) => (
                <div key={transaction.transaction_id || index} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${isCredit(transaction.type) ? 'bg-green-100' : 'bg-red-100'}`}>
                        {getTransactionIcon(transaction.type)}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{getTransactionLabel(transaction.type)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            isCredit(transaction.type)
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {isCredit(transaction.type) ? 'Credit' : 'Debit'}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2">{transaction.description}</p>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(transaction.created_at)}
                          </span>
                          <span>ID: {transaction.transaction_id.substring(0, 16)}...</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right ml-4">
                      <div className={`text-lg font-bold ${
                        isCredit(transaction.type) ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {isCredit(transaction.type) ? '+' : '-'}₹{(transaction.amount || 0).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Balance: ₹{(transaction.balance_after || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Pagination Controls */}
          {!loading && filteredTransactions.length > 0 && (
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total transactions)
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={!pagination.hasPrev}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  ← Previous
                </Button>
                
                <div className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium">
                  Page {pagination.page}
                </div>
                
                <Button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={!pagination.hasNext}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  Next →
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Export Button */}
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            className="flex items-center gap-2 mx-auto"
            onClick={() => toast.info('CSV export coming soon')}
          >
            <Download className="w-4 h-4" />
            Export Transaction History (CSV)
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BankingWallet;
