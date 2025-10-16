import { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins, Play, Pause, Zap } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Mining = ({ user, onLogout }) => {
  const [miningStatus, setMiningStatus] = useState(null);
  const [isMining, setIsMining] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    fetchMiningStatus();
    const interval = setInterval(() => {
      if (isMining) {
        setTimer((prev) => prev + 1);
        fetchMiningStatus();
      }
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [isMining]);

  const fetchMiningStatus = async () => {
    try {
      const response = await axios.get(`${API}/mining/status/${user.uid}`);
      setMiningStatus(response.data);
    } catch (error) {
      console.error('Error fetching mining status:', error);
    }
  };

  const startMining = async () => {
    try {
      await axios.post(`${API}/mining/start/${user.uid}`);
      setIsMining(true);
      setTimer(0);
      toast.success('Mining started!');
    } catch (error) {
      console.error('Error starting mining:', error);
      toast.error('Failed to start mining');
    }
  };

  const claimCoins = async () => {
    try {
      const response = await axios.post(`${API}/mining/claim/${user.uid}`);
      toast.success(`Claimed ${response.data.amount.toFixed(2)} PRC!`);
      setIsMining(false);
      setTimer(0);
      fetchMiningStatus();
    } catch (error) {
      console.error('Error claiming coins:', error);
      toast.error('Failed to claim coins');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8">Mining Center</h1>

        {/* Mining Card */}
        <Card data-testid="mining-card" className="bg-gradient-to-br from-purple-600 to-pink-600 text-white p-8 rounded-3xl shadow-2xl mb-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-32 h-32 bg-white/20 rounded-full mb-6 float-animation">
              <Coins className="h-16 w-16" />
            </div>
            
            <h2 className="text-2xl font-bold mb-2">Current Balance</h2>
            <p className="text-6xl font-bold mb-4">{miningStatus?.current_balance?.toFixed(2) || '0.00'}</p>
            <p className="text-lg opacity-90">PRC Coins</p>
          </div>
        </Card>

        {/* Mining Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card data-testid="base-rate-card" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <p className="text-sm text-gray-600 mb-1">Base Rate</p>
            <p className="text-3xl font-bold text-gray-900">{miningStatus?.base_rate || 0}</p>
          </Card>

          <Card data-testid="mining-rate-card" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <p className="text-sm text-gray-600 mb-1">Mining Rate</p>
            <p className="text-3xl font-bold text-gray-900">{miningStatus?.mining_rate?.toFixed(2) || '0.00'}/hr</p>
          </Card>

          <Card data-testid="active-referrals-card" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <p className="text-sm text-gray-600 mb-1">Active Referrals</p>
            <p className="text-3xl font-bold text-gray-900">{miningStatus?.active_referrals || 0}/200</p>
          </Card>
        </div>

        {/* Mining Controls */}
        <Card data-testid="mining-controls" className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg">
          <div className="text-center">
            {!isMining ? (
              <Button
                data-testid="start-mining-btn"
                onClick={startMining}
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-12 py-6 rounded-full text-xl font-semibold shadow-xl hover:shadow-2xl transition-all"
              >
                <Play className="mr-2 h-6 w-6" />
                Start Mining
              </Button>
            ) : (
              <div>
                <div className="mb-6">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full mb-4 pulse-slow">
                    <Zap className="h-10 w-10 text-white" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">Mining Active</p>
                  <p className="text-gray-600 mt-2">Time elapsed: {Math.floor(timer / 60)}h {timer % 60}m</p>
                </div>
                
                <Button
                  data-testid="claim-coins-btn"
                  onClick={claimCoins}
                  size="lg"
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-12 py-6 rounded-full text-xl font-semibold shadow-xl hover:shadow-2xl transition-all"
                >
                  <Coins className="mr-2 h-6 w-6" />
                  Claim Coins
                </Button>
              </div>
            )}
          </div>

          {/* Mining Formula Info */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Mining Formula</h3>
            <div className="bg-purple-50 p-4 rounded-xl">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Mining Rate =</span> (Current Date × Base Rate) + Referral Bonus + Game Bonus
              </p>
              <p className="text-xs text-gray-600 mt-2">
                • Each active referral adds +10% to your base rate (max 200 referrals)
                <br />
                • Base rate decreases by 1 for every 100 new users (minimum 10)
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Mining;