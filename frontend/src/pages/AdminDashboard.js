import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ImageUpload from '@/components/ImageUpload';
import StockistManagementAdmin from '@/pages/StockistManagementAdmin';
import FinancialManagementAdmin from '@/pages/FinancialManagementAdmin';
import AdvancedUserManagement from '@/pages/AdvancedUserManagement';
import AdvancedOrderManagement from '@/pages/AdvancedOrderManagement';
import StockMovementSimple from '@/pages/StockMovementSimple';
import WithdrawalManagementAdmin from '@/pages/WithdrawalManagementAdmin';
import StockMovementApproval from '@/pages/StockMovementApproval';
import StockRequestSystem from '@/pages/StockRequestSystem';
import { 
  Users, Package, CreditCard, FileText, CheckCircle, XCircle, 
  Search, Shield, UserCog, Trash2, BarChart3, TrendingUp, TrendingDown,
  Home, Store, Award, ShoppingCart, Bell, Settings, DollarSign,
  ArrowUpRight, ArrowDownRight, Truck, HeadphonesIcon
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">QR Code Image</label>
                  <ImageUpload
                    value={config.qr_code_url}
                    onChange={(base64) => setConfig({...config, qr_code_url: base64})}
                    label="Upload QR Code"
                    maxSize={2}
                    aspectRatio="square"
                  />
                  <p className="text-xs text-gray-500 mt-2">Upload QR code for UPI payments (max 2MB)</p>
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
// Contact Details Configuration Component
const ContactDetailsSettings = () => {
  const [contactDetails, setContactDetails] = useState({
    address: '',
    phone: '',
    email: '',
    website: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchContactDetails();
  }, []);

  const fetchContactDetails = async () => {
    try {
      const response = await axios.get(`${API}/contact-details`);
      setContactDetails(response.data);
    } catch (error) {
      console.error('Error fetching contact details:', error);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/admin/contact-details`, contactDetails);
      toast.success('Contact details updated successfully!');
    } catch (error) {
      console.error('Error saving contact details:', error);
      toast.error(error.response?.data?.detail || 'Failed to update contact details');
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Contact Details Management</h2>
        <p className="text-gray-600 mb-6">Update public contact information displayed on Contact Us page</p>

        <Card className="p-6 bg-white">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Office Address *
              </label>
              <textarea
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows="3"
                value={contactDetails.address}
                onChange={(e) => setContactDetails({...contactDetails, address: e.target.value})}
                placeholder="Company Name\nAddress Line 1\nCity, State, Pincode"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <Input
                  type="text"
                  value={contactDetails.phone}
                  onChange={(e) => setContactDetails({...contactDetails, phone: e.target.value})}
                  placeholder="+91-XXXXXXXXXX"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <Input
                  type="email"
                  value={contactDetails.email}
                  onChange={(e) => setContactDetails({...contactDetails, email: e.target.value})}
                  placeholder="support@parasreward.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Website *
              </label>
              <Input
                type="text"
                value={contactDetails.website}
                onChange={(e) => setContactDetails({...contactDetails, website: e.target.value})}
                placeholder="www.parasreward.com"
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSave}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {loading ? 'Saving...' : 'Save Contact Details'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};


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
      // Use admin endpoint to get all products (including hidden)
      const response = await axios.get(`${API}/admin/products`);
      setProducts(response.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Debug: Log form data
    console.log('Form Data being submitted:', formData);
    
    // Validate required fields
    if (!formData.name || !formData.sku || !formData.prc_price || !formData.type) {
      toast.error('Please fill all required fields');
      console.error('Missing fields:', {
        name: !!formData.name,
        sku: !!formData.sku,
        prc_price: !!formData.prc_price,
        type: !!formData.type
      });
      return;
    }

    // Validate SKU format
    if (formData.sku.length < 3) {
      toast.error('SKU must be at least 3 characters');
      return;
    }

    setLoading(true);

    try {
      // Prepare data with all required fields explicitly
      const productData = {
        name: formData.name,
        sku: formData.sku,
        description: formData.description || '',
        prc_price: parseFloat(formData.prc_price) || 0,
        cash_price: parseFloat(formData.cash_price) || 0,
        type: formData.type,
        category: formData.category || '',
        image_url: formData.image_url || '',
        total_stock: parseInt(formData.total_stock) || 0,
        available_stock: parseInt(formData.available_stock) || 0,
        visible: formData.visible !== false,
        vip_only: formData.vip_only || false
      };

      console.log('Sending product data:', productData);

      if (editingProduct) {
        await axios.put(`${API}/admin/products/${editingProduct.product_id}`, productData);
        toast.success('Product updated successfully!');
      } else {
        const response = await axios.post(`${API}/admin/products`, productData);
        console.log('Create product response:', response.data);
        toast.success('Product created successfully!');
      }
      
      setShowAddModal(false);
      setEditingProduct(null);
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      console.error('Error response:', error.response?.data);
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
      cash_price: product.cash_price || 0,
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
          
          {/* Info Banner */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
            <p className="font-semibold mb-1">Required Fields:</p>
            <p>Product Name, SKU, PRC Price, Cash Price, Type, Total Stock, Available Stock</p>
          </div>

          {/* Debug Info - Remove after testing */}
          <div className="mb-4 p-3 bg-gray-100 border border-gray-300 rounded text-xs">
            <p className="font-semibold mb-1">Debug Info:</p>
            <p>SKU: "{formData.sku}" (length: {formData.sku?.length || 0})</p>
            <p>Name: "{formData.name}"</p>
            <p>Type: "{formData.type}"</p>
          </div>

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
                <label className="block text-sm font-medium mb-2">SKU *</label>
                <Input
                  required
                  minLength={3}
                  value={formData.sku}
                  onChange={(e) => setFormData({...formData, sku: e.target.value.toUpperCase()})}
                  placeholder="e.g., PROD-001"
                  disabled={!!editingProduct}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Unique product identifier (min 3 characters, auto-uppercase)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  placeholder="e.g., Electronics, Fashion"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Product Type *</label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="physical">Physical</option>
                  <option value="digital">Digital</option>
                </select>
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
                  step="0.01"
                  value={formData.prc_price}
                  onChange={(e) => setFormData({...formData, prc_price: parseFloat(e.target.value) || 0})}
                  placeholder="PRC coins required"
                />
                <p className="text-xs text-gray-500 mt-1">≈ ₹{(formData.prc_price / 10).toFixed(2)} (10 PRC = ₹1)</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Cash Price *</label>
                <Input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.cash_price}
                  onChange={(e) => setFormData({...formData, cash_price: parseFloat(e.target.value) || 0})}
                  placeholder="Delivery/transaction fee in ₹"
                />
                <p className="text-xs text-gray-500 mt-1">Delivery/handling charge in Rupees</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Total Stock *</label>
                <Input
                  type="number"
                  required
                  min="0"
                  value={formData.total_stock}
                  onChange={(e) => {
                    const stock = parseInt(e.target.value) || 0;
                    setFormData({
                      ...formData, 
                      total_stock: stock,
                      available_stock: stock // Auto-set available = total for new products
                    });
                  }}
                  placeholder="Total available quantity"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Available Stock *</label>
                <Input
                  type="number"
                  required
                  min="0"
                  max={formData.total_stock}
                  value={formData.available_stock}
                  onChange={(e) => setFormData({...formData, available_stock: parseInt(e.target.value) || 0})}
                  placeholder="Currently available"
                />
              </div>
            </div>

            <div>
              <ImageUpload
                value={formData.image_url}
                onChange={(base64Image) => setFormData({...formData, image_url: base64Image})}
                label="Product Image"
                aspectRatio="square"
                maxSize={5}
              />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="visible"
                  checked={formData.visible}
                  onChange={(e) => setFormData({...formData, visible: e.target.checked})}
                  className="rounded"
                />
                <label htmlFor="visible" className="text-sm font-medium">Visible to Users</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="vip_only"
                  checked={formData.vip_only}
                  onChange={(e) => setFormData({...formData, vip_only: e.target.checked})}
                  className="rounded"
                />
                <label htmlFor="vip_only" className="text-sm font-medium">VIP Only</label>
              </div>
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
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-lg flex-1">{product.name}</h3>
                  {!product.visible && (
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">Hidden</span>
                  )}
                  {product.vip_only && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded ml-1">VIP</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-2">SKU: {product.sku}</p>
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">PRC Price:</span>
                    <span className="font-bold text-blue-600">{product.prc_price} PRC</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Stock:</span>
                    <span className="font-semibold">{product.available_stock || 0}/{product.total_stock || 0}</span>
                  </div>
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
  const [userManagementView, setUserManagementView] = useState('basic');
  const [settingsView, setSettingsView] = useState('contact');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20); // Show 20 items per page

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
    { id: 'stockist-management', icon: UserCog, label: 'Stockist Management' },
    { id: 'financial-management', icon: DollarSign, label: 'Financial Management' },
    { id: 'withdrawals', icon: CreditCard, label: 'Withdrawal Requests' },
    { id: 'stock-requests', icon: Package, label: 'Stock Requests' },
    { id: 'users', icon: Users, label: 'Users' },
    { id: 'stock-movement', icon: Truck, label: 'Stock Movement' },
    { id: 'orders', icon: ShoppingCart, label: 'Orders' },
    { id: 'marketplace', icon: Store, label: 'Marketplace' },
    { id: 'payments', icon: CreditCard, label: 'VIP Payments' },
    { id: 'kyc', icon: FileText, label: 'KYC Verification' },
    { id: 'support', icon: HeadphonesIcon, label: 'Support Tickets' },
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
          {/* Stockist Management Tab */}
          {activeTab === 'stockist-management' && (
            <div className="space-y-6">
              <StockistManagementAdmin />
            </div>
          )}

          {/* Financial Management Tab */}
          {activeTab === 'financial-management' && (
            <div className="space-y-6">
              <FinancialManagementAdmin />
            </div>
          )}

          {/* Withdrawal Management Tab */}
          {activeTab === 'withdrawals' && (
            <div className="space-y-6">
              <WithdrawalManagementAdmin />
            </div>
          )}

          {/* Stock Requests Tab */}
          {activeTab === 'stock-requests' && (
            <div className="space-y-6">
              <StockRequestSystem />
            </div>
          )}

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
                    {stats?.users?.total?.toLocaleString() || '0'}
                  </div>
                  <div className="flex items-center text-sm text-green-600">
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    <span>VIP: {stats?.users?.vip || 0}</span>
                  </div>
                </Card>

                <Card className="p-6 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-sm font-medium">VIP Users</span>
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {stats?.users?.vip?.toLocaleString() || '0'}
                  </div>
                  <div className="flex items-center text-sm text-green-600">
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    <span>Free: {stats?.users?.free || 0}</span>
                  </div>
                </Card>

                <Card className="p-6 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-sm font-medium">KYC Pending</span>
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {stats?.kyc?.pending?.toLocaleString() || '0'}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <span>Verified: {stats?.kyc?.verified || 0}</span>
                  </div>
                </Card>

                <Card className="p-6 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-sm font-medium">Total Orders</span>
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {stats?.orders?.total?.toLocaleString() || '0'}
                  </div>
                  <div className="flex items-center text-sm text-green-600">
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    <span>Delivered: {stats?.orders?.delivered || 0}</span>
                  </div>
                </Card>
              </div>

              {/* Additional Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
                <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100">
                  <div className="text-sm font-medium text-purple-600 mb-1">Master Stockists</div>
                  <div className="text-2xl font-bold text-purple-900">{stats?.users?.master_stockists || 0}</div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100">
                  <div className="text-sm font-medium text-blue-600 mb-1">Sub Stockists</div>
                  <div className="text-2xl font-bold text-blue-900">{stats?.users?.sub_stockists || 0}</div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100">
                  <div className="text-sm font-medium text-green-600 mb-1">Outlets</div>
                  <div className="text-2xl font-bold text-green-900">{stats?.users?.outlets || 0}</div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100">
                  <div className="text-sm font-medium text-yellow-600 mb-1">VIP Pending</div>
                  <div className="text-2xl font-bold text-yellow-900">{stats?.vip_payments?.pending || 0}</div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100">
                  <div className="text-sm font-medium text-red-600 mb-1">Withdrawals Pending</div>
                  <div className="text-2xl font-bold text-red-900">{stats?.withdrawals?.pending_count || 0}</div>
                </Card>
              </div>

              {/* Comprehensive Financial KPIs */}
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Financial Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Total Security Deposits */}
                  <Card className="p-6 bg-gradient-to-br from-indigo-50 to-indigo-100">
                    <div className="flex items-center justify-between mb-2">
                      <DollarSign className="h-8 w-8 text-indigo-600" />
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-200 px-2 py-1 rounded-full">
                        DEPOSITS
                      </span>
                    </div>
                    <div className="text-sm font-medium text-indigo-600 mb-1">Total Security Deposits</div>
                    <div className="text-2xl font-bold text-indigo-900">
                      ₹{((stats?.financial?.total_security_deposits || 0) / 100000).toFixed(2)}L
                    </div>
                    <div className="text-xs text-indigo-700 mt-2">
                      Approved: {stats?.security_deposits?.approved || 0}
                    </div>
                  </Card>

                  {/* Total Renewal Fees */}
                  <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100">
                    <div className="flex items-center justify-between mb-2">
                      <TrendingUp className="h-8 w-8 text-purple-600" />
                      <span className="text-xs font-semibold text-purple-600 bg-purple-200 px-2 py-1 rounded-full">
                        RENEWALS
                      </span>
                    </div>
                    <div className="text-sm font-medium text-purple-600 mb-1">Total Renewal Fees</div>
                    <div className="text-2xl font-bold text-purple-900">
                      ₹{((stats?.financial?.total_renewal_fees || 0) / 100000).toFixed(2)}L
                    </div>
                    <div className="text-xs text-purple-700 mt-2">
                      Active: {stats?.renewals?.active || 0} | Overdue: {stats?.renewals?.overdue || 0}
                    </div>
                  </Card>

                  {/* Total VIP Membership Fees */}
                  <Card className="p-6 bg-gradient-to-br from-amber-50 to-amber-100">
                    <div className="flex items-center justify-between mb-2">
                      <Users className="h-8 w-8 text-amber-600" />
                      <span className="text-xs font-semibold text-amber-600 bg-amber-200 px-2 py-1 rounded-full">
                        VIP FEES
                      </span>
                    </div>
                    <div className="text-sm font-medium text-amber-600 mb-1">VIP Membership Fees</div>
                    <div className="text-2xl font-bold text-amber-900">
                      ₹{(stats?.financial?.total_vip_membership_fees || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-amber-700 mt-2">
                      VIP Users: {stats?.users?.vip || 0}
                    </div>
                  </Card>

                  {/* Total Withdrawals Processed */}
                  <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100">
                    <div className="flex items-center justify-between mb-2">
                      <CreditCard className="h-8 w-8 text-green-600" />
                      <span className="text-xs font-semibold text-green-600 bg-green-200 px-2 py-1 rounded-full">
                        PROCESSED
                      </span>
                    </div>
                    <div className="text-sm font-medium text-green-600 mb-1">Withdrawals Processed</div>
                    <div className="text-2xl font-bold text-green-900">
                      ₹{(stats?.financial?.total_withdrawal_processed || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-green-700 mt-2">
                      Pending: ₹{(stats?.withdrawals?.pending_amount || 0).toLocaleString()}
                    </div>
                  </Card>

                  {/* Total Redeem Value (PRC) */}
                  <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100">
                    <div className="flex items-center justify-between mb-2">
                      <Package className="h-8 w-8 text-blue-600" />
                      <span className="text-xs font-semibold text-blue-600 bg-blue-200 px-2 py-1 rounded-full">
                        REDEEMS
                      </span>
                    </div>
                    <div className="text-sm font-medium text-blue-600 mb-1">Total Redeem Value</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {(stats?.financial?.total_revenue_prc || 0).toLocaleString()} PRC
                    </div>
                    <div className="text-xs text-blue-700 mt-2">
                      ≈ ₹{((stats?.financial?.total_prc_value_in_inr || 0)).toLocaleString()} INR
                    </div>
                  </Card>

                  {/* Total Revenue (INR) */}
                  <Card className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100">
                    <div className="flex items-center justify-between mb-2">
                      <BarChart3 className="h-8 w-8 text-emerald-600" />
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-200 px-2 py-1 rounded-full">
                        REVENUE
                      </span>
                    </div>
                    <div className="text-sm font-medium text-emerald-600 mb-1">Total Revenue (Cash)</div>
                    <div className="text-2xl font-bold text-emerald-900">
                      ₹{((stats?.financial?.total_revenue_inr || 0) / 100000).toFixed(2)}L
                    </div>
                    <div className="text-xs text-emerald-700 mt-2">
                      From {stats?.orders?.delivered || 0} delivered orders
                    </div>
                  </Card>

                  {/* Total Lien */}
                  <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100">
                    <div className="flex items-center justify-between mb-2">
                      <Shield className="h-8 w-8 text-orange-600" />
                      <span className="text-xs font-semibold text-orange-600 bg-orange-200 px-2 py-1 rounded-full">
                        LIEN
                      </span>
                    </div>
                    <div className="text-sm font-medium text-orange-600 mb-1">Total Pending Lien</div>
                    <div className="text-2xl font-bold text-orange-900">
                      ₹{(stats?.financial?.total_lien || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-orange-700 mt-2">
                      Pending maintenance fees
                    </div>
                  </Card>

                  {/* Stock Movement Status */}
                  <Card className="p-6 bg-gradient-to-br from-teal-50 to-teal-100">
                    <div className="flex items-center justify-between mb-2">
                      <Truck className="h-8 w-8 text-teal-600" />
                      <span className="text-xs font-semibold text-teal-600 bg-teal-200 px-2 py-1 rounded-full">
                        STOCK
                      </span>
                    </div>
                    <div className="text-sm font-medium text-teal-600 mb-1">Stock Movements</div>
                    <div className="text-2xl font-bold text-teal-900">
                      {(stats?.stock_movements?.pending || 0) + (stats?.stock_movements?.approved || 0) + (stats?.stock_movements?.completed || 0)}
                    </div>
                    <div className="text-xs text-teal-700 mt-2">
                      Pending: {stats?.stock_movements?.pending || 0} | Completed: {stats?.stock_movements?.completed || 0}
                    </div>
                  </Card>
                </div>
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
                      <span className="font-bold text-gray-900">
                        ₹{stats?.financial?.total_vip_membership_fees?.toLocaleString('en-IN') || '0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Wallet Maintenance Fees</span>
                      <span className="font-bold text-gray-900">
                        ₹{stats?.financial?.total_wallet_fees?.toLocaleString('en-IN') || '0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <span className="text-gray-600">Delivery Charges</span>
                      <span className="font-bold text-gray-900">
                        ₹{stats?.financial?.total_marketplace_charges?.toLocaleString('en-IN') || '0'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-8">
                    <h4 className="text-lg font-bold text-gray-900 mb-4">Recently Paid VIP</h4>
                    <div className="space-y-3">
                      {stats?.recent_activity?.vip_payments && stats.recent_activity.vip_payments.length > 0 ? (
                        stats.recent_activity.vip_payments.map((payment, index) => (
                          <div key={index} className="flex items-center justify-between py-2">
                            <span className="text-gray-700">{payment.user_name}</span>
                            <span className="font-semibold text-gray-900">
                              ₹{payment.amount?.toLocaleString('en-IN') || '0'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 text-sm text-center py-4">No recent VIP payments</p>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Users Tab - Combined Basic & Advanced */}
          {activeTab === 'users' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">User Management</h2>
              
              {/* Tabs for Basic and Advanced */}
              <div className="mb-6">
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex space-x-8">
                    <button
                      onClick={() => setUserManagementView('basic')}
                      className={`${
                        userManagementView === 'basic'
                          ? 'border-purple-500 text-purple-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                      Basic Management
                    </button>
                    <button
                      onClick={() => setUserManagementView('advanced')}
                      className={`${
                        userManagementView === 'advanced'
                          ? 'border-purple-500 text-purple-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                      Advanced Management
                    </button>
                  </nav>
                </div>
              </div>

              {/* Basic Management View */}
              {userManagementView === 'basic' && (
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
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                    <option value="outlet">Outlet</option>
                    <option value="master_stockist">Master Stockist</option>
                    <option value="sub_stockist">Sub Stockist</option>
                  </select>
                </div>
              </div>

              {/* Filter and paginate users */}
              {(() => {
                // Filter users based on search and role
                const filteredUsers = users.filter(u => {
                  const matchesSearch = !searchQuery || 
                    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    u.mobile?.includes(searchQuery);
                  const matchesRole = !roleFilter || u.role === roleFilter;
                  return matchesSearch && matchesRole;
                });

                // Paginate filtered users
                const startIndex = (currentPage - 1) * itemsPerPage;
                const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

                return (
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
                      {paginatedUsers.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-12 text-gray-500">
                            No users found
                          </td>
                        </tr>
                      ) : (
                        paginatedUsers.map((u) => (
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
                                <option value="manager">Manager</option>
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
                
                {/* Pagination */}
                {filteredUsers.length > 0 && (
                  <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} users
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        variant="outline"
                        size="sm"
                      >
                        Previous
                      </Button>
                      <div className="flex gap-1">
                        {Array.from({ length: Math.ceil(filteredUsers.length / itemsPerPage) }, (_, i) => i + 1).map(page => (
                          <Button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            className={currentPage === page ? "bg-purple-600" : ""}
                          >
                            {page}
                          </Button>
                        ))}
                      </div>
                      <Button
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredUsers.length / itemsPerPage), p + 1))}
                        disabled={currentPage === Math.ceil(filteredUsers.length / itemsPerPage)}
                        variant="outline"
                        size="sm"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
                );
              })()}
            </div>
          )}

          {/* Advanced Management View */}
          {userManagementView === 'advanced' && (
            <AdvancedUserManagement />
          )}
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
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">System Settings</h2>
              
              {/* Settings Sub-Tabs */}
              <div className="mb-6">
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex space-x-8">
                    <button
                      onClick={() => setSettingsView('contact')}
                      className={`${
                        settingsView === 'contact'
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                      Contact Details
                    </button>
                    <button
                      onClick={() => setSettingsView('payment')}
                      className={`${
                        settingsView === 'payment'
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                      Payment Configuration
                    </button>
                    <button
                      onClick={() => setSettingsView('delivery')}
                      className={`${
                        settingsView === 'delivery'
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                      Delivery Configuration
                    </button>
                  </nav>
                </div>
              </div>

              {/* Contact Details View */}
              {settingsView === 'contact' && (
                <ContactDetailsSettings />
              )}

              {/* Payment Configuration View */}
              {settingsView === 'payment' && (
                <PaymentConfigSettings />
              )}

              {/* Delivery Configuration View */}
              {settingsView === 'delivery' && (
                <DeliveryConfigSettings />
              )}
            </div>
          )}



          {/* Stock Movement Tab */}
          {activeTab === 'stock-movement' && (
            <div className="space-y-6">
              <StockMovementApproval />
            </div>
          )}

          {/* Master Stockist Tab */}
          {activeTab === 'master-stockist' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Master Stockist Management</h2>
              <p className="text-gray-600">View and manage all Master Stockists</p>
              <Card className="p-6">
                <p className="text-center text-gray-600">
                  Go to <strong>Stockist Management</strong> tab and filter by "Master Stockist" role to manage Master Stockists.
                </p>
                <div className="mt-4 text-center">
                  <Button onClick={() => setActiveTab('stockist-management')} className="bg-purple-600 hover:bg-purple-700">
                    Go to Stockist Management
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* Sub Stockist Tab */}
          {activeTab === 'sub-stockist' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Sub Stockist Management</h2>
              <p className="text-gray-600">View and manage all Sub Stockists</p>
              <Card className="p-6">
                <p className="text-center text-gray-600">
                  Go to <strong>Stockist Management</strong> tab and filter by "Sub Stockist" role to manage Sub Stockists.
                </p>
                <div className="mt-4 text-center">
                  <Button onClick={() => setActiveTab('stockist-management')} className="bg-purple-600 hover:bg-purple-700">
                    Go to Stockist Management
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* Outlet Tab */}
          {activeTab === 'outlet' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Outlet Management</h2>
              <p className="text-gray-600">View and manage all Outlets</p>
              <Card className="p-6">
                <p className="text-center text-gray-600">
                  Go to <strong>Stockist Management</strong> tab and filter by "Outlet" role to manage Outlets.
                </p>
                <div className="mt-4 text-center">
                  <Button onClick={() => setActiveTab('stockist-management')} className="bg-purple-600 hover:bg-purple-700">
                    Go to Stockist Management
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* Orders Management */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <AdvancedOrderManagement />
            </div>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <NotificationsManagement />
            </div>
          )}

          {/* Support Tickets */}
          {activeTab === 'support' && (
            <div className="space-y-6">
              <AdminSupportTickets />
            </div>
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

// Stock Movement Management Component
const StockMovementManagement = () => {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [stockists, setStockists] = useState({ masters: [], subs: [], outlets: [] });
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [formData, setFormData] = useState({
    product_id: '',
    product_name: '',
    quantity: 0,
    sender_type: 'company',
    sender_id: 'COMPANY',
    receiver_type: 'master_stockist',
    receiver_id: ''
  });

  useEffect(() => {
    fetchMovements();
    fetchProducts();
    fetchStockists();
  }, []);

  const fetchMovements = async () => {
    try {
      // Fetch all movements (admin can see all)
      const response = await axios.get(`${API}/admin/stock/movements`);
      setMovements(response.data || []);
    } catch (error) {
      console.error('Error fetching movements:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API}/admin/products`);
      setProducts(response.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchStockists = async () => {
    try {
      const usersRes = await axios.get(`${API}/admin/users`);
      const users = usersRes.data.users || [];
      
      setStockists({
        masters: users.filter(u => u.role === 'master_stockist'),
        subs: users.filter(u => u.role === 'sub_stockist'),
        outlets: users.filter(u => u.role === 'outlet')
      });
    } catch (error) {
      console.error('Error fetching stockists:', error);
    }
  };

  const initiateTransfer = async () => {
    try {
      // Find product details
      const product = products.find(p => p.product_id === formData.product_id);
      
      await axios.post(`${API}/stock/transfer/initiate`, {
        ...formData,
        product_name: product?.name || formData.product_name
      });
      
      toast.success('Stock transfer initiated successfully');
      setShowInitiateModal(false);
      setFormData({
        product_id: '',
        product_name: '',
        quantity: 0,
        sender_type: 'company',
        sender_id: 'COMPANY',
        receiver_type: 'master_stockist',
        receiver_id: ''
      });
      fetchMovements();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to initiate transfer');
    }
  };

  const handleApprove = async (movementId) => {
    try {
      await axios.post(`${API}/admin/stock/movements/${movementId}/approve`);
      toast.success('Transfer approved');
      fetchMovements();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    }
  };

  const handleReject = async (movementId) => {
    try {
      await axios.post(`${API}/admin/stock/movements/${movementId}/reject`);
      toast.success('Transfer rejected');
      fetchMovements();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    }
  };

  const getReceiverOptions = () => {
    switch (formData.receiver_type) {
      case 'master_stockist':
        return stockists.masters;
      case 'sub_stockist':
        return stockists.subs;
      case 'outlet':
        return stockists.outlets;
      default:
        return [];
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stock Movement Management</h2>
          <p className="text-gray-600">Company → Master → Sub → Outlet</p>
        </div>
        <Button onClick={() => setShowInitiateModal(true)} className="bg-purple-600 hover:bg-purple-700">
          <Package className="mr-2 h-4 w-4" />
          Initiate Transfer
        </Button>
      </div>

      {/* Stock Movements List */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">All Stock Movements</h3>
        <div className="space-y-3">
          {movements.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No stock movements yet</p>
          ) : (
            movements.map((movement) => (
              <Card key={movement.movement_id} className="p-4 border-l-4 border-purple-500">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        movement.status === 'completed' ? 'bg-green-100 text-green-700' :
                        movement.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                        movement.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {movement.status}
                      </span>
                      <span className="text-xs text-gray-500">Batch: {movement.batch_number}</span>
                    </div>
                    <p className="font-semibold text-gray-900">{movement.product_name}</p>
                    <p className="text-sm text-gray-600">Quantity: {movement.quantity}</p>
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                      <span>{movement.sender_type}: {movement.sender_id}</span>
                      <ArrowDownRight className="h-4 w-4" />
                      <span>{movement.receiver_type}: {movement.receiver_id}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Created: {new Date(movement.created_at).toLocaleString()}
                    </p>
                  </div>
                  {movement.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(movement.movement_id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(movement.movement_id)}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </Card>

      {/* Initiate Transfer Modal */}
      {showInitiateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 p-6">
            <h3 className="text-xl font-bold mb-4">Initiate Stock Transfer</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Product *</label>
                <select
                  className="w-full border rounded p-2"
                  value={formData.product_id}
                  onChange={(e) => setFormData({...formData, product_id: e.target.value})}
                >
                  <option value="">Select Product</option>
                  {products.map(product => (
                    <option key={product.product_id} value={product.product_id}>
                      {product.name} (Stock: {product.available_stock})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Quantity *</label>
                <Input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Receiver Type *</label>
                <select
                  className="w-full border rounded p-2"
                  value={formData.receiver_type}
                  onChange={(e) => setFormData({...formData, receiver_type: e.target.value, receiver_id: ''})}
                >
                  <option value="master_stockist">Master Stockist</option>
                  <option value="sub_stockist">Sub Stockist</option>
                  <option value="outlet">Outlet</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Receiver *</label>
                <select
                  className="w-full border rounded p-2"
                  value={formData.receiver_id}
                  onChange={(e) => setFormData({...formData, receiver_id: e.target.value})}
                >
                  <option value="">Select Receiver</option>
                  {getReceiverOptions().map(user => (
                    <option key={user.uid} value={user.uid}>
                      {user.name || user.email} ({user.uid})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={initiateTransfer}
                  disabled={!formData.product_id || !formData.receiver_id || formData.quantity <= 0}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  Initiate Transfer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowInitiateModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

// Admin Support Tickets Management Component
const AdminSupportTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [updateData, setUpdateData] = useState({
    status: '',
    priority: '',
    resolution_notes: ''
  });

  useEffect(() => {
    fetchTickets();
  }, [filterStatus, filterCategory]);

  const fetchTickets = async () => {
    try {
      let url = `${API}/admin/support/tickets?`;
      if (filterStatus) url += `status=${filterStatus}&`;
      if (filterCategory) url += `category=${filterCategory}&`;
      
      const response = await axios.get(url);
      setTickets(response.data.tickets || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to load tickets');
    }
  };

  const handleViewTicket = async (ticketId) => {
    try {
      const response = await axios.get(`${API}/support/tickets/${ticketId}`);
      setSelectedTicket(response.data);
      setUpdateData({
        status: response.data.status,
        priority: response.data.priority,
        resolution_notes: response.data.resolution_notes || ''
      });
    } catch (error) {
      console.error('Error fetching ticket details:', error);
      toast.error('Failed to load ticket details');
    }
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    try {
      const adminUser = JSON.parse(localStorage.getItem('paras_user'));
      await axios.post(`${API}/support/tickets/${selectedTicket.ticket_id}/reply`, {
        ticket_id: selectedTicket.ticket_id,
        user_id: adminUser.uid,
        message: replyMessage
      });

      toast.success('Reply sent successfully');
      setReplyMessage('');
      handleViewTicket(selectedTicket.ticket_id);
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
    }
  };

  const handleUpdateTicket = async () => {
    try {
      await axios.put(`${API}/admin/support/tickets/${selectedTicket.ticket_id}`, updateData);
      toast.success('Ticket updated successfully');
      handleViewTicket(selectedTicket.ticket_id);
      fetchTickets();
    } catch (error) {
      console.error('Error updating ticket:', error);
      toast.error('Failed to update ticket');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'bg-yellow-100 text-yellow-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      case 'resolved': return 'bg-green-100 text-green-700';
      case 'closed': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (selectedTicket) {
    return (
      <div className="space-y-6">
        <Button
          onClick={() => setSelectedTicket(null)}
          variant="outline"
        >
          <ArrowDownRight className="mr-2 h-4 w-4 rotate-180" />
          Back to Tickets
        </Button>

        <Card className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{selectedTicket.subject}</h2>
              <div className="flex gap-2 items-center mt-2">
                <p className="text-sm text-gray-600">Category: {selectedTicket.category}</p>
                <span className="text-gray-400">|</span>
                <p className="text-sm text-gray-600">User: {selectedTicket.user_name}</p>
                <span className="text-gray-400">|</span>
                <p className="text-sm text-gray-600">Email: {selectedTicket.user_email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(selectedTicket.status)}`}>
                {selectedTicket.status}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getPriorityColor(selectedTicket.priority)}`}>
                {selectedTicket.priority}
              </span>
            </div>
          </div>

          <div className="border-t pt-4 mb-6">
            <p className="text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
            <p className="text-xs text-gray-500 mt-2">
              Created: {new Date(selectedTicket.created_at).toLocaleString()}
            </p>
          </div>

          {/* Update Ticket Form */}
          <Card className="p-4 bg-blue-50 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Update Ticket</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  className="w-full border rounded p-2"
                  value={updateData.status}
                  onChange={(e) => setUpdateData({...updateData, status: e.target.value})}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  className="w-full border rounded p-2"
                  value={updateData.priority}
                  onChange={(e) => setUpdateData({...updateData, priority: e.target.value})}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleUpdateTicket}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Update Ticket
                </Button>
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Notes (Optional)</label>
              <textarea
                className="w-full border rounded p-2"
                rows="2"
                placeholder="Add notes about the resolution..."
                value={updateData.resolution_notes}
                onChange={(e) => setUpdateData({...updateData, resolution_notes: e.target.value})}
              />
            </div>
          </Card>

          {/* Replies */}
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Conversation ({selectedTicket.replies?.length || 0} replies)
            </h3>
            {selectedTicket.replies && selectedTicket.replies.length > 0 ? (
              <div className="space-y-3">
                {selectedTicket.replies.map((reply) => (
                  <div
                    key={reply.reply_id}
                    className={`p-4 rounded-lg ${
                      reply.user_role === 'admin' || reply.user_role === 'sub_admin'
                        ? 'bg-blue-50 border border-blue-200'
                        : 'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-gray-900">
                        {reply.user_name}
                        {(reply.user_role === 'admin' || reply.user_role === 'sub_admin') && (
                          <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
                            Admin
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(reply.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{reply.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No replies yet</p>
            )}
          </div>

          {/* Reply Input */}
          <div className="border-t pt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Add Reply</h4>
            <textarea
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="4"
              placeholder="Type your response..."
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
            />
            <Button
              onClick={handleSendReply}
              className="mt-2 bg-blue-600 hover:bg-blue-700"
            >
              Send Reply
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Support Tickets Management</h2>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
            <select
              className="w-full border rounded p-2"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Category</label>
            <select
              className="w-full border rounded p-2"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="Account Issues">Account Issues</option>
              <option value="Mining">Mining</option>
              <option value="Marketplace">Marketplace</option>
              <option value="Wallet">Wallet</option>
              <option value="KYC/VIP">KYC/VIP</option>
              <option value="Orders">Orders</option>
              <option value="Technical">Technical</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Tickets List */}
      <div className="space-y-3">
        {tickets.length === 0 ? (
          <Card className="p-12 text-center">
            <HeadphonesIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Support Tickets</h3>
            <p className="text-gray-600">No tickets match your filters</p>
          </Card>
        ) : (
          tickets.map((ticket) => (
            <Card
              key={ticket.ticket_id}
              className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleViewTicket(ticket.ticket_id)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{ticket.subject}</h3>
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                      {ticket.category}
                    </span>
                  </div>
                  <p className="text-gray-600 line-clamp-1">{ticket.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span>User: {ticket.user_name}</span>
                    <span>Email: {ticket.user_email}</span>
                    <span>Created: {new Date(ticket.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(ticket.status)}`}>
                    {ticket.status}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

// Placeholder Components for Future Implementation
const NotificationsManagement = () => {
  return (
    <Card className="p-12 text-center">
      <Bell className="h-16 w-16 text-gray-400 mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-gray-900 mb-2">Notifications Management</h3>
      <p className="text-gray-600">Feature coming soon - Send system-wide announcements and alerts</p>
    </Card>
  );
};

export default AdminDashboard;