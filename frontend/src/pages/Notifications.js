import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Bell, Trash2, CheckCheck, UserPlus, MessageCircle, 
  Award, Filter, RefreshCw 
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL;

const Notifications = ({ user }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      toast.error('Please login to view notifications');
      navigate('/login');
      return;
    }
    fetchNotifications();
  }, [user, filter]);

  const fetchNotifications = async (loadMore = false) => {
    try {
      if (!loadMore) {
        setLoading(true);
        setPage(1);
      }
      
      const currentPage = loadMore ? page + 1 : 1;
      const unreadOnly = filter === 'unread';
      
      const response = await axios.get(
        `${API}/api/notifications/${user.uid}?page=${currentPage}&limit=20&unread_only=${unreadOnly}`
      );
      
      const newNotifications = response.data.notifications || [];
      
      if (loadMore) {
        setNotifications(prev => [...prev, ...newNotifications]);
        setPage(currentPage);
      } else {
        setNotifications(newNotifications);
      }
      
      setHasMore(newNotifications.length === 20);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.put(`${API}/api/notifications/${notificationId}/read`);
      setNotifications(prev => 
        prev.map(n => n.notification_id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      toast.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put(`${API}/api/notifications/${user.uid}/read-all`);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await axios.delete(`${API}/api/notifications/${notificationId}`);
      setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
      toast.success('Notification deleted');
    } catch (error) {
      toast.error('Failed to delete notification');
    }
  };

  const clearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all notifications?')) return;
    
    try {
      await axios.delete(`${API}/api/notifications/${user.uid}/clear-all`);
      setNotifications([]);
      toast.success('All notifications cleared');
    } catch (error) {
      toast.error('Failed to clear notifications');
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markAsRead(notification.notification_id);
    }
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_follower':
        return <UserPlus className="w-5 h-5 text-purple-400" />;
      case 'new_message':
        return <MessageCircle className="w-5 h-5 text-blue-400" />;
      case 'referral_message':
        return <MessageCircle className="w-5 h-5 text-green-400" />;
      case 'new_referral':
        return <UserPlus className="w-5 h-5 text-emerald-400" />;
      case 'referral_active':
        return <Award className="w-5 h-5 text-orange-400" />;
      case 'milestone':
        return <Award className="w-5 h-5 text-amber-400" />;
      default:
        return <Bell className="w-5 h-5 text-gray-400" />;
    }
  };

  // Get background color based on notification type
  const getNotificationBgColor = (type, read) => {
    if (read) return 'bg-gray-800/50';
    
    switch (type) {
      case 'new_referral':
        return 'bg-emerald-900/30 border-l-4 border-emerald-500';
      case 'referral_active':
        return 'bg-orange-900/30 border-l-4 border-orange-500';
      case 'referral_message':
        return 'bg-green-900/30 border-l-4 border-green-500';
      default:
        return 'bg-purple-900/20 border-l-4 border-purple-500';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return t('justNow');
    if (diff < 3600000) return t('minutesAgo').replace('{count}', Math.floor(diff / 60000));
    if (diff < 86400000) return t('hoursAgo').replace('{count}', Math.floor(diff / 3600000));
    if (diff < 604800000) return t('daysAgo').replace('{count}', Math.floor(diff / 86400000));
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24 pt-16">
      {/* Header */}
      <div className="px-5 pb-4 pt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-white text-xl font-bold">{t('notifications')}</h1>
              <p className="text-gray-500 text-sm">
                {unreadCount > 0 ? `${unreadCount} ${t('unread')}` : t('allCaughtUpNotifications')}
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchNotifications()}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
          >
            <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filter & Actions */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all' 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {t('all')}
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'unread' 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {t('unread')}
            </button>
          </div>
          
          {notifications.length > 0 && (
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="px-3 py-2 text-purple-400 text-sm font-medium hover:text-purple-300"
                >
                  <CheckCheck className="w-4 h-4 inline mr-1" />
                  {t('readAll')}
                </button>
              )}
              <button
                onClick={clearAll}
                className="px-3 py-2 text-red-400 text-sm font-medium hover:text-red-300"
              >
                <Trash2 className="w-4 h-4 inline mr-1" />
                {t('clear')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="px-5">
        {loading && notifications.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-800"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-800 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-800 rounded w-2/3 mb-2"></div>
                    <div className="h-3 bg-gray-800 rounded w-1/4"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-white font-bold mb-2">{t('noNotifications')}</h3>
            <p className="text-gray-500 text-sm">
              {filter === 'unread' 
                ? t('youveReadAll')
                : t('youllSeeNotifications')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification, index) => (
              <motion.div
                key={notification.notification_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => handleNotificationClick(notification)}
                className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-colors ${
                  !notification.read 
                    ? 'bg-purple-500/10 border border-purple-500/20' 
                    : 'bg-gray-900/50 border border-gray-800 hover:bg-gray-800/50'
                }`}
              >
                {/* Icon */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  notification.type === 'new_follower' ? 'bg-purple-500/20' :
                  notification.type === 'new_message' ? 'bg-blue-500/20' :
                  'bg-amber-500/20'
                }`}>
                  {notification.icon ? (
                    <span className="text-2xl">{notification.icon}</span>
                  ) : (
                    getNotificationIcon(notification.type)
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`font-medium ${!notification.read ? 'text-white' : 'text-gray-300'}`}>
                        {notification.title}
                      </p>
                      <p className="text-gray-500 text-sm mt-0.5">
                        {notification.message}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0 mt-2"></div>
                    )}
                  </div>
                  <p className="text-gray-600 text-xs mt-2">
                    {formatTime(notification.created_at)}
                  </p>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notification.notification_id);
                  }}
                  className="w-10 h-10 rounded-full hover:bg-gray-700 flex items-center justify-center flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4 text-gray-500" />
                </button>
              </motion.div>
            ))}

            {/* Load More */}
            {hasMore && (
              <button
                onClick={() => fetchNotifications(true)}
                disabled={loading}
                className="w-full py-3 text-purple-400 text-sm font-medium hover:text-purple-300 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
