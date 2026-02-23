import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Users, CheckCircle, XCircle, RefreshCw, BarChart3,
  TrendingUp, Calendar, Award, Shield
} from 'lucide-react';
import { Button } from '../components/ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminPerformanceReport = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [dateRange, setDateRange] = useState('all'); // all, week, month
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchReport();
  }, [dateRange, dateFrom, dateTo]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        params.append('date_from', weekAgo.toISOString().split('T')[0]);
      } else if (dateRange === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        params.append('date_from', monthAgo.toISOString().split('T')[0]);
      } else if (dateFrom) {
        params.append('date_from', dateFrom);
      }
      if (dateTo) {
        params.append('date_to', dateTo);
      }

      const url = `${API}/admin/performance-report${params.toString() ? '?' + params.toString() : ''}`;
      console.log('Fetching:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      console.log('Report data:', data);
      
      if (data && (data.success || data.admins)) {
        setReport(data);
      } else {
        setReport({ admins: [], summary: { total_admins: 0, total_approved: 0, total_rejected: 0, total_processed: 0 }, by_category: {} });
        toast.error('No data returned from server');
      }
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('Failed to load: ' + error.message);
      setReport({ admins: [], summary: { total_admins: 0, total_approved: 0, total_rejected: 0, total_processed: 0 }, by_category: {} });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getPerformanceColor = (approved, rejected) => {
    const total = approved + rejected;
    if (total === 0) return 'text-gray-400';
    const ratio = approved / total;
    if (ratio >= 0.8) return 'text-green-400';
    if (ratio >= 0.5) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="p-6" data-testid="admin-performance-report">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-purple-400" />
            Admin Performance Report
          </h1>
          <p className="text-gray-400 text-sm mt-1">Track which admin approved/rejected requests</p>
        </div>
        <Button onClick={fetchReport} variant="outline" className="gap-2" data-testid="refresh-btn">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Date Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex gap-2">
          {['all', 'week', 'month'].map((range) => (
            <button
              key={range}
              onClick={() => { setDateRange(range); setDateFrom(''); setDateTo(''); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                dateRange === range
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              data-testid={`filter-${range}`}
            >
              {range === 'all' ? 'All Time' : range === 'week' ? 'Last 7 Days' : 'Last 30 Days'}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setDateRange('custom'); }}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setDateRange('custom'); }}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400 text-sm">Loading report...</p>
        </div>
      ) : !report || (!report.admins?.length && !report.summary?.total_processed) ? (
        <div className="text-center py-12 bg-gray-900/50 rounded-2xl border border-gray-800">
          <BarChart3 className="h-16 w-16 mx-auto text-gray-700 mb-4" />
          <p className="text-gray-500 mb-2">No admin activity found</p>
          <p className="text-gray-600 text-sm">Try selecting "All Time" filter</p>
          <Button onClick={fetchReport} variant="outline" className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-purple-400" />
                <span className="text-purple-400 text-sm">Total Admins</span>
              </div>
              <p className="text-3xl font-bold text-white">{report.summary?.total_admins || 0}</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-green-400 text-sm">Total Approved</span>
              </div>
              <p className="text-3xl font-bold text-white">{report.summary?.total_approved || 0}</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-5 w-5 text-red-400" />
                <span className="text-red-400 text-sm">Total Rejected</span>
              </div>
              <p className="text-3xl font-bold text-white">{report.summary?.total_rejected || 0}</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-blue-400" />
                <span className="text-blue-400 text-sm">Total Processed</span>
              </div>
              <p className="text-3xl font-bold text-white">{report.summary?.total_processed || 0}</p>
            </div>
          </div>

          {/* Admin Performance Table */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-400" />
                Admin-wise Performance
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Admin Name</th>
                    <th className="text-center px-4 py-3 text-gray-400 text-sm font-medium">
                      <div className="flex items-center justify-center gap-1">
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        Approved
                      </div>
                    </th>
                    <th className="text-center px-4 py-3 text-gray-400 text-sm font-medium">
                      <div className="flex items-center justify-center gap-1">
                        <XCircle className="h-4 w-4 text-red-400" />
                        Rejected
                      </div>
                    </th>
                    <th className="text-center px-4 py-3 text-gray-400 text-sm font-medium">Total</th>
                    <th className="text-center px-4 py-3 text-gray-400 text-sm font-medium">Approval Rate</th>
                    <th className="text-center px-4 py-3 text-gray-400 text-sm font-medium">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {report.admins?.map((admin, index) => {
                    const total = admin.approved + admin.rejected;
                    const approvalRate = total > 0 ? ((admin.approved / total) * 100).toFixed(1) : 0;
                    return (
                      <tr key={admin.admin_uid || index} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                              <Shield className="h-5 w-5 text-purple-400" />
                            </div>
                            <div>
                              <p className="text-white font-medium">{admin.admin_name || 'Unknown Admin'}</p>
                              <p className="text-gray-500 text-xs">{admin.admin_uid || '-'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full font-bold">
                            {admin.approved}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full font-bold">
                            {admin.rejected}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-white font-semibold">{total}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`font-bold ${getPerformanceColor(admin.approved, admin.rejected)}`}>
                            {approvalRate}%
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-gray-400 text-sm">
                          {formatDate(admin.last_processed_at)}
                        </td>
                      </tr>
                    );
                  })}
                  {(!report.admins || report.admins.length === 0) && (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                        No admin activity found for the selected period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category-wise Breakdown */}
          {report.by_category && Object.keys(report.by_category).length > 0 && (
            <div className="mt-6 bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-400" />
                  Category-wise Breakdown
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {Object.entries(report.by_category).map(([category, data]) => (
                  <div key={category} className="bg-gray-800/50 rounded-xl p-4">
                    <h3 className="text-white font-medium mb-3 capitalize">
                      {category.replace(/_/g, ' ')}
                    </h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <span className="text-green-400 font-bold">{data.approved}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-400" />
                        <span className="text-red-400 font-bold">{data.rejected}</span>
                      </div>
                      <div className="text-gray-400 text-sm">
                        Total: {data.approved + data.rejected}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminPerformanceReport;
