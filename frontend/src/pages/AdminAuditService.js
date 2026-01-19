import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Pagination from '@/components/Pagination';
import {
  Shield, Search, Filter, RefreshCw, AlertTriangle, CheckCircle,
  Clock, User, Eye, Download, FileText, Activity, AlertCircle,
  ChevronDown, Calendar, Users, Settings, Database, Lock
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminAuditService = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [suspicious, setSuspicious] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [filters, setFilters] = useState({
    action_type: '',
    severity: '',
    user_id: '',
    search: '',
    start_date: '',
    end_date: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchLogs();
    fetchAlerts();
  }, [currentPage, filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
      });
      
      const response = await axios.get(`${API}/admin/audit/comprehensive?${params}`);
      setLogs(response.data.logs || []);
      setStats(response.data.stats);
      setSuspicious(response.data.suspicious_activities || []);
      setTotal(response.data.total || 0);
      setTotalPages(response.data.pages || 1);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await axios.get(`${API}/admin/audit/alerts`);
      setAlerts(response.data.alerts || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const markAlertRead = async (alertId) => {
    try {
      await axios.post(`${API}/admin/audit/alerts/${alertId}/read`);
      fetchAlerts();
      toast.success('Alert marked as read');
    } catch (error) {
      toast.error('Failed to mark alert');
    }
  };

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Action', 'User', 'Details', 'Severity', 'IP Address'].join(','),
      ...logs.map(log => [
        log.timestamp,
        log.action_type,
        log.admin_email || log.target_user_email || '-',
        `"${(log.details || '').replace(/"/g, '""')}"`,
        log.severity || 'normal',
        log.ip_address || '-'
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getSeverityBadge = (severity) => {
    const badges = {
      critical: 'bg-red-100 text-red-400 border-red-500/30',
      high: 'bg-orange-100 text-orange-400 border-orange-500/30',
      normal: 'bg-blue-100 text-blue-400 border-blue-500/30',
      low: 'bg-gray-100 text-gray-300 border-gray-700'
    };
    return badges[severity] || badges.normal;
  };

  const getActionIcon = (action) => {
    if (action?.includes('login')) return <User className="h-4 w-4" />;
    if (action?.includes('payment') || action?.includes('vip')) return <CheckCircle className="h-4 w-4" />;
    if (action?.includes('delete') || action?.includes('burn')) return <AlertTriangle className="h-4 w-4" />;
    if (action?.includes('update') || action?.includes('edit')) return <Settings className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-7 w-7 text-purple-600" />
            Audit Service
          </h1>
          <p className="text-gray-500">Track all system activities and changes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowFilters(!showFilters)} variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" /> Filters
          </Button>
          <Button onClick={exportLogs} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button onClick={fetchLogs} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <Card className="p-4 bg-red-500/10 border-red-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <div>
                <p className="font-semibold text-red-400">{alerts.length} Unread Alerts</p>
                <p className="text-sm text-red-600">{alerts[0]?.message}</p>
              </div>
            </div>
            <Button size="sm" variant="destructive" onClick={() => markAlertRead(alerts[0]?.alert_id)}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{total.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Total Logs</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{suspicious.length}</p>
                <p className="text-xs text-gray-500">Suspicious</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.action_types?.length || 0}</p>
                <p className="text-xs text-gray-500">Action Types</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{alerts.length}</p>
                <p className="text-xs text-gray-500">Pending Alerts</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="text-xs text-gray-500">Search</label>
              <Input
                placeholder="Search..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Action Type</label>
              <select
                className="w-full px-3 py-2 border rounded-lg"
                value={filters.action_type}
                onChange={(e) => setFilters({...filters, action_type: e.target.value})}
              >
                <option value="">All Actions</option>
                {stats?.action_types?.map(at => (
                  <option key={at.type} value={at.type}>{at.type} ({at.count})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Severity</label>
              <select
                className="w-full px-3 py-2 border rounded-lg"
                value={filters.severity}
                onChange={(e) => setFilters({...filters, severity: e.target.value})}
              >
                <option value="">All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">User ID</label>
              <Input
                placeholder="User ID..."
                value={filters.user_id}
                onChange={(e) => setFilters({...filters, user_id: e.target.value})}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Start Date</label>
              <Input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({...filters, start_date: e.target.value})}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">End Date</label>
              <Input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({...filters, end_date: e.target.value})}
              />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setFilters({action_type: '', severity: '', user_id: '', search: '', start_date: '', end_date: ''})}
            >
              Clear Filters
            </Button>
          </div>
        </Card>
      )}

      {/* Suspicious Activities */}
      {suspicious.length > 0 && (
        <Card className="p-4 border-red-500/30">
          <h3 className="font-bold text-red-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Recent Suspicious Activities
          </h3>
          <div className="space-y-2">
            {suspicious.slice(0, 5).map((log, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
                <div className="flex items-center gap-3">
                  {getActionIcon(log.action_type)}
                  <div>
                    <p className="font-medium text-sm">{log.action_type}</p>
                    <p className="text-xs text-gray-500">{log.admin_email || log.target_user_email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityBadge(log.severity)}`}>
                    {log.severity}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Logs Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Timestamp</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Action</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">User/Admin</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Details</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Severity</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    No audit logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.log_id} className="border-b hover:bg-gray-800/50">
                    <td className="py-3 px-4 text-sm">
                      <p className="font-medium">{new Date(log.timestamp).toLocaleDateString()}</p>
                      <p className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action_type)}
                        <span className="text-sm font-medium">{log.action_type}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <p>{log.admin_email || log.target_user_email || '-'}</p>
                      {log.ip_address && <p className="text-xs text-gray-500">IP: {log.ip_address}</p>}
                    </td>
                    <td className="py-3 px-4 text-sm max-w-xs truncate" title={log.details}>
                      {log.details || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityBadge(log.severity)}`}>
                        {log.severity || 'normal'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedLog(log)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={total}
            itemsPerPage={20}
            onPageChange={setCurrentPage}
          />
        </div>
      </Card>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Audit Log Details</h2>
                <button onClick={() => setSelectedLog(null)} className="text-gray-500 hover:text-gray-300">✕</button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Log ID</p>
                    <p className="font-mono text-sm">{selectedLog.log_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Timestamp</p>
                    <p className="text-sm">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Action Type</p>
                    <p className="text-sm font-medium">{selectedLog.action_type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Severity</p>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityBadge(selectedLog.severity)}`}>
                      {selectedLog.severity || 'normal'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Admin</p>
                    <p className="text-sm">{selectedLog.admin_email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Target User</p>
                    <p className="text-sm">{selectedLog.target_user_email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">IP Address</p>
                    <p className="text-sm font-mono">{selectedLog.ip_address || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Entity</p>
                    <p className="text-sm">{selectedLog.entity_type}: {selectedLog.entity_id || '-'}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-xs text-gray-500">Details</p>
                  <p className="text-sm p-3 bg-gray-800/50 rounded-lg">{selectedLog.details || 'No details'}</p>
                </div>
                
                {selectedLog.old_value && (
                  <div>
                    <p className="text-xs text-gray-500">Old Value</p>
                    <pre className="text-xs p-3 bg-red-500/10 rounded-lg overflow-auto">
                      {JSON.stringify(selectedLog.old_value, null, 2)}
                    </pre>
                  </div>
                )}
                
                {selectedLog.new_value && (
                  <div>
                    <p className="text-xs text-gray-500">New Value</p>
                    <pre className="text-xs p-3 bg-green-500/10 rounded-lg overflow-auto">
                      {JSON.stringify(selectedLog.new_value, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminAuditService;
