import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Package, Clock, CheckCircle, Truck, ShoppingBag, Trash2, AlertCircle, ArrowLeft, Copy, TrendingUp, Coins, Wallet, Gift } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Orders = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteOrderId, setDeleteOrderId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [userStats, setUserStats] = useState(null);
  const itemsPerPage = 10;

  // Pagination calculations
  const totalPages = Math.ceil(orders.length / itemsPerPage);
  const paginatedOrders = orders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    fetchOrders();
    fetchUserStats();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/orders/user/${user.uid}`);
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async () => {
    try {
      const response = await axios.get(`${API}/user/${user.uid}/redemption-stats`);
      setUserStats(response.data);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const handleDeleteOrder = async () => {
    if (!deleteOrderId) return;

    try {
      await axios.delete(`${API}/orders/${deleteOrderId}`);
      toast.success('Order cancelled successfully');
      setDeleteOrderId(null);
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel order');
    }
  };

  const canCancelOrder = (order) => {
    return order.status === 'pending' || order.status === 'verified';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'verified':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'delivered':
        return <Truck className="h-4 w-4 text-emerald-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Package className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'verified':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'delivered':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const copySecretCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Secret code copied!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-white text-xl font-bold">My Orders</h1>
        </div>
      </div>

      {/* User Stats Summary */}
      {userStats && (
        <div className="px-5 mb-4">
          <div className="bg-gradient-to-r from-amber-500/10 to-purple-500/10 rounded-2xl p-4 border border-amber-500/20">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              Your Redemption Summary
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Total PRC Redeemed */}
              <div className="bg-gray-900/50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <p className="text-gray-400 text-xs">PRC Redeemed</p>
                </div>
                <p className="text-white font-bold text-lg">{(userStats.total_prc_redeemed || 0).toLocaleString()}</p>
                <p className="text-gray-500 text-xs">≈ ₹{((userStats.total_prc_redeemed || 0) * 0.1).toFixed(2)}</p>
              </div>
              
              {/* Total Earned */}
              <div className="bg-gray-900/50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="w-4 h-4 text-emerald-500" />
                  <p className="text-gray-400 text-xs">Total Earned</p>
                </div>
                <p className="text-emerald-400 font-bold text-lg">{(userStats.total_earned || 0).toLocaleString()}</p>
                <p className="text-gray-500 text-xs">≈ ₹{((userStats.total_earned || 0) * 0.1).toFixed(2)}</p>
              </div>
              
              {/* Cashback Received */}
              <div className="bg-gray-900/50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="w-4 h-4 text-purple-500" />
                  <p className="text-gray-400 text-xs">Cashback</p>
                </div>
                <p className="text-purple-400 font-bold text-lg">₹{(userStats.total_cashback || 0).toFixed(2)}</p>
              </div>
              
              {/* Orders Count */}
              <div className="bg-gray-900/50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-blue-500" />
                  <p className="text-gray-400 text-xs">Total Orders</p>
                </div>
                <p className="text-blue-400 font-bold text-lg">{userStats.total_orders || 0}</p>
                <p className="text-gray-500 text-xs">{userStats.delivered_orders || 0} delivered</p>
              </div>
            </div>
            
            {/* Earnings Breakdown */}
            {userStats.earnings_breakdown && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <p className="text-gray-400 text-xs mb-2">Earnings Breakdown</p>
                <div className="flex flex-wrap gap-2">
                  {userStats.earnings_breakdown.mining > 0 && (
                    <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs">
                      Mining: {userStats.earnings_breakdown.mining.toFixed(2)} PRC
                    </span>
                  )}
                  {userStats.earnings_breakdown.referral > 0 && (
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs">
                      Referral: {userStats.earnings_breakdown.referral.toFixed(2)} PRC
                    </span>
                  )}
                  {userStats.earnings_breakdown.tap_game > 0 && (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">
                      Tap Game: {userStats.earnings_breakdown.tap_game.toFixed(2)} PRC
                    </span>
                  )}
                  {userStats.earnings_breakdown.cashback > 0 && (
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs">
                      Cashback: {userStats.earnings_breakdown.cashback.toFixed(2)} PRC
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="px-5">
        {orders.length === 0 ? (
          <div data-testid="no-orders" className="bg-gray-900/50 rounded-2xl p-8 border border-gray-800 text-center">
            <Package className="h-16 w-16 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">No orders yet</p>
            <p className="text-gray-600 text-sm mb-6">Visit the marketplace to redeem your first product!</p>
            <button 
              onClick={() => navigate('/marketplace')}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-gray-900 font-bold rounded-xl hover:from-amber-400 hover:to-amber-500 transition-all"
            >
              Browse Marketplace
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedOrders.map((order, index) => (
              <div
                key={order.order_id}
                data-testid={`order-${index}`}
                className="bg-gray-900/50 rounded-2xl p-5 border border-gray-800"
              >
                {/* Order Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                      <ShoppingBag className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">#{order.order_id.slice(0, 8)}</h3>
                      <p className="text-gray-500 text-xs">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)}
                    <span className="capitalize">{order.status}</span>
                  </div>
                </div>

                {/* Order Items */}
                <div className="space-y-2 mb-4">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-800/50 p-3 rounded-xl">
                        <div className="flex items-center gap-3">
                          <Package className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-white text-sm font-medium">{item.product_name}</p>
                            <p className="text-gray-500 text-xs">Qty: {item.quantity}</p>
                          </div>
                        </div>
                        <p className="text-amber-500 font-semibold text-sm">{item.prc_price * item.quantity} PRC</p>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-between bg-gray-800/50 p-3 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Package className="h-4 w-4 text-gray-500" />
                        <p className="text-white text-sm font-medium">{order.product_name || 'Product'}</p>
                      </div>
                      <p className="text-amber-500 font-semibold text-sm">{order.prc_amount || order.total_prc} PRC</p>
                    </div>
                  )}
                </div>

                {/* Order Summary */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-800/30 rounded-xl p-3">
                    <p className="text-gray-500 text-xs mb-1">Total PRC</p>
                    <p className="text-white font-bold">{order.total_prc || order.prc_amount} PRC</p>
                  </div>
                  <div className="bg-gray-800/30 rounded-xl p-3">
                    <p className="text-gray-500 text-xs mb-1">Cashback</p>
                    <p className="text-emerald-400 font-bold">+₹{(order.cashback_amount || 0).toFixed(2)}</p>
                  </div>
                </div>

                {/* Secret Code */}
                {order.status !== 'cancelled' && order.secret_code && (
                  <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/5 p-4 rounded-xl border border-amber-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-xs mb-1">Secret Code</p>
                        <p data-testid={`secret-code-${index}`} className="text-2xl font-bold text-amber-500 tracking-wider font-mono">
                          {order.secret_code}
                        </p>
                      </div>
                      <button 
                        onClick={() => copySecretCode(order.secret_code)}
                        className="p-2 bg-amber-500/20 rounded-lg hover:bg-amber-500/30 transition-colors"
                      >
                        <Copy className="h-5 w-5 text-amber-500" />
                      </button>
                    </div>
                    <p className="text-gray-500 text-xs mt-2">
                      Show this code at the outlet to collect your products
                    </p>
                  </div>
                )}

                {/* Cancel Button */}
                {canCancelOrder(order) && (
                  <button
                    onClick={() => setDeleteOrderId(order.order_id)}
                    className="mt-4 w-full py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Cancel Order
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {orders.length > itemsPerPage && (
          <div className="mt-6 flex items-center justify-between bg-gray-900/50 rounded-xl p-4 border border-gray-800">
            <span className="text-gray-400 text-sm">
              Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, orders.length)} of {orders.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                data-testid="orders-prev-page"
              >
                Prev
              </button>
              <span className="px-4 py-2 text-amber-500 font-medium">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                data-testid="orders-next-page"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteOrderId} onOpenChange={() => setDeleteOrderId(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Cancel Order?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to cancel this order? This action cannot be undone and your PRC will be refunded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700">
              Keep Order
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteOrder}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Orders;
