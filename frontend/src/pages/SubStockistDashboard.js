import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, TrendingUp, Store, DollarSign, Truck, BarChart3, Search } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SubStockistDashboard = ({ user, onLogout }) => {
  const [stats, setStats] = useState({
    totalStock: 0,
    totalSales: 0,
    totalProfit: 0,
    activeOutlets: 0,
    pendingOrders: 0
  });
  const [outlets, setOutlets] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [profitWallet, setProfitWallet] = useState(0);
  const [securityDeposit, setSecurityDeposit] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch stats
      const statsRes = await axios.get(`${API}/sub-stockist/${user.uid}/stats`);
      setStats(statsRes.data);

      // Fetch outlets
      const outletRes = await axios.get(`${API}/sub-stockist/${user.uid}/outlets`);
      setOutlets(outletRes.data);

      // Fetch inventory
      const invRes = await axios.get(`${API}/sub-stockist/${user.uid}/inventory`);
      setInventory(invRes.data);

      // Fetch orders
      const ordersRes = await axios.get(`${API}/sub-stockist/${user.uid}/orders`);
      setOrders(ordersRes.data);

      // Fetch wallet
      const walletRes = await axios.get(`${API}/sub-stockist/${user.uid}/wallet`);
      setProfitWallet(walletRes.data.profit_wallet);
      setSecurityDeposit(walletRes.data.security_deposit);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">Sub Stockist Dashboard</h1>
          <p className="text-gray-600">Manage your inventory, outlets, and orders</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <Package className="h-8 w-8 opacity-80" />
            </div>
            <div className="text-3xl font-bold mb-1">{stats.totalStock || 0}</div>
            <div className="text-blue-100">Total Stock Units</div>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-8 w-8 opacity-80" />
            </div>
            <div className="text-3xl font-bold mb-1">₹{stats.totalSales?.toLocaleString() || 0}</div>
            <div className="text-green-100">Total Sales</div>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-8 w-8 opacity-80" />
            </div>
            <div className="text-3xl font-bold mb-1">₹{profitWallet?.toLocaleString() || 0}</div>
            <div className="text-purple-100">Profit Wallet</div>
          </Card>

          <Card className="bg-gradient-to-br from-pink-500 to-pink-600 text-white p-6 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <Store className="h-8 w-8 opacity-80" />
            </div>
            <div className="text-3xl font-bold mb-1">{stats.activeOutlets || 0}</div>
            <div className="text-pink-100">Active Outlets</div>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <Truck className="h-8 w-8 opacity-80" />
            </div>
            <div className="text-3xl font-bold mb-1">{stats.pendingOrders || 0}</div>
            <div className="text-orange-100">Pending Orders</div>
          </Card>
        </div>

        {/* Security Deposit Info */}
        <Card className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Security Deposit</h3>
              <p className="text-gray-600">Your security deposit with 3% monthly returns</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-600">₹{securityDeposit?.toLocaleString() || 0}</div>
              <div className="text-sm text-gray-500">Monthly Return: ₹{((securityDeposit || 0) * 0.03).toLocaleString()}</div>
            </div>
          </div>
        </Card>

        {/* Main Tabs */}
        <Card className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl">
          <Tabs defaultValue="inventory" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="outlets">Outlets</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            {/* INVENTORY TAB */}
            <TabsContent value="inventory" className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Stock Inventory</h2>
                <div className="flex gap-3">
                  <Input placeholder="Search products..." className="w-64" />
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>
              </div>

              {inventory.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No inventory items yet</p>
                  <p className="text-sm text-gray-400">Stock will appear here once allocated by master stockist</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Product</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">SKU</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Stock</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Allocated</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Available</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map((item) => (
                        <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-4 px-4">
                            <div className="font-medium text-gray-900">{item.product_name}</div>
                          </td>
                          <td className="py-4 px-4 text-gray-700">{item.sku}</td>
                          <td className="py-4 px-4">
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                              {item.total_stock}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-gray-700">{item.allocated}</td>
                          <td className="py-4 px-4">
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                              {item.available}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <Button size="sm" variant="outline">
                              Allocate
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* OUTLETS TAB */}
            <TabsContent value="outlets" className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Outlet Network</h2>

              {outlets.length === 0 ? (
                <div className="text-center py-12">
                  <Store className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No outlets yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {outlets.map((outlet) => (
                    <Card key={outlet.id} className="p-6 hover:shadow-xl transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-bold text-gray-900">{outlet.business_name}</h3>
                          <p className="text-sm text-gray-600">{outlet.owner_name}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          outlet.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {outlet.status}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Stock:</span>
                          <span className="font-medium">{outlet.total_stock || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Sales:</span>
                          <span className="font-medium">₹{outlet.total_sales?.toLocaleString() || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Location:</span>
                          <span className="font-medium">{outlet.district}</span>
                        </div>
                      </div>
                      <Button className="w-full mt-4" variant="outline" size="sm">
                        View Details
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ORDERS TAB */}
            <TabsContent value="orders" className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Stock Transfer Orders</h2>

              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <Truck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No orders yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <Card key={order.id} className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-gray-900">Order #{order.order_id}</div>
                          <div className="text-sm text-gray-600">{order.date}</div>
                        </div>
                        <span className={`px-4 py-2 rounded-full font-medium ${
                          order.status === 'completed' ? 'bg-green-100 text-green-700' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* REPORTS TAB */}
            <TabsContent value="reports" className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Business Reports</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6">
                  <BarChart3 className="h-12 w-12 text-purple-600 mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Sales Report</h3>
                  <p className="text-gray-600 mb-4">View detailed sales analytics and trends</p>
                  <Button className="w-full">Generate Report</Button>
                </Card>

                <Card className="p-6">
                  <Package className="h-12 w-12 text-blue-600 mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Stock Report</h3>
                  <p className="text-gray-600 mb-4">Track inventory movement and allocation</p>
                  <Button className="w-full">Generate Report</Button>
                </Card>

                <Card className="p-6">
                  <DollarSign className="h-12 w-12 text-green-600 mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Profit Report</h3>
                  <p className="text-gray-600 mb-4">View earnings and profit distribution</p>
                  <Button className="w-full">Generate Report</Button>
                </Card>

                <Card className="p-6">
                  <Store className="h-12 w-12 text-pink-600 mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Outlet Report</h3>
                  <p className="text-gray-600 mb-4">Outlet performance overview</p>
                  <Button className="w-full">Generate Report</Button>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default SubStockistDashboard;
