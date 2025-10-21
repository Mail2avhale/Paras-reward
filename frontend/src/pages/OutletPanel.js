import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, CheckCircle, DollarSign, Truck, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import StockRequestSystem from '@/pages/StockRequestSystem';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const OutletPanel = ({ user, onLogout }) => {
  const [secretCode, setSecretCode] = useState('');
  const [verifiedOrder, setVerifiedOrder] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [securityDeposit, setSecurityDeposit] = useState(null);
  const [renewalStatus, setRenewalStatus] = useState(null);
  const [stockMovements, setStockMovements] = useState({ received: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const walletRes = await axios.get(`${API}/wallet/${user.uid}`);
      setWalletData(walletRes.data);

      // Fetch financial info (deposit + renewal)
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
      const amount = prompt('Enter withdrawal amount (min ₹50):');
      if (!amount || parseFloat(amount) < 50) {
        toast.error('Minimum ₹50');
        return;
      }

      await axios.post(`${API}/wallet/profit/withdraw`, {
        uid: user.uid,
        amount: parseFloat(amount),
        payment_mode: 'upi'
      });

      toast.success('Withdrawal requested');
      fetchDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed');
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
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">Outlet Dashboard</h1>
          <p className="text-gray-600">Manage orders and track earnings</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-2xl shadow-xl">
            <DollarSign className="h-8 w-8 opacity-80 mb-2" />
            <div className="text-3xl font-bold mb-1">₹{walletData?.profit_balance?.toLocaleString() || 0}</div>
            <div className="text-purple-100">Profit Wallet</div>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-2xl shadow-xl">
            <Package className="h-8 w-8 opacity-80 mb-2" />
            <div className="text-3xl font-bold mb-1">{stockMovements.received?.length || 0}</div>
            <div className="text-green-100">Stock Received</div>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-2xl shadow-xl">
            <Truck className="h-8 w-8 opacity-80 mb-2" />
            <div className="text-3xl font-bold mb-1">60%</div>
            <div className="text-blue-100">Commission Rate</div>
          </Card>

          <Card className={`bg-gradient-to-br ${renewalStatus?.is_overdue ? 'from-red-500 to-red-600' : 'from-teal-500 to-teal-600'} text-white p-6 rounded-2xl shadow-xl`}>
            {renewalStatus?.is_overdue ? <AlertCircle className="h-8 w-8 opacity-80 mb-2" /> : <CheckCircle className="h-8 w-8 opacity-80 mb-2" />}
            <div className="text-2xl font-bold mb-1">{renewalStatus?.renewal_status || 'N/A'}</div>
            <div className="text-white opacity-90">Status</div>
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
              <p className="text-gray-500">Required: ₹1,00,000</p>
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
              <p className="text-gray-500">Annual Fee: ₹10,000 + GST</p>
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
          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="orders">Deliver Orders</TabsTrigger>
              <TabsTrigger value="stock-requests">Stock Requests</TabsTrigger>
              <TabsTrigger value="stock">Stock</TabsTrigger>
              <TabsTrigger value="earnings">Earnings</TabsTrigger>
            </TabsList>

            <TabsContent value="orders">
              <div className="max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Verify & Deliver Orders</h2>
                
                <Card className="p-8 mb-6 bg-gradient-to-br from-purple-50 to-blue-50">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Customer Secret Code</label>
                      <Input
                        type="text"
                        placeholder="Enter 6-digit code"
                        value={secretCode}
                        onChange={(e) => setSecretCode(e.target.value)}
                        className="text-center text-2xl tracking-widest"
                        maxLength={6}
                      />
                    </div>
                    <Button 
                      onClick={verifyCode} 
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      size="lg"
                    >
                      Verify Code
                    </Button>
                  </div>
                </Card>

                {verifiedOrder && (
                  <Card className="p-6 border-2 border-green-500 bg-green-50">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                      <h3 className="text-xl font-bold text-green-900">Order Verified</h3>
                    </div>
                    
                    {/* Order Details */}
                    <div className="space-y-3 mb-4">
                      <div className="bg-white p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Order ID</p>
                        <p className="font-semibold">{verifiedOrder.order_id}</p>
                      </div>
                      
                      <div className="bg-white p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Customer ID</p>
                        <p className="font-semibold">{verifiedOrder.user_id || verifiedOrder.uid}</p>
                      </div>
                      
                      {verifiedOrder.delivery_address && (
                        <div className="bg-white p-3 rounded-lg">
                          <p className="text-sm text-gray-600">Delivery Address</p>
                          <p className="font-semibold">{verifiedOrder.delivery_address}</p>
                        </div>
                      )}
                    </div>

                    {/* Product List */}
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Items to Deliver:</h4>
                      <div className="space-y-2">
                        {verifiedOrder.items && verifiedOrder.items.length > 0 ? (
                          // Multi-product cart order
                          verifiedOrder.items.map((item, idx) => (
                            <div key={idx} className="bg-white p-3 rounded-lg border-l-4 border-green-500">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-semibold text-gray-900">{item.product_name}</p>
                                  <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                                </div>
                                <p className="text-purple-600 font-bold">{item.prc_price * item.quantity} PRC</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          // Legacy single product order
                          <div className="bg-white p-3 rounded-lg border-l-4 border-green-500">
                            <div className="flex justify-between items-start">
                              <p className="font-semibold text-gray-900">{verifiedOrder.product_name || 'Product'}</p>
                              <p className="text-purple-600 font-bold">{verifiedOrder.total_prc || verifiedOrder.prc_amount} PRC</p>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-purple-50 p-3 rounded-lg mt-3">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Total:</span>
                          <span className="font-bold text-purple-600 text-lg">{verifiedOrder.total_prc || verifiedOrder.prc_amount} PRC</span>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={deliverOrder}
                      className="w-full bg-green-600 hover:bg-green-700"
                      size="lg"
                    >
                      <Package className="mr-2 h-5 w-5" />
                      Confirm Delivery
                    </Button>
                  </Card>
                )}

                <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Customer provides 6-digit secret code</li>
                    <li>Enter code and click Verify</li>
                    <li>Check order details</li>
                    <li>Click Confirm Delivery</li>
                    <li>Delivery commission (60%) credited automatically</li>
                  </ol>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="stock-requests">
              <StockRequestSystem />
            </TabsContent>

            <TabsContent value="stock">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Stock Received</h2>
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
                        <span className="px-3 py-1 rounded-full text-xs bg-green-100 text-green-700 h-fit">
                          {movement.status}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No stock received yet</p>
              )}
            </TabsContent>

            <TabsContent value="earnings">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Earnings</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 border-l-4 border-purple-500">
                  <p className="text-sm text-gray-600 mb-1">Balance</p>
                  <p className="text-2xl font-bold text-purple-600">₹{walletData?.profit_balance?.toLocaleString() || 0}</p>
                </Card>
                <Card className="p-4 border-l-4 border-green-500">
                  <p className="text-sm text-gray-600 mb-1">Monthly (3%)</p>
                  <p className="text-2xl font-bold text-green-600">₹{((securityDeposit?.amount || 0) * 0.03).toLocaleString()}</p>
                </Card>
                <Card className="p-4 border-l-4 border-blue-500">
                  <p className="text-sm text-gray-600 mb-1">Commission</p>
                  <p className="text-2xl font-bold text-blue-600">60%</p>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default OutletPanel;