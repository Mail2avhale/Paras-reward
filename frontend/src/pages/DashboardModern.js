import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  TrendingUp, Users, ShoppingBag, User, Coins, 
  Zap, Gift, ArrowUpRight, Clock, CheckCircle,
  Home, Store, UserPlus, Gamepad2, CreditCard, HelpCircle,
  Globe, ChevronDown, ArrowUp, ArrowDown
} from 'lucide-react';
import PRCExpiryTimer from '@/components/PRCExpiryTimer';
import ProfileCompletionBanner from '@/components/ProfileCompletionBanner';
import ProfileCompletionPopup from '@/components/ProfileCompletionPopup';
import QuickKYCModal from '@/components/QuickKYCModal';
import PRCRain from '@/components/PRCRain';
import AppTutorial from '@/components/AppTutorial';
import { useLanguage, LANGUAGES } from '@/contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL || '';

const DashboardModern = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { t, language, changeLanguage, currentLanguage, languages } = useLanguage();
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [stats, setStats] = useState({
    prcBalance: 0,
    totalMined: 0,
    referralCount: 0,
    membershipType: 'free',
    totalPrcUsed: 0,
    totalPrcUsedValue: 0
  });
  const [todayStats, setTodayStats] = useState({
    today_prc_earned: 0,
    today_prc_spent: 0,
    today_net: 0
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
  const [showTutorial, setShowTutorial] = useState(false);

  // Check if should show tutorial for first-time users - HIGHEST PRIORITY
  useEffect(() => {
    const tutorialCompleted = localStorage.getItem('tutorial_completed');
    if (!tutorialCompleted && user?.uid) {
      // Show tutorial immediately for first-time users
      setShowTutorial(true);
      // Don't show profile popup during tutorial
      setShowProfilePopup(false);
    }
  }, [user]);

  // Check if should show profile completion popup (only after tutorial)
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
      
      // Fetch today's stats
      try {
        const todayResponse = await axios.get(`${API}/api/user/stats/today/${user.uid}`);
        setTodayStats(todayResponse.data);
      } catch (error) {
        console.error('Error fetching today stats:', error);
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

  // Color mapping for QuickActionButton to ensure Tailwind compiles these classes
  const colorStyles = {
    purple: 'bg-gradient-to-br from-purple-500 to-purple-600',
    pink: 'bg-gradient-to-br from-pink-500 to-pink-600',
    blue: 'bg-gradient-to-br from-blue-500 to-blue-600',
    green: 'bg-gradient-to-br from-green-500 to-green-600',
    teal: 'bg-gradient-to-br from-teal-500 to-emerald-600',
    orange: 'bg-gradient-to-br from-orange-500 to-orange-600',
    indigo: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
  };

  const QuickActionButton = ({ icon: Icon, label, onClick, color = 'purple', customStyle }) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-4 rounded-2xl text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 ${!customStyle ? (colorStyles[color] || colorStyles.purple) : ''}`}
      style={customStyle}
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
      {/* App Tutorial - Shows for first-time users */}
      {showTutorial && (
        <AppTutorial 
          onComplete={() => setShowTutorial(false)} 
          showSkip={true}
        />
      )}
      
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
          {/* User Name & Language Selector Row */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-white tracking-wide">
              {user?.name || 'User'}
            </h1>
            <div className="flex items-center gap-2">
              {/* Language Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowLangDropdown(!showLangDropdown)}
                  className="flex items-center gap-1.5 bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/25 transition-colors"
                  data-testid="language-selector-btn"
                >
                  <Globe className="w-4 h-4 text-white/90" />
                  <span className="text-sm text-white/90">{currentLanguage?.name?.slice(0, 3) || 'EN'}</span>
                  <ChevronDown className={`w-3 h-3 text-white/70 transition-transform ${showLangDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showLangDropdown && (
                  <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 min-w-[140px]">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          changeLanguage(lang.code);
                          setShowLangDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-purple-50 transition-colors ${
                          language === lang.code ? 'bg-purple-100 text-purple-700' : 'text-gray-700'
                        }`}
                        data-testid={`lang-option-${lang.code}`}
                      >
                        <span className="text-lg">{lang.flag}</span>
                        <span className="text-sm font-medium">{lang.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Help Button to replay tutorial */}
              <button
                onClick={() => {
                  localStorage.removeItem('tutorial_completed');
                  setShowTutorial(true);
                }}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                title="App Guide"
              >
                <HelpCircle className="w-5 h-5 text-white/80" />
              </button>
              {stats.membershipType === 'vip' && (
                <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1 shadow-lg">
                  <Zap className="w-4 h-4" />
                  VIP
                </div>
              )}
            </div>
          </div>
          
          {/* Today's Summary Strip */}
          <div className="bg-white/15 backdrop-blur-md rounded-2xl p-3 mb-6 border border-white/20" data-testid="today-summary-strip">
            <div className="flex items-center justify-around">
              {/* Today Earned */}
              <div className="flex items-center gap-2">
                <div className="bg-green-400/30 p-1.5 rounded-full">
                  <ArrowUp className="w-4 h-4 text-green-200" />
                </div>
                <div>
                  <p className="text-xs text-white/70">{t('todayEarned')}</p>
                  <p className="text-base font-bold text-green-300">+{todayStats.today_prc_earned.toLocaleString(undefined, {maximumFractionDigits: 2})} PRC</p>
                </div>
              </div>
              
              {/* Divider */}
              <div className="h-10 w-px bg-white/20"></div>
              
              {/* Today Spent */}
              <div className="flex items-center gap-2">
                <div className="bg-red-400/30 p-1.5 rounded-full">
                  <ArrowDown className="w-4 h-4 text-red-200" />
                </div>
                <div>
                  <p className="text-xs text-white/70">{t('todaySpent')}</p>
                  <p className="text-base font-bold text-red-300">-{todayStats.today_prc_spent.toLocaleString(undefined, {maximumFractionDigits: 2})} PRC</p>
                </div>
              </div>
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
                      {t('prcBalance')}
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
            <div className="text-xs text-gray-500 text-center mt-1">{t('totalMined')}</div>
          </div>

          {/* Total PRC Used */}
          <div className="bg-white rounded-2xl p-3 shadow-lg">
            <div className="flex items-center justify-center mb-2">
              <Coins className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-lg font-bold text-gray-900 text-center">{stats.totalPrcUsed.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
            <div className="text-xs text-gray-500 text-center mt-1">{t('prcUsed')}</div>
            <div className="text-xs text-purple-600 text-center font-medium">≈ ₹{stats.totalPrcUsedValue}</div>
          </div>

          {/* Referrals */}
          <div className="bg-white rounded-2xl p-3 shadow-lg">
            <div className="flex items-center justify-center mb-2">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-lg font-bold text-gray-900 text-center">{stats.referralCount}</div>
            <div className="text-xs text-gray-500 text-center mt-1">{t('referrals')}</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">{t('quickActions')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <QuickActionButton 
              icon={Zap} 
              label={t('mine')} 
              onClick={() => navigate('/mining')}
              color="purple"
            />
            <QuickActionButton 
              icon={Gamepad2} 
              label={t('tapGame')} 
              onClick={() => navigate('/game')}
              color="pink"
            />
            <QuickActionButton 
              icon={Store} 
              label={t('shop')} 
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
              label={t('refer')} 
              onClick={() => navigate('/referrals')}
              color="green"
            />
            <QuickActionButton 
              icon={CreditCard} 
              label={t('billPay')} 
              onClick={() => {
                if (stats.membershipType !== 'vip') {
                  alert('VIP membership required to use bill payment services');
                } else {
                  navigate('/bill-payments');
                }
              }}
              customStyle={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }}
            />
            <QuickActionButton 
              icon={Gift} 
              label={t('vouchers')} 
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
            <h2 className="text-lg font-bold text-gray-900">{t('recentActivity')}</h2>
            <button 
              onClick={() => navigate('/transactions')}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              {t('viewAll')}
            </button>
          </div>
          
          {recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('noActivity')}</p>
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
                <h3 className="text-xl font-bold mb-2">{t('upgradeToVip')}</h3>
                <p className="text-sm text-yellow-50 mb-4">
                  {t('vipBenefitsDesc')}
                </p>
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm">Only ₹299/month</span>
                </div>
                <button 
                  onClick={() => navigate('/vip')}
                  className="bg-white text-orange-600 px-6 py-2 rounded-full font-bold hover:bg-yellow-50 transition-colors flex items-center gap-2"
                >
                  {t('upgradeNow')}
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
            label={t('home')} 
            tabName="home" 
            isActive={activeTab === 'home'} 
          />
          <BottomNavItem 
            icon={Zap} 
            label={t('mine')} 
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
            label={t('shop')} 
            tabName="shop" 
            isActive={activeTab === 'shop'} 
          />
          <BottomNavItem 
            icon={User} 
            label={t('profile')} 
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
