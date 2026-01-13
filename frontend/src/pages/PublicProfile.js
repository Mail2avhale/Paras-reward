import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, UserPlus, UserMinus, MessageCircle, Share2, Shield, 
  Users, Award, Calendar, MapPin, CheckCircle, Crown, Lock,
  Copy, ExternalLink
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const PublicProfile = ({ user }) => {
  const navigate = useNavigate();
  const { uid } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (uid) {
      fetchProfile();
      if (user?.uid) {
        checkFollowStatus();
      }
    }
  }, [uid, user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/users/${uid}/public-profile`);
      setProfile(response.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const checkFollowStatus = async () => {
    try {
      const response = await axios.get(`${API}/api/users/${user.uid}/check-follow/${uid}`);
      setIsFollowing(response.data.is_following);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const handleFollow = async () => {
    if (!user?.uid) {
      toast.error('Please login to follow users');
      navigate('/login');
      return;
    }

    setFollowLoading(true);
    try {
      if (isFollowing) {
        await axios.delete(`${API}/api/users/${uid}/unfollow`, {
          data: { follower_uid: user.uid }
        });
        setIsFollowing(false);
        toast.success('Unfollowed');
        setProfile(prev => ({ ...prev, followers_count: Math.max(0, (prev.followers_count || 0) - 1) }));
      } else {
        await axios.post(`${API}/api/users/${uid}/follow`, {
          follower_uid: user.uid
        });
        setIsFollowing(true);
        toast.success('Following!');
        setProfile(prev => ({ ...prev, followers_count: (prev.followers_count || 0) + 1 }));
      }
    } catch (error) {
      toast.error('Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessage = () => {
    if (!user?.uid) {
      toast.error('Please login to send messages');
      navigate('/login');
      return;
    }
    navigate(`/messages/${uid}`);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/profile/${uid}`;
    const shareText = `Check out ${profile?.name}'s profile on PARAS REWARD! ${profile?.current_badge?.badge || ''}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: profile?.name, text: shareText, url: shareUrl });
      } catch (e) {
        if (e.name !== 'AbortError') {
          navigator.clipboard.writeText(shareUrl);
          toast.success('Profile link copied!');
        }
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Profile link copied!');
    }
  };

  const copyReferralCode = () => {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(profile.referral_code);
      toast.success('Referral code copied!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Profile not found</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-purple-400">Go back</button>
        </div>
      </div>
    );
  }

  const isOwnProfile = user?.uid === uid;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
      {/* Header */}
      <div className="px-5 pb-4" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top, 1.5rem))' }}>
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <button 
            onClick={handleShare}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
          >
            <Share2 className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Profile Header */}
      <div className="px-5 mb-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          {/* Avatar */}
          <div className="relative inline-block mb-4">
            <div className={`w-28 h-28 rounded-full flex items-center justify-center text-4xl font-bold ${
              profile.membership_type === 'vip' 
                ? 'bg-gradient-to-br from-amber-400 to-amber-600' 
                : 'bg-gradient-to-br from-purple-500 to-purple-700'
            }`}>
              {profile.avatar ? (
                <img src={profile.avatar} alt={profile.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-white">{profile.name?.charAt(0)?.toUpperCase() || 'U'}</span>
              )}
            </div>
            {profile.is_verified && (
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-4 border-gray-950">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
            )}
            {profile.membership_type === 'vip' && (
              <div className="absolute -top-1 -right-1 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center border-4 border-gray-950">
                <Crown className="w-4 h-4 text-white" />
              </div>
            )}
          </div>

          {/* Name & Badge */}
          <h1 className="text-2xl font-bold text-white mb-1">{profile.name}</h1>
          {profile.current_badge && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 rounded-full mb-2">
              <span className="text-lg">{profile.current_badge.badge}</span>
              <span className="text-amber-400 text-sm font-medium">{profile.current_badge.title}</span>
            </div>
          )}
          
          {profile.city && (
            <p className="text-gray-500 text-sm flex items-center justify-center gap-1">
              <MapPin className="w-4 h-4" />
              {profile.city}
            </p>
          )}

          {/* Stats */}
          <div className="flex justify-center gap-8 mt-6">
            <button onClick={() => navigate(`/followers/${uid}`)} className="text-center">
              <p className="text-2xl font-bold text-white">{profile.followers_count || 0}</p>
              <p className="text-gray-500 text-sm">Followers</p>
            </button>
            <button onClick={() => navigate(`/following/${uid}`)} className="text-center">
              <p className="text-2xl font-bold text-white">{profile.following_count || 0}</p>
              <p className="text-gray-500 text-sm">Following</p>
            </button>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{profile.team_size || 0}</p>
              <p className="text-gray-500 text-sm">Team</p>
            </div>
          </div>

          {/* Action Buttons */}
          {!isOwnProfile && (
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleFollow}
                disabled={followLoading}
                className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                  isFollowing 
                    ? 'bg-gray-800 text-white border border-gray-700' 
                    : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white'
                }`}
              >
                {isFollowing ? (
                  <>
                    <UserMinus className="w-5 h-5" />
                    Following
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Follow
                  </>
                )}
              </button>
              <button
                onClick={handleMessage}
                className="flex-1 py-3 bg-gray-800 border border-gray-700 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                Message
              </button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Profile Details */}
      {profile.is_public ? (
        <div className="px-5 space-y-4">
          {/* Level & Badges */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                Badges Earned
              </h3>
              <span className="text-gray-500 text-sm">{profile.total_badges || 0}/6</span>
            </div>
            
            <div className="flex gap-3 flex-wrap">
              {profile.earned_badges?.map((badge, index) => (
                <motion.div
                  key={badge.count}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="w-14 h-14 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center"
                >
                  <span className="text-2xl">{badge.badge}</span>
                </motion.div>
              ))}
              {(!profile.earned_badges || profile.earned_badges.length === 0) && (
                <p className="text-gray-500 text-sm">No badges earned yet</p>
              )}
            </div>
          </motion.div>

          {/* Referral Code */}
          {profile.referral_code && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  Join Their Team
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-900/50 rounded-xl px-4 py-3 font-mono text-purple-300 text-lg">
                  {profile.referral_code}
                </div>
                <button
                  onClick={copyReferralCode}
                  className="p-3 bg-purple-500 rounded-xl hover:bg-purple-600 transition-colors"
                >
                  <Copy className="w-5 h-5 text-white" />
                </button>
              </div>
              <p className="text-purple-400/70 text-sm mt-3">
                Use this code to join {profile.name}'s team!
              </p>
            </motion.div>
          )}

          {/* Member Since */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5"
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-gray-400 text-sm">Member since</p>
                <p className="text-white font-medium">
                  {profile.joined_date ? new Date(profile.joined_date).toLocaleDateString('en-US', { 
                    month: 'long', 
                    year: 'numeric' 
                  }) : 'Unknown'}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="px-5">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center">
            <Lock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-white font-bold mb-2">Private Profile</h3>
            <p className="text-gray-500 text-sm">
              This user has made their profile private. Follow them to see more.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicProfile;
