import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import Pagination from '../components/Pagination';
import {
  AlertTriangle, Shield, Eye, CheckCircle, XCircle, 
  RefreshCw, Users, Smartphone, Globe, Clock, Ban,
  Search, Filter, ChevronDown
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminFraudAlerts = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [detecting, setDetecting] = useState(false);
  
  // Action modal
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [actionForm, setActionForm] = useState({
    status: '',
    notes: '',
    action_taken: ''
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchAlerts();
  }, [user, navigate, page, statusFilter]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      let url = `${API}/api/admin/fraud/alerts?page=${page}&limit=20`;
      if (statusFilter) url += `&status=${statusFilter}`;
      
      const response = await axios.get(url);
      setAlerts(response.data.alerts || []);
      setStats(response.data.stats || {});
      setTotal(response.data.total || 0);
    } catch (error) {
      toast.error('Failed to load fraud alerts');
    } finally {
      setLoading(false);
    }
  };

  const runDetection = async () => {
    try {
      setDetecting(true);
      const response = await axios.post(`${API}/api/admin/fraud/detect`);
      toast.success(`Detection complete! ${response.data.alerts_created} new alerts created.`);
      fetchAlerts();
    } catch (error) {
      toast.error('Failed to run fraud detection');
    } finally {
      setDetecting(false);
    }
  };

  const handleAction = async () => {
    if (!actionForm.status) {
      toast.error('Please select a status');
      return;
    }
    
    try {
      await axios.put(`${API}/api/admin/fraud/alert/${selectedAlert.alert_id}`, {
        ...actionForm,
        admin_id: user.uid
      });
      toast.success('Alert updated!');
      setSelectedAlert(null);
      setActionForm({ status: '', notes: '', action_taken: '' });
      fetchAlerts();
    } catch (error) {
      toast.error('Failed to update alert');
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-500/30';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-500/30';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-500/30';
      default: return 'bg-gray-800 text-gray-300 border-gray-700';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'investigating': return 'bg-blue-100 text-blue-700';
      case 'resolved': return 'bg-green-100 text-green-700';
      case 'false_positive': return 'bg-gray-800 text-gray-300';
      default: return 'bg-gray-800 text-gray-300';
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'multiple_accounts_ip': return <Globe className="h-5 w-5" />;
      case 'multiple_accounts_device': return <Smartphone className="h-5 w-5" />;
      case 'abnormal_earning': return <AlertTriangle className="h-5 w-5" />;
      default: return <Shield className="h-5 w-5" />;
    }
  };

  if (loading && alerts.length === 0) {
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
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-red-600" />
            Fraud Detection & Alerts
          </h1>
          <p className="text-sm text-gray-500">Monitor and manage suspicious activities</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAlerts}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button 
            onClick={runDetection} 
            disabled={detecting}
            className="bg-red-600 hover:bg-red-700"
          >
            <Shield className="h-4 w-4 mr-2" />
            {detecting ? 'Scanning...' : 'Run Detection'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card className="p-4 cursor-pointer hover:shadow-md" onClick={() => setStatusFilter('')}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-800 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total_alerts || 0}</p>
              <p className="text-xs text-gray-500">Total Alerts</p>
            </div>
          </div>
        </Card>
        <Card className={`p-4 cursor-pointer hover:shadow-md ${statusFilter === 'pending' ? 'ring-2 ring-yellow-500' : ''}`} onClick={() => setStatusFilter('pending')}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending || 0}</p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
          </div>
        </Card>
        <Card className={`p-4 cursor-pointer hover:shadow-md ${statusFilter === 'investigating' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setStatusFilter('investigating')}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Eye className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.investigating || 0}</p>
              <p className="text-xs text-gray-500">Investigating</p>
            </div>
          </div>
        </Card>
        <Card className={`p-4 cursor-pointer hover:shadow-md ${statusFilter === 'resolved' ? 'ring-2 ring-green-500' : ''}`} onClick={() => setStatusFilter('resolved')}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.resolved || 0}</p>
              <p className="text-xs text-gray-500">Resolved</p>
            </div>
          </div>
        </Card>
        <Card className={`p-4 cursor-pointer hover:shadow-md ${statusFilter === 'false_positive' ? 'ring-2 ring-gray-500' : ''}`} onClick={() => setStatusFilter('false_positive')}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-800 rounded-lg">
              <XCircle className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-400">{stats.false_positive || 0}</p>
              <p className="text-xs text-gray-500">False Positive</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Alerts List */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Alert Queue</h3>
          {statusFilter && (
            <Button variant="outline" size="sm" onClick={() => setStatusFilter('')}>
              Clear Filter
            </Button>
          )}
        </div>
        
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.alert_id}
              className={`p-4 rounded-lg border-l-4 ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${getSeverityColor(alert.severity)}`}>
                    {getAlertIcon(alert.alert_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white">
                        {alert.alert_type?.replace(/_/g, ' ').toUpperCase()}
                      </h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(alert.status)}`}>
                        {alert.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{alert.description}</p>
                    
                    {/* Affected Users */}
                    {alert.affected_users && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                        <Users className="h-4 w-4" />
                        <span>{alert.user_count || alert.affected_users.length} users affected</span>
                      </div>
                    )}
                    
                    {/* IP/Device Info */}
                    {alert.ip_address && (
                      <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                        <Globe className="h-4 w-4" />
                        <span>IP: {alert.ip_address}</span>
                      </div>
                    )}
                    {alert.device_id && (
                      <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                        <Smartphone className="h-4 w-4" />
                        <span>Device: {alert.device_id.slice(0, 20)}...</span>
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedAlert(alert);
                    setActionForm({ status: alert.status, notes: '', action_taken: '' });
                  }}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Review
                </Button>
              </div>
            </div>
          ))}
          
          {alerts.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No fraud alerts found</p>
              <p className="text-sm">Click "Run Detection" to scan for suspicious activities</p>
            </div>
          )}
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

      {/* Action Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-600" />
              Review Alert
            </h3>
            
            <div className="bg-gray-800/50 p-4 rounded-lg mb-4">
              <p className="font-semibold">{selectedAlert.alert_type?.replace(/_/g, ' ')}</p>
              <p className="text-sm text-gray-400 mt-1">{selectedAlert.description}</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300">Update Status</label>
                <select
                  value={actionForm.status}
                  onChange={(e) => setActionForm({...actionForm, status: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                >
                  <option value="pending">Pending</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                  <option value="false_positive">False Positive</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300">Action to Take</label>
                <select
                  value={actionForm.action_taken}
                  onChange={(e) => setActionForm({...actionForm, action_taken: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                >
                  <option value="">No action</option>
                  <option value="warning">Send Warning</option>
                  <option value="freeze_wallet">Freeze Wallet(s)</option>
                  <option value="ban_user">Ban User(s)</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300">Notes</label>
                <textarea
                  value={actionForm.notes}
                  onChange={(e) => setActionForm({...actionForm, notes: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="Add investigation notes..."
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setSelectedAlert(null)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleAction}>
                Update Alert
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminFraudAlerts;
