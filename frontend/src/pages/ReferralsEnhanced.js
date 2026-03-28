import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Copy, Check, Share2, ArrowLeft, TrendingUp, 
  UserCheck, Link2, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

const ReferralsEnhanced = ({ user }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [networkStats, setNetworkStats] = useState(null);
  const [directReferrals, setDirectReferrals] = useState([]);
  
  // Referral code from user
  const referralCode = user?.referral_code || '';
  const referralLink = `https://parasreward.com/register?ref=${referralCode}`;

  const fetchData = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      setRefreshing(true);
      
      // Fetch network stats and referrals in parallel with timeout
      const [statsRes, referralsRes] = await Promise.all([
        axios.get(`${API}/api/growth/network-stats/${user.uid}`, { timeout: 15000 }).catch(() => null),
        axios.get(`${API}/api/referrals/${user.uid}/direct-list`, { timeout: 10000 }).catch(() => null)
      ]);
      
      if (statsRes?.data?.success) {
        setNetworkStats(statsRes.data.data);
      }
      
      if (referralsRes?.data?.referrals) {
        setDirectReferrals(referralsRes.data.referrals);
      } else if (referralsRes?.data?.data) {
        setDirectReferrals(referralsRes.data.data);
      }
      
    } catch (error) {
      console.error('Fetch referral data error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Paras Reward',
          text: 'Join Paras Reward and start growing!',
          url: referralLink
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  };

  // Calculate progress
  const networkProgress = networkStats ? 
    Math.min(100, (networkStats.network_size / networkStats.network_cap) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-[#0a0a0f]/95 backdrop-blur-lg border-b border-gray-800/50 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-gray-800"
              data-testid="back-button"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <h1 className="text-lg font-semibold text-white">Growth Network</h1>
          </div>
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="p-2 rounded-full hover:bg-gray-800"
          >
            <RefreshCw className={`w-5 h-5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        
        {/* Referral Link Card */}
        {referralCode && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-5 shadow-lg" data-testid="referral-link-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-white/80" />
                <span className="text-white/80 text-sm font-medium">Your Referral Link</span>
              </div>
              <span className="bg-white/20 px-2 py-1 rounded text-white text-xs font-bold">
                {referralCode}
              </span>
            </div>
            
            <div className="bg-black/20 rounded-xl p-3 mb-4 truncate">
              <p className="text-white/90 text-sm font-mono truncate">{referralLink}</p>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={handleCopy}
                className="flex-1 bg-white/20 hover:bg-white/30 text-white border-0"
                data-testid="copy-button"
              >
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button
                onClick={handleShare}
                className="flex-1 bg-white text-orange-600 hover:bg-white/90"
                data-testid="share-button"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        )}

        {/* Stats Cards - Direct, Active, Network */}
        <div className="grid grid-cols-3 gap-3">
          {/* Direct Referrals */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 text-center" data-testid="direct-referrals-card">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-white">{networkStats?.direct_referrals || 0}</p>
            <p className="text-xs text-gray-500">Direct</p>
          </div>

          {/* Active Network */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 text-center" data-testid="active-network-card">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-emerald-400">{networkStats?.active_network_size || 0}</p>
            <p className="text-xs text-gray-500">Active</p>
          </div>

          {/* Total Network Size */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 text-center" data-testid="network-size-card">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-white">{networkStats?.network_size || 0}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
        </div>

        {/* Network Capacity Progress Bar */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5" data-testid="network-progress-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm">Network Capacity</span>
            <span className="text-amber-400 font-bold text-lg">
              {networkProgress.toFixed(0)}%
            </span>
          </div>
          <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${networkProgress}%` }}
            />
          </div>
        </div>

        {/* Direct Referrals List */}
        {directReferrals.length > 0 && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden" data-testid="direct-referrals-list">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-400" />
                Direct Connections
              </h3>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-xs">
                  {directReferrals.filter(r => r.is_active).length} Active
                </span>
                <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs">
                  {directReferrals.filter(r => !r.is_active).length} Inactive
                </span>
              </div>
            </div>
            
            <div className="divide-y divide-gray-800 max-h-80 overflow-y-auto">
              {directReferrals.map((ref, index) => (
                <div key={ref.uid || index} className="px-5 py-3 flex items-center justify-between" data-testid={`referral-item-${index}`}>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                        ref.is_active
                          ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/30' 
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {ref.name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      {/* Active/Inactive dot indicator */}
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0a0a0f] ${
                        ref.is_active ? 'bg-emerald-500' : 'bg-red-500'
                      }`} />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{ref.name || 'User'}</p>
                      <p className={`text-xs ${ref.is_active ? 'text-emerald-400' : 'text-gray-500'}`}>
                        {ref.subscription_plan && ref.subscription_plan.toLowerCase() !== 'explorer' 
                          ? 'Elite' 
                          : 'Explorer'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ref.is_active ? (
                      <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-400 text-xs rounded-lg font-medium" data-testid={`status-active-${index}`}>Active</span>
                    ) : (
                      <span className="px-2.5 py-1 bg-red-500/15 text-red-400 text-xs rounded-lg font-medium" data-testid={`status-inactive-${index}`}>Inactive</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {directReferrals.length === 0 && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-800 flex items-center justify-center">
              <Users className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-white font-semibold mb-2">No Referrals Yet</h3>
            <p className="text-gray-500 text-sm mb-4">
              Share your invite link to grow your network and increase your rewards!
            </p>
            <Button
              onClick={handleShare}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Now
            </Button>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
          <p className="text-amber-300 text-sm text-center">
            Grow your network to increase mining rewards!
          </p>
        </div>

      </div>
    </div>
  );
};

export default ReferralsEnhanced;
