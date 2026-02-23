import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, X, Smartphone, Check } from 'lucide-react';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Comprehensive check for installed state
    const checkIfInstalled = () => {
      // Check 1: display-mode standalone (most common)
      if (window.matchMedia('(display-mode: standalone)').matches) {
        return true;
      }
      // Check 2: display-mode fullscreen (some PWAs use this)
      if (window.matchMedia('(display-mode: fullscreen)').matches) {
        return true;
      }
      // Check 3: display-mode minimal-ui
      if (window.matchMedia('(display-mode: minimal-ui)').matches) {
        return true;
      }
      // Check 4: iOS standalone (Safari)
      if (window.navigator.standalone === true) {
        return true;
      }
      // Check 5: Android TWA (Trusted Web Activity)
      if (document.referrer.includes('android-app://')) {
        return true;
      }
      // Check 6: Check if launched from home screen (Android)
      if (window.matchMedia('(display-mode: window-controls-overlay)').matches) {
        return true;
      }
      // Check 7: Check localStorage flag (set after installation)
      if (localStorage.getItem('pwa_installed') === 'true') {
        return true;
      }
      // Check 8: Check if running in secure context with service worker
      if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
        // Additional check - if URL contains ?source=pwa or similar
        if (window.location.search.includes('source=pwa') || 
            window.location.search.includes('utm_source=homescreen')) {
          return true;
        }
      }
      return false;
    };

    // Initial check
    if (checkIfInstalled()) {
      setIsInstalled(true);
      localStorage.setItem('pwa_installed', 'true');
      return;
    }

    // Listen for display mode changes (in case user installs while on site)
    const displayModeQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e) => {
      if (e.matches) {
        setIsInstalled(true);
        setShowPrompt(false);
        localStorage.setItem('pwa_installed', 'true');
      }
    };
    
    // Use addEventListener for modern browsers
    if (displayModeQuery.addEventListener) {
      displayModeQuery.addEventListener('change', handleDisplayModeChange);
    } else if (displayModeQuery.addListener) {
      // Fallback for older browsers
      displayModeQuery.addListener(handleDisplayModeChange);
    }

    // Check if user dismissed recently (within 7 days)
    const dismissedAt = localStorage.getItem('pwa_prompt_dismissed');
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return; // Don't show prompt
      }
    }

    // Listen for the install prompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Show prompt after 3 seconds delay, but recheck installation status
      setTimeout(() => {
        if (!checkIfInstalled()) {
          setShowPrompt(true);
        }
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app was installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      localStorage.setItem('pwa_installed', 'true');
    };
    
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (displayModeQuery.removeEventListener) {
        displayModeQuery.removeEventListener('change', handleDisplayModeChange);
      } else if (displayModeQuery.removeListener) {
        displayModeQuery.removeListener(handleDisplayModeChange);
      }
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setShowPrompt(false);
      localStorage.setItem('pwa_installed', 'true');
    }
    
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for 7 days
    localStorage.setItem('pwa_prompt_dismissed', Date.now().toString());
    localStorage.setItem('pwaPromptDismissed', Date.now().toString());
  };

  // Additional check on mount for dismissed state
  useEffect(() => {
    const dismissed = localStorage.getItem('pwaPromptDismissed');
    if (dismissed) {
      const dismissedDate = parseInt(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        setShowPrompt(false);
      }
    }
  }, []);

  // Don't show if installed or prompt should be hidden
  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-md animate-slide-up">
      <Card className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 shadow-2xl border-0">
        <div className="flex items-start gap-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <Smartphone className="h-6 w-6" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">Install PARAS REWARD App</h3>
            <p className="text-sm text-white/90 mb-3">
              Get instant access, offline support, and faster loading! Works like a native app.
            </p>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleInstallClick}
                className="bg-white text-purple-600 hover:bg-white/90 font-semibold"
                size="sm"
                data-testid="pwa-install-btn"
              >
                <Download className="mr-2 h-4 w-4" />
                Install App
              </Button>
              <Button 
                onClick={handleDismiss}
                variant="ghost"
                className="text-white hover:bg-white/20"
                size="sm"
                data-testid="pwa-dismiss-btn"
              >
                Maybe Later
              </Button>
            </div>
          </div>
          
          <button 
            onClick={handleDismiss}
            className="text-white/80 hover:text-white"
            data-testid="pwa-close-btn"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </Card>
    </div>
  );
};
};

// Install Button Component (for homepage)
export const InstallAppButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    // Comprehensive check for installed state
    const checkIfInstalled = () => {
      // Check display modes
      if (window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
      if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
      // iOS standalone
      if (window.navigator.standalone === true) return true;
      // Android TWA
      if (document.referrer.includes('android-app://')) return true;
      // localStorage flag
      if (localStorage.getItem('pwa_installed') === 'true') return true;
      return false;
    };

    if (checkIfInstalled()) {
      setIsInstalled(true);
      return;
    }

    // Listen for display mode changes
    const displayModeQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e) => {
      if (e.matches) {
        setIsInstalled(true);
        localStorage.setItem('pwa_installed', 'true');
      }
    };
    
    if (displayModeQuery.addEventListener) {
      displayModeQuery.addEventListener('change', handleDisplayModeChange);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    const handleAppInstalled = () => {
      setIsInstalled(true);
      localStorage.setItem('pwa_installed', 'true');
    };
    
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (displayModeQuery.removeEventListener) {
        displayModeQuery.removeEventListener('change', handleDisplayModeChange);
      }
    };
  }, []);

  const handleInstallClick = async () => {
    // Check if user is on Android
    const isAndroid = /Android/i.test(navigator.userAgent);
    
    if (isAndroid && !deferredPrompt) {
      // Show installation instructions for Android users
      alert('📱 Install PARAS REWARD App\n\n' + 
            'To install this app on your device:\n\n' +
            '1. Open this page in Chrome or Samsung Internet browser\n' +
            '2. Tap the menu (⋮) button\n' +
            '3. Select "Add to Home screen" or "Install app"\n' +
            '4. Follow the on-screen instructions\n\n' +
            'The app will be added to your home screen like a native app! 🚀');
      return;
    }
    
    // Try PWA installation if prompt is available
    if (!deferredPrompt) {
      alert('📱 Install PARAS REWARD App\n\n' +
            'To install this app:\n\n' +
            '1. Tap the menu (⋮) in your browser\n' +
            '2. Select "Add to Home screen" or "Install app"\n' +
            '3. Enjoy the full app experience!\n\n' +
            'Note: Make sure you\'re using a compatible browser (Chrome, Edge, or Samsung Internet).');
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setIsInstalled(true);
      localStorage.setItem('pwa_installed', 'true');
      alert('✅ Installation started! The app will be added to your home screen.');
    }
    
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <Button 
        disabled
        size="lg" 
        className="bg-gradient-to-r from-green-600 to-green-700 text-white px-10 py-7 text-lg rounded-2xl shadow-xl"
        data-testid="pwa-installed-btn"
      >
        <Check className="mr-2 h-5 w-5" />
        App Installed
      </Button>
    );
  }

  return (
    <Button 
      onClick={handleInstallClick}
      disabled={isDownloading}
      size="lg" 
      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-10 py-7 text-lg rounded-2xl shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105 border-0"
      data-testid="pwa-install-home-btn"
    >
      <Download className="mr-2 h-5 w-5" />
      {isDownloading ? 'Installing...' : 'Install App'}
    </Button>
  );
};

export default PWAInstallPrompt;
