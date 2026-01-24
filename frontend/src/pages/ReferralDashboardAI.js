import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import Tree from 'react-d3-tree';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  Users, TrendingUp, Award, Share2, Copy, Check, 
  ChevronRight, Sparkles, Bot, Brain, Trophy,
  Crown, Zap, Gift, ArrowRight, Download, BarChart3,
  MessageCircle, UserPlus, Coins, Target, Star, Shield,
  MapPin, Eye, EyeOff, Send
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  AIReferralCoach, 
  NetworkLevelVisualization, 
  SocialShareCard, 
  AINetworkAnalytics,
  AIFraudDetection,
  LEVEL_CONFIG 
} from '@/components/AINetworkReferral';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

function ReferralDashboardAI({ user, onLogout }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [treeData, setTreeData] = useState(null);
  const [levelStats, setLevelStats] = useState(null);
  const [bonusBreakdown, setBonusBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // New states for My Referrals and Nearby Users
  const [directReferrals, setDirectReferrals] = useState([]);
  const [referrer, setReferrer] = useState(null);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [showLocation, setShowLocation] = useState(true);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(false);

  const referralCode = user?.referral_code || user?.uid?.slice(0, 8).toUpperCase();

  useEffect(() => {
    fetchReferralData();
  }, [user.uid]);

  const fetchReferralData = async () => {
    setLoading(true);
    try {
      const [statsRes, earningsRes, treeRes, levelRes, bonusRes] = await Promise.all([
        axios.get(`${API}/referrals/${user.uid}/stats`).catch(() => ({ data: {} })),
        axios.get(`${API}/referrals/${user.uid}/earnings`).catch(() => ({ data: {} })),
        axios.get(`${API}/referrals/${user.uid}/tree`).catch(() => ({ data: { tree: null } })),
        axios.get(`${API}/referrals/${user.uid}/levels`).catch(() => ({ data: {} })),
        axios.get(`${API}/referrals/${user.uid}/bonus-breakdown`).catch(() => ({ data: {} }))
      ]);

      setStats(statsRes.data);
      setEarnings(earningsRes.data);
      setTreeData(treeRes.data.tree);
      setLevelStats(levelRes.data);
      setBonusBreakdown(bonusRes.data);
    } catch (error) {
      console.error('Error fetching referral data:', error);
      toast.error('Failed to load referral data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch direct referrals list
  const fetchDirectReferrals = async () => {
    setLoadingReferrals(true);
    try {
      const response = await axios.get(`${API}/referrals/${user.uid}/direct-list`);
      setDirectReferrals(response.data.referrals || []);
      setReferrer(response.data.referrer);
    } catch (error) {
      console.error('Error fetching referrals:', error);
    } finally {
      setLoadingReferrals(false);
    }
  };

  // Fetch nearby users
  const fetchNearbyUsers = async () => {
    setLoadingNearby(true);
    try {
      // First update IP location
      await axios.post(`${API}/user/${user.uid}/update-ip-location`).catch(() => {});
      
      const response = await axios.get(`${API}/social/nearby-users/${user.uid}`);
      setNearbyUsers(response.data.nearby_users || []);
      setUserLocation(response.data.user_location);
    } catch (error) {
      console.error('Error fetching nearby users:', error);
    } finally {
      setLoadingNearby(false);
    }
  };

  // Toggle location visibility
  const toggleLocationVisibility = async () => {
    try {
      const response = await axios.put(`${API}/user/${user.uid}/location-visibility`, {
        show_location: !showLocation
      });
      setShowLocation(!showLocation);
      toast.success(response.data.message);
    } catch (error) {
      toast.error('Failed to update setting');
    }
  };

  // Navigate to messages with a specific user
  const openMessageWith = (recipientUid) => {
    navigate(`/messages/${recipientUid}`);
  };

  // Follow a user
  const followUser = async (targetUid) => {
    try {
      await axios.post(`${API}/social/follow`, {
        follower_uid: user.uid,
        following_uid: targetUid
      });
      toast.success('Following!');
      // Update local state
      setNearbyUsers(prev => prev.map(u => 
        u.uid === targetUid ? { ...u, is_following: true } : u
      ));
    } catch (error) {
      toast.error('Could not follow user');
    }
  };

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'myreferrals' && directReferrals.length === 0) {
      fetchDirectReferrals();
    }
    if (activeTab === 'nearby' && nearbyUsers.length === 0) {
      fetchNearbyUsers();
    }
  }, [activeTab]);

  const handleSuggestionClick = (action) => {
    switch (action) {
      case 'Share Now':
      case 'Share Status':
      case 'Share Offer':
        setActiveTab('share');
        break;
      case 'Go VIP':
        window.location.href = '/subscription';
        break;
      case 'Send Reminder':
        toast.info('Reminder feature coming soon!');
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 pt-20 pb-24">
        <div className="flex flex-col items-center justify-center h-96">
          <motion.div
            className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center mb-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <UserPlus className="w-8 h-8 text-white" />
          </motion.div>
          <p className="text-gray-600">Loading your friends...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'myreferrals', label: 'My Referrals', icon: MessageCircle },
    { id: 'nearby', label: 'Nearby', icon: Users },
    { id: 'network', label: 'Levels', icon: Users },
    { id: 'share', label: 'Share', icon: Share2 },
    { id: 'ai', label: 'AI Tips', icon: Brain },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 pt-20 pb-24">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                  <UserPlus className="w-6 h-6 text-white" />
                </div>
                Invite Friends Hub
              </h1>
              <p className="text-gray-600 mt-1">Smart referral program with bonus rewards</p>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-xl">
              <Sparkles className="w-5 h-5" />
              <span className="font-bold">AI Powered</span>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        >
          <Card className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">Total Friends</p>
                <p className="text-2xl font-bold">
                  {Object.values(levelStats || {}).reduce((a, b) => typeof b === 'number' ? a + b : a, 0)}
                </p>
              </div>
              <Users className="w-8 h-8 opacity-60" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">Total Earned</p>
                <p className="text-2xl font-bold">{earnings?.total_earned || 0} PRC</p>
              </div>
              <Coins className="w-8 h-8 opacity-60" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">Active Rate</p>
                <p className="text-2xl font-bold">{stats?.conversion_rate || 0}%</p>
              </div>
              <TrendingUp className="w-8 h-8 opacity-60" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-pink-500 to-rose-600 text-white border-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">Direct Refs</p>
                <p className="text-2xl font-bold">{stats?.total_referrals || levelStats?.level_1 || 0}</p>
              </div>
              <Target className="w-8 h-8 opacity-60" />
            </div>
          </Card>
        </motion.div>

        {/* Tabs */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6 overflow-x-auto"
        >
          <div className="flex gap-2 bg-white rounded-xl p-1.5 shadow-lg min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-2.5 px-4 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {/* AI Coach Summary */}
              <AIReferralCoach 
                user={user} 
                networkStats={{
                  ...levelStats,
                  total_referrals: stats?.total_referrals,
                  inactive_count: stats?.total_referrals - (stats?.active_referrals || 0)
                }}
                onSuggestionClick={handleSuggestionClick}
              />

              {/* AI Analytics */}
              <AINetworkAnalytics 
                networkStats={levelStats}
                earnings={earnings}
              />

              {/* Level Bonus Info */}
              <Card className="p-6 border-0 shadow-xl lg:col-span-2">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Gift className="w-6 h-6 text-purple-600" />
                  Referral Bonus Structure
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {LEVEL_CONFIG.map((level) => (
                    <div 
                      key={level.level}
                      className={`p-4 rounded-xl bg-gradient-to-br ${level.color} text-white text-center`}
                    >
                      <span className="text-2xl mb-2 block">{level.icon}</span>
                      <p className="font-bold text-lg">{level.activeBonus} PRC</p>
                      <p className="text-xs opacity-80">{level.name}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'network' && (
            <motion.div
              key="network"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <NetworkLevelVisualization levelStats={levelStats} bonusBreakdown={bonusBreakdown} />
            </motion.div>
          )}

          {/* MY REFERRALS TAB - with messaging */}
          {activeTab === 'myreferrals' && (
            <motion.div
              key="myreferrals"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <Card className="p-6 border-0 shadow-xl">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <MessageCircle className="w-6 h-6 text-purple-600" />
                  My Referrals & Messages
                </h3>
                <p className="text-gray-500 text-sm mb-6">
                  Message your referrals directly to help them get started!
                </p>

                {/* Referrer (person who referred you) */}
                {referrer && (
                  <div className="mb-6">
                    <p className="text-sm text-gray-500 mb-2 font-medium">👆 Referred By</p>
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold">
                          {referrer.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{referrer.name}</p>
                          <p className="text-xs text-gray-500">
                            {referrer.city && `${referrer.city}, `}{referrer.state}
                          </p>
                        </div>
                      </div>
                      {referrer.can_message && (
                        <Button 
                          size="sm" 
                          onClick={() => openMessageWith(referrer.uid)}
                          className="bg-amber-500 hover:bg-amber-600"
                        >
                          <Send className="w-4 h-4 mr-1" />
                          Message
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Direct Referrals List */}
                <p className="text-sm text-gray-500 mb-2 font-medium">
                  👇 Your Direct Referrals ({directReferrals.length})
                </p>

                {loadingReferrals ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : directReferrals.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">No referrals yet</p>
                    <p className="text-gray-400 text-sm mb-4">Share your link to invite friends!</p>
                    <Button onClick={() => setActiveTab('share')} className="bg-purple-600">
                      Start Sharing
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {directReferrals.map((ref, index) => (
                      <motion.div
                        key={ref.uid}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`flex items-center justify-between p-4 rounded-xl border ${
                          ref.is_active 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                            ref.is_active 
                              ? 'bg-gradient-to-br from-green-500 to-emerald-500' 
                              : 'bg-gradient-to-br from-gray-400 to-gray-500'
                          }`}>
                            {ref.avatar ? (
                              <img src={ref.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              ref.name?.charAt(0).toUpperCase() || '?'
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900">{ref.name}</p>
                              {ref.is_active && (
                                <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">Active</span>
                              )}
                              {ref.subscription_plan !== 'explorer' && (
                                <Crown className="w-4 h-4 text-amber-500" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              {ref.city && `${ref.city}, `}{ref.state} • Joined {new Date(ref.joined_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {ref.can_message && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openMessageWith(ref.uid)}
                              className="border-purple-300 text-purple-600 hover:bg-purple-50"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {/* NEARBY USERS TAB */}
          {activeTab === 'nearby' && (
            <motion.div
              key="nearby"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <Card className="p-6 border-0 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <MapPin className="w-6 h-6 text-purple-600" />
                    Nearby Users
                  </h3>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={toggleLocationVisibility}
                    className={showLocation ? 'border-green-500 text-green-600' : 'border-gray-300'}
                  >
                    {showLocation ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
                    {showLocation ? 'Visible' : 'Hidden'}
                  </Button>
                </div>

                {userLocation && (
                  <div className="mb-4 p-3 bg-purple-50 rounded-lg text-sm">
                    <span className="text-purple-700">📍 Your location: </span>
                    <span className="font-medium text-purple-900">
                      {userLocation.city && `${userLocation.city}, `}{userLocation.state}, {userLocation.country}
                    </span>
                  </div>
                )}

                <p className="text-gray-500 text-sm mb-6">
                  Connect with users near you! Follow and message them to grow your network.
                </p>

                {loadingNearby ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : nearbyUsers.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">No nearby users found</p>
                    <p className="text-gray-400 text-sm">
                      {!userLocation ? 'Update your profile with your city to see nearby users' : 'Be the first in your area!'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {nearbyUsers.map((nearbyUser, index) => (
                      <motion.div
                        key={nearbyUser.uid}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-4 bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-lg">
                              {nearbyUser.avatar ? (
                                <img src={nearbyUser.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                nearbyUser.name?.charAt(0).toUpperCase() || '?'
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1">
                                <p className="font-semibold text-gray-900">{nearbyUser.name}</p>
                                {nearbyUser.is_verified && (
                                  <Shield className="w-4 h-4 text-blue-500" />
                                )}
                              </div>
                              <p className="text-xs text-purple-600 font-medium">{nearbyUser.distance_label}</p>
                            </div>
                          </div>
                          {nearbyUser.subscription_plan !== 'explorer' && (
                            <Crown className="w-5 h-5 text-amber-500" />
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                          <span>{nearbyUser.followers_count} followers</span>
                          <span>•</span>
                          <span>{nearbyUser.city}, {nearbyUser.state}</span>
                        </div>

                        <div className="flex gap-2">
                          {!nearbyUser.is_following && (
                            <Button 
                              size="sm" 
                              onClick={() => followUser(nearbyUser.uid)}
                              className="flex-1 bg-purple-600 hover:bg-purple-700"
                            >
                              <UserPlus className="w-4 h-4 mr-1" />
                              Follow
                            </Button>
                          )}
                          {nearbyUser.is_following && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="flex-1 border-green-500 text-green-600"
                              disabled
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Following
                            </Button>
                          )}
                          {nearbyUser.can_message && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openMessageWith(nearbyUser.uid)}
                              className="border-purple-300 text-purple-600 hover:bg-purple-50"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-sm text-amber-800">
                    <strong>🔒 Privacy:</strong> Only users who have enabled "Show my location" are visible here. 
                    Toggle the button above to control your visibility.
                  </p>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'share' && (
            <motion.div
              key="share"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-lg mx-auto"
            >
              <SocialShareCard 
                user={user}
                referralCode={referralCode}
              />
            </motion.div>
          )}

          {activeTab === 'ai' && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <AIReferralCoach 
                user={user} 
                networkStats={{
                  ...levelStats,
                  total_referrals: stats?.total_referrals,
                  inactive_count: stats?.total_referrals - (stats?.active_referrals || 0)
                }}
                onSuggestionClick={handleSuggestionClick}
              />
              <AINetworkAnalytics 
                networkStats={levelStats}
                earnings={earnings}
              />
            </motion.div>
          )}

          {activeTab === 'tree' && (
            <motion.div
              key="tree"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="p-6 border-0 shadow-xl">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-6 h-6 text-purple-600" />
                  Friends Tree View
                </h3>
                {treeData ? (
                  <div className="h-[500px] bg-gray-50 rounded-xl overflow-hidden">
                    <Tree
                      data={treeData}
                      orientation="vertical"
                      pathFunc="step"
                      translate={{ x: 300, y: 50 }}
                      separation={{ siblings: 1.5, nonSiblings: 2 }}
                      nodeSize={{ x: 150, y: 100 }}
                      renderCustomNodeElement={({ nodeDatum }) => (
                        <g>
                          <circle r={25} fill={nodeDatum.children ? '#8b5cf6' : '#10b981'} />
                          <text
                            fill="white"
                            fontSize={10}
                            textAnchor="middle"
                            dy={4}
                          >
                            {nodeDatum.name?.slice(0, 2).toUpperCase() || '?'}
                          </text>
                          <text
                            fill="#374151"
                            fontSize={10}
                            textAnchor="middle"
                            dy={45}
                          >
                            {nodeDatum.name?.split(' ')[0] || 'User'}
                          </text>
                        </g>
                      )}
                    />
                  </div>
                ) : (
                  <div className="h-64 bg-gray-50 rounded-xl flex flex-col items-center justify-center">
                    <Users className="w-16 h-16 text-gray-300 mb-4" />
                    <p className="text-gray-500 text-lg">No referrals yet</p>
                    <p className="text-gray-400 text-sm">Share your link to invite friends!</p>
                    <Button 
                      className="mt-4 bg-purple-600"
                      onClick={() => setActiveTab('share')}
                    >
                      Start Sharing
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ReferralDashboardAI;
