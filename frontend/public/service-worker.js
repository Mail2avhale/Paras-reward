/* eslint-disable no-restricted-globals */
/**
 * service-worker.js — KILL SWITCH (Feb 2026)
 * ──────────────────────────────────────────────────────────────────
 * The previous Service Worker (v93 and earlier) cached index.html in
 * "cache-first" mode. After each deploy, users were stuck on the
 * cached old HTML which referenced JS chunks that no longer existed
 * on the server, leading to "Loading…" forever until they manually
 * cleared browsing data.
 *
 * Several layered fixes (network-first HTML, post-message broadcast,
 * inline self-heal script in index.html) only protected users who
 * had ALREADY downloaded the new SW. Users still on the old SW kept
 * hitting the stale cache.
 *
 * This file is the nuclear option:
 *   - On install, immediately skipWaiting() so we take over fast.
 *   - On activate, DELETE every cache key and UNREGISTER ourselves.
 *   - Then navigate every open client to a cache-busted URL so the
 *     browser fetches fresh HTML/JS straight from the origin.
 *
 * After one deploy, every user's old SW will auto-update to this file,
 * which then removes itself. From that point onwards there is NO
 * service worker on the device. The site behaves like a vanilla
 * single-page app — browser cache + Cloudflare CDN handle the rest.
 *
 * If we ever want PWA / offline support back, we can ship a fresh,
 * properly-designed SW in a future deploy — by which time every user
 * is on the no-SW baseline.
 */

self.addEventListener('install', (event) => {
  // Skip the waiting phase so we activate immediately.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 1. Nuke every cache the previous SW left behind.
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {
      // ignore — best-effort cleanup
    }

    // 2. Take control of every open tab.
    try { await self.clients.claim(); } catch (e) { /* ignore */ }

    // 3. Unregister ourselves so the browser never asks us again.
    try { await self.registration.unregister(); } catch (e) { /* ignore */ }

    // 4. Force every open tab to reload from the network. We append
    //    a cache-busting query so even an aggressive HTTP cache is
    //    bypassed for the navigation.
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => {
        try {
          const url = new URL(client.url);
          url.searchParams.set('_swkill', Date.now().toString(36));
          client.navigate(url.toString());
        } catch (e) {
          try { client.navigate(client.url); } catch (_) { /* ignore */ }
        }
      });
    } catch (e) {
      // ignore — clients may not be controllable in all browsers
    }
  })());
});

// While this kill-switch SW is briefly active, pass every fetch straight
// through to the network — never serve from cache.
self.addEventListener('fetch', (event) => {
  // Default behaviour: do not call respondWith() so the browser handles
  // the request as if no SW were installed. This is the safest thing
  // we can do while uninstalling.
});

// Accept legacy SKIP_WAITING messages so older client code paths still
// trigger a quick takeover.
self.addEventListener('message', (event) => {
  if (event && event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
