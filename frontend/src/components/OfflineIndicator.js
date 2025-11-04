import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, CheckCircle } from 'lucide-react';

function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [queuedActions, setQueuedActions] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger background sync
      if ('serviceWorker' in navigator && 'sync' in navigator.serviceWorker) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.sync.register('sync-offline-queue');
        });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    // Listen for service worker messages
    const handleMessage = (event) => {
      if (event.data.type === 'SYNC_SUCCESS') {
        setShowSyncSuccess(true);
        setTimeout(() => setShowSyncSuccess(false), 3000);
        checkQueuedActions();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
    }

    // Check queued actions on mount
    checkQueuedActions();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
    };
  }, []);

  const checkQueuedActions = async () => {
    try {
      const db = await openDB();
      const tx = db.transaction('offline-queue', 'readonly');
      const store = tx.objectStore('offline-queue');
      const count = await store.count();
      setQueuedActions(count);
    } catch (error) {
      console.error('Error checking queued actions:', error);
    }
  };

  const openDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('paras-offline-db', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  };

  // Don't show anything if online and no queued actions
  if (isOnline && queuedActions === 0 && !showSyncSuccess) {
    return null;
  }

  return (
    <>
      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-yellow-500 text-white px-4 py-3 shadow-lg">
          <div className="container mx-auto flex items-center justify-center gap-3">
            <WifiOff className="w-5 h-5" />
            <span className="font-medium">
              You're offline. {queuedActions > 0 && `${queuedActions} action${queuedActions > 1 ? 's' : ''} queued for sync.`}
            </span>
          </div>
        </div>
      )}

      {/* Sync Success Banner */}
      {showSyncSuccess && isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-green-500 text-white px-4 py-3 shadow-lg animate-slide-down">
          <div className="container mx-auto flex items-center justify-center gap-3">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">
              Back online! Syncing your queued actions...
            </span>
          </div>
        </div>
      )}

      {/* Queued Actions Indicator */}
      {isOnline && queuedActions > 0 && !showSyncSuccess && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-blue-500 text-white px-4 py-2 shadow-lg">
          <div className="container mx-auto flex items-center justify-center gap-3">
            <Wifi className="w-5 h-5 animate-pulse" />
            <span className="text-sm font-medium">
              Syncing {queuedActions} action{queuedActions > 1 ? 's' : ''}...
            </span>
          </div>
        </div>
      )}
    </>
  );
}

export default OfflineIndicator;
