import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, Trash2, CheckCheck, Settings, Filter } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NotificationCenter = ({ user, className = '', isOpen: propIsOpen, onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showActions, setShowActions] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unread
  const dropdownRef = useRef(null);
  
  // Use prop if provided, otherwise use internal state
  const isOpen = propIsOpen !== undefined ? propIsOpen : internalIsOpen;
  const setIsOpen = (value) => {
    if (propIsOpen !== undefined && onClose) {
      if (!value) onClose();
    } else {
      setInternalIsOpen(value);
    }
  };

  useEffect(() => {
    if (user?.uid) {
      fetchNotifications();
    }
  }, [user?.uid]);
  
  // Refetch when opened from external control
  useEffect(() => {
    if (isOpen && user?.uid) {
      fetchNotifications();
    }
  }, [isOpen, user?.uid]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSelectedIds([]);
        setShowActions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    if (!user?.uid) return;
    try {
      setLoading(true);
      const unreadOnly = filter === 'unread';
      const res = await axios.get(`${API}/notifications/${user.uid}?limit=20&unread_only=${unreadOnly}`);
      const data = res.data || {};
      const notifs = data.notifications || [];
      setNotifications(notifs);
      setUnreadCount(data.unread_count || notifs.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId, e) => {
    if (e) e.stopPropagation();
    try {
      await axios.put(`${API}/notifications/${notificationId}/read`);
      setNotifications(prev => 
        prev.map(n => n.notification_id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put(`${API}/notifications/${user.uid}/read-all`);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId, e) => {
    if (e) e.stopPropagation();
    try {
      await axios.delete(`${API}/notifications/${notificationId}`);
      setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
      // Update unread count if deleted notification was unread
      const deletedNotif = notifications.find(n => n.notification_id === notificationId);
      if (deletedNotif && !deletedNotif.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      await axios.post(`${API}/notifications/${user.uid}/bulk-delete`, {
        notification_ids: selectedIds
      });
      const deletedUnread = notifications.filter(n => selectedIds.includes(n.notification_id) && !n.read).length;
      setNotifications(prev => prev.filter(n => !selectedIds.includes(n.notification_id)));
      setUnreadCount(prev => Math.max(0, prev - deletedUnread));
      setSelectedIds([]);
      setShowActions(false);
    } catch (error) {
      console.error('Error deleting selected:', error);
    }
  };

  const markSelectedAsRead = async () => {
    if (selectedIds.length === 0) return;
    try {
      await axios.post(`${API}/notifications/${user.uid}/bulk-mark-read`, {
        notification_ids: selectedIds
      });
      const markedCount = notifications.filter(n => selectedIds.includes(n.notification_id) && !n.read).length;
      setNotifications(prev => prev.map(n => 
        selectedIds.includes(n.notification_id) ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - markedCount));
      setSelectedIds([]);
      setShowActions(false);
    } catch (error) {
      console.error('Error marking selected as read:', error);
    }
  };

  const clearReadNotifications = async () => {
    try {
      await axios.delete(`${API}/notifications/${user.uid}/read`);
      setNotifications(prev => prev.filter(n => !n.read));
    } catch (error) {
      console.error('Error clearing read notifications:', error);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await axios.delete(`${API}/notifications/${user.uid}/clear-all`);
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error clearing all notifications:', error);
    }
  };

  const toggleSelect = (notificationId, e) => {
    e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(notificationId) 
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type) => {
    const icons = {
      'subscription_approved': '🎉',
      'subscription_rejected': '❌',
      'kyc_approved': '✅',
      'kyc_rejected': '⚠️',
      'bill_approved': '💰',
      'bill_rejected': '❌',
      'referral': '👥',
      'reward': '🎁',
      'system': '🔔',
      'announcement': '📢'
    };
    return icons[type] || '🔔';
  };

  // If external control (isOpen prop provided), don't render our own button
  const isExternallyControlled = propIsOpen !== undefined;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Only show button if not externally controlled */}
      {!isExternallyControlled && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
          data-testid="notification-bell"
        >
          <Bell className="w-5 h-5 text-gray-400" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div className={`${isExternallyControlled ? 'fixed top-16 right-4' : 'absolute right-0 mt-2'} w-96 bg-gray-900 rounded-xl border border-gray-800 shadow-xl z-50 overflow-hidden`}>
          {/* Header */}
          <div className="p-3 border-b border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notifications
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowActions(!showActions)}
                  className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                  title="More options"
                >
                  <Settings className="w-4 h-4" />
                </button>
                {isExternallyControlled && (
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            {/* Filter & Actions */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                <button
                  onClick={() => { setFilter('all'); fetchNotifications(); }}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    filter === 'all' ? 'bg-amber-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => { setFilter('unread'); fetchNotifications(); }}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    filter === 'unread' ? 'bg-amber-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  Unread
                </button>
              </div>
              
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-amber-500 hover:text-amber-400 flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Actions Panel */}
          {showActions && (
            <div className="p-2 border-b border-gray-800 bg-gray-800/50 flex flex-wrap gap-2">
              {selectedIds.length > 0 ? (
                <>
                  <button
                    onClick={markSelectedAsRead}
                    className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    Mark {selectedIds.length} read
                  </button>
                  <button
                    onClick={deleteSelected}
                    className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete {selectedIds.length}
                  </button>
                  <button
                    onClick={() => setSelectedIds([])}
                    className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setSelectedIds(notifications.map(n => n.notification_id))}
                    className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                  >
                    Select all
                  </button>
                  <button
                    onClick={clearReadNotifications}
                    className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                  >
                    Clear read
                  </button>
                  <button
                    onClick={clearAllNotifications}
                    className="px-3 py-1.5 text-xs bg-red-600/80 hover:bg-red-600 text-white rounded-lg"
                  >
                    Clear all
                  </button>
                </>
              )}
            </div>
          )}
          
          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-gray-500 text-sm">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500">No notifications</p>
                <p className="text-gray-600 text-xs mt-1">You're all caught up!</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.notification_id}
                  className={`group p-3 border-b border-gray-800/50 hover:bg-gray-800/50 cursor-pointer transition-colors ${
                    !notif.read ? 'bg-amber-500/5' : ''
                  } ${selectedIds.includes(notif.notification_id) ? 'bg-blue-500/10' : ''}`}
                  onClick={() => {
                    if (showActions) {
                      toggleSelect(notif.notification_id, { stopPropagation: () => {} });
                    } else if (!notif.read) {
                      markAsRead(notif.notification_id);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Selection checkbox */}
                    {showActions && (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(notif.notification_id)}
                        onChange={(e) => toggleSelect(notif.notification_id, e)}
                        className="mt-1 rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                      />
                    )}
                    
                    {/* Icon */}
                    <span className="text-lg flex-shrink-0">
                      {getNotificationIcon(notif.type)}
                    </span>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {notif.title && (
                        <p className={`text-sm font-medium truncate ${!notif.read ? 'text-white' : 'text-gray-300'}`}>
                          {notif.title}
                        </p>
                      )}
                      <p className={`text-sm ${!notif.read ? 'text-gray-300' : 'text-gray-500'}`}>
                        {notif.message}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {formatTime(notif.created_at)}
                      </p>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notif.read && (
                        <button
                          onClick={(e) => markAsRead(notif.notification_id, e)}
                          className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-green-400"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => deleteNotification(notif.notification_id, e)}
                        className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Unread indicator */}
                    {!notif.read && !showActions && (
                      <div className="w-2 h-2 bg-amber-500 rounded-full flex-shrink-0 mt-2" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2 border-t border-gray-800 text-center">
              <p className="text-xs text-gray-500">
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                {unreadCount > 0 && ` · ${unreadCount} unread`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
