import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Truck, Plus, Search, Edit, Trash2, CheckCircle, XCircle,
  Phone, Mail, MapPin, Package, Star, TrendingUp, RefreshCw,
  ChevronLeft, ChevronRight, Eye, X, Check, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminDeliveryPartners = ({ user }) => {
  const [partners, setPartners] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Pending orders for assignment
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    phone: '',
    email: '',
    service_states: [],
    commission_type: 'percentage',
    commission_rate: 10
  });
  
  const indianStates = [
    'All India', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 
    'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 
    'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 
    'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
  ];

  useEffect(() => {
    fetchPartners();
    fetchStats();
    fetchPendingOrders();
  }, [currentPage, statusFilter]);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/admin/delivery-partners`, {
        params: { status: statusFilter, page: currentPage, limit: 10 }
      });
      setPartners(response.data.partners || []);
      setTotalPages(response.data.pages || 1);
    } catch (error) {
      console.error('Error fetching partners:', error);
      toast.error('Failed to load delivery partners');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/delivery-partners/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchPendingOrders = async () => {
    try {
      setLoadingOrders(true);
      const response = await axios.get(`${API}/api/admin/orders`, {
        params: { status: 'pending', limit: 50 }
      });
      // Filter orders without assigned partner
      const orders = (response.data.orders || []).filter(
        order => !order.delivery_partner_id && order.status !== 'cancelled'
      );
      setPendingOrders(orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleCreatePartner = async () => {
    if (!formData.name || !formData.phone) {
      toast.error('Name and phone are required');
      return;
    }
    
    try {
      await axios.post(`${API}/api/admin/delivery-partners`, formData);
      toast.success('Delivery partner created successfully');
      setShowAddModal(false);
      resetForm();
      fetchPartners();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create partner');
    }
  };

  const handleUpdatePartner = async () => {
    if (!selectedPartner) return;
    
    try {
      await axios.put(`${API}/api/admin/delivery-partners/${selectedPartner.partner_id}`, formData);
      toast.success('Delivery partner updated successfully');
      setShowEditModal(false);
      resetForm();
      fetchPartners();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update partner');
    }
  };

  const handleDeletePartner = async (partnerId) => {
    if (!window.confirm('Are you sure you want to deactivate this delivery partner?')) return;
    
    try {
      await axios.delete(`${API}/api/admin/delivery-partners/${partnerId}`);
      toast.success('Delivery partner deactivated');
      fetchPartners();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete partner');
    }
  };

  const handleToggleActive = async (partner) => {
    try {
      await axios.put(`${API}/api/admin/delivery-partners/${partner.partner_id}`, {
        is_active: !partner.is_active
      });
      toast.success(`Partner ${partner.is_active ? 'deactivated' : 'activated'}`);
      fetchPartners();
      fetchStats();
    } catch (error) {
      toast.error('Failed to update partner status');
    }
  };

  const handleToggleVerified = async (partner) => {
    try {
      await axios.put(`${API}/api/admin/delivery-partners/${partner.partner_id}`, {
        is_verified: !partner.is_verified
      });
      toast.success(`Partner ${partner.is_verified ? 'unverified' : 'verified'}`);
      fetchPartners();
    } catch (error) {
      toast.error('Failed to update verification status');
    }
  };

  const handleAssignPartner = async (orderId, partnerId, trackingNumber = '') => {
    try {
      await axios.post(`${API}/api/admin/orders/${orderId}/assign-partner`, {
        partner_id: partnerId,
        tracking_number: trackingNumber
      });
      toast.success('Delivery partner assigned successfully');
      setShowAssignModal(false);
      setSelectedOrder(null);
      fetchPendingOrders();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign partner');
    }
  };

  const handleMarkDelivered = async (orderId) => {
    try {
      await axios.post(`${API}/api/admin/orders/${orderId}/mark-delivered`, {});
      toast.success('Order marked as delivered');
      fetchPendingOrders();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark as delivered');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      company_name: '',
      phone: '',
      email: '',
      service_states: [],
      commission_type: 'percentage',
      commission_rate: 10
    });
    setSelectedPartner(null);
  };

  const openEditModal = (partner) => {
    setSelectedPartner(partner);
    setFormData({
      name: partner.name || '',
      company_name: partner.company_name || '',
      phone: partner.phone || '',
      email: partner.email || '',
      service_states: partner.service_states || [],
      commission_type: partner.commission_type || 'percentage',
      commission_rate: partner.commission_rate || 10
    });
    setShowEditModal(true);
  };

  const filteredPartners = partners.filter(partner => 
    partner.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    partner.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    partner.phone?.includes(searchQuery)
  );

  return (
    <div className="space-y-6" data-testid="admin-delivery-partners">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Truck className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.total_partners || 0}</p>
              <p className="text-xs text-gray-400">Total Partners</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.active_partners || 0}</p>
              <p className="text-xs text-gray-400">Active</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Star className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.verified_partners || 0}</p>
              <p className="text-xs text-gray-400">Verified</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.pending_assignment || 0}</p>
              <p className="text-xs text-gray-400">Pending Assignment</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.out_for_delivery || 0}</p>
              <p className="text-xs text-gray-400">Out for Delivery</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Pending Orders Section */}
      {pendingOrders.length > 0 && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Orders Pending Assignment ({pendingOrders.length})
            </h3>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={fetchPendingOrders}
              className="text-amber-500 border-amber-500/30"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {pendingOrders.slice(0, 5).map((order) => (
              <div 
                key={order.order_id} 
                className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
              >
                <div>
                  <p className="text-white font-medium">#{order.order_id?.slice(0, 8)}</p>
                  <p className="text-xs text-gray-400">
                    {order.items?.length || 0} items • ₹{(order.total_prc / 10).toFixed(0)} value
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {order.delivery_address?.slice(0, 30)}...
                  </span>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedOrder(order);
                      setShowAssignModal(true);
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-gray-900"
                    data-testid={`assign-partner-${order.order_id}`}
                  >
                    Assign Partner
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Header with Search and Add */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search partners..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-800/50 border-gray-700"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="verified">Verified</option>
          </select>
        </div>
        
        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-emerald-500 hover:bg-emerald-600"
          data-testid="add-partner-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Partner
        </Button>
      </div>

      {/* Partners List */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredPartners.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No delivery partners found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filteredPartners.map((partner) => (
              <div 
                key={partner.partner_id} 
                className="p-4 hover:bg-gray-800/30 transition-colors"
                data-testid={`partner-${partner.partner_id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      partner.is_active ? 'bg-emerald-500/20' : 'bg-gray-700'
                    }`}>
                      <Truck className={`w-6 h-6 ${partner.is_active ? 'text-emerald-500' : 'text-gray-500'}`} />
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white">{partner.name}</h4>
                        {partner.is_verified && (
                          <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                            Verified
                          </span>
                        )}
                        {!partner.is_active && (
                          <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      {partner.company_name && (
                        <p className="text-sm text-gray-400">{partner.company_name}</p>
                      )}
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {partner.phone}
                        </span>
                        {partner.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {partner.email}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {partner.service_states?.length > 0 
                            ? partner.service_states.slice(0, 2).join(', ') + (partner.service_states.length > 2 ? '...' : '')
                            : 'All India'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    {/* Stats */}
                    <div className="hidden md:flex items-center gap-6 text-center">
                      <div>
                        <p className="text-lg font-bold text-white">{partner.total_deliveries || 0}</p>
                        <p className="text-xs text-gray-500">Total</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-emerald-400">{partner.successful_deliveries || 0}</p>
                        <p className="text-xs text-gray-500">Delivered</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-amber-400">{partner.rating?.toFixed(1) || '5.0'}</p>
                        <p className="text-xs text-gray-500">Rating</p>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleActive(partner)}
                        className={partner.is_active ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}
                      >
                        {partner.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleVerified(partner)}
                        className="text-purple-400 hover:text-purple-300"
                      >
                        <Star className={`w-4 h-4 ${partner.is_verified ? 'fill-current' : ''}`} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditModal(partner)}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeletePartner(partner.partner_id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-800 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add/Edit Partner Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                {showEditModal ? 'Edit Delivery Partner' : 'Add Delivery Partner'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-800 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Partner Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                  placeholder="Enter partner name"
                  className="bg-gray-800/50 border-gray-700"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Company Name</label>
                <Input
                  value={formData.company_name}
                  onChange={(e) => setFormData(f => ({ ...f, company_name: e.target.value }))}
                  placeholder="Enter company name (optional)"
                  className="bg-gray-800/50 border-gray-700"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Phone *</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+91 XXXXX XXXXX"
                    className="bg-gray-800/50 border-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@example.com"
                    className="bg-gray-800/50 border-gray-700"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Service States</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-gray-800/30 rounded-lg">
                  {indianStates.map((state) => (
                    <button
                      key={state}
                      type="button"
                      onClick={() => {
                        setFormData(f => ({
                          ...f,
                          service_states: f.service_states.includes(state)
                            ? f.service_states.filter(s => s !== state)
                            : [...f.service_states, state]
                        }));
                      }}
                      className={`px-2 py-1 text-xs rounded-full transition-colors ${
                        formData.service_states.includes(state)
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {state}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.service_states.length === 0 
                    ? 'No states selected (will serve All India)' 
                    : `${formData.service_states.length} states selected`}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Commission Type</label>
                  <select
                    value={formData.commission_type}
                    onChange={(e) => setFormData(f => ({ ...f, commission_type: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Commission Rate {formData.commission_type === 'percentage' ? '(%)' : '(₹)'}
                  </label>
                  <Input
                    type="number"
                    value={formData.commission_rate}
                    onChange={(e) => setFormData(f => ({ ...f, commission_rate: parseFloat(e.target.value) || 0 }))}
                    className="bg-gray-800/50 border-gray-700"
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-800 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  resetForm();
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={showEditModal ? handleUpdatePartner : handleCreatePartner}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600"
              >
                {showEditModal ? 'Update Partner' : 'Add Partner'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Partner Modal */}
      {showAssignModal && selectedOrder && (
        <AssignPartnerModal
          order={selectedOrder}
          partners={partners.filter(p => p.is_active)}
          onAssign={handleAssignPartner}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedOrder(null);
          }}
        />
      )}
    </div>
  );
};

// Separate component for assign modal
const AssignPartnerModal = ({ order, partners, onAssign, onClose }) => {
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Assign Delivery Partner</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <p className="text-sm text-gray-400">Order</p>
            <p className="text-white font-medium">#{order.order_id?.slice(0, 8)}</p>
            <p className="text-xs text-gray-500 mt-1">{order.items?.length || 0} items • ₹{(order.total_prc / 10).toFixed(0)}</p>
            <p className="text-xs text-gray-500 mt-1">{order.delivery_address}</p>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Select Partner *</label>
            <select
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
            >
              <option value="">Choose a delivery partner</option>
              {partners.map((partner) => (
                <option key={partner.partner_id} value={partner.partner_id}>
                  {partner.name} {partner.company_name ? `(${partner.company_name})` : ''} - {partner.total_deliveries || 0} deliveries
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Tracking Number (Optional)</label>
            <Input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Enter tracking number"
              className="bg-gray-800/50 border-gray-700"
            />
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-800 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={() => onAssign(order.order_id, selectedPartnerId, trackingNumber)}
            disabled={!selectedPartnerId}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600"
          >
            <Check className="w-4 h-4 mr-2" />
            Assign Partner
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminDeliveryPartners;
