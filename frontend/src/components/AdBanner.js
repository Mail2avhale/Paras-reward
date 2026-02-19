import React, { useEffect, useRef, useState } from 'react';

/**
 * AdMob Banner Component for PWA/TWA
 * 
 * This component displays Google AdMob banner ads in the app.
 * It uses Google AdSense for web-based ads that work in PWA/TWA.
 * 
 * For native Android TWA with AdMob, use the TWA builder settings.
 */
const AdBanner = ({ 
  adSlot,
  adFormat = 'auto',
  fullWidth = true,
  className = '',
  testMode = false
}) => {
  const adRef = useRef(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);

  useEffect(() => {
    // Check if running in TWA (Android app)
    const isTWA = document.referrer.includes('android-app://') || 
                  window.matchMedia('(display-mode: standalone)').matches;
    
    // Load AdSense script if not already loaded
    if (!window.adsbygoogle && !testMode) {
      const script = document.createElement('script');
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3833838421879550';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onerror = () => setAdError(true);
      document.head.appendChild(script);
    }

    // Push ad after script loads
    const timer = setTimeout(() => {
      try {
        if (window.adsbygoogle && adRef.current) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          setAdLoaded(true);
        }
      } catch (e) {
        console.log('Ad load error:', e);
        setAdError(true);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [testMode]);

  // Don't render if error or in development
  if (adError || process.env.NODE_ENV === 'development') {
    return null;
  }

  return (
    <div className={`ad-container ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ 
          display: 'block',
          width: fullWidth ? '100%' : 'auto',
          minHeight: '50px'
        }}
        data-ad-client="ca-pub-3833838421879550"
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidth ? 'true' : 'false'}
      />
    </div>
  );
};

/**
 * Sticky Bottom Banner - Shows at bottom of screen
 */
export const StickyBannerAd = ({ adSlot = '1234567890' }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Don't show if user dismissed or if viewing specific pages
  if (dismissed) return null;

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 safe-area-pb transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="relative">
        <button
          onClick={() => setDismissed(true)}
          className="absolute -top-6 right-2 bg-gray-800 text-gray-400 text-xs px-2 py-1 rounded-t-md"
        >
          Hide Ad
        </button>
        <AdBanner adSlot={adSlot} adFormat="horizontal" />
      </div>
    </div>
  );
};

/**
 * In-Feed Ad - Shows between content items
 */
export const InFeedAd = ({ adSlot = '1234567891', className = '' }) => {
  return (
    <div className={`my-4 rounded-lg overflow-hidden ${className}`}>
      <div className="text-xs text-gray-500 text-center mb-1">Ad</div>
      <AdBanner adSlot={adSlot} adFormat="fluid" />
    </div>
  );
};

/**
 * Interstitial Ad Placeholder
 * Note: For actual interstitial ads in TWA, use native AdMob SDK
 */
export const showInterstitialAd = async () => {
  // This is a placeholder - actual interstitial ads need native SDK
  console.log('Interstitial ad would show here in native app');
  return true;
};

/**
 * Rewarded Ad Placeholder
 * Note: For actual rewarded ads in TWA, use native AdMob SDK
 */
export const showRewardedAd = async (onReward) => {
  // This is a placeholder - actual rewarded ads need native SDK
  console.log('Rewarded ad would show here in native app');
  // Simulate reward for testing
  if (typeof onReward === 'function') {
    onReward({ type: 'coins', amount: 10 });
  }
  return true;
};

export default AdBanner;
