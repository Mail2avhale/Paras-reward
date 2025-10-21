import { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins, Play, Clock, Zap, TrendingUp, Users, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveAd } from '@/components/AdSenseAd';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Mining = ({ user, onLogout }) => {
  const [miningStatus, setMiningStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchMiningStatus();
    const interval = setInterval(() => {
      fetchMiningStatus();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const fetchMiningStatus = async () => {
    try {
      const response = await axios.get(`${API}/mining/status/${user.uid}`);
      setMiningStatus(response.data);
    } catch (error) {
      console.error('Error fetching mining status:', error);
    }
  };

  const startMiningSession = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/mining/start/${user.uid}`);
      toast.success(response.data.message);
      fetchMiningStatus();
    } catch (error) {
      console.error('Error starting mining:', error);
      toast.error(error.response?.data?.detail || 'Failed to start mining');
    } finally {
      setLoading(false);
    }
  };

  const claimCoins = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/mining/claim/${user.uid}`);
      toast.success(`Claimed ${response.data.amount.toFixed(2)} PRC!`);
      if (response.data.note) {
        toast.info(response.data.note);
      }
      fetchMiningStatus();
    } catch (error) {
      console.error('Error claiming coins:', error);
      toast.error(error.response?.data?.detail || 'Failed to claim coins');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (hours) => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8">Mining Center</h1>

        {/* Session Status Banner */}
        {miningStatus && (
          <Card className={`p-6 mb-8 ${
            miningStatus.session_active 
              ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
              : 'bg-gradient-to-r from-orange-500 to-red-600'
          } text-white`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-4 h-4 rounded-full ${
                  miningStatus.session_active ? 'bg-white animate-pulse' : 'bg-white/50'
                }`}></div>
                <div>
                  <h3 className="text-2xl font-bold">
                    {miningStatus.session_active ? 'Mining Active' : 'Mining Paused'}
                  </h3>
                  <p className="text-white/90">
                    {miningStatus.session_active 
                      ? `${formatTime(miningStatus.remaining_hours)} remaining in this session`
                      : 'Start a 24-hour mining session to earn PRC coins'
                    }
                  </p>
                </div>
              </div>
              {miningStatus.session_active && (
                <div className="text-right">
                  <p className="text-sm text-white/90">Session Ends</p>
                  <p className="text-lg font-bold">
                    {new Date(miningStatus.session_end).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Mining Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">PRC Balance</span>
              <Coins className="h-5 w-5 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {miningStatus?.current_balance?.toFixed(2) || '0.00'}
            </div>
            <p className="text-sm text-gray-500 mt-1">Available coins</p>
          </Card>

          <Card className="p-6 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Mining Rate</span>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {miningStatus?.mining_rate_per_hour?.toFixed(2) || '0.00'}
            </div>
            <p className="text-sm text-gray-500 mt-1">PRC/hour</p>
          </Card>

          <Card className="p-6 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Session Mined</span>
              <Zap className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {miningStatus?.mined_this_session?.toFixed(2) || '0.00'}
            </div>
            <p className="text-sm text-gray-500 mt-1">This session</p>
          </Card>

          <Card className="p-6 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Active Referrals</span>
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {miningStatus?.active_referrals || 0}
            </div>
            <p className="text-sm text-gray-500 mt-1">Mining now</p>
          </Card>
        </div>

        {/* Ad Space */}
        {!isAdmin && (
          <div className="mb-8">
            <ResponsiveAd 
              adSlot="1234567890"
              adFormat="auto"
              fullWidthResponsive={true}
            />
          </div>
        )}

        {/* Main Mining Control */}
        <Card className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl mb-8">
          <div className="text-center">
            {!miningStatus?.session_active ? (
              <>
                <div className="mb-6">
                  <div className="w-32 h-32 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Play className="h-16 w-16 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-3">Start Mining Session</h2>
                  <p className="text-gray-600 max-w-2xl mx-auto">
                    Click the button below to start your 24-hour mining session. 
                    You'll earn PRC coins based on your mining rate and active referrals.
                  </p>
                </div>

                <Button
                  onClick={startMiningSession}
                  disabled={loading}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-12 py-6 text-xl rounded-2xl shadow-xl"
                >
                  {loading ? 'Starting...' : 'Start Mining'}
                </Button>

                <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="text-left">
                      <p className="font-semibold text-yellow-900">Important:</p>
                      <p className="text-sm text-yellow-800">
                        • Mining sessions last 24 hours<br />
                        • You must start a new session after 24 hours to continue mining<br />
                        • Referral bonuses only count when both you and your referrals have active sessions<br />
                        • {user.membership_type === 'free' 
                          ? 'Free users: Mined coins are valid for 24 hours only. Upgrade to VIP for unlimited validity.' 
                          : 'VIP: Your coins have unlimited validity!'}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <div className="relative w-48 h-48 mx-auto mb-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full animate-pulse"></div>
                    <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
                      <div className="text-center">
                        <Coins className="h-16 w-16 text-purple-600 mx-auto mb-2" />
                        <p className="text-3xl font-bold text-gray-900">
                          {miningStatus?.mined_this_session?.toFixed(2) || '0.00'}
                        </p>
                        <p className="text-sm text-gray-600">PRC Mined</p>
                      </div>
                    </div>
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-3">Mining in Progress</h2>
                  <p className="text-gray-600 mb-2">
                    Session ends in: <span className="font-bold text-purple-600">
                      {formatTime(miningStatus.remaining_hours)}
                    </span>
                  </p>
                  <p className="text-sm text-gray-500">
                    Earning {miningStatus.mining_rate_per_hour.toFixed(2)} PRC per hour
                  </p>
                </div>

                <Button
                  onClick={claimCoins}
                  disabled={loading || (miningStatus?.mined_this_session || 0) < 1}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-12 py-6 text-xl rounded-2xl shadow-xl disabled:opacity-50"
                >
                  {loading ? 'Claiming...' : `Claim ${miningStatus?.mined_this_session?.toFixed(2) || '0.00'} PRC`}
                </Button>

                <p className="text-sm text-gray-500 mt-4">
                  Claim your mined coins anytime during the session
                </p>
              </>
            )}
          </div>
        </Card>

        {/* Rate Breakdown */}
        <Card className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Mining Rate Breakdown</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <span className="text-gray-700 font-medium">Base Rate</span>
              <span className="text-xl font-bold text-gray-900">
                {miningStatus?.base_rate?.toFixed(2) || '0.00'} PRC/hour
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
              <div>
                <span className="text-gray-700 font-medium">Referral Bonus</span>
                <p className="text-sm text-gray-600">
                  {miningStatus?.active_referrals || 0} active referrals × 10% each
                </p>
              </div>
              <span className="text-xl font-bold text-blue-600">
                +{((miningStatus?.active_referrals || 0) * 0.1 * (miningStatus?.base_rate || 0)).toFixed(2)} PRC/hour
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl border-2 border-purple-200">
              <span className="text-gray-900 font-bold text-lg">Total Rate</span>
              <span className="text-2xl font-bold text-purple-600">
                {miningStatus?.mining_rate_per_hour?.toFixed(2) || '0.00'} PRC/hour
              </span>
            </div>
          </div>

          <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <p className="text-sm text-indigo-900">
              <strong>💡 Tip:</strong> Increase your mining rate by inviting friends! 
              Each active referral adds 10% bonus to your base rate (up to 200 referrals).
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Mining;