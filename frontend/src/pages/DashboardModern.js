import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { 
  TrendingUp, Star, Gift, ArrowUpRight, Clock,
  Home, UserPlus, Gamepad2, User, Zap, Crown, Eye, EyeOff,
  ChevronRight, Sparkles, ShoppingBag, CreditCard
} from 'lucide-react';
import PRCExpiryTimer from '@/components/PRCExpiryTimer';
import ProfileCompletionPopup from '@/components/ProfileCompletionPopup';
import AppTutorialAdvanced from '@/components/AppTutorialAdvanced';
import AIChatbotEnhanced from '@/components/AIChatbotEnhanced';
import { useLanguage } from '@/contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL || '';

// Bottom Navigation Item
const BottomNavItem = ({ icon: Icon, label, isActive, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center py-2 px-3 transition-all ${
      isActive ? 'text-amber-500' : 'text-gray-400'
    }`}
  >
    <Icon className={`w-5 h-5 mb-1 ${isActive ? 'text-amber-500' : ''}`} />
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

const DashboardModern = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [showBalance, setShowBalance] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [globalActivity, setGlobalActivity] = useState([]);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [miningHistory, setMiningHistory] = useState([]);
  const [birthdayGreeting, setBirthdayGreeting] = useState(null);

  // Stats
  const [stats, setStats] = useState({
    prcBalance: 0,
    totalMined: 0,
    referralCount: 0,
    membershipType: 'free'
  });

  // Check tutorial on mount
  useEffect(() => {
    const tutorialCompleted = localStorage.getItem('tutorial_completed');
    if (!tutorialCompleted && user?.uid) {
      setShowTutorial(true);
    }
  }, [user]);

  // Fetch dashboard data
  useEffect(() => {
    if (user?.uid) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Try to fetch user data from API
      try {
        const userResponse = await axios.get(`${API}/api/user/${user.uid}`);
        const fetchedUserData = userResponse.data;
        setUserData(fetchedUserData);
        setMiningHistory(fetchedUserData.mining_history || []);
        
        // Set stats from API response
        setStats({
          prcBalance: fetchedUserData.prc_balance || 0,
          totalMined: fetchedUserData.total_mined || 0,
          referralCount: fetchedUserData.referral_count || 0,
          membershipType: fetchedUserData.membership_type || 'free'
        });
      } catch (apiError) {
        // Fallback to user prop data if API fails
        console.log('Using fallback user data');
        setUserData(user);
        setStats({
          prcBalance: user.prc_balance || 0,
          totalMined: user.total_mined || 0,
          referralCount: user.referral_count || 0,
          membershipType: user.membership_type || 'free'
        });
      }

      // Fetch comprehensive recent activity
      try {
        const activityResponse = await axios.get(`${API}/api/user/${user.uid}/recent-activity?limit=10`);
        const activities = activityResponse.data.activities || [];
        // Format activities for display
        const formattedActivities = activities.map(activity => ({
          type: activity.type,
          description: activity.description,
          amount: activity.amount || 0,
          timestamp: activity.timestamp || new Date().toISOString(),
          icon: activity.icon
        }));
        setRecentTransactions(formattedActivities);
      } catch (activityError) {
        // Fallback to transactions if activity API fails
        try {
          const txResponse = await axios.get(`${API}/api/transactions/${user.uid}?page=1&per_page=5`);
          const transactions = txResponse.data.transactions || txResponse.data || [];
          setRecentTransactions(transactions);
        } catch (txError) {
          // Final fallback to mining history
          console.log('Activity APIs failed, using mining history');
          const miningHistory = userData?.mining_history || user?.mining_history || [];
          const formattedHistory = miningHistory.slice(0, 5).map((h, i) => ({
            type: 'mining_reward',
            description: 'Daily Rewards',
            amount: h.prc_earned || h.amount || 0,
            timestamp: h.timestamp || h.date || new Date().toISOString()
          }));
          setRecentTransactions(formattedHistory);
        }
      }

      // Check profile completion
      const currentUser = userData || user;
      const profileComplete = currentUser?.name && currentUser?.phone && currentUser?.city;
      if (!profileComplete && !localStorage.getItem('profile_popup_dismissed')) {
        setShowProfilePopup(true);
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigation = (tabName) => {
    setActiveTab(tabName);
    const routes = {
      'home': '/dashboard',
      'rewards': '/daily-rewards',
      'game': '/game',
      'profile': '/profile'
    };
    if (routes[tabName]) {
      navigate(routes[tabName]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-amber-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
      
      {/* Tutorial */}
      {showTutorial && (
        <AppTutorialAdvanced 
          user={user}
          onComplete={() => {
            setShowTutorial(false);
            localStorage.setItem('tutorial_completed', 'true');
          }}
        />
      )}

      {/* Profile Completion Popup */}
      {showProfilePopup && (
        <ProfileCompletionPopup 
          user={userData}
          onClose={() => {
            setShowProfilePopup(false);
            localStorage.setItem('profile_popup_dismissed', 'true');
          }}
          onComplete={() => navigate('/profile')}
        />
      )}

      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Welcome back,</p>
            <h1 className="text-white text-xl font-bold">
              {userData?.name || user?.email?.split('@')[0] || 'User'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {stats.membershipType === 'vip' && (
              <div className="bg-gradient-to-r from-amber-500 to-yellow-500 px-3 py-1 rounded-full">
                <span className="text-xs font-bold text-black flex items-center gap-1">
                  <Crown className="w-3 h-3" /> VIP
                </span>
              </div>
            )}
            <button 
              onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center"
            >
              <User className="w-5 h-5 text-black" />
            </button>
          </div>
        </div>
      </div>

      {/* Premium PRC Card - Credit Card Style */}
      <div className="px-5 mb-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-6"
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(212, 175, 55, 0.1)'
          }}
        >
          {/* Card Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-500 to-transparent rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-yellow-500 to-transparent rounded-full blur-3xl"></div>
          </div>

          {/* Card Content */}
          <div className="relative z-10">
            {/* Top Row - Logo & Toggle */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-black" />
                </div>
                <div>
                  <p className="text-amber-400 text-xs font-semibold tracking-wider">PARAS REWARD</p>
                  <p className="text-gray-500 text-[10px]">PREMIUM CARD</p>
                </div>
              </div>
              <button 
                onClick={() => setShowBalance(!showBalance)}
                className="text-gray-400 hover:text-amber-400 transition-colors"
              >
                {showBalance ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </button>
            </div>

            {/* Balance */}
            <div className="mb-8">
              <p className="text-gray-400 text-xs mb-1">Available Balance</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
                  {showBalance ? stats.prcBalance.toFixed(2) : '••••••'}
                </span>
                <span className="text-amber-500 text-lg font-medium">PRC</span>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Total Earned</p>
                <p className="text-white font-bold">{showBalance ? stats.totalMined.toFixed(0) : '••••'}</p>
              </div>
              <div className="text-center border-x border-gray-700">
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Friends</p>
                <p className="text-white font-bold">{stats.referralCount}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Status</p>
                <p className={`font-bold ${stats.membershipType === 'vip' ? 'text-amber-400' : 'text-gray-400'}`}>
                  {stats.membershipType === 'vip' ? 'VIP' : 'FREE'}
                </p>
              </div>
            </div>

            {/* Card Chip Design */}
            <div className="absolute top-6 right-6">
              <div className="w-12 h-9 rounded-md bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 opacity-80">
                <div className="w-full h-full grid grid-cols-4 gap-px p-1">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-amber-700/30 rounded-sm"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* PRC Expiry Warning for Free Users */}
          {stats.membershipType !== 'vip' && stats.prcBalance > 0 && (
            <div className="relative z-10 mt-4 pt-4 border-t border-gray-700/50">
              <PRCExpiryTimer 
                userId={user?.uid}
                prcBalance={stats.prcBalance}
                miningHistory={miningHistory}
              />
            </div>
          )}
        </motion.div>
      </div>

      {/* Quick Actions */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: Star, label: 'Rewards', route: '/daily-rewards', gradient: 'from-purple-600 to-violet-700' },
            { icon: Gamepad2, label: 'Play', route: '/game', gradient: 'from-pink-600 to-rose-700' },
            { icon: UserPlus, label: 'Invite', route: '/referrals', gradient: 'from-blue-600 to-indigo-700' },
            { icon: ShoppingBag, label: 'Shop', route: '/marketplace', gradient: 'from-emerald-600 to-teal-700' },
          ].map((action, index) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => navigate(action.route)}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl bg-gradient-to-br ${action.gradient} shadow-lg`}
            >
              <action.icon className="w-6 h-6 text-white mb-2" />
              <span className="text-[11px] font-semibold text-white">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* VIP Upgrade Banner (for non-VIP users) */}
      {stats.membershipType !== 'vip' && (
        <div className="px-5 mb-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden rounded-2xl p-5"
            style={{
              background: 'linear-gradient(135deg, #92400e 0%, #78350f 50%, #451a03 100%)'
            }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/20 rounded-full blur-2xl"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-yellow-400" />
                  <span className="text-yellow-400 font-bold">Upgrade to VIP</span>
                </div>
                <p className="text-amber-100/80 text-sm">2x Rewards • No Expiry • Premium Features</p>
              </div>
              <button 
                onClick={() => navigate('/vip')}
                className="bg-gradient-to-r from-yellow-400 to-amber-500 text-black px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1"
              >
                ₹299 <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="px-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg">Recent Activity</h2>
          <button 
            onClick={() => navigate('/transactions')}
            className="text-amber-500 text-sm font-medium flex items-center gap-1"
          >
            View All <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden">
          {recentTransactions.length === 0 ? (
            <div className="text-center py-10">
              <Clock className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-gray-500">No activity yet</p>
              <button 
                onClick={() => navigate('/daily-rewards')}
                className="mt-3 text-amber-500 text-sm font-medium"
              >
                Start Earning →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {recentTransactions.slice(0, 4).map((tx, index) => (
                <div key={index} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                      tx.amount > 0 ? 'bg-emerald-500/20' : tx.amount < 0 ? 'bg-red-500/20' : 'bg-blue-500/20'
                    }`}>
                      {tx.icon ? (
                        <span>{tx.icon}</span>
                      ) : tx.amount > 0 ? (
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                      ) : tx.amount < 0 ? (
                        <ShoppingBag className="w-5 h-5 text-red-400" />
                      ) : (
                        <Clock className="w-5 h-5 text-blue-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">
                        {(tx.description || tx.type || 'Activity').replace(/mining/gi, 'rewards')}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : 'Today'}
                      </p>
                    </div>
                  </div>
                  {tx.amount !== undefined && tx.amount !== 0 && (
                    <p className={`font-bold ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount?.toFixed(2)} PRC
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Chatbot */}
      <AIChatbotEnhanced 
        user={user}
        isVip={stats.membershipType === 'vip'}
      />

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 z-50">
        <div className="flex items-center justify-around py-2 px-4 max-w-lg mx-auto">
          <BottomNavItem 
            icon={Home} 
            label="Home" 
            isActive={activeTab === 'home'} 
            onClick={() => handleNavigation('home')}
          />
          <BottomNavItem 
            icon={Star} 
            label="Rewards" 
            isActive={activeTab === 'rewards'} 
            onClick={() => handleNavigation('rewards')}
          />
          <BottomNavItem 
            icon={Gamepad2} 
            label="Play" 
            isActive={activeTab === 'game'} 
            onClick={() => handleNavigation('game')}
          />
          <BottomNavItem 
            icon={User} 
            label="Profile" 
            isActive={activeTab === 'profile'} 
            onClick={() => handleNavigation('profile')}
          />
        </div>
      </div>
    </div>
  );
};

export default DashboardModern;
