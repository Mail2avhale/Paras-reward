import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Pagination from '@/components/Pagination';
import {
  Package, Search, Plus, Edit, Trash2, RefreshCw, X, Upload,
  DollarSign, Box, Image as ImageIcon, Truck, Star, Home,
  AlertCircle, CheckCircle, Save
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const ITEMS_PER_PAGE = 12;
const DEFAULT_PRC_TO_INR_RATE = 0.1; // 10 PRC = ₹1

const BADGES = [
  { value: '', label: 'No Badge' },
  { value: 'new', label: '🆕 New' },
  { value: 'trending', label: '🔥 Trending' },
  { value: 'hot_deal', label: '💥 Hot Deal' },
  { value: 'limited', label: '⏰ Limited Offer' },
  { value: 'bestseller', label: '⭐ Bestseller' }
];

const CATEGORIES = [
  'Electronics', 'Home & Kitchen', 'Fashion', 'Beauty', 'Sports',
  'Handbags & Accessories', 'Books', 'Grocery', 'Vouchers', 'Other'
];

const STOCK_STATUS = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'limited', label: 'Limited Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' }
];

const DELIVERY_TYPES = [
  { value: 'fixed', label: 'Fixed Amount (₹)' },
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'free', label: 'Free Delivery' }
];

// Product Form Component - Moved outside to avoid re-renders
const ProductForm = ({ formData, setFormData, prcToInrRate, imagePreview, handleImageChange, removeImage }) => {
  
  const handlePrcPriceChange = (value) => {
    const prcPrice = parseFloat(value) || 0;
    const inrPrice = prcPrice * prcToInrRate;
    setFormData(prev => ({
      ...prev,
      prc_price: value,
      inr_price: inrPrice.toFixed(2)
    }));
  };

  const handleCostChange = (value) => {
    const inrPrice = parseFloat(formData.prc_price) * prcToInrRate;
    const costValue = parseFloat(value) || 0;
    let margin = 0;
    if (costValue > 0 && inrPrice > 0) {
      margin = ((inrPrice - costValue) / inrPrice * 100).toFixed(2);
    }
    setFormData(prev => ({
      ...prev,
      cost_to_company: value,
      margin_percent: margin
    }));
  };

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="bg-gray-800/50 rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Package className="h-4 w-4" /> Basic Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-sm text-gray-400">Product Name *</label>
            <Input
              placeholder="Enter product name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="text-sm text-gray-400">Description</label>
            <textarea
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white resize-none"
              placeholder="Product description"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
            />
          </div>
          
          <div>
            <label className="text-sm text-gray-400">Category *</label>
            <select
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              value={formData.category}
              onChange={(e) => setFormData(prev => ({...prev, category: e.target.value}))}
            >
              <option value="">Select category</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-sm text-gray-400">Badge</label>
            <select
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              value={formData.badge}
              onChange={(e) => setFormData(prev => ({...prev, badge: e.target.value}))}
            >
              {BADGES.map(badge => (
                <option key={badge.value} value={badge.value}>{badge.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-gray-800/50 rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> Pricing
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-400">PRC Price *</label>
            <div className="relative">
              <Input
                type="number"
                placeholder="0"
                value={formData.prc_price}
                onChange={(e) => handlePrcPriceChange(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 text-sm">PRC</span>
            </div>
          </div>
          
          <div>
            <label className="text-sm text-gray-400 flex items-center gap-1">
              INR Price <span className="text-xs text-gray-500">(10 PRC = ₹1)</span>
            </label>
            <div className="relative">
              <Input
                type="number"
                placeholder="Auto-calculated"
                value={formData.inr_price}
                onChange={(e) => setFormData(prev => ({...prev, inr_price: e.target.value}))}
                className="bg-gray-800 border-gray-700 text-white pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 text-sm">₹</span>
            </div>
          </div>
          
          <div>
            <label className="text-sm text-gray-400">Cost to Company (₹)</label>
            <div className="relative">
              <Input
                type="number"
                placeholder="0"
                value={formData.cost_to_company}
                onChange={(e) => handleCostChange(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
            </div>
          </div>
        </div>
        
        {formData.margin_percent && (
          <div className="bg-gray-900/50 rounded-lg p-3">
            <p className="text-sm text-gray-400">
              Estimated Margin: <span className={`font-bold ${parseFloat(formData.margin_percent) > 20 ? 'text-green-400' : parseFloat(formData.margin_percent) > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                {formData.margin_percent}%
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Delivery */}
      <div className="bg-gray-800/50 rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Truck className="h-4 w-4" /> Delivery Settings
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-400">Delivery Charge Type</label>
            <select
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              value={formData.delivery_charge_type}
              onChange={(e) => setFormData(prev => ({...prev, delivery_charge_type: e.target.value, delivery_charge_value: e.target.value === 'free' ? '0' : prev.delivery_charge_value}))}
            >
              {DELIVERY_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          
          {formData.delivery_charge_type !== 'free' && (
            <div>
              <label className="text-sm text-gray-400">
                {formData.delivery_charge_type === 'percentage' ? 'Percentage' : 'Amount'}
              </label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.delivery_charge_value}
                  onChange={(e) => setFormData(prev => ({...prev, delivery_charge_value: e.target.value}))}
                  className="bg-gray-800 border-gray-700 text-white pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  {formData.delivery_charge_type === 'percentage' ? '%' : '₹'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stock & Status */}
      <div className="bg-gray-800/50 rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Box className="h-4 w-4" /> Stock & Status
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-400">Stock Quantity</label>
            <Input
              type="number"
              placeholder="0"
              value={formData.stock_quantity}
              onChange={(e) => setFormData(prev => ({...prev, stock_quantity: e.target.value}))}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>
          
          <div>
            <label className="text-sm text-gray-400">Stock Status</label>
            <select
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              value={formData.stock_status}
              onChange={(e) => setFormData(prev => ({...prev, stock_status: e.target.value}))}
            >
              {STOCK_STATUS.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-sm text-gray-400">Product Status</label>
            <select
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              value={formData.product_status}
              onChange={(e) => setFormData(prev => ({...prev, product_status: e.target.value}))}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        
        <div className="flex items-center gap-3 pt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.show_on_home}
              onChange={(e) => setFormData(prev => ({...prev, show_on_home: e.target.checked}))}
              className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm text-gray-300 flex items-center gap-1">
              <Home className="h-4 w-4" /> Show on Home Page
            </span>
          </label>
        </div>
      </div>

      {/* Image Upload */}
      <div className="bg-gray-800/50 rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <ImageIcon className="h-4 w-4" /> Product Image
        </h3>
        
        <div className="flex items-start gap-4">
          <div className="w-32 h-32 bg-gray-900 rounded-xl border-2 border-dashed border-gray-700 flex items-center justify-center overflow-hidden">
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="h-10 w-10 text-gray-600" />
            )}
          </div>
          
          <div className="flex-1 space-y-3">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
              id="product-image"
            />
            <label
              htmlFor="product-image"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors"
            >
              <Upload className="h-4 w-4" /> Upload Image
            </label>
            <p className="text-xs text-gray-500">Recommended: 800x800px, Max 5MB</p>
            {imagePreview && (
              <button onClick={removeImage} className="text-red-400 text-sm hover:underline">
                Remove Image
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminMarketplace = ({ user }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [prcToInrRate, setPrcToInrRate] = useState(DEFAULT_PRC_TO_INR_RATE);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const initialFormData = {
    name: '', description: '', category: '', prc_price: '', inr_price: '',
    badge: '', show_on_home: false, stock_quantity: '', stock_status: 'in_stock',
    delivery_charge_type: 'fixed', delivery_charge_value: '0',
    cost_to_company: '', margin_percent: '', product_status: 'active'
  };

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    fetchProducts();
    fetchSettings();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, statusFilter]);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/admin/settings/marketplace`);
      if (response.data?.prc_to_inr_rate) {
        setPrcToInrRate(response.data.prc_to_inr_rate);
      }
    } catch (error) {
      console.log('Using default PRC rate');
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/products?limit=500`);
      setProducts(response.data?.products || response.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageFile(null);
  };

  const handleAddProduct = async () => {
    if (!formData.name || !formData.category || !formData.prc_price) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      setProcessing(true);
      const productData = new FormData();
      productData.append('name', formData.name);
      productData.append('description', formData.description || '');
      productData.append('category', formData.category);
      productData.append('prc_price', parseFloat(formData.prc_price));
      productData.append('inr_price', parseFloat(formData.inr_price) || parseFloat(formData.prc_price) * prcToInrRate);
      productData.append('badge', formData.badge || '');
      productData.append('show_on_home', formData.show_on_home);
      productData.append('stock_quantity', parseInt(formData.stock_quantity) || 0);
      productData.append('stock_status', formData.stock_status);
      productData.append('delivery_charge_type', formData.delivery_charge_type);
      productData.append('delivery_charge_value', parseFloat(formData.delivery_charge_value) || 0);
      productData.append('cost_to_company', parseFloat(formData.cost_to_company) || 0);
      productData.append('margin_percent', parseFloat(formData.margin_percent) || 0);
      productData.append('product_status', formData.product_status);
      productData.append('created_by', user?.uid || 'admin');
      if (imageFile) productData.append('image', imageFile);

      await axios.post(`${API}/admin/products`, productData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Product added successfully');
      setShowAddModal(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error(error.response?.data?.detail || 'Failed to add product');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateProduct = async () => {
    if (!selectedProduct) return;

    try {
      setProcessing(true);
      const productData = new FormData();
      productData.append('name', formData.name);
      productData.append('description', formData.description || '');
      productData.append('category', formData.category);
      productData.append('prc_price', parseFloat(formData.prc_price));
      productData.append('inr_price', parseFloat(formData.inr_price) || parseFloat(formData.prc_price) * prcToInrRate);
      productData.append('badge', formData.badge || '');
      productData.append('show_on_home', formData.show_on_home);
      productData.append('stock_quantity', parseInt(formData.stock_quantity) || 0);
      productData.append('stock_status', formData.stock_status);
      productData.append('delivery_charge_type', formData.delivery_charge_type);
      productData.append('delivery_charge_value', parseFloat(formData.delivery_charge_value) || 0);
      productData.append('cost_to_company', parseFloat(formData.cost_to_company) || 0);
      productData.append('margin_percent', parseFloat(formData.margin_percent) || 0);
      productData.append('product_status', formData.product_status);
      if (imageFile) productData.append('image', imageFile);

      await axios.put(`${API}/admin/products/${selectedProduct.product_id}`, productData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Product updated successfully');
      setSelectedProduct(null);
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error(error.response?.data?.detail || 'Failed to update product');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    
    try {
      await axios.delete(`${API}/admin/products/${productId}`);
      toast.success('Product deleted');
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setImagePreview(null);
    setImageFile(null);
  };

  const openEditModal = (product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name || '',
      description: product.description || '',
      category: product.category || '',
      prc_price: product.prc_price?.toString() || '',
      inr_price: product.inr_price?.toString() || '',
      badge: product.badge || '',
      show_on_home: product.show_on_home || false,
      stock_quantity: product.stock_quantity?.toString() || '0',
      stock_status: product.stock_status || 'in_stock',
      delivery_charge_type: product.delivery_charge_type || 'fixed',
      delivery_charge_value: product.delivery_charge_value?.toString() || '0',
      cost_to_company: product.cost_to_company?.toString() || '',
      margin_percent: product.margin_percent?.toString() || '',
      product_status: product.product_status || 'active'
    });
    setImagePreview(product.image_url ? `${BACKEND_URL}${product.image_url}` : null);
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || product.product_status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const stats = {
    total: products.length,
    active: products.filter(p => p.product_status === 'active').length,
    inStock: products.filter(p => p.stock_status === 'in_stock' && (p.stock_quantity > 0 || p.stock_quantity === undefined)).length,
    outOfStock: products.filter(p => p.stock_status === 'out_of_stock' || p.stock_quantity === 0).length,
    homeProducts: products.filter(p => p.show_on_home).length,
    withBadge: products.filter(p => p.badge).length
  };

  const getBadgeDisplay = (badge) => {
    const found = BADGES.find(b => b.value === badge);
    return found?.label || badge;
  };

  const getStockStatusColor = (status, quantity) => {
    if (status === 'out_of_stock' || quantity === 0) return 'bg-red-100 text-red-700 border-red-200';
    if (status === 'limited' || (quantity > 0 && quantity < 10)) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-green-100 text-green-700 border-green-200';
  };

  return (
    <div className="p-4 lg:p-6 bg-gray-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketplace Management</h1>
          <p className="text-gray-500">Manage products in the marketplace</p>
        </div>
        <Button 
          onClick={() => { resetForm(); setShowAddModal(true); }} 
          className="bg-amber-500 hover:bg-amber-600 text-black"
          data-testid="add-product-btn"
        >
          <Plus className="h-4 w-4 mr-2" /> Add Product
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-xl font-bold text-white">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Active</p>
              <p className="text-xl font-bold text-white">{stats.active}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <Box className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">In Stock</p>
              <p className="text-xl font-bold text-white">{stats.inStock}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Out of Stock</p>
              <p className="text-xl font-bold text-white">{stats.outOfStock}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <Home className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">On Home</p>
              <p className="text-xl font-bold text-white">{stats.homeProducts}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Star className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">With Badge</p>
              <p className="text-xl font-bold text-white">{stats.withBadge}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6 bg-gray-900 border-gray-800">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white"
              data-testid="product-search"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            data-testid="category-filter"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <Button onClick={fetchProducts} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </Card>

      {/* Products Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card className="p-12 text-center bg-gray-900 border-gray-800">
          <Package className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No products found</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedProducts.map((product) => (
              <Card key={product.product_id} className="overflow-hidden bg-gray-900 border-gray-800" data-testid={`product-card-${product.product_id}`}>
                <div className="aspect-square bg-gray-800 relative">
                  {product.image_url ? (
                    <img 
                      src={product.image_url.startsWith('http') ? product.image_url : `${BACKEND_URL}${product.image_url}`} 
                      alt={product.name} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-gray-600" />
                    </div>
                  )}
                  
                  {product.badge && (
                    <div className="absolute top-2 left-2 bg-amber-500 px-2 py-1 rounded-full text-xs font-bold text-black">
                      {getBadgeDisplay(product.badge)}
                    </div>
                  )}
                  
                  <div className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-xs font-semibold border ${getStockStatusColor(product.stock_status, product.stock_quantity)}`}>
                    {product.stock_status === 'out_of_stock' || product.stock_quantity === 0 
                      ? 'Out of Stock' 
                      : `${product.stock_quantity || '∞'} in stock`}
                  </div>
                  
                  {product.show_on_home && (
                    <div className="absolute bottom-2 left-2 bg-blue-500 p-1.5 rounded-full">
                      <Home className="h-3 w-3 text-white" />
                    </div>
                  )}
                  
                  {product.product_status !== 'active' && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-white font-bold uppercase">{product.product_status}</span>
                    </div>
                  )}
                </div>
                
                <div className="p-4">
                  <h3 className="font-semibold text-white truncate">{product.name}</h3>
                  <p className="text-xs text-gray-500 mb-2">{product.category}</p>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-lg font-bold text-amber-400">{product.prc_price?.toLocaleString()} PRC</span>
                      {product.inr_price > 0 && (
                        <span className="text-sm text-gray-500 ml-2">≈ ₹{product.inr_price?.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                      onClick={() => openEditModal(product)}
                      data-testid={`edit-product-${product.product_id}`}
                    >
                      <Edit className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleDeleteProduct(product.product_id)}
                      data-testid={`delete-product-${product.product_id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          
          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredProducts.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-800">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Add New Product</h2>
                <button onClick={() => { setShowAddModal(false); resetForm(); }} className="text-gray-500 hover:text-gray-300">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <ProductForm 
                formData={formData}
                setFormData={setFormData}
                prcToInrRate={prcToInrRate}
                imagePreview={imagePreview}
                handleImageChange={handleImageChange}
                removeImage={removeImage}
              />

              <div className="flex gap-3 pt-6 border-t border-gray-800 mt-6">
                <Button variant="outline" onClick={() => { setShowAddModal(false); resetForm(); }} className="flex-1 border-gray-700 text-gray-300">
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddProduct} 
                  disabled={processing || !formData.name || !formData.category || !formData.prc_price}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-black"
                  data-testid="save-product-btn"
                >
                  {processing ? 'Adding...' : <><Save className="h-4 w-4 mr-2" /> Add Product</>}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Product Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-800">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Edit Product</h2>
                <button onClick={() => { setSelectedProduct(null); resetForm(); }} className="text-gray-500 hover:text-gray-300">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <ProductForm 
                formData={formData}
                setFormData={setFormData}
                prcToInrRate={prcToInrRate}
                imagePreview={imagePreview}
                handleImageChange={handleImageChange}
                removeImage={removeImage}
              />

              <div className="flex gap-3 pt-6 border-t border-gray-800 mt-6">
                <Button variant="outline" onClick={() => { setSelectedProduct(null); resetForm(); }} className="flex-1 border-gray-700 text-gray-300">
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateProduct} 
                  disabled={processing || !formData.name || !formData.category || !formData.prc_price}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-black"
                  data-testid="update-product-btn"
                >
                  {processing ? 'Updating...' : <><Save className="h-4 w-4 mr-2" /> Update Product</>}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminMarketplace;
