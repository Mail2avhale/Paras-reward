import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Copy, Check, Share2, TrendingUp, Target, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ReferralsEnhanced = ({ user }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [networkStats, setNetworkStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Get referral code from user
  const referralCode = user?.referral_code || '';
  const referralLink = `https://parasreward.com/register?ref=${referralCode}`;

  useEffect(() => {
    if (user?.uid) {
      fetchNetworkStats();
    }
  }, [user]);

  const fetchNetworkStats = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/growth/network-stats/${user.uid}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (response.data.success) {
        setNetworkStats(response.data.data);
      }
    } catch (error) {
      console.error('Network stats fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
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
          text: 'Join Paras Reward and start earning!',
          url: referralLink
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  };

  // Calculate progress percentage
  const networkProgress = networkStats ? 
    Math.min(100, (networkStats.network_size / networkStats.network_cap) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-lg border-b border-slate-200 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/rewards')}
              className="p-2 rounded-full hover:bg-slate-100"
              data-testid="back-button"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-lg font-semibold text-slate-800">Growth Network</h1>
          </div>
          <button
            onClick={fetchNetworkStats}
            disabled={refreshing}
            className="p-2 rounded-full hover:bg-slate-100"
            data-testid="refresh-button"
          >
            <RefreshCw className={`w-5 h-5 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        
        {/* Network Stats Card */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-6 text-white shadow-xl shadow-emerald-200" data-testid="network-stats-card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-emerald-200 text-sm">Growth Network</p>
              <h2 className="text-3xl font-bold" data-testid="network-size">
                {networkStats?.network_size || 0}
              </h2>
              <p className="text-emerald-200 text-sm">Network Members</p>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <Users className="w-8 h-8" />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-emerald-200">Network Capacity</span>
              <span className="text-white font-medium">
                {networkStats?.network_size || 0} / {networkStats?.network_cap || 800}
              </span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${networkProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Direct Referrals */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm" data-testid="direct-referrals-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-800" data-testid="direct-referrals-count">
              {networkStats?.direct_referrals || 0}
            </p>
            <p className="text-sm text-slate-500 mt-1">Direct Referrals</p>
          </div>

          {/* Network Size */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm" data-testid="network-size-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-800">
              {networkStats?.network_size || 0}
            </p>
            <p className="text-sm text-slate-500 mt-1">Network Size</p>
          </div>
        </div>

        {/* Growth Level & Unlock */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm" data-testid="growth-level-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-slate-500 text-sm">Growth Level</p>
                <p className="text-2xl font-bold text-slate-800">
                  Level {networkStats?.growth_level || 0}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-sm">Unlock</p>
              <p className="text-2xl font-bold text-emerald-600">
                {networkStats?.unlock_percent || 0}%
              </p>
            </div>
          </div>
        </div>

        {/* Referral Link Card */}
        {referralCode && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5" data-testid="referral-link-card">
            <h3 className="font-semibold text-slate-800 mb-3">Your Referral Code</h3>
            
            <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4">
              <p className="text-lg font-mono font-bold text-center text-purple-600" data-testid="referral-code">
                {referralCode}
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={handleCopy}
                variant="outline"
                className="flex-1 border-slate-300"
                data-testid="copy-button"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-emerald-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleShare}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                data-testid="share-button"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
          <p className="text-sm text-purple-700 text-center">
            Expand your Growth Network to increase your mining capacity. 
            More referrals = Higher network cap = More rewards!
          </p>
        </div>

      </div>
    </div>
  );
};

export default ReferralsEnhanced;
