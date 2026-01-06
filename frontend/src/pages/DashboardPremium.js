import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Lottie from 'lottie-react';
import Navbar from '@/components/Navbar';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { Card } from '@/components/ui/card';
import { useLanguage, LANGUAGES } from '@/contexts/LanguageContext';
import { 
  Coins, Zap, Users, Gift, Trophy, Crown, ShieldCheck, 
  TrendingUp, TrendingDown, Target, Sparkles, ShoppingBag,
  Clock, CheckCircle2, Activity, Gamepad2, ChevronRight, 
  Pickaxe, Receipt, ArrowUpRight, ArrowDownRight, Globe,
  Shield, AlertCircle, X
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Coin Animation Data (simple Lottie-compatible JSON)
const coinAnimationData = {
  v: "5.5.7",
  fr: 30,
  ip: 0,
  op: 60,
  w: 100,
  h: 100,
  assets: [],
  layers: [{
    ty: 4,
    nm: "coin",
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 1, k: [{ t: 0, s: [0], e: [360] }, { t: 60, s: [360] }] },
      p: { a: 0, k: [50, 50] },
      s: { a: 1, k: [{ t: 0, s: [100, 100], e: [110, 110] }, { t: 30, s: [110, 110], e: [100, 100] }, { t: 60, s: [100, 100] }] }
    },
    shapes: [{
      ty: "el",
      p: { a: 0, k: [0, 0] },
      s: { a: 0, k: [60, 60] }
    }, {
      ty: "fl",
      c: { a: 0, k: [1, 0.84, 0, 1] },
      o: { a: 0, k: 100 }
    }]
  }]
};

// Language Selector Component
const LanguageSelector = ({ isOpen, onClose }) => {
  const { language, changeLanguage, languages } = useLanguage();
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 m-4 max-w-sm w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">🌐 भाषा निवडा</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-2">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { changeLanguage(lang.code); onClose(); }}
              className={`w-full p-4 rounded-2xl flex items-center gap-3 transition-all ${
                language === lang.code 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <span className="text-2xl">{lang.flag}</span>
              <span className="font-semibold text-lg">{lang.name}</span>
              {language === lang.code && <CheckCircle2 className="h-5 w-5 ml-auto" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Main Dashboard Component
const DashboardPremium = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { t, currentLanguage } = useLanguage();
  const [userData, setUserData] = useState(null);
  const [stats, setStats] = useState(null);
  const [todayStats, setTodayStats] = useState({ earned: 0, spent: 0 });
  const [prcSources, setPrcSources] = useState({ mining: 0, games: 0, referral: 0, bonus: 0 });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLangSelector, setShowLangSelector] = useState(false);
  
  const isVIP = userData?.membership_type === 'vip';

  // Role-based redirect
  useEffect(() => {
    if (user?.role === 'admin') navigate('/admin');
    else if (user?.role === 'manager') navigate('/manager');
    else if (user?.role === 'master_stockist') navigate('/master-stockist');
    else if (user?.role === 'sub_stockist') navigate('/sub-stockist');
    else if (user?.role === 'outlet') navigate('/outlet');
  }, [user, navigate]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [userRes, statsRes, transactionsRes] = await Promise.all([
        axios.get(`${API}/auth/user/${user.uid}`),
        axios.get(`${API}/api/mining/status/${user.uid}`),
        axios.get(`${API}/transactions/${user.uid}?limit=50`)
      ]);
      
      setUserData(userRes.data);
      setStats(statsRes.data);
      
      const transactions = transactionsRes.data.transactions || [];
      const today = new Date().toISOString().split('T')[0];
      
      let todayEarned = 0, todaySpent = 0;
      let sources = { mining: 0, games: 0, referral: 0, bonus: 0 };
      
      transactions.forEach(tx => {
        const txDate = tx.created_at?.split('T')[0];
        const amount = Math.abs(tx.amount || 0);
        
        if (txDate === today) {
          if (tx.amount > 0) todayEarned += tx.amount;
          else todaySpent += amount;
        }
        
        if (tx.amount > 0) {
          if (tx.type === 'mining') sources.mining += tx.amount;
          else if (['tap_game', 'scratch_card_reward', 'treasure_hunt_reward'].includes(tx.type)) sources.games += tx.amount;
          else if (['referral', 'delivery_commission'].includes(tx.type)) sources.referral += tx.amount;
          else if (['cashback', 'admin_credit', 'prc_rain_gain', 'profit_share'].includes(tx.type)) sources.bonus += tx.amount;
        }
      });
      
      setTodayStats({ earned: todayEarned, spent: todaySpent });
      setPrcSources(sources);
      setRecentActivity(transactions.slice(0, 5));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculations
  const prcBalance = userData?.prc_balance || 0;
  const conversionRate = 10;
  const approxINR = prcBalance / conversionRate;
  
  const milestones = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
  const nextGoal = milestones.find(m => m > prcBalance) || milestones[milestones.length - 1];
  const goalProgress = Math.min((prcBalance / nextGoal) * 100, 100);
  const remainingForGoal = Math.max(nextGoal - prcBalance, 0);
  
  const totalSourcePRC = prcSources.mining + prcSources.games + prcSources.referral + prcSources.bonus;
  const accountStatus = userData?.is_blocked ? 'restricted' : userData?.redeem_enabled === false ? 'action_needed' : 'safe';

  // Quick Actions with translations
  const quickActions = useMemo(() => [
    { key: 'mine', icon: Pickaxe, link: '/mining', gradient: 'from-emerald-500 to-green-600', active: stats?.is_mining },
    { key: 'tapGame', icon: Gamepad2, link: '/game', gradient: 'from-violet-500 to-purple-600' },
    { key: 'shop', icon: ShoppingBag, link: '/marketplace', gradient: 'from-blue-500 to-indigo-600' },
    { key: 'billPay', icon: Receipt, link: isVIP ? '/bill-payments' : '/vip', gradient: 'from-orange-500 to-red-600', vipOnly: true },
    { key: 'refer', icon: Users, link: '/referrals', gradient: 'from-pink-500 to-rose-600' },
  ], [isVIP, stats?.is_mining]);

  // Activity style helper
  const getActivityStyle = (type, amount) => {
    if (amount < 0) return { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/20' };
    const styles = {
      mining: { icon: Pickaxe, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
      tap_game: { icon: Gamepad2, color: 'text-violet-400', bg: 'bg-violet-500/20' },
      referral: { icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/20' },
      cashback: { icon: Gift, color: 'text-amber-400', bg: 'bg-amber-500/20' },
    };
    return styles[type] || { icon: Coins, color: 'text-gray-400', bg: 'bg-gray-500/20' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4">
            <Lottie animationData={coinAnimationData} loop={true} />
          </div>
          <p className="text-white/80 text-lg">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 pb-24">
      <Navbar user={user} onLogout={onLogout} />
      <PWAInstallPrompt />
      <LanguageSelector isOpen={showLangSelector} onClose={() => setShowLangSelector(false)} />
      
      <div className="container mx-auto px-3 py-4 max-w-lg">
        
        {/* ============ HERO CARD - PRC BALANCE ============ */}
        <div className="relative mb-5">
          {/* Glow Effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/40 via-fuchsia-600/40 to-purple-700/40 rounded-3xl blur-2xl" />
          
          <Card className="relative overflow-hidden border-0 rounded-3xl"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.9) 0%, rgba(192,132,252,0.9) 50%, rgba(139,92,246,0.9) 100%)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 25px 50px -12px rgba(139,92,246,0.5), inset 0 1px 0 rgba(255,255,255,0.2)'
            }}
          >
            {/* Glass Decorations */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-400/20 rounded-full blur-3xl" />
            
            <div className="relative p-5 z-10">
              {/* Header Row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={user.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=9333ea&color=fff&size=128`}
                      alt={user.name}
                      className="w-12 h-12 rounded-full ring-2 ring-white/30"
                    />
                    {isVIP && (
                      <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full p-1 shadow-lg">
                        <Crown className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-white">{userData?.first_name || user.name}</h1>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isVIP ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' : 'bg-white/20 text-white/80'
                    }`}>
                      {isVIP ? `👑 ${t('vipMember')}` : t('freeUser')}
                    </span>
                  </div>
                </div>
                
                {/* Language Button */}
                <button 
                  onClick={() => setShowLangSelector(true)}
                  className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-all"
                >
                  <Globe className="h-4 w-4 text-white" />
                  <span className="text-white text-xs font-medium">{currentLanguage.name}</span>
                </button>
              </div>
              
              {/* PRC Balance Circle */}
              <div className="flex flex-col items-center py-6">
                <div className="relative w-40 h-40">
                  {/* Outer Ring */}
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="80" cy="80" r="70" stroke="rgba(255,255,255,0.15)" strokeWidth="10" fill="transparent" />
                    <circle
                      cx="80" cy="80" r="70"
                      stroke="url(#progressGradient)"
                      strokeWidth="10"
                      fill="transparent"
                      strokeLinecap="round"
                      strokeDasharray={`${goalProgress * 4.4} 440`}
                      style={{ transition: 'stroke-dasharray 1s ease-out' }}
                    />
                    <defs>
                      <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#22c55e" />
                      </linearGradient>
                    </defs>
                  </svg>
                  
                  {/* Center Content */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="w-10 h-10 mb-1">
                      <Lottie animationData={coinAnimationData} loop={true} />
                    </div>
                    <span className="text-4xl font-black text-white drop-shadow-lg">{prcBalance.toFixed(0)}</span>
                    <span className="text-white/80 text-sm font-semibold">PRC</span>
                    <span className="text-emerald-300 text-xs mt-1 font-medium">≈ ₹{approxINR.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              {/* Value Guide Strip */}
              <div className="flex justify-center gap-4 bg-white/10 backdrop-blur rounded-2xl p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-500/30 rounded-lg flex items-center justify-center">
                    <Pickaxe className="h-4 w-4 text-emerald-300" />
                  </div>
                  <span className="text-[10px] text-white/80">{t('earnPrc')}</span>
                </div>
                <div className="w-px bg-white/20" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-500/30 rounded-lg flex items-center justify-center">
                    <ShoppingBag className="h-4 w-4 text-red-300" />
                  </div>
                  <span className="text-[10px] text-white/80">{t('usePrc')}</span>
                </div>
                <div className="w-px bg-white/20" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-500/30 rounded-lg flex items-center justify-center">
                    <ArrowUpRight className="h-4 w-4 text-blue-300" />
                  </div>
                  <span className="text-[10px] text-white/80">{t('prcToInr')}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ============ TODAY STATS STRIP ============ */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* Earned */}
          <Card className="border-0 rounded-2xl p-4" style={{
            background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(16,185,129,0.15) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(34,197,94,0.3)'
          }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-emerald-500/30 rounded-xl flex items-center justify-center">
                <ArrowUpRight className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-emerald-400 text-xs font-medium">{t('todayEarned')}</p>
                <p className="text-2xl font-black text-white">+{todayStats.earned.toFixed(1)}</p>
              </div>
            </div>
          </Card>
          
          {/* Spent */}
          <Card className="border-0 rounded-2xl p-4" style={{
            background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.15) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(239,68,68,0.3)'
          }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-red-500/30 rounded-xl flex items-center justify-center">
                <ArrowDownRight className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-red-400 text-xs font-medium">{t('todaySpent')}</p>
                <p className="text-2xl font-black text-white">-{todayStats.spent.toFixed(1)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* ============ QUICK ACTIONS ============ */}
        <div className="mb-5">
          <div className="grid grid-cols-5 gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.key} to={action.link}>
                  <div className={`relative bg-gradient-to-br ${action.gradient} rounded-2xl p-3 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 text-center`}
                    style={{ boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)' }}
                  >
                    {action.active && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse ring-2 ring-white" />
                    )}
                    {action.vipOnly && !isVIP && (
                      <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-0.5">
                        <Crown className="h-2.5 w-2.5 text-yellow-800" />
                      </div>
                    )}
                    <div className="bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-1">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <h4 className="text-white font-bold text-[10px]">{t(action.key)}</h4>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ============ NEXT GOAL ============ */}
        <Card className="border-0 rounded-2xl p-4 mb-5" style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.15) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(99,102,241,0.3)'
        }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-indigo-500/30 rounded-xl flex items-center justify-center">
                <Target className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-indigo-400 text-xs">{t('nextGoal')}</p>
                <p className="text-lg font-bold text-white">{nextGoal.toLocaleString()} PRC</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-white">{goalProgress.toFixed(0)}%</p>
              <p className="text-xs text-indigo-300">{t('complete')}</p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="relative h-3 bg-white/10 rounded-full overflow-hidden mb-2">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full transition-all duration-1000"
              style={{ width: `${goalProgress}%` }}
            />
          </div>
          
          <p className="text-center text-sm text-white/80">
            <span className="text-yellow-400 font-bold">{remainingForGoal.toFixed(0)} PRC</span> {t('earnMore')} 🚀
          </p>
        </Card>

        {/* ============ PRC SOURCES ============ */}
        <Card className="border-0 rounded-2xl p-4 mb-5" style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <h3 className="text-sm font-bold text-white/70 mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-400" />
            {t('prcSources')}
          </h3>
          
          <div className="flex items-center gap-4">
            {/* Donut Chart */}
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="#22c55e" strokeWidth="12" fill="transparent"
                  strokeDasharray={`${totalSourcePRC > 0 ? (prcSources.mining / totalSourcePRC) * 251 : 0} 251`} />
                <circle cx="50" cy="50" r="40" stroke="#a855f7" strokeWidth="12" fill="transparent"
                  strokeDasharray={`${totalSourcePRC > 0 ? (prcSources.games / totalSourcePRC) * 251 : 0} 251`}
                  strokeDashoffset={`${totalSourcePRC > 0 ? -(prcSources.mining / totalSourcePRC) * 251 : 0}`} />
                <circle cx="50" cy="50" r="40" stroke="#3b82f6" strokeWidth="12" fill="transparent"
                  strokeDasharray={`${totalSourcePRC > 0 ? (prcSources.referral / totalSourcePRC) * 251 : 0} 251`}
                  strokeDashoffset={`${totalSourcePRC > 0 ? -((prcSources.mining + prcSources.games) / totalSourcePRC) * 251 : 0}`} />
                <circle cx="50" cy="50" r="40" stroke="#f97316" strokeWidth="12" fill="transparent"
                  strokeDasharray={`${totalSourcePRC > 0 ? (prcSources.bonus / totalSourcePRC) * 251 : 0} 251`}
                  strokeDashoffset={`${totalSourcePRC > 0 ? -((prcSources.mining + prcSources.games + prcSources.referral) / totalSourcePRC) * 251 : 0}`} />
              </svg>
            </div>
            
            {/* Legend */}
            <div className="flex-1 grid grid-cols-2 gap-2">
              {[
                { key: 'mining', color: 'bg-emerald-500', value: prcSources.mining },
                { key: 'games', color: 'bg-purple-500', value: prcSources.games },
                { key: 'referral', color: 'bg-blue-500', value: prcSources.referral },
                { key: 'bonus', color: 'bg-orange-500', value: prcSources.bonus },
              ].map(item => (
                <div key={item.key} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 ${item.color} rounded-full`} />
                  <div>
                    <p className="text-[10px] text-white/60">{t(item.key)}</p>
                    <p className="text-xs font-bold text-white">{item.value.toFixed(0)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* ============ RECENT ACTIVITY ============ */}
        <Card className="border-0 rounded-2xl p-4 mb-5" style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white/70 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              {t('recentActivity')}
            </h3>
            <Link to="/wallet" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
              {t('viewAll')} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          
          <div className="space-y-2">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, idx) => {
                const style = getActivityStyle(activity.type, activity.amount);
                const Icon = style.icon;
                const isPositive = activity.amount > 0;
                
                return (
                  <div key={idx} className="flex items-center gap-3 p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                    <div className={`w-9 h-9 ${style.bg} rounded-xl flex items-center justify-center`}>
                      <Icon className={`h-4 w-4 ${style.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate capitalize">
                        {activity.type?.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[10px] text-white/50">
                        {new Date(activity.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className={`text-right ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      <p className="text-sm font-bold">{isPositive ? '+' : ''}{activity.amount?.toFixed(2)}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6">
                <Activity className="h-8 w-8 text-white/20 mx-auto mb-2" />
                <p className="text-white/50 text-sm">{t('noActivity')}</p>
                <p className="text-white/30 text-xs">{t('startMining')}</p>
              </div>
            )}
          </div>
        </Card>

        {/* ============ ACCOUNT STATUS ============ */}
        <Card className={`border-0 rounded-2xl p-4 ${
          accountStatus === 'safe' ? 'bg-emerald-500/10 border border-emerald-500/30' :
          accountStatus === 'action_needed' ? 'bg-yellow-500/10 border border-yellow-500/30' :
          'bg-red-500/10 border border-red-500/30'
        }`} style={{ backdropFilter: 'blur(10px)' }}>
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
              accountStatus === 'safe' ? 'bg-emerald-500/30' :
              accountStatus === 'action_needed' ? 'bg-yellow-500/30' : 'bg-red-500/30'
            }`}>
              {accountStatus === 'safe' ? <ShieldCheck className="h-5 w-5 text-emerald-400" /> :
               accountStatus === 'action_needed' ? <AlertCircle className="h-5 w-5 text-yellow-400" /> :
               <Shield className="h-5 w-5 text-red-400" />}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-bold ${
                accountStatus === 'safe' ? 'text-emerald-400' :
                accountStatus === 'action_needed' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {accountStatus === 'safe' ? `🟢 ${t('accountStatus')}: ${t('safe')}` :
                 accountStatus === 'action_needed' ? `🟡 ${t('actionNeeded')}` :
                 `🔴 ${t('restricted')}`}
              </p>
              <div className="flex gap-3 mt-1">
                <span className="text-[10px] text-white/60 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" /> {t('prcProtected')}
                </span>
                <span className="text-[10px] text-white/60 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" /> {t('redeemEnabled')}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* ============ EXTRA OPTIONS ============ */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Link to="/leaderboard">
            <Card className="bg-white/5 border border-white/10 rounded-xl p-3 text-center hover:bg-white/10 transition-colors" style={{ backdropFilter: 'blur(10px)' }}>
              <Trophy className="h-5 w-5 text-yellow-400 mx-auto mb-1" />
              <p className="text-[10px] text-white/70">{t('leaderboard')}</p>
            </Card>
          </Link>
          <Link to="/scratch-card">
            <Card className="bg-white/5 border border-white/10 rounded-xl p-3 text-center hover:bg-white/10 transition-colors" style={{ backdropFilter: 'blur(10px)' }}>
              <Sparkles className="h-5 w-5 text-pink-400 mx-auto mb-1" />
              <p className="text-[10px] text-white/70">{t('scratchCard')}</p>
            </Card>
          </Link>
          <Link to={isVIP ? '/vip' : '/vip-membership'}>
            <Card className="bg-white/5 border border-white/10 rounded-xl p-3 text-center hover:bg-white/10 transition-colors" style={{ backdropFilter: 'blur(10px)' }}>
              <Crown className="h-5 w-5 text-amber-400 mx-auto mb-1" />
              <p className="text-[10px] text-white/70">{isVIP ? 'VIP' : t('upgradeToVip')}</p>
            </Card>
          </Link>
        </div>
        
      </div>
    </div>
  );
};

export default DashboardPremium;
