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

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              console.log('New service worker available');
              
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
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
