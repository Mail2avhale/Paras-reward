import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, Users, ShoppingBag, User, Coins, 
  Zap, Gift, ArrowUpRight, Clock, CheckCircle,
  Home, Store, UserPlus, Gamepad2, CreditCard, HelpCircle,
  Globe, ChevronDown, ArrowUp, ArrowDown, Network, Brain,
  Sparkles, Crown, Wallet, Target, PiggyBank
} from 'lucide-react';
import PRCExpiryTimer from '@/components/PRCExpiryTimer';
import ProfileCompletionBanner from '@/components/ProfileCompletionBanner';
import ProfileCompletionPopup from '@/components/ProfileCompletionPopup';
import QuickKYCModal from '@/components/QuickKYCModal';
import PRCRain from '@/components/PRCRain';
import AppTutorialAdvanced from '@/components/AppTutorialAdvanced';
import LiveMiningIndicator from '@/components/LiveMiningIndicator';
import LiveTransparencyPanel from '@/components/LiveTransparencyPanel';
import SmartUserInsights from '@/components/SmartUserInsights';
import LiveActivityFeed from '@/components/LiveActivityFeed';
import SecurityTrustCenter from '@/components/SecurityTrustCenter';
import LiveStatementExport from '@/components/LiveStatementExport';
import DraggableDashboard, { DashboardCard } from '@/components/DraggableDashboard';
import AIChatbotEnhanced from '@/components/AIChatbotEnhanced';
import AIInsightsWidget from '@/components/AIInsightsWidget';
import AIFinancialSummary from '@/components/AIFinancialSummary';
import AIStatsCard from '@/components/AIStatsCard';
import QuickActionsGrid from '@/components/QuickActionsGrid';
import { useLanguage, LANGUAGES } from '@/contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL || '';

// Default card order for the dashboard (removed user-controls - admin feature only)
const DEFAULT_CARD_ORDER = [
  'ai-financial-summary',
  'ai-stats-grid',
  'ai-insights',
  'quick-actions-grid',
  'recent-activity',
  'security-trust',
  'activity-feed',
  'vip-banner'
];

// Color mapping for QuickActionButton
const colorStyles = {
  purple: 'bg-gradient-to-br from-purple-500 to-purple-600',
  pink: 'bg-gradient-to-br from-pink-500 to-pink-600',
  blue: 'bg-gradient-to-br from-blue-500 to-blue-600',
  green: 'bg-gradient-to-br from-green-500 to-green-600',
  teal: 'bg-gradient-to-br from-teal-500 to-emerald-600',
  orange: 'bg-gradient-to-br from-orange-500 to-orange-600',
  indigo: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
};

// QuickActionButton component moved outside
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

// BottomNavItem component moved outside - needs navigate and setActiveTab as props
const BottomNavItem = ({ icon: Icon, label, tabName, isActive, isCenterButton = false, onNavigate }) => (
  <button
    onClick={() => onNavigate(tabName)}
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
  
  // Dashboard card order state
  const [cardOrder, setCardOrder] = useState(() => {
    const saved = localStorage.getItem('dashboard_card_order');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate that all default cards are present
        const hasAllCards = DEFAULT_CARD_ORDER.every(card => parsed.includes(card));
        if (hasAllCards && parsed.length === DEFAULT_CARD_ORDER.length) {
          return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse saved card order');
      }
    }
    return DEFAULT_CARD_ORDER;
  });

  // Handle card order change
  const handleCardOrderChange = (newOrder) => {
    setCardOrder(newOrder);
    localStorage.setItem('dashboard_card_order', JSON.stringify(newOrder));
    toast.success(t('saveLayout') + ' ✓');
  };

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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-white text-center"
        >
          <motion.div 
            className="relative w-20 h-20 mx-auto mb-6"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          >
            <div className="absolute inset-0 rounded-full border-4 border-purple-500/30"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-white"></div>
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Brain className="w-8 h-8 text-white" />
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <p className="text-lg font-semibold">AI Dashboard Loading...</p>
            <p className="text-sm text-purple-300 mt-1">Analyzing your data</p>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50 pb-24">
      {/* App Tutorial - Shows for first-time users */}
      {showTutorial && (
        <AppTutorialAdvanced 
          onComplete={() => setShowTutorial(false)} 
          showSkip={true}
        />
      )}
      
      {/* PRC Rain Drop Component */}
      <PRCRain user={user} onComplete={() => fetchDashboardData()} />
      
      {/* Modern Header Section with Glass Morphism */}
      <div className="relative overflow-hidden">
        {/* Background with modern gradient */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, #4c1d95 60%, #5b21b6 100%)'
          }}
        />
        
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div 
            className="absolute -top-20 -right-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ repeat: Infinity, duration: 4 }}
          />
          <motion.div 
            className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.5, 0.3, 0.5] }}
            transition={{ repeat: Infinity, duration: 4 }}
          />
        </div>
        
        <div className="relative text-white pt-20 pb-32 px-4">
          <div className="max-w-md mx-auto">
            {/* User Name & Controls Row */}
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between mb-6"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center shadow-lg">
                  <span className="text-lg font-bold">{(user?.name || 'U')[0].toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-sm text-purple-200">Welcome back</p>
                  <h1 className="text-lg font-bold text-white">{user?.name || 'User'}</h1>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* AI Badge */}
                <motion.div 
                  className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <Brain className="w-4 h-4 text-purple-300" />
                  <span className="text-xs text-white/90">AI Powered</span>
                </motion.div>
                
                {/* Language Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowLangDropdown(!showLangDropdown)}
                    className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/20 transition-colors"
                    data-testid="language-selector-btn"
                  >
                    <Globe className="w-4 h-4 text-white/90" />
                    <span className="text-xs text-white/90">{currentLanguage?.name?.slice(0, 2) || 'EN'}</span>
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
                
                {/* VIP Badge */}
                {stats.membershipType === 'vip' && (
                  <motion.div 
                    className="bg-gradient-to-r from-amber-400 to-orange-500 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg"
                    whileHover={{ scale: 1.05 }}
                  >
                    <Crown className="w-3 h-3" />
                    VIP
                  </motion.div>
                )}
              </div>
            </motion.div>
            
            {/* Main Balance Card - Modern Glass Design */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl"
            >
              {/* Sparkle decoration */}
              <motion.div 
                className="absolute top-4 right-4"
                animate={{ rotate: [0, 180, 360], scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 3 }}
              >
                <Sparkles className="w-5 h-5 text-yellow-300/60" />
              </motion.div>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-purple-200">Total Balance</p>
                  <p className="text-[10px] text-purple-300">10 PRC = ₹1</p>
                </div>
              </div>
              
              <div className="mb-4">
                <motion.div 
                  className="text-4xl font-bold text-white tracking-tight"
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                >
                  {stats.prcBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  <span className="text-lg text-purple-300 ml-2">PRC</span>
                </motion.div>
                <p className="text-xl text-green-400 font-semibold mt-1">
                  ≈ ₹{(stats.prcBalance / 10).toFixed(2)}
                </p>
              </div>
              
              {/* Mini Stats Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <TrendingUp className="w-4 h-4 text-green-400 mx-auto mb-1" />
                  <p className="text-sm font-bold text-white">{stats.totalMined.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                  <p className="text-[10px] text-purple-300">Mined</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <Coins className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                  <p className="text-sm font-bold text-white">{stats.totalPrcUsed.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                  <p className="text-[10px] text-purple-300">Used</p>
                </div>
                <div 
                  className="bg-white/10 rounded-xl p-3 text-center cursor-pointer hover:bg-white/20 transition-colors"
                  onClick={() => navigate('/network')}
                >
                  <Network className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
                  <p className="text-sm font-bold text-white">{stats.referralCount}</p>
                  <p className="text-[10px] text-purple-300">Network</p>
                </div>
              </div>
              
              {/* Mining Status */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <LiveMiningIndicator 
                  isMining={userData?.mining_active || false}
                  miningEndTime={userData?.mining_session_end}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 -mt-8 pb-24 relative z-10">
        {/* Profile Completion Banner - Not draggable */}
        <ProfileCompletionBanner 
          user={userData} 
          onQuickKYC={() => setShowKYCModal(true)}
        />

        {/* PRC Expiry Warning (Free Users Only) - Not draggable */}
        <PRCExpiryTimer 
          miningHistory={miningHistory}
          isFreeUser={stats.membershipType !== 'vip'}
        />
        
        {/* AI Financial Summary - Key Feature */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-4"
        >
          <AIFinancialSummary 
            userId={user?.uid}
            stats={stats}
            todayStats={todayStats}
          />
        </motion.div>

        {/* AI Insights Widget */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-4"
        >
          <AIInsightsWidget 
            userId={user?.uid}
            userStats={{
              prc_balance: stats.prcBalance,
              today_earned: todayStats.today_prc_earned,
              yesterday_earned: 0,
              mining_streak: userData?.mining_streak || 0,
              is_vip: stats.membershipType === 'vip',
              is_mining_active: userData?.mining_active || false,
              referral_count: stats.referralCount,
              total_mined: stats.totalMined
            }}
            onActionClick={(path) => navigate(path)}
          />
        </motion.div>

        {/* Quick Actions Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-4"
        >
          <QuickActionsGrid 
            isVip={stats.membershipType === 'vip'}
            onVipRequired={() => toast.info('VIP membership required. Upgrade now!')}
          />
        </motion.div>
        
        {/* Draggable Dashboard Cards */}
        <DraggableDashboard
          cardIds={cardOrder}
          onOrderChange={handleCardOrderChange}
          lockedCards={['vip-banner']}
          translations={{
            customizeDashboard: t('customizeDashboard'),
            dragToReorder: t('dragToReorder'),
            saveLayout: t('saveLayout'),
            resetLayout: t('resetLayout')
          }}
        >
          {/* AI Stats Grid - Modern Bento Style */}
          <DashboardCard cardId="ai-stats-grid">
            <div className="grid grid-cols-2 gap-3">
              <AIStatsCard 
                icon={TrendingUp}
                label={t('totalMined')}
                value={stats.totalMined}
                subValue="Lifetime earnings"
                gradient="from-green-500 to-emerald-600"
                delay={0}
              />
              <AIStatsCard 
                icon={Coins}
                label={t('prcUsed')}
                value={stats.totalPrcUsed}
                subValue={`≈ ₹${stats.totalPrcUsedValue}`}
                gradient="from-purple-500 to-indigo-600"
                delay={1}
              />
              <AIStatsCard 
                icon={ArrowUpRight}
                label="Today Earned"
                value={todayStats.today_prc_earned.toFixed(1)}
                subValue="PRC today"
                change={todayStats.today_prc_earned > 0 ? 12 : 0}
                changeLabel="vs avg"
                gradient="from-blue-500 to-cyan-600"
                delay={2}
              />
              <AIStatsCard 
                icon={Network}
                label="AI Network"
                value={stats.referralCount}
                subValue="Total referrals"
                gradient="from-indigo-500 to-purple-600"
                delay={3}
                onClick={() => navigate('/network')}
              />
            </div>
          </DashboardCard>

          {/* AI Insights Section - Already shown above, this is for draggable order */}
          <DashboardCard cardId="ai-insights">
            <SmartUserInsights 
              userId={user?.uid}
              userStats={{
                prc_balance: stats.prcBalance,
                today_earned: todayStats.today_prc_earned,
                yesterday_earned: 0,
                mining_streak: userData?.mining_streak || 0,
                is_vip: stats.membershipType === 'vip',
                referral_count: stats.referralCount,
                total_mined: stats.totalMined
              }}
              translations={{}}
            />
          </DashboardCard>

          {/* Quick Actions Grid - Already shown above */}
          <DashboardCard cardId="quick-actions-grid">
            <div className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100">
              <h3 className="font-bold text-gray-900 text-lg mb-4">{t('quickActions')}</h3>
              <div className="grid grid-cols-3 gap-3">
                <motion.button 
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/mining')}
                  className="flex flex-col items-center p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg"
                >
                  <Zap className="w-6 h-6 text-white mb-2" />
                  <span className="text-xs font-bold text-white">{t('mine')}</span>
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/game')}
                  className="flex flex-col items-center p-4 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg"
                >
                  <Gamepad2 className="w-6 h-6 text-white mb-2" />
                  <span className="text-xs font-bold text-white">{t('tapGame')}</span>
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/network')}
                  className="flex flex-col items-center p-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg"
                >
                  <UserPlus className="w-6 h-6 text-white mb-2" />
                  <span className="text-xs font-bold text-white">Network</span>
                </motion.button>
              </div>
            </div>
          </DashboardCard>


          {/* Recent Activity */}
          <DashboardCard cardId="recent-activity">
            <div className="bg-white rounded-2xl p-6 shadow-lg">
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
          </DashboardCard>

          {/* Phase 3: Security & Trust Center */}
          <DashboardCard cardId="security-trust">
            <SecurityTrustCenter 
              userId={user?.uid}
              user={userData}
              translations={{}}
            />
          </DashboardCard>

          {/* Phase 3: Live Statement Export */}
          <DashboardCard cardId="statement-export">
            <LiveStatementExport 
              userId={user?.uid}
              translations={{}}
            />
          </DashboardCard>

          {/* Live Activity Feed */}
          <DashboardCard cardId="activity-feed">
            <LiveActivityFeed 
              translations={{
                liveActivity: t('liveActivity') || 'लाइव Activity',
                userFrom: t('userFrom') || 'User from'
              }}
            />
          </DashboardCard>

          {/* Upgrade to VIP Banner */}
          <DashboardCard cardId="vip-banner">
            {stats.membershipType !== 'vip' && (
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-6 shadow-lg text-white">
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
          </DashboardCard>
        </DraggableDashboard>
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

      {/* AI Chatbot - Always visible floating button */}
      {user && (
        <AIChatbotEnhanced user={user} userStats={stats} />
      )}
    </div>
  );
};

export default DashboardModern;
