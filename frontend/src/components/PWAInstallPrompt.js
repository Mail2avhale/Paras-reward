import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, X, Smartphone, Check } from 'lucide-react';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for the install prompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Show prompt after 3 seconds delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app was installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
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
    }
    
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for 7 days
    localStorage.setItem('pwaPromptDismissed', Date.now().toString());
  };

  // Check if dismissed recently
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
              >
                <Download className="mr-2 h-4 w-4" />
                Install App
              </Button>
              <Button 
                onClick={handleDismiss}
                variant="ghost"
                className="text-white hover:bg-white/20"
                size="sm"
              >
                Maybe Later
              </Button>
            </div>
          </div>
          
          <button 
            onClick={handleDismiss}
            className="text-white/80 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </Card>
    </div>
  );
};

// Install Button Component (for homepage)
export const InstallAppButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // APK download URL - can be configured via environment variable
  const APK_URL = process.env.REACT_APP_APK_URL || '/paras-reward.apk';

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleDownloadAPK = () => {
    // Show informative message instead of downloading placeholder
    alert('📱 Install PARAS REWARD App\n\n' + 
          '✅ For the best experience, install our Progressive Web App:\n\n' +
          '1. Tap the menu (⋮) in your browser\n' +
          '2. Select "Add to Home screen" or "Install app"\n' +
          '3. Enjoy the full app experience!\n\n' +
          'Native Android APK coming soon! 🚀');
  };

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
    >
      <Download className="mr-2 h-5 w-5" />
      {isDownloading ? 'Downloading...' : 'Download Android App'}
    </Button>
  );
};

export default PWAInstallPrompt;
