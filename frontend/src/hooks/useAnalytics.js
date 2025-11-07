import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/utils/analytics';

/**
 * Hook to automatically track page views with Google Analytics
 * Usage: Add `useAnalytics()` to App.js or root component
 */
const useAnalytics = () => {
  const location = useLocation();

  useEffect(() => {
    // Track page view whenever route changes
    const path = location.pathname + location.search;
    const title = document.title;
    
    trackPageView(path, title);
  }, [location]);
};

export default useAnalytics;
