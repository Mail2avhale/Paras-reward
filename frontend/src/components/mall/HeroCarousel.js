/**
 * HeroCarousel — auto-rotating featured products banner.
 * Fetches /mall/v2/featured and renders an Amazon/Flipkart-style hero strip
 * the user can swipe through. Clicking a slide focuses that product
 * (via onSelectProduct callback) so the existing discover flow takes over.
 */
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { resolveAssetUrl } from '@/utils/resolveAssetUrl';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const ROTATE_MS = 4500;

export default function HeroCarousel({ onSelectProduct }) {
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);
  const dragX = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/mall/v2/featured?limit=6`);
        if (r.data?.products) setItems(r.data.products);
      } catch (e) { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  // Auto-rotate
  useEffect(() => {
    if (items.length <= 1) return;
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % items.length);
    }, ROTATE_MS);
    return () => clearInterval(timerRef.current);
  }, [items.length]);

  const restartTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setIdx((i) => (i + 1) % items.length);
      }, ROTATE_MS);
    }
  };

  const goTo = (i) => {
    setIdx((items.length + i) % Math.max(1, items.length));
    restartTimer();
  };

  if (loading) {
    return (
      <div className="mall-hero-carousel mall-hero-carousel-skel" data-testid="mall-hero-carousel-skel">
        <div className="mall-hero-shimmer" />
      </div>
    );
  }
  if (!items.length) return null;

  const current = items[idx];

  return (
    <div
      className="mall-hero-carousel"
      data-testid="mall-hero-carousel"
      onTouchStart={(e) => { dragX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (dragX.current == null) return;
        const dx = e.changedTouches[0].clientX - dragX.current;
        if (Math.abs(dx) > 40) {
          goTo(idx + (dx < 0 ? 1 : -1));
        }
        dragX.current = null;
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current.product_id}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.55 }}
          className="mall-hero-slide"
          onClick={() => onSelectProduct?.(current)}
          data-testid={`mall-hero-slide-${current.product_id}`}
        >
          {current.image_url ? (
            <img
              src={resolveAssetUrl(current.image_url)}
              alt={current.name}
              className="mall-hero-img"
              loading="lazy"
            />
          ) : (
            <div className="mall-hero-img mall-hero-img-fallback">
              <Sparkles className="w-10 h-10 text-amber-300" />
            </div>
          )}
          <div className="mall-hero-overlay">
            <div className="mall-hero-tag">
              <Zap className="w-3 h-3" /> Featured
            </div>
            <div className="mall-hero-title">{current.name}</div>
            <div className="mall-hero-cta">
              <span>Tap to Explore</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {items.length > 1 && (
        <>
          <button
            className="mall-hero-arrow left"
            onClick={(e) => { e.stopPropagation(); goTo(idx - 1); }}
            aria-label="Previous"
            data-testid="mall-hero-prev"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            className="mall-hero-arrow right"
            onClick={(e) => { e.stopPropagation(); goTo(idx + 1); }}
            aria-label="Next"
            data-testid="mall-hero-next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="mall-hero-dots">
            {items.map((_, i) => (
              <span
                key={i}
                className={`mall-hero-dot ${i === idx ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); goTo(i); }}
                data-testid={`mall-hero-dot-${i}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
