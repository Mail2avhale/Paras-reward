import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const TOAST_TYPES = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-500',
    textColor: 'text-white',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-500',
    textColor: 'text-white',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-500',
    textColor: 'text-white',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-500',
    textColor: 'text-white',
  },
};

function ToastNotification({ toast, onClose }) {
  const { id, type = 'info', title, message, duration = 5000 } = toast;
  const { icon: Icon, bgColor, textColor } = TOAST_TYPES[type] || TOAST_TYPES.info;

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  return (
    <div className={`${bgColor} ${textColor} rounded-lg shadow-lg p-4 mb-3 max-w-sm w-full flex items-start gap-3 animate-slide-in`}>
      {/* Icon */}
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {title && <h4 className="font-semibold text-sm mb-1">{title}</h4>}
        <p className="text-sm opacity-90">{message}</p>
      </div>

      {/* Close Button */}
      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 hover:opacity-70 focus:outline-none"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

export default ToastNotification;
