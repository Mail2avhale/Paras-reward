import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, CheckCheck, Trash2, X, UserPlus, MessageCircle, Award } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const NotificationBell = ({ user }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (user?.uid) {
      fetchUnreadCount();
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user?.uid) {
      fetchNotifications();
    }
  }, [isOpen, user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get(`${API}/api/notifications/${user.uid}/unread-count`);
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/notifications/${user.uid}?limit=10`);
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
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
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put(`${API}/api/notifications/${user.uid}/read-all`);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API}/api/notifications/${notificationId}`);
      setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markAsRead(notification.notification_id);
    }
    if (notification.action_url) {
      navigate(notification.action_url);
      setIsOpen(false);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_follower':
        return <UserPlus className="w-5 h-5 text-purple-400" />;
      case 'new_message':
        return <MessageCircle className="w-5 h-5 text-blue-400" />;
      case 'milestone':
        return <Award className="w-5 h-5 text-amber-400" />;
      default:
        return <Bell className="w-5 h-5 text-gray-400" />;
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  if (!user?.uid) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
        data-testid="notification-bell"
      >
        <Bell className="w-5 h-5 text-white" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-50"
            style={{ maxHeight: '70vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0">
              <h3 className="text-white font-bold">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-purple-400 hover:text-purple-300 font-medium"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-800 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 60px)' }}>
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-gray-800"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-800 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-800 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500">No notifications yet</p>
                  <p className="text-gray-600 text-sm mt-1">
                    You&apos;ll see new followers and messages here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800/50">
                  {notifications.map((notification, index) => (
                    <motion.div
                      key={notification.notification_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleNotificationClick(notification)}
                      className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-800/50 transition-colors group ${
                        !notification.read ? 'bg-purple-500/5' : ''
                      }`}
                    >
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        notification.type === 'new_follower' ? 'bg-purple-500/20' :
                        notification.type === 'new_message' ? 'bg-blue-500/20' :
                        'bg-amber-500/20'
                      }`}>
                        {notification.icon ? (
                          <span className="text-xl">{notification.icon}</span>
                        ) : (
                          getNotificationIcon(notification.type)
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!notification.read ? 'text-white font-medium' : 'text-gray-300'}`}>
                          {notification.title}
                        </p>
                        <p className="text-gray-500 text-sm truncate">
                          {notification.message}
                        </p>
                        <p className="text-gray-600 text-xs mt-1">
                          {formatTime(notification.created_at)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!notification.read && (
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        )}
                        <button
                          onClick={(e) => deleteNotification(notification.notification_id, e)}
                          className="w-8 h-8 rounded-full hover:bg-gray-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-800 bg-gray-900/80 backdrop-blur-sm">
                <button
                  onClick={() => {
                    navigate('/notifications');
                    setIsOpen(false);
                  }}
                  className="w-full py-2 text-center text-purple-400 hover:text-purple-300 text-sm font-medium"
                >
                  View All Notifications
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
