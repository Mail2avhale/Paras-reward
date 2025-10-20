import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Users, Package, CreditCard, FileText, CheckCircle, XCircle, 
  Search, Shield, UserCog, Trash2, BarChart3, TrendingUp, TrendingDown,
  Home, Store, Award, ShoppingCart, Bell, Settings, DollarSign,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Payment Configuration Component
const PaymentConfigSettings = () => {
  const [config, setConfig] = useState({
    upi_id: '',
    qr_code_url: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    account_holder: '',
    instructions: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await axios.get(`${API}/admin/payment-config`);
      setConfig(response.data);
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/admin/payment-config`, config);
      toast.success('Payment configuration saved successfully!');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Configuration</h2>
        <p className="text-gray-600 mb-6">Configure payment receiver details for VIP memberships</p>

        <Card className="p-6 bg-white">
          <div className="space-y-6">
            {/* UPI Details */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">UPI Payment</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">UPI ID</label>
                  <Input
                    placeholder="yourname@upi"
                    value={config.upi_id}
                    onChange={(e) => setConfig({...config, upi_id: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">QR Code URL</label>
                  <Input
                    placeholder="https://example.com/qr-code.png"
                    value={config.qr_code_url}
                    onChange={(e) => setConfig({...config, qr_code_url: e.target.value})}
                  />
                  {config.qr_code_url && (
                    <img src={config.qr_code_url} alt="QR Preview" className="mt-2 w-48 h-48 object-contain border rounded" />
                  )}
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Bank Transfer</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
                  <Input
                    placeholder="State Bank of India"
                    value={config.bank_name}
                    onChange={(e) => setConfig({...config, bank_name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Holder Name</label>
                  <Input
                    placeholder="John Doe"
                    value={config.account_holder}
                    onChange={(e) => setConfig({...config, account_holder: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                  <Input
                    placeholder="1234567890"
                    value={config.account_number}
                    onChange={(e) => setConfig({...config, account_number: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">IFSC Code</label>
                  <Input
                    placeholder="SBIN0001234"
                    value={config.ifsc_code}
                    onChange={(e) => setConfig({...config, ifsc_code: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Instructions</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Instructions</label>
                <textarea
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows="4"
                  placeholder="Enter instructions for users making payment..."
                  value={config.instructions}
                  onChange={(e) => setConfig({...config, instructions: e.target.value})}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={fetchConfig}>
                Reset
              </Button>
              <Button 
                onClick={handleSave}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {loading ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

// Delivery Configuration Component
const DeliveryConfigSettings = () => {
  const [config, setConfig] = useState({
    delivery_charge_rate: 0.10,
    distribution_split: {
      master: 10,
      sub: 20,
      outlet: 60,
      company: 10
    }
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await axios.get(`${API}/admin/delivery-config`);
      setConfig(response.data);
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/admin/delivery-config`, config);
      toast.success('Delivery configuration saved successfully!');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error(error.response?.data?.detail || 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const updateSplit = (entity, value) => {
    const newSplit = { ...config.distribution_split, [entity]: parseFloat(value) || 0 };
    setConfig({ ...config, distribution_split: newSplit });
  };

  const totalSplit = Object.values(config.distribution_split).reduce((sum, val) => sum + val, 0);

  if (fetching) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Delivery Charge Configuration</h2>
        <p className="text-gray-600 mb-6">Configure delivery charge rate and distribution model</p>

        <Card className="p-6 bg-white">
          <div className="space-y-6">
            {/* Delivery Charge Rate */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Delivery Charge Rate</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rate (as decimal, e.g., 0.10 for 10%)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={config.delivery_charge_rate}
                    onChange={(e) => setConfig({...config, delivery_charge_rate: parseFloat(e.target.value) || 0})}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Current: {(config.delivery_charge_rate * 100).toFixed(0)}% of order cash value
                  </p>
                </div>
              </div>
            </div>

            {/* Distribution Split */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Distribution Split (10% Model)</h3>
              <p className="text-sm text-gray-600 mb-4">
                Define how the delivery charge pool is distributed among entities. Total must equal 100%.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Master Stockist (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={config.distribution_split.master}
                    onChange={(e) => updateSplit('master', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sub Stockist (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={config.distribution_split.sub}
                    onChange={(e) => updateSplit('sub', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Outlet (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={config.distribution_split.outlet}
                    onChange={(e) => updateSplit('outlet', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={config.distribution_split.company}
                    onChange={(e) => updateSplit('company', e.target.value)}
                  />
                </div>
              </div>

              {/* Total Validation */}
              <div className={`p-4 rounded-lg ${
                Math.abs(totalSplit - 100) < 0.01 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total Distribution:</span>
                  <span className={`text-xl font-bold ${
                    Math.abs(totalSplit - 100) < 0.01 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {totalSplit.toFixed(1)}%
                  </span>
                </div>
                {Math.abs(totalSplit - 100) >= 0.01 && (
                  <p className="text-sm text-red-600 mt-1">
                    Total must equal 100%. Current difference: {(totalSplit - 100).toFixed(1)}%
                  </p>
                )}
              </div>

              {/* Example Calculation */}
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Example Calculation</h4>
                <p className="text-sm text-blue-800">
                  For an order with ₹1,000 cash value:
                </p>
                <ul className="text-sm text-blue-800 mt-2 space-y-1">
                  <li>• Delivery Charge Pool: ₹{(1000 * config.delivery_charge_rate).toFixed(2)}</li>
                  <li>• Master: ₹{((1000 * config.delivery_charge_rate * config.distribution_split.master) / 100).toFixed(2)}</li>
                  <li>• Sub: ₹{((1000 * config.delivery_charge_rate * config.distribution_split.sub) / 100).toFixed(2)}</li>
                  <li>• Outlet: ₹{((1000 * config.delivery_charge_rate * config.distribution_split.outlet) / 100).toFixed(2)}</li>
                  <li>• Company: ₹{((1000 * config.delivery_charge_rate * config.distribution_split.company) / 100).toFixed(2)}</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={fetchConfig}>
                Reset
              </Button>
              <Button 
                onClick={handleSave}
                disabled={loading || Math.abs(totalSplit - 100) >= 0.01}
                className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

// Marketplace Management Component
const MarketplaceManagement = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    prc_price: 0,
    cash_price: 0,
    type: 'physical',
    category: '',
    image_url: '',
    total_stock: 0,
    available_stock: 0,
    visible: true,
    vip_only: false
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API}/products`);
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingProduct) {
        await axios.put(`${API}/admin/products/${editingProduct.product_id}`, formData);
        toast.success('Product updated successfully!');
      } else {
        await axios.post(`${API}/admin/products`, formData);
        toast.success('Product created successfully!');
      }
      
      setShowAddModal(false);
      setEditingProduct(null);
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error(error.response?.data?.detail || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId, productName) => {
    if (!window.confirm(`Delete "${productName}"?`)) return;

    try {
      await axios.delete(`${API}/admin/products/${productId}`);
      toast.success('Product deleted successfully!');
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      description: '',
      prc_price: 0,
      cash_price: 0,
      type: 'physical',
      category: '',
      image_url: '',
      total_stock: 0,
      available_stock: 0,
      visible: true,
      vip_only: false
    });
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      description: product.description || '',
      prc_price: product.prc_price,
      cash_price: product.cash_price,
      type: product.type || 'physical',
      category: product.category || '',
      image_url: product.image_url || '',
      total_stock: product.total_stock || 0,
      available_stock: product.available_stock || 0,
      visible: product.visible !== false,
      vip_only: product.vip_only || false
    });
    setShowAddModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Marketplace Management</h2>
          <p className="text-gray-600 mt-1">Manage products available for redemption</p>
        </div>
        <Button 
          onClick={() => {
            resetForm();
            setEditingProduct(null);
            setShowAddModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Package className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <Card className="p-6 bg-white border-2 border-blue-200">
          <h3 className="text-xl font-bold mb-4">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Product Name *</label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Enter product name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  placeholder="e.g., Electronics, Fashion"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description *</label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Product description"
                className="w-full px-3 py-2 border rounded-md"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">PRC Price *</label>
                <Input
                  type="number"
                  required
                  min="0"
                  value={formData.prc_price}
                  onChange={(e) => setFormData({...formData, prc_price: parseFloat(e.target.value)})}
                  placeholder="PRC coins required"
                />
                <p className="text-xs text-gray-500 mt-1">≈ ₹{(formData.prc_price / 10).toFixed(2)} (10 PRC = ₹1)</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Stock Quantity</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({...formData, stock_quantity: parseInt(e.target.value)})}
                  placeholder="Available quantity"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Image URL</label>
              <Input
                value={formData.image_url}
                onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                placeholder="https://example.com/image.jpg"
              />
              {formData.image_url && (
                <img src={formData.image_url} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded border" />
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="featured"
                checked={formData.featured}
                onChange={(e) => setFormData({...formData, featured: e.target.checked})}
                className="rounded"
              />
              <label htmlFor="featured" className="text-sm font-medium">Featured Product</label>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
              </Button>
              <Button 
                type="button" 
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingProduct(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Products List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.length === 0 ? (
          <Card className="col-span-full p-12 text-center bg-white">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No products yet. Add your first product!</p>
          </Card>
        ) : (
          products.map((product) => (
            <Card key={product.product_id} className="overflow-hidden bg-white">
              <div className="aspect-square bg-gray-100 relative">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-16 w-16 text-gray-300" />
                  </div>
                )}
                {product.featured && (
                  <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded text-xs font-bold">
                    Featured
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-lg mb-1">{product.name}</h3>
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-lg font-bold text-blue-600">{product.prc_price} PRC</div>
                    <div className="text-xs text-gray-500">≈ ₹{(product.prc_price / 10).toFixed(2)}</div>
                  </div>
                  {product.stock_quantity !== undefined && (
                    <div className="text-sm text-gray-600">
                      Stock: {product.stock_quantity}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleEdit(product)}
                    className="flex-1"
                  >
                    Edit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => handleDelete(product.product_id, product.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

const AdminDashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [vipPayments, setVipPayments] = useState([]);
  const [kycDocuments, setKycDocuments] = useState([]);
  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    fetchStats();
    fetchVIPPayments();
    fetchKYCDocuments();
    fetchUsers();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchVIPPayments = async () => {
    try {
      const response = await axios.get(`${API}/membership/payments`);
      setVipPayments(response.data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const fetchKYCDocuments = async () => {
    try {
      const response = await axios.get(`${API}/kyc/list`);
      setKycDocuments(response.data);
    } catch (error) {
      console.error('Error fetching KYC:', error);
    }
  };

  const handlePaymentAction = async (paymentId, action) => {
    try {
      await axios.post(`${API}/membership/payment/${paymentId}/action`, { action });
      toast.success(`Payment ${action}d successfully!`);
      fetchVIPPayments();
      fetchStats();
    } catch (error) {
      console.error('Error handling payment:', error);
      toast.error('Action failed');
    }
  };

  const handleKYCAction = async (kycId, action) => {
    try {
      await axios.post(`${API}/kyc/${kycId}/verify`, { action });
      toast.success(`KYC ${action}d successfully!`);
      fetchKYCDocuments();
      fetchStats();
    } catch (error) {
      console.error('Error handling KYC:', error);
      toast.error('Action failed');
    }
  };

  const fetchUsers = async () => {
    try {
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (roleFilter) params.role = roleFilter;
      
      const response = await axios.get(`${API}/admin/users`, { params });
      setUsers(response.data.users);
      setUsersTotal(response.data.total);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleRoleChange = async (uid, newRole) => {
    try {
      await axios.put(`${API}/admin/users/${uid}/role`, { role: newRole });
      toast.success(`User role updated to ${newRole}`);
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error(error.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleStatusChange = async (uid, isActive) => {
    try {
      await axios.put(`${API}/admin/users/${uid}/status`, { is_active: isActive });
      toast.success(`User ${isActive ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(error.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleDeleteUser = async (uid, userName) => {
    if (!window.confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`${API}/admin/users/${uid}`);
      toast.success('User deleted successfully');
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(delaySearch);
  }, [searchQuery, roleFilter]);

  const menuItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard' },
    { id: 'master-stockist', icon: Package, label: 'Master Stockist' },
    { id: 'sub-stockist', icon: Store, label: 'Sub Stockist' },
    { id: 'outlet', icon: ShoppingCart, label: 'Outlet' },
    { id: 'users', icon: Users, label: 'Users' },
    { id: 'rewards', icon: Award, label: 'Rewards' },
    { id: 'commissions', icon: DollarSign, label: 'Commissions' },
    { id: 'orders', icon: ShoppingCart, label: 'Orders' },
    { id: 'marketplace', icon: Store, label: 'Marketplace' },
    { id: 'payments', icon: CreditCard, label: 'Payments' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 fixed h-full">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">paras<br/>rewards</h1>
        </div>
        
        <nav className="px-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 mb-1 rounded-lg transition-all ${
                  isActive 
                    ? 'bg-indigo-600 text-white' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="ml-64 flex-1">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <h2 className="text-3xl font-bold text-gray-900 capitalize">{activeTab.replace('-', ' ')}</h2>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={onLogout}>
              Logout
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-8">
          {activeTab === 'dashboard' && (
            <div>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card className="p-6 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-sm font-medium">Total Users</span>
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {stats?.total_users?.toLocaleString() || '84,560'}
                  </div>
                  <div className="flex items-center text-sm text-green-600">
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    <span>12%</span>
                  </div>
                </Card>

                <Card className="p-6 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-sm font-medium">VIP Users</span>
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {stats?.vip_users?.toLocaleString() || '12,740'}
                  </div>
                  <div className="flex items-center text-sm text-green-600">
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    <span>9%</span>
                  </div>
                </Card>

                <Card className="p-6 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-sm font-medium">KYC Pending</span>
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {stats?.pending_kyc?.toLocaleString() || '1,023'}
                  </div>
                  <div className="flex items-center text-sm text-red-600">
                    <ArrowDownRight className="h-4 w-4 mr-1" />
                    <span>8% Decrease</span>
                  </div>
                </Card>

                <Card className="p-6 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-sm font-medium">Total Rewards</span>
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    ₹5.72 Cr
                  </div>
                  <div className="flex items-center text-sm text-green-600">
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    <span>30%</span>
                  </div>
                </Card>
              </div>

              {/* Chart and Fee Summary Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Summary Chart */}
                <Card className="p-6 bg-white lg:col-span-2">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Summary</h3>
                  <div className="h-64 flex items-end justify-around gap-2">
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, idx) => (
                      <div key={month} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex items-end justify-center gap-1 h-48">
                          <div 
                            className="w-1/3 bg-indigo-600 rounded-t" 
                            style={{ height: `${40 + idx * 10}%` }}
                          ></div>
                          <div 
                            className="w-1/3 bg-indigo-400 rounded-t" 
                            style={{ height: `${30 + idx * 8}%` }}
                          ></div>
                          <div 
                            className="w-1/3 bg-pink-400 rounded-t" 
                            style={{ height: `${25 + idx * 7}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600 mt-2">{month}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-6 mt-6">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-indigo-600 rounded"></div>
                      <span className="text-sm text-gray-600">Transactions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-indigo-400 rounded"></div>
                      <span className="text-sm text-gray-600">Redeems</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-pink-400 rounded"></div>
                      <span className="text-sm text-gray-600">Earnings</span>
                    </div>
                  </div>
                </Card>

                {/* Fee Summary */}
                <Card className="p-6 bg-white">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Fee Summary</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Membership Fees</span>
                      <span className="font-bold text-gray-900">₹2,00,000</span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Wallet Fees</span>
                      <span className="font-bold text-gray-900">₹1,50,000</span>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <span className="text-gray-600">Marketplace Charges</span>
                      <span className="font-bold text-gray-900">₹50,000</span>
                    </div>
                  </div>

                  <div className="mt-8">
                    <h4 className="text-lg font-bold text-gray-900 mb-4">Recently Paid VIP</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2">
                        <span className="text-gray-700">Shiv Prasad</span>
                        <span className="font-semibold text-gray-900">₹2,400</span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-gray-700">Kajal Sharma</span>
                        <span className="font-semibold text-gray-900">₹8,250</span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-gray-700">Rohit Shetty</span>
                        <span className="font-semibold text-gray-900">₹5,100</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card data-testid="total-users-stat" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <Users className="h-8 w-8 text-purple-600 mb-3" />
            <p className="text-sm text-gray-600 mb-1">Total Users</p>
            <p className="text-3xl font-bold text-gray-900">{stats?.total_users || 0}</p>
          </Card>

          <Card data-testid="vip-users-stat" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <Users className="h-8 w-8 text-yellow-600 mb-3" />
            <p className="text-sm text-gray-600 mb-1">VIP Users</p>
            <p className="text-3xl font-bold text-gray-900">{stats?.vip_users || 0}</p>
          </Card>

          <Card data-testid="total-orders-stat" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <Package className="h-8 w-8 text-blue-600 mb-3" />
            <p className="text-sm text-gray-600 mb-1">Total Orders</p>
            <p className="text-3xl font-bold text-gray-900">{stats?.total_orders || 0}</p>
          </Card>

          <Card data-testid="pending-payments-stat" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <CreditCard className="h-8 w-8 text-green-600 mb-3" />
            <p className="text-sm text-gray-600 mb-1">Pending Payments</p>
            <p className="text-3xl font-bold text-gray-900">{stats?.pending_payments || 0}</p>
          </Card>

          <Card data-testid="pending-kyc-stat" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <FileText className="h-8 w-8 text-orange-600 mb-3" />
            <p className="text-sm text-gray-600 mb-1">Pending KYC</p>
            <p className="text-3xl font-bold text-gray-900">{stats?.pending_kyc || 0}</p>
          </Card>
        </div>

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
                <div className="flex gap-3 w-full md:w-auto">
                  <Input
                    placeholder="Search by name, email, or mobile..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full md:w-64"
                  />
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">All Roles</option>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="outlet">Outlet</option>
                    <option value="master_stockist">Master Stockist</option>
                    <option value="sub_stockist">Sub Stockist</option>
                  </select>
                </div>
              </div>

              <Card className="bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left py-4 px-6 font-semibold text-gray-700">Name</th>
                        <th className="text-left py-4 px-6 font-semibold text-gray-700">Email</th>
                        <th className="text-left py-4 px-6 font-semibold text-gray-700">Mobile</th>
                        <th className="text-left py-4 px-6 font-semibold text-gray-700">Role</th>
                        <th className="text-left py-4 px-6 font-semibold text-gray-700">Status</th>
                        <th className="text-center py-4 px-6 font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-12 text-gray-500">
                            No users found
                          </td>
                        </tr>
                      ) : (
                        users.map((u) => (
                          <tr key={u.uid} className="border-b hover:bg-gray-50">
                            <td className="py-4 px-6">
                              <div className="font-medium text-gray-900">{u.name || 'N/A'}</div>
                            </td>
                            <td className="py-4 px-6 text-gray-700">{u.email || 'N/A'}</td>
                            <td className="py-4 px-6 text-gray-700">{u.mobile || 'N/A'}</td>
                            <td className="py-4 px-6">
                              <select
                                value={u.role}
                                onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                                className="px-3 py-1 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                              >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                                <option value="outlet">Outlet</option>
                                <option value="master_stockist">Master Stockist</option>
                                <option value="sub_stockist">Sub Stockist</option>
                              </select>
                            </td>
                            <td className="py-4 px-6">
                              <button
                                onClick={() => handleStatusChange(u.uid, !u.is_active)}
                                className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  u.is_active
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                                }`}
                              >
                                {u.is_active ? 'Active' : 'Inactive'}
                              </button>
                            </td>
                            <td className="py-4 px-6 text-center">
                              <Button
                                onClick={() => handleDeleteUser(u.uid, u.name)}
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">VIP Payment Approvals</h2>
              {vipPayments.filter(p => p.status === 'pending').length === 0 ? (
                <Card className="p-12 text-center bg-white">
                  <CreditCard className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No pending VIP payments</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {vipPayments.filter(p => p.status === 'pending').map((payment, index) => (
                    <Card key={payment.payment_id} className="p-6 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="font-bold text-gray-900">₹{payment.amount}</p>
                          <p className="text-sm text-gray-600">{payment.user_id.substring(0, 12)}...</p>
                        </div>
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                          Pending
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Date & Time</p>
                          <p className="font-semibold text-gray-900">{payment.date} {payment.time}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">UTR Number</p>
                          <p className="font-semibold text-gray-900">{payment.utr_number}</p>
                        </div>
                      </div>
                      {payment.screenshot_url && (
                        <div className="mb-4">
                          <img src={payment.screenshot_url} alt="Payment screenshot" className="w-full rounded-lg" />
                        </div>
                      )}
                      <div className="flex gap-3">
                        <Button
                          onClick={() => handlePaymentAction(payment.payment_id, 'approve')}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => handlePaymentAction(payment.payment_id, 'reject')}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* KYC Tab */}
          {activeTab === 'kyc' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">KYC Verification Requests</h2>
              {kycDocuments.filter(k => k.status === 'pending').length === 0 ? (
                <Card className="p-12 text-center bg-white">
                  <Shield className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No pending KYC verifications</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {kycDocuments.filter(k => k.status === 'pending').map((kyc, index) => (
                    <Card key={kyc.kyc_id} className="p-6 bg-white">
                      <div className="mb-4">
                        <p className="text-sm text-gray-600">User ID</p>
                        <p className="font-semibold text-gray-900 mb-4">{kyc.user_id.substring(0, 12)}...</p>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        {kyc.aadhaar_front && (
                          <div>
                            <p className="text-xs text-gray-600 mb-2">Aadhaar Front</p>
                            <img src={kyc.aadhaar_front} alt="Aadhaar front" className="w-full rounded" />
                          </div>
                        )}
                        {kyc.aadhaar_back && (
                          <div>
                            <p className="text-xs text-gray-600 mb-2">Aadhaar Back</p>
                            <img src={kyc.aadhaar_back} alt="Aadhaar back" className="w-full rounded" />
                          </div>
                        )}
                        {kyc.pan_front && (
                          <div>
                            <p className="text-xs text-gray-600 mb-2">PAN Card</p>
                            <img src={kyc.pan_front} alt="PAN" className="w-full rounded" />
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <Button
                          onClick={() => handleKYCAction(kyc.kyc_id, 'approve')}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleKYCAction(kyc.kyc_id, 'reject')}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settings Tab - Payment & Delivery Configuration */}
          {activeTab === 'settings' && (
            <div className="space-y-8">
              <PaymentConfigSettings />
              <DeliveryConfigSettings />
            </div>
          )}

          {/* Other Tabs - Placeholder */}
          {['master-stockist', 'sub-stockist', 'outlet', 'rewards', 'commissions', 'orders', 'notifications'].includes(activeTab) && (
            <Card className="p-12 text-center bg-white">
              <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2 capitalize">{activeTab.replace('-', ' ')}</h3>
              <p className="text-gray-500">This section is under development</p>
            </Card>
          )}

          {/* Marketplace Management */}
          {activeTab === 'marketplace' && (
            <div className="space-y-6">
              <MarketplaceManagement />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;