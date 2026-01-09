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

      // Fetch global live activity (bill, voucher, shopping)
      try {
        const globalResponse = await axios.get(`${API}/api/global/live-activity?limit=10`);
        setGlobalActivity(globalResponse.data.activities || []);
      } catch (globalError) {
        console.log('Global activity fetch failed');
      }

      // Check for birthday
      try {
        const birthdayResponse = await axios.get(`${API}/api/user/${user.uid}/birthday-check`);
        if (birthdayResponse.data.is_birthday) {
          setBirthdayGreeting(birthdayResponse.data);
        }
      } catch (bdError) {
        console.log('Birthday check failed');
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

      {/* Premium 3D Credit Card */}
      <div className="px-5 mb-6" style={{ perspective: '1500px' }}>
        <motion.div 
          initial={{ opacity: 0, rotateX: 20 }}
          animate={{ opacity: 1, rotateX: 0 }}
          whileHover={{ rotateY: 3, rotateX: -2, scale: 1.01 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: 'linear-gradient(145deg, #1c1c1c 0%, #0d0d0d 30%, #1a1a1a 70%, #0a0a0a 100%)',
            boxShadow: `
              0 25px 50px -12px rgba(0, 0, 0, 0.8),
              inset 0 1px 0 rgba(255, 255, 255, 0.05)
            `,
            transformStyle: 'preserve-3d',
            aspectRatio: '1.586',
            border: '1.5px solid rgba(212, 175, 55, 0.3)'
          }}
        >
          {/* Animated gold border glow */}
          <div 
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              background: 'transparent',
              boxShadow: '0 0 20px rgba(212, 175, 55, 0.15), inset 0 0 20px rgba(212, 175, 55, 0.05)',
              animation: 'borderPulse 3s ease-in-out infinite'
            }}
          />

          {/* Background Graphics - HIGHLY VISIBLE */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Large golden circle - top right */}
            <div 
              className="absolute -right-10 -top-10 w-48 h-48 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(212, 175, 55, 0.5) 0%, rgba(212, 175, 55, 0.25) 40%, transparent 70%)',
              }}
            />
            
            {/* Medium circle - bottom right */}
            <div 
              className="absolute right-8 -bottom-8 w-36 h-36 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(255, 215, 0, 0.4) 0%, rgba(255, 215, 0, 0.2) 50%, transparent 70%)',
              }}
            />
            
            {/* Small accent circle - left */}
            <div 
              className="absolute -left-6 top-1/2 -translate-y-1/2 w-24 h-24 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(212, 175, 55, 0.35) 0%, transparent 60%)',
              }}
            />
            
            {/* Additional circle - center-left area */}
            <div 
              className="absolute left-1/4 top-1/4 w-28 h-28 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(255, 215, 0, 0.25) 0%, transparent 60%)',
              }}
            />

            {/* Horizontal gold line - thicker and more visible */}
            <div 
              className="absolute left-0 right-0 top-[45%] h-[2px]"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(212, 175, 55, 0.4) 20%, rgba(212, 175, 55, 0.6) 50%, rgba(212, 175, 55, 0.4) 80%, transparent 100%)'
              }}
            />
            
            {/* Diagonal gold line 1 - more prominent */}
            <div 
              className="absolute w-full h-[2px] top-1/3 -rotate-12 origin-left"
              style={{
                background: 'linear-gradient(90deg, rgba(212, 175, 55, 0.45) 0%, rgba(212, 175, 55, 0.2) 50%, transparent 100%)'
              }}
            />
            
            {/* Diagonal gold line 2 - more prominent */}
            <div 
              className="absolute w-full h-[2px] bottom-1/4 rotate-6 origin-right"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(212, 175, 55, 0.2) 50%, rgba(212, 175, 55, 0.4) 100%)'
              }}
            />
            
            {/* Additional diagonal line 3 */}
            <div 
              className="absolute w-full h-[1.5px] top-2/3 -rotate-3 origin-center"
              style={{
                background: 'linear-gradient(90deg, rgba(255, 215, 0, 0.3) 0%, rgba(212, 175, 55, 0.15) 50%, rgba(255, 215, 0, 0.25) 100%)'
              }}
            />

            {/* Corner accent - top left - more visible */}
            <div 
              className="absolute top-0 left-0 w-32 h-32"
              style={{
                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.3) 0%, transparent 50%)'
              }}
            />
            
            {/* Corner accent - bottom right - more visible */}
            <div 
              className="absolute bottom-0 right-0 w-40 h-40"
              style={{
                background: 'linear-gradient(315deg, rgba(212, 175, 55, 0.25) 0%, transparent 50%)'
              }}
            />

            {/* Grid pattern overlay - more visible */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.15]" preserveAspectRatio="none">
              <defs>
                <pattern id="cardGrid" patternUnits="userSpaceOnUse" width="40" height="40">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d4af37" strokeWidth="0.8"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#cardGrid)" />
            </svg>
          </div>

          {/* Realistic card texture */}
          <div 
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />
          
          {/* Holographic stripe */}
          <div 
            className="absolute top-0 left-0 right-0 h-12 opacity-20"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255, 215, 0, 0.3) 20%, rgba(255, 255, 255, 0.4) 50%, rgba(255, 215, 0, 0.3) 80%, transparent 100%)',
              animation: 'shimmer 4s infinite linear'
            }}
          />

          {/* Card Content */}
          <div className="relative z-10 p-5 h-full flex flex-col justify-between">
            {/* Top Row - Logo & Live Session Indicator */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #ffd700 0%, #b8860b 100%)',
                    boxShadow: '0 2px 8px rgba(212, 175, 55, 0.4)'
                  }}
                >
                  <CreditCard className="w-5 h-5 text-black" />
                </div>
                <div>
                  <p className="text-amber-400 text-xs font-bold tracking-wider">PARAS</p>
                  <p className="text-amber-600/50 text-[9px] tracking-widest">REWARD</p>
                </div>
              </div>
              
              {/* Live Session Indicator + EMV Chip */}
              <div className="flex items-center gap-3">
                {/* Live Blinking Dot */}
                <div className="flex items-center gap-1.5 bg-black/30 px-2 py-1 rounded-full">
                  <div className="relative">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <div className="absolute inset-0 w-2 h-2 bg-emerald-400 rounded-full animate-ping"></div>
                  </div>
                  <span className="text-emerald-400 text-[9px] font-semibold tracking-wide">ACTIVE</span>
                </div>
                
                {/* EMV Chip - More realistic */}
                <div 
                  className="w-11 h-8 rounded-md overflow-hidden"
                  style={{
                    background: 'linear-gradient(145deg, #d4af37 0%, #aa8c2c 40%, #f0d875 60%, #c9a227 100%)',
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.4), inset 0 -1px 2px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.3)'
                  }}
                >
                  <div className="w-full h-full p-[3px]">
                    <div className="w-full h-full grid grid-cols-3 gap-[1px]">
                      <div className="col-span-2 row-span-2 bg-amber-700/30 rounded-sm"></div>
                      <div className="bg-amber-800/40 rounded-sm"></div>
                      <div className="bg-amber-800/40 rounded-sm"></div>
                      <div className="bg-amber-800/40 rounded-sm"></div>
                      <div className="bg-amber-800/40 rounded-sm"></div>
                      <div className="bg-amber-800/40 rounded-sm"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Balance - Center */}
            <div className="flex-1 flex flex-col justify-center -mt-2">
              <div className="flex items-center gap-2 mb-1">
                <button 
                  onClick={() => setShowBalance(!showBalance)}
                  className="text-gray-600 hover:text-amber-400 transition-colors"
                >
                  {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <p className="text-gray-500 text-[10px] tracking-widest">BALANCE</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span 
                  className="text-4xl font-black tracking-tight"
                  style={{
                    background: 'linear-gradient(180deg, #ffd700 0%, #f5f5f5 40%, #ffd700 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 2px 10px rgba(255, 215, 0, 0.2)'
                  }}
                >
                  {showBalance ? stats.prcBalance.toFixed(2) : '••••••'}
                </span>
                <span className="text-amber-500/80 text-lg font-semibold">PRC</span>
              </div>
            </div>

            {/* Bottom Row - Card Holder & Stats */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-gray-600 text-[8px] tracking-widest mb-0.5">CARD HOLDER</p>
                <p className="text-white text-sm font-semibold tracking-wide uppercase truncate max-w-[160px]">
                  {userData?.name || user?.email?.split('@')[0] || 'USER'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-gray-600 text-[8px] tracking-widest mb-0.5">STATUS</p>
                <p className={`text-sm font-bold ${stats.membershipType === 'vip' ? 'text-amber-400' : 'text-gray-500'}`}>
                  {stats.membershipType === 'vip' ? '★ VIP' : 'FREE'}
                </p>
              </div>
            </div>

            {/* Contactless + Visa-like Logo */}
            <div className="absolute top-5 right-5 flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="opacity-40">
                <path d="M12 2C10.5 2 9 2.5 7.5 3.5" stroke="#FFD700" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 6C11 6 10 6.3 9 7" stroke="#FFD700" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 10C11.5 10 11 10.2 10.5 10.5" stroke="#FFD700" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          </div>

          {/* PRC Expiry Warning for Free Users */}
          {stats.membershipType !== 'vip' && stats.prcBalance > 0 && (
            <div className="relative z-10 px-5 pb-4 -mt-2">
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
      <div className="px-5 mb-4">
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
              transition={{ delay: index * 0.05 }}
              onClick={() => navigate(action.route)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl bg-gradient-to-br ${action.gradient} shadow-lg`}
            >
              <action.icon className="w-5 h-5 text-white mb-1" />
              <span className="text-[10px] font-semibold text-white">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Horizontal Scrollable Cards - VIP Upgrade + Offers */}
      {stats.membershipType !== 'vip' && (
        <div className="mb-4 overflow-hidden">
          <div className="px-5 flex gap-3 overflow-x-auto scrollbar-hide pb-2" style={{ scrollSnapType: 'x mandatory' }}>
            {/* VIP Upgrade Card */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => navigate('/vip')}
              className="flex-shrink-0 w-[85%] cursor-pointer"
              style={{ scrollSnapAlign: 'start' }}
            >
              <div 
                className="relative overflow-hidden rounded-xl p-4"
                style={{
                  background: 'linear-gradient(135deg, #92400e 0%, #78350f 50%, #451a03 100%)'
                }}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-400/20 rounded-full blur-2xl"></div>
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-400/20 flex items-center justify-center">
                      <Crown className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-yellow-400 font-bold text-sm">Upgrade to VIP</p>
                      <p className="text-amber-200/60 text-xs">2x Rewards • No Expiry</p>
                    </div>
                  </div>
                  <div className="bg-yellow-400 text-black px-3 py-1.5 rounded-lg font-bold text-sm">
                    ₹299
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Stats Card */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex-shrink-0 w-[85%]"
              style={{ scrollSnapAlign: 'start' }}
            >
              <div className="bg-gray-900/80 rounded-xl p-4 border border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Your Progress</p>
                      <p className="text-gray-400 text-xs">Total: {stats.totalMined.toFixed(0)} PRC</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-400 font-bold text-lg">{stats.referralCount}</p>
                    <p className="text-gray-500 text-xs">Referrals</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
          {/* Scroll indicator dots */}
          <div className="flex justify-center gap-1.5 mt-1">
            <div className="w-4 h-1 bg-amber-500 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
          </div>
        </div>
      )}

      {/* Birthday Greeting */}
      {birthdayGreeting && (
        <div className="px-5 mb-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600"
          >
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-yellow-400/30 rounded-full blur-2xl animate-pulse"></div>
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-pink-400/30 rounded-full blur-2xl animate-pulse"></div>
            </div>
            <div className="relative z-10 text-center">
              <div className="text-4xl mb-2">🎂🎉🎁</div>
              <h3 className="text-white text-xl font-bold mb-1">{birthdayGreeting.message}</h3>
              <p className="text-white/80 text-sm">{birthdayGreeting.greeting}</p>
              <p className="text-yellow-300 text-xs mt-2 font-medium">{birthdayGreeting.bonus_message}</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Your Activity */}
      <div className="px-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg">Your Activity</h2>
          <button 
            onClick={() => navigate('/transactions')}
            className="text-amber-500 text-sm font-medium flex items-center gap-1"
          >
            View All <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden">
          {recentTransactions.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-10 h-10 mx-auto mb-2 text-gray-600" />
              <p className="text-gray-500 text-sm">No activity yet</p>
              <button 
                onClick={() => navigate('/daily-rewards')}
                className="mt-2 text-amber-500 text-sm font-medium"
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

      {/* Global Live Activity (Bill, Voucher, Shopping) */}
      <div className="px-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Live Activity
          </h2>
          <span className="text-gray-500 text-xs">Global Feed</span>
        </div>

        <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden">
          {globalActivity.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-10 h-10 mx-auto mb-2 text-gray-600" />
              <p className="text-gray-500 text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800 max-h-60 overflow-y-auto">
              {globalActivity.slice(0, 6).map((activity, index) => (
                <motion.div 
                  key={index} 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base ${
                      activity.category === 'bill' ? 'bg-blue-500/20' :
                      activity.category === 'voucher' ? 'bg-purple-500/20' : 'bg-amber-500/20'
                    }`}>
                      <span>{activity.icon}</span>
                    </div>
                    <div>
                      <p className="text-white text-sm">{activity.description}</p>
                      <p className="text-gray-500 text-xs">
                        {activity.user} {activity.location && `• ${activity.location}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-gray-600 text-xs">
                    {activity.timestamp ? new Date(activity.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Now'}
                  </span>
                </motion.div>
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
