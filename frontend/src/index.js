import React from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import "@/index.css";
import App from "@/App";
import './i18n/config'; // Initialize i18n

// ============================================================
// Global ChunkLoadError auto-recovery
// ------------------------------------------------------------
// After a fresh deploy, old clients may hold an index.html that
// references stale webpack chunk hashes (e.g. `vendors-...-abcd.chunk.js`).
// Those requests 404 back to index.html (HTML content) and the browser
// explodes with "Unexpected token '<'" / "Loading chunk ... failed".
//
// We detect this and force-reload the page ONCE (sentinel in
// sessionStorage so we never loop), which pulls the fresh index.html
// and the new chunk hashes.
// ============================================================
(function setupChunkErrorRecovery() {
  if (typeof window === 'undefined') return;

  const CHUNK_RELOAD_KEY = 'paras_chunk_reload_ts';
  const isChunkError = (msg) => {
    if (!msg) return false;
    const s = String(msg);
    return (
      s.includes('ChunkLoadError') ||
      s.includes('Loading chunk') ||
      s.includes("Unexpected token '<'") ||
      s.includes('Unexpected token <')
    );
  };

  const reloadOnce = async (reason) => {
    const last = parseInt(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0', 10);
    const now = Date.now();
    // Prevent infinite reload loop — only reload once per 20s window
    if (now - last < 20000) return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));

    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (_) { /* best effort */ }

    // CRITICAL FIX (Jun 2026): A plain window.location.reload() uses the
    // browser HTTP cache, which on stale-cache scenarios returns the SAME
    // poisoned index.html → same broken chunk hashes → infinite spinner.
    // We MUST navigate to a unique URL so the browser bypasses HTTP cache
    // and any intermediary (Cloudflare) cache, picking up the fresh HTML.
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('_cb', Date.now().toString(36));
      // Also nudge the fetcher to revalidate before navigating.
      try {
        await fetch(u.toString(), { cache: 'reload', credentials: 'same-origin' });
      } catch (_) { /* network failures are fine — replace() below still tries */ }
      window.location.replace(u.toString());
    } catch (_) {
      window.location.reload();
    }
  };

  window.addEventListener('error', (event) => {
    if (isChunkError(event && event.message)) reloadOnce();
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event && event.reason;
    const msg = reason && (reason.message || reason.toString && reason.toString());
    if (isChunkError(msg) || (reason && reason.name === 'ChunkLoadError')) {
      reloadOnce();
    }
  });
})();

// Silence console.log / console.debug / console.info in production
// (keeps console.warn and console.error for real issues)
if (process.env.NODE_ENV === 'production') {
  const noop = () => {};
  console.log = noop;
  console.debug = noop;
  console.info = noop;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>,
);

// Clear old service worker caches on version mismatch
// v9: May 5, 2026 — quick-recharge toggle fix; bump version to evict old bundles.
const CURRENT_CACHE_VERSION = 'v9';

async function clearOldCaches() {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    const oldCaches = cacheNames.filter(name => !name.includes(CURRENT_CACHE_VERSION));
    await Promise.all(oldCaches.map(name => {
      // console.log('Clearing old cache:', name);
      return caches.delete(name);
    }));
  }
}

// FORCE clear all caches for admin login fix
async function forceUpdateServiceWorker() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    // console.log('Force cleared all service workers and caches');
  }
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  // ── FORCE_REFRESH_MARKER_v10 REMOVED (Jun 2026) ──────────────────────
  // The previous "force reload once on fresh visit" block caused an
  // unnecessary extra page load right after a user cleared browsing
  // data. On slow mobile networks that second load looked like a
  // permanent spinner because the browser was racing the watchdog.
  // The chunk-error recovery + kill-switch SW handle stale caches
  // properly now, so this hack is no longer needed.

  window.addEventListener('load', () => {
    // Clear old caches first
    clearOldCaches();

    // ── SERVICE WORKER REGISTRATION DISABLED (Feb 2026) ────────────────
    // The stale-cache-after-deploy bug recurred for users on older SW
    // versions even after every fix. We now ship a kill-switch SW that
    // self-unregisters, and we stop registering a new one entirely.
    // To stop the kill-switch from being re-installed on every page load,
    // we skip the call to navigator.serviceWorker.register().
    //
    // The site continues to work as a normal SPA via browser HTTP cache
    // and Cloudflare CDN. If we ever want PWA/offline support back, ship
    // a fresh, properly-designed SW and re-enable registration.
    (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      } catch (e) { /* ignore */ }
    })();
    return;

    // eslint-disable-next-line no-unreachable
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        // console.log('SW registered:', window.location.href);
        
        // Force update check on mobile (TWA/PWA)
        if (registration.waiting) {
          // New service worker is waiting - activate it immediately
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available - activate it immediately for better UX
              // console.log('New service worker available');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
              
              // Only show update prompt once per session
              const lastPromptTime = sessionStorage.getItem('sw_update_prompt_time');
              const now = Date.now();
              
              // Only show prompt if not shown in this session (or more than 1 hour ago)
              if (!lastPromptTime || (now - parseInt(lastPromptTime)) > 3600000) {
                sessionStorage.setItem('sw_update_prompt_time', now.toString());
                
                // Show non-blocking notification instead of confirm
                // console.log('New version available - will update on next reload');
              }
            }
          });
        });
        
        // Listen for controlling service worker changes
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // console.log('Service worker controller changed');
        });

        // Auto-reload page when the freshly-activated SW broadcasts SW_UPDATED.
        // This is the fix for "stale cache after deploy" — users who already
        // have the site open get the new HTML + chunks without needing to
        // manually clear browsing data.
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event?.data?.type === 'SW_UPDATED') {
            // Throttle: only auto-reload once per 10 minutes to avoid loops
            const lastReload = parseInt(sessionStorage.getItem('sw_auto_reload_ts') || '0', 10);
            if (Date.now() - lastReload < 10 * 60 * 1000) return;
            sessionStorage.setItem('sw_auto_reload_ts', String(Date.now()));
            // Small delay so any pending requests settle, then hard reload
            setTimeout(() => window.location.reload(), 600);
          }
        });
        
        // Check for updates every 5 minutes (for mobile users who keep app open)
        setInterval(() => {
          registration.update();
        }, 5 * 60 * 1000);
      })
      .catch((registrationError) => {
        // console.log('SW registration failed:', registrationError);
      });
  });
}
