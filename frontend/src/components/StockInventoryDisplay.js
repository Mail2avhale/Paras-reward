import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Package, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StockInventoryDisplay = ({ userId, title = "My Stock Inventory" }) => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory();
  }, [userId]);

  const fetchInventory = async () => {
    try {
      const response = await axios.get(`${API}/stock/inventory/my-stock/${userId}`);
      setInventory(response.data.inventory || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const getTotalProducts = () => inventory.length;
  const getTotalQuantity = () => inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const getLowStockItems = () => inventory.filter(item => (item.quantity || 0) < 10).length;

  const getStockStatus = (quantity) => {
    if (quantity === 0) return { label: 'Out of Stock', color: 'text-red-600 bg-red-50' };
    if (quantity < 10) return { label: 'Low Stock', color: 'text-yellow-600 bg-yellow-50' };
    if (quantity < 50) return { label: 'Medium Stock', color: 'text-blue-600 bg-blue-50' };
    return { label: 'Good Stock', color: 'text-green-600 bg-green-50' };
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Products</p>
              <p className="text-3xl font-bold text-blue-900 mt-1">{getTotalProducts()}</p>
            </div>
            <Package className="h-10 w-10 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Total Quantity</p>
              <p className="text-3xl font-bold text-green-900 mt-1">{getTotalQuantity()}</p>
            </div>
            <TrendingUp className="h-10 w-10 text-green-600" />
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-yellow-50 to-yellow-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600">Low Stock Items</p>
              <p className="text-3xl font-bold text-yellow-900 mt-1">{getLowStockItems()}</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-yellow-600" />
          </div>
        </Card>
      </div>

      {/* Inventory Table */}
      <Card className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">{title}</h3>
        
        {inventory.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No inventory items</p>
            <p className="text-gray-400 text-sm mt-1">Request stock to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Product</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Quantity</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item, index) => {
                  const status = getStockStatus(item.quantity || 0);
                  return (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                            <Package className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{item.product_name || 'Unknown Product'}</p>
                            <p className="text-xs text-gray-500">ID: {item.product_id?.substring(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-2xl font-bold text-gray-900">{item.quantity || 0}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {item.updated_at 
                          ? new Date(item.updated_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default StockInventoryDisplay;
