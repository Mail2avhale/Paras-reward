import React, { useState, useEffect } from 'react';
import { 
  Building2, Search, Filter, RefreshCw, TrendingUp,
  Users, PiggyBank, Clock, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronRight, Calendar, DollarSign,
  ToggleLeft, ToggleRight, Shield, Settings
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminRecurringDeposits = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [rdsData, setRdsData] = useState(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ skip: 0, limit: 20 });
  const [vaultSettings, setVaultSettings] = useState(null);
  const [togglingRedeem, setTogglingRedeem] = useState(false);

  useEffect(() => {
    fetchRds();
    fetchVaultSettings();
  }, [statusFilter, pagination]);

  const fetchVaultSettings = async () => {
    try {
      const response = await fetch(`${API}/admin/savings-vault/settings`);
      const data = await response.json();
      setVaultSettings(data);
    } catch (error) {
      console.error('Error fetching vault settings:', error);
    }
  };

  const toggleRedeemEnabled = async () => {
    setTogglingRedeem(true);
    try {
      const newState = !vaultSettings?.redeem_enabled;
      const response = await fetch(`${API}/admin/savings-vault/toggle-redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_id: user.uid,
          enabled: newState
        })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        setVaultSettings(prev => ({ ...prev, redeem_enabled: newState }));
      } else {
        toast.error(data.detail || 'Failed to toggle');
      }
    } catch (error) {
      toast.error('Failed to toggle redeem status');
    } finally {
      setTogglingRedeem(false);
    }
  };

  const fetchRds = async () => {
    try {
      setLoading(true);
      let url = `${API}/rd/admin/all?skip=${pagination.skip}&limit=${pagination.limit}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setRdsData(data);
      }
    } catch (error) {
      console.error('Error fetching RDs:', error);
      toast.error('Failed to load RD data');
    } finally {
      setLoading(false);
    }
  };

  const processDailyInterest = async () => {
    try {
      const response = await fetch(`${API}/rd/admin/process-daily-interest`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Processed ${data.processed} RDs`);
        fetchRds();
      } else {
        toast.error(data.detail || 'Failed to process');
      }
    } catch (error) {
      toast.error('Failed to process daily interest');
    }
  };

  const checkMaturedRds = async () => {
    try {
      const response = await fetch(`${API}/rd/admin/check-matured`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Found ${data.matured_count} matured RDs`);
        fetchRds();
      } else {
        toast.error(data.detail || 'Failed to check');
      }
    } catch (error) {
      toast.error('Failed to check matured RDs');
    }
  };

  // bulkMigrateLuxury removed - Luxury Life feature deprecated

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN').format(Math.round(amount || 0));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      matured: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      withdrawn: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return styles[status] || styles.closed;
  };

  return (
    <div className="space-y-6">
      {/* Redeem Control Panel */}
      <div className={`rounded-2xl p-5 border ${
        vaultSettings?.redeem_enabled 
          ? 'bg-emerald-500/10 border-emerald-500/30' 
          : 'bg-red-500/10 border-red-500/30'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              vaultSettings?.redeem_enabled ? 'bg-emerald-500/20' : 'bg-red-500/20'
            }`}>
              <Shield className={`w-6 h-6 ${
                vaultSettings?.redeem_enabled ? 'text-emerald-400' : 'text-red-400'
              }`} />
            </div>
            <div>
              <h3 className="text-white font-semibold">Savings Vault Redemption</h3>
              <p className={`text-sm ${
                vaultSettings?.redeem_enabled ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {vaultSettings?.redeem_enabled ? '✓ Users CAN submit redeem requests' : '✕ Users CANNOT submit redeem requests'}
              </p>
              {vaultSettings?.updated_by && (
                <p className="text-gray-500 text-xs mt-1">
                  Last updated by: {vaultSettings.updated_by}
                </p>
              )}
            </div>
          </div>
          
          <button
            onClick={toggleRedeemEnabled}
            disabled={togglingRedeem}
            className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
              togglingRedeem 
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : vaultSettings?.redeem_enabled
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }`}
            data-testid="toggle-redeem-btn"
          >
            {togglingRedeem ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : vaultSettings?.redeem_enabled ? (
              <ToggleRight className="w-5 h-5" />
            ) : (
              <ToggleLeft className="w-5 h-5" />
            )}
            {vaultSettings?.redeem_enabled ? 'Disable Redeem' : 'Enable Redeem'}
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-7 h-7 text-emerald-400" />
            PRC Savings Vault
          </h1>
          <p className="text-gray-400 text-sm mt-1">Manage all user RD accounts</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={processDailyInterest}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white text-sm font-medium flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Process Interest
          </button>
          <button
            onClick={checkMaturedRds}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg text-white text-sm font-medium flex items-center gap-2"
          >
            <Clock className="w-4 h-4" />
            Check Matured
          </button>
          {/* Migrate All Luxury button removed - feature deprecated */}
          <button
            onClick={fetchRds}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {rdsData?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm">Active Savings</span>
            </div>
            <p className="text-2xl font-bold text-white">{rdsData.stats.total_active}</p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <Clock className="w-5 h-5" />
              <span className="text-sm">Completed</span>
            </div>
            <p className="text-2xl font-bold text-white">{rdsData.stats.total_matured}</p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <PiggyBank className="w-5 h-5" />
              <span className="text-sm">Redeemed</span>
            </div>
            <p className="text-2xl font-bold text-white">{rdsData.stats.total_withdrawn}</p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm">Total Deposited</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(rdsData.stats.total_deposited)} PRC</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="matured">Matured</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* RD Table */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">RD ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Tenure</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Deposited</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Interest</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Current Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Maturity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : !rdsData?.rds?.length ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-400">
                    No RDs found
                  </td>
                </tr>
              ) : (
                rdsData.rds.map((rd) => (
                  <tr key={rd.rd_id} className="hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-emerald-400">{rd.rd_id}</span>
                      {rd.migrated_from_luxury && (
                        <span className="ml-2 text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                          Migrated
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-white">{rd.user_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{rd.user_id?.slice(0, 12)}...</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-white">{rd.tenure_months} months</p>
                      <p className="text-xs text-emerald-400">{rd.interest_rate}% p.a.</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-white font-medium">{formatCurrency(rd.total_deposited)} PRC</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-emerald-400">+{formatCurrency(rd.interest_earned)} PRC</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-white font-bold">{formatCurrency(rd.current_value)} PRC</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-300">{formatDate(rd.maturity_date)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(rd.status)}`}>
                        {rd.status?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {rdsData?.pagination && (
          <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Showing {pagination.skip + 1} - {Math.min(pagination.skip + pagination.limit, rdsData.pagination.total)} of {rdsData.pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination({ ...pagination, skip: Math.max(0, pagination.skip - pagination.limit) })}
                disabled={pagination.skip === 0}
                className="px-3 py-1 bg-gray-800 rounded text-sm text-gray-300 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination({ ...pagination, skip: pagination.skip + pagination.limit })}
                disabled={pagination.skip + pagination.limit >= rdsData.pagination.total}
                className="px-3 py-1 bg-gray-800 rounded text-sm text-gray-300 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/30">
        <h3 className="text-emerald-400 font-semibold mb-2">Admin Actions</h3>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• <strong>Process Interest:</strong> Calculate and update daily interest for all active RDs (run daily)</li>
          <li>• <strong>Check Matured:</strong> Find and notify users about matured RDs (run daily)</li>
          <li>• Interest rates: 6M-7.5%, 1Y-8.5%, 2Y-9%, 3Y-9.25%</li>
          <li>• Premature withdrawal penalty: 3%</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminRecurringDeposits;
