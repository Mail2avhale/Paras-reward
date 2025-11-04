import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const NotificationContext = createContext();

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children, userId }) {
  const [toasts, setToasts] = useState([]);
  const [lastChecked, setLastChecked] = useState(Date.now());

  // Add toast notification
  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  // Remove toast notification
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Show success toast
  const showSuccess = useCallback(
    (title, message) => {
      addToast({ type: 'success', title, message });
    },
    [addToast]
  );

  // Show error toast
  const showError = useCallback(
    (title, message) => {
      addToast({ type: 'error', title, message });
    },
    [addToast]
  );

  // Show info toast
  const showInfo = useCallback(
    (title, message) => {
      addToast({ type: 'info', title, message });
    },
    [addToast]
  );

  // Show warning toast
  const showWarning = useCallback(
    (title, message) => {
      addToast({ type: 'warning', title, message });
    },
    [addToast]
  );

  // Poll for new notifications
  useEffect(() => {
    if (!userId) return;

    const pollNotifications = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/notifications/${userId}?limit=5`);
        const data = await response.json();
        const notifications = data.notifications || [];

        // Show toasts for new unread notifications
        notifications.forEach((notification) => {
          const notificationTime = new Date(notification.created_at).getTime();
          if (!notification.is_read && notificationTime > lastChecked) {
            addToast({
              type: 'info',
              title: notification.title,
              message: notification.message,
              duration: 6000,
            });
          }
        });

        setLastChecked(Date.now());
      } catch (error) {
        console.error('Error polling notifications:', error);
      }
    };

    // Poll immediately and then every 30 seconds
    pollNotifications();
    const interval = setInterval(pollNotifications, 30000);

    return () => clearInterval(interval);
  }, [userId, lastChecked, addToast]);

  const value = {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
