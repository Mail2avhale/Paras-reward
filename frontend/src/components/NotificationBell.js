import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Bell, X, Check, CheckCircle, XCircle, UserPlus, 
  Coins, AlertTriangle, Shield, Clock
} from 'lucide-react';
import { Button } from './ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NotificationBell = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!userId) return;
    try {
      const response = await axios.get(`${API}/notifications/user/${userId}?limit=30`);
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Fetch unread count only
  const fetchUnreadCount = async () => {
    if (!userId) return;
    try {
      const response = await axios.get(`${API}/notifications/user/${userId}/unread-count`);
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // Mark single notification as read
  const markAsRead = async (notificationId) => {
    try {
      await axios.post(`${API}/notifications/mark-read/${notificationId}`);
      setNotifications(prev => 
        prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await axios.post(`${API}/notifications/mark-all-read/${userId}`);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications read:', error);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [userId]);

  // Fetch full list when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchNotifications().finally(() => setLoading(false));
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get icon for notification type
  const getIcon = (type) => {
    switch (type) {
      case 'payment_approved':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'payment_rejected':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'referral_joined':
        return <UserPlus className="w-4 h-4 text-blue-400" />;
      case 'prc_credited':
        return <Coins className="w-4 h-4 text-purple-400" />;
      case 'subscription_expiry':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'kyc_approved':
        return <Shield className="w-4 h-4 text-green-400" />;
      case 'kyc_rejected':
        return <Shield className="w-4 h-4 text-red-400" />;
      default:
        return <Bell className="w-4 h-4 text-gray-400" />;
    }
  };

  // Format time ago
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <h3 className="font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs text-purple-400 hover:text-purple-300 h-7"
                >
                  <Check className="w-3 h-3 mr-1" />
                  Mark all read
                </Button>
              )}
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-800 rounded">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Clock className="w-5 h-5 animate-spin text-gray-500" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-10 h-10 mx-auto text-gray-700 mb-2" />
                <p className="text-gray-500 text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  onClick={() => !notification.read && markAsRead(notification._id)}
                  className={`px-4 py-3 border-b border-gray-800 cursor-pointer transition-colors ${
                    notification.read ? 'bg-gray-900' : 'bg-gray-800/50 hover:bg-gray-800'
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {getIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${notification.read ? 'text-gray-400' : 'text-white'}`}>
                        {notification.title}
                      </p>
                      <p className={`text-xs mt-0.5 ${notification.read ? 'text-gray-600' : 'text-gray-400'}`}>
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-gray-600 mt-1">
                        {formatTimeAgo(notification.created_at)}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!notification.read && (
                      <div className="flex-shrink-0">
                        <span className="w-2 h-2 bg-purple-500 rounded-full block" />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-800 text-center">
              <p className="text-xs text-gray-500">
                Showing {notifications.length} notifications
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
