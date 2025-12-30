import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MetricCard from '@/components/manager/MetricCard';
import StatusBadge from '@/components/manager/StatusBadge';
import { 
  Package, DollarSign, Truck, AlertCircle, CheckCircle, Users,
  Zap, Gamepad2, Store, Trophy, Crown, FileCheck, ShoppingBag,
  TrendingUp, Send, Box, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import StockRequestSystem from '@/pages/StockRequestSystem';
import StockInventoryDisplay from '@/components/StockInventoryDisplay';
import StockistHierarchy from '@/components/StockistHierarchy';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SubStockistDashboard = ({ user, onLogout }) => {
  const location = useLocation();
  const [walletData, setWalletData] = useState(null);
  const [securityDeposit, setSecurityDeposit] = useState(null);
  const [renewalStatus, setRenewalStatus] = useState(null);
  const [stockMovements, setStockMovements] = useState({ sent: [], received: [] });
  const [loading, setLoading] = useState(true);
  
  // Determine active tab from URL path
  const getActiveTabFromPath = () => {
    const path = location.pathname;
    if (path.includes('/orders')) return 'orders';
    if (path.includes('/inventory')) return 'inventory';
    if (path.includes('/outlets')) return 'outlets';
    if (path.includes('/stock-requests')) return 'stock-requests';
    if (path.includes('/wallet')) return 'wallet';
    return 'overview';
  };
  
  const [activeTab, setActiveTab] = useState(getActiveTabFromPath());
  
  useEffect(() => {
    setActiveTab(getActiveTabFromPath());
  }, [location.pathname]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const walletRes = await axios.get(`${API}/wallet/${user.uid}`);
      setWalletData(walletRes.data);

      const financialRes = await axios.get(`${API}/stockist/${user.uid}/financial-info`);
      setSecurityDeposit(financialRes.data.security_deposit);
      setRenewalStatus(financialRes.data.renewal);

      const movementsRes = await axios.get(`${API}/stock/movements/${user.uid}`);
      setStockMovements(movementsRes.data);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
      setLoading(false);
    }
  };

  const handleWithdrawal = async () => {
    try {
      const amount = prompt('Enter withdrawal amount (minimum ₹50):');
      if (!amount || parseFloat(amount) < 50) {
        toast.error('Minimum withdrawal amount is ₹50');
        return;
      }

      await axios.post(`${API}/wallet/profit/withdraw`, {
        uid: user.uid,
        amount: parseFloat(amount),
        payment_mode: 'upi'
      });

      toast.success('Withdrawal request submitted');
      fetchDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Withdrawal failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Sub Stockist Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.name}! Manage your inventory and outlets.</p>
      </div>
      
      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-lg shadow-sm">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'orders', label: 'Orders' },
            { id: 'inventory', label: 'Inventory' },
            { id: 'outlets', label: 'My Outlets' },
            { id: 'stock-requests', label: 'Stock Requests' },
            { id: 'wallet', label: 'Wallet' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-teal-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="container mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Sub Stockist Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user.name}! Manage outlets, inventory, and earnings.</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="PRC Balance"
            value={`₹${walletData?.prc_balance?.toLocaleString() || 0}`}
            icon={DollarSign}
            color="purple"
            subtitle="Available balance"
          />
          
          <MetricCard
            title="Stock Transfers"
            value={stockMovements.sent?.length || 0}
            icon={Send}
            color="green"
            subtitle="Sent to outlets"
          />
          
          <MetricCard
            title="Received Stock"
            value={stockMovements.received?.length || 0}
            icon={Truck}
            color="blue"
            subtitle="From master stockist"
          />
          
          <MetricCard
            title={renewalStatus?.renewal_status || 'Status'}
            value={renewalStatus?.is_overdue ? 'Overdue' : 'Active'}
            icon={renewalStatus?.is_overdue ? AlertCircle : CheckCircle}
            color={renewalStatus?.is_overdue ? 'red' : 'teal'}
            subtitle="Renewal status"
          />
        </div>

        {/* Quick Actions */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <Link to="/mining">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-2 hover:bg-purple-50">
                <Zap className="h-6 w-6 text-purple-600" />
                <span className="text-xs font-medium">Mining</span>
              </Button>
            </Link>
            <Link to="/tap-game">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-2 hover:bg-purple-50">
                <Gamepad2 className="h-6 w-6 text-purple-600" />
                <span className="text-xs font-medium">Game</span>
              </Button>
            </Link>
            <Link to="/referrals">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-2 hover:bg-purple-50">
                <Users className="h-6 w-6 text-purple-600" />
                <span className="text-xs font-medium">Referral</span>
              </Button>
            </Link>
            <Link to="/marketplace">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-2 hover:bg-purple-50">
                <Store className="h-6 w-6 text-purple-600" />
                <span className="text-xs font-medium">Marketplace</span>
              </Button>
            </Link>
            <Link to="/leaderboard">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-2 hover:bg-purple-50">
                <Trophy className="h-6 w-6 text-purple-600" />
                <span className="text-xs font-medium">Leaderboard</span>
              </Button>
            </Link>
            <Link to="/vip">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-2 hover:bg-purple-50">
                <Crown className="h-6 w-6 text-amber-600" />
                <span className="text-xs font-medium">VIP</span>
              </Button>
            </Link>
            <Link to="/kyc">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-2 hover:bg-purple-50">
                <FileCheck className="h-6 w-6 text-blue-600" />
                <span className="text-xs font-medium">KYC</span>
              </Button>
            </Link>
            <Link to="/orders">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-2 hover:bg-purple-50">
                <ShoppingBag className="h-6 w-6 text-green-600" />
                <span className="text-xs font-medium">My Orders</span>
              </Button>
            </Link>
          </div>
        </Card>

        {/* Financial Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Security Deposit */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Security Deposit</h3>
              {securityDeposit && (
                <StatusBadge 
                  status={securityDeposit.status} 
                  type={securityDeposit.status === 'approved' ? 'success' : 
                        securityDeposit.status === 'pending' ? 'warning' : 'default'}
                />
              )}
            </div>
            {securityDeposit ? (
              <div>
                <div className="text-3xl font-bold text-purple-600 mb-4">
                  ₹{securityDeposit.amount?.toLocaleString() || 0}
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-sm text-gray-600">Monthly Return (3%)</span>
                    <span className="font-semibold text-green-600">₹{((securityDeposit.amount || 0) * 0.03).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm text-gray-600">Total Returned</span>
                    <span className="font-semibold text-blue-600">₹{(securityDeposit.total_returned || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                    <span className="text-sm text-gray-600">Balance Pending</span>
                    <span className="font-semibold text-orange-600">₹{(securityDeposit.balance_pending || 0).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Created: {new Date(securityDeposit.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Box className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Required: ₹3,00,000</p>
                <p className="text-xs text-gray-400 mt-1">Submit security deposit to activate</p>
              </div>
            )}
          </Card>

          {/* Annual Renewal */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Annual Renewal</h3>
              {renewalStatus && (
                <StatusBadge 
                  status={renewalStatus.is_overdue ? 'overdue' : renewalStatus.renewal_status} 
                  type={renewalStatus.is_overdue ? 'danger' : 
                        renewalStatus.renewal_status === 'active' ? 'success' : 'default'}
                />
              )}
            </div>
            {renewalStatus ? (
              <div>
                <div className="text-3xl font-bold text-blue-600 mb-4">
                  ₹{renewalStatus.total_amount?.toLocaleString() || 0}
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Due Date</span>
                    <span className="font-semibold">{renewalStatus.renewal_due_date ? new Date(renewalStatus.renewal_due_date).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-teal-50 rounded-lg">
                    <span className="text-sm text-gray-600">Days Left</span>
                    <span className="font-semibold text-teal-600">{renewalStatus.days_until_due || 'N/A'}</span>
                  </div>
                  {renewalStatus.is_overdue && (
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-red-600 font-semibold text-sm">⚠️ Renewal Overdue</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">Status: {renewalStatus.renewal_status}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Required: ₹35,400</p>
                <p className="text-xs text-gray-400 mt-1">Annual fee (₹30,000 + 18% GST)</p>
              </div>
            )}
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Card className="p-6">
          <Tabs defaultValue="inventory" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="hierarchy">Network</TabsTrigger>
              <TabsTrigger value="movements">Movements</TabsTrigger>
              <TabsTrigger value="request">Request Stock</TabsTrigger>
            </TabsList>

            {/* Inventory Tab */}
            <TabsContent value="inventory">
              <StockInventoryDisplay userId={user.uid} />
            </TabsContent>

            {/* Hierarchy Tab */}
            <TabsContent value="hierarchy">
              <StockistHierarchy user={user} userRole={user.role} />
            </TabsContent>

            {/* Movements Tab */}
            <TabsContent value="movements" className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Sent to Outlets</h3>
                {stockMovements.sent?.length > 0 ? (
                  <div className="space-y-3">
                    {stockMovements.sent.map((movement, idx) => (
                      <Card key={idx} className="p-4 border-l-4 border-purple-500">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-gray-900">{movement.product_name || 'Stock Transfer'}</p>
                            <p className="text-sm text-gray-600">Quantity: {movement.quantity}</p>
                            <p className="text-xs text-gray-500">Batch: {movement.batch_number}</p>
                          </div>
                          <StatusBadge 
                            status={movement.status}
                            type={movement.status === 'completed' ? 'success' : 'warning'}
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Send className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No stock transfers yet</p>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Received from Master Stockist</h3>
                {stockMovements.received?.length > 0 ? (
                  <div className="space-y-3">
                    {stockMovements.received.map((movement, idx) => (
                      <Card key={idx} className="p-4 border-l-4 border-green-500">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-gray-900">{movement.product_name || 'Stock Receipt'}</p>
                            <p className="text-sm text-gray-600">Quantity: {movement.quantity}</p>
                            <p className="text-xs text-gray-500">Batch: {movement.batch_number}</p>
                          </div>
                          <StatusBadge 
                            status={movement.status}
                            type={movement.status === 'completed' ? 'success' : 'warning'}
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Truck className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No stock received yet</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Request Stock Tab */}
            <TabsContent value="request">
              <StockRequestSystem userId={user.uid} userRole={user.role} onSuccess={fetchDashboardData} />
            </TabsContent>
          </Tabs>
        </Card>

        {/* Withdrawal Button */}
        <div className="mt-8">
          <Button 
            onClick={handleWithdrawal}
            className="w-full md:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            disabled={!walletData?.prc_balance || walletData.prc_balance < 50}
          >
            <DollarSign className="mr-2 h-4 w-4" />
            Request Withdrawal {walletData?.prc_balance >= 50 && `(₹${walletData.prc_balance.toLocaleString()})`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SubStockistDashboard;