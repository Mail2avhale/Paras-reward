import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Package, Search, Plus, Edit, Trash2, Eye, RefreshCw,
  Tag, DollarSign, Box, Image as ImageIcon
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminMarketplace = ({ user }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    prc_price: '',
    cash_price: '',
    stock: '',
    image_url: ''
  });

  const categories = ['Electronics', 'Fashion', 'Home', 'Beauty', 'Sports', 'Books', 'Grocery', 'Other'];

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/products`);
      setProducts(response.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async () => {
    try {
      setProcessing(true);
      await axios.post(`${API}/products`, {
        ...formData,
        prc_price: parseFloat(formData.prc_price),
        cash_price: parseFloat(formData.cash_price || 0),
        stock: parseInt(formData.stock)
      });
      toast.success('Product added successfully');
      setShowAddModal(false);
      setFormData({ name: '', description: '', category: '', prc_price: '', cash_price: '', stock: '', image_url: '' });
      fetchProducts();
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Failed to add product');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    
    try {
      await axios.delete(`${API}/products/${productId}`);
      toast.success('Product deleted');
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const handleUpdateStock = async (productId, newStock) => {
    try {
      await axios.put(`${API}/products/${productId}`, { stock: parseInt(newStock) });
      toast.success('Stock updated');
      fetchProducts();
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Failed to update stock');
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const stats = {
    total: products.length,
    inStock: products.filter(p => p.stock > 0).length,
    outOfStock: products.filter(p => p.stock === 0).length,
    lowStock: products.filter(p => p.stock > 0 && p.stock < 10).length
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketplace Management</h1>
          <p className="text-gray-500">Manage products in the marketplace</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="h-4 w-4 mr-2" /> Add Product
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-600">Total Products</p>
          <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
        </Card>
        <Card className="p-4 bg-green-50 border-green-200">
          <p className="text-xs text-green-600">In Stock</p>
          <p className="text-2xl font-bold text-green-700">{stats.inStock}</p>
        </Card>
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-xs text-red-600">Out of Stock</p>
          <p className="text-2xl font-bold text-red-700">{stats.outOfStock}</p>
        </Card>
        <Card className="p-4 bg-orange-50 border-orange-200">
          <p className="text-xs text-orange-600">Low Stock (&lt;10)</p>
          <p className="text-2xl font-bold text-orange-700">{stats.lowStock}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <Button onClick={fetchProducts} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </Card>

      {/* Products Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No products found</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <Card key={product.product_id} className="overflow-hidden">
              <div className="aspect-square bg-gray-100 relative">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-gray-300" />
                  </div>
                )}
                <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold ${
                  product.stock === 0 ? 'bg-red-100 text-red-700' :
                  product.stock < 10 ? 'bg-orange-100 text-orange-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {product.stock === 0 ? 'Out of Stock' : `${product.stock} in stock`}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                <p className="text-xs text-gray-500 mb-2">{product.category}</p>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-bold text-purple-600">{product.prc_price?.toLocaleString()} PRC</span>
                  {product.cash_price > 0 && (
                    <span className="text-sm text-gray-500">₹{product.cash_price?.toLocaleString()}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setSelectedProduct(product)}
                  >
                    <Edit className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => handleDeleteProduct(product.product_id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Add New Product</h2>
                <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600">Product Name *</label>
                  <Input
                    placeholder="Enter product name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Description</label>
                  <textarea
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Product description"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Category *</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">PRC Price *</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.prc_price}
                      onChange={(e) => setFormData({...formData, prc_price: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Cash Price (₹)</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.cash_price}
                      onChange={(e) => setFormData({...formData, cash_price: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Stock Quantity *</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({...formData, stock: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Image URL</label>
                  <Input
                    placeholder="https://..."
                    value={formData.image_url}
                    onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddProduct} 
                    disabled={processing || !formData.name || !formData.category || !formData.prc_price || !formData.stock}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    {processing ? 'Adding...' : 'Add Product'}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Product Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Edit Product</h2>
                <button onClick={() => setSelectedProduct(null)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Product Name</p>
                  <p className="font-semibold">{selectedProduct.name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Update Stock</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      defaultValue={selectedProduct.stock}
                      id="editStock"
                    />
                    <Button onClick={() => {
                      const newStock = document.getElementById('editStock').value;
                      handleUpdateStock(selectedProduct.product_id, newStock);
                      setSelectedProduct(null);
                    }}>
                      Update
                    </Button>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setSelectedProduct(null)} className="w-full">
                  Close
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
