/**
 * Paras Mall — Premium Reward Shopping (v2)
 * Full-screen overlay with z-index 9999 — sits ABOVE app Header + bottom nav.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ShoppingBag, ChevronLeft, ChevronRight, Sparkles, Package, Coins, Search, X, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import './ParasMall.css';
import ParasMallBookings from './ParasMallBookings';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const fmtInr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const fmtPrc = (n) => `${Number(n).toLocaleString('en-IN')} PRC`;

const ParasMall = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('discover');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Swipe-to-book confirm modal
  const [pendingBook, setPendingBook] = useState(null);
  const dragStartX = useRef(null);
  const dragStartY = useRef(null);

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

  // Filtered list driven by search query
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.trim().toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  // Reset active index when filter changes
  useEffect(() => { setActiveIndex(0); }, [searchQuery]);

  const swipe = useCallback((dir) => {
    setActiveIndex((i) => {
      if (dir === 'next') return Math.min(filtered.length - 1, i + 1);
      return Math.max(0, i - 1);
    });
  }, [filtered.length]);

  const onTouchStart = (e) => {
    dragStartX.current = e.touches[0].clientX;
    dragStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e) => {
    if (dragStartX.current == null || dragStartY.current == null) return;
    const dx = e.changedTouches[0].clientX - dragStartX.current;
    const dy = e.changedTouches[0].clientY - dragStartY.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Vertical swipe wins if it's clearly vertical and large enough.
    if (absDy > 80 && absDy > absDx * 1.4) {
      if (dy < 0) {
        // Swipe UP → confirm book intent for current product
        const cur = filtered[activeIndex];
        if (cur && !bookingInProgress) setPendingBook(cur);
      }
      // Swipe DOWN closes the pending confirm if any
      if (dy > 0 && pendingBook) setPendingBook(null);
    } else if (absDx > 50 && absDx > absDy * 1.2) {
      swipe(dx < 0 ? 'next' : 'prev');
    }
    dragStartX.current = null;
    dragStartY.current = null;
  };

  useEffect(() => {
    const handler = (e) => {
      if (tab !== 'discover') return;
      if (e.key === 'ArrowLeft') swipe('prev');
      if (e.key === 'ArrowRight') swipe('next');
      if (e.key === 'Escape' && searchOpen) setSearchOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tab, swipe, searchOpen]);

  const bookProduct = async (product) => {
    if (!user?.uid) { toast.error('Please log in to book'); return; }
    setBookingInProgress(true);
    try {
      const res = await axios.post(`${API}/mall/book/${product.product_id}`, { user_id: user.uid });
      if (res.data?.success) {
        toast.success(`Booked ${product.name}! Mining started.`);
        if (onBalanceUpdate && res.data.booking) {
          onBalanceUpdate((user.prc_balance || 0) - res.data.booking.upfront_prc);
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
          <p className="tracking-[0.32em] uppercase text-[11px] font-semibold">Loading Mall</p>
        </div>
      </div>
    );
  }

  const current = filtered[activeIndex];
  const visibleDotsStart = Math.max(0, activeIndex - 3);
  const visibleDots = filtered.slice(visibleDotsStart, activeIndex + 4);

  return (
    <div className="mall-root" data-testid="paras-mall-root">
      <div className="mall-bg" />

      {/* TOP CHROME — Back / Title / Search / Tabs */}
      <div className="mall-overlay-top">
        <button className="mall-back-btn" onClick={() => navigate('/dashboard')} data-testid="mall-back-btn">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="mall-title-block">
          <div className="mall-title-main">🛍 PARAS MALL</div>
          <div className="mall-title-sub">Smart Reward Shopping</div>
        </div>
        <button
          className={`mall-icon-btn ${searchOpen ? 'active' : ''}`}
          onClick={() => setSearchOpen((s) => !s)}
          data-testid="mall-search-toggle"
        >
          {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            className="mall-search-bar"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Search className="w-4 h-4 text-amber-300" />
            <input
              autoFocus
              type="text"
              placeholder="Search Smartphone, AC, Furniture…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="mall-search-input"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs — hide when search is open to avoid crowding */}
      {!searchOpen && (
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
      )}

      {tab === 'discover' && filtered.length > 0 && (
        <div className="mall-progress-dots">
          {visibleDots.map((_, i) => {
            const idx = visibleDotsStart + i;
            return <span key={idx} className={`mall-dot ${idx === activeIndex ? 'active' : ''}`} />;
          })}
        </div>
      )}

      <AnimatePresence mode="wait">
        {tab === 'discover' && (
          <motion.div
            key="discover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mall-hero"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {filtered.length === 0 ? (
              <div className="flex-1 grid place-items-center text-center px-6">
                <div>
                  <Package className="w-12 h-12 mx-auto mb-3 text-purple-400 opacity-60" />
                  <p className="text-white font-semibold mb-1">No products found</p>
                  <p className="text-xs text-zinc-400">Try a different search</p>
                </div>
              </div>
            ) : (
              <>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current?.product_id}
                    initial={{ opacity: 0, scale: 0.96, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: -10 }}
                    transition={{ duration: 0.26 }}
                    className="mall-image-wrap"
                  >
                    <div className="mall-image-frame">
                      {current?.image_url ? (
                        <img
                          src={current.image_url}
                          alt={current.name}
                          className="mall-image"
                          data-testid="mall-product-image"
                        />
                      ) : (
                        <div className="mall-image-fallback">
                          <Package className="w-20 h-20 text-purple-300" />
                        </div>
                      )}
                    </div>

                    {/* Side arrows */}
                    <button
                      onClick={() => swipe('prev')}
                      disabled={activeIndex === 0}
                      className="mall-nav-arrow left"
                      data-testid="mall-prev-btn"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => swipe('next')}
                      disabled={activeIndex >= filtered.length - 1}
                      className="mall-nav-arrow right"
                      data-testid="mall-next-btn"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </motion.div>
                </AnimatePresence>

                <div className="mall-card">
                  <div className="mall-category-strip">
                    <Sparkles className="w-3 h-3" />
                    {current?.category} · #{activeIndex + 1} of {filtered.length}
                  </div>
                  <h2 className="mall-product-name" data-testid="mall-product-name">
                    {current?.name}
                  </h2>

                  <div className="mall-price-row">
                    <div className="mall-price-tile">
                      <div className="mall-price-tile-label">MRP</div>
                      <div className="mall-price-tile-value">{fmtInr(current?.mrp_inr)}</div>
                    </div>
                    <div className="mall-price-tile upfront">
                      <div className="mall-price-tile-label">Upfront</div>
                      <div className="mall-price-tile-value">{fmtPrc(current?.upfront_prc)}</div>
                    </div>
                  </div>

                  <button
                    className="mall-book-btn"
                    onClick={() => bookProduct(current)}
                    disabled={bookingInProgress || !current}
                    data-testid="mall-book-btn"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    {bookingInProgress ? 'Booking…' : `Book Now · ${fmtPrc(current?.upfront_prc)}`}
                  </button>

                  <div className="mall-hint">
                    <span>← Swipe</span>
                    <span className="dot" />
                    <ChevronUp className="w-3 h-3 text-amber-300" /> Swipe Up to Book
                    <span className="dot" />
                    <span>Swipe →</span>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}

        {tab === 'bookings' && (
          <motion.div
            key="bookings"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            className="mall-hero overflow-y-auto"
            style={{ display: 'block' }}
          >
            <ParasMallBookings user={user} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swipe-Up Confirm Sheet */}
      <AnimatePresence>
        {pendingBook && (
          <motion.div
            className="mall-confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPendingBook(null)}
            data-testid="mall-confirm-backdrop"
          >
            <motion.div
              className="mall-confirm-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              data-testid="mall-confirm-sheet"
            >
              <div className="mall-confirm-handle" />
              <div className="mall-confirm-title">
                <Sparkles className="w-4 h-4 text-amber-300" /> Confirm Booking
              </div>
              <p className="mall-confirm-product">{pendingBook.name}</p>
              <div className="mall-confirm-prices">
                <div>
                  <p className="mall-confirm-label">MRP</p>
                  <p className="mall-confirm-value">{fmtInr(pendingBook.mrp_inr)}</p>
                </div>
                <div>
                  <p className="mall-confirm-label">Upfront (debited now)</p>
                  <p className="mall-confirm-value upfront">{fmtPrc(pendingBook.upfront_prc)}</p>
                </div>
              </div>
              <p className="mall-confirm-note">
                Daily mining at 4 PRC + downline boost will gradually fill the rest. Delivery at 100%.
              </p>
              <div className="mall-confirm-actions">
                <button
                  className="mall-confirm-cancel"
                  onClick={() => setPendingBook(null)}
                  disabled={bookingInProgress}
                  data-testid="mall-confirm-cancel"
                >
                  Cancel
                </button>
                <button
                  className="mall-confirm-go"
                  onClick={async () => {
                    const p = pendingBook;
                    setPendingBook(null);
                    await bookProduct(p);
                  }}
                  disabled={bookingInProgress}
                  data-testid="mall-confirm-go"
                >
                  <ShoppingBag className="w-4 h-4" /> {bookingInProgress ? 'Booking…' : 'Confirm Book'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ParasMall;
