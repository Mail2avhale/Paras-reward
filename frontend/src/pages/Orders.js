import { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Package, Clock, CheckCircle, Truck, ShoppingBag } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Orders = ({ user, onLogout }) => {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders/user/${user.uid}`);
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
      // Set empty array on error so UI doesn't break
      setOrders([]);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'verified':
        return <CheckCircle className="h-5 w-5 text-blue-600" />;
      case 'delivered':
        return <Truck className="h-5 w-5 text-green-600" />;
      default:
        return <Package className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'verified':
        return 'bg-blue-100 text-blue-700';
      case 'delivered':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8">My Orders</h1>

        {orders.length === 0 ? (
          <Card data-testid="no-orders" className="bg-white/80 backdrop-blur-sm p-12 rounded-3xl shadow-xl text-center">
            <Package className="h-20 w-20 text-gray-300 mx-auto mb-4" />
            <p className="text-xl text-gray-500 mb-4">No orders yet</p>
            <p className="text-gray-400">Visit the marketplace to redeem your first product!</p>
          </Card>
        ) : (
          <div className="space-y-6">
            {orders.map((order, index) => (
              <Card
                key={order.order_id}
                data-testid={`order-${index}`}
                className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all"
              >
                <div className="flex flex-col gap-6">
                  {/* Order Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShoppingBag className="h-6 w-6 text-purple-600" />
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">Order #{order.order_id.slice(0, 8)}</h3>
                        <p className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleDateString()} at {new Date(order.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      <span className="capitalize">{order.status}</span>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Items ({order.items?.length || 1})</h4>
                    <div className="space-y-2">
                      {order.items && order.items.length > 0 ? (
                        // Multi-product cart order
                        order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                            <div className="flex items-center gap-3">
                              <Package className="h-5 w-5 text-purple-400" />
                              <div>
                                <p className="font-medium text-gray-900">{item.product_name}</p>
                                <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                              </div>
                            </div>
                            <p className="font-semibold text-purple-600">{item.prc_price * item.quantity} PRC</p>
                          </div>
                        ))
                      ) : (
                        // Legacy single product order
                        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Package className="h-5 w-5 text-purple-400" />
                            <p className="font-medium text-gray-900">{order.product_name || 'Product'}</p>
                          </div>
                          <p className="font-semibold text-purple-600">{order.prc_amount || order.total_prc} PRC</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Summary */}
                  <div className="border-t pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500">Total PRC</p>
                        <p className="font-bold text-gray-900 text-lg">{order.total_prc || order.prc_amount} PRC</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Cashback Earned</p>
                        <p className="font-bold text-green-600 text-lg">+₹{((order.cashback_amount || 0) / 10).toFixed(2)}</p>
                      </div>
                      {order.delivery_address && (
                        <div className="col-span-2">
                          <p className="text-sm text-gray-500">Delivery Address</p>
                          <p className="font-medium text-gray-900">{order.delivery_address}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Secret Code */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-xl border-2 border-purple-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Secret Code</p>
                        <p data-testid={`secret-code-${index}`} className="text-3xl font-bold text-purple-600 tracking-wider font-mono">
                          {order.secret_code}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          👉 Show this code at the outlet to collect your products
                        </p>
                      </div>
                      <div className="text-right">
                        {order.status === 'delivered' && order.delivered_at && (
                          <div>
                            <p className="text-xs text-gray-500">Delivered</p>
                            <p className="text-sm font-semibold text-green-600">
                              {new Date(order.delivered_at).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;