import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Users, Plus, Edit, Trash2, UserPlus, Search } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StockistManagementAdmin = () => {
  const [stockists, setStockists] = useState([]);
  const [filteredStockists, setFilteredStockists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedStockist, setSelectedStockist] = useState(null);
  const [filterRole, setFilterRole] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'master_stockist',
    mobile: '',
    state: '',
    district: '',
    pincode: '',
    parent_id: ''
  });

  useEffect(() => {
    fetchStockists();
  }, []);

  useEffect(() => {
    filterStockists();
  }, [stockists, filterRole, searchTerm]);

  const fetchStockists = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/stockists`);
      setStockists(response.data.stockists || []);
    } catch (error) {
      console.error('Error fetching stockists:', error);
      toast.error('Failed to load stockists');
    } finally {
      setLoading(false);
    }
  };

  const filterStockists = () => {
    let filtered = stockists;
    
    if (filterRole) {
      filtered = filtered.filter(s => s.role === filterRole);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.mobile?.includes(searchTerm)
      );
    }
    
    setFilteredStockists(filtered);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/admin/stockists/create`, formData);
      toast.success('Stockist created successfully!');
      setShowCreateModal(false);
      setFormData({
        email: '',
        password: '',
        name: '',
        role: 'master_stockist',
        mobile: '',
        state: '',
        district: '',
        pincode: '',
        parent_id: ''
      });
      fetchStockists();
    } catch (error) {
      console.error('Error creating stockist:', error);
      toast.error(error.response?.data?.detail || 'Failed to create stockist');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.put(`${API}/admin/stockists/${selectedStockist.uid}/edit`, {
        name: formData.name,
        mobile: formData.mobile,
        state: formData.state,
        district: formData.district,
        pincode: formData.pincode
      });
      toast.success('Stockist updated successfully!');
      setShowEditModal(false);
      fetchStockists();
    } catch (error) {
      console.error('Error updating stockist:', error);
      toast.error(error.response?.data?.detail || 'Failed to update stockist');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (uid) => {
    if (!window.confirm('Are you sure you want to deactivate this stockist?')) {
      return;
    }
    
    try {
      await axios.delete(`${API}/admin/stockists/${uid}`);
      toast.success('Stockist deactivated successfully!');
      fetchStockists();
    } catch (error) {
      console.error('Error deleting stockist:', error);
      toast.error(error.response?.data?.detail || 'Failed to deactivate stockist');
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/admin/stockists/assign`, {
        stockist_id: selectedStockist.uid,
        parent_id: formData.parent_id
      });
      toast.success('Stockist assigned successfully!');
      setShowAssignModal(false);
      fetchStockists();
    } catch (error) {
      console.error('Error assigning stockist:', error);
      toast.error(error.response?.data?.detail || 'Failed to assign stockist');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (stockist) => {
    setSelectedStockist(stockist);
    setFormData({
      name: stockist.name || '',
      mobile: stockist.mobile || '',
      state: stockist.state || '',
      district: stockist.district || '',
      pincode: stockist.pincode || '',
      parent_id: stockist.parent_id || ''
    });
    setShowEditModal(true);
  };

  const openAssignModal = (stockist) => {
    setSelectedStockist(stockist);
    setFormData({ ...formData, parent_id: stockist.parent_id || '' });
    setShowAssignModal(true);
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'master_stockist': return 'bg-purple-100 text-purple-700';
      case 'sub_stockist': return 'bg-blue-100 text-blue-700';
      case 'outlet': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getParentOptions = () => {
    if (formData.role === 'sub_stockist') {
      return stockists.filter(s => s.role === 'master_stockist' && s.is_active);
    } else if (formData.role === 'outlet') {
      return stockists.filter(s => s.role === 'sub_stockist' && s.is_active);
    }
    return [];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stockist Management</h2>
          <p className="text-gray-600">Create, edit, and manage stockists</p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Stockist
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Role</label>
            <select
              className="w-full border rounded p-2"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="master_stockist">Master Stockist</option>
              <option value="sub_stockist">Sub Stockist</option>
              <option value="outlet">Outlet</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by name, email, or mobile..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Stockists List */}
      <div className="space-y-3">
        {loading ? (
          <Card className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading stockists...</p>
          </Card>
        ) : filteredStockists.length === 0 ? (
          <Card className="p-12 text-center">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Stockists Found</h3>
            <p className="text-gray-600">Create your first stockist to get started</p>
          </Card>
        ) : (
          filteredStockists.map((stockist) => (
            <Card key={stockist.uid} className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{stockist.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getRoleBadgeColor(stockist.role)}`}>
                      {stockist.role.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${stockist.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {stockist.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                    <div><strong>Email:</strong> {stockist.email}</div>
                    <div><strong>Mobile:</strong> {stockist.mobile || 'N/A'}</div>
                    <div><strong>Location:</strong> {stockist.district || 'N/A'}, {stockist.state || 'N/A'}</div>
                    <div><strong>UID:</strong> {stockist.uid.substring(0, 8)}...</div>
                  </div>
                  {stockist.parent_id && (
                    <div className="mt-2 text-sm text-gray-600">
                      <strong>Parent ID:</strong> {stockist.parent_id.substring(0, 8)}...
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditModal(stockist)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openAssignModal(stockist)}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(stockist.uid)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Stockist</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <Input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <Input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <Input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select
                    className="w-full border rounded p-2"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    required
                  >
                    <option value="master_stockist">Master Stockist</option>
                    <option value="sub_stockist">Sub Stockist</option>
                    <option value="outlet">Outlet</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                  <Input
                    type="text"
                    value={formData.mobile}
                    onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <Input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({...formData, state: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                  <Input
                    type="text"
                    value={formData.district}
                    onChange={(e) => setFormData({...formData, district: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                  <Input
                    type="text"
                    value={formData.pincode}
                    onChange={(e) => setFormData({...formData, pincode: e.target.value})}
                  />
                </div>
              </div>

              {formData.role !== 'master_stockist' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assign to Parent {formData.role === 'sub_stockist' ? '(Master Stockist)' : '(Sub Stockist)'}
                  </label>
                  <select
                    className="w-full border rounded p-2"
                    value={formData.parent_id}
                    onChange={(e) => setFormData({...formData, parent_id: e.target.value})}
                  >
                    <option value="">-- Select Parent --</option>
                    {getParentOptions().map(parent => (
                      <option key={parent.uid} value={parent.uid}>
                        {parent.name} ({parent.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {loading ? 'Creating...' : 'Create Stockist'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedStockist && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit Stockist</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                  <Input
                    type="text"
                    value={formData.mobile}
                    onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <Input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({...formData, state: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                  <Input
                    type="text"
                    value={formData.district}
                    onChange={(e) => setFormData({...formData, district: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                  <Input
                    type="text"
                    value={formData.pincode}
                    onChange={(e) => setFormData({...formData, pincode: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? 'Updating...' : 'Update Stockist'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedStockist && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Assign Stockist</h2>
            <p className="text-gray-600 mb-4">
              Assign <strong>{selectedStockist.name}</strong> ({selectedStockist.role.replace('_', ' ')}) to a parent
            </p>
            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Parent {selectedStockist.role === 'sub_stockist' ? '(Master Stockist)' : '(Sub Stockist)'}
                </label>
                <select
                  className="w-full border rounded p-2"
                  value={formData.parent_id}
                  onChange={(e) => setFormData({...formData, parent_id: e.target.value})}
                  required
                >
                  <option value="">-- Select Parent --</option>
                  {selectedStockist.role === 'sub_stockist' && 
                    stockists.filter(s => s.role === 'master_stockist' && s.is_active).map(parent => (
                      <option key={parent.uid} value={parent.uid}>
                        {parent.name} ({parent.email})
                      </option>
                    ))
                  }
                  {selectedStockist.role === 'outlet' && 
                    stockists.filter(s => s.role === 'sub_stockist' && s.is_active).map(parent => (
                      <option key={parent.uid} value={parent.uid}>
                        {parent.name} ({parent.email})
                      </option>
                    ))
                  }
                </select>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {loading ? 'Assigning...' : 'Assign'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default StockistManagementAdmin;
