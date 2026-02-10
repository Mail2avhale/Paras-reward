import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

function ToastNotification({ toast, onClose }) {
  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        onClose(toast.id);
      }, toast.duration || 5000);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
  };

  const bgColors = {
    success: 'bg-green-500/10 border-green-500/20',
    error: 'bg-red-500/10 border-red-500/20',
    warning: 'bg-yellow-500/10 border-yellow-500/20',
    info: 'bg-blue-500/10 border-blue-500/20',
  };

  return (
    <div
      className={`mb-2 p-4 rounded-lg border backdrop-blur-sm shadow-lg animate-slide-in ${
        bgColors[toast.type] || bgColors.info
      }`}
    >
      <div className="flex items-start gap-3">
        {icons[toast.type] || icons.info}
        <div className="flex-1">
          {toast.title && (
            <p className="font-semibold text-white text-sm">{toast.title}</p>
          )}
          <p className="text-gray-300 text-sm">{toast.message}</p>
        </div>
        <button
          onClick={() => onClose(toast.id)}
          className="text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default ToastNotification;
