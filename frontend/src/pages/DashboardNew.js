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
import { ResponsiveAd, BannerAd, InFeedAd } from '@/components/AdSenseAd';

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navbar user={user} onLogout={onLogout} />
      <PWAInstallPrompt />
      
      <div className="container mx-auto px-3 py-4 max-w-full lg:max-w-7xl xl:max-w-[90%]">
        
        {/* HERO SECTION */}
        <div className="relative mb-6 overflow-hidden rounded-3xl">
          {/* Animated Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-pink-600 to-indigo-700">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
          
          {/* Hero Content */}
          <div className="relative z-10 p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              {/* Left Side - User Info & Balance */}
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-pink-400 rounded-full blur-md opacity-75 group-hover:opacity-100 transition-opacity"></div>
                    <img
                      src={user.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=9333ea&color=fff&size=128`}
                      alt={user.name}
                      className="relative w-24 h-24 rounded-full border-4 border-white shadow-2xl"
                    />
                    {isVIP && (
                      <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full p-2 shadow-lg">
                        <Crown className="h-5 w-5 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h1 className="text-3xl md:text-4xl font-black text-white mb-1 drop-shadow-lg">
                      {userData?.first_name || user.name}
                    </h1>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-white/20 backdrop-blur-xl rounded-full text-sm font-bold text-white border border-white/30">
                        Level {level}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 ${
                        isVIP 
                          ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' 
                          : 'bg-white/20 backdrop-blur-xl text-white border border-white/30'
                      }`}>
                        {isVIP && <Crown className="h-3 w-3" />}
                        {isVIP ? 'VIP Member' : 'Free Member'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Balance Display */}
                <div className="bg-white/10 backdrop-blur-2xl rounded-2xl p-6 border border-white/20">
                  <p className="text-white/80 text-sm mb-2 font-semibold">Your Balance</p>
                  <div className="flex items-baseline gap-3 mb-2">
                    <h2 className="text-6xl md:text-7xl font-black text-white drop-shadow-2xl">
                      {prcBalance.toFixed(0)}
                    </h2>
                    <span className="text-2xl font-bold text-white/80">PRC</span>
                  </div>
                  <p className="text-xl text-white/90 font-semibold">
                    ≈ ₹{(prcBalance / 10).toFixed(2)} INR
                  </p>
                  
                  {/* Level Progress Bar */}
                  <div className="mt-4 pt-4 border-t border-white/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white">Level Progress</span>
                      <span className="text-sm text-white/80">{currentLevelProgress.toFixed(0)} / 1000 PRC</span>
                    </div>
                    <div className="relative h-3 bg-white/20 rounded-full overflow-hidden">
                      <div 
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-white/70 mt-1">
                      {(1000 - currentLevelProgress).toFixed(0)} PRC to next level
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Right Side - Quick Stats Cards */}
              <div className="grid grid-cols-2 gap-3 md:w-80">
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20 hover:bg-white/15 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-green-500/30 p-2 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-green-300" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-white">{stats?.total_mined?.toFixed(0) || '0'}</p>
                  <p className="text-xs text-white/70 font-medium">Total Mined</p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20 hover:bg-white/15 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-blue-500/30 p-2 rounded-lg">
                      <Users className="h-5 w-5 text-blue-300" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-white">{stats?.total_referrals || '0'}</p>
                  <p className="text-xs text-white/70 font-medium">Referrals</p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20 hover:bg-white/15 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-purple-500/30 p-2 rounded-lg">
                      <Activity className="h-5 w-5 text-purple-300" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-white">{level}</p>
                  <p className="text-xs text-white/70 font-medium">Current Level</p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20 hover:bg-white/15 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-pink-500/30 p-2 rounded-lg">
                      <Trophy className="h-5 w-5 text-pink-300" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-white">{achievements.filter(a => a.earned).length}</p>
                  <p className="text-xs text-white/70 font-medium">Achievements</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Menu - Compact 2-row layout */}
        <div className="mb-6">
          <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-400" />
            Quick Actions
          </h3>
          
          {/* Primary Actions - Featured row */}
          <div className="grid grid-cols-4 gap-2 mb-2">
            {primaryActions.map((action, idx) => (
              <Link key={idx} to={action.link}>
                <Card className="relative bg-white/10 backdrop-blur-xl border border-white/20 p-2.5 rounded-xl hover:scale-105 transition-all duration-200 hover:bg-white/15 cursor-pointer group overflow-hidden">
                  {/* Badge */}
                  {action.badge && (
                    <div className="absolute top-1 right-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                      {action.badge}
                    </div>
                  )}
                  
                  {/* Icon */}
                  <div className={`bg-gradient-to-br ${action.gradient} p-2 rounded-lg mb-1.5 w-fit group-hover:scale-110 transition-transform shadow-lg mx-auto`}>
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  
                  {/* Text */}
                  <h4 className="font-bold text-white text-[11px] text-center leading-tight">{action.name}</h4>
                  
                  {/* Hover effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
                </Card>
              </Link>
            ))}
          </div>
          
          {/* Secondary Actions - Scrollable row */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {secondaryActions.map((action, idx) => (
              <Link key={idx} to={action.link} className="flex-shrink-0">
                <Card className="relative bg-white/5 backdrop-blur-xl border border-white/10 p-2 rounded-lg hover:bg-white/10 transition-all duration-200 cursor-pointer group w-16">
                  {/* Badge */}
                  {action.badge && (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[7px] font-bold px-1 py-0.5 rounded-full shadow-md">
                      {action.badge}
                    </div>
                  )}
                  
                  {/* Icon */}
                  <div className={`bg-gradient-to-br ${action.gradient} p-1.5 rounded-md mb-1 w-fit group-hover:scale-110 transition-transform mx-auto`}>
                    <action.icon className="h-4 w-4 text-white" />
                  </div>
                  
                  {/* Text */}
                  <h4 className="font-semibold text-white text-[9px] text-center leading-tight">{action.name}</h4>
                </Card>
              </Link>
            ))}
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

        {/* AdSense - Only for non-admin */}
        {!isAdmin && (
          <div className="mt-6">
            <ResponsiveAd />
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardNew;
