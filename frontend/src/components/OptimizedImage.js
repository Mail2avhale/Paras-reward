import { useState, useEffect } from 'react';

/**
 * OptimizedImage Component
 * Implements lazy loading and better image loading performance
 */
const OptimizedImage = ({ 
  src, 
  alt = '', 
  className = '',
  fallback = '/placeholder.png',
  ...props 
}) => {
  const [imageSrc, setImageSrc] = useState(fallback);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!src) return;

    const img = new Image();
    img.src = src;
    
    img.onload = () => {
      setImageSrc(src);
      setImageError(false);
    };
    
    img.onerror = () => {
      setImageError(true);
      setImageSrc(fallback);
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, fallback]);

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      {...props}
    />
  );
};

export default OptimizedImage;
