import { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/manager/StatusBadge';
import ImageCropUpload from '@/components/ImageCropUpload';
import notifications from '@/utils/notifications';
import { Package, Search, Plus, Edit, Eye, BarChart } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ManagerProducts = ({ user, onLogout }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [skip, setSkip] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    prc_cost: '',
    stock: '',
    image_url: '',
    active: true
  });
  const limit = 50;

  useEffect(() => {
    fetchProducts();
  }, [search, categoryFilter, statusFilter, skip]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = { uid: user.uid, skip, limit };
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;

      const response = await axios.get(`${API}/manager/products`, { params });
      setProducts(response.data.products);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error fetching products:', error);
      notifications.error('Error', 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.name || !formData.price || !formData.prc_cost) {
      notifications.warning('Required Fields', 'Please fill in all required fields');
      return;
    }

    try {
      await axios.post(`${API}/manager/products`, formData, {
        params: { uid: user.uid }
      });
      
      notifications.success('Product Added', 'Product has been added successfully');
      setShowAddModal(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      notifications.error('Add Failed', error.response?.data?.detail || 'Failed to add product');
    }
  };

  const handleUpdate = async () => {
    try {
      await axios.put(
        `${API}/manager/products/${selectedProduct.product_id}`,
        formData,
        { params: { uid: user.uid } }
      );
      
      notifications.success('Product Updated', 'Product has been updated successfully');
      setShowEditModal(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      notifications.error('Update Failed', error.response?.data?.detail || 'Failed to update product');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      price: '',
      prc_cost: '',
      stock: '',
      image_url: '',
      active: true
    });
  };

  const openEditModal = (product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      price: product.price,
      prc_cost: product.prc_cost,
      stock: product.stock,
      image_url: product.image_url || '',
      active: product.active
    });
    setShowEditModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Product Management</h1>
            <p className="text-gray-600">Add, edit, and manage products</p>
          </div>
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Categories</option>
              <option value="Electronics">Electronics</option>
              <option value="Fashion">Fashion</option>
              <option value="Home">Home</option>
              <option value="Beauty">Beauty</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {skip + 1} - {Math.min(skip + limit, total)} of {total} products
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setSkip(Math.max(0, skip - limit))} disabled={skip === 0} variant="outline" size="sm">Previous</Button>
              <Button onClick={() => setSkip(skip + limit)} disabled={skip + limit >= total} variant="outline" size="sm">Next</Button>
            </div>
          </div>
        </Card>

        {/* Products Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PRC Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y">
                {loading ? (
                  <tr><td colSpan="7" className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                      <span className="ml-3 text-gray-600">Loading products...</span>
                    </div>
                  </td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No products found</p>
                  </td></tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.product_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500">{product.product_id}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{product.category || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">₹{product.price}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{product.prc_cost} PRC</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{product.stock}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          product.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {product.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Button size="sm" variant="outline" onClick={() => openEditModal(product)}>
                          <Edit className="h-4 w-4 mr-1" />Edit
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Add Product Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
              <DialogDescription>Fill in the product details</DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Product Name *</label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Input value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Price (₹) *</label>
                <Input type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">PRC Cost *</label>
                <Input type="number" value={formData.prc_cost} onChange={(e) => setFormData({...formData, prc_cost: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Stock</label>
                <Input type="number" value={formData.stock} onChange={(e) => setFormData({...formData, stock: e.target.value})} />
              </div>
              <div className="col-span-2">
                <ImageCropUpload
                  value={formData.image_url}
                  onChange={(base64Image) => setFormData({...formData, image_url: base64Image})}
                  label="Product Image"
                  aspectRatio={1}
                  maxSizeMB={2}
                  required={false}
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea rows={3} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formData.active} onChange={(e) => setFormData({...formData, active: e.target.checked})} />
                  <span className="text-sm font-medium">Active</span>
                </label>
              </div>
            </div>
            
            <div className="flex gap-3 mt-4">
              <Button onClick={() => setShowAddModal(false)} variant="outline" className="flex-1">Cancel</Button>
              <Button onClick={handleAdd} className="flex-1 bg-purple-600 hover:bg-purple-700">Add Product</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Product Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
              <DialogDescription>Update product details</DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Product Name *</label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Input value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Price (₹) *</label>
                <Input type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">PRC Cost *</label>
                <Input type="number" value={formData.prc_cost} onChange={(e) => setFormData({...formData, prc_cost: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Stock</label>
                <Input type="number" value={formData.stock} onChange={(e) => setFormData({...formData, stock: e.target.value})} />
              </div>
              <div className="col-span-2">
                <ImageCropUpload
                  value={formData.image_url}
                  onChange={(base64Image) => setFormData({...formData, image_url: base64Image})}
                  label="Product Image"
                  aspectRatio={1}
                  maxSizeMB={2}
                  required={false}
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea rows={3} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formData.active} onChange={(e) => setFormData({...formData, active: e.target.checked})} />
                  <span className="text-sm font-medium">Active</span>
                </label>
              </div>
            </div>
            
            <div className="flex gap-3 mt-4">
              <Button onClick={() => setShowEditModal(false)} variant="outline" className="flex-1">Cancel</Button>
              <Button onClick={handleUpdate} className="flex-1 bg-purple-600 hover:bg-purple-700">Update Product</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ManagerProducts;