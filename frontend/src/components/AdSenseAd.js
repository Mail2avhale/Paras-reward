import { useEffect } from 'react';

/**
 * Google AdSense Component
 * Displays responsive ads with automatic placement
 */
const AdSenseAd = ({ 
  adSlot, 
  adFormat = 'auto', 
  fullWidthResponsive = true,
  adLayout = '',
  adLayoutKey = '',
  style = {}
}) => {
  useEffect(() => {
    try {
      // Push ad to AdSense
      if (window.adsbygoogle && process.env.NODE_ENV === 'production') {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (error) {
      console.error('AdSense error:', error);
    }
  }, []);

  // AdSense Publisher ID
  const publisherId = 'ca-pub-3556805218952480';

  return (
    <div className="adsense-container my-4" style={{ minHeight: '100px', ...style }}>
      <ins
        className="adsbygoogle"
        style={{ 
          display: 'block',
          textAlign: 'center',
          ...style 
        }}
        data-ad-client={publisherId}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive.toString()}
        data-ad-layout={adLayout}
        data-ad-layout-key={adLayoutKey}
      />
    </div>
  );
};

export default AdSenseAd;

// Predefined ad slot components for easy use
export const DisplayAd = ({ adSlot = '1234567890' }) => (
  <AdSenseAd 
    adSlot={adSlot} 
    adFormat="rectangle" 
    style={{ minHeight: '250px' }}
  />
);

export const BannerAd = ({ adSlot = '1234567891' }) => (
  <AdSenseAd 
    adSlot={adSlot} 
    adFormat="horizontal" 
    style={{ minHeight: '90px' }}
  />
);

export const SidebarAd = ({ adSlot = '1234567892' }) => (
  <AdSenseAd 
    adSlot={adSlot} 
    adFormat="vertical" 
    style={{ minHeight: '600px' }}
  />
);

export const InFeedAd = ({ adSlot = '1234567893' }) => (
  <AdSenseAd 
    adSlot={adSlot} 
    adFormat="fluid"
    adLayout="in-article"
    adLayoutKey="-fb+5w+4e-db+86"
    style={{ minHeight: '150px' }}
  />
);

export const ResponsiveAd = ({ adSlot = '1234567894' }) => (
  <AdSenseAd 
    adSlot={adSlot} 
    adFormat="auto"
    fullWidthResponsive={true}
    style={{ minHeight: '200px' }}
  />
);
