import React from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import "@/index.css";
import App from "@/App";
import './i18n/config'; // Initialize i18n

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>,
);

// Clear old service worker caches on version mismatch
// v8: Fix app stuck issue - timeout protection - March 2026
const CURRENT_CACHE_VERSION = 'v8';

async function clearOldCaches() {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    const oldCaches = cacheNames.filter(name => !name.includes(CURRENT_CACHE_VERSION));
    await Promise.all(oldCaches.map(name => {
      console.log('Clearing old cache:', name);
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
    console.log('Force cleared all service workers and caches');
  }
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Clear old caches first
    clearOldCaches();
    
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('SW registered:', window.location.href);
        
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
              console.log('New service worker available');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
              
              // Only show update prompt once per session
              const lastPromptTime = sessionStorage.getItem('sw_update_prompt_time');
              const now = Date.now();
              
              // Only show prompt if not shown in this session (or more than 1 hour ago)
              if (!lastPromptTime || (now - parseInt(lastPromptTime)) > 3600000) {
                sessionStorage.setItem('sw_update_prompt_time', now.toString());
                
                // Show non-blocking notification instead of confirm
                console.log('New version available - will update on next reload');
              }
            }
          });
        });
        
        // Listen for controlling service worker changes
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('Service worker controller changed');
        });
        
        // Check for updates every 5 minutes (for mobile users who keep app open)
        setInterval(() => {
          registration.update();
        }, 5 * 60 * 1000);
      })
      .catch((registrationError) => {
        console.log('SW registration failed:', registrationError);
      });
  });
}
