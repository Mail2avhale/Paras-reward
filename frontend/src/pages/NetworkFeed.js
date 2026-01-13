import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Globe, Users, Search, UserPlus, Award, TrendingUp,
  MessageCircle, RefreshCw, Sparkles, Crown, CheckCircle
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const NetworkFeed = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('global');
  const [globalFeed, setGlobalFeed] = useState([]);
  const [networkFeed, setNetworkFeed] = useState([]);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch global feed
      const globalRes = await axios.get(`${API}/api/feed/global?limit=20`);
      setGlobalFeed(globalRes.data.activities || []);

      // Fetch network feed if logged in
      if (user?.uid) {
        const networkRes = await axios.get(`${API}/api/feed/network/${user.uid}?limit=20`);
        setNetworkFeed(networkRes.data.activities || []);

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
      switch (activity.type) {
        case 'milestone':
          return <span className="text-xl">{activity.badge}</span>;
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
        case 'milestone':
          return 'bg-amber-500/20';
        case 'follow':
          return 'bg-purple-500/20';
        case 'team_growth':
          return 'bg-emerald-500/20';
        default:
          return 'bg-gray-800';
      }
    };

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
            <button 
              onClick={() => activity.user_uid && navigate(`/profile/${activity.user_uid}`)}
              className="text-white font-semibold hover:text-purple-400 transition-colors"
            >
              {activity.user_name || 'User'}
            </button>
            <p className="text-gray-400 text-sm">{activity.text}</p>
            <p className="text-gray-600 text-xs mt-1">
              {activity.created_at ? new Date(activity.created_at).toLocaleString() : 'Just now'}
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
          Follow
        </button>
      )}
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
      {/* Header */}
      <div className="px-5 pb-4" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top, 1.5rem))' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-white text-xl font-bold">Network</h1>
              <p className="text-gray-500 text-sm">Discover & Connect</p>
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
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Search Results */}
      {searchQuery.length >= 2 && (
        <div className="px-5 mb-4">
          <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm mb-3">Search results</p>
            {searching ? (
              <div className="text-center py-4">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No users found</p>
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
            Global
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${
              activeTab === 'network' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            Following
          </button>
        </div>
      </div>

      {/* Suggested Users */}
      {user?.uid && suggestedUsers.length > 0 && activeTab === 'global' && (
        <div className="px-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold">Suggested for You</h3>
            <button className="text-purple-400 text-sm">See all</button>
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
          {activeTab === 'global' ? 'Global Activity' : 'Your Network'}
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
              globalFeed.length === 0 ? (
                <div className="text-center py-12">
                  <Globe className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">No activity yet</p>
                </div>
              ) : (
                globalFeed.map((activity, index) => renderActivityItem(activity, index))
              )
            ) : (
              networkFeed.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 mb-2">No activity from your network</p>
                  <p className="text-gray-600 text-sm">Follow users to see their activity here</p>
                </div>
              ) : (
                networkFeed.map((activity, index) => renderActivityItem(activity, index))
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkFeed;
