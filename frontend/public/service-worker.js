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
// v46: June 9, 2026 — Restore still returned 0 even with v45 upsert fix.
// Root cause: execute fetched only `max_users*2 = 500` snapshots in audit
// insertion order. If first 500 were already-restored, `candidates` came
// out to 0. Fixed: fetch up to 5000 snapshots sorted by `deleted_at DESC`,
// THEN filter out already-restored UIDs. Also expose `fetched_snapshots`,
// `already_restored_in_batch`, `candidates_available` in response so admin
// can diagnose. Per-chunk toast now shows `(N candidates)` count.
// v47: June 9, 2026 — Execute re-enabled with hardened protections after
// successful 1,456-user recovery. New PRC balance guard raised 100 → 5000
// (was protecting ₹100+ earners, now protects ₹5,000+). Rule 2 stays AND
// (not OR). KYC/sub/mining guards unchanged. Custom Purge still locked.
// v48: June 9, 2026 — User hit HTTP 503 on production Execute (Kubernetes
// ingress proxy 60s cap). Backend cascade ops on un-indexed collections
// (transactions, prc_ledger) take too long for 300 users/call. Reduced:
// max_users default 300→100, BATCH 100→50, QUERY_TIMEOUT 60s→30s.
// Frontend per-call timeout 120s→90s. Button text updated to reflect chunks.
// v49: June 9, 2026 — NEW FEATURE: L1-L5 Level Breakdown on /referrals
// page. Backend: new /api/notifications/referrals/{uid}/level-breakdown
// walks the downline tree to depth 5, aggregates active/inactive counts +
// top performer + PRC sum per level + mining-boost contribution (+2% per
// active member, capped at 100%/level). Frontend: 5 color-coded cards
// (amber→blue→purple→emerald→rose) with active/inactive stats + top
// performer + total mining boost badge.
// v50: June 9, 2026 — FEATURE: Network Cap L1-L5 Cascade. Cap formula
// extended from min(6000, 800+16×D+5×L1) to min(8000, 800+16*L1+5*L2+3*L3+
// 2*L4+1*L5). Backend: calculate_network_cap() in growth_economy.py +
// mining.py + new BFS helper get_downline_level_counts(). API returns new
// cap_tier4/5/6_bonus + l3/l4/l5_count fields. Frontend: ReferralsEnhanced
// shows "Network Cap Formula" card with L1-L5 per-tier contributions.
// v51: June 9, 2026 — Referral CLEANUP. Deleted 13 orphan backend endpoints
// (/referrals/{uid}/tree, /referrals/network-tree/{uid}, /referrals/{uid}/stats,
// /referrals/{uid}/earnings, /referral-earnings/{uid}, /referrals/{uid}/levels,
// /referrals/{uid}/debug-referred-by, /referrals/{uid}/fraud-check,
// /referrals/{uid}/bonus-breakdown, /referrals/{uid}/network-analytics,
// /ai/referral-suggestions, /referrals/live-activity, /referrals/milestone-achievement,
// /gift/eligible-referrals/{parent_uid}). Also removed orphan helpers
// (get_multi_level_referrals, get_base_rate, count_active_referrals_by_level)
// and orphan frontend page NetworkTreeAdvanced.js. Single source of truth for
// referrals: /referrals/{uid}/direct-list + /referrals/{uid}/level-breakdown.
// v52: June 9, 2026 — PRC RATE CLEANUP. Dynamic-rate engine removed. Fixed
// 10 PRC = ₹1 across the entire app. Deleted backend: prc_economy.py,
// admin_prc_economy.py, all /prc-rate /admin/set-prc-rate /prc-economy/*
// endpoints, scheduler emergency-auto-pause job, set_referral_helpers no-op,
// register_rate_calculator. Deleted frontend: AdminPRCRateControl,
// AdminPRCEconomyDashboard, PRCRateDisplay component. utils/helpers.py
// get_prc_rate() now returns fixed 10. DB collections cleaned:
// app_settings.prc_rate_manual_override, system_settings.prc_dynamic_rate.
// v53: June 9, 2026 — Mining session no longer auto-starts after Collect Rewards.
// User must manually click Start Session, and there is a 60-second cooldown
// between Collect and the next Start (drives AdMob impression RPM by keeping
// user in app). Backend: /api/mining/collect now clears mining_active and sets
// next_session_available_at = now + 60s. /api/mining/start enforces the wait
// (returns 429 if too early). /api/mining/status returns start_cooldown_seconds.
// Frontend MiningWidget: shows "Start Session in Ns" countdown, disables button
// during cooldown, helper text "Take a quick break!".
// v54: June 9, 2026 — NEW FEATURE: 🛍 Paras Mall (Reward Shopping Destination).
// 43 AI-generated product images (Nano Banana), Netflix-style swipe UX,
// booking with PRC, single-leg booking-order mining tree (4 PRC/day per
// booking × downline boost), independent 24h sessions per booking with
// lapse-on-no-collect, admin product CRUD + mark-delivered flow, community
// auto-posts on booking/fulfillment/delivery. Bottom nav now has "Mall" tab.
// v57: June 9, 2026 — Paras Mall v3 advanced: full tagline restored,
// category filter chips (9 categories), live activity ticker (community
// feed marquee), PRC balance pill in header, My Bookings badge count,
// sort menu (default / price ↑↓), trending + social-proof badges.
const CACHE_NAME = 'paras-reward-v77';
const RUNTIME_CACHE = 'paras-runtime-v75';
const API_CACHE = 'paras-api-v75';

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
