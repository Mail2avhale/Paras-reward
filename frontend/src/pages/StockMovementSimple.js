import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Package, ArrowRight, Users, Building2, Store, ShoppingBag, Send, CheckCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StockMovementSimple = () => {
  const [products, setProducts] = useState([]);
  const [stockists, setStockists] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    product_id: '',
    quantity: '',
    from_id: '',
    to_id: '',
    notes: ''
  });

  const [fromType, setFromType] = useState('company');
  const [toType, setToType] = useState('master');

  useEffect(() => {
    fetchProducts();
    fetchStockists();
    fetchMovements();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API}/products`);
      setProducts(response.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    }
  };

  const fetchStockists = async () => {
    try {
      const response = await axios.get(`${API}/admin/stockists`);
      setStockists(response.data.stockists || []);
    } catch (error) {
      console.error('Error fetching stockists:', error);
    }
  };

  const fetchMovements = async () => {
    try {
      const response = await axios.get(`${API}/admin/stock/movements`);
      setMovements(response.data.movements || []);
    } catch (error) {
      console.error('Error fetching movements:', error);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate
      if (!formData.product_id || !formData.quantity || !formData.to_id) {
        toast.error('Please fill all required fields');
        setLoading(false);
        return;
      }

      const payload = {
        product_id: formData.product_id,
        quantity: parseInt(formData.quantity),
        from_type: fromType,
        from_id: formData.from_id || 'company',
        to_type: toType,
        to_id: formData.to_id,
        notes: formData.notes
      };

      await axios.post(`${API}/stock/transfer/initiate`, payload);
      
      toast.success('Stock transfer initiated successfully!');
      setFormData({
        product_id: '',
        quantity: '',
        from_id: '',
        to_id: '',
        notes: ''
      });
      fetchMovements();
    } catch (error) {
      console.error('Error initiating transfer:', error);
      toast.error(error.response?.data?.detail || 'Failed to initiate transfer');
    } finally {
      setLoading(false);
    }
  };

  const getStockistIcon = (type) => {
    switch (type) {
      case 'company': return <Building2 className="h-5 w-5" />;
      case 'master': return <Users className="h-5 w-5" />;
      case 'sub': return <Store className="h-5 w-5" />;
      case 'outlet': return <ShoppingBag className="h-5 w-5" />;
      default: return <Package className="h-5 w-5" />;
    }
  };

  const getStockistColor = (type) => {
    switch (type) {
      case 'company': return 'bg-indigo-100 text-indigo-700';
      case 'master': return 'bg-purple-100 text-purple-700';
      case 'sub': return 'bg-blue-100 text-blue-700';
      case 'outlet': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getToOptions = () => {
    if (fromType === 'company') {
      return stockists.filter(s => s.role === 'master_stockist');
    } else if (fromType === 'master') {
      return stockists.filter(s => s.role === 'sub_stockist');
    } else if (fromType === 'sub') {
      return stockists.filter(s => s.role === 'outlet');
    }
    return [];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stock Movement</h2>
          <p className="text-gray-600">Transfer stock between Company → Master → Sub → Outlet</p>
        </div>
      </div>

      {/* Transfer Form */}
      <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50">
        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Send className="h-6 w-6 text-purple-600" />
          Initiate Stock Transfer
        </h3>
        
        <form onSubmit={handleTransfer} className="space-y-6">
          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Product *
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
              value={formData.product_id}
              onChange={(e) => setFormData({...formData, product_id: e.target.value})}
              required
            >
              <option value="">-- Choose Product --</option>
              {products.map(product => (
                <option key={product.product_id} value={product.product_id}>
                  {product.name} - {product.category} (Available: {product.available_stock || 0})
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity *
            </label>
            <Input
              type="number"
              min="1"
              placeholder="Enter quantity"
              value={formData.quantity}
              onChange={(e) => setFormData({...formData, quantity: e.target.value})}
              required
              className="text-lg py-3"
            />
          </div>

          {/* Transfer Flow */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* FROM */}
            <Card className="p-4 bg-white">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transfer From *
              </label>
              <select
                className="w-full border rounded-lg p-2 mb-3"
                value={fromType}
                onChange={(e) => {
                  setFromType(e.target.value);
                  setFormData({...formData, from_id: '', to_id: ''});
                  // Auto-set toType based on fromType
                  if (e.target.value === 'company') setToType('master');
                  else if (e.target.value === 'master') setToType('sub');
                  else if (e.target.value === 'sub') setToType('outlet');
                }}
              >
                <option value="company">Company</option>
                <option value="master">Master Stockist</option>
                <option value="sub">Sub Stockist</option>
              </select>

              {fromType !== 'company' && (
                <select
                  className="w-full border rounded-lg p-2"
                  value={formData.from_id}
                  onChange={(e) => setFormData({...formData, from_id: e.target.value})}
                  required
                >
                  <option value="">-- Select Sender --</option>
                  {fromType === 'master' && stockists.filter(s => s.role === 'master_stockist').map(s => (
                    <option key={s.uid} value={s.uid}>{s.name}</option>
                  ))}
                  {fromType === 'sub' && stockists.filter(s => s.role === 'sub_stockist').map(s => (
                    <option key={s.uid} value={s.uid}>{s.name}</option>
                  ))}
                </select>
              )}

              <div className={`mt-3 px-3 py-2 rounded-lg flex items-center gap-2 ${getStockistColor(fromType)}`}>
                {getStockistIcon(fromType)}
                <span className="font-semibold">{fromType === 'company' ? 'Company' : fromType === 'master' ? 'Master' : 'Sub'}</span>
              </div>
            </Card>

            {/* ARROW */}
            <div className="flex justify-center">
              <ArrowRight className="h-10 w-10 text-purple-600 animate-pulse" />
            </div>

            {/* TO */}
            <Card className="p-4 bg-white">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transfer To *
              </label>
              <div className="text-sm text-gray-600 mb-3">
                {fromType === 'company' && 'Master Stockist'}
                {fromType === 'master' && 'Sub Stockist'}
                {fromType === 'sub' && 'Outlet'}
              </div>

              <select
                className="w-full border rounded-lg p-2"
                value={formData.to_id}
                onChange={(e) => setFormData({...formData, to_id: e.target.value})}
                required
              >
                <option value="">-- Select Receiver --</option>
                {getToOptions().map(s => (
                  <option key={s.uid} value={s.uid}>
                    {s.name} - {s.email}
                  </option>
                ))}
              </select>

              <div className={`mt-3 px-3 py-2 rounded-lg flex items-center gap-2 ${getStockistColor(toType)}`}>
                {getStockistIcon(toType)}
                <span className="font-semibold">{toType === 'master' ? 'Master' : toType === 'sub' ? 'Sub' : 'Outlet'}</span>
              </div>
            </Card>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              className="w-full border rounded-lg p-3"
              rows="3"
              placeholder="Add any notes about this transfer..."
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 text-lg font-semibold"
          >
            {loading ? 'Initiating Transfer...' : 'Initiate Stock Transfer'}
          </Button>
        </form>
      </Card>

      {/* Recent Movements */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-4">Recent Stock Movements</h3>
        {movements.length === 0 ? (
          <Card className="p-12 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No stock movements yet</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {movements.slice(0, 10).map((movement) => (
              <Card key={movement.movement_id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`px-3 py-2 rounded-lg ${getStockistColor(movement.from_type)}`}>
                      {getStockistIcon(movement.from_type)}
                    </div>
                    
                    <ArrowRight className="h-5 w-5 text-gray-400" />
                    
                    <div className={`px-3 py-2 rounded-lg ${getStockistColor(movement.to_type)}`}>
                      {getStockistIcon(movement.to_type)}
                    </div>

                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{movement.product_name || 'Product'}</p>
                      <p className="text-sm text-gray-600">Quantity: {movement.quantity}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(movement.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      movement.status === 'completed' ? 'bg-green-100 text-green-700' :
                      movement.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {movement.status === 'completed' && <CheckCircle className="inline h-4 w-4 mr-1" />}
                      {movement.status?.toUpperCase()}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StockMovementSimple;
