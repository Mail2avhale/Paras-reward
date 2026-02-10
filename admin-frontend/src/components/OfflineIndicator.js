import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, Wifi, CheckCircle, X } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true); // Default to online
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const checkIntervalRef = useRef(null);
  const lastOnlineCheckRef = useRef(Date.now());

  // Actually verify connectivity by making a real API call
  const verifyConnectivity = useCallback(async () => {
    try {
      // Try to fetch a lightweight endpoint
      const response = await axios.get(`${API}/api/health`, { 
        timeout: 5000,
        // Don't use cache for this check
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (response.status === 200) {
        setIsOnline(true);
        setShowOfflineBanner(false);
        lastOnlineCheckRef.current = Date.now();
        return true;
      }
    } catch (error) {
      // Only show offline if we've been failing for more than 10 seconds
      // This prevents false positives from temporary network hiccups
      const timeSinceLastOnline = Date.now() - lastOnlineCheckRef.current;
      if (timeSinceLastOnline > 10000) {
        setIsOnline(false);
        if (!dismissed) {
          setShowOfflineBanner(true);
        }
      }
      return false;
    }
    return true;
  }, [dismissed]);

  // Dismiss handler
  const handleDismiss = () => {
    setDismissed(true);
    setShowOfflineBanner(false);
  };

  useEffect(() => {
    // Initial check - assume online if page loaded successfully
    setIsOnline(true);
    setShowOfflineBanner(false);
    
    // Listen for browser online/offline events as hints, but verify with real check
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineBanner(false);
      setDismissed(false);
      lastOnlineCheckRef.current = Date.now();
      
      // Show sync success briefly
      setShowSyncSuccess(true);
      setTimeout(() => setShowSyncSuccess(false), 2000);
    };

    const handleOffline = () => {
      // Don't immediately show offline - verify first
      // The browser's offline event can be unreliable
      setTimeout(() => {
        verifyConnectivity();
      }, 2000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic connectivity check every 30 seconds (only if showing offline)
    checkIntervalRef.current = setInterval(() => {
      if (!isOnline || showOfflineBanner) {
        verifyConnectivity();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [isOnline, showOfflineBanner, verifyConnectivity]);

  // Don't show anything if online or dismissed
  if (!showOfflineBanner && !showSyncSuccess) {
    return null;
  }

  return (
    <>
      {/* Offline Banner - with dismiss button */}
      {showOfflineBanner && !dismissed && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-yellow-500 text-white px-4 py-3 shadow-lg">
          <div className="container mx-auto flex items-center justify-center gap-3">
            <WifiOff className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium text-sm">
              You're offline. Some features may not work.
            </span>
            <button 
              onClick={handleDismiss}
              className="ml-2 p-1 hover:bg-yellow-600 rounded flex-shrink-0"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sync Success Banner */}
      {showSyncSuccess && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-green-500 text-white px-4 py-3 shadow-lg animate-slide-down">
          <div className="container mx-auto flex items-center justify-center gap-3">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">
              Back online!
            </span>
          </div>
        </div>
      )}
    </>
  );
}

export default OfflineIndicator;
