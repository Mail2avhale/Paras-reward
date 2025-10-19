import { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Copy, Check, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Referrals = ({ user, onLogout }) => {
  const [referralCode, setReferralCode] = useState(user?.referral_code || '');
  const [referrals, setReferrals] = useState([]);
  const [copied, setCopied] = useState(false);
  const [applyCode, setApplyCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.uid) {
      fetchReferralCode();
      fetchReferrals();
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
      setReferrals(response.data.referrals);
    } catch (error) {
      console.error('Error fetching referrals:', error);
      toast.error('Failed to load referrals');
    }
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast.success('Referral code copied!');
    setTimeout(() => setCopied(false), 2000);
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
    } catch (error) {
      console.error('Error applying referral:', error);
      toast.error(error.response?.data?.detail || 'Failed to apply referral code');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8">Referral Program</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Your Referral Code */}
          <Card data-testid="referral-code-card" className="bg-gradient-to-br from-purple-600 to-pink-600 text-white p-8 rounded-3xl shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 flex items-center">
              <Users className="h-7 w-7 mr-2" />
              Your Referral Code
            </h2>
            <div className="bg-white/20 backdrop-blur-sm p-6 rounded-2xl mb-4">
              {referralCode ? (
                <p className="text-4xl font-bold text-center tracking-wider">{referralCode}</p>
              ) : (
                <p className="text-2xl text-center text-white/70">Loading...</p>
              )}
            </div>
            <Button
              data-testid="copy-code-btn"
              onClick={copyReferralCode}
              disabled={!referralCode}
              className="w-full bg-white text-purple-600 hover:bg-gray-100 py-6 rounded-xl text-lg font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-5 w-5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-5 w-5" />
                  Copy Code
                </>
              )}
            </Button>

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