/**
 * Smart Toast Manager - Prevents duplicate and excessive toasts
 * Replaces direct toast() calls to reduce notification spam
 */
import { toast } from 'sonner';

// Track recent toasts to prevent duplicates
const recentToasts = new Map();
const DUPLICATE_THRESHOLD = 3000; // 3 seconds - don't show same toast within this window
const MAX_TOASTS_PER_MINUTE = 5; // Maximum toasts allowed per minute
let toastCountThisMinute = 0;
let lastMinuteReset = Date.now();

// Reset counter every minute
const resetCounterIfNeeded = () => {
  const now = Date.now();
  if (now - lastMinuteReset > 60000) {
    toastCountThisMinute = 0;
    lastMinuteReset = now;
  }
};

// Generate a hash for the toast message
const getToastHash = (message, type) => {
  const str = `${type}:${typeof message === 'string' ? message : JSON.stringify(message)}`;
  return str.slice(0, 100); // Truncate for efficiency
};

// Check if toast should be shown
const shouldShowToast = (message, type) => {
  resetCounterIfNeeded();
  
  // Rate limit check
  if (toastCountThisMinute >= MAX_TOASTS_PER_MINUTE) {
    // console.log('[SmartToast] Rate limit reached, suppressing toast');
    return false;
  }
  
  // Duplicate check
  const hash = getToastHash(message, type);
  const lastShown = recentToasts.get(hash);
  const now = Date.now();
  
  if (lastShown && (now - lastShown) < DUPLICATE_THRESHOLD) {
    // console.log('[SmartToast] Duplicate toast suppressed:', message);
    return false;
  }
  
  // Update tracking
  recentToasts.set(hash, now);
  toastCountThisMinute++;
  
  // Cleanup old entries (keep map size manageable)
  if (recentToasts.size > 50) {
    const oldestAllowed = now - DUPLICATE_THRESHOLD;
    for (const [key, time] of recentToasts.entries()) {
      if (time < oldestAllowed) {
        recentToasts.delete(key);
      }
    }
  }
  
  return true;
};

// Smart toast wrapper functions
export const smartToast = {
  success: (message, options = {}) => {
    if (shouldShowToast(message, 'success')) {
      return toast.success(message, { duration: 2500, ...options });
    }
  },
  
  error: (message, options = {}) => {
    // Always show errors (but still prevent duplicates)
    if (shouldShowToast(message, 'error')) {
      return toast.error(message, { duration: 4000, ...options });
    }
  },
  
  info: (message, options = {}) => {
    if (shouldShowToast(message, 'info')) {
      return toast.info(message, { duration: 2500, ...options });
    }
  },
  
  warning: (message, options = {}) => {
    if (shouldShowToast(message, 'warning')) {
      return toast.warning(message, { duration: 3000, ...options });
    }
  },
  
  // For critical messages that should always show
  critical: (message, options = {}) => {
    toastCountThisMinute = Math.max(0, toastCountThisMinute - 1); // Don't count against limit
    return toast.error(message, { duration: 5000, ...options });
  },
  
  // Loading toast
  loading: (message, options = {}) => {
    return toast.loading(message, options);
  },
  
  // Dismiss toast
  dismiss: (toastId) => {
    return toast.dismiss(toastId);
  },
  
  // Promise toast
  promise: (promise, messages, options = {}) => {
    return toast.promise(promise, messages, options);
  }
};

// Export for direct import
export default smartToast;
