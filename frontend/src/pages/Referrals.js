import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Copy, Check, UserPlus, Link2, Share2, TrendingUp, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Referrals = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [referralCode, setReferralCode] = useState(user?.referral_code || '');
  const [referrals, setReferrals] = useState([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [applyCode, setApplyCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total_referrals: 0,
    active_referrals: 0,
    vip_referrals: 0
  });
  const [multiLevelStats, setMultiLevelStats] = useState(null);
  const [showLevelDetails, setShowLevelDetails] = useState(false);
  
  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  // Generate referral link
  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;

  useEffect(() => {
    if (user?.uid) {
      fetchReferralCode();
      fetchReferrals();
      fetchReferralStats();
      fetchMultiLevelStats();
    } else {
      setError('User information not available. Please try logging out and logging back in.');
      setLoading(false);
    }
  }, [user?.uid]);

  const fetchReferralCode = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!user?.uid) {
        throw new Error('User UID not available');
      }
      
      const response = await axios.get(`${API}/referral/code/${user.uid}`);
      
      if (response.data.referral_code) {
        setReferralCode(response.data.referral_code);
      } else {
        throw new Error('Referral code not found in response');
      }
    } catch (error) {
      console.error('Error fetching referral code:', error);
      setError(error.response?.data?.detail || error.message || 'Failed to load referral code');
      toast.error('Failed to load referral code');
    } finally {
      setLoading(false);
    }
  };

  const fetchReferrals = async () => {
    try {
      if (!user?.uid) {
        console.error('User UID not available');
        return;
      }
      const response = await axios.get(`${API}/referral/list/${user.uid}`);
      setReferrals(response.data.referrals || []);
    } catch (error) {
      console.error('Error fetching referrals:', error);
      toast.error('Failed to load referrals');
    }
  };

  const fetchReferralStats = async () => {
    try {
      if (!user?.uid) return;
      const response = await axios.get(`${API}/referral/stats/${user.uid}`);
      setStats(response.data || {
        total_referrals: 0,
        active_referrals: 0,
        vip_referrals: 0
      });
    } catch (error) {
      console.error('Error fetching referral stats:', error);
    }
  };

  const fetchMultiLevelStats = async () => {
    try {
      if (!user?.uid) return;
      const response = await axios.get(`${API}/referral/multi-level-stats/${user.uid}`);
      setMultiLevelStats(response.data);
    } catch (error) {
      console.error('Error fetching multi-level stats:', error);
    }
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    toast.success('Referral code copied!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    toast.success('Referral link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareReferralLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join PARAS REWARD',
          text: `Join PARAS REWARD using my referral code: ${referralCode}`,
          url: referralLink
        });
        toast.success('Shared successfully!');
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error sharing:', error);
          toast.error('Failed to share');
        }
      }
    } else {
      copyReferralLink();
    }
  };

  const applyReferralCode = async () => {
    if (!applyCode) {
      toast.error('Please enter a referral code');
      return;
    }

    try {
      await axios.post(`${API}/referral/apply/${user.uid}?referral_code=${applyCode}`);
      toast.success('Referral code applied successfully!');
      setApplyCode('');
      fetchReferralStats();
    } catch (error) {
      console.error('Error applying referral:', error);
      toast.error(error.response?.data?.detail || 'Failed to apply referral code');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 pt-20 pb-24">
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Back Button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Dashboard</span>
        </button>
        
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8">Referral Program</h1>

        {/* Referral Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100">
            <Users className="h-8 w-8 text-purple-600 mb-2" />
            <div className="text-sm font-medium text-purple-600 mb-1">Total Referrals</div>
            <div className="text-3xl font-bold text-purple-900">{stats.total_referrals}</div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100">
            <TrendingUp className="h-8 w-8 text-green-600 mb-2" />
            <div className="text-sm font-medium text-green-600 mb-1">Active Users</div>
            <div className="text-3xl font-bold text-green-900">{stats.active_referrals}</div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-amber-50 to-amber-100">
            <UserPlus className="h-8 w-8 text-amber-600 mb-2" />
            <div className="text-sm font-medium text-amber-600 mb-1">VIP Members</div>
            <div className="text-3xl font-bold text-amber-900">{stats.vip_referrals}</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Your Referral Code & Link */}
          <Card data-testid="referral-code-card" className="bg-gradient-to-br from-purple-600 to-pink-600 text-white p-8 rounded-3xl shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              <Users className="h-7 w-7 mr-2" />
              Your Referral Code
            </h2>
            
            <div className="bg-white/20 backdrop-blur-sm p-6 rounded-2xl mb-4">
              {loading ? (
                <div className="text-center py-4">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-white border-r-transparent"></div>
                  <p className="mt-2 text-white/70">Loading referral code...</p>
                </div>
              ) : error ? (
                <div className="text-center py-4">
                  <p className="text-red-200 text-sm mb-2">{error}</p>
                  <Button
                    onClick={fetchReferralCode}
                    size="sm"
                    className="bg-white text-purple-600 hover:bg-gray-100"
                  >
                    Retry
                  </Button>
                </div>
              ) : referralCode ? (
                <p className="text-4xl font-bold text-center tracking-wider">{referralCode}</p>
              ) : (
                <p className="text-2xl text-center text-white/70">No code available</p>
              )}
            </div>
            
            <Button
              data-testid="copy-code-btn"
              onClick={copyReferralCode}
              disabled={!referralCode || loading}
              className="w-full bg-white text-purple-600 hover:bg-gray-100 py-6 rounded-xl text-lg font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-4"
            >
              {copiedCode ? (
                <>
                  <Check className="mr-2 h-5 w-5" />
                  Code Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-5 w-5" />
                  Copy Code
                </>
              )}
            </Button>

            {/* Referral Link Section */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Your Referral Link</h3>
              </div>
              
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
                <p className="text-sm font-mono break-all">{referralLink}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={copyReferralLink}
                  disabled={!referralCode || loading}
                  className="w-full bg-white/30 hover:bg-white/40 text-white py-4 rounded-xl font-semibold transition-all disabled:opacity-50"
                >
                  {copiedLink ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Link
                    </>
                  )}
                </Button>

                <Button
                  onClick={shareReferralLink}
                  disabled={!referralCode || loading}
                  className="w-full bg-white/30 hover:bg-white/40 text-white py-4 rounded-xl font-semibold transition-all disabled:opacity-50"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </div>
            </div>

            <div className="mt-6 p-4 bg-white/10 rounded-xl">
              <p className="text-sm opacity-90">
                <strong>Bonus:</strong> +10% mining rate per active referral (Max 200)
              </p>
            </div>
          </Card>

          {/* Apply Referral Code */}
          <Card data-testid="apply-referral-card" className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <UserPlus className="h-7 w-7 mr-2 text-purple-600" />
              Apply Referral Code
            </h2>
            <p className="text-gray-600 mb-6">
              Enter a friend's referral code to help them earn bonus mining rewards!
            </p>
            <div className="space-y-4">
              <Input
                data-testid="apply-code-input"
                type="text"
                placeholder="Enter referral code"
                value={applyCode}
                onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
                className="py-6 text-lg rounded-xl border-2 border-gray-200 focus:border-purple-500"
              />
              <Button
                data-testid="apply-code-btn"
                onClick={applyReferralCode}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 rounded-xl text-lg font-semibold shadow-lg transition-all"
              >
                Apply Code
              </Button>
            </div>
          </Card>
        </div>

        {/* Referral Stats */}
        <Card data-testid="referral-stats" className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Referrals</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-purple-100 to-pink-100 p-6 rounded-2xl">
              <p className="text-sm text-gray-600 mb-1">Total Referrals</p>
              <p className="text-4xl font-bold text-gray-900">{referrals.length}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-100 to-purple-100 p-6 rounded-2xl">
              <p className="text-sm text-gray-600 mb-1">Active Referrals</p>
              <p className="text-4xl font-bold text-gray-900">
                {referrals.filter(r => r.is_active).length}
              </p>
            </div>
            <div className="bg-gradient-to-br from-pink-100 to-orange-100 p-6 rounded-2xl">
              <p className="text-sm text-gray-600 mb-1">Bonus Rate</p>
              <p className="text-4xl font-bold text-gray-900">
                +{referrals.filter(r => r.is_active).length * 10}%
              </p>
            </div>
          </div>

          {/* Referral List */}
          <div className="space-y-4">
            {referrals.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No referrals yet. Share your code to start earning!</p>
              </div>
            ) : (
              referrals.map((referral, index) => (
                <div
                  key={index}
                  data-testid={`referral-${index}`}
                  className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={referral.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(referral.name)}`}
                      alt={referral.name}
                      className="w-12 h-12 rounded-full"
                    />
                    <div>
                      <p className="font-semibold text-gray-900">{referral.name}</p>
                      <p className="text-sm text-gray-500">UID: {referral.uid.substring(0, 8)}...</p>
                    </div>
                  </div>
                  <div>
                    {referral.is_active ? (
                      <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-semibold">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Referrals;