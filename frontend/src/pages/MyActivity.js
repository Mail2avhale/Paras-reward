import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Activity, Clock, TrendingUp, Users, Zap, Gift, CreditCard, ShoppingBag } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL || '';

const MyActivity = ({ user }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [userActivity, setUserActivity] = useState([]);
  const [liveActivity, setLiveActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('my'); // 'my' or 'live'

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchActivities();
  }, [user, navigate]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      // Fetch user's own activity
      const userRes = await axios.get(`${API}/api/user/${user.uid}/recent-activity`);
      setUserActivity(userRes.data.activities || []);

      // Fetch live platform activity
      const liveRes = await axios.get(`${API}/api/public/live-activity`);
      setLiveActivity(liveRes.data.activities || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type) => {
    const icons = {
      'mining': <Zap className="w-5 h-5 text-amber-400" />,
      'tap_game': <Activity className="w-5 h-5 text-blue-400" />,
      'referral': <Users className="w-5 h-5 text-green-400" />,
      'purchase': <ShoppingBag className="w-5 h-5 text-pink-400" />,
      'withdrawal': <CreditCard className="w-5 h-5 text-purple-400" />,
      'gift': <Gift className="w-5 h-5 text-red-400" />,
      'bill_payment': <CreditCard className="w-5 h-5 text-cyan-400" />,
      'default': <TrendingUp className="w-5 h-5 text-gray-400" />
    };
    return icons[type] || icons.default;
  };

  const getActivityColor = (type) => {
    const colors = {
      'mining': 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
      'tap_game': 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
      'referral': 'from-green-500/20 to-green-600/10 border-green-500/30',
      'purchase': 'from-pink-500/20 to-pink-600/10 border-pink-500/30',
      'withdrawal': 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
      'default': 'from-gray-500/20 to-gray-600/10 border-gray-500/30'
    };
    return colors[type] || colors.default;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = (now - date) / 1000;
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-xl border-b border-gray-800">
        <div className="px-4 py-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-white text-xl font-bold">Activity</h1>
              <p className="text-gray-500 text-sm">Your activity & platform updates</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pb-3 gap-2">
          <button
            onClick={() => setActiveTab('my')}
            className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'my'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800/50 text-gray-400'
            }`}
          >
            <Activity className="w-4 h-4 inline mr-2" />
            My Activity
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'live'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800/50 text-gray-400'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Live Feed
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 pb-24">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-gray-800/50 rounded-xl p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-700"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'my' ? (
          /* My Activity Tab */
          <div className="space-y-3">
            {userActivity.length === 0 ? (
              <Card className="bg-gray-800/50 border-gray-700 p-8 text-center">
                <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No activity yet</p>
                <p className="text-gray-500 text-sm mt-1">Start mining or playing games to see your activity here</p>
              </Card>
            ) : (
              userActivity.map((activity, index) => (
                <Card 
                  key={index}
                  className={`bg-gradient-to-r ${getActivityColor(activity.type)} border p-4`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-800/50 flex items-center justify-center flex-shrink-0">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium">{activity.description || activity.type}</p>
                      {activity.amount && (
                        <p className="text-amber-400 font-semibold">
                          {activity.amount > 0 ? '+' : ''}{activity.amount.toFixed(2)} PRC
                        </p>
                      )}
                      <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(activity.created_at)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        ) : (
          /* Live Activity Tab */
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-400 text-sm font-medium">Live Updates</span>
            </div>
            
            {liveActivity.length === 0 ? (
              <Card className="bg-gray-800/50 border-gray-700 p-8 text-center">
                <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No live activity</p>
              </Card>
            ) : (
              liveActivity.map((activity, index) => (
                <Card 
                  key={index}
                  className="bg-gray-800/50 border-gray-700 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                      {activity.user?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white">
                        <span className="font-medium text-purple-400">{activity.user || 'User***'}</span>
                        {' '}{activity.text || activity.action}
                      </p>
                      {activity.amount && (
                        <p className="text-amber-400 font-semibold text-sm">
                          +{activity.amount} PRC
                        </p>
                      )}
                      <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {activity.city && `${activity.city} • `}
                        {formatTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyActivity;
