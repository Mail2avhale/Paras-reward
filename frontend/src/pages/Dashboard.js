import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import PRCRain from '@/components/PRCRain';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Coins, Zap, Users, Gift, Trophy, Wallet, Crown, ShieldCheck, Package,
  Smartphone, Tv, CreditCard, Building, ShoppingBag, Activity, Receipt,
  Sparkles, ArrowRight
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [stats, setStats] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  
  // Check if user is admin to hide ads
  const isAdmin = user?.role === 'admin';

  // Redirect based on role
  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin');
    } else if (user?.role === 'manager') {
      navigate('/manager');
    } else if (user?.role === 'master_stockist') {
      navigate('/master-stockist');
    } else if (user?.role === 'sub_stockist') {
      navigate('/sub-stockist');
    } else if (user?.role === 'outlet') {
      navigate('/outlet');
    }
  }, [user, navigate]);

  useEffect(() => {
    fetchUserData();
    fetchMiningStatus();
    fetchQRCode();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await axios.get(`${API}/auth/user/${user.uid}`);
      setUserData(response.data);
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchMiningStatus = async () => {
    try {
      const response = await axios.get(`${API}/mining/status/${user.uid}`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching mining status:', error);
    }
  };

  const fetchQRCode = async () => {
    try {
      const response = await axios.get(`${API}/payment/config`);
      if (response.data.qr_code_url) {
        setQrCode(response.data.qr_code_url);
      }
    } catch (error) {
      console.error('Error fetching QR code:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Navbar user={user} onLogout={onLogout} />
      
      {/* PRC Rain Drop Component */}
      <PRCRain user={user} onComplete={() => fetchUserData()} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div data-testid="dashboard-header" className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">
            Welcome, {userData?.name || user.name}!
          </h1>
          <p className="text-lg text-gray-600">
            {userData?.membership_type === 'vip' ? (
              <span className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full text-sm font-semibold">
                VIP Member ✨
              </span>
            ) : (
              <span className="text-gray-500">Free Member</span>
            )}
          </p>
        </div>

        {/* Balance Card */}
        <Card data-testid="balance-card" className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-8 rounded-3xl shadow-2xl mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 mb-2">Your PRC Balance</p>
              <h2 className="text-5xl font-bold">{userData?.prc_balance?.toFixed(2) || '0.00'}</h2>
              <p className="text-sm opacity-90 mt-2">≈ ₹{((userData?.prc_balance || 0) / 10).toFixed(2)}</p>
            </div>
            <div className="bg-white/20 p-6 rounded-2xl">
              <Coins className="h-16 w-16" />
            </div>
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card data-testid="mining-rate-card" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-100 p-3 rounded-xl">
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Mining Rate</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.mining_rate?.toFixed(2) || '0.00'}/hr</p>
          </Card>

          <Card data-testid="total-mined-card" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-100 p-3 rounded-xl">
                <Coins className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Mined</p>
            <p className="text-2xl font-bold text-gray-900">{userData?.total_mined?.toFixed(2) || '0.00'}</p>
          </Card>

          <Card data-testid="referrals-card" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-pink-100 p-3 rounded-xl">
                <Users className="h-6 w-6 text-pink-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Active Referrals</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.active_referrals || 0}</p>
          </Card>
        </div>

        {/* Quick Actions */}
        <h3 className="text-2xl font-bold text-gray-900 mb-4">Quick Access</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 mb-8">
          <Link to="/mining" className="block">
            <Button data-testid="mining-btn" className="w-full h-32 bg-white/80 backdrop-blur-sm hover:bg-white border-2 border-purple-200 hover:border-purple-400 text-gray-900 rounded-2xl shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-3">
              <Zap className="h-8 w-8 text-purple-600" />
              <span className="font-semibold">Mine</span>
            </Button>
          </Link>

          <Link to="/game" className="block">
            <Button data-testid="game-btn" className="w-full h-32 bg-white/80 backdrop-blur-sm hover:bg-white border-2 border-blue-200 hover:border-blue-400 text-gray-900 rounded-2xl shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-3">
              <Zap className="h-8 w-8 text-blue-600" />
              <span className="font-semibold">Tap Game</span>
            </Button>
          </Link>

          <Link to="/referrals" className="block">
            <Button className="w-full h-32 bg-white/80 backdrop-blur-sm hover:bg-white border-2 border-green-200 hover:border-green-400 text-gray-900 rounded-2xl shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-3">
              <Users className="h-8 w-8 text-green-600" />
              <span className="font-semibold">Referrals</span>
            </Button>
          </Link>

          <Link to="/marketplace" className="block">
            <Button data-testid="marketplace-btn" className="w-full h-32 bg-white/80 backdrop-blur-sm hover:bg-white border-2 border-pink-200 hover:border-pink-400 text-gray-900 rounded-2xl shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-3">
              <Gift className="h-8 w-8 text-pink-600" />
              <span className="font-semibold">Marketplace</span>
            </Button>
          </Link>

          <Link to="/leaderboard" className="block">
            <Button data-testid="leaderboard-btn" className="w-full h-32 bg-white/80 backdrop-blur-sm hover:bg-white border-2 border-orange-200 hover:border-orange-400 text-gray-900 rounded-2xl shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-3">
              <Trophy className="h-8 w-8 text-orange-600" />
              <span className="font-semibold">Leaderboard</span>
            </Button>
          </Link>

          <Link to="/vip" className="block">
            <Button className="w-full h-32 bg-white/80 backdrop-blur-sm hover:bg-white border-2 border-yellow-200 hover:border-yellow-400 text-gray-900 rounded-2xl shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-3">
              <Crown className="h-8 w-8 text-yellow-600" />
              <span className="font-semibold">VIP Membership</span>
            </Button>
          </Link>

          <Link to="/kyc" className="block">
            <Button className="w-full h-32 bg-white/80 backdrop-blur-sm hover:bg-white border-2 border-indigo-200 hover:border-indigo-400 text-gray-900 rounded-2xl shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-3">
              <ShieldCheck className="h-8 w-8 text-indigo-600" />
              <span className="font-semibold">KYC Verification</span>
            </Button>
          </Link>

          <Link to="/orders" className="block">
            <Button className="w-full h-32 bg-white/80 backdrop-blur-sm hover:bg-white border-2 border-teal-200 hover:border-teal-400 text-gray-900 rounded-2xl shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-3">
              <Package className="h-8 w-8 text-teal-600" />
              <span className="font-semibold">My Orders</span>
            </Button>
          </Link>

          <Link to="/activity" className="block">
            <Button className="w-full h-32 bg-white/80 backdrop-blur-sm hover:bg-white border-2 border-cyan-200 hover:border-cyan-400 text-gray-900 rounded-2xl shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-3">
              <Activity className="h-8 w-8 text-cyan-600" />
              <span className="font-semibold">Activity</span>
            </Button>
          </Link>
        </div>

        {/* ========== SERVICES SECTION ========== */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Services
            </h2>
          </div>

          {/* Bill Payments Section */}
          <Card className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-lg mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                Bill Payments
              </h3>
              <Link to="/bill-payments" className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:underline">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-5 gap-3">
              <Link to="/bill-payments?type=mobile_recharge" className="flex flex-col items-center gap-2 p-3 bg-white/80 rounded-xl hover:bg-white hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center">Mobile</span>
              </Link>
              <Link to="/bill-payments?type=dish_recharge" className="flex flex-col items-center gap-2 p-3 bg-white/80 rounded-xl hover:bg-white hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <Tv className="w-6 h-6 text-purple-600" />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center">DTH</span>
              </Link>
              <Link to="/bill-payments?type=electricity_bill" className="flex flex-col items-center gap-2 p-3 bg-white/80 rounded-xl hover:bg-white hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-amber-600" />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center">Electric</span>
              </Link>
              <Link to="/bill-payments?type=credit_card_payment" className="flex flex-col items-center gap-2 p-3 bg-white/80 rounded-xl hover:bg-white hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-green-600" />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center">Card</span>
              </Link>
              <Link to="/bill-payments?type=loan_emi" className="flex flex-col items-center gap-2 p-3 bg-white/80 rounded-xl hover:bg-white hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <Building className="w-6 h-6 text-red-600" />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center">Loan</span>
              </Link>
            </div>
          </Card>

          {/* Gift Vouchers & Shop Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Gift Vouchers Card */}
            <Link to="/gift-vouchers">
              <Card className="p-5 bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200 shadow-lg h-full hover:shadow-xl transition-all">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center mb-3 shadow-lg">
                    <Gift className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">Gift Vouchers</h3>
                  <p className="text-xs text-gray-500">Amazon, Flipkart, Swiggy & more</p>
                  <div className="mt-3 px-3 py-1.5 bg-pink-500 text-white text-xs font-semibold rounded-full">
                    Redeem Now
                  </div>
                </div>
              </Card>
            </Link>

            {/* Shop Card */}
            <Link to="/marketplace">
              <Card className="p-5 bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200 shadow-lg h-full hover:shadow-xl transition-all">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center mb-3 shadow-lg">
                    <ShoppingBag className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">Shop</h3>
                  <p className="text-xs text-gray-500">Exclusive products & deals</p>
                  <div className="mt-3 px-3 py-1.5 bg-purple-500 text-white text-xs font-semibold rounded-full">
                    Explore
                  </div>
                </div>
              </Card>
            </Link>
          </div>
        </div>

        {/* Payment QR Code Section */}
        {qrCode && (
          <Card className="p-6 bg-white/90 backdrop-blur-sm shadow-xl mt-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">Payment QR Code</h3>
            <div className="flex flex-col items-center">
              <img 
                src={qrCode} 
                alt="Payment QR Code" 
                className="w-64 h-64 object-contain border-2 border-purple-200 rounded-xl shadow-lg"
              />
              <p className="text-sm text-gray-600 mt-4 text-center">
                Scan this QR code for UPI payments
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;