import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Bell, X, Check, CheckCheck, Trash2, Zap, ShoppingBag, 
  CreditCard, Gift, Award, AlertCircle, Info
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const NotificationCenter = ({ userId, isOpen, onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef(null);

  useEffect(() => {
    if (isOpen && userId) {
      fetchNotifications();
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (userId) {
      fetchUnreadCount();
    }
  }, [userId]);

  // Close on outside click (excluding the bell button)
  useEffect(() => {
    const handleClickOutside = (event) => {
      const bellBtn = document.getElementById('notification-bell-btn');
      if (panelRef.current && !panelRef.current.contains(event.target) && !bellBtn?.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/notifications/${userId}?limit=50`);
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get(`${API}/api/notifications/${userId}/count`);
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.post(`${API}/api/notifications/${notificationId}/mark-read`);
      setNotifications(prev => 
        prev.map(n => n.notification_id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post(`${API}/api/notifications/${userId}/mark-all-read`);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await axios.delete(`${API}/api/notifications/${notificationId}`);
      setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getIcon = (type) => {
    const icons = {
      mining: Zap,
      order: ShoppingBag,
      payment: CreditCard,
      voucher: Gift,
      reward: Award,
      alert: AlertCircle,
      info: Info
    };
    return icons[type] || Bell;
  };

  const getIconColor = (type) => {
    const colors = {
      mining: 'text-yellow-500 bg-yellow-100',
      order: 'text-blue-500 bg-blue-100',
      payment: 'text-green-500 bg-green-100',
      voucher: 'text-purple-500 bg-purple-100',
      reward: 'text-pink-500 bg-pink-100',
      alert: 'text-red-500 bg-red-100',
      info: 'text-gray-500 bg-gray-100'
    };
    return colors[type] || 'text-gray-500 bg-gray-100';
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={panelRef}
      className="fixed right-4 top-20 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 z-[100] overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-white" />
            <h3 className="font-bold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <span className="bg-white text-purple-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="h-4 w-4 text-white" />
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-[60vh] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => {
              const Icon = getIcon(notification.notification_type);
              const iconColor = getIconColor(notification.notification_type);
              
              return (
                <div 
                  key={notification.notification_id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    !notification.is_read ? 'bg-purple-50/50' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <div className={`p-2 rounded-xl ${iconColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.is_read ? 'font-semibold' : ''} text-gray-900`}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatTime(notification.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      {!notification.is_read && (
                        <button
                          onClick={() => markAsRead(notification.notification_id)}
                          className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4 text-gray-400" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.notification_id)}
                        className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 border-t border-gray-100 bg-gray-50">
          <button 
            onClick={() => { onClose(); }}
            className="w-full text-center text-sm text-purple-600 font-medium hover:text-purple-700"
          >
            View All Notifications
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
