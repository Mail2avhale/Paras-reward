// Enhanced Service Worker for PARAS REWARD TWA/PWA
// Update version to force cache refresh after TWA update
// v38: June 9, 2026 — AdminInactiveCleanup page now has a new "Custom Purge
// by Registration Window" card. Owner can purge users registered in any
// arbitrary date range who are NOT actively subscribed, NOT mining, and
// have NOT logged in for N days. Pending bank-redeems for these users
// are deleted alongside. KYC-verified users always protected (RBI).
// v44: June 9, 2026 — P0 INCIDENT: Active users were wrongly deleted by
// the previous cleanup runs. Root cause: Rule 2 used `$or` between
// last_login_at + last_activity_at (so active users with stale activity
// field matched) + no active-subscription / active-mining / PRC-balance
// guards. Fixes:
// 1. Execute + Custom-Execute endpoints now return HTTP 423 (LOCKED).
// 2. New /restore-deleted/{preview,execute} endpoints — read snapshots
//    from deleted_users_audit and re-insert users into `users`.
//    Filterable by recency, min PRC balance, had-subscription, had-KYC.
// 3. AdminInactiveCleanup page now shows green "Emergency Restore" card
//    at the top + locked notice on Execute.
// 4. base_protection hardened: case-insensitive KYC verified, active mining
//    excluded, active elite subscription excluded, prc_balance >= 100
//    excluded. Rule 2 now requires BOTH login + activity to be stale.
// 5. Protection scan restored to ALL candidates (was capped at 500 in v41).
// v45: June 9, 2026 — Restore returned 0 users even though Preview found
// 1456. Root cause: insert_one() silently failed on production users
// because production has multiple snapshots with null email/mobile and
// the `users` collection has unique indexes on those fields. Switched to
// `update_one(upsert=True)` filtered by uid + strip null unique-indexed
// fields before insert. Errors now surfaced in toast + browser console.
const CACHE_NAME = 'paras-reward-v45';
const RUNTIME_CACHE = 'paras-runtime-v45';
const API_CACHE = 'paras-api-v45';

// Static assets to cache (including new icons)
const urlsToCache = [
  '/',
  '/dashboard',
  '/daily-rewards',
  '/game',
  '/marketplace',
  '/wallet',
  '/orders',
  '/profile',
  '/icons/icon-48x48.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-icon-192x192.png',
  '/icons/maskable-icon-512x512.png',
  '/paras-logo.jpg',
  '/manifest.json',
  '/offline.html'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME, RUNTIME_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests (Network First with timeout, then Cache)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      // Add 15 second timeout for mobile networks
      Promise.race([
        fetch(request),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 15000)
        )
      ])
        .then((response) => {
          // Clone the response
          const responseClone = response.clone();
          
          // Cache GET requests only (but NOT admin APIs to prevent stale data)
          if (request.method === 'GET' && !url.pathname.includes('/admin/')) {
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          
          return response;
        })
        .catch((error) => {
          console.log('Service Worker: Network failed or timeout', error.message);
          
          // If network fails, try cache (but skip for admin APIs)
          if (url.pathname.includes('/admin/')) {
            return new Response(JSON.stringify({ 
              error: 'Network error', 
              message: 'Please check your internet connection and refresh' 
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // If not in cache and it's a write operation, queue it
            if (request.method !== 'GET') {
              return queueOfflineRequest(request);
            }
            
            // Return offline page for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
            
            return new Response(JSON.stringify({ error: 'Offline' }), { 
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // Handle static assets (Cache First, then Network)
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });

          return response;
        }).catch(() => {
          // Return offline page for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Queue offline requests
async function queueOfflineRequest(request) {
  const clonedRequest = request.clone();
  const body = await clonedRequest.text();
  
  const queueItem = {
    url: request.url,
    method: request.method,
    headers: Array.from(request.headers.entries()),
    body: body,
    timestamp: Date.now()
  };

  // Store in IndexedDB
  const db = await openDB();
  const tx = db.transaction('offline-queue', 'readwrite');
  const store = tx.objectStore('offline-queue');
  await store.add(queueItem);

  return new Response(JSON.stringify({ 
    message: 'Request queued for when online',
    queued: true 
  }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('paras-offline-db', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores
      if (!db.objectStoreNames.contains('offline-queue')) {
        const queueStore = db.createObjectStore('offline-queue', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        queueStore.createIndex('timestamp', 'timestamp');
      }
      
      if (!db.objectStoreNames.contains('cached-data')) {
        db.createObjectStore('cached-data', { keyPath: 'key' });
      }
    };
  });
}

// Sync queued requests when online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  const db = await openDB();
  const tx = db.transaction('offline-queue', 'readonly');
  const store = tx.objectStore('offline-queue');
  const queuedRequests = await store.getAll();

  console.log('Service Worker: Syncing', queuedRequests.length, 'offline requests');

  for (const item of queuedRequests) {
    try {
      const headers = new Headers(item.headers);
      const response = await fetch(item.url, {
        method: item.method,
        headers: headers,
        body: item.body
      });

      if (response.ok) {
        // Remove from queue
        const deleteTx = db.transaction('offline-queue', 'readwrite');
        const deleteStore = deleteTx.objectStore('offline-queue');
        await deleteStore.delete(item.id);
        
        console.log('Service Worker: Synced request', item.url);
        
        // Notify clients
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SYNC_SUCCESS',
              url: item.url
            });
          });
        });
      }
    } catch (error) {
      console.error('Service Worker: Failed to sync request', item.url, error);
    }
  }
}

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_DATA') {
    cacheData(event.data.key, event.data.value);
  }
  
  if (event.data.type === 'GET_CACHED_DATA') {
    getCachedData(event.data.key).then(data => {
      event.ports[0].postMessage(data);
    });
  }
});

// Cache data in IndexedDB
async function cacheData(key, value) {
  const db = await openDB();
  const tx = db.transaction('cached-data', 'readwrite');
  const store = tx.objectStore('cached-data');
  await store.put({ key, value, timestamp: Date.now() });
}

// Get cached data from IndexedDB
async function getCachedData(key) {
  const db = await openDB();
  const tx = db.transaction('cached-data', 'readonly');
  const store = tx.objectStore('cached-data');
  const result = await store.get(key);
  return result ? result.value : null;
}

// Background Sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncOfflineQueue());
  }
});

console.log('Service Worker: Enhanced PWA loaded');
