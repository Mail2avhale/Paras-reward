import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { 
  Shield, Clock, MapPin, Smartphone, Monitor, Globe,
  ChevronRight, AlertCircle, CheckCircle, History,
  Laptop, Tablet
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const SecurityInfo = ({ userId }) => {
  const [securityInfo, setSecurityInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const fetchSecurityInfo = async () => {
      try {
        const response = await axios.get(`${API}/user/security-info/${userId}`);
        setSecurityInfo(response.data);
      } catch (error) {
        console.error('Error fetching security info:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchSecurityInfo();
    }
  }, [userId]);

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getDeviceIcon = (device) => {
    switch (device?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="h-4 w-4" />;
      case 'tablet':
        return <Tablet className="h-4 w-4" />;
      case 'desktop':
        return <Monitor className="h-4 w-4" />;
      default:
        return <Laptop className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <Card className="p-4 bg-gray-900/50 border-gray-800 animate-pulse">
        <div className="h-20 bg-gray-800 rounded"></div>
      </Card>
    );
  }

  if (!securityInfo) {
    return null;
  }

  return (
    <Card className="p-4 bg-gradient-to-br from-gray-900/50 to-gray-800/30 border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
            <Shield className="h-4 w-4 text-green-400" />
          </div>
          <h3 className="font-semibold text-white text-sm">Security Status</h3>
        </div>
        <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Secure
        </span>
      </div>

      {/* Last Login Info */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-blue-400" />
            <div>
              <p className="text-xs text-gray-400">Last Login</p>
              <p className="text-sm text-white font-medium">
                {formatTimeAgo(securityInfo.last_login)}
              </p>
            </div>
          </div>
        </div>

        {securityInfo.last_login_ip && (
          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-purple-400" />
              <div>
                <p className="text-xs text-gray-400">IP Address</p>
                <p className="text-sm text-white font-medium">
                  {securityInfo.last_login_ip?.substring(0, 15)}...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Login History Toggle */}
        {securityInfo.login_history?.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <History className="h-4 w-4 text-amber-400" />
              <div className="text-left">
                <p className="text-xs text-gray-400">Recent Activity</p>
                <p className="text-sm text-white font-medium">
                  {securityInfo.total_logins} login{securityInfo.total_logins > 1 ? 's' : ''} recorded
                </p>
              </div>
            </div>
            <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${showHistory ? 'rotate-90' : ''}`} />
          </button>
        )}

        {/* Login History List */}
        {showHistory && securityInfo.login_history?.length > 0 && (
          <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
            {securityInfo.login_history.map((login, index) => (
              <div 
                key={index}
                className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getDeviceIcon(login.device)}
                    <span className="text-xs text-white">
                      {login.device || 'Unknown'} • {login.os || 'Unknown'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatTimeAgo(login.login_time)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <Globe className="h-3 w-3" />
                  <span>{login.ip_address}</span>
                  {login.browser && (
                    <>
                      <span>•</span>
                      <span>{login.browser}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Tips */}
      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-xs text-blue-400">
          <AlertCircle className="h-3 w-3 inline mr-1" />
          Your account is protected with 6-digit PIN and progressive lockout.
        </p>
      </div>
    </Card>
  );
};

export default SecurityInfo;
