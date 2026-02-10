import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Pagination from '@/components/Pagination';
import {
  Package, Search, Truck, CheckCircle, XCircle, Clock,
  Eye, RefreshCw, Filter, MapPin, Phone, User
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const ITEMS_PER_PAGE = 10;

const AdminOrders = ({ user }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      params.append('limit', '500');
      
      const response = await axios.get(`${API}/admin/orders/all?${params.toString()}`);
      // API returns { orders: [], total: number, ... }
      setOrders(response.data?.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      setProcessing(true);
      await axios.put(`${API}/orders/${orderId}/status`, {
        status: newStatus,
        admin_id: user?.uid
      });
      toast.success(`Order status updated to ${newStatus}`);
      fetchOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    } finally {
      setProcessing(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.user_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getStatusBadge = (status) => {
    const badges = {
      'pending': <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</span>,
      'confirmed': <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Confirmed</span>,
      'processing': <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full flex items-center gap-1"><Package className="h-3 w-3" /> Processing</span>,
      'shipped': <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 text-xs rounded-full flex items-center gap-1"><Truck className="h-3 w-3" /> Shipped</span>,
      'delivered': <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Delivered</span>,
      'cancelled': <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full flex items-center gap-1"><XCircle className="h-3 w-3" /> Cancelled</span>
    };
    return badges[status] || badges['pending'];
  };

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => ['confirmed', 'processing', 'shipped'].includes(o.status)).length,
    completed: orders.filter(o => o.status === 'delivered').length
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Order Management</h1>
        <p className="text-gray-500">Manage and track all customer orders</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 bg-blue-500/10 border-blue-500/30">
          <p className="text-xs text-blue-600">Total Orders</p>
          <p className="text-2xl font-bold text-blue-400">{stats.total}</p>
        </Card>
        <Card className="p-4 bg-yellow-500/10 border-yellow-500/30">
          <p className="text-xs text-yellow-600">Pending</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
        </Card>
        <Card className="p-4 bg-purple-500/10 border-purple-500/30">
          <p className="text-xs text-purple-600">In Progress</p>
          <p className="text-2xl font-bold text-purple-400">{stats.processing}</p>
        </Card>
        <Card className="p-4 bg-green-500/10 border-green-500/30">
          <p className="text-xs text-green-600">Completed</p>
          <p className="text-2xl font-bold text-green-400">{stats.completed}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by order ID, user ID or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Button onClick={fetchOrders} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </Card>

      {/* Orders List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No orders found</p>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {paginatedOrders.map((order) => (
              <Card key={order.order_id} className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-purple-500/20 rounded-lg">
                      <Package className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                    <p className="font-semibold text-white">#{order.order_id?.slice(-8)}</p>
                    <p className="text-sm text-gray-500">{order.user_name || order.user_id}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold text-purple-600">{order.total_prc?.toLocaleString()} PRC</p>
                    <p className="text-xs text-gray-500">{order.items?.length || 0} item(s)</p>
                  </div>
                  {getStatusBadge(order.status)}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <Eye className="h-4 w-4 mr-1" /> View
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          </div>
          
          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredOrders.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Order Details</h2>
                <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-gray-300">
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                {/* Order Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Order ID</p>
                    <p className="font-mono font-medium">#{selectedOrder.order_id?.slice(-8)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    {getStatusBadge(selectedOrder.status)}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Customer</p>
                    <p className="font-medium">{selectedOrder.user_name || selectedOrder.user_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total</p>
                    <p className="font-bold text-purple-600">{selectedOrder.total_prc?.toLocaleString()} PRC</p>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <p className="text-sm text-gray-500 mb-2">Items</p>
                  <div className="space-y-2">
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {item.image && <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded" />}
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                          </div>
                        </div>
                        <p className="font-semibold">{item.prc_price?.toLocaleString()} PRC</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shipping Address */}
                {selectedOrder.shipping_address && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Shipping Address</p>
                    <div className="p-3 bg-gray-800/50 rounded-lg">
                      <p className="font-medium">{selectedOrder.shipping_address.name}</p>
                      <p className="text-sm text-gray-400">{selectedOrder.shipping_address.address}</p>
                      <p className="text-sm text-gray-400">{selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.state} - {selectedOrder.shipping_address.pincode}</p>
                      <p className="text-sm text-gray-400">Phone: {selectedOrder.shipping_address.phone}</p>
                    </div>
                  </div>
                )}

                {/* Status Update */}
                {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-500 mb-3">Update Status</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedOrder.status === 'pending' && (
                        <Button size="sm" onClick={() => handleUpdateStatus(selectedOrder.order_id, 'confirmed')} disabled={processing}>
                          Confirm Order
                        </Button>
                      )}
                      {selectedOrder.status === 'confirmed' && (
                        <Button size="sm" onClick={() => handleUpdateStatus(selectedOrder.order_id, 'processing')} disabled={processing}>
                          Start Processing
                        </Button>
                      )}
                      {selectedOrder.status === 'processing' && (
                        <Button size="sm" onClick={() => handleUpdateStatus(selectedOrder.order_id, 'shipped')} disabled={processing}>
                          Mark Shipped
                        </Button>
                      )}
                      {selectedOrder.status === 'shipped' && (
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleUpdateStatus(selectedOrder.order_id, 'delivered')} disabled={processing}>
                          Mark Delivered
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(selectedOrder.order_id, 'cancelled')} disabled={processing}>
                        Cancel Order
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
