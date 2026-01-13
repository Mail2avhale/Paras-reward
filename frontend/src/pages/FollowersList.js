import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, UserPlus, CheckCircle, Crown } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const FollowersList = ({ user, type = 'followers' }) => {
  const navigate = useNavigate();
  const { uid } = useParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const ITEMS_PER_PAGE = 10; // Reduced for easier pagination visibility

  useEffect(() => {
    fetchData();
  }, [uid, type]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch profile name
      const profileRes = await axios.get(`${API}/api/users/${uid}/public-profile`);
      setProfileName(profileRes.data.name || 'User');
      
      // Fetch followers or following
      const endpoint = type === 'followers' 
        ? `${API}/api/users/${uid}/followers?page=1&limit=${ITEMS_PER_PAGE}`
        : `${API}/api/users/${uid}/following?page=1&limit=${ITEMS_PER_PAGE}`;
      
      const response = await axios.get(endpoint);
      const data = type === 'followers' ? response.data.followers : response.data.following;
      setUsers(data || []);
      setTotal(response.data.total || (data || []).length);
      setHasMore((data || []).length >= ITEMS_PER_PAGE);
      setPage(1);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const endpoint = type === 'followers'
        ? `${API}/api/users/${uid}/followers?page=${nextPage}&limit=${ITEMS_PER_PAGE}`
        : `${API}/api/users/${uid}/following?page=${nextPage}&limit=${ITEMS_PER_PAGE}`;
      
      const response = await axios.get(endpoint);
      const newData = type === 'followers' ? response.data.followers : response.data.following;
      setUsers(prev => [...prev, ...(newData || [])]);
      setPage(nextPage);
      setHasMore((newData || []).length >= ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error loading more:', error);
    } finally {
      setLoadingMore(false);
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
      setUsers(prev => prev.map(u => 
        u.uid === targetUid ? { ...u, is_following: true } : u
      ));
    } catch (error) {
      toast.error('Failed to follow');
    }
  };

  const title = type === 'followers' ? 'Followers' : 'Following';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
      {/* Header */}
      <div className="px-5 pb-4" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top, 1.5rem))' }}>
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">{title}</h1>
            <p className="text-gray-500 text-sm">{profileName}</p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="px-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-800"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-800 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-800 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-white font-bold mb-2">No {title.toLowerCase()} yet</h3>
            <p className="text-gray-500 text-sm">
              {type === 'followers' 
                ? "When people follow this user, they'll appear here."
                : "Users this person follows will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((item, index) => (
              <motion.div
                key={item.uid}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-3 bg-gray-900/50 border border-gray-800 rounded-xl"
              >
                <button 
                  onClick={() => navigate(`/profile/${item.uid}`)}
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold relative"
                >
                  {item.avatar ? (
                    <img src={item.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    item.name?.charAt(0)?.toUpperCase() || 'U'
                  )}
                  {item.is_verified && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-gray-950">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
                
                <div className="flex-1 min-w-0">
                  <button 
                    onClick={() => navigate(`/profile/${item.uid}`)}
                    className="flex items-center gap-2"
                  >
                    <span className="text-white font-semibold truncate">{item.name}</span>
                    {item.membership_type === 'vip' && <Crown className="w-4 h-4 text-amber-400" />}
                  </button>
                  <p className="text-gray-500 text-sm">
                    {item.team_size || 0} team • {item.followers_count || 0} followers
                  </p>
                </div>
                
                {user?.uid !== item.uid && !item.is_following && (
                  <button
                    onClick={() => handleFollow(item.uid)}
                    className="px-4 py-2 bg-purple-500 text-white text-sm font-semibold rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    Follow
                  </button>
                )}
              </motion.div>
            ))}
            
            {/* Load More Button */}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 mt-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loadingMore ? (
                  <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Load More'
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FollowersList;
