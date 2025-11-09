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

  // Enhanced Quick Menu with more options
  const quickActions = [
    { 
      name: 'Start Mining', 
      icon: Play, 
      link: '/mining', 
      gradient: 'from-green-500 to-emerald-600',
      description: 'Earn PRC now',
      badge: stats?.is_mining ? 'Active' : null
    },
    { 
      name: 'Tap Game', 
      icon: Zap, 
      link: '/game', 
      gradient: 'from-yellow-500 to-orange-600',
      description: 'Bonus rewards',
      badge: null
    },
    { 
      name: 'Treasure Hunt', 
      icon: Map, 
      link: '/treasure-hunt', 
      gradient: 'from-amber-500 to-orange-600',
      description: 'Find treasures',
      badge: '50% CB'
    },
    { 
      name: 'Marketplace', 
      icon: ShoppingBag, 
      link: '/marketplace', 
      gradient: 'from-blue-500 to-indigo-600',
      description: 'Redeem items',
      badge: null
    },
    { 
      name: 'My Wallet', 
      icon: Wallet, 
      link: '/wallet', 
      gradient: 'from-cyan-500 to-blue-600',
      description: 'View balance',
      badge: null
    },
    { 
      name: 'Referrals', 
      icon: Users, 
      link: '/referrals', 
      gradient: 'from-purple-500 to-pink-600',
      description: 'Invite friends',
      badge: userData?.referral_count > 0 ? `${userData.referral_count}` : null
    },
    { 
      name: 'My Orders', 
      icon: Package, 
      link: '/orders', 
      gradient: 'from-orange-500 to-red-600',
      description: 'Track orders',
      badge: null
    },
    { 
      name: 'Leaderboard', 
      icon: Trophy, 
      link: '/leaderboard', 
      gradient: 'from-pink-500 to-rose-600',
      description: 'Top miners',
      badge: null
    },
    { 
      name: 'VIP Status', 
      icon: Crown, 
      link: '/vip', 
      gradient: 'from-amber-500 to-yellow-600',
      description: isVIP ? 'Active' : 'Upgrade',
      badge: isVIP ? 'VIP' : null
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
      
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        
        {/* Welcome Header with Avatar */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative">
            <img
              src={user.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=9333ea&color=fff&size=128`}
              alt={user.name}
              className="w-20 h-20 rounded-full border-4 border-purple-500 shadow-xl"
            />
            {isVIP && (
              <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full p-1.5">
                <Crown className="h-4 w-4 text-white" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">
              Welcome back, {userData?.first_name || user.name}!
            </h1>
            <p className="text-purple-300 flex items-center gap-2 mt-1">
              <Activity className="h-4 w-4" />
              Level {level} • {isVIP ? 'VIP Member' : 'Free Member'}
            </p>
          </div>
        </div>

        {/* Main Balance Card - App-like */}
        <Card className="bg-gradient-to-br from-purple-600 via-pink-600 to-purple-700 text-white p-6 rounded-3xl shadow-2xl mb-6 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -ml-32 -mb-32"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-white/80 mb-1">Total PRC Balance</p>
                <h2 className="text-5xl font-bold flex items-baseline gap-2">
                  {prcBalance.toFixed(2)}
                  <span className="text-xl text-white/80">PRC</span>
                </h2>
                <p className="text-lg text-white/90 mt-2">≈ ₹{(prcBalance / 10).toFixed(2)} INR</p>
              </div>
              <div className="bg-white/20 backdrop-blur-xl p-5 rounded-2xl">
                <Coins className="h-12 w-12" />
              </div>
            </div>
            
            {/* Level Progress */}
            <div className="mt-4 bg-white/20 backdrop-blur-xl rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Level {level} Progress</span>
                <span className="text-sm">{currentLevelProgress.toFixed(0)} / 1000</span>
              </div>
              <Progress value={progressPercent} className="h-2 bg-white/30" />
              <p className="text-xs text-white/70 mt-2">
                {(1000 - currentLevelProgress).toFixed(0)} PRC to Level {level + 1}
              </p>
            </div>
          </div>
        </Card>

        {/* Quick Menu - Enhanced with 9 options including Treasure Hunt */}
        <div className="mb-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-400" />
            Quick Menu
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map((action, idx) => (
              <Link key={idx} to={action.link}>
                <Card className="relative bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl hover:scale-105 transition-all duration-300 hover:bg-white/15 cursor-pointer group overflow-hidden">
                  {/* Badge */}
                  {action.badge && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {action.badge}
                    </div>
                  )}
                  
                  {/* Icon */}
                  <div className={`bg-gradient-to-br ${action.gradient} p-3 rounded-xl mb-3 w-fit group-hover:scale-110 transition-transform shadow-lg`}>
                    <action.icon className="h-6 w-6 text-white" />
                  </div>
                  
                  {/* Text */}
                  <h4 className="font-semibold text-white text-sm mb-1">{action.name}</h4>
                  <p className="text-xs text-gray-300">{action.description}</p>
                  
                  {/* Hover effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
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
