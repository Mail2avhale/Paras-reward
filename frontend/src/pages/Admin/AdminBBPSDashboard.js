import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  RefreshCw, Search, Filter, Download, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, AlertCircle, Loader2,
  Smartphone, Tv, Zap, Flame, Building, Droplet, Wifi, PhoneCall,
  CreditCard, Shield, Car, GraduationCap, Monitor, Landmark, Cylinder,
  TrendingUp, TrendingDown, Activity, Eye, Copy
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Service icons mapping
const SERVICE_ICONS = {
  mobile_recharge: Smartphone,
  mobile_postpaid: Smartphone,
  dth: Tv,
  electricity: Zap,
  gas: Flame,
  water: Droplet,
  broadband: Wifi,
  landline: PhoneCall,
  cable_tv: Monitor,
  emi: Building,
  credit_card: CreditCard,
  insurance: Shield,
  fastag: Car,
  education: GraduationCap,
  municipal_tax: Landmark,
  lpg: Cylinder
};

// Status colors and icons
const STATUS_CONFIG = {
  pending: { color: 'yellow', icon: Clock, label: 'Pending' },
  processing: { color: 'blue', icon: Loader2, label: 'Processing' },
  completed: { color: 'green', icon: CheckCircle, label: 'Completed' },
  failed: { color: 'red', icon: XCircle, label: 'Failed' },
  rejected: { color: 'gray', icon: AlertCircle, label: 'Rejected' },
  refunded: { color: 'orange', icon: RefreshCw, label: 'Refunded' },
  eko_failed: { color: 'red', icon: XCircle, label: 'Failed' }
};

const AdminBBPSDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    status: '',
    service_type: '',
    search: '',
    from_date: '',
    to_date: ''
  });

  // Fetch BBPS requests
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit
      });
      
      if (filters.status) params.append('status', filters.status);
      if (filters.service_type) params.append('service_type', filters.service_type);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      
      const response = await axios.get(`${API}/redeem/admin/bbps-requests?${params}`);
      
      if (response.data.success) {
        setRequests(response.data.requests || []);
        setStats(response.data.stats || {});
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination?.total || 0,
          pages: response.data.pagination?.pages || 1
        }));
      }
    } catch (error) {
      console.error('Error fetching BBPS requests:', error);
      toast.error('Failed to load BBPS requests');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // View request details
  const viewRequestDetails = async (requestId) => {
    try {
      const response = await axios.get(`${API}/redeem/admin/bbps-request/${requestId}`);
      if (response.data.success) {
        setSelectedRequest(response.data);
        setShowDetailModal(true);
      }
    } catch (error) {
      toast.error('Failed to load request details');
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // Service name formatter
  const formatServiceName = (type) => {
    const names = {
      mobile_recharge: 'Mobile Recharge',
      mobile_postpaid: 'Mobile Postpaid',
      dth: 'DTH',
      electricity: 'Electricity',
      gas: 'Gas',
      water: 'Water',
      broadband: 'Broadband',
      landline: 'Landline',
      cable_tv: 'Cable TV',
      emi: 'EMI',
      credit_card: 'Credit Card',
      insurance: 'Insurance',
      fastag: 'FASTag',
      education: 'Education',
      municipal_tax: 'Municipal Tax',
      lpg: 'LPG'
    };
    return names[type] || type;
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="h-7 w-7 text-amber-400" />
            BBPS Instant Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-1">Monitor all instant BBPS transactions</p>
        </div>
        <Button
          onClick={fetchRequests}
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {/* Total */}
        <Card className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/30 flex items-center justify-center">
              <Activity className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-slate-500 text-xs">Total</p>
              <p className="text-xl font-bold text-slate-800">{pagination.total}</p>
            </div>
          </div>
        </Card>
        
        {/* Completed */}
        <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/30 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-slate-500 text-xs">Success</p>
              <p className="text-xl font-bold text-green-400">
                {stats.by_status?.completed?.count || 0}
              </p>
            </div>
          </div>
        </Card>
        
        {/* Failed */}
        <Card className="bg-gradient-to-br from-red-500/20 to-rose-500/20 border-red-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/30 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-slate-500 text-xs">Failed</p>
              <p className="text-xl font-bold text-red-400">
                {stats.by_status?.failed?.count || 0}
              </p>
            </div>
          </div>
        </Card>
        
        {/* Pending */}
        <Card className="bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border-yellow-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/30 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-slate-500 text-xs">Pending</p>
              <p className="text-xl font-bold text-yellow-400">
                {stats.by_status?.pending?.count || 0}
              </p>
            </div>
          </div>
        </Card>
        
        {/* Total Amount */}
        <Card className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/30 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-slate-500 text-xs">Total Amount</p>
              <p className="text-lg font-bold text-purple-400">
                ₹{(stats.total_amount || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white/50 border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="h-10 px-3 bg-white border border-slate-200 text-slate-800 rounded-lg text-sm"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="rejected">Rejected</option>
          </select>
          
          {/* Service Type Filter */}
          <select
            value={filters.service_type}
            onChange={(e) => setFilters(prev => ({ ...prev, service_type: e.target.value }))}
            className="h-10 px-3 bg-white border border-slate-200 text-slate-800 rounded-lg text-sm"
          >
            <option value="">All Services</option>
            <option value="mobile_recharge">Mobile Recharge</option>
            <option value="dth">DTH</option>
            <option value="electricity">Electricity</option>
            <option value="gas">Gas</option>
            <option value="water">Water</option>
            <option value="broadband">Broadband</option>
            <option value="emi">EMI</option>
            <option value="credit_card">Credit Card</option>
            <option value="insurance">Insurance</option>
            <option value="fastag">FASTag</option>
            <option value="education">Education</option>
            <option value="lpg">LPG</option>
          </select>
          
          {/* Date Filters */}
          <Input
            type="date"
            value={filters.from_date}
            onChange={(e) => setFilters(prev => ({ ...prev, from_date: e.target.value }))}
            className="h-10 w-40 bg-white border-slate-200 text-slate-800"
            placeholder="From Date"
          />
          <Input
            type="date"
            value={filters.to_date}
            onChange={(e) => setFilters(prev => ({ ...prev, to_date: e.target.value }))}
            className="h-10 w-40 bg-white border-slate-200 text-slate-800"
            placeholder="To Date"
          />
          
          <Button
            onClick={() => {
              setPagination(prev => ({ ...prev, page: 1 }));
              fetchRequests();
            }}
            className="h-10 bg-blue-600 hover:bg-blue-700"
          >
            <Filter className="h-4 w-4 mr-2" />
            Apply
          </Button>
          
          <Button
            onClick={() => {
              setFilters({ status: '', service_type: '', search: '', from_date: '', to_date: '' });
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            variant="outline"
            className="h-10 border-slate-200 text-slate-500 hover:text-slate-800"
          >
            Clear
          </Button>
        </div>
      </Card>

      {/* Service-wise Stats */}
      <Card className="bg-white/50 border-slate-200 p-4 mb-6">
        <h3 className="text-sm font-semibold text-slate-500 mb-3">Service-wise Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {Object.entries(stats.by_service || {}).map(([service, serviceStats]) => {
            const Icon = SERVICE_ICONS[service] || Activity;
            const successRate = serviceStats.success_rate || 0;
            
            return (
              <div
                key={service}
                className={`p-3 rounded-xl border ${
                  successRate > 50 ? 'border-green-500/30 bg-green-500/10' :
                  successRate > 0 ? 'border-yellow-500/30 bg-yellow-500/10' :
                  'border-red-500/30 bg-red-500/10'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-800 truncate">
                    {formatServiceName(service)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-slate-800">{serviceStats.total}</span>
                  <span className={`text-xs font-medium ${
                    successRate > 50 ? 'text-green-400' :
                    successRate > 0 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {successRate}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Requests Table */}
      <Card className="bg-white/50 border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-white/50">
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Request ID</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Service</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">User</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Amount</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Status</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Eko TID</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Date</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-400" />
                    <p className="text-slate-500 mt-2">Loading...</p>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-500">
                    No requests found
                  </td>
                </tr>
              ) : (
                requests.map((req) => {
                  const statusConfig = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusConfig.icon;
                  const ServiceIcon = SERVICE_ICONS[req.service_type] || Activity;
                  
                  return (
                    <tr key={req.request_id} className="border-b border-slate-200/50 hover:bg-slate-50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-slate-800">
                            {req.request_id?.slice(0, 12)}...
                          </span>
                          <button
                            onClick={() => copyToClipboard(req.request_id)}
                            className="text-slate-500 hover:text-slate-800"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <ServiceIcon className="h-4 w-4 text-slate-500" />
                          <span className="text-sm text-slate-800">
                            {formatServiceName(req.service_type)}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div>
                          <span className="text-sm text-slate-800 block">{req.user_name || 'N/A'}</span>
                          <span className="text-xs text-slate-500">({req.user_mobile || req.user_email || req.user_id})</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-sm font-semibold text-amber-400">
                          ₹{(req.amount || req.details?.amount || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          req.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          req.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          req.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-slate-500'
                        }`}>
                          <StatusIcon className={`h-3 w-3 ${req.status === 'processing' ? 'animate-spin' : ''}`} />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="p-3">
                        {req.eko_tid ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-green-400">{req.eko_tid}</span>
                            <button
                              onClick={() => copyToClipboard(req.eko_tid)}
                              className="text-slate-500 hover:text-slate-800"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-slate-500">{formatDate(req.created_at)}</span>
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => viewRequestDetails(req.request_id)}
                          className="h-8 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200">
          <span className="text-sm text-slate-500">
            Showing {requests.length} of {pagination.total} requests
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page <= 1}
              className="border-slate-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-500">
              Page {pagination.page} of {pagination.pages || 1}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page >= pagination.pages}
              className="border-slate-200"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800">Request Details</h2>
                <Button
                  variant="ghost"
                  onClick={() => setShowDetailModal(false)}
                  className="text-slate-500 hover:text-slate-800"
                >
                  ✕
                </Button>
              </div>
              
              {/* Request Info */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-1">Request ID</p>
                    <p className="text-sm font-mono text-slate-800">{selectedRequest.request?.request_id}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-1">Service</p>
                    <p className="text-sm text-slate-800">{formatServiceName(selectedRequest.request?.service_type)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-1">Amount</p>
                    <p className="text-lg font-bold text-amber-400">₹{selectedRequest.request?.amount?.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-1">Status</p>
                    <p className={`text-sm font-medium ${
                      selectedRequest.request?.status === 'completed' ? 'text-green-400' :
                      selectedRequest.request?.status === 'failed' ? 'text-red-400' :
                      'text-yellow-400'
                    }`}>{selectedRequest.request?.status?.toUpperCase()}</p>
                  </div>
                </div>
                
                {/* User Info */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-2">User</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-slate-500">Name:</span> <span className="text-slate-800">{selectedRequest.user?.name || 'N/A'}</span></div>
                    <div><span className="text-slate-500">Email:</span> <span className="text-slate-800">{selectedRequest.user?.email || 'N/A'}</span></div>
                    <div><span className="text-slate-500">Mobile:</span> <span className="text-slate-800">{selectedRequest.user?.mobile || 'N/A'}</span></div>
                    <div><span className="text-slate-500">Plan:</span> <span className="text-slate-800">{selectedRequest.user?.subscription_plan || 'N/A'}</span></div>
                  </div>
                </div>
                
                {/* Eko Details */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-2">Eko Transaction Details</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">TID:</span>
                      <span className="text-green-400 font-mono">{selectedRequest.eko_details?.tid || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">UTR:</span>
                      <span className="text-slate-800 font-mono">{selectedRequest.eko_details?.utr || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status:</span>
                      <span className="text-slate-800">{selectedRequest.eko_details?.status || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Message:</span>
                      <span className="text-slate-800">{selectedRequest.eko_details?.message || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                
                {/* Refund Info */}
                {selectedRequest.refund_info?.refunded && (
                  <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl p-4">
                    <p className="text-xs text-orange-400 mb-2">Refund Info</p>
                    <p className="text-lg font-bold text-orange-400">
                      {selectedRequest.refund_info.amount} PRC Refunded
                    </p>
                  </div>
                )}
                
                {/* Error Message */}
                {selectedRequest.request?.error_message && (
                  <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4">
                    <p className="text-xs text-red-400 mb-2">Error</p>
                    <p className="text-sm text-red-300">{selectedRequest.request.error_message}</p>
                  </div>
                )}
                
                {/* Request Details */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-2">Service Details</p>
                  <pre className="text-xs text-slate-600 overflow-x-auto">
                    {JSON.stringify(selectedRequest.request?.details, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBBPSDashboard;
