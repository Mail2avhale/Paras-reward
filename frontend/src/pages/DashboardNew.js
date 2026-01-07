import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import AIChatbot from '@/components/AIChatbot';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Coins, Zap, Users, Gift, Trophy, Wallet, Crown, ShieldCheck, Package, 
  TrendingUp, TrendingDown, Star, Target, Award, ArrowRight, Sparkles, Play, ShoppingBag,
  Clock, CheckCircle2, Activity, Map, CreditCard, Smartphone, Gamepad2,
  Shield, AlertCircle, ChevronRight, Pickaxe, Receipt, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DashboardNew = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [stats, setStats] = useState(null);
  const [todayStats, setTodayStats] = useState({ earned: 0, spent: 0 });
  const [prcSources, setPrcSources] = useState({ mining: 0, games: 0, referral: 0, bonus: 0 });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const isVIP = userData?.membership_type === 'vip';

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
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [userRes, statsRes, transactionsRes] = await Promise.all([
        axios.get(`${API}/auth/user/${user.uid}`),
        axios.get(`${API}/mining/status/${user.uid}`),
        axios.get(`${API}/transactions/${user.uid}?limit=50`)
      ]);
      
      setUserData(userRes.data);
      setStats(statsRes.data);
      
      // Process transactions for today stats and PRC sources
      const transactions = transactionsRes.data.transactions || [];
      const today = new Date().toISOString().split('T')[0];
      
      let todayEarned = 0;
      let todaySpent = 0;
      let sources = { mining: 0, games: 0, referral: 0, bonus: 0 };
      
      transactions.forEach(tx => {
        const txDate = tx.created_at?.split('T')[0];
        const amount = Math.abs(tx.amount || 0);
        
        // Calculate today's earnings/spending
        if (txDate === today) {
          if (tx.amount > 0) {
            todayEarned += tx.amount;
          } else {
            todaySpent += amount;
          }
        }
        
        // Calculate PRC sources (all time)
        if (tx.amount > 0) {
          if (tx.type === 'mining') {
            sources.mining += tx.amount;
          } else if (['tap_game', 'scratch_card_reward', 'treasure_hunt_reward'].includes(tx.type)) {
            sources.games += tx.amount;
          } else if (['referral', 'delivery_commission'].includes(tx.type)) {
            sources.referral += tx.amount;
          } else if (['cashback', 'admin_credit', 'prc_rain_gain', 'profit_share'].includes(tx.type)) {
            sources.bonus += tx.amount;
          }
        }
      });
      
      setTodayStats({ earned: todayEarned, spent: todaySpent });
      setPrcSources(sources);
      
      // Get recent activity (last 10)
      setRecentActivity(transactions.slice(0, 10));
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // PRC Values
  const prcBalance = userData?.prc_balance || 0;
  const conversionRate = 10; // 10 PRC = ₹1
  const approxINR = prcBalance / conversionRate;
  
  // Goal calculation (next milestone)
  const milestones = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
  const nextGoal = milestones.find(m => m > prcBalance) || milestones[milestones.length - 1];
  const goalProgress = (prcBalance / nextGoal) * 100;
  const remainingForGoal = nextGoal - prcBalance;
  
  // PRC Sources Total for donut
  const totalSourcePRC = prcSources.mining + prcSources.games + prcSources.referral + prcSources.bonus;
  
  // Account health status
  const accountStatus = userData?.is_blocked ? 'restricted' : 
                        userData?.redeem_enabled === false ? 'action_needed' : 'safe';

  // Activity icon and color mapping
  const getActivityStyle = (type, amount) => {
    if (amount < 0 || ['order', 'withdrawal', 'prc_burn', 'bill_payment_request', 'gift_voucher_request'].includes(type)) {
      return { icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-100', label: 'खर्च' };
    }
    
    const styles = {
      mining: { icon: Pickaxe, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Mining' },
      tap_game: { icon: Gamepad2, color: 'text-purple-500', bg: 'bg-purple-100', label: 'Game' },
      scratch_card_reward: { icon: Sparkles, color: 'text-purple-500', bg: 'bg-purple-100', label: 'Scratch' },
      treasure_hunt_reward: { icon: Map, color: 'text-amber-500', bg: 'bg-amber-100', label: 'Treasure' },
      referral: { icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-100', label: 'Referral' },
      cashback: { icon: Gift, color: 'text-green-500', bg: 'bg-green-100', label: 'Bonus' },
      admin_credit: { icon: Gift, color: 'text-green-500', bg: 'bg-green-100', label: 'Bonus' },
      prc_rain_gain: { icon: Gift, color: 'text-green-500', bg: 'bg-green-100', label: 'Rain' },
    };
    
    return styles[type] || { icon: Coins, color: 'text-gray-500', bg: 'bg-gray-100', label: 'PRC' };
  };

  // Quick Actions with explanations
  const quickActions = [
    { 
      name: 'Mine', 
      subtext: 'Hourly PRC मिळवा',
      icon: Pickaxe, 
      link: '/mining', 
      gradient: 'from-green-500 to-emerald-600',
      active: stats?.is_mining
    },
    { 
      name: 'Tap Game', 
      subtext: 'खेळा आणि PRC कमवा',
      icon: Gamepad2, 
      link: '/game', 
      gradient: 'from-purple-500 to-violet-600',
    },
    { 
      name: 'Shop', 
      subtext: 'PRC वापरून वस्तू घ्या',
      icon: ShoppingBag, 
      link: '/marketplace', 
      gradient: 'from-blue-500 to-indigo-600',
    },
    { 
      name: 'Bill Pay', 
      subtext: 'खऱ्या बिलावर बचत',
      icon: Receipt, 
      link: isVIP ? '/bill-payments' : '/vip',
      gradient: 'from-orange-500 to-red-600',
      vipOnly: true
    },
    { 
      name: 'Refer', 
      subtext: 'Earning speed वाढवा',
      icon: Users, 
      link: '/referrals', 
      gradient: 'from-pink-500 to-rose-600',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 pb-20">
      <Navbar user={user} onLogout={onLogout} />
      <PWAInstallPrompt />
      
      <div className="container mx-auto px-3 py-4 max-w-lg lg:max-w-4xl">
        
        {/* ================================================================
            SECTION 1: PRC WALLET HERO CIRCLE
            ================================================================ */}
        <div className="relative mb-4">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/30 via-fuchsia-600/30 to-purple-700/30 rounded-3xl blur-xl"></div>
          
          <Card className="relative bg-gradient-to-br from-violet-600 via-fuchsia-600 to-purple-700 rounded-3xl p-5 overflow-hidden border-0">
            {/* Decorative Elements */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-400/20 rounded-full blur-2xl"></div>
            
            {/* User Info Row */}
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={user.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=9333ea&color=fff&size=128`}
                    alt={user.name}
                    className="w-12 h-12 rounded-full border-2 border-white/50"
                  />
                  {isVIP && (
                    <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full p-1">
                      <Crown className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">{userData?.first_name || user.name}</h1>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    isVIP ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' : 'bg-white/20 text-white'
                  }`}>
                    {isVIP ? '👑 VIP Member' : 'Free User'}
                  </span>
                </div>
              </div>
              
              {/* Account Status Badge */}
              <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                accountStatus === 'safe' ? 'bg-green-500/20 text-green-300' :
                accountStatus === 'action_needed' ? 'bg-yellow-500/20 text-yellow-300' :
                'bg-red-500/20 text-red-300'
              }`}>
                {accountStatus === 'safe' ? <ShieldCheck className="h-3 w-3" /> :
                 accountStatus === 'action_needed' ? <AlertCircle className="h-3 w-3" /> :
                 <Shield className="h-3 w-3" />}
                {accountStatus === 'safe' ? 'Safe' : accountStatus === 'action_needed' ? 'Action' : 'Limited'}
              </div>
            </div>
            
            {/* PRC Hero Circle */}
            <div className="flex flex-col items-center py-4 relative z-10">
              {/* Circular Progress Ring */}
              <div className="relative w-44 h-44 mb-3">
                {/* Background Circle */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="88"
                    cy="88"
                    r="80"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="12"
                    fill="transparent"
                  />
                  {/* Progress Circle */}
                  <circle
                    cx="88"
                    cy="88"
                    r="80"
                    stroke="url(#gradient)"
                    strokeWidth="12"
                    fill="transparent"
                    strokeLinecap="round"
                    strokeDasharray={`${goalProgress * 5.02} 502`}
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#22c55e" />
                    </linearGradient>
                  </defs>
                </svg>
                
                {/* Center Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Coins className="h-6 w-6 text-yellow-400 mb-1" />
                  <span className="text-4xl font-black text-white">{prcBalance.toFixed(0)}</span>
                  <span className="text-sm text-white/80 font-semibold">PRC</span>
                  <span className="text-xs text-green-300 mt-1">≈ ₹{approxINR.toFixed(2)}</span>
                </div>
              </div>
              
              {/* Static Explainer - Always Visible */}
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 w-full">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 bg-green-500/30 rounded-lg flex items-center justify-center mb-1">
                      <Pickaxe className="h-4 w-4 text-green-300" />
                    </div>
                    <span className="text-[10px] text-white/80 font-medium">Earn: Mining</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 bg-red-500/30 rounded-lg flex items-center justify-center mb-1">
                      <ShoppingBag className="h-4 w-4 text-red-300" />
                    </div>
                    <span className="text-[10px] text-white/80 font-medium">Use: Shop</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 bg-blue-500/30 rounded-lg flex items-center justify-center mb-1">
                      <ArrowRight className="h-4 w-4 text-blue-300" />
                    </div>
                    <span className="text-[10px] text-white/80 font-medium">10 PRC = ₹1</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ================================================================
            SECTION 2: TODAY SUMMARY STRIP
            ================================================================ */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Today Earned */}
          <Card className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-green-500/30 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-500/30 rounded-xl flex items-center justify-center">
                <ArrowUpRight className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-green-300 text-xs font-medium">आजची कमाई</p>
                <p className="text-2xl font-black text-white">+{todayStats.earned.toFixed(1)}</p>
                <p className="text-xs text-green-400">PRC</p>
              </div>
            </div>
          </Card>
          
          {/* Today Spent */}
          <Card className="bg-gradient-to-br from-red-500/20 to-rose-600/20 border border-red-500/30 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-500/30 rounded-xl flex items-center justify-center">
                <ArrowDownRight className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <p className="text-red-300 text-xs font-medium">आजचा खर्च</p>
                <p className="text-2xl font-black text-white">-{todayStats.spent.toFixed(1)}</p>
                <p className="text-xs text-red-400">PRC</p>
              </div>
            </div>
          </Card>
        </div>

        {/* ================================================================
            SECTION 3: QUICK ACTIONS WITH MEANING
            ================================================================ */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-white/70 mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-400" />
            Quick Actions
          </h3>
          
          <div className="grid grid-cols-5 gap-2">
            {quickActions.map((action, idx) => {
              const Icon = action.icon;
              return (
                <Link key={idx} to={action.link}>
                  <div className={`relative bg-gradient-to-br ${action.gradient} rounded-2xl p-3 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 text-center`}>
                    {action.active && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse ring-2 ring-white"></div>
                    )}
                    {action.vipOnly && !isVIP && (
                      <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-0.5">
                        <Crown className="h-2.5 w-2.5 text-yellow-800" />
                      </div>
                    )}
                    <div className="bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-1.5">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <h4 className="text-white font-bold text-xs">{action.name}</h4>
                    <p className="text-white/60 text-[8px] leading-tight mt-0.5 hidden sm:block">{action.subtext}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ================================================================
            SECTION 4: NEXT GOAL / REDEEM PROGRESS
            ================================================================ */}
        <Card className="bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-indigo-500/30 rounded-xl flex items-center justify-center">
                <Target className="h-5 w-5 text-indigo-300" />
              </div>
              <div>
                <p className="text-indigo-300 text-xs font-medium">Next Goal</p>
                <p className="text-lg font-bold text-white">{nextGoal.toLocaleString()} PRC</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-white">{goalProgress.toFixed(0)}%</p>
              <p className="text-xs text-indigo-300">Complete</p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="relative h-3 bg-white/10 rounded-full overflow-hidden mb-2">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(goalProgress, 100)}%` }}
            ></div>
          </div>
          
          <p className="text-center text-sm text-white/80">
            <span className="text-yellow-400 font-bold">{remainingForGoal.toFixed(0)} PRC</span> अजून कमवा 🚀
          </p>
        </Card>

        {/* ================================================================
            SECTION 5: PRC SOURCE BREAKDOWN (DONUT)
            ================================================================ */}
        <Card className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
          <h3 className="text-sm font-bold text-white/70 mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-400" />
            PRC कुठून आले?
          </h3>
          
          <div className="flex items-center gap-4">
            {/* Simple Donut Chart */}
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Mining - Green */}
                <circle
                  cx="50" cy="50" r="40"
                  stroke="#22c55e"
                  strokeWidth="15"
                  fill="transparent"
                  strokeDasharray={`${totalSourcePRC > 0 ? (prcSources.mining / totalSourcePRC) * 251 : 0} 251`}
                  strokeDashoffset="0"
                />
                {/* Games - Purple */}
                <circle
                  cx="50" cy="50" r="40"
                  stroke="#a855f7"
                  strokeWidth="15"
                  fill="transparent"
                  strokeDasharray={`${totalSourcePRC > 0 ? (prcSources.games / totalSourcePRC) * 251 : 0} 251`}
                  strokeDashoffset={`${totalSourcePRC > 0 ? -(prcSources.mining / totalSourcePRC) * 251 : 0}`}
                />
                {/* Referral - Blue */}
                <circle
                  cx="50" cy="50" r="40"
                  stroke="#3b82f6"
                  strokeWidth="15"
                  fill="transparent"
                  strokeDasharray={`${totalSourcePRC > 0 ? (prcSources.referral / totalSourcePRC) * 251 : 0} 251`}
                  strokeDashoffset={`${totalSourcePRC > 0 ? -((prcSources.mining + prcSources.games) / totalSourcePRC) * 251 : 0}`}
                />
                {/* Bonus - Orange */}
                <circle
                  cx="50" cy="50" r="40"
                  stroke="#f97316"
                  strokeWidth="15"
                  fill="transparent"
                  strokeDasharray={`${totalSourcePRC > 0 ? (prcSources.bonus / totalSourcePRC) * 251 : 0} 251`}
                  strokeDashoffset={`${totalSourcePRC > 0 ? -((prcSources.mining + prcSources.games + prcSources.referral) / totalSourcePRC) * 251 : 0}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-white/60 font-semibold">Total</span>
              </div>
            </div>
            
            {/* Legend */}
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div>
                  <p className="text-xs text-white/60">Mining</p>
                  <p className="text-sm font-bold text-white">{prcSources.mining.toFixed(0)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <div>
                  <p className="text-xs text-white/60">Games</p>
                  <p className="text-sm font-bold text-white">{prcSources.games.toFixed(0)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="text-xs text-white/60">Referral</p>
                  <p className="text-sm font-bold text-white">{prcSources.referral.toFixed(0)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <div>
                  <p className="text-xs text-white/60">Bonus</p>
                  <p className="text-sm font-bold text-white">{prcSources.bonus.toFixed(0)}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* ================================================================
            SECTION 6: RECENT ACTIVITY TIMELINE
            ================================================================ */}
        <Card className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white/70 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              Recent Activity
            </h3>
            <Link to="/wallet" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
              View All <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, idx) => {
                const style = getActivityStyle(activity.type, activity.amount);
                const Icon = style.icon;
                const isPositive = activity.amount > 0;
                
                return (
                  <div key={idx} className="flex items-center gap-3 p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                    <div className={`w-10 h-10 ${style.bg} rounded-xl flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${style.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate capitalize">
                        {activity.type?.replace(/_/g, ' ') || 'Transaction'}
                      </p>
                      <p className="text-xs text-white/50">
                        {new Date(activity.created_at).toLocaleDateString('en-IN', { 
                          day: 'numeric', 
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className={`text-right ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                      <p className="text-sm font-bold">
                        {isPositive ? '+' : ''}{activity.amount?.toFixed(2)}
                      </p>
                      <p className="text-xs opacity-70">PRC</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <Activity className="h-8 w-8 text-white/30 mx-auto mb-2" />
                <p className="text-white/50 text-sm">कोणतीही activity नाही</p>
                <p className="text-white/30 text-xs">Mining सुरू करा!</p>
              </div>
            )}
          </div>
        </Card>

        {/* ================================================================
            SECTION 7: TRUST & ACCOUNT HEALTH BADGE
            ================================================================ */}
        <Card className={`rounded-2xl p-4 ${
          accountStatus === 'safe' ? 'bg-green-500/20 border border-green-500/30' :
          accountStatus === 'action_needed' ? 'bg-yellow-500/20 border border-yellow-500/30' :
          'bg-red-500/20 border border-red-500/30'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              accountStatus === 'safe' ? 'bg-green-500/30' :
              accountStatus === 'action_needed' ? 'bg-yellow-500/30' :
              'bg-red-500/30'
            }`}>
              {accountStatus === 'safe' ? <ShieldCheck className="h-6 w-6 text-green-400" /> :
               accountStatus === 'action_needed' ? <AlertCircle className="h-6 w-6 text-yellow-400" /> :
               <Shield className="h-6 w-6 text-red-400" />}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-bold ${
                accountStatus === 'safe' ? 'text-green-300' :
                accountStatus === 'action_needed' ? 'text-yellow-300' :
                'text-red-300'
              }`}>
                {accountStatus === 'safe' ? '🟢 Account Status: Safe & Active' :
                 accountStatus === 'action_needed' ? '🟡 Action Needed' :
                 '🔴 Account Restricted'}
              </p>
              <div className="flex gap-3 mt-1">
                <span className={`text-xs flex items-center gap-1 ${
                  accountStatus === 'safe' ? 'text-green-400' : 'text-white/50'
                }`}>
                  {accountStatus === 'safe' ? <CheckCircle2 className="h-3 w-3" /> : null}
                  PRC Protected
                </span>
                <span className={`text-xs flex items-center gap-1 ${
                  accountStatus !== 'restricted' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {accountStatus !== 'restricted' ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  Redeem {accountStatus !== 'restricted' ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* More Options Button */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Link to="/leaderboard">
            <Card className="bg-white/5 border border-white/10 rounded-xl p-3 text-center hover:bg-white/10 transition-colors">
              <Trophy className="h-5 w-5 text-yellow-400 mx-auto mb-1" />
              <p className="text-xs text-white/70">Ranks</p>
            </Card>
          </Link>
          <Link to="/scratch-card">
            <Card className="bg-white/5 border border-white/10 rounded-xl p-3 text-center hover:bg-white/10 transition-colors">
              <Sparkles className="h-5 w-5 text-pink-400 mx-auto mb-1" />
              <p className="text-xs text-white/70">Scratch</p>
            </Card>
          </Link>
          <Link to={isVIP ? '/vip' : '/vip-membership'}>
            <Card className="bg-white/5 border border-white/10 rounded-xl p-3 text-center hover:bg-white/10 transition-colors">
              <Crown className="h-5 w-5 text-amber-400 mx-auto mb-1" />
              <p className="text-xs text-white/70">{isVIP ? 'VIP' : 'Go VIP'}</p>
            </Card>
          </Link>
        </div>
        
      </div>
      
      {/* AI Chatbot - Only on Dashboard */}
      <AIChatbot user={user} />
    </div>
  );
};

export default DashboardNew;
