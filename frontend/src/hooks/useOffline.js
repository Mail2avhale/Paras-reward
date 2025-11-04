import { useState, useEffect } from 'react';
import offlineStorage from '@/utils/offlineStorage';

/**
 * Hook for offline-first data fetching
 * Fetches from cache first, then network, and syncs in background
 */
export function useOfflineData(fetchFunction, cacheKey, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFromCache, setIsFromCache] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Try to get cached data first
        const cachedData = await offlineStorage.getCachedWithExpiry(cacheKey);
        
        if (cachedData && isMounted) {
          setData(cachedData);
          setIsFromCache(true);
          setLoading(false);
        }

        // Then fetch from network
        if (navigator.onLine) {
          try {
            const freshData = await fetchFunction();
            
            if (isMounted) {
              setData(freshData);
              setIsFromCache(false);
              setError(null);
              
              // Cache the fresh data
              await offlineStorage.cacheWithExpiry(cacheKey, freshData, 60);
            }
          } catch (networkError) {
            // If network fails but we have cache, keep using it
            if (!cachedData) {
              setError(networkError.message);
            }
          }
        } else if (!cachedData) {
          // Offline and no cache
          setError('Offline and no cached data available');
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, dependencies);

  return { data, loading, error, isFromCache };
}

/**
 * Hook for queueing offline actions
 */
export function useOfflineAction() {
  const [isQueued, setIsQueued] = useState(false);

  const queueAction = async (actionType, actionData) => {
    try {
      if (!navigator.onLine) {
        await offlineStorage.queueAction({
          type: actionType,
          data: actionData,
        });
        setIsQueued(true);
        return { queued: true, message: 'Action queued for when online' };
      }
      
      return { queued: false };
    } catch (error) {
      console.error('Error queuing action:', error);
      throw error;
    }
  };

  return { queueAction, isQueued };
}

/**
 * Hook to check online status
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
