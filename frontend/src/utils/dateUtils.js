/**
 * Date utility functions for IST (Indian Standard Time) conversion
 * 
 * All dates in database are stored in UTC.
 * These functions convert UTC to IST for display.
 */

/**
 * Convert UTC date to IST and format for display
 * @param {string|Date} dateStr - UTC date string or Date object
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string in IST
 */
export const formatToIST = (dateStr, options = {}) => {
  if (!dateStr) return '-';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    
    // IST is UTC+5:30
    const istOptions = {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      ...options
    };
    
    return date.toLocaleString('en-IN', istOptions);
  } catch (e) {
    console.error('Date formatting error:', e);
    return '-';
  }
};

/**
 * Format date only (no time) in IST
 * @param {string|Date} dateStr - UTC date string or Date object
 * @returns {string} Formatted date string (e.g., "12 Mar 2026")
 */
export const formatDateIST = (dateStr) => {
  if (!dateStr) return '-';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return '-';
  }
};

/**
 * Format time only in IST
 * @param {string|Date} dateStr - UTC date string or Date object
 * @returns {string} Formatted time string (e.g., "11:30 PM")
 */
export const formatTimeIST = (dateStr) => {
  if (!dateStr) return '-';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return '-';
  }
};

/**
 * Format date and time in IST (compact)
 * @param {string|Date} dateStr - UTC date string or Date object
 * @returns {string} Formatted datetime (e.g., "12 Mar, 11:30 PM")
 */
export const formatDateTimeIST = (dateStr) => {
  if (!dateStr) return '-';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return '-';
  }
};

/**
 * Format full date and time in IST
 * @param {string|Date} dateStr - UTC date string or Date object
 * @returns {string} Full formatted datetime (e.g., "12 Mar 2026, 11:30 PM IST")
 */
export const formatFullDateTimeIST = (dateStr) => {
  if (!dateStr) return '-';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    
    const formatted = date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    return `${formatted} IST`;
  } catch (e) {
    return '-';
  }
};

/**
 * Get relative time (e.g., "2 hours ago", "3 days ago")
 * @param {string|Date} dateStr - UTC date string or Date object
 * @returns {string} Relative time string
 */
export const getRelativeTime = (dateStr) => {
  if (!dateStr) return '-';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return formatDateIST(dateStr);
  } catch (e) {
    return '-';
  }
};

export default {
  formatToIST,
  formatDateIST,
  formatTimeIST,
  formatDateTimeIST,
  formatFullDateTimeIST,
  getRelativeTime
};
