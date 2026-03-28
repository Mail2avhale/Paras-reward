import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, TrendingUp, Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Mining = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [miningData, setMiningData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      fetchMiningSpeed();
    }
  }, [user]);

  const fetchMiningSpeed = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/growth/mining-speed/${user.uid}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (response.data.success) {
        setMiningData(response.data.data);
      }
    } catch (error) {
      console.error('Mining speed fetch error:', error);
      toast.error('Failed to load mining data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
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
            <h1 className="text-lg font-semibold text-slate-800">Mining</h1>
          </div>
          <button
            onClick={fetchMiningSpeed}
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
        
        {/* Mining Speed Card */}
        <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl shadow-purple-200" data-testid="mining-speed-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-purple-200 text-sm">Your Mining Speed</p>
              <h2 className="text-3xl font-bold" data-testid="total-daily-prc">
                {miningData?.total_daily_prc?.toLocaleString('en-IN') || 0} PRC
              </h2>
            </div>
          </div>
          <p className="text-purple-200 text-sm">Per Day</p>
          
          {/* Subscription Multiplier */}
          {miningData?.subscription_multiplier < 1 && (
            <div className="mt-4 bg-white/10 rounded-xl p-3">
              <p className="text-sm text-purple-100">
                PRC Subscription: {(miningData.subscription_multiplier * 100).toFixed(0)}% Speed
              </p>
              <p className="text-xs text-purple-200 mt-1">
                Upgrade to Cash subscription for 100% mining speed
              </p>
            </div>
          )}
        </div>

        {/* Speed Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm" data-testid="speed-breakdown">
          <h3 className="font-semibold text-slate-800 mb-4">Speed Breakdown</h3>
          
          <div className="space-y-4">
            {/* Base Mining */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-slate-800 font-medium">Base Mining</p>
                  <p className="text-xs text-slate-500">Daily base reward</p>
                </div>
              </div>
              <p className="text-lg font-semibold text-emerald-600" data-testid="base-mining">
                +{miningData?.base_mining || 550} PRC
              </p>
            </div>

            {/* Network Mining */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-slate-800 font-medium">Network Mining</p>
                  <p className="text-xs text-slate-500">
                    {miningData?.network_size || 0} members × {miningData?.prc_per_user || 0} PRC
                  </p>
                </div>
              </div>
              <p className="text-lg font-semibold text-purple-600" data-testid="network-mining">
                +{miningData?.network_mining?.toLocaleString('en-IN') || 0} PRC
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-slate-600 font-medium">Total Speed</p>
                <p className="text-xl font-bold text-slate-800">
                  {miningData?.total_daily_prc?.toLocaleString('en-IN') || 0} PRC/day
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Network Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm" data-testid="network-size-card">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-slate-400" />
              <p className="text-sm text-slate-500">Network Size</p>
            </div>
            <p className="text-2xl font-bold text-slate-800">
              {miningData?.network_size || 0}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              of {miningData?.network_cap || 800} max
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm" data-testid="prc-per-user-card">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              <p className="text-sm text-slate-500">PRC/Member</p>
            </div>
            <p className="text-2xl font-bold text-slate-800">
              {miningData?.prc_per_user || 8}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              per active member
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
          <p className="text-sm text-slate-600 text-center">
            Mining speed increases as your Growth Network expands. Invite more members to boost your rewards.
          </p>
        </div>

        {/* Action Button */}
        <Button
          onClick={() => navigate('/referrals')}
          className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white py-6 rounded-2xl shadow-lg shadow-purple-200"
          data-testid="grow-network-button"
        >
          <Users className="w-5 h-5 mr-2" />
          Grow Your Network
        </Button>
      </div>
    </div>
  );
};

export default Mining;
