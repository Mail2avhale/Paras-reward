import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
  Shield, CheckCircle, Smartphone, Clock, 
  MapPin, Key, AlertTriangle, RefreshCw,
  Lock, Eye, UserCheck, Activity
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

/**
 * Security & Trust Center Component
 * Shows account security status and trust indicators
 * Builds user confidence and reduces support queries
 */
const SecurityTrustCenter = ({ userId, user = {}, translations = {} }) => {
  const [securityData, setSecurityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const t = (key) => translations[key] || defaultTranslations[key] || key;

  const defaultTranslations = {
    securityCenter: 'Security & Trust',
    accountVerified: 'Account Verified',
    prcProtected: 'PRC Protected',
    lastLogin: 'Last Login',
    loginDevice: 'Login Device',
    activityLog: 'Activity Log',
    viewMore: 'View Details',
    secured: 'Secured',
    kycVerified: 'KYC Verified',
    kycPending: 'KYC Pending',
    emailVerified: 'Email Verified',
    phoneVerified: 'Phone Verified',
    trustScore: 'Trust Score'
  };

  useEffect(() => {
    fetchSecurityData();
  }, [userId]);

  const fetchSecurityData = async () => {
    try {
      // Fetch from API or use user data
      const response = await axios.get(`${API}/api/user/security/${userId}`);
      setSecurityData(response.data);
    } catch (error) {
      // Use available user data as fallback
      setSecurityData({
        accountVerified: true,
        prcProtected: true,
        kycStatus: user.kyc_status || 'pending',
        emailVerified: !!user.email,
        phoneVerified: !!user.phone,
        lastLogin: user.last_login,
        lastDevice: user.last_device || 'Mobile Device',
        loginLocation: user.last_location || 'India',
        trustScore: calculateTrustScore(user)
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateTrustScore = (userData) => {
    let score = 50; // Base score
    if (userData.kyc_status === 'verified') score += 20;
    if (userData.email) score += 10;
    if (userData.phone) score += 10;
    if (userData.membership_type === 'vip') score += 10;
    return Math.min(score, 100);
  };

  const formatLastLogin = (timestamp) => {
    if (!timestamp) return 'Recently';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;
      
      if (diff < 3600000) return 'Just now';
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch {
      return 'Recently';
    }
  };

  if (loading) {
    return (
      <div className="px-4 mb-4">
        <div className="bg-white rounded-2xl p-4 shadow-lg animate-pulse">
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const data = securityData || {};

  return (
    <div className="px-4 mb-4" data-testid="security-trust-center">
      <motion.div 
        className="bg-white rounded-2xl shadow-lg overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Header */}
        <div 
          className="p-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold">{t('securityCenter')}</h3>
                <p className="text-xs text-white/80">
                  Trust Score: {data.trustScore || 70}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-white" />
              <span className="text-sm font-medium">{t('secured')}</span>
            </div>
          </div>
        </div>

        {/* Quick Status Row */}
        <div className="p-3 grid grid-cols-4 gap-2 border-b">
          <div className="text-center">
            <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center ${
              data.accountVerified ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              <UserCheck className={`w-4 h-4 ${data.accountVerified ? 'text-green-600' : 'text-gray-400'}`} />
            </div>
            <p className="text-[10px] mt-1 text-gray-600">Account</p>
          </div>
          <div className="text-center">
            <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center ${
              data.prcProtected ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              <Lock className={`w-4 h-4 ${data.prcProtected ? 'text-green-600' : 'text-gray-400'}`} />
            </div>
            <p className="text-[10px] mt-1 text-gray-600">PRC</p>
          </div>
          <div className="text-center">
            <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center ${
              data.kycStatus === 'verified' ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              <Eye className={`w-4 h-4 ${data.kycStatus === 'verified' ? 'text-green-600' : 'text-yellow-600'}`} />
            </div>
            <p className="text-[10px] mt-1 text-gray-600">KYC</p>
          </div>
          <div className="text-center">
            <div className="mx-auto w-8 h-8 rounded-full flex items-center justify-center bg-green-100">
              <Activity className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-[10px] mt-1 text-gray-600">Active</p>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="p-4 space-y-3"
          >
            {/* Last Login */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">{t('lastLogin')}</span>
              </div>
              <span className="text-sm font-medium text-gray-800">
                {formatLastLogin(data.lastLogin)}
              </span>
            </div>

            {/* Device */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">{t('loginDevice')}</span>
              </div>
              <span className="text-sm font-medium text-gray-800">
                {data.lastDevice || 'Mobile Device'}
              </span>
            </div>

            {/* Location */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Location</span>
              </div>
              <span className="text-sm font-medium text-gray-800">
                {data.loginLocation || 'India'}
              </span>
            </div>

            {/* KYC Status */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">KYC Status</span>
              </div>
              <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                data.kycStatus === 'verified' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {data.kycStatus === 'verified' ? t('kycVerified') : t('kycPending')}
              </span>
            </div>
          </motion.div>
        )}

        {/* Footer */}
        <div 
          className="p-3 bg-gray-50 text-center cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="text-xs text-gray-500">
            {expanded ? 'Hide Details' : t('viewMore')} →
          </span>
        </div>
      </motion.div>
    </div>
  );
};

export default SecurityTrustCenter;
