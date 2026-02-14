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

  // Poll for new notifications - OPTIMIZED: Reduced polling frequency
  useEffect(() => {
    if (!userId) return;

    let isMounted = true;
    const seenNotifications = new Set(); // Track already shown notifications
    
    const pollNotifications = async () => {
      if (!isMounted) return;
      try {
        const response = await fetch(`${BACKEND_URL}/api/notifications/${userId}?limit=3`);
        if (!response.ok) return;
        const data = await response.json();
        const notifications = data.notifications || [];

        // Show toasts for new unread notifications (max 1 at a time to avoid spam)
        let shownCount = 0;
        for (const notification of notifications) {
          if (shownCount >= 1) break; // Only show 1 notification per poll
          
          const notificationId = notification._id || notification.id || `${notification.title}-${notification.created_at}`;
          const notificationTime = new Date(notification.created_at).getTime();
          
          // Skip if already seen or older than 5 minutes
          const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
          if (seenNotifications.has(notificationId) || notificationTime < fiveMinutesAgo) {
            continue;
          }
          
          if (!notification.is_read && notificationTime > lastChecked) {
            seenNotifications.add(notificationId);
            addToast({
              type: 'info',
              title: notification.title,
              message: notification.message,
              duration: 4000, // Reduced from 6000
            });
            shownCount++;
          }
        }

        if (isMounted) setLastChecked(Date.now());
      } catch (error) {
        // Silently ignore notification errors
      }
    };

    // Poll after 5 seconds delay, then every 2 minutes (increased from 60s)
    const initialTimeout = setTimeout(pollNotifications, 5000);
    const interval = setInterval(pollNotifications, 120000); // 2 minutes

    return () => {
      isMounted = false;
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [userId, addToast]); // Removed lastChecked from deps to prevent re-renders

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
