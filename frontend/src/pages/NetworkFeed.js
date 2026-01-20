import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Globe, Users, Search, UserPlus, Award, TrendingUp,
  MessageCircle, RefreshCw, Sparkles, Crown, CheckCircle
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL;

const NetworkFeed = ({ user }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('global');
  const [globalFeed, setGlobalFeed] = useState([]);
  const [networkFeed, setNetworkFeed] = useState([]);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');  // NEW: Category filter
  
  // Pagination state
  const [globalPage, setGlobalPage] = useState(1);
  const [networkPage, setNetworkPage] = useState(1);
  const [hasMoreGlobal, setHasMoreGlobal] = useState(true);
  const [hasMoreNetwork, setHasMoreNetwork] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [globalTotal, setGlobalTotal] = useState(0);
  const [networkTotal, setNetworkTotal] = useState(0);
  const ITEMS_PER_PAGE = 10; // Reduced for easier pagination visibility

  // Activity category definitions
  const activityCategories = [
    { id: 'all', label: 'All', icon: '📋', types: [] },
    { id: 'registration', label: 'New Users', icon: '👋', types: ['registration'] },
    { id: 'subscription', label: 'Subscriptions', icon: '⭐', types: ['subscription'] },
    { id: 'referral', label: 'Referrals', icon: '🤝', types: ['referral_bonus', 'referral_reward'] },
    { id: 'earnings', label: 'Earnings', icon: '💰', types: ['tap_game', 'prc_rain', 'mining'] },
    { id: 'redeem', label: 'Redeems', icon: '🛍️', types: ['bill_payment', 'gift_voucher', 'shopping'] },
  ];

  // Filter activities by category
  const getFilteredActivities = (activities) => {
    if (categoryFilter === 'all') return activities;
    const category = activityCategories.find(c => c.id === categoryFilter);
    if (!category || category.types.length === 0) return activities;
    return activities.filter(a => category.types.includes(a.type) || a.category === categoryFilter);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch global feed
      const globalRes = await axios.get(`${API}/api/feed/global?limit=${ITEMS_PER_PAGE}&page=1`);
      const globalActivities = globalRes.data.activities || [];
      setGlobalFeed(globalActivities);
      setGlobalTotal(globalRes.data.total || globalActivities.length);
      setHasMoreGlobal(globalActivities.length >= ITEMS_PER_PAGE);
      setGlobalPage(1);

      // Fetch network feed if logged in
      if (user?.uid) {
        const networkRes = await axios.get(`${API}/api/feed/network/${user.uid}?limit=${ITEMS_PER_PAGE}&page=1`);
        const networkActivities = networkRes.data.activities || [];
        setNetworkFeed(networkActivities);
        setNetworkTotal(networkRes.data.total || networkActivities.length);
        setHasMoreNetwork(networkActivities.length >= ITEMS_PER_PAGE);
        setNetworkPage(1);

        // Fetch suggested users
        const suggestedRes = await axios.get(`${API}/api/social/suggested-users/${user.uid}?limit=5`);
        setSuggestedUsers(suggestedRes.data.suggested_users || []);
      }
    } catch (error) {
      console.error('Error fetching feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreGlobal = async () => {
    if (loadingMore || !hasMoreGlobal) return;
    setLoadingMore(true);
    try {
      const nextPage = globalPage + 1;
      const res = await axios.get(`${API}/api/feed/global?limit=${ITEMS_PER_PAGE}&page=${nextPage}`);
      const newActivities = res.data.activities || [];
      if (newActivities.length > 0) {
        setGlobalFeed(prev => [...prev, ...newActivities]);
        setGlobalPage(nextPage);
        // Update total if provided by API
        if (res.data.total) setGlobalTotal(res.data.total);
      }
      setHasMoreGlobal(newActivities.length >= ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error loading more global feed:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadMoreNetwork = async () => {
    if (loadingMore || !hasMoreNetwork) return;
    setLoadingMore(true);
    try {
      const nextPage = networkPage + 1;
      const res = await axios.get(`${API}/api/feed/network/${user.uid}?limit=${ITEMS_PER_PAGE}&page=${nextPage}`);
      const newActivities = res.data.activities || [];
      if (newActivities.length > 0) {
        setNetworkFeed(prev => [...prev, ...newActivities]);
        setNetworkPage(nextPage);
        // Update total if provided by API
        if (res.data.total) setNetworkTotal(res.data.total);
      }
      setHasMoreNetwork(newActivities.length >= ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error loading more network feed:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await axios.get(`${API}/api/social/search-users?q=${encodeURIComponent(query)}&limit=10`);
      setSearchResults(response.data.users || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleFollow = async (targetUid) => {
    if (!user?.uid) {
      toast.error('Please login to follow users');
      navigate('/login');
      return;
    }

    try {
      await axios.post(`${API}/api/users/${targetUid}/follow`, {
        follower_uid: user.uid
      });
      toast.success('Following!');
      
      // Update suggested users list
      setSuggestedUsers(prev => prev.filter(u => u.uid !== targetUid));
      
      // Update search results
      setSearchResults(prev => prev.map(u => 
        u.uid === targetUid ? { ...u, is_following: true } : u
      ));
    } catch (error) {
      toast.error('Failed to follow');
    }
  };

  const renderActivityItem = (activity, index) => {
    const getActivityIcon = () => {
      // Use icon from API if available
      if (activity.icon) {
        return <span className="text-xl">{activity.icon}</span>;
      }
      
      switch (activity.type) {
        case 'registration':
          return <span className="text-xl">👋</span>;
        case 'subscription':
          return <span className="text-xl">⭐</span>;
        case 'tap_game':
          return <span className="text-xl">👆</span>;
        case 'prc_rain':
          return <span className="text-xl">🌧️</span>;
        case 'referral_bonus':
          return <span className="text-xl">🎯</span>;
        case 'bill_payment':
          return <span className="text-xl">💳</span>;
        case 'gift_voucher':
          return <span className="text-xl">🎁</span>;
        case 'shopping':
          return <span className="text-xl">🛍️</span>;
        case 'milestone':
          return <span className="text-xl">{activity.badge || '🏆'}</span>;
        case 'referral_reward':
          return <span className="text-xl">🎁</span>;
        case 'follow':
          return <UserPlus className="w-5 h-5 text-purple-400" />;
        case 'team_growth':
          return <TrendingUp className="w-5 h-5 text-emerald-400" />;
        default:
          return <Sparkles className="w-5 h-5 text-amber-400" />;
      }
    };

    const getActivityBg = () => {
      switch (activity.type) {
        case 'registration':
          return 'bg-green-500/20';
        case 'subscription':
          return 'bg-amber-500/20';
        case 'tap_game':
          return 'bg-blue-500/20';
        case 'prc_rain':
          return 'bg-cyan-500/20';
        case 'referral_bonus':
          return 'bg-purple-500/20';
        case 'bill_payment':
          return 'bg-indigo-500/20';
        case 'gift_voucher':
          return 'bg-pink-500/20';
        case 'shopping':
          return 'bg-orange-500/20';
        case 'milestone':
          return 'bg-amber-500/20';
        case 'referral_reward':
          return 'bg-emerald-500/20';
        case 'follow':
          return 'bg-purple-500/20';
        case 'team_growth':
          return 'bg-emerald-500/20';
        default:
          return 'bg-gray-800';
      }
    };

    const getActivityColor = () => {
      switch (activity.type) {
        case 'registration':
          return 'text-green-400';
        case 'subscription':
          return 'text-amber-400';
        case 'tap_game':
          return 'text-blue-400';
        case 'prc_rain':
          return 'text-cyan-400';
        case 'referral_bonus':
          return 'text-purple-400';
        case 'bill_payment':
          return 'text-indigo-400';
        case 'gift_voucher':
          return 'text-pink-400';
        case 'shopping':
          return 'text-orange-400';
        default:
          return 'text-gray-400';
      }
    };

    // Get display text - prioritize description from API
    const displayText = activity.description || activity.text || 'Activity';
    const displayUser = activity.user || activity.user_name || 'User';
    const displayTime = activity.timestamp || activity.created_at;

    return (
      <motion.div
        key={activity.id || index}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="bg-gray-900/50 border border-gray-800 rounded-xl p-4"
      >
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 rounded-xl ${getActivityBg()} flex items-center justify-center`}>
            {getActivityIcon()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold">{displayUser}</span>
              {activity.location && (
                <span className="text-gray-500 text-xs">• {activity.location}</span>
              )}
            </div>
            <p className={`text-sm ${getActivityColor()}`}>{displayText}</p>
            <p className="text-gray-600 text-xs mt-1">
              {displayTime ? new Date(displayTime).toLocaleString() : 'Just now'}
            </p>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderUserCard = (userItem, showFollowBtn = true) => (
    <motion.div
      key={userItem.uid}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 p-3 bg-gray-900/50 border border-gray-800 rounded-xl"
    >
      <button 
        onClick={() => navigate(`/profile/${userItem.uid}`)}
        className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold relative flex-shrink-0"
      >
        {userItem.avatar ? (
          <img src={userItem.avatar} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          userItem.name?.charAt(0)?.toUpperCase() || 'U'
        )}
        {userItem.is_verified && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-gray-950">
            <CheckCircle className="w-3 h-3 text-white" />
          </div>
        )}
      </button>
      
      <div className="flex-1 min-w-0">
        <button 
          onClick={() => navigate(`/profile/${userItem.uid}`)}
          className="flex items-center gap-2"
        >
          <span className="text-white font-semibold truncate">{userItem.name}</span>
          {userItem.badge && <span>{userItem.badge}</span>}
          {userItem.membership_type === 'vip' && <Crown className="w-4 h-4 text-amber-400" />}
        </button>
        <p className="text-gray-500 text-sm truncate">
          {userItem.city && <span>{userItem.city}</span>}
          {userItem.city && userItem.team_size > 0 && <span> • </span>}
          {userItem.team_size > 0 && <span>{userItem.team_size} team</span>}
          {(userItem.city || userItem.team_size > 0) && <span> • </span>}
          {userItem.followers_count || 0} followers
        </p>
        {userItem.reason && (
          <p className="text-purple-400 text-xs mt-0.5">{userItem.reason}</p>
        )}
      </div>
      
      {showFollowBtn && !userItem.is_following && (
        <button
          onClick={() => handleFollow(userItem.uid)}
          className="px-4 py-2 bg-purple-500 text-white text-sm font-semibold rounded-lg hover:bg-purple-600 transition-colors flex-shrink-0"
        >
          {t('follow')}
        </button>
      )}
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24 pt-16">
      {/* Header */}
      <div className="px-5 pb-4 pt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-white text-xl font-bold">{t('network')}</h1>
              <p className="text-gray-500 text-sm">{t('discoverAndConnect')}</p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
          >
            <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder={t('searchUsers')}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
        </div>
        
        {/* Quick Location Filters */}
        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
          {['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Hyderabad', 'Chennai'].map(city => (
            <button
              key={city}
              onClick={() => handleSearch(city)}
              className="px-3 py-1.5 bg-gray-800 text-gray-400 text-sm rounded-full whitespace-nowrap hover:bg-purple-500/20 hover:text-purple-400 transition-colors"
            >
              {city}
            </button>
          ))}
        </div>
      </div>

      {/* Search Results */}
      {searchQuery.length >= 2 && (
        <div className="px-5 mb-4">
          <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm mb-3">{t('searchResults')}</p>
            {searching ? (
              <div className="text-center py-4">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-gray-500 text-center py-4">{t('noUsersFound')}</p>
            ) : (
              <div className="space-y-2">
                {searchResults.map(u => renderUserCard(u))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-5 mb-4">
        <div className="flex gap-2 bg-gray-900 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('global')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${
              activeTab === 'global' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4" />
            {t('global')}
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${
              activeTab === 'network' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            {t('following')}
          </button>
        </div>
      </div>

      {/* Category Filter Chips */}
      {activeTab === 'global' && (
        <div className="px-5 mb-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            {activityCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setCategoryFilter(category.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 whitespace-nowrap transition-all ${
                  categoryFilter === category.id
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <span>{category.icon}</span>
                <span>{category.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Users */}
      {user?.uid && suggestedUsers.length > 0 && activeTab === 'global' && categoryFilter === 'all' && (
        <div className="px-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold">{t('suggestedForYou')}</h3>
            <button className="text-purple-400 text-sm">{t('seeAll')}</button>
          </div>
          <div className="space-y-2">
            {suggestedUsers.slice(0, 3).map(u => renderUserCard(u))}
          </div>
        </div>
      )}

      {/* Activity Feed */}
      <div className="px-5">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          {activeTab === 'global' ? t('globalActivity') : t('yourNetwork')}
          {categoryFilter !== 'all' && (
            <span className="text-sm text-purple-400 font-normal">
              • {activityCategories.find(c => c.id === categoryFilter)?.label}
            </span>
          )}
        </h3>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-800"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-800 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-800 rounded w-2/3"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {activeTab === 'global' ? (
              (() => {
                const filteredFeed = getFilteredActivities(globalFeed);
                return filteredFeed.length === 0 ? (
                  <div className="text-center py-12">
                    <Globe className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500">
                      {categoryFilter !== 'all' 
                        ? `No ${activityCategories.find(c => c.id === categoryFilter)?.label.toLowerCase()} activity yet`
                        : t('noActivityYet')
                      }
                    </p>
                    {categoryFilter !== 'all' && (
                      <button
                        onClick={() => setCategoryFilter('all')}
                        className="mt-2 text-purple-400 text-sm hover:underline"
                      >
                        View all activities
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Activity count */}
                    <div className="text-center text-gray-500 text-sm mb-4">
                      Showing {filteredFeed.length} {categoryFilter !== 'all' ? activityCategories.find(c => c.id === categoryFilter)?.label.toLowerCase() : ''} activities
                    </div>
                    
                    {filteredFeed.map((activity, index) => renderActivityItem(activity, index))}
                    
                    {/* Load More / End of list */}
                    {hasMoreGlobal && categoryFilter === 'all' ? (
                      <button
                        onClick={loadMoreGlobal}
                        disabled={loadingMore}
                        className="w-full py-3 mt-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        {loadingMore ? (
                          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4" />
                            {t('loadMore')}
                        </>
                      )}
                    </button>
                  ) : globalFeed.length > 0 && (
                    <p className="text-center text-gray-600 text-sm mt-4 py-3">
                      — {t('allActivitiesLoaded')} ({globalFeed.length}) —
                    </p>
                  )}
                </>
              )
            ) : (
              networkFeed.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 mb-2">{t('noActivityFromNetwork')}</p>
                  <p className="text-gray-600 text-sm">{t('followUsersToSee')}</p>
                </div>
              ) : (
                <>
                  {/* Activity count */}
                  <div className="text-center text-gray-500 text-sm mb-4">
                    {t('showingActivities').replace('{count}', networkFeed.length)}
                  </div>
                  
                  {networkFeed.map((activity, index) => renderActivityItem(activity, index))}
                  
                  {/* Load More / End of list */}
                  {hasMoreNetwork ? (
                    <button
                      onClick={loadMoreNetwork}
                      disabled={loadingMore}
                      className="w-full py-3 mt-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {loadingMore ? (
                        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          {t('loadMore')}
                        </>
                      )}
                    </button>
                  ) : networkFeed.length > 0 && (
                    <p className="text-center text-gray-600 text-sm mt-4 py-3">
                      — {t('allActivitiesLoaded')} ({networkFeed.length}) —
                    </p>
                  )}
                </>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkFeed;
