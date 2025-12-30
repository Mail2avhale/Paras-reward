import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MetricCard from '@/components/manager/MetricCard';
import StatusBadge from '@/components/manager/StatusBadge';
import { 
  Package, CheckCircle, DollarSign, Truck, AlertCircle,
  Zap, Gamepad2, Users, Store, Trophy, Crown, FileCheck, ShoppingBag,
  ArrowRight, BarChart3, TrendingUp, Box
} from 'lucide-react';
import { toast } from 'sonner';
import StockInventoryDisplay from '@/components/StockInventoryDisplay';
import StockistHierarchy from '@/components/StockistHierarchy';
import StockRequestSystem from '@/pages/StockRequestSystem';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const OutletPanel = ({ user, onLogout }) => {
  const location = useLocation();
  const [secretCode, setSecretCode] = useState('');
  const [verifiedOrder, setVerifiedOrder] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [securityDeposit, setSecurityDeposit] = useState(null);
  const [renewalStatus, setRenewalStatus] = useState(null);
  const [stockMovements, setStockMovements] = useState({ received: [] });
  const [loading, setLoading] = useState(true);
  
  // Determine active tab from URL path
  const getActiveTabFromPath = () => {
    const path = location.pathname;
    if (path.includes('/orders')) return 'orders';
    if (path.includes('/inventory')) return 'inventory';
    if (path.includes('/verify')) return 'verify';
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
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!secretCode) {
      toast.error('Please enter secret code');
      return;
    }

    try {
      const response = await axios.post(`${API}/orders/verify`, {
        secret_code: secretCode
      });
      setVerifiedOrder(response.data.order);
      toast.success('Order verified!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid code');
      setVerifiedOrder(null);
    }
  };

  const deliverOrder = async () => {
    if (!verifiedOrder) return;

    try {
      await axios.post(`${API}/orders/${verifiedOrder.order_id}/deliver`, {
        outlet_id: user?.uid
      });
      toast.success('Order delivered! Charges distributed.');
      setSecretCode('');
      setVerifiedOrder(null);
      fetchDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Delivery failed');
    }
  };

  const handleWithdrawal = async () => {
    try {
      const amount = prompt('Enter withdrawal amount in PRC (min 500 PRC):');
      if (!amount || parseFloat(amount) < 500) {
        toast.error('Minimum 500 PRC required');
        return;
      }

      await axios.post(`${API}/wallet/prc/withdraw`, {
        uid: user.uid,
        amount: parseFloat(amount),
        payment_mode: 'upi'
      });

      toast.success('PRC withdrawal requested');
      fetchDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar user={user} onLogout={onLogout} />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Outlet Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user.name}! Manage your orders and track earnings.</p>
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
            title="Stock Received"
            value={stockMovements.received?.length || 0}
            icon={Package}
            color="green"
            subtitle="Total stock items"
          />
          
          <MetricCard
            title="Commission Rate"
            value="60%"
            icon={TrendingUp}
            color="blue"
            subtitle="Delivery commission"
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
                    <span className="text-sm text-gray-600">Monthly Return</span>
                    <span className="font-semibold text-green-600">₹{(securityDeposit.monthly_return_amount || 0).toLocaleString()} ({((securityDeposit.monthly_return_rate || 0) * 100).toFixed(1)}%)</span>
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
                <p className="text-gray-500">Required: ₹1,00,000</p>
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
                  status={renewalStatus.status} 
                  type={renewalStatus.status === 'approved' ? 'success' : 
                        renewalStatus.status === 'pending' ? 'warning' : 'default'}
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
                    <span className="text-sm text-gray-600">Base Amount</span>
                    <span className="font-semibold">₹{(renewalStatus.base_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">GST (18%)</span>
                    <span className="font-semibold">₹{(renewalStatus.gst_amount || 0).toLocaleString()}</span>
                  </div>
                  {renewalStatus.valid_until && (
                    <div className="flex justify-between items-center p-3 bg-teal-50 rounded-lg">
                      <span className="text-sm text-gray-600">Valid Until</span>
                      <span className="font-semibold text-teal-600">{new Date(renewalStatus.valid_until).toLocaleDateString()}</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">Created: {new Date(renewalStatus.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Required: ₹11,800</p>
                <p className="text-xs text-gray-400 mt-1">Annual fee (₹10,000 + 18% GST)</p>
              </div>
            )}
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Card className="p-6">
          <Tabs defaultValue="verify" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="verify">Verify Order</TabsTrigger>
              <TabsTrigger value="stock">Stock Inventory</TabsTrigger>
              <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
              <TabsTrigger value="request">Request Stock</TabsTrigger>
            </TabsList>

            {/* Verify Order Tab */}
            <TabsContent value="verify" className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Verify & Deliver Order</h3>
                <div className="flex gap-4">
                  <Input
                    placeholder="Enter secret code"
                    value={secretCode}
                    onChange={(e) => setSecretCode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && verifyCode()}
                    className="flex-1"
                  />
                  <Button 
                    onClick={verifyCode}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    Verify
                  </Button>
                </div>

                {verifiedOrder && (
                  <Card className="mt-6 p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-bold text-gray-900">Order Verified</h4>
                      <StatusBadge status={verifiedOrder.status} type="success" />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Order ID</p>
                        <p className="font-semibold">{verifiedOrder.order_id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">User ID</p>
                        <p className="font-semibold">{verifiedOrder.user_id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total PRC</p>
                        <p className="font-semibold">{verifiedOrder.total_prc}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Delivery Charge</p>
                        <p className="font-semibold">₹{verifiedOrder.delivery_charge}</p>
                      </div>
                    </div>
                    <Button 
                      onClick={deliverOrder}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mark as Delivered
                    </Button>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Stock Inventory Tab */}
            <TabsContent value="stock">
              <StockInventoryDisplay userId={user.uid} />
            </TabsContent>

            {/* Hierarchy Tab */}
            <TabsContent value="hierarchy">
              <StockistHierarchy user={user} userRole={user.role} />
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
          >
            <DollarSign className="mr-2 h-4 w-4" />
            Request Withdrawal
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OutletPanel;