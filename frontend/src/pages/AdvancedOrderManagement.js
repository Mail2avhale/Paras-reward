import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  ShoppingCart, Search, Eye, Package, Truck, CheckCircle, 
  XCircle, ChevronLeft, ChevronRight, X, Clock
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdvancedOrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [statusNotes, setStatusNotes] = useState('');

  useEffect(() => {
    fetchOrders();
  }, [page, searchTerm, filterStatus]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let url = `${API}/admin/orders/all?page=${page}&limit=20`;
      if (searchTerm) url += `&search=${searchTerm}`;
      if (filterStatus) url += `&status=${filterStatus}`;
      
      const response = await axios.get(url);
      setOrders(response.data.orders || []);
      setTotal(response.data.total || 0);
      setTotalPages(response.data.pages || 1);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDetails = async (orderId) => {
    try {
      const response = await axios.get(`${API}/admin/orders/${orderId}/details`);
      setOrderDetails(response.data);
    } catch (error) {
      console.error('Error fetching order details:', error);
      toast.error('Failed to load order details');
    }
  };

  const openDetailsModal = async (order) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
    await fetchOrderDetails(order.order_id);
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedOrder) return;
    
    const confirmMessage = newStatus === 'cancelled' 
      ? 'Are you sure you want to cancel this order? PRC will be refunded and cashback deducted.'
      : `Update order status to ${newStatus}?`;
    
    if (!window.confirm(confirmMessage)) return;
    
    setLoading(true);
    try {
      await axios.put(`${API}/admin/orders/${selectedOrder.order_id}/status?status=${newStatus}${statusNotes ? `&notes=${encodeURIComponent(statusNotes)}` : ''}`);
      toast.success(`Order status updated to ${newStatus}`);
      setShowDetailsModal(false);
      setStatusNotes('');
      fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error(error.response?.data?.detail || 'Failed to update order status');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock },
      verified: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Package },
      delivered: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
      cancelled: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle }
    };
    const style = styles[status] || styles.pending;
    const Icon = style.icon;
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${style.bg} ${style.text}`}>
        <Icon className="h-3 w-3" />
        {status?.toUpperCase()}
      </span>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Order Management</h2>
          <p className="text-gray-600">View and manage all orders</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Order ID, User ID, Secret Code..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="w-full border rounded p-2"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="p-2 bg-yellow-50 rounded">
            <span className="text-yellow-700 font-semibold">Pending: </span>
            <span className="text-yellow-900">{orders.filter(o => o.status === 'pending').length}</span>
          </div>
          <div className="p-2 bg-blue-50 rounded">
            <span className="text-blue-700 font-semibold">Verified: </span>
            <span className="text-blue-900">{orders.filter(o => o.status === 'verified').length}</span>
          </div>
          <div className="p-2 bg-green-50 rounded">
            <span className="text-green-700 font-semibold">Delivered: </span>
            <span className="text-green-900">{orders.filter(o => o.status === 'delivered').length}</span>
          </div>
          <div className="p-2 bg-red-50 rounded">
            <span className="text-red-700 font-semibold">Cancelled: </span>
            <span className="text-red-900">{orders.filter(o => o.status === 'cancelled').length}</span>
          </div>
        </div>
        
        <div className="mt-2 text-sm text-gray-600">
          Total: {total} orders
        </div>
      </Card>

      {/* Orders List */}
      {loading ? (
        <Card className="p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading orders...</p>
        </Card>
      ) : orders.length === 0 ? (
        <Card className="p-12 text-center">
          <ShoppingCart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Orders Found</h3>
          <p className="text-gray-600">Try adjusting your filters</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.order_id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Order #{order.order_id.substring(0, 8)}...
                    </h3>
                    {getStatusBadge(order.status)}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">User:</span>
                      <strong className="ml-1">{order.user_name || 'Unknown'}</strong>
                    </div>
                    <div>
                      <span className="text-gray-600">Products:</span>
                      <strong className="ml-1">{order.products?.length || 1}</strong>
                    </div>
                    <div>
                      <span className="text-gray-600">Total PRC:</span>
                      <strong className="ml-1">{(order.total_prc || 0).toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-gray-600">Cashback:</span>
                      <strong className="ml-1 text-green-600">{formatCurrency(order.cashback_amount || 0)}</strong>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-500">
                    Secret Code: <strong>{order.secret_code}</strong> | 
                    Created: {new Date(order.created_at).toLocaleString()}
                  </div>
                </div>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openDetailsModal(order)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Details
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4">
          <Button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            variant="outline"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <Button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            variant="outline"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {/* Order Details Modal */}
      {showDetailsModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-4xl my-8 p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
                <p className="text-sm text-gray-600">Order ID: {selectedOrder.order_id}</p>
              </div>
              <Button onClick={() => setShowDetailsModal(false)} variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {orderDetails ? (
              <div className="space-y-6">
                {/* Status & Actions */}
                <Card className="p-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Current Status</p>
                      {getStatusBadge(orderDetails.status)}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Created</p>
                      <p className="font-semibold">{new Date(orderDetails.created_at).toLocaleString()}</p>
                    </div>
                  </div>

                  {orderDetails.status !== 'delivered' && orderDetails.status !== 'cancelled' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Status Notes (Optional)
                        </label>
                        <textarea
                          className="w-full border rounded p-2 text-sm"
                          rows="2"
                          value={statusNotes}
                          onChange={(e) => setStatusNotes(e.target.value)}
                          placeholder="Add notes about status update..."
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        {orderDetails.status === 'pending' && (
                          <Button
                            onClick={() => handleUpdateStatus('verified')}
                            disabled={loading}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                          >
                            <Package className="h-4 w-4 mr-2" />
                            Mark as Verified
                          </Button>
                        )}
                        
                        {orderDetails.status === 'verified' && (
                          <Button
                            onClick={() => handleUpdateStatus('delivered')}
                            disabled={loading}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                          >
                            <Truck className="h-4 w-4 mr-2" />
                            Mark as Delivered
                          </Button>
                        )}
                        
                        <Button
                          onClick={() => handleUpdateStatus('cancelled')}
                          disabled={loading}
                          variant="destructive"
                          className="flex-1"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancel Order
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>

                {/* User Details */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Customer Details</h3>
                  <Card className="p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Name:</span>
                        <p className="font-semibold">{orderDetails.user_details?.name || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Email:</span>
                        <p className="font-semibold">{orderDetails.user_details?.email || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Mobile:</span>
                        <p className="font-semibold">{orderDetails.user_details?.mobile || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Subscription:</span>
                        <p className="font-semibold capitalize">{orderDetails.user_details?.subscription_plan || 'Explorer'}</p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Order Items */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Order Items</h3>
                  <div className="space-y-2">
                    {orderDetails.products && orderDetails.products.length > 0 ? (
                      orderDetails.products.map((product, idx) => (
                        <Card key={idx} className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-semibold">{product.name}</h4>
                              <p className="text-sm text-gray-600">Quantity: {product.quantity}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{product.prc_price} PRC</p>
                              <p className="text-sm text-gray-600">x {product.quantity}</p>
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <Card className="p-4">
                        <p className="text-sm text-gray-600">Legacy single product order</p>
                        <p className="font-semibold">{orderDetails.total_prc} PRC</p>
                      </Card>
                    )}
                  </div>
                </div>

                {/* Financial Summary */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Financial Summary</h3>
                  <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">Total PRC:</span>
                        <span className="font-semibold">{(orderDetails.total_prc || 0).toFixed(2)} PRC</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">Cashback (25%):</span>
                        <span className="font-semibold text-green-600">{formatCurrency(orderDetails.cashback_amount || 0)}</span>
                      </div>
                      {orderDetails.admin_notes && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-gray-600">Admin Notes:</p>
                          <p className="text-sm">{orderDetails.admin_notes}</p>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                {/* Secret Code */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Secret Code</h3>
                  <Card className="p-4 bg-yellow-50 border-2 border-yellow-200">
                    <p className="text-center text-3xl font-bold text-yellow-900 tracking-wider">
                      {orderDetails.secret_code}
                    </p>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdvancedOrderManagement;
