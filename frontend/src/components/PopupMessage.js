import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Info, AlertTriangle, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PopupMessage = () => {
  const [popup, setPopup] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const location = useLocation();

  // Don't show popup on login, signup, or reset pages
  const isAuthPage = ['/login', '/signup', '/reset-password', '/forgot-password'].some(
    path => location.pathname.startsWith(path)
  );

  useEffect(() => {
    // Only fetch popup if not on auth page and user is logged in
    if (!isAuthPage) {
      const user = localStorage.getItem('paras_user');
      if (user) {
        fetchPopup();
      }
    }
  }, [location.pathname]);

  const fetchPopup = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/popup/active`);
      const data = await response.json();
      
      if (data.success && data.has_popup && data.data) {
        // Check if user has already closed this popup in this session
        const closedPopups = JSON.parse(sessionStorage.getItem('closed_popups') || '[]');
        if (!closedPopups.includes(data.data.id)) {
          setPopup(data.data);
          setIsVisible(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch popup:', error);
    }
  };

  const handleClose = useCallback(() => {
    setIsClosing(true);

    // Save to session storage so it doesn't show again in this session
    if (popup?.id) {
      const closedPopups = JSON.parse(sessionStorage.getItem('closed_popups') || '[]');
      closedPopups.push(popup.id);
      sessionStorage.setItem('closed_popups', JSON.stringify(closedPopups));
    }

    setTimeout(() => {
      setIsVisible(false);
      setPopup(null);
    }, 300);
  }, [popup]);

  const handleButtonClick = () => {
    if (popup?.button_link) {
      window.open(popup.button_link, '_blank');
    }
    handleClose();
  };

  // ESC key + native Android back button both close the popup — critical
  // fallback when a very long message pushes the visible close button
  // outside the viewport on small screens.
  useEffect(() => {
    if (!isVisible) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isVisible, handleClose]);

  if (!isVisible || !popup) return null;

  // Message type styling
  const typeConfig = {
    info: {
      bg: 'from-blue-500/20 to-blue-600/10',
      border: 'border-blue-500/30',
      icon: Info,
      iconColor: 'text-blue-400',
      titleColor: 'text-blue-300'
    },
    warning: {
      bg: 'from-amber-500/20 to-amber-600/10',
      border: 'border-amber-500/30',
      icon: AlertTriangle,
      iconColor: 'text-amber-400',
      titleColor: 'text-amber-300'
    },
    success: {
      bg: 'from-green-500/20 to-green-600/10',
      border: 'border-green-500/30',
      icon: CheckCircle,
      iconColor: 'text-green-400',
      titleColor: 'text-green-300'
    },
    error: {
      bg: 'from-red-500/20 to-red-600/10',
      border: 'border-red-500/30',
      icon: AlertCircle,
      iconColor: 'text-red-400',
      titleColor: 'text-red-300'
    }
  };

  const config = typeConfig[popup.message_type] || typeConfig.info;
  const IconComponent = config.icon;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
      onClick={(e) => {
        // Backdrop click closes the popup — critical mobile fallback so
        // users are never trapped when a huge message body pushes the
        // × close button out of the viewport.
        if (e.target === e.currentTarget) handleClose();
      }}
      data-testid="popup-backdrop"
    >
      <div
        className={`relative w-full max-w-md max-h-[90vh] flex flex-col bg-gradient-to-br ${config.bg} border ${config.border} rounded-2xl shadow-2xl transform transition-all duration-300 overflow-hidden ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
        style={{ backdropFilter: 'blur(20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header — icon + title + close button. Kept outside the
            scrolling body so the × button is ALWAYS reachable no matter
            how tall the message is. */}
        <div className={`shrink-0 flex items-center justify-between gap-3 p-5 pb-3 border-b ${config.border}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-xl bg-gray-900/50 ${config.iconColor} shrink-0`}>
              <IconComponent className="w-5 h-5" />
            </div>
            <h2 className={`text-lg font-bold ${config.titleColor} truncate`}>
              {popup.title}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="shrink-0 p-2 rounded-full bg-gray-800/60 hover:bg-gray-700/70 active:bg-gray-600/70 text-gray-300 hover:text-white transition-colors touch-manipulation"
            aria-label="Close popup"
            data-testid="popup-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable message body — grows within viewport max, scrolls
            internally when text is long. overscroll-contain prevents
            body-scroll leaking to the page underneath on mobile. */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 text-gray-300 text-sm leading-relaxed whitespace-pre-wrap"
          data-testid="popup-body"
        >
          {popup.message}
        </div>

        {/* Sticky Footer — action button always visible at bottom, never
            gets pushed off-screen by long messages. */}
        <div className={`shrink-0 p-5 pt-3 border-t ${config.border} bg-black/10`}>
          <button
            onClick={handleButtonClick}
            className={`w-full py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all touch-manipulation ${
              popup.button_link
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black'
                : 'bg-gray-700/50 hover:bg-gray-600/50 text-white'
            }`}
            data-testid="popup-action-btn"
          >
            {popup.button_text || 'Close'}
            {popup.button_link && <ExternalLink className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PopupMessage;
