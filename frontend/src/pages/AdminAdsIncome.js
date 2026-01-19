import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import Pagination from '../components/Pagination';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Smartphone, Plus, Trash2, RefreshCw, Download, DollarSign,
  TrendingUp, Eye, Calendar, Filter
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminAdsIncome = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  
  // Add entry modal
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    ad_network: 'admob',
    impressions: '',
    clicks: '',
    ecpm: '',
    revenue_amount: '',
    notes: ''
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchEntries();
  }, [user, navigate, page]);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/admin/finance/ads-income?page=${page}&limit=20`);
      setEntries(response.data.entries || []);
      setSummary(response.data.summary || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      toast.error('Failed to load ads income data');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!form.revenue_amount) {
      toast.error('Revenue amount is required');
      return;
    }
    
    try {
      await axios.post(`${API}/api/admin/finance/ads-income`, {
        ...form,
        impressions: parseInt(form.impressions) || 0,
        clicks: parseInt(form.clicks) || 0,
        ecpm: parseFloat(form.ecpm) || 0,
        revenue_amount: parseFloat(form.revenue_amount),
        admin_id: user.uid
      });
      toast.success('Ads income entry added!');
      setShowAdd(false);
      setForm({
        date: new Date().toISOString().split('T')[0],
        ad_network: 'admob',
        impressions: '',
        clicks: '',
        ecpm: '',
        revenue_amount: '',
        notes: ''
      });
      fetchEntries();
    } catch (error) {
      toast.error('Failed to add entry');
    }
  };

  const handleDelete = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    
    try {
      await axios.delete(`${API}/api/admin/finance/ads-income/${entryId}`);
      toast.success('Entry deleted');
      fetchEntries();
    } catch (error) {
      toast.error('Failed to delete entry');
    }
  };

  // Calculate totals from summary
  const totalRevenue = summary.reduce((sum, s) => sum + (s.total_revenue || 0), 0);
  const totalImpressions = summary.reduce((sum, s) => sum + (s.total_impressions || 0), 0);
  const totalClicks = summary.reduce((sum, s) => sum + (s.total_clicks || 0), 0);

  // Prepare chart data
  const chartData = entries.slice(0, 7).reverse().map(e => ({
    date: e.date?.slice(5, 10) || '',
    revenue: e.revenue_amount || 0,
    network: e.ad_network
  }));

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-800/50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-blue-600" />
            Ads Income Management
          </h1>
          <p className="text-sm text-gray-500">Track AdMob & Unity Ads revenue</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchEntries}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">₹{totalRevenue.toLocaleString('en-IN')}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Impressions</p>
              <p className="text-2xl font-bold text-gray-900">{totalImpressions.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Eye className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Clicks</p>
              <p className="text-2xl font-bold text-gray-900">{totalClicks.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Entries</p>
              <p className="text-2xl font-bold text-gray-900">{total}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Calendar className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Network Summary */}
      {summary.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {summary.map((s) => (
            <Card key={s._id} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${s._id === 'admob' ? 'bg-green-100' : 'bg-purple-100'}`}>
                  <Smartphone className={`h-5 w-5 ${s._id === 'admob' ? 'text-green-600' : 'text-purple-600'}`} />
                </div>
                <h3 className="font-semibold capitalize">{s._id || 'Unknown'}</h3>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Revenue</p>
                  <p className="font-semibold">₹{s.total_revenue?.toLocaleString('en-IN') || 0}</p>
                </div>
                <div>
                  <p className="text-gray-500">Impressions</p>
                  <p className="font-semibold">{s.total_impressions?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className="text-gray-500">Avg eCPM</p>
                  <p className="font-semibold">₹{s.avg_ecpm?.toFixed(2) || 0}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Revenue Chart */}
      {chartData.length > 0 && (
        <Card className="p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Revenue</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
                <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Entries Table */}
      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">All Entries</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-3">Date</th>
                <th className="pb-3">Network</th>
                <th className="pb-3">Impressions</th>
                <th className="pb-3">Clicks</th>
                <th className="pb-3">eCPM</th>
                <th className="pb-3">Revenue</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.entry_id} className="border-b hover:bg-gray-800/50">
                  <td className="py-3">{entry.date}</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      entry.ad_network === 'admob' ? 'bg-green-100 text-green-400' : 'bg-purple-100 text-purple-400'
                    }`}>
                      {entry.ad_network?.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3">{entry.impressions?.toLocaleString()}</td>
                  <td className="py-3">{entry.clicks?.toLocaleString()}</td>
                  <td className="py-3">₹{entry.ecpm?.toFixed(2)}</td>
                  <td className="py-3 font-semibold text-green-600">₹{entry.revenue_amount?.toLocaleString('en-IN')}</td>
                  <td className="py-3">
                    <button
                      onClick={() => handleDelete(entry.entry_id)}
                      className="p-2 text-red-600 hover:bg-red-500/10 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No entries yet. Click "Add Entry" to start tracking.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {total > 20 && (
          <div className="mt-4">
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / 20)}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>

      {/* Add Entry Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Add Ads Income Entry
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({...form, date: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300">Ad Network</label>
                  <select
                    value={form.ad_network}
                    onChange={(e) => setForm({...form, ad_network: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                  >
                    <option value="admob">Google AdMob</option>
                    <option value="unity">Unity Ads</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300">Impressions</label>
                  <input
                    type="number"
                    value={form.impressions}
                    onChange={(e) => setForm({...form, impressions: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300">Clicks</label>
                  <input
                    type="number"
                    value={form.clicks}
                    onChange={(e) => setForm({...form, clicks: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300">eCPM (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.ecpm}
                    onChange={(e) => setForm({...form, ecpm: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Revenue Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.revenue_amount}
                  onChange={(e) => setForm({...form, revenue_amount: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                  placeholder="Enter revenue amount"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Notes</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({...form, notes: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                  placeholder="Optional notes"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleAdd}>
                Add Entry
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminAdsIncome;
