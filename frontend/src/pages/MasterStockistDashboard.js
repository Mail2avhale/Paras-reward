import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, DollarSign, Truck, AlertCircle, CheckCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import StockRequestSystem from '@/pages/StockRequestSystem';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MasterStockistDashboard = ({ user, onLogout }) => {
  const [walletData, setWalletData] = useState(null);
  const [securityDeposit, setSecurityDeposit] = useState(null);
  const [renewalStatus, setRenewalStatus] = useState(null);
  const [stockMovements, setStockMovements] = useState({ sent: [], received: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch wallet data
      const walletRes = await axios.get(`${API}/wallet/${user.uid}`);
      setWalletData(walletRes.data);

      // Fetch financial info (deposit + renewal)
      const financialRes = await axios.get(`${API}/stockist/${user.uid}/financial-info`);
      setSecurityDeposit(financialRes.data.security_deposit);
      setRenewalStatus(financialRes.data.renewal);

      // Fetch stock movements
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

      toast.success('Withdrawal request submitted successfully');
      fetchDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Withdrawal failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <Navbar user={user} onLogout={onLogout} />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">Master Stockist Dashboard</h1>
          <p className="text-gray-600">Manage your inventory, allocations, and earnings</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-2xl shadow-xl">
            <DollarSign className="h-8 w-8 opacity-80 mb-2" />
            <div className="text-3xl font-bold mb-1">₹{walletData?.profit_balance?.toLocaleString() || 0}</div>
            <div className="text-purple-100">Profit Wallet</div>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-2xl shadow-xl">
            <Package className="h-8 w-8 opacity-80 mb-2" />
            <div className="text-3xl font-bold mb-1">{stockMovements.sent?.length || 0}</div>
            <div className="text-green-100">Stock Transfers</div>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-2xl shadow-xl">
            <Truck className="h-8 w-8 opacity-80 mb-2" />
            <div className="text-3xl font-bold mb-1">{stockMovements.received?.length || 0}</div>
            <div className="text-blue-100">Received Stock</div>
          </Card>

          <Card className={`bg-gradient-to-br ${renewalStatus?.is_overdue ? 'from-red-500 to-red-600' : 'from-teal-500 to-teal-600'} text-white p-6 rounded-2xl shadow-xl`}>
            {renewalStatus?.is_overdue ? <AlertCircle className="h-8 w-8 opacity-80 mb-2" /> : <CheckCircle className="h-8 w-8 opacity-80 mb-2" />}
            <div className="text-2xl font-bold mb-1">{renewalStatus?.renewal_status || 'N/A'}</div>
            <div className="text-white opacity-90">Renewal Status</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Security Deposit</h3>
              <span className={`px-3 py-1 rounded-full text-sm ${
                securityDeposit?.status === 'approved' ? 'bg-green-100 text-green-700' :
                securityDeposit?.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {securityDeposit?.status || 'Not Submitted'}
              </span>
            </div>
            {securityDeposit ? (
              <div>
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  ₹{securityDeposit.amount?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Monthly Return: <span className="font-semibold text-green-600">₹{(securityDeposit.monthly_return_amount || 0).toLocaleString()}</span> ({((securityDeposit.monthly_return_rate || 0) * 100).toFixed(1)}%)</p>
                  <p>Total Returned: <span className="font-semibold text-blue-600">₹{(securityDeposit.total_returned || 0).toLocaleString()}</span></p>
                  <p>Balance Pending: <span className="font-semibold text-orange-600">₹{(securityDeposit.balance_pending || 0).toLocaleString()}</span></p>
                  <p className="text-xs text-gray-500 mt-2">Created: {new Date(securityDeposit.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No security deposit found. Required: ₹5,00,000</p>
            )}
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Annual Renewal</h3>
              <span className={`px-3 py-1 rounded-full text-sm ${
                renewalStatus?.status === 'approved' ? 'bg-green-100 text-green-700' :
                renewalStatus?.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {renewalStatus?.status || 'Not Submitted'}
              </span>
            </div>
            {renewalStatus ? (
              <div>
                <div className="text-2xl font-bold text-blue-600 mb-2">
                  ₹{renewalStatus.total_amount?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Base Amount: <span className="font-semibold">₹{(renewalStatus.base_amount || 0).toLocaleString()}</span></p>
                  <p>GST ({((renewalStatus.gst_rate || 0) * 100).toFixed(0)}%): <span className="font-semibold">₹{(renewalStatus.gst_amount || 0).toLocaleString()}</span></p>
                  <p>Valid Until: <span className="font-semibold">{renewalStatus.renewal_end_date ? new Date(renewalStatus.renewal_end_date).toLocaleDateString() : 'N/A'}</span></p>
                  <p className="text-xs text-gray-500 mt-2">Created: {new Date(renewalStatus.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Annual Fee: ₹50,000 + GST</p>
            )}
          </Card>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Profit Wallet</h3>
              <p className="text-gray-600">Balance: <span className="font-bold text-purple-600">₹{walletData?.profit_balance?.toLocaleString() || 0}</span></p>
            </div>
            <Button 
              onClick={handleWithdrawal}
              className="bg-purple-600 hover:bg-purple-700"
              disabled={!walletData?.profit_balance || walletData.profit_balance < 50}
            >
              Withdraw
            </Button>
          </div>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl">
          <Tabs defaultValue="stock" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="stock">Stock Movements</TabsTrigger>
              <TabsTrigger value="allocations">Sub Stockists</TabsTrigger>
              <TabsTrigger value="earnings">Earnings</TabsTrigger>
            </TabsList>

            <TabsContent value="stock" className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Stock Movements</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Sent to Sub Stockists</h3>
                  {stockMovements.sent?.length > 0 ? (
                    <div className="space-y-2">
                      {stockMovements.sent.map((movement, idx) => (
                        <Card key={idx} className="p-4 border-l-4 border-purple-500">
                          <div className="flex justify-between">
                            <div>
                              <p className="font-semibold">{movement.product_name || 'Product Transfer'}</p>
                              <p className="text-sm text-gray-600">Quantity: {movement.quantity}</p>
                              <p className="text-xs text-gray-500">Batch: {movement.batch_number}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs h-fit ${
                              movement.status === 'completed' ? 'bg-green-100 text-green-700' :
                              movement.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {movement.status}
                            </span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No transfers sent</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Received from Company</h3>
                  {stockMovements.received?.length > 0 ? (
                    <div className="space-y-2">
                      {stockMovements.received.map((movement, idx) => (
                        <Card key={idx} className="p-4 border-l-4 border-green-500">
                          <div className="flex justify-between">
                            <div>
                              <p className="font-semibold">{movement.product_name || 'Product'}</p>
                              <p className="text-sm text-gray-600">Quantity: {movement.quantity}</p>
                              <p className="text-xs text-gray-500">Batch: {movement.batch_number}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs h-fit ${
                              movement.status === 'completed' ? 'bg-green-100 text-green-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {movement.status}
                            </span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No stock received</p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="allocations">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Sub Stockist Management</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <Users className="h-12 w-12 text-blue-500 mx-auto mb-3" />
                <p className="text-gray-700">Contact admin to allocate stock to sub stockists</p>
              </div>
            </TabsContent>

            <TabsContent value="earnings">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Earnings Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 border-l-4 border-purple-500">
                  <p className="text-sm text-gray-600 mb-1">Current Balance</p>
                  <p className="text-2xl font-bold text-purple-600">₹{walletData?.profit_balance?.toLocaleString() || 0}</p>
                </Card>
                <Card className="p-4 border-l-4 border-green-500">
                  <p className="text-sm text-gray-600 mb-1">Monthly Returns (3%)</p>
                  <p className="text-2xl font-bold text-green-600">₹{((securityDeposit?.amount || 0) * 0.03).toLocaleString()}</p>
                </Card>
                <Card className="p-4 border-l-4 border-blue-500">
                  <p className="text-sm text-gray-600 mb-1">Delivery Commission</p>
                  <p className="text-2xl font-bold text-blue-600">10%</p>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default MasterStockistDashboard;