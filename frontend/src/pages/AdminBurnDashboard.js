import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Flame, Users, TrendingDown, AlertTriangle, 
  RefreshCw, BarChart3, Clock, ArrowLeft, Zap, CheckCircle
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const API = process.env.REACT_APP_BACKEND_URL || '';

const AdminBurnDashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [burning, setBurning] = useState(false);
  const [stats, setStats] = useState({
    total_burned: 0,
    free_user_burned: 0,
    expired_vip_burned: 0,
    users_affected: 0,
    recent_burns: []
  });
  const [atRisk, setAtRisk] = useState({
    free_users_at_risk: [],
    expired_vips_at_risk: []
  });

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchBurnStatistics();
    fetchUsersAtRisk();
  }, [user]);

  const fetchBurnStatistics = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/admin/burn-statistics`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching burn stats:', error);
      toast.error('Failed to load burn statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersAtRisk = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/users-at-risk`);
      setAtRisk(response.data);
    } catch (error) {
      console.error('Error fetching at-risk users:', error);
    }
  };

  const triggerBurnNow = async () => {
    if (!window.confirm('Are you sure you want to run the PRC burn job now? This will burn expired PRC for free users and expired VIPs.')) {
      return;
    }

    setBurning(true);
    try {
      const response = await axios.post(`${API}/api/admin/burn-prc-now`);
      toast.success('Burn job completed successfully!', {
        description: `Free: ${response.data.results.free_users.users_affected} users, VIP: ${response.data.results.expired_vips.users_affected} users affected`
      });
      
      // Refresh statistics
      await fetchBurnStatistics();
      await fetchUsersAtRisk();
    } catch (error) {
      console.error('Error running burn job:', error);
      toast.error('Failed to run burn job');
    } finally {
      setBurning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-400">Loading burn statistics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">
      {/* Header */}
      <div className="bg-gray-900 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Admin Dashboard</span>
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Flame className="w-8 h-8 text-orange-600" />
                PRC Burn Management
              </h1>
              <p className="text-gray-400 mt-2">Monitor and manage PRC burn operations</p>
            </div>
            
            <Button
              onClick={triggerBurnNow}
              disabled={burning}
              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
            >
              {burning ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Running Burn...
                </>
              ) : (
                <>
                  <Flame className="w-4 h-4 mr-2" />
                  Run Burn Job Now
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Burned */}
          <Card className="p-6 bg-gradient-to-br from-red-50 to-orange-50">
            <Flame className="w-10 h-10 text-red-600 mb-3" />
            <p className="text-sm text-red-600 font-semibold mb-1">Total PRC Burned</p>
            <p className="text-3xl font-bold text-red-900">
              {stats.total_burned.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              ≈ ₹{(stats.total_burned / 10).toFixed(2)}
            </p>
          </Card>

          {/* Free User Burned */}
          <Card className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50">
            <Users className="w-10 h-10 text-orange-600 mb-3" />
            <p className="text-sm text-orange-600 font-semibold mb-1">Free Users (48h)</p>
            <p className="text-3xl font-bold text-orange-900">
              {stats.free_user_burned.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              PRC burned after expiry
            </p>
          </Card>

          {/* Expired VIP Burned */}
          <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50">
            <Zap className="w-10 h-10 text-purple-600 mb-3" />
            <p className="text-sm text-purple-600 font-semibold mb-1">Expired VIPs (5d)</p>
            <p className="text-3xl font-bold text-purple-900">
              {stats.expired_vip_burned.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              PRC burned after grace period
            </p>
          </Card>

          {/* Users Affected */}
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
            <TrendingDown className="w-10 h-10 text-blue-600 mb-3" />
            <p className="text-sm text-blue-600 font-semibold mb-1">Users Affected</p>
            <p className="text-3xl font-bold text-blue-900">
              {stats.users_affected}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              With burned PRC
            </p>
          </Card>
        </div>

        {/* At Risk Users */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Free Users At Risk */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
                Free Users At Risk
              </h2>
              <span className="text-sm text-gray-400">
                {atRisk.free_users_at_risk.length} users
              </span>
            </div>
            
            <p className="text-sm text-gray-400 mb-4">
              Users with PRC expiring in less than 12 hours
            </p>

            {atRisk.free_users_at_risk.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No users at immediate risk</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {atRisk.free_users_at_risk.slice(0, 10).map((user, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div>
                      <p className="font-semibold text-white">{user.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-yellow-700">
                        {user.at_risk_prc.toFixed(2)} PRC
                      </p>
                      <p className="text-xs text-yellow-600">⏰ Expiring soon</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Expired VIPs At Risk */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Zap className="w-6 h-6 text-purple-600" />
                Expired VIPs (Grace Period)
              </h2>
              <span className="text-sm text-gray-400">
                {atRisk.expired_vips_at_risk.length} users
              </span>
            </div>
            
            <p className="text-sm text-gray-400 mb-4">
              Expired VIPs in 5-day grace period before PRC burn
            </p>

            {atRisk.expired_vips_at_risk.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No expired VIPs in grace period</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {atRisk.expired_vips_at_risk.map((user, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div>
                      <p className="font-semibold text-white">{user.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                      <p className="text-xs text-purple-600 mt-1">
                        Expired {user.days_expired} days ago
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-purple-700">
                        {user.prc_balance.toFixed(2)} PRC
                      </p>
                      <p className="text-xs text-red-600">
                        🔥 Burns in {user.days_until_burn} days
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Recent Burns */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-gray-300" />
              Recent Burn Transactions
            </h2>
            <Button
              onClick={fetchBurnStatistics}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {stats.recent_burns.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Flame className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No burn transactions yet</p>
              <p className="text-sm">Burn transactions will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recent_burns.map((burn, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${
                      burn.transaction_type === 'prc_burn_free_user'
                        ? 'bg-orange-100 text-orange-600'
                        : 'bg-purple-100 text-purple-600'
                    }`}>
                      <Flame className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">
                        {burn.transaction_type === 'prc_burn_free_user' 
                          ? 'Free User Burn (48h)' 
                          : 'Expired VIP Burn (5d)'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(burn.timestamp).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        User: {burn.user_email || burn.user_id}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-600">
                      -{burn.prc_amount?.toFixed(2) || '0.00'} PRC
                    </p>
                    <p className="text-xs text-gray-400">
                      Balance: {burn.prc_balance_after?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Info Box */}
        <Card className="p-6 mt-6 bg-blue-50 border-blue-200">
          <h3 className="font-bold text-blue-900 mb-2">ℹ️ Burn System Information</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Free Users:</strong> PRC burns after 48 hours (FIFO - First In First Out)</li>
            <li>• <strong>VIP Users:</strong> PRC has lifetime validity (never burns while VIP active)</li>
            <li>• <strong>Expired VIP:</strong> Marketplace blocked immediately, PRC burns after 5-day grace period</li>
            <li>• <strong>Burn Job:</strong> Should run hourly or daily via scheduled task</li>
            <li>• <strong>Manual Trigger:</strong> Use "Run Burn Job Now" button to execute immediately</li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default AdminBurnDashboard;
