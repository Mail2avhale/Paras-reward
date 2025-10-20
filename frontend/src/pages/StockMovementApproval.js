import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Truck, CheckCircle, XCircle, Clock, Eye, 
  Filter, Search, Package, ArrowRight
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StockMovementApproval = () => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMovement, setSelectedMovement] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(''); // approve, reject
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    fetchMovements();
  }, [filterStatus]);

  const fetchMovements = async () => {
    setLoading(true);
    try {
      if (filterStatus === 'pending') {
        const response = await axios.get(`${API}/admin/stock/movements/pending`);
        setMovements(response.data.movements || []);
      } else {
        const response = await axios.get(`${API}/admin/stock/movements`);
        let data = response.data || [];
        if (filterStatus !== 'all') {
          data = data.filter(m => m.status === filterStatus);
        }
        setMovements(data);
      }
    } catch (error) {
      console.error('Error fetching movements:', error);
      toast.error('Failed to fetch stock movements');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/admin/stock/movements/${selectedMovement.movement_id}/approve`, {
        admin_notes: adminNotes
      });
      
      toast.success('Stock movement approved successfully!');
      setShowActionModal(false);
      setAdminNotes('');
      fetchMovements();
    } catch (error) {
      console.error('Error approving movement:', error);
      toast.error(error.response?.data?.detail || 'Failed to approve movement');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!adminNotes.trim()) {
      toast.error('Please provide rejection reason');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API}/admin/stock/movements/${selectedMovement.movement_id}/reject`, {
        admin_notes: adminNotes
      });
      
      toast.success('Stock movement rejected');
      setShowActionModal(false);
      setAdminNotes('');
      fetchMovements();
    } catch (error) {
      console.error('Error rejecting movement:', error);
      toast.error(error.response?.data?.detail || 'Failed to reject movement');
    } finally {
      setLoading(false);
    }
  };

  const openActionModal = (movement, type) => {
    setSelectedMovement(movement);
    setActionType(type);
    setShowActionModal(true);
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
      pending_admin: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700'
    };
    const labels = {
      pending_admin: 'PENDING APPROVAL',
      approved: 'APPROVED',
      completed: 'COMPLETED',
      rejected: 'REJECTED'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status] || status.toUpperCase()}
      </span>
    );
  };

  const getRoleBadge = (role) => {
    const styles = {
      admin: 'bg-purple-100 text-purple-700',
      master_stockist: 'bg-indigo-100 text-indigo-700',
      sub_stockist: 'bg-blue-100 text-blue-700',
      outlet: 'bg-green-100 text-green-700',
      user: 'bg-gray-100 text-gray-700'
    };
    const labels = {
      admin: 'COMPANY',
      master_stockist: 'MASTER',
      sub_stockist: 'SUB',
      outlet: 'OUTLET',
      user: 'USER'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[role] || 'bg-gray-100 text-gray-700'}`}>
        {labels[role] || role.toUpperCase()}
      </span>
    );
  };

  const filteredMovements = movements.filter(m => {
    const matchesSearch = searchQuery === '' || 
      m.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.sender_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.receiver_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.batch_number?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Calculate stats
  const stats = {
    total: movements.length,
    pending: movements.filter(m => m.status === 'pending_admin').length,
    approved: movements.filter(m => m.status === 'approved').length,
    completed: movements.filter(m => m.status === 'completed').length,
    rejected: movements.filter(m => m.status === 'rejected').length
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stock Movement Approval</h2>
          <p className="text-gray-600">Manage and approve stock transfer requests</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100">
          <div className="text-sm font-medium text-purple-600 mb-1">Total Movements</div>
          <div className="text-3xl font-bold text-purple-900">{stats.total}</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100">
          <div className="text-sm font-medium text-yellow-600 mb-1">Pending Approval</div>
          <div className="text-3xl font-bold text-yellow-900">{stats.pending}</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="text-sm font-medium text-blue-600 mb-1">Approved</div>
          <div className="text-3xl font-bold text-blue-900">{stats.approved}</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100">
          <div className="text-sm font-medium text-green-600 mb-1">Completed</div>
          <div className="text-3xl font-bold text-green-900">{stats.completed}</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100">
          <div className="text-sm font-medium text-red-600 mb-1">Rejected</div>
          <div className="text-3xl font-bold text-red-900">{stats.rejected}</div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex gap-3 items-center">
          <Filter className="h-5 w-5 text-gray-500" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search by product, batch, sender, or receiver..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Movements Table */}
      {loading ? (
        <Card className="p-12 text-center">
          <div className="text-gray-600">Loading stock movements...</div>
        </Card>
      ) : filteredMovements.length === 0 ? (
        <Card className="p-12 text-center">
          <Truck className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Stock Movements</h3>
          <p className="text-gray-600">
            {searchQuery ? 'No movements match your search' : 'No stock movement requests found'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Flow</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch Details</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMovements.map((movement) => (
                  <tr key={movement.movement_id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="h-5 w-5 text-purple-600 mr-2" />
                        <div>
                          <div className="font-medium text-gray-900">{movement.product_name || 'N/A'}</div>
                          <div className="text-xs text-gray-500">{movement.product_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <div className="text-lg font-bold text-gray-900">{movement.quantity}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="text-center">
                          <div className="text-sm font-medium text-gray-900">{movement.sender_name}</div>
                          <div className="mt-1">{getRoleBadge(movement.sender_role)}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div className="text-center">
                          <div className="text-sm font-medium text-gray-900">{movement.receiver_name}</div>
                          <div className="mt-1">{getRoleBadge(movement.receiver_role)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">Batch: {movement.batch_number || 'N/A'}</div>
                        <div className="text-xs text-gray-500">QR: {movement.qr_code || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(movement.created_at)}</div>
                      {movement.approved_at && (
                        <div className="text-xs text-green-600">Approved: {formatDate(movement.approved_at)}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      {getStatusBadge(movement.status)}
                      {movement.admin_notes && (
                        <div className="text-xs text-gray-500 mt-1">Notes available</div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <div className="flex gap-2 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedMovement(movement);
                            setShowDetailModal(true);
                          }}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        {movement.status === 'pending_admin' && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => openActionModal(movement, 'approve')}
                              title="Approve"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              className="bg-red-600 hover:bg-red-700"
                              onClick={() => openActionModal(movement, 'reject')}
                              title="Reject"
                            >
                              <XCircle className="h-4 w-4" />
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

      {/* Detail Modal */}
      {showDetailModal && selectedMovement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Stock Movement Details</h2>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Status */}
              <div>
                <label className="text-sm font-medium text-gray-600">Status</label>
                <div className="mt-1">{getStatusBadge(selectedMovement.status)}</div>
              </div>

              {/* Product Details */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Product Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Product Name</label>
                    <p className="text-base font-semibold text-gray-900">{selectedMovement.product_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Product ID</label>
                    <p className="text-base text-gray-900 font-mono text-sm">{selectedMovement.product_id}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Quantity</label>
                    <p className="text-2xl font-bold text-purple-600">{selectedMovement.quantity}</p>
                  </div>
                </div>
              </div>

              {/* Transfer Flow */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Transfer Flow</h3>
                <div className="flex items-center gap-4">
                  <Card className="p-4 flex-1 bg-blue-50">
                    <div className="text-sm font-medium text-gray-600 mb-2">Sender</div>
                    <div className="font-semibold text-gray-900">{selectedMovement.sender_name}</div>
                    <div className="text-xs text-gray-500 mt-1">{selectedMovement.sender_id}</div>
                    <div className="mt-2">{getRoleBadge(selectedMovement.sender_role)}</div>
                  </Card>
                  <ArrowRight className="h-8 w-8 text-purple-600 flex-shrink-0" />
                  <Card className="p-4 flex-1 bg-green-50">
                    <div className="text-sm font-medium text-gray-600 mb-2">Receiver</div>
                    <div className="font-semibold text-gray-900">{selectedMovement.receiver_name}</div>
                    <div className="text-xs text-gray-500 mt-1">{selectedMovement.receiver_id}</div>
                    <div className="mt-2">{getRoleBadge(selectedMovement.receiver_role)}</div>
                  </Card>
                </div>
              </div>

              {/* Batch & QR */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Traceability</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Batch Number</label>
                    <p className="text-base font-mono font-semibold text-gray-900">{selectedMovement.batch_number}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">QR Code</label>
                    <p className="text-base font-mono font-semibold text-gray-900">{selectedMovement.qr_code}</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {(selectedMovement.notes || selectedMovement.admin_notes) && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
                  {selectedMovement.notes && (
                    <div className="mb-3">
                      <label className="text-sm font-medium text-gray-600">Sender Notes</label>
                      <p className="text-base text-gray-900 bg-gray-50 p-3 rounded">{selectedMovement.notes}</p>
                    </div>
                  )}
                  {selectedMovement.admin_notes && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Admin Notes</label>
                      <p className="text-base text-gray-900 bg-blue-50 p-3 rounded">{selectedMovement.admin_notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Timeline */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Timeline</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created</span>
                    <span className="text-gray-900 font-medium">{formatDate(selectedMovement.created_at)}</span>
                  </div>
                  {selectedMovement.approved_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Approved</span>
                      <span className="text-gray-900 font-medium">{formatDate(selectedMovement.approved_at)}</span>
                    </div>
                  )}
                  {selectedMovement.completed_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Completed</span>
                      <span className="text-gray-900 font-medium">{formatDate(selectedMovement.completed_at)}</span>
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

      {/* Action Modal */}
      {showActionModal && selectedMovement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {actionType === 'approve' ? 'Approve Stock Movement' : 'Reject Stock Movement'}
            </h2>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Product: <span className="font-semibold text-gray-900">{selectedMovement.product_name}</span></p>
                <p className="text-sm text-gray-600">Quantity: <span className="font-semibold text-gray-900">{selectedMovement.quantity}</span></p>
                <p className="text-sm text-gray-600">
                  Flow: <span className="font-semibold text-gray-900">{selectedMovement.sender_name} → {selectedMovement.receiver_name}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Notes {actionType === 'reject' && '*'}
                </label>
                <textarea
                  className="w-full border rounded p-3"
                  rows="4"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder={actionType === 'approve' ? 'Optional notes...' : 'Enter rejection reason...'}
                  required={actionType === 'reject'}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  type="button"
                  onClick={() => {
                    setShowActionModal(false);
                    setAdminNotes('');
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={loading}
                  onClick={actionType === 'approve' ? handleApprove : handleReject}
                  className={`flex-1 ${
                    actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {loading ? 'Processing...' : actionType === 'approve' ? 'Approve' : 'Reject'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default StockMovementApproval;
