import React, { useState, useEffect } from 'react';
import { X, Info, AlertTriangle, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PopupMessage = () => {
  const [popup, setPopup] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    fetchPopup();
  }, []);

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

  const handleClose = () => {
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
  };

  const handleButtonClick = () => {
    if (popup?.button_link) {
      window.open(popup.button_link, '_blank');
    }
    handleClose();
  };

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
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
      <div 
        className={`relative w-full max-w-md bg-gradient-to-br ${config.bg} border ${config.border} rounded-2xl shadow-2xl transform transition-all duration-300 ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
        style={{ backdropFilter: 'blur(20px)' }}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
          data-testid="popup-close-btn"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6 pt-8">
          {/* Icon & Title */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-xl bg-gray-900/50 ${config.iconColor}`}>
              <IconComponent className="w-6 h-6" />
            </div>
            <h2 className={`text-xl font-bold ${config.titleColor}`}>
              {popup.title}
            </h2>
          </div>

          {/* Message */}
          <div className="text-gray-300 text-sm leading-relaxed mb-6 whitespace-pre-wrap">
            {popup.message}
          </div>

          {/* Action Button */}
          <button
            onClick={handleButtonClick}
            className={`w-full py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
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
