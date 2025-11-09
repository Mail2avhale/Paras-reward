import { toast } from 'sonner';
import { CheckCircle, XCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';

// Enhanced notification system with larger, more prominent messages

export const showSuccessNotification = (title, message, options = {}) => {
  return toast.custom((t) => (
    <div className="animate-in slide-in-from-top-4 fade-in-0 duration-300 w-full max-w-md">
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl p-6 border-2 border-green-300">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center animate-bounce">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-white mb-2">
              {title}
            </h3>
            {message && (
              <p className="text-white/90 text-base leading-relaxed">
                {message}
              </p>
            )}
          </div>
          <button
            onClick={() => toast.dismiss(t)}
            className="text-white/80 hover:text-white transition-colors"
          >
            <XCircle className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  ), {
    duration: options.duration || 5000,
    position: options.position || 'top-center',
    ...options
  });
};

export const showErrorNotification = (title, message, options = {}) => {
  return toast.custom((t) => (
    <div className="animate-in slide-in-from-top-4 fade-in-0 duration-300 w-full max-w-md">
      <div className="bg-gradient-to-r from-red-500 to-rose-600 rounded-2xl shadow-2xl p-6 border-2 border-red-300">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center animate-pulse">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-white mb-2">
              {title}
            </h3>
            {message && (
              <p className="text-white/90 text-base leading-relaxed">
                {message}
              </p>
            )}
          </div>
          <button
            onClick={() => toast.dismiss(t)}
            className="text-white/80 hover:text-white transition-colors"
          >
            <XCircle className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  ), {
    duration: options.duration || 6000,
    position: options.position || 'top-center',
    ...options
  });
};

export const showWarningNotification = (title, message, options = {}) => {
  return toast.custom((t) => (
    <div className="animate-in slide-in-from-top-4 fade-in-0 duration-300 w-full max-w-md">
      <div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-2xl shadow-2xl p-6 border-2 border-orange-300">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center animate-bounce">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-white mb-2">
              {title}
            </h3>
            {message && (
              <p className="text-white/90 text-base leading-relaxed">
                {message}
              </p>
            )}
          </div>
          <button
            onClick={() => toast.dismiss(t)}
            className="text-white/80 hover:text-white transition-colors"
          >
            <XCircle className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  ), {
    duration: options.duration || 5000,
    position: options.position || 'top-center',
    ...options
  });
};

export const showInfoNotification = (title, message, options = {}) => {
  return toast.custom((t) => (
    <div className="animate-in slide-in-from-top-4 fade-in-0 duration-300 w-full max-w-md">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl shadow-2xl p-6 border-2 border-blue-300">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center">
              <Info className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-white mb-2">
              {title}
            </h3>
            {message && (
              <p className="text-white/90 text-base leading-relaxed">
                {message}
              </p>
            )}
          </div>
          <button
            onClick={() => toast.dismiss(t)}
            className="text-white/80 hover:text-white transition-colors"
          >
            <XCircle className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  ), {
    duration: options.duration || 5000,
    position: options.position || 'top-center',
    ...options
  });
};

export const showLoadingNotification = (title, message, options = {}) => {
  return toast.custom((t) => (
    <div className="animate-in slide-in-from-top-4 fade-in-0 duration-300 w-full max-w-md">
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl shadow-2xl p-6 border-2 border-purple-300">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-white mb-2">
              {title}
            </h3>
            {message && (
              <p className="text-white/90 text-base leading-relaxed">
                {message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  ), {
    duration: options.duration || Infinity,
    position: options.position || 'top-center',
    ...options
  });
};

// Celebration notification for major achievements
export const showCelebrationNotification = (title, message, options = {}) => {
  return toast.custom((t) => (
    <div className="animate-in zoom-in-50 fade-in-0 duration-500 w-full max-w-md">
      <div className="bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-600 rounded-2xl shadow-2xl p-6 border-4 border-yellow-300">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center animate-bounce">
              <span className="text-4xl">🎉</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-2xl font-bold text-white mb-2 animate-pulse">
              {title}
            </h3>
            {message && (
              <p className="text-white/95 text-base leading-relaxed font-medium">
                {message}
              </p>
            )}
          </div>
          <button
            onClick={() => toast.dismiss(t)}
            className="text-white/80 hover:text-white transition-colors"
          >
            <XCircle className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  ), {
    duration: options.duration || 7000,
    position: options.position || 'top-center',
    ...options
  });
};

// Shorthand exports for common use cases
export const notifications = {
  success: showSuccessNotification,
  error: showErrorNotification,
  warning: showWarningNotification,
  info: showInfoNotification,
  loading: showLoadingNotification,
  celebrate: showCelebrationNotification
};

export default notifications;
