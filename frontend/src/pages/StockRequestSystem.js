import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Package, Plus, Clock, CheckCircle, XCircle, 
  Eye, TrendingUp, RefreshCw, Search, Filter, Edit, Trash2, X
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StockRequestSystem = () => {
  const [activeTab, setActiveTab] = useState('my-requests');
  const [myRequests, setMyRequests] = useState([]);
  const [pendingForMe, setPendingForMe] = useState([]);
  const [myInventory, setMyInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [newStockData, setNewStockData] = useState({
    product_id: '',
    quantity: '',
    action: 'add' // 'add' or 'set'
  });
  
  const [newRequest, setNewRequest] = useState({
    product_id: '',
    quantity: '',
    notes: ''
  });
  
  const [editRequest, setEditRequest] = useState({
    quantity: '',
    notes: ''
  });
  
  const [rejectionReason, setRejectionReason] = useState('');
  
  const user = JSON.parse(localStorage.getItem('paras_user') || '{}');
  const userRole = user.role || 'user';
  
  // Determine parent role for display
  const parentRoleMap = {
    'outlet': 'Sub Stockist',
    'sub_stockist': 'Master Stockist',
    'master_stockist': 'Company (Admin)'
  };
  
  const canCreateRequest = ['outlet', 'sub_stockist', 'master_stockist'].includes(userRole);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Admin sees all requests
      if (userRole === 'admin') {
        const allRequestsRes = await axios.get(`${API}/admin/stock/requests`);
        setMyRequests(allRequestsRes.data.requests || []);
        setPendingForMe(allRequestsRes.data.requests?.filter(r => r.status === 'pending') || []);
      } else {
        // Fetch my requests
        const myRequestsRes = await axios.get(`${API}/stock/request/my-requests/${user.uid}`);
        setMyRequests(myRequestsRes.data.requests || []);
        
        // Fetch pending requests for me to approve
        const pendingRes = await axios.get(`${API}/stock/request/pending-for-me/${user.uid}`);
        setPendingForMe(pendingRes.data.requests || []);
      }
      
      // Fetch my inventory
      const inventoryRes = await axios.get(`${API}/stock/inventory/my-stock/${user.uid}`);
      setMyInventory(inventoryRes.data.inventory || []);
      
      // Fetch products for request creation (using pagination API)
      const productsRes = await axios.get(`${API}/products?page=1&limit=1000`);
      setProducts(productsRes.data?.products || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!newRequest.product_id || !newRequest.quantity || parseInt(newRequest.quantity) <= 0) {
      toast.error('Please select a product and enter valid quantity');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/stock/request/create`, {
        product_id: newRequest.product_id,
        quantity: parseInt(newRequest.quantity),
        notes: newRequest.notes,
        user_uid: user.uid
      });
      
      toast.success(`Stock request created! Available stock: ${response.data.available_stock}`);
      setShowCreateModal(false);
      setNewRequest({ product_id: '', quantity: '', notes: '' });
      fetchData();
    } catch (error) {
      console.error('Error creating request:', error);
      toast.error(error.response?.data?.detail || 'Failed to create request');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/stock/request/${selectedRequest.request_id}/approve`, {
        approver_uid: user.uid
      });
      
      toast.success(
        <div>
          <p className="font-semibold">Stock request approved!</p>
          <p className="text-sm">Your balance: {response.data.parent_balance}</p>
          <p className="text-sm">Requester balance: {response.data.requester_balance}</p>
        </div>
      );
      
      setShowApprovalModal(false);
      setSelectedRequest(null);
      fetchData();
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error(error.response?.data?.detail || 'Failed to approve request');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide rejection reason');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API}/stock/request/${selectedRequest.request_id}/reject`, {
        rejection_reason: rejectionReason,
        approver_uid: user.uid
      });
      
      toast.success('Stock request rejected');
      setShowApprovalModal(false);
      setSelectedRequest(null);
      setRejectionReason('');
      fetchData();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error(error.response?.data?.detail || 'Failed to reject request');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editRequest.quantity || parseInt(editRequest.quantity) <= 0) {
      toast.error('Please enter valid quantity');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.put(`${API}/stock/request/${selectedRequest.request_id}/edit`, {
        quantity: parseInt(editRequest.quantity),
        notes: editRequest.notes,
        user_uid: user.uid
      });
      
      toast.success(`Request updated! Available stock: ${response.data.available_stock}`);
      setShowEditModal(false);
      setSelectedRequest(null);
      setEditRequest({ quantity: '', notes: '' });
      fetchData();
    } catch (error) {
      console.error('Error editing request:', error);
      toast.error(error.response?.data?.detail || 'Failed to edit request');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await axios.delete(`${API}/stock/request/${selectedRequest.request_id}/delete`, {
        data: { user_uid: user.uid }
      });
      
      toast.success('Stock request deleted successfully');
      setShowDeleteModal(false);
      setSelectedRequest(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting request:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete request');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStock = async () => {
    if (!newStockData.product_id || !newStockData.quantity || parseInt(newStockData.quantity) <= 0) {
      toast.error('Please select a product and enter valid quantity');
      return;
    }
    
    setLoading(true);
    try {
      const endpoint = newStockData.action === 'add' ? '/admin/stock/add' : '/admin/stock/update';
      const response = await axios.post(`${API}${endpoint}`, {
        admin_uid: user.uid,
        product_id: newStockData.product_id,
        quantity: parseInt(newStockData.quantity)
      });
      
      toast.success(response.data.message);
      setShowAddStockModal(false);
      setNewStockData({ product_id: '', quantity: '', action: 'add' });
      fetchData();
    } catch (error) {
      console.error('Error adding stock:', error);
      toast.error(error.response?.data?.detail || 'Failed to add stock');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (req) => {
    setSelectedRequest(req);
    setEditRequest({
      quantity: req.quantity.toString(),
      notes: req.notes || ''
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (req) => {
    setSelectedRequest(req);
    setShowDeleteModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const filteredMyRequests = filterStatus === 'all' 
    ? myRequests 
    : myRequests.filter(r => r.status === filterStatus);

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Stock Request System</h2>
          <p className="text-gray-600 mt-1">Request stock from parent entities in the hierarchy</p>
        </div>
        {canCreateRequest && (
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Request
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100">
          <Package className="h-8 w-8 text-blue-600 mb-2" />
          <div className="text-sm font-medium text-blue-600 mb-1">My Inventory Items</div>
          <div className="text-3xl font-bold text-blue-900">{myInventory.length}</div>
        </Card>
        
        <Card className="p-6 bg-gradient-to-br from-yellow-50 to-yellow-100">
          <Clock className="h-8 w-8 text-yellow-600 mb-2" />
          <div className="text-sm font-medium text-yellow-600 mb-1">My Pending Requests</div>
          <div className="text-3xl font-bold text-yellow-900">
            {myRequests.filter(r => r.status === 'pending').length}
          </div>
        </Card>
        
        <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100">
          <TrendingUp className="h-8 w-8 text-orange-600 mb-2" />
          <div className="text-sm font-medium text-orange-600 mb-1">Requests to Approve</div>
          <div className="text-3xl font-bold text-orange-900">{pendingForMe.length}</div>
        </Card>
        
        <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100">
          <CheckCircle className="h-8 w-8 text-green-600 mb-2" />
          <div className="text-sm font-medium text-green-600 mb-1">Approved Requests</div>
          <div className="text-3xl font-bold text-green-900">
            {myRequests.filter(r => r.status === 'approved').length}
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('my-requests')}
            className={`px-6 py-3 border-b-2 font-medium transition-all ${
              activeTab === 'my-requests'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {userRole === 'admin' ? 'All Requests' : 'My Requests'} ({myRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('approve-requests')}
            className={`px-6 py-3 border-b-2 font-medium transition-all ${
              activeTab === 'approve-requests'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {userRole === 'admin' ? 'Pending Requests' : 'Requests to Approve'} ({pendingForMe.length})
          </button>
          <button
            onClick={() => setActiveTab('my-inventory')}
            className={`px-6 py-3 border-b-2 font-medium transition-all ${
              activeTab === 'my-inventory'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            My Inventory ({myInventory.length})
          </button>
        </div>
      </div>

      {/* My Requests Tab */}
      {activeTab === 'my-requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Filter className="h-5 w-5 text-gray-500" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <Button onClick={fetchData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {filteredMyRequests.length === 0 ? (
            <Card className="p-12 text-center">
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Requests Yet</h3>
              <p className="text-gray-600 mb-4">Create your first stock request to get started</p>
              {canCreateRequest && (
                <Button onClick={() => setShowCreateModal(true)} className="bg-purple-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Request
                </Button>
              )}
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested From</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Available Stock</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredMyRequests.map((req) => (
                      <tr key={req.request_id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="font-medium text-gray-900">{req.product_name}</div>
                          <div className="text-xs text-gray-500">{req.product_id}</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="text-lg font-bold text-purple-600">{req.quantity}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-gray-900">{req.parent_name}</div>
                          <div className="text-xs text-gray-500">{req.parent_role.replace('_', ' ').toUpperCase()}</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className={`font-semibold ${req.available_stock >= req.quantity ? 'text-green-600' : 'text-red-600'}`}>
                            {req.available_stock}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-900">{formatDate(req.created_at)}</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {getStatusBadge(req.status)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRequest(req);
                                setShowDetailModal(true);
                              }}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            
                            {req.status === 'pending' && req.requester_id === user.uid && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() => openEditModal(req)}
                                  title="Edit Request"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                  onClick={() => openDeleteModal(req)}
                                  title="Delete Request"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Requests to Approve Tab */}
      {activeTab === 'approve-requests' && (
        <div className="space-y-4">
          {pendingForMe.length === 0 ? (
            <Card className="p-12 text-center">
              <CheckCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Pending Requests</h3>
              <p className="text-gray-600">You have no stock requests waiting for approval</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested By</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Your Stock</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pendingForMe.map((req) => {
                      const myStock = myInventory.find(inv => inv.product_id === req.product_id);
                      const availableQty = myStock?.quantity || 0;
                      const canFulfill = availableQty >= req.quantity;
                      
                      return (
                        <tr key={req.request_id} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div className="font-medium text-gray-900">{req.product_name}</div>
                            <div className="text-xs text-gray-500">{req.product_id}</div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="text-lg font-bold text-purple-600">{req.quantity}</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-medium text-gray-900">{req.requester_name}</div>
                            <div className="text-xs text-gray-500">{req.requester_role.replace('_', ' ').toUpperCase()}</div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className={`text-lg font-bold ${canFulfill ? 'text-green-600' : 'text-red-600'}`}>
                              {availableQty}
                            </div>
                            {!canFulfill && (
                              <div className="text-xs text-red-600 mt-1">Insufficient!</div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-900">{formatDate(req.created_at)}</div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="flex gap-2 justify-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setShowDetailModal(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setShowApprovalModal(true);
                                }}
                                disabled={!canFulfill}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setShowApprovalModal(true);
                                }}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* My Inventory Tab */}
      {activeTab === 'my-inventory' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {userRole === 'admin' ? 'Company Stock Inventory' : 'My Stock Inventory'}
            </h3>
            {userRole === 'admin' && (
              <Button 
                onClick={() => setShowAddStockModal(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Stock
              </Button>
            )}
          </div>

          {myInventory.length === 0 ? (
            <Card className="p-12 text-center">
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Stock Available</h3>
              <p className="text-gray-600 mb-4">
                {userRole === 'admin' 
                  ? 'Your company inventory is empty. Add stock to start fulfilling requests.' 
                  : 'Your inventory is empty. Request stock from your parent entity.'}
              </p>
              {userRole === 'admin' && (
                <Button 
                  onClick={() => setShowAddStockModal(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Stock
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myInventory.map((item) => (
                <Card key={item.inventory_id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <Package className="h-10 w-10 text-purple-600" />
                    <div className="text-right">
                      <div className="text-3xl font-bold text-purple-600">{item.quantity}</div>
                      <div className="text-xs text-gray-500">units</div>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.product_name}</h3>
                  <p className="text-sm text-gray-500 mb-4">{item.product_id}</p>
                  <div className="text-xs text-gray-400">
                    Updated: {formatDate(item.updated_at)}
                  </div>
                  {userRole === 'admin' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-4"
                      onClick={() => {
                        setNewStockData({
                          product_id: item.product_id,
                          quantity: item.quantity.toString(),
                          action: 'set'
                        });
                        setShowAddStockModal(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Update Quantity
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Request Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Stock Request</h2>
            <p className="text-sm text-gray-600 mb-4">
              Request stock from: <span className="font-semibold text-purple-600">{parentRoleMap[userRole]}</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product *</label>
                <select
                  className="w-full border rounded p-3"
                  value={newRequest.product_id}
                  onChange={(e) => setNewRequest({...newRequest, product_id: e.target.value})}
                >
                  <option value="">Select Product</option>
                  {products.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.name} - ₹{p.cashback_price}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
                <Input
                  type="number"
                  min="1"
                  value={newRequest.quantity}
                  onChange={(e) => setNewRequest({...newRequest, quantity: e.target.value})}
                  placeholder="Enter quantity"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  className="w-full border rounded p-3"
                  rows="3"
                  value={newRequest.notes}
                  onChange={(e) => setNewRequest({...newRequest, notes: e.target.value})}
                  placeholder="Add any additional notes..."
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewRequest({ product_id: '', quantity: '', notes: '' });
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateRequest}
                  disabled={loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {loading ? 'Creating...' : 'Create Request'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Request Details</h2>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Product</label>
                  <p className="text-base font-semibold text-gray-900">{selectedRequest.product_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Quantity</label>
                  <p className="text-2xl font-bold text-purple-600">{selectedRequest.quantity}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Requester</label>
                  <p className="text-base text-gray-900">{selectedRequest.requester_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Parent</label>
                  <p className="text-base text-gray-900">{selectedRequest.parent_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Available Stock</label>
                  <p className="text-lg font-bold text-green-600">{selectedRequest.available_stock}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
              </div>

              {selectedRequest.notes && (
                <div className="border-t pt-4">
                  <label className="text-sm font-medium text-gray-600">Notes</label>
                  <p className="text-base text-gray-900 bg-gray-50 p-3 rounded mt-2">{selectedRequest.notes}</p>
                </div>
              )}

              {selectedRequest.rejection_reason && (
                <div className="border-t pt-4">
                  <label className="text-sm font-medium text-red-600">Rejection Reason</label>
                  <p className="text-base text-gray-900 bg-red-50 p-3 rounded mt-2">{selectedRequest.rejection_reason}</p>
                </div>
              )}

              <div className="border-t pt-4">
                <label className="text-sm font-medium text-gray-600">Timeline</label>
                <div className="space-y-2 mt-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created</span>
                    <span className="text-gray-900 font-medium">{formatDate(selectedRequest.created_at)}</span>
                  </div>
                  {selectedRequest.approved_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Approved</span>
                      <span className="text-gray-900 font-medium">{formatDate(selectedRequest.approved_at)}</span>
                    </div>
                  )}
                  {selectedRequest.rejected_at && (
                    <div className="flex justify-between">
                      <span className="text-red-600">Rejected</span>
                      <span className="text-red-900 font-medium">{formatDate(selectedRequest.rejected_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Button onClick={() => setShowDetailModal(false)} variant="outline" className="w-full">
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Approve/Reject Request</h2>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Product: <span className="font-semibold text-gray-900">{selectedRequest.product_name}</span></p>
                <p className="text-sm text-gray-600">Quantity: <span className="font-semibold text-gray-900">{selectedRequest.quantity}</span></p>
                <p className="text-sm text-gray-600">Requester: <span className="font-semibold text-gray-900">{selectedRequest.requester_name}</span></p>
                <p className="text-sm text-gray-600">Your Stock: <span className="font-semibold text-green-600">{selectedRequest.available_stock}</span></p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rejection Reason (if rejecting)</label>
                <textarea
                  className="w-full border rounded p-3"
                  rows="3"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => {
                    setShowApprovalModal(false);
                    setRejectionReason('');
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={loading}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  Reject
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Approve
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit Stock Request</h2>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Product: <span className="font-semibold text-gray-900">{selectedRequest.product_name}</span></p>
                <p className="text-sm text-gray-600">Parent: <span className="font-semibold text-gray-900">{selectedRequest.parent_name}</span></p>
                <p className="text-sm text-gray-600">Available Stock: <span className="font-semibold text-green-600">{selectedRequest.available_stock}</span></p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
                <Input
                  type="number"
                  min="1"
                  value={editRequest.quantity}
                  onChange={(e) => setEditRequest({...editRequest, quantity: e.target.value})}
                  placeholder="Enter quantity"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  className="w-full border rounded p-3"
                  rows="3"
                  value={editRequest.notes}
                  onChange={(e) => setEditRequest({...editRequest, notes: e.target.value})}
                  placeholder="Add any additional notes..."
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditRequest({ quantity: '', notes: '' });
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleEdit}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? 'Updating...' : 'Update Request'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Delete Stock Request</h2>

            <div className="space-y-4">
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <p className="text-sm font-medium text-red-800 mb-2">Are you sure you want to delete this request?</p>
                <p className="text-sm text-gray-600">Product: <span className="font-semibold text-gray-900">{selectedRequest.product_name}</span></p>
                <p className="text-sm text-gray-600">Quantity: <span className="font-semibold text-gray-900">{selectedRequest.quantity}</span></p>
                <p className="text-sm text-gray-600">Parent: <span className="font-semibold text-gray-900">{selectedRequest.parent_name}</span></p>
              </div>

              <p className="text-sm text-gray-600">This action cannot be undone.</p>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedRequest(null);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {loading ? 'Deleting...' : 'Delete Request'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Add Stock Modal (Admin Only) */}
      {showAddStockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {newStockData.action === 'add' ? 'Add Stock' : 'Update Stock Quantity'}
              </h2>
              <button 
                onClick={() => {
                  setShowAddStockModal(false);
                  setNewStockData({ product_id: '', quantity: '', action: 'add' });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> {newStockData.action === 'add' 
                  ? 'This will ADD the quantity to your existing stock.' 
                  : 'This will SET the stock to the exact quantity you enter.'}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product *
                </label>
                <select
                  value={newStockData.product_id}
                  onChange={(e) => setNewStockData({...newStockData, product_id: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={newStockData.action === 'set'}
                >
                  <option value="">Select Product</option>
                  {products.map((product) => (
                    <option key={product.product_id} value={product.product_id}>
                      {product.name} - {product.product_id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Action *
                </label>
                <select
                  value={newStockData.action}
                  onChange={(e) => setNewStockData({...newStockData, action: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="add">Add Quantity (Increase Stock)</option>
                  <option value="set">Set Quantity (Replace Stock)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity *
                </label>
                <Input
                  type="number"
                  value={newStockData.quantity}
                  onChange={(e) => setNewStockData({...newStockData, quantity: e.target.value})}
                  placeholder={newStockData.action === 'add' ? "Enter quantity to add" : "Enter new total quantity"}
                  min="1"
                  className="w-full"
                />
                {newStockData.action === 'add' && (
                  <p className="text-xs text-gray-500 mt-1">
                    This quantity will be ADDED to existing stock
                  </p>
                )}
                {newStockData.action === 'set' && (
                  <p className="text-xs text-gray-500 mt-1">
                    Stock will be SET to exactly this quantity
                  </p>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => {
                    setShowAddStockModal(false);
                    setNewStockData({ product_id: '', quantity: '', action: 'add' });
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddStock}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {loading ? 'Processing...' : (newStockData.action === 'add' ? 'Add Stock' : 'Update Stock')}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default StockRequestSystem;
