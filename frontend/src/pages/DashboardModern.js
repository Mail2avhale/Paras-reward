import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  TrendingUp, Users, ShoppingBag, User, Coins, 
  Zap, Gift, ArrowUpRight, Clock, CheckCircle,
  Home, Store, UserPlus, Gamepad2, CreditCard
} from 'lucide-react';
import PRCExpiryTimer from '@/components/PRCExpiryTimer';
import ProfileCompletionBanner from '@/components/ProfileCompletionBanner';
import ProfileCompletionPopup from '@/components/ProfileCompletionPopup';
import QuickKYCModal from '@/components/QuickKYCModal';
import PRCRain from '@/components/PRCRain';

const API = process.env.REACT_APP_BACKEND_URL || '';

const DashboardModern = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    prcBalance: 0,
    totalMined: 0,
    referralCount: 0,
    membershipType: 'free',
    totalPrcUsed: 0,
    totalPrcUsedValue: 0
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [miningHistory, setMiningHistory] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 5,
    total: 0,
    total_pages: 1,
    has_next: false,
    has_prev: false
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showKYCModal, setShowKYCModal] = useState(false);
  const [userData, setUserData] = useState(null);

  // Check if should show profile completion popup
  useEffect(() => {
    if (user?.uid) {
      const lastSkipped = localStorage.getItem('profile_popup_skipped');
      const skipDuration = 24 * 60 * 60 * 1000; // 24 hours
      
      if (!lastSkipped || (Date.now() - parseInt(lastSkipped)) > skipDuration) {
        // Show popup after a short delay
        setTimeout(() => {
          setShowProfilePopup(true);
        }, 2000);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user?.uid) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch user data
      const userResponse = await axios.get(`${API}/api/users/${user.uid}`);
      const fetchedUserData = userResponse.data;
      setUserData(fetchedUserData);
      
      // Fetch redeemed PRC stats
      let redeemedStats = { total_prc_used: 0, total_rupee_value: 0 };
      try {
        const redeemedResponse = await axios.get(`${API}/api/user/stats/redeemed/${user.uid}`);
        redeemedStats = redeemedResponse.data;
      } catch (error) {
        console.error('Error fetching redeemed stats:', error);
      }
      
      setStats({
        prcBalance: fetchedUserData.prc_balance || 0,
        totalMined: fetchedUserData.total_mined || 0,
        referralCount: fetchedUserData.referral_count || 0,
        membershipType: fetchedUserData.membership_type || 'free',
        totalPrcUsed: redeemedStats.total_prc_used || 0,
        totalPrcUsedValue: redeemedStats.total_rupee_value || 0
      });
      
      setMiningHistory(fetchedUserData.mining_history || []);

      // Fetch recent transactions with pagination (5 per page)
      try {
        const transactionsResponse = await axios.get(`${API}/api/transactions/user/${user.uid}?page=${pagination.page}&limit=5`);
        setRecentTransactions(transactionsResponse.data.transactions || []);
        setPagination(transactionsResponse.data.pagination || pagination);
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setRecentTransactions([]);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactionsPage = async (page) => {
    try {
      const transactionsResponse = await axios.get(`${API}/api/transactions/user/${user.uid}?page=${page}&limit=5`);
      setRecentTransactions(transactionsResponse.data.transactions || []);
      setPagination(transactionsResponse.data.pagination || pagination);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handlePageChange = (newPage) => {
    fetchTransactionsPage(newPage);
  };

  const QuickActionButton = ({ icon: Icon, label, onClick, color = 'purple' }) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-4 bg-gradient-to-br from-${color}-500 to-${color}-600 rounded-2xl text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200`}
    >
      <Icon className="w-8 h-8 mb-2" />
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );

  const BottomNavItem = ({ icon: Icon, label, tabName, isActive, isCenterButton = false }) => (
    <button
      onClick={() => {
        setActiveTab(tabName);
        if (tabName === 'home') {
          navigate('/dashboard');
        } else if (tabName === 'mine') {
          navigate('/mining');
        } else if (tabName === 'game') {
          navigate('/game');
        } else if (tabName === 'shop') {
          navigate('/marketplace');
        } else if (tabName === 'refer') {
          navigate('/referrals');
        } else if (tabName === 'profile') {
          navigate('/profile');
        }
      }}
      className={`flex flex-col items-center justify-center flex-1 py-3 transition-colors ${
        isCenterButton 
          ? 'relative -mt-6' 
          : ''
      } ${
        isActive 
          ? 'text-purple-600' 
          : 'text-gray-500 hover:text-purple-500'
      }`}
    >
      {isCenterButton ? (
        <div className="bg-gradient-to-br from-purple-600 to-blue-500 p-4 rounded-full shadow-2xl">
          <Icon className={`w-8 h-8 text-white ${isActive ? 'animate-bounce' : ''}`} />
        </div>
      ) : (
        <>
          <Icon className={`w-6 h-6 mb-1 ${isActive ? 'animate-bounce' : ''}`} />
          <span className="text-xs font-medium">{label}</span>
        </>
      )}
    </button>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-500 to-indigo-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-lg">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 pb-24">
      {/* PRC Rain Drop Component */}
      <PRCRain user={user} onComplete={() => fetchDashboardData()} />
      
      {/* Header Section - Matching App Theme */}
      <div 
        className="text-white pt-20 pb-36 px-4"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 50%, #3b82f6 100%)'
        }}
      >
        <div className="max-w-md mx-auto">
          {/* User Name - Prominent Display */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-xl font-semibold text-white tracking-wide">
              {user?.name || 'User'}
            </h1>
            <div className="flex items-center gap-2">
              {stats.membershipType === 'vip' && (
                <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1 shadow-lg">
                  <Zap className="w-4 h-4" />
                  VIP
                </div>
              )}
            </div>
          </div>

          {/* PRC Balance - Clean Circular Design */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative">
              {/* Outer Glow Ring */}
              <div className="absolute inset-0 rounded-full bg-blue-400/20 blur-xl scale-110"></div>
              
              {/* Outer Ring */}
              <div className="relative w-52 h-52 rounded-full bg-gradient-to-br from-blue-400/30 to-purple-400/30 p-1.5 shadow-2xl">
                {/* Middle Ring */}
                <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-300/20 to-purple-300/20 p-1">
                  {/* Inner White Circle */}
                  <div className="w-full h-full rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
                    {/* PRC Icon */}
                    <div className="mb-2">
                      <Coins className="w-8 h-8 text-purple-500" />
                    </div>
                    {/* Balance Amount */}
                    <div className="text-4xl font-bold text-purple-900 tracking-tight">
                      {stats.prcBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                    </div>
                    {/* Label */}
                    <div className="text-sm font-semibold text-purple-500 mt-1">
                      PRC Balance
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Rupee Conversion Value */}
            <div className="mt-6 bg-white/15 backdrop-blur-md px-8 py-3 rounded-2xl border border-white/20">
              <p className="text-white text-xl font-bold text-center">
                ≈ ₹{(stats.prcBalance / 10).toFixed(2)}
              </p>
              <p className="text-white/70 text-xs text-center mt-1">
                (10 PRC = ₹1)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 -mt-20">
        {/* Profile Completion Banner */}
        <ProfileCompletionBanner 
          user={userData} 
          onQuickKYC={() => setShowKYCModal(true)}
        />

        {/* PRC Expiry Warning (Free Users Only) */}
        <PRCExpiryTimer 
          miningHistory={miningHistory}
          isFreeUser={stats.membershipType !== 'vip'}
        />
        
        {/* Stats Cards - 3 columns */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {/* Total Mined */}
          <div className="bg-white rounded-2xl p-3 shadow-lg">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-lg font-bold text-gray-900 text-center">{stats.totalMined.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
            <div className="text-xs text-gray-500 text-center mt-1">Total Mined</div>
          </div>

          {/* Total PRC Used */}
          <div className="bg-white rounded-2xl p-3 shadow-lg">
            <div className="flex items-center justify-center mb-2">
              <Coins className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-lg font-bold text-gray-900 text-center">{stats.totalPrcUsed.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
            <div className="text-xs text-gray-500 text-center mt-1">PRC Used</div>
            <div className="text-xs text-purple-600 text-center font-medium">≈ ₹{stats.totalPrcUsedValue}</div>
          </div>

          {/* Referrals */}
          <div className="bg-white rounded-2xl p-3 shadow-lg">
            <div className="flex items-center justify-center mb-2">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-lg font-bold text-gray-900 text-center">{stats.referralCount}</div>
            <div className="text-xs text-gray-500 text-center mt-1">Referrals</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <QuickActionButton 
              icon={Zap} 
              label="Mine" 
              onClick={() => navigate('/mining')}
              color="purple"
            />
            <QuickActionButton 
              icon={Gamepad2} 
              label="Tap Game" 
              onClick={() => navigate('/game')}
              color="pink"
            />
            <QuickActionButton 
              icon={Store} 
              label="Shop" 
              onClick={() => {
                if (stats.membershipType !== 'vip') {
                  alert('VIP membership required to shop in marketplace');
                } else {
                  navigate('/marketplace');
                }
              }}
              color="blue"
            />
            <QuickActionButton 
              icon={UserPlus} 
              label="Refer" 
              onClick={() => navigate('/referrals')}
              color="green"
            />
            <QuickActionButton 
              icon={CreditCard} 
              label="Bill Pay" 
              onClick={() => {
                if (stats.membershipType !== 'vip') {
                  alert('VIP membership required to use bill payment services');
                } else {
                  navigate('/bill-payments');
                }
              }}
              color="cyan"
            />
            <QuickActionButton 
              icon={Gift} 
              label="Vouchers" 
              onClick={() => {
                if (stats.membershipType !== 'vip') {
                  alert('VIP membership required to redeem gift vouchers');
                } else {
                  navigate('/gift-vouchers');
                }
              }}
              color="orange"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
            <button 
              onClick={() => navigate('/transactions')}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              View All
            </button>
          </div>
          
          {recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent transactions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((transaction, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      transaction.type === 'mining_reward' ? 'bg-green-100' :
                      transaction.type === 'marketplace_purchase' ? 'bg-blue-100' :
                      transaction.type === 'referral_bonus' ? 'bg-purple-100' :
                      'bg-gray-100'
                    }`}>
                      {transaction.type === 'mining_reward' && <Zap className="w-5 h-5 text-green-600" />}
                      {transaction.type === 'marketplace_purchase' && <ShoppingBag className="w-5 h-5 text-blue-600" />}
                      {transaction.type === 'referral_bonus' && <Gift className="w-5 h-5 text-purple-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {transaction.description || transaction.type}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(transaction.timestamp).toLocaleDateString()} {new Date(transaction.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${
                      transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.amount > 0 ? '+' : ''}{transaction.amount?.toFixed(2) || 0} PRC
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {recentTransactions.length > 0 && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={!pagination.has_prev}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
                  pagination.has_prev
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                Previous
              </button>
              <div className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.total_pages}
              </div>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={!pagination.has_next}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
                  pagination.has_next
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Upgrade to VIP Banner */}
        {stats.membershipType !== 'vip' && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-6 shadow-lg mb-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">Upgrade to VIP!</h3>
                <p className="text-sm text-yellow-50 mb-4">
                  Unlimited mining, higher rates, and exclusive features
                </p>
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm">Only ₹299/month</span>
                </div>
                <button 
                  onClick={() => navigate('/vip')}
                  className="bg-white text-orange-600 px-6 py-2 rounded-full font-bold hover:bg-yellow-50 transition-colors flex items-center gap-2"
                >
                  Upgrade Now
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
              <Zap className="w-16 h-16 opacity-20" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-50">
        <div className="max-w-md mx-auto flex items-center justify-around">
          <BottomNavItem 
            icon={Home} 
            label="Home" 
            tabName="home" 
            isActive={activeTab === 'home'} 
          />
          <BottomNavItem 
            icon={Zap} 
            label="Mine" 
            tabName="mine" 
            isActive={activeTab === 'mine'} 
          />
          <BottomNavItem 
            icon={Gamepad2} 
            label="" 
            tabName="game" 
            isActive={activeTab === 'game'}
            isCenterButton={true}
          />
          <BottomNavItem 
            icon={ShoppingBag} 
            label="Shop" 
            tabName="shop" 
            isActive={activeTab === 'shop'} 
          />
          <BottomNavItem 
            icon={User} 
            label="Profile" 
            tabName="profile" 
            isActive={activeTab === 'profile'} 
          />
        </div>
      </div>

      {/* Profile Completion Popup */}
      <ProfileCompletionPopup
        user={userData}
        isOpen={showProfilePopup}
        onClose={() => setShowProfilePopup(false)}
      />

      {/* Quick KYC Modal */}
      <QuickKYCModal
        user={user}
        isOpen={showKYCModal}
        onClose={() => setShowKYCModal(false)}
        onSuccess={() => {
          fetchDashboardData();
          setShowKYCModal(false);
        }}
      />
    </div>
  );
};

export default DashboardModern;
