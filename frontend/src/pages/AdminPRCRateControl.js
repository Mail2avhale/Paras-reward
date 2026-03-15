import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  ArrowLeft, RefreshCw, Save, TrendingUp, Clock, Search, 
  User, Coins, Activity, Users, CheckCircle, XCircle,
  Copy, Zap, Calendar, Info, AlertTriangle
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminPRCRateControl = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // PRC Rate State
  const [currentRate, setCurrentRate] = useState(10);
  const [rateSource, setRateSource] = useState('dynamic_economy');
  const [overrideInfo, setOverrideInfo] = useState(null);
  const [newRate, setNewRate] = useState('');
  const [expiresHours, setExpiresHours] = useState('');
  const [savingRate, setSavingRate] = useState(false);
  
  // User Lookup State
  const [searchQuery, setSearchQuery] = useState('');
  const [userResult, setUserResult] = useState(null);
  const [searchingUser, setSearchingUser] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchCurrentRate();
  }, [user, navigate]);

  const fetchCurrentRate = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/prc-rate/current`);
      if (response.data.success) {
        setCurrentRate(response.data.current_rate);
        setRateSource(response.data.source);
        setOverrideInfo(response.data.override);
      }
    } catch (error) {
      console.error('Error fetching rate:', error);
      toast.error('Failed to fetch current rate');
    } finally {
      setLoading(false);
    }
  };

  const handleSetOverride = async () => {
    if (!newRate || parseFloat(newRate) <= 0) {
      toast.error('Please enter a valid rate');
      return;
    }
    
    setSavingRate(true);
    try {
      const response = await axios.post(`${API}/admin/prc-rate/manual-override`, {
        rate: parseInt(newRate),
        enabled: true,
        expires_hours: expiresHours ? parseInt(expiresHours) : null
      });
      
      if (response.data.success) {
        toast.success(response.data.message);
        setNewRate('');
        setExpiresHours('');
        fetchCurrentRate();
      }
    } catch (error) {
      console.error('Error setting override:', error);
      toast.error(error.response?.data?.detail || 'Failed to set rate override');
    } finally {
      setSavingRate(false);
    }
  };

  const handleDisableOverride = async () => {
    setSavingRate(true);
    try {
      const response = await axios.post(`${API}/admin/prc-rate/manual-override`, {
        enabled: false
      });
      
      if (response.data.success) {
        toast.success('Manual override disabled');
        fetchCurrentRate();
      }
    } catch (error) {
      console.error('Error disabling override:', error);
      toast.error('Failed to disable override');
    } finally {
      setSavingRate(false);
    }
  };

  const handleSearchUser = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }
    
    setSearchingUser(true);
    setUserResult(null);
    
    try {
      const response = await axios.get(`${API}/admin/user-lookup/${encodeURIComponent(searchQuery.trim())}`);
      if (response.data.success) {
        setUserResult(response.data);
      } else {
        toast.error(response.data.error || 'User not found');
      }
    } catch (error) {
      console.error('Error searching user:', error);
      toast.error(error.response?.data?.detail || 'User not found');
    } finally {
      setSearchingUser(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/admin/settings-hub')}
              className="flex items-center gap-2 bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-2xl font-bold text-white">
              Admin Tools
            </h1>
          </div>
          <Button
            variant="outline"
            onClick={fetchCurrentRate}
            disabled={loading}
            className="bg-gray-800 border-gray-700 text-gray-300"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* PRC Rate Control */}
        <Card className="p-6 shadow-xl bg-gray-900/50 border-gray-800 mb-6" data-testid="prc-rate-control">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-100">PRC Rate Control</h2>
              <p className="text-gray-400">Manually override the dynamic PRC rate</p>
            </div>
          </div>

          {/* Current Rate Display */}
          <div className={`p-6 rounded-xl border-2 mb-6 ${
            rateSource === 'manual_override' 
              ? 'bg-amber-500/10 border-amber-500/50' 
              : 'bg-emerald-500/10 border-emerald-500/50'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm mb-1">Current Rate</p>
                <p className="text-4xl font-bold text-white">
                  {currentRate} <span className="text-lg text-gray-400">PRC = ₹1</span>
                </p>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  rateSource === 'manual_override'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {rateSource === 'manual_override' ? (
                    <>
                      <Zap className="w-4 h-4" /> Manual Override
                    </>
                  ) : (
                    <>
                      <Activity className="w-4 h-4" /> Dynamic Economy
                    </>
                  )}
                </span>
                {overrideInfo && (
                  <p className="text-gray-400 text-xs mt-2">
                    {overrideInfo.permanent ? 'Permanent override' : `Expires: ${new Date(overrideInfo.expires_at).toLocaleString()}`}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Set Override Form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">New Rate (PRC = ₹1)</label>
              <input
                type="number"
                min="1"
                placeholder="e.g., 10"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                data-testid="new-rate-input"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                Duration (hours)
                <span className="text-gray-500 text-xs ml-1">(empty = permanent)</span>
              </label>
              <input
                type="number"
                min="1"
                placeholder="e.g., 24"
                value={expiresHours}
                onChange={(e) => setExpiresHours(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                data-testid="expires-hours-input"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleSetOverride}
                disabled={savingRate || !newRate}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white py-3"
                data-testid="set-override-btn"
              >
                {savingRate ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" /> Set Override
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Disable Override Button */}
          {rateSource === 'manual_override' && (
            <Button
              onClick={handleDisableOverride}
              disabled={savingRate}
              variant="outline"
              className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
              data-testid="disable-override-btn"
            >
              <XCircle className="w-4 h-4 mr-2" /> Disable Manual Override (Use Dynamic Rate)
            </Button>
          )}

          {/* Info Box */}
          <div className="mt-6 bg-blue-900/30 border border-blue-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-blue-300 mb-1">How it works</h3>
                <ul className="text-xs text-blue-200 space-y-1">
                  <li>• Manual override bypasses the Token Economy dynamic rate</li>
                  <li>• Set duration in hours, or leave empty for permanent override</li>
                  <li>• Affects all services: Bill Payments, Gift Vouchers, Subscriptions</li>
                  <li>• Disable override to return to dynamic economy calculation</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>

        {/* User Lookup */}
        <Card className="p-6 shadow-xl bg-gray-900/50 border-gray-800" data-testid="user-lookup">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
              <Search className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-100">User Lookup</h2>
              <p className="text-gray-400">Search by UID, mobile, email, or name</p>
            </div>
          </div>

          {/* Search Form */}
          <div className="flex gap-4 mb-6">
            <input
              type="text"
              placeholder="Enter UID, mobile, email, or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              data-testid="user-search-input"
            />
            <Button
              onClick={handleSearchUser}
              disabled={searchingUser}
              className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white px-6"
              data-testid="search-user-btn"
            >
              {searchingUser ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" /> Search
                </>
              )}
            </Button>
          </div>

          {/* User Result */}
          {userResult && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <User className="w-5 h-5 text-purple-400" />
                    {userResult.basic_info?.name}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs ${
                    userResult.basic_info?.subscription_plan === 'elite' 
                      ? 'bg-amber-500/20 text-amber-400' 
                      : userResult.basic_info?.subscription_plan === 'startup'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-gray-700 text-gray-400'
                  }`}>
                    {userResult.basic_info?.subscription_plan?.toUpperCase() || 'EXPLORER'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">UID</p>
                    <p className="text-white font-mono flex items-center gap-2">
                      {userResult.basic_info?.uid?.substring(0, 8)}...
                      <button onClick={() => copyToClipboard(userResult.basic_info?.uid)} className="text-purple-400 hover:text-purple-300">
                        <Copy className="w-3 h-3" />
                      </button>
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Mobile</p>
                    <p className="text-white">{userResult.basic_info?.mobile}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">PRC Balance</p>
                    <p className="text-amber-400 font-semibold">{userResult.basic_info?.prc_balance?.toLocaleString()} PRC</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Total Mined</p>
                    <p className="text-emerald-400">{userResult.basic_info?.total_mined?.toLocaleString()} PRC</p>
                  </div>
                </div>

                {userResult.basic_info?.subscription_expiry && (
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-400">Expiry:</span>
                    <span className="text-white">{new Date(userResult.basic_info.subscription_expiry).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Mining Details */}
              {userResult.mining_details && (
                <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl p-5">
                  <h3 className="text-lg font-semibold text-emerald-400 flex items-center gap-2 mb-4">
                    <Zap className="w-5 h-5" />
                    Mining Details
                  </h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Base Rate</p>
                      <p className="text-white">{userResult.mining_details.base_rate_per_hour} PRC/hr</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Referral Bonus</p>
                      <p className="text-emerald-400">+{userResult.mining_details.referral_bonus_per_hour} PRC/hr</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Boost Multiplier</p>
                      <p className="text-amber-400">{userResult.mining_details.boost_multiplier}x</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Final Rate</p>
                      <p className="text-white font-bold">{userResult.mining_details.final_rate_per_hour} PRC/hr</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-emerald-500/20">
                    <div className="flex items-center gap-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        userResult.mining_details.mining_active 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {userResult.mining_details.mining_active ? (
                          <><CheckCircle className="w-3 h-3" /> Mining Active</>
                        ) : (
                          <><XCircle className="w-3 h-3" /> Mining Inactive</>
                        )}
                      </span>
                      <span className="text-gray-400 text-sm">
                        Daily: {userResult.mining_details.final_rate_per_day} PRC/day
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Referral Breakdown */}
              {userResult.referral_breakdown && (
                <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-blue-400" />
                    Referral Breakdown
                  </h3>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                      <p className="text-blue-400 font-semibold mb-1">Level 1</p>
                      <p className="text-white text-xl">{userResult.referral_breakdown.level_1?.total || 0}</p>
                      <p className="text-emerald-400 text-xs">{userResult.referral_breakdown.level_1?.active || 0} active</p>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                      <p className="text-purple-400 font-semibold mb-1">Level 2</p>
                      <p className="text-white text-xl">{userResult.referral_breakdown.level_2?.total || 0}</p>
                      <p className="text-emerald-400 text-xs">{userResult.referral_breakdown.level_2?.active || 0} active</p>
                    </div>
                    <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-3">
                      <p className="text-pink-400 font-semibold mb-1">Level 3</p>
                      <p className="text-white text-xl">{userResult.referral_breakdown.level_3?.total || 0}</p>
                      <p className="text-emerald-400 text-xs">{userResult.referral_breakdown.level_3?.active || 0} active</p>
                    </div>
                  </div>
                </div>
              )}

              {/* FAQ/Common Questions */}
              {userResult.faq_answers && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
                  <h3 className="text-lg font-semibold text-amber-400 flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5" />
                    Common Questions
                  </h3>
                  
                  <div className="space-y-3 text-sm">
                    {userResult.faq_answers.why_balance_less && (
                      <div>
                        <p className="text-gray-400">Why is balance less than total mined?</p>
                        <p className="text-white">{userResult.faq_answers.why_balance_less}</p>
                      </div>
                    )}
                    {userResult.faq_answers.why_mining_slow && (
                      <div>
                        <p className="text-gray-400">Why mining is slow?</p>
                        <p className="text-white">{userResult.faq_answers.why_mining_slow}</p>
                      </div>
                    )}
                    {userResult.faq_answers.why_referral_inactive && (
                      <div>
                        <p className="text-gray-400">Why referrals show inactive?</p>
                        <p className="text-white">{userResult.faq_answers.why_referral_inactive}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!userResult && !searchingUser && (
            <div className="text-center py-10 text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Enter user details to search</p>
              <p className="text-sm text-gray-500 mt-2">Search by UID, mobile number, email, or name</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminPRCRateControl;
