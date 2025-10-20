import { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Package, Clock, CheckCircle, Truck } from 'lucide-react';

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
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Package className="h-6 w-6 text-purple-600" />
                      <h3 className="text-xl font-bold text-gray-900">{order.product_name}</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500">PRC Amount</p>
                        <p className="font-semibold text-gray-900">{order.prc_amount} PRC</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Cashback</p>
                        <p className="font-semibold text-green-600">+{order.cashback_amount} PRC</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Cash Fees</p>
                        <p className="font-semibold text-gray-900">₹{order.total_cash_fee.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Order Date</p>
                        <p className="font-semibold text-gray-900">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-purple-50 p-4 rounded-xl">
                      <p className="text-sm text-gray-600 mb-1">Secret Code</p>
                      <p data-testid={`secret-code-${index}`} className="text-2xl font-bold text-purple-600 tracking-wider">
                        {order.secret_code}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Show this code at the outlet to collect your product
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-3">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      <span className="capitalize">{order.status}</span>
                    </div>
                    
                    {order.delivered_at && (
                      <p className="text-sm text-gray-500">
                        Delivered: {new Date(order.delivered_at).toLocaleDateString()}
                      </p>
                    )}
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