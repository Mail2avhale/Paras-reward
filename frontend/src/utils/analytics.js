/**
 * Google Analytics 4 Integration
 * Tracks user behavior, page views, and events
 */

// Initialize Google Analytics
export const initGA = (measurementId) => {
  if (typeof window === 'undefined' || !measurementId) return;

  // Load gtag.js script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', measurementId, {
    send_page_view: false, // We'll send manually
  });

  console.log('Google Analytics initialized:', measurementId);
};

// Track page view
export const trackPageView = (path, title) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title,
    page_location: window.location.href,
  });

  console.log('Page view tracked:', path);
};

// Track custom event
export const trackEvent = (eventName, parameters = {}) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', eventName, parameters);

  console.log('Event tracked:', eventName, parameters);
};

// Track user login
export const trackLogin = (userId, method = 'email') => {
  trackEvent('login', {
    method: method,
    user_id: userId,
  });
};

// Track user registration
export const trackSignUp = (userId, method = 'email') => {
  trackEvent('sign_up', {
    method: method,
    user_id: userId,
  });
};

// Track purchase/order
export const trackPurchase = (transactionId, value, items = []) => {
  trackEvent('purchase', {
    transaction_id: transactionId,
    value: value,
    currency: 'INR',
    items: items,
  });
};

// Track add to cart
export const trackAddToCart = (itemId, itemName, price) => {
  trackEvent('add_to_cart', {
    items: [{
      item_id: itemId,
      item_name: itemName,
      price: price,
      currency: 'INR',
    }],
  });
};

// Track referral
export const trackReferral = (referrerId, referralCode) => {
  trackEvent('referral', {
    referrer_id: referrerId,
    referral_code: referralCode,
  });
};

// Track VIP membership purchase
export const trackVIPPurchase = (userId, price, duration) => {
  trackEvent('vip_purchase', {
    user_id: userId,
    value: price,
    currency: 'INR',
    membership_duration: duration,
  });
};

// Track game played
export const trackGamePlayed = (gameName, prcSpent, result) => {
  trackEvent('game_played', {
    game_name: gameName,
    prc_spent: prcSpent,
    result: result, // 'won' or 'lost'
  });
};

// Track withdrawal request
export const trackWithdrawal = (userId, amount, walletType) => {
  trackEvent('withdrawal_request', {
    user_id: userId,
    amount: amount,
    currency: 'INR',
    wallet_type: walletType,
  });
};

// Track search
export const trackSearch = (searchTerm, resultCount) => {
  trackEvent('search', {
    search_term: searchTerm,
    result_count: resultCount,
  });
};

// Track button click
export const trackButtonClick = (buttonName, location) => {
  trackEvent('button_click', {
    button_name: buttonName,
    location: location,
  });
};

// Track share action
export const trackShare = (contentType, contentId, method) => {
  trackEvent('share', {
    content_type: contentType,
    content_id: contentId,
    method: method, // 'whatsapp', 'facebook', 'twitter', etc.
  });
};

// Track form submission
export const trackFormSubmission = (formName, success) => {
  trackEvent('form_submission', {
    form_name: formName,
    success: success,
  });
};

// Track error
export const trackError = (errorMessage, errorLocation) => {
  trackEvent('error', {
    error_message: errorMessage,
    error_location: errorLocation,
    fatal: false,
  });
};

// Set user ID
export const setUserId = (userId) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('config', process.env.REACT_APP_GA_MEASUREMENT_ID, {
    user_id: userId,
  });
};

// Set user properties
export const setUserProperties = (properties) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('set', 'user_properties', properties);
};

// Track timing
export const trackTiming = (name, value, category = 'Performance') => {
  trackEvent('timing_complete', {
    name: name,
    value: value,
    event_category: category,
  });
};

// Track exception
export const trackException = (description, fatal = false) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', 'exception', {
    description: description,
    fatal: fatal,
  });
};

export default {
  initGA,
  trackPageView,
  trackEvent,
  trackLogin,
  trackSignUp,
  trackPurchase,
  trackAddToCart,
  trackReferral,
  trackVIPPurchase,
  trackGamePlayed,
  trackWithdrawal,
  trackSearch,
  trackButtonClick,
  trackShare,
  trackFormSubmission,
  trackError,
  setUserId,
  setUserProperties,
  trackTiming,
  trackException,
};
