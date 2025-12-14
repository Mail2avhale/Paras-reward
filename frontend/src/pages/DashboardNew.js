import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Coins, Zap, Users, Gift, Trophy, Wallet, Crown, ShieldCheck, Package, 
  TrendingUp, Star, Target, Award, ArrowRight, Sparkles, Play, ShoppingBag,
  Clock, CheckCircle2, Activity, Map
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DashboardNew = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const isAdmin = user?.role === 'admin';
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
      const [userRes, statsRes] = await Promise.all([
        axios.get(`${API}/auth/user/${user.uid}`),
        axios.get(`${API}/mining/status/${user.uid}`)
      ]);
      setUserData(userRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate level progress
  const prcBalance = userData?.prc_balance || 0;
  const level = Math.floor(prcBalance / 1000) + 1;
  const nextLevel = level * 1000;
  const currentLevelProgress = prcBalance % 1000;
  const progressPercent = (currentLevelProgress / 1000) * 100;

  // Primary Quick Actions - Most used features
  const primaryActions = [
    { 
      name: 'Mining', 
      icon: Play, 
      link: '/mining', 
      gradient: 'from-green-500 to-emerald-600',
      badge: stats?.is_mining ? 'Active' : null,
      priority: true
    },
    { 
      name: 'Treasure', 
      icon: Map, 
      link: '/treasure-hunt', 
      gradient: 'from-amber-500 to-orange-600',
      badge: '50%',
      priority: true
    },
    { 
      name: 'Scratch', 
      icon: Sparkles, 
      link: '/scratch-card', 
      gradient: 'from-pink-500 to-rose-600',
      badge: isVIP ? '50%' : '10%',
      priority: true
    },
    { 
      name: 'Shop', 
      icon: ShoppingBag, 
      link: '/marketplace', 
      gradient: 'from-blue-500 to-indigo-600',
      badge: null,
      priority: true
    },
  ];

  // Secondary Quick Actions
  const secondaryActions = [
    { 
      name: 'Wallet', 
      icon: Wallet, 
      link: '/wallet', 
      gradient: 'from-cyan-500 to-blue-600',
      badge: null
    },
    { 
      name: 'Tap Game', 
      icon: Zap, 
      link: '/game', 
      gradient: 'from-yellow-500 to-orange-600',
      badge: null
    },
    { 
      name: 'Referrals', 
      icon: Users, 
      link: '/referrals', 
      gradient: 'from-purple-500 to-pink-600',
      badge: userData?.referral_count > 0 ? `${userData.referral_count}` : null
    },
    { 
      name: 'Orders', 
      icon: Package, 
      link: '/orders', 
      gradient: 'from-orange-500 to-red-600',
      badge: null
    },
    { 
      name: 'Ranks', 
      icon: Trophy, 
      link: '/leaderboard', 
      gradient: 'from-pink-500 to-rose-600',
      badge: null
    },
    { 
      name: 'VIP', 
      icon: Crown, 
      link: '/vip', 
      gradient: 'from-amber-500 to-yellow-600',
      badge: isVIP ? '✓' : '★'
    }
  ];

  // Achievement badges
  const achievements = [
    { name: 'First Login', earned: true, icon: Star },
    { name: '100 PRC', earned: prcBalance >= 100, icon: Target },
    { name: 'VIP Member', earned: isVIP, icon: Crown },
    { name: '5 Referrals', earned: (userData?.referral_count || 0) >= 5, icon: Users },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 pb-20">
      <Navbar user={user} onLogout={onLogout} />
      <PWAInstallPrompt />
      
      <div className="container mx-auto px-3 py-4 max-w-full lg:max-w-7xl xl:max-w-[90%]">
        
        {/* MODERN HERO SECTION - Mobile First Design */}
        <div className="relative mb-4 overflow-hidden rounded-3xl shadow-2xl">
          {/* Animated Background with Mesh Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-purple-700">
            {/* Animated Blobs */}
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-pink-400/30 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-400/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }}></div>
            <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-purple-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.75s' }}></div>
          </div>
          
          {/* Hero Content - Compact Mobile-First */}
          <div className="relative z-10 p-4 md:p-6">
            {/* User Profile Row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 rounded-full blur-sm opacity-75 animate-pulse"></div>
                  <img
                    src={user.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=9333ea&color=fff&size=128`}
                    alt={user.name}
                    className="relative w-16 h-16 md:w-20 md:h-20 rounded-full border-3 border-white shadow-xl"
                  />
                  {isVIP && (
                    <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full p-1.5 shadow-lg animate-bounce">
                      <Crown className="h-3 w-3 md:h-4 md:w-4 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-white mb-0.5">
                    {userData?.first_name || user.name}
                  </h1>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-white/20 backdrop-blur-xl rounded-full text-xs font-bold text-white">
                      Lvl {level}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                      isVIP 
                        ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg' 
                        : 'bg-white/20 backdrop-blur-xl text-white'
                    }`}>
                      {isVIP && <Crown className="h-2.5 w-2.5" />}
                      {isVIP ? 'VIP' : 'Free'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Notification Bell */}
              <button className="bg-white/10 backdrop-blur-xl p-2.5 rounded-full border border-white/20 hover:bg-white/20 transition-all">
                <Sparkles className="h-5 w-5 text-white" />
              </button>
            </div>
            
            {/* Balance Card - Prominent */}
            <div className="bg-white/15 backdrop-blur-2xl rounded-2xl p-4 md:p-5 border border-white/30 shadow-2xl mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-white/80 text-xs font-medium mb-1">Total Balance</p>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-4xl md:text-5xl font-black text-white">
                      {prcBalance.toFixed(0)}
                    </h2>
                    <span className="text-lg font-bold text-white/80">PRC</span>
                  </div>
                  <p className="text-sm text-white/90 font-semibold mt-1">
                    ≈ ₹{(prcBalance / 10).toFixed(2)}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-4 rounded-2xl shadow-lg">
                  <Coins className="h-8 w-8 text-white" />
                </div>
              </div>
              
              {/* Mini Progress Bar */}
              <div className="pt-3 border-t border-white/20">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-white flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    Level {level} → {level + 1}
                  </span>
                  <span className="text-xs text-white/70">{progressPercent.toFixed(0)}%</span>
                </div>
                <div className="relative h-2 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500 shadow-lg"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            {/* Quick Stats Row - 4 Compact Cards */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-white/10 backdrop-blur-xl rounded-xl p-2.5 border border-white/20 text-center">
                <div className="bg-green-500/30 w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-1">
                  <Zap className="h-4 w-4 text-green-300" />
                </div>
                <p className="text-lg font-black text-white">{stats?.total_mined?.toFixed(0) || '0'}</p>
                <p className="text-[9px] text-white/70 font-medium">Mined</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-xl rounded-xl p-2.5 border border-white/20 text-center">
                <div className="bg-blue-500/30 w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-1">
                  <Users className="h-4 w-4 text-blue-300" />
                </div>
                <p className="text-lg font-black text-white">{stats?.total_referrals || '0'}</p>
                <p className="text-[9px] text-white/70 font-medium">Referrals</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-xl rounded-xl p-2.5 border border-white/20 text-center">
                <div className="bg-purple-500/30 w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-1">
                  <Package className="h-4 w-4 text-purple-300" />
                </div>
                <p className="text-lg font-black text-white">{stats?.total_orders || '0'}</p>
                <p className="text-[9px] text-white/70 font-medium">Orders</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-xl rounded-xl p-2.5 border border-white/20 text-center">
                <div className="bg-pink-500/30 w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-1">
                  <Trophy className="h-4 w-4 text-pink-300" />
                </div>
                <p className="text-lg font-black text-white">{achievements.filter(a => a.earned).length}</p>
                <p className="text-[9px] text-white/70 font-medium">Badges</p>
              </div>
            </div>
          </div>
        </div>

        {/* QUICK ACCESS MENU - App-Style Grid */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              Quick Access
            </h3>
            <button className="text-xs text-purple-300 font-semibold hover:text-white transition-colors">
              View All →
            </button>
          </div>
          
          {/* Main Grid - 4 columns on mobile, 5 on tablet, 6 on desktop */}
          <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {/* Mining */}
            <Link to="/mining">
              <div className="relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-4 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-200 group">
                {stats?.is_mining && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse ring-2 ring-white"></div>
                )}
                <div className="bg-white/20 backdrop-blur-sm w-12 h-12 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Play className="h-6 w-6 text-white" />
                </div>
                <h4 className="text-white font-bold text-sm mb-0.5">Mining</h4>
                <p className="text-white/80 text-xs">Earn PRC</p>
              </div>
            </Link>

            {/* Treasure Hunt */}
            <Link to="/treasure-hunt">
              <div className="relative bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-200 group">
                <div className="absolute -top-1 -right-1 bg-yellow-400 text-amber-900 text-[8px] font-black px-1.5 py-0.5 rounded-full">
                  50%
                </div>
                <div className="bg-white/20 backdrop-blur-sm w-12 h-12 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Map className="h-6 w-6 text-white" />
                </div>
                <h4 className="text-white font-bold text-sm mb-0.5">Treasure</h4>
                <p className="text-white/80 text-xs">Hunt Now</p>
              </div>
            </Link>

            {/* Scratch Card */}
            <Link to="/scratch-card">
              <div className="relative bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl p-4 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-200 group">
                <div className="absolute -top-1 -right-1 bg-yellow-400 text-pink-900 text-[8px] font-black px-1.5 py-0.5 rounded-full">
                  {isVIP ? '50%' : '10%'}
                </div>
                <div className="bg-white/20 backdrop-blur-sm w-12 h-12 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <h4 className="text-white font-bold text-sm mb-0.5">Scratch</h4>
                <p className="text-white/80 text-xs">Win Big</p>
              </div>
            </Link>

            {/* Marketplace */}
            <Link to="/marketplace">
              <div className="relative bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-4 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-200 group">
                <div className="bg-white/20 backdrop-blur-sm w-12 h-12 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <ShoppingBag className="h-6 w-6 text-white" />
                </div>
                <h4 className="text-white font-bold text-sm mb-0.5">Shop</h4>
                <p className="text-white/80 text-xs">Browse</p>
              </div>
            </Link>

            {/* Wallet */}
            <Link to="/wallet">
              <div className="relative bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl p-4 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-200 group">
                <div className="bg-white/20 backdrop-blur-sm w-12 h-12 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Wallet className="h-6 w-6 text-white" />
                </div>
                <h4 className="text-white font-bold text-sm mb-0.5">Wallet</h4>
                <p className="text-white/80 text-xs">Manage</p>
              </div>
            </Link>

            {/* Tap Game */}
            <Link to="/game">
              <div className="relative bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl p-4 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-200 group">
                <div className="bg-white/20 backdrop-blur-sm w-12 h-12 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <h4 className="text-white font-bold text-sm mb-0.5">Tap Game</h4>
                <p className="text-white/80 text-xs">Play</p>
              </div>
            </Link>

            {/* Referrals */}
            <Link to="/referrals">
              <div className="relative bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-4 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-200 group">
                {userData?.referral_count > 0 && (
                  <div className="absolute -top-1 -right-1 bg-green-400 text-green-900 text-[8px] font-black px-1.5 py-0.5 rounded-full">
                    {userData.referral_count}
                  </div>
                )}
                <div className="bg-white/20 backdrop-blur-sm w-12 h-12 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <h4 className="text-white font-bold text-sm mb-0.5">Referrals</h4>
                <p className="text-white/80 text-xs">Invite</p>
              </div>
            </Link>

            {/* Orders */}
            <Link to="/orders">
              <div className="relative bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-4 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-200 group">
                <div className="bg-white/20 backdrop-blur-sm w-12 h-12 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Package className="h-6 w-6 text-white" />
                </div>
                <h4 className="text-white font-bold text-sm mb-0.5">Orders</h4>
                <p className="text-white/80 text-xs">Track</p>
              </div>
            </Link>

            {/* Leaderboard */}
            <Link to="/leaderboard">
              <div className="relative bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl p-4 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-200 group">
                <div className="bg-white/20 backdrop-blur-sm w-12 h-12 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Trophy className="h-6 w-6 text-white" />
                </div>
                <h4 className="text-white font-bold text-sm mb-0.5">Ranks</h4>
                <p className="text-white/80 text-xs">Compete</p>
              </div>
            </Link>

            {/* VIP */}
            <Link to="/vip">
              <div className={`relative rounded-2xl p-4 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-200 group ${
                isVIP 
                  ? 'bg-gradient-to-br from-yellow-400 to-orange-500' 
                  : 'bg-gradient-to-br from-amber-500 to-yellow-600'
              }`}>
                <div className="bg-white/20 backdrop-blur-sm w-12 h-12 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Crown className="h-6 w-6 text-white" />
                </div>
                <h4 className="text-white font-bold text-sm mb-0.5">{isVIP ? 'VIP' : 'Upgrade'}</h4>
                <p className="text-white/80 text-xs">{isVIP ? 'Active' : 'Go VIP'}</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="bg-green-500/20 p-3 rounded-xl">
                <TrendingUp className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats?.total_mined?.toFixed(0) || '0'}</p>
                <p className="text-xs text-gray-300">Total Mined</p>
              </div>
            </div>
          </Card>
          
          <Card className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/20 p-3 rounded-xl">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{userData?.referral_count || '0'}</p>
                <p className="text-xs text-gray-300">Referrals</p>
              </div>
            </div>
          </Card>
          
          <Card className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="bg-purple-500/20 p-3 rounded-xl">
                <Trophy className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{level}</p>
                <p className="text-xs text-gray-300">Current Level</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Achievement Badges */}
        <Card className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-2xl mb-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-400" />
            Achievements
          </h3>
          <div className="grid grid-cols-4 gap-4">
            {achievements.map((achievement, idx) => (
              <div key={idx} className="text-center">
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-2 ${
                  achievement.earned 
                    ? 'bg-gradient-to-br from-yellow-400 to-orange-500' 
                    : 'bg-white/10'
                }`}>
                  <achievement.icon className={`h-8 w-8 ${achievement.earned ? 'text-white' : 'text-gray-400'}`} />
                </div>
                <p className={`text-xs ${achievement.earned ? 'text-white font-medium' : 'text-gray-400'}`}>
                  {achievement.name}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Wallet Card - Cashback Only */}
          <Link to="/wallet">
            <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-2xl hover:scale-105 transition-all duration-300 cursor-pointer group">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">My Wallet</h3>
                  <p className="text-blue-100">Manage your earnings</p>
                </div>
                <div className="bg-white/20 p-3 rounded-xl group-hover:scale-110 transition-transform">
                  <Wallet className="h-8 w-8 text-white" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-100 mb-1">Cashback Balance</p>
                  <p className="text-3xl font-bold text-white">
                    ₹{((userData?.cashback_wallet_balance || 0)).toFixed(2)}
                  </p>
                  <p className="text-xs text-blue-200 mt-2">Available to withdraw</p>
                </div>
                <ArrowRight className="h-8 w-8 text-white opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </div>
            </Card>
          </Link>

          {/* VIP Upgrade Card */}
          <Link to={isVIP ? "/vip" : "/vip"}>
            <Card className="bg-gradient-to-br from-yellow-500 to-orange-600 p-6 rounded-2xl hover:scale-105 transition-all duration-300 cursor-pointer group">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {isVIP ? 'VIP Status' : 'Upgrade to VIP'}
                  </h3>
                  <p className="text-orange-100">
                    {isVIP ? 'Enjoy premium benefits' : 'Unlock unlimited earning'}
                  </p>
                </div>
                <div className="bg-white/20 p-3 rounded-xl group-hover:scale-110 transition-transform">
                  <Crown className="h-8 w-8 text-white" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                {isVIP ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-6 w-6 text-white" />
                    <p className="text-white font-semibold">Active Member</p>
                  </div>
                ) : (
                  <p className="text-white font-semibold">₹1000/year</p>
                )}
                <ArrowRight className="h-6 w-6 text-white" />
              </div>
            </Card>
          </Link>
        </div>

        {/* Recent Activity */}
        <Card className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-2xl">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-400" />
            Recent Activity
          </h3>
          <div className="space-y-3">
            {stats?.mining_active ? (
              <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-xl">
                <div className="bg-green-500/20 p-2 rounded-lg">
                  <Play className="h-4 w-4 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">Mining Active</p>
                  <p className="text-xs text-gray-300">Earning PRC now...</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                <div className="bg-white/10 p-2 rounded-lg">
                  <Zap className="h-4 w-4 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">Start mining to earn rewards</p>
                  <p className="text-xs text-gray-300">Tap to begin earning</p>
                </div>
                <Link to="/mining">
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                    Start
                  </Button>
                </Link>
              </div>
            )}
            
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
              <div className="bg-white/10 p-2 rounded-lg">
                <Star className="h-4 w-4 text-yellow-400" />
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">Level {level} Achieved</p>
                <p className="text-xs text-gray-300">Keep earning to level up!</p>
              </div>
            </div>
          </div>
        </Card>

        {!isAdmin && (
          <div className="mt-6">
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardNew;
