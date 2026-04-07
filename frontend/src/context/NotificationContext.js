import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

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

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Poll for new server-side notifications and show via Sonner
  useEffect(() => {
    if (!userId) return;

    let isMounted = true;
    const seenNotifications = new Set();
    let lastChecked = Date.now();
    
    const pollNotifications = async () => {
      if (!isMounted) return;
      try {
        const response = await fetch(`${BACKEND_URL}/api/notifications/${userId}?limit=3`);
        if (!response.ok) return;
        const data = await response.json();
        const notifications = data.notifications || [];

        let shownCount = 0;
        for (const notification of notifications) {
          if (shownCount >= 1) break;
          
          const notificationId = notification._id || notification.id || `${notification.title}-${notification.created_at}`;
          const notificationTime = new Date(notification.created_at).getTime();
          
          const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
          if (seenNotifications.has(notificationId) || notificationTime < fiveMinutesAgo) {
            continue;
          }
          
          if (!notification.is_read && notificationTime > lastChecked) {
            seenNotifications.add(notificationId);
            toast.info(notification.title, { description: notification.message, duration: 4000 });
            shownCount++;
          }
        }

        lastChecked = Date.now();
      } catch (error) {
        // Silently ignore notification errors
      }
    };

    const initialTimeout = setTimeout(pollNotifications, 5000);
    const interval = setInterval(pollNotifications, 120000);

    return () => {
      isMounted = false;
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [userId]);

  const value = { toasts, removeToast };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
