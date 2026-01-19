import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit, Trash2, Zap, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

function AdminFlashSales() {
  const [flashSales, setFlashSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [newSale, setNewSale] = useState({
    product_id: '',
    discount_percentage: 20,
    start_time: '',
    end_time: '',
    stock_limit: 100
  });

  useEffect(() => {
    fetchData();
  }, [filterStatus]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [salesRes, productsRes] = await Promise.all([
        axios.get(`${API}/admin/flash-sales?status=${filterStatus}`),
        axios.get(`${API}/admin/products?limit=1000`)
      ]);
      
      setFlashSales(salesRes.data.flash_sales || []);
      setProducts(productsRes.data.products || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load flash sales');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      // Find selected product
      const product = products.find(p => p.product_id === newSale.product_id);
      if (!product) {
        toast.error('Please select a product');
        return;
      }

      // Calculate discounted price
      const discountedPrice = Math.round(product.prc_price * (1 - newSale.discount_percentage / 100));

      const saleData = {
        ...newSale,
        discounted_prc_price: discountedPrice
      };

      await axios.post(`${API}/admin/flash-sales`, saleData);
      toast.success('Flash sale created successfully!');
      setShowCreateModal(false);
      setNewSale({
        product_id: '',
        discount_percentage: 20,
        start_time: '',
        end_time: '',
        stock_limit: 100
      });
      fetchData();
    } catch (error) {
      console.error('Error creating flash sale:', error);
      toast.error('Failed to create flash sale');
    }
  };

  const handleDelete = async (saleId) => {
    if (!window.confirm('Are you sure you want to delete this flash sale?')) return;

    try {
      await axios.delete(`${API}/admin/flash-sales/${saleId}`);
      toast.success('Flash sale deleted');
      fetchData();
    } catch (error) {
      console.error('Error deleting flash sale:', error);
      toast.error('Failed to delete flash sale');
    }
  };

  const getStatusBadge = (sale) => {
    const now = new Date().toISOString();
    if (now < sale.start_time) {
      return <span className="px-2 py-1 bg-blue-100 text-blue-400 rounded text-xs font-semibold">Upcoming</span>;
    } else if (now > sale.end_time) {
      return <span className="px-2 py-1 bg-gray-100 text-gray-200 rounded text-xs font-semibold">Expired</span>;
    } else {
      return <span className="px-2 py-1 bg-green-100 text-green-400 rounded text-xs font-semibold animate-pulse">Active</span>;
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Zap className="w-6 h-6 text-red-600" />
          Flash Sales Management
        </h2>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-red-600 hover:bg-red-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Flash Sale
        </Button>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <div className="flex gap-2">
          {['all', 'active', 'upcoming', 'expired'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filterStatus === status
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Flash Sales List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
        </div>
      ) : flashSales.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">No flash sales found</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {flashSales.map(sale => (
            <Card key={sale.sale_id} className="p-6 border-2 border-red-500/30">
              <div className="flex items-start justify-between mb-4">
                {getStatusBadge(sale)}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(sale.sale_id)}
                    className="text-red-600 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <h3 className="font-bold text-lg text-gray-900 mb-2">{sale.product_name}</h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Discount:</span>
                  <span className="font-semibold text-red-600">{sale.discount_percentage}% OFF</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Discounted Price:</span>
                  <span className="font-semibold">{sale.discounted_prc_price} PRC</span>
                </div>

                {sale.stock_limit && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Stock:</span>
                    <span className="font-semibold">
                      {sale.sold_count || 0} / {sale.stock_limit}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t">
                  <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                    <Calendar className="w-3 h-3" />
                    Start:
                  </div>
                  <p className="text-xs font-mono">{new Date(sale.start_time).toLocaleString()}</p>
                </div>

                <div>
                  <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                    <Calendar className="w-3 h-3" />
                    End:
                  </div>
                  <p className="text-xs font-mono">{new Date(sale.end_time).toLocaleString()}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Flash Sale</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Product
              </label>
              <select
                value={newSale.product_id}
                onChange={(e) => setNewSale({ ...newSale, product_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select a product</option>
                {products.map(product => (
                  <option key={product.product_id} value={product.product_id}>
                    {product.name} ({product.prc_price} PRC)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Discount Percentage
              </label>
              <Input
                type="number"
                value={newSale.discount_percentage}
                onChange={(e) => setNewSale({ ...newSale, discount_percentage: Number(e.target.value) })}
                min="1"
                max="99"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Start Time
                </label>
                <Input
                  type="datetime-local"
                  value={newSale.start_time}
                  onChange={(e) => setNewSale({ ...newSale, start_time: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  End Time
                </label>
                <Input
                  type="datetime-local"
                  value={newSale.end_time}
                  onChange={(e) => setNewSale({ ...newSale, end_time: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Stock Limit (Optional)
              </label>
              <Input
                type="number"
                value={newSale.stock_limit}
                onChange={(e) => setNewSale({ ...newSale, stock_limit: Number(e.target.value) })}
                min="1"
                placeholder="Leave empty for unlimited"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleCreate}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Create Flash Sale
              </Button>
              <Button
                onClick={() => setShowCreateModal(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminFlashSales;
