/**
 * Paras Mall — India's Smart Reward Shopping Destination
 * Netflix-style full-screen product swiper.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ShoppingBag, ChevronLeft, ChevronRight, Sparkles, Package, Coins, Clock } from 'lucide-react';
import { toast } from 'sonner';
import './ParasMall.css';
import ParasMallBookings from './ParasMallBookings';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const formatInr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const formatPrc = (n) => `${Number(n).toLocaleString('en-IN')} PRC`;

const ParasMall = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('discover');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const containerRef = useRef(null);
  const dragStartX = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/mall/products`);
        if (!cancelled && res.data?.products) setProducts(res.data.products);
      } catch (e) {
        toast.error('Failed to load Paras Mall products');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const swipe = useCallback((dir) => {
    setActiveIndex((i) => {
      if (dir === 'next') return Math.min(products.length - 1, i + 1);
      return Math.max(0, i - 1);
    });
  }, [products.length]);

  const onTouchStart = (e) => {
    dragStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (dragStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - dragStartX.current;
    if (Math.abs(dx) > 50) swipe(dx < 0 ? 'next' : 'prev');
    dragStartX.current = null;
  };
  // Keyboard navigation (desktop)
  useEffect(() => {
    const handler = (e) => {
      if (tab !== 'discover') return;
      if (e.key === 'ArrowLeft') swipe('prev');
      if (e.key === 'ArrowRight') swipe('next');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tab, swipe]);

  const bookProduct = async (product) => {
    if (!user?.uid) {
      toast.error('Please log in to book');
      return;
    }
    setBookingInProgress(true);
    try {
      const res = await axios.post(`${API}/mall/book/${product.product_id}`, { user_id: user.uid });
      if (res.data?.success) {
        toast.success(`Booked ${product.name}! Mining started.`);
        // Update balance via parent
        if (onBalanceUpdate && res.data.booking) {
          const debit = res.data.booking.upfront_prc;
          onBalanceUpdate((user.prc_balance || 0) - debit);
        }
        setTab('bookings');
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Booking failed');
    } finally {
      setBookingInProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="mall-loading" data-testid="mall-loading">
        <div className="flex flex-col items-center gap-3">
          <Sparkles className="w-8 h-8 animate-pulse" />
          <p className="tracking-[0.32em] uppercase text-[11px] text-amber-400 font-semibold">Loading Mall</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mall-root" ref={containerRef} data-testid="paras-mall-root">
      {/* Top overlay: back + title + tabs */}
      <div className="mall-overlay-top">
        <button className="mall-back-btn" onClick={() => navigate(-1)} data-testid="mall-back-btn">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="mall-page-title">🛍 Paras Mall</span>
        <div style={{ width: 40 }} />
      </div>

      <div className="mall-tagline-strip">India&apos;s Smart Reward Shopping Destination</div>

      <div className="mall-tabs">
        <button
          className={`mall-tab ${tab === 'discover' ? 'active' : ''}`}
          onClick={() => setTab('discover')}
          data-testid="mall-tab-discover"
        >
          Discover
        </button>
        <button
          className={`mall-tab ${tab === 'bookings' ? 'active' : ''}`}
          onClick={() => setTab('bookings')}
          data-testid="mall-tab-bookings"
        >
          My Bookings
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'discover' && (
          <motion.div
            key="discover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {products.length === 0 ? (
              <div className="absolute inset-0 grid place-items-center">
                <p className="text-zinc-500">No products available</p>
              </div>
            ) : (
              <>
                {/* Progress dots (show 7 around active) */}
                <div className="mall-progress-dots">
                  {products.slice(Math.max(0, activeIndex - 3), activeIndex + 4).map((_, i) => {
                    const idx = Math.max(0, activeIndex - 3) + i;
                    return <span key={idx} className={`mall-dot ${idx === activeIndex ? 'active' : ''}`} />;
                  })}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={products[activeIndex]?.product_id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.28 }}
                    className="mall-hero"
                  >
                    <div className="mall-image-wrap">
                      {products[activeIndex]?.image_url ? (
                        <img
                          src={products[activeIndex].image_url}
                          alt={products[activeIndex].name}
                          className="mall-image"
                          data-testid="mall-product-image"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="mall-image-fallback"><Package className="w-20 h-20 text-amber-300" /></div>
                      )}
                    </div>

                    <div className="mall-edge left" />
                    <div className="mall-edge right" />

                    {/* Side arrows (desktop) */}
                    <button
                      onClick={() => swipe('prev')}
                      className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/40 backdrop-blur items-center justify-center border border-white/10 disabled:opacity-30"
                      disabled={activeIndex === 0}
                      data-testid="mall-prev-btn"
                    >
                      <ChevronLeft className="w-6 h-6 text-amber-300" />
                    </button>
                    <button
                      onClick={() => swipe('next')}
                      className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/40 backdrop-blur items-center justify-center border border-white/10 disabled:opacity-30"
                      disabled={activeIndex >= products.length - 1}
                      data-testid="mall-next-btn"
                    >
                      <ChevronRight className="w-6 h-6 text-amber-300" />
                    </button>

                    <div className="mall-card">
                      <div className="mall-tagline">
                        {products[activeIndex]?.category} · #{activeIndex + 1} of {products.length}
                      </div>
                      <h2 className="mall-product-name" data-testid="mall-product-name">
                        {products[activeIndex]?.name}
                      </h2>

                      <div className="mall-price-row">
                        <div className="mall-price-tile">
                          <div className="mall-price-tile-label">MRP</div>
                          <div className="mall-price-tile-value">{formatInr(products[activeIndex]?.mrp_inr)}</div>
                        </div>
                        <div className="mall-price-tile upfront">
                          <div className="mall-price-tile-label">Upfront</div>
                          <div className="mall-price-tile-value">{formatPrc(products[activeIndex]?.upfront_prc)}</div>
                        </div>
                      </div>

                      <button
                        className="mall-book-btn"
                        onClick={() => bookProduct(products[activeIndex])}
                        disabled={bookingInProgress || !products[activeIndex]}
                        data-testid="mall-book-btn"
                      >
                        <ShoppingBag className="w-5 h-5" />
                        {bookingInProgress ? 'Booking...' : `Book Now · ${formatPrc(products[activeIndex]?.upfront_prc)}`}
                      </button>

                      <div className="mall-hint">
                        <span>← Swipe</span>
                        <span><Coins className="inline w-3 h-3 mr-1" />4 PRC/day base</span>
                        <span>Swipe →</span>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </>
            )}
          </motion.div>
        )}

        {tab === 'bookings' && (
          <motion.div
            key="bookings"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="absolute inset-0 top-[140px] overflow-y-auto"
          >
            <ParasMallBookings user={user} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ParasMall;
