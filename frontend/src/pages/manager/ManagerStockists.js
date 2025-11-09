import { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, TrendingUp, Package, CheckCircle } from 'lucide-react';
import notifications from '@/utils/notifications';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ManagerStockists = ({ user, onLogout }) => {
  const [stockists, setStockists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    fetchStockists();
  }, [roleFilter]);

  const fetchStockists = async () => {
    setLoading(true);
    try {
      const params = { uid: user.uid };
      if (roleFilter) params.role = roleFilter;

      const response = await axios.get(`${API}/manager/stockists`, { params });
      setStockists(response.data.stockists);
    } catch (error) {
      console.error('Error:', error);
      notifications.error('Error', 'Failed to fetch stockists');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Stockist Management</h1>
          <p className="text-gray-600">Monitor stockist performance and metrics</p>
        </div>

        {/* Filter */}
        <Card className="p-6 mb-6">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg">
            <option value="">All Stockists</option>
            <option value="master_stockist">Master Stockists</option>
            <option value="sub_stockist">Sub Stockists</option>
            <option value="outlet">Outlets</option>
          </select>
        </Card>

        {/* Stockists Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div><span className="ml-3">Loading...</span></div>
          ) : stockists.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500"><Users className="h-12 w-12 mx-auto mb-2 text-gray-300" /><p>No stockists found</p></div>
          ) : (
            stockists.map((stockist) => (
              <Card key={stockist.uid} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{stockist.name}</h3>
                    <p className="text-sm text-gray-500">{stockist.email}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${stockist.role === 'master_stockist' ? 'bg-purple-100 text-purple-800' : stockist.role === 'sub_stockist' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                    {stockist.role?.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-gray-600" />
                      <span className="text-sm text-gray-600">Total Orders</span>
                    </div>
                    <span className="font-semibold text-gray-900">{stockist.orders_count || 0}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-gray-600">Delivered</span>
                    </div>
                    <span className="font-semibold text-gray-900">{stockist.delivered_count || 0}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-gray-600">Fulfillment Rate</span>
                    </div>
                    <span className="font-semibold text-green-600">{stockist.fulfillment_rate || 0}%</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500">Joined: {stockist.created_at ? new Date(stockist.created_at).toLocaleDateString() : 'N/A'}</p>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ManagerStockists;