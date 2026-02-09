import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NotificationContext = createContext();

export const useCenterNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useCenterNotification must be used within CenterNotificationProvider');
  }
  return context;
};

export const CenterNotificationProvider = ({ children }) => {
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback(({ type = 'success', title, message, duration = 3000 }) => {
    setNotification({ type, title, message });
    
    if (duration > 0) {
      setTimeout(() => {
        setNotification(null);
      }, duration);
    }
  }, []);

  const hideNotification = useCallback(() => {
    setNotification(null);
  }, []);

  const success = useCallback((title, message) => {
    showNotification({ type: 'success', title, message });
  }, [showNotification]);

  const error = useCallback((title, message) => {
    showNotification({ type: 'error', title, message, duration: 5000 });
  }, [showNotification]);

  const warning = useCallback((title, message) => {
    showNotification({ type: 'warning', title, message });
  }, [showNotification]);

  const info = useCallback((title, message) => {
    showNotification({ type: 'info', title, message });
  }, [showNotification]);

  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info
  };

  const colors = {
    success: {
      bg: 'from-green-500 to-emerald-600',
      border: 'border-green-500/30',
      text: 'text-green-400',
      iconBg: 'bg-green-500/20'
    },
    error: {
      bg: 'from-red-500 to-red-600',
      border: 'border-red-500/30',
      text: 'text-red-400',
      iconBg: 'bg-red-500/20'
    },
    warning: {
      bg: 'from-amber-500 to-orange-600',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      iconBg: 'bg-amber-500/20'
    },
    info: {
      bg: 'from-blue-500 to-blue-600',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      iconBg: 'bg-blue-500/20'
    }
  };

  return (
    <NotificationContext.Provider value={{ showNotification, hideNotification, success, error, warning, info }}>
      {children}
      
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]"
            onClick={hideNotification}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className={`bg-gradient-to-br from-gray-900 to-gray-800 border ${colors[notification.type].border} rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                {/* Icon */}
                <div className={`w-16 h-16 bg-gradient-to-br ${colors[notification.type].bg} rounded-full flex items-center justify-center mx-auto mb-4`}>
                  {React.createElement(icons[notification.type], { className: 'w-8 h-8 text-white' })}
                </div>
                
                {/* Title */}
                <h3 className={`text-xl font-bold ${colors[notification.type].text} mb-2`}>
                  {notification.title}
                </h3>
                
                {/* Message */}
                {notification.message && (
                  <p className="text-gray-300 text-sm mb-4">
                    {notification.message}
                  </p>
                )}
                
                {/* Close Button */}
                <button
                  onClick={hideNotification}
                  className={`w-full py-3 bg-gradient-to-r ${colors[notification.type].bg} text-white font-bold rounded-xl`}
                >
                  OK
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
};

export default CenterNotificationProvider;
