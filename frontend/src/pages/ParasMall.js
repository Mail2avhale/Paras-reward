/**
 * Paras Mall — Premium Reward Shopping (v3 — Advanced)
 * Full-screen overlay (z-index 9999) with category chips, live ticker,
 * balance pill, sort, and social proof.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import PullToRefresh from '@/components/PullToRefresh';
import {
  ArrowLeft, ShoppingBag, ChevronLeft, ChevronRight, Sparkles, Package,
  Coins, Search, X, ChevronUp, Flame, ArrowUpDown, TrendingUp, Users
} from 'lucide-react';
import { toast } from 'sonner';
import { hapticPrimary, hapticSuccess, hapticError } from '@/utils/nativeUx';
import './ParasMall.css';
import ParasMallBookings from './ParasMallBookings';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const fmtInr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const fmtPrc = (n) => `${Number(n).toLocaleString('en-IN')} PRC`;

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'electronics', label: 'Electronics', icon: TrendingUp },
  { id: 'appliances', label: 'Appliances', icon: Flame },
  { id: 'kitchen', label: 'Kitchen', icon: Package },
  { id: 'furniture', label: 'Furniture', icon: Package },
  { id: 'vouchers', label: 'Vouchers', icon: Coins },
  { id: 'jewelry', label: 'Jewelry', icon: Sparkles },
  { id: 'vehicles', label: 'Vehicles', icon: Package },
  { id: 'home', label: 'Home', icon: Package },
];

const SORTS = [
  { id: 'default', label: 'Default' },
  { id: 'price_asc', label: 'Price ↑' },
  { id: 'price_desc', label: 'Price ↓' },
];

const ParasMall = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('discover');
  const [products, setProducts] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [feed, setFeed] = useState([]);
  const [bookingCounts, setBookingCounts] = useState({});  // by_product_name → count (all-time)
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingBook, setPendingBook] = useState(null);
  const [delivery, setDelivery] = useState({
    name: '', mobile: '', address_line: '', city: '', state: '', pin_code: '', landmark: '',
  });

  // Pre-fill delivery form from user profile when modal opens
  useEffect(() => {
    if (pendingBook && user) {
      setDelivery(d => {
        const profileAddrLine = [user.address_line1, user.address_line2]
          .filter(Boolean).join(', ');
        return {
          name: d.name || user.name || [user.first_name, user.last_name].filter(Boolean).join(' ') || '',
          mobile: d.mobile || user.mobile || user.phone || '',
          address_line: d.address_line || profileAddrLine || '',
          city: d.city || user.city || '',
          state: d.state || user.state || '',
          pin_code: d.pin_code || user.pincode || user.pin_code || '',
          landmark: d.landmark || '',
        };
      });
    }
  }, [pendingBook, user]);
  const dragStartX = useRef(null);
  const dragStartY = useRef(null);

  const refreshBookings = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const r = await axios.get(`${API}/mall/my-bookings/${user.uid}`);
      setBookings(r.data?.bookings || []);
    } catch (e) { /* silent */ }
  }, [user?.uid]);

  // Combined loader so PullToRefresh can call one function
  const loadAllMallData = useCallback(async () => {
    try {
      const [pRes, fRes, cRes] = await Promise.all([
        axios.get(`${API}/mall/products`),
        axios.get(`${API}/mall/leaderboard/recent-bookings?limit=10`),
        axios.get(`${API}/mall/stats/booking-counts`),
      ]);
      if (pRes.data?.products) setProducts(pRes.data.products);
      if (fRes.data?.feed) setFeed(fRes.data.feed);
      if (cRes.data?.by_product_name) setBookingCounts(cRes.data.by_product_name);
    } catch (e) {
      toast.error('Failed to refresh Paras Mall');
    }
    await refreshBookings();
  }, [refreshBookings]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pRes, fRes, cRes] = await Promise.all([
          axios.get(`${API}/mall/products`),
          axios.get(`${API}/mall/leaderboard/recent-bookings?limit=10`),
          axios.get(`${API}/mall/stats/booking-counts`)
        ]);
        if (cancelled) return;
        if (pRes.data?.products) setProducts(pRes.data.products);
        if (fRes.data?.feed) setFeed(fRes.data.feed);
        if (cRes.data?.by_product_name) setBookingCounts(cRes.data.by_product_name);
      } catch (e) { toast.error('Failed to load Paras Mall'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    refreshBookings();
    return () => { cancelled = true; };
  }, [refreshBookings]);

  const activeBookings = useMemo(
    () => bookings.filter(b => b.status === 'mining' || b.status === 'fulfilled').length,
    [bookings]
  );

  // All-time booking count per product name (monotonic — only grows)
  const bookingCountByProduct = bookingCounts;

  const filtered = useMemo(() => {
    let list = products.slice();
    if (category !== 'all') list = list.filter(p => (p.category || '').toLowerCase() === category);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
    }
    if (sortBy === 'price_asc') list.sort((a, b) => a.mrp_inr - b.mrp_inr);
    else if (sortBy === 'price_desc') list.sort((a, b) => b.mrp_inr - a.mrp_inr);
    return list;
  }, [products, category, searchQuery, sortBy]);

  useEffect(() => { setActiveIndex(0); }, [searchQuery, category, sortBy]);

  const swipe = useCallback((dir) => {
    setActiveIndex(i => dir === 'next' ? Math.min(filtered.length - 1, i + 1) : Math.max(0, i - 1));
  }, [filtered.length]);

  const onTouchStart = (e) => {
    dragStartX.current = e.touches[0].clientX;
    dragStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e) => {
    if (dragStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - dragStartX.current;
    const dy = e.changedTouches[0].clientY - dragStartY.current;
    const absDx = Math.abs(dx); const absDy = Math.abs(dy);
    if (absDy > 80 && absDy > absDx * 1.4) {
      if (dy < 0) {
        const cur = filtered[activeIndex];
        if (cur && !bookingInProgress) setPendingBook(cur);
      }
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
      if (e.key === 'Escape') { setSearchOpen(false); setPendingBook(null); setSortOpen(false); setFilterOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tab, swipe]);

  const bookProduct = async (product, delivery) => {
    if (!user?.uid) { toast.error('Please log in to book'); return; }
    if (!delivery) { toast.error('Delivery details required'); return; }
    setBookingInProgress(true);
    try {
      const res = await axios.post(`${API}/mall/book/${product.product_id}`, {
        user_id: user.uid,
        delivery,
      });
      if (res.data?.success) {
        hapticSuccess();
        toast.success(`Booked ${product.name}! Mining started.`);
        if (onBalanceUpdate && res.data.booking) {
          onBalanceUpdate((user.prc_balance || 0) - res.data.booking.upfront_prc);
        }
        // Instantly bump the social-proof counter for this product (server is source of truth)
        setBookingCounts(prev => ({
          ...prev,
          [product.name]: (prev[product.name] || 0) + 1,
        }));
        await refreshBookings();
        setTab('bookings');
      }
    } catch (e) {
      hapticError();
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
  const socialCount = current ? bookingCountByProduct[current.name] || 0 : 0;

  return (
    <PullToRefresh onRefresh={loadAllMallData}>
    <div className="mall-root" data-testid="paras-mall-root">
      <div className="mall-bg" />

      {/* TOP CHROME — Back / Title block / Search */}
      <div className="mall-overlay-top">
        <button className="mall-back-btn" onClick={() => navigate('/dashboard')} data-testid="mall-back-btn">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="mall-title-block">
          <div className="mall-title-main">🛍 PARAS MALL</div>
          <div className="mall-title-sub">India&apos;s Smart Reward Shopping Destination</div>
        </div>
        <button
          className={`mall-icon-btn ${searchOpen ? 'active' : ''}`}
          onClick={() => setSearchOpen(s => !s)}
          data-testid="mall-search-toggle"
        >
          {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
        </button>
      </div>

      {/* PRC balance pill (with INR equivalent) */}
      <div className="mall-stat-row">
        <div className="mall-balance-pill" data-testid="mall-balance-pill">
          <Coins className="w-3 h-3" />
          <span className="mall-balance-prc">
            {Math.floor(user?.prc_balance || 0).toLocaleString('en-IN')} PRC
          </span>
          <span className="mall-balance-inr" data-testid="mall-balance-inr">
            ≈ ₹{Math.floor((user?.prc_balance || 0) / 10).toLocaleString('en-IN')}
          </span>
        </div>
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

      {/* Tabs */}
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
            {activeBookings > 0 && (
              <span className="mall-tab-badge" data-testid="mall-bookings-badge">{activeBookings}</span>
            )}
          </button>
        </div>
      )}

      {/* Filter bar — single "Filter" button + active category label */}
      {tab === 'discover' && !searchOpen && (
        <div className="mall-filter-bar" data-testid="mall-filter-bar">
          <button
            className={`mall-filter-btn ${category !== 'all' || sortBy !== 'default' ? 'active' : ''}`}
            onClick={() => setFilterOpen(true)}
            data-testid="mall-filter-open"
          >
            <span className="mall-filter-label">
              {CATEGORIES.find(c => c.id === category)?.label || 'All'}
              {sortBy !== 'default' ? ` · ${SORTS.find(s => s.id === sortBy)?.label}` : ''}
            </span>
            <span className="mall-filter-chev">▾</span>
          </button>
          <span className="mall-filter-count" data-testid="mall-filter-count">
            {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
          </span>
        </div>
      )}

      {/* Filter Bottom Sheet — Category + Sort grid */}
      <AnimatePresence>
        {filterOpen && (
          <motion.div
            className="mall-confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFilterOpen(false)}
            data-testid="mall-filter-backdrop"
          >
            <motion.div
              className="mall-filter-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              data-testid="mall-filter-sheet"
            >
              <div className="mall-confirm-handle" />
              <div className="mall-filter-section-title">Categories</div>
              <div className="mall-filter-grid" data-testid="mall-filter-grid">
                {CATEGORIES.map(c => {
                  const Icon = c.icon;
                  const isActive = category === c.id;
                  return (
                    <button
                      key={c.id}
                      className={`mall-filter-tile ${isActive ? 'active' : ''}`}
                      onClick={() => { setCategory(c.id); setFilterOpen(false); }}
                      data-testid={`mall-filter-tile-${c.id}`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mall-filter-section-title">Sort By</div>
              <div className="mall-filter-sort-row">
                {SORTS.map(s => (
                  <button
                    key={s.id}
                    className={`mall-filter-sort ${sortBy === s.id ? 'active' : ''}`}
                    onClick={() => { setSortBy(s.id); }}
                    data-testid={`mall-filter-sort-${s.id}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <button
                className="mall-filter-apply"
                onClick={() => setFilterOpen(false)}
                data-testid="mall-filter-apply"
              >
                Show {filtered.length} {filtered.length === 1 ? 'Product' : 'Products'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  <p className="text-xs text-zinc-400">Try a different category or search</p>
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
                      {/* Trending badge on first 5 */}
                      {activeIndex < 5 && category === 'all' && !searchQuery && (
                        <div className="mall-trending-badge">
                          <Flame className="w-3 h-3" /> Trending
                        </div>
                      )}
                      {socialCount > 0 && (
                        <div className="mall-social-badge" data-testid="mall-social-badge">
                          <Users className="w-3 h-3" /> {socialCount} booked
                        </div>
                      )}
                      {current?.image_url ? (
                        <img src={current.image_url} alt={current.name} className="mall-image" data-testid="mall-product-image" />
                      ) : (
                        <div className="mall-image-fallback"><Package className="w-20 h-20 text-purple-300" /></div>
                      )}
                    </div>

                    <button onClick={() => swipe('prev')} disabled={activeIndex === 0} className="mall-nav-arrow left" data-testid="mall-prev-btn">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button onClick={() => swipe('next')} disabled={activeIndex >= filtered.length - 1} className="mall-nav-arrow right" data-testid="mall-next-btn">
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

                  {Array.isArray(current?.brands) && current.brands.length > 0 && (
                    <div className="mall-brands-row" data-testid="mall-brands-row">
                      <span className="mall-brands-label">Top Brands</span>
                      <div className="mall-brands-list">
                        {current.brands.slice(0, 5).map((b) => (
                          <span key={b} className="mall-brand-chip" data-testid={`mall-brand-${b}`}>
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

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
                    onClick={() => { hapticPrimary(); setPendingBook(current); }}
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
              {Array.isArray(pendingBook.brands) && pendingBook.brands.length > 0 && (
                <div className="mall-confirm-brands">
                  {pendingBook.brands.slice(0, 5).map((b) => (
                    <span key={b} className="mall-brand-chip small">{b}</span>
                  ))}
                </div>
              )}
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

              {/* Delivery Address Form */}
              <div className="mall-delivery-section" data-testid="mall-delivery-form">
                <div className="mall-delivery-title">📍 Delivery Address</div>
                <input
                  className="mall-delivery-input"
                  placeholder="Full Name"
                  value={delivery.name}
                  onChange={(e) => setDelivery({ ...delivery, name: e.target.value })}
                  data-testid="mall-delivery-name"
                />
                <input
                  className="mall-delivery-input"
                  placeholder="Mobile (10 digits)"
                  type="tel"
                  maxLength={10}
                  value={delivery.mobile}
                  onChange={(e) => setDelivery({ ...delivery, mobile: e.target.value.replace(/\D/g, '') })}
                  data-testid="mall-delivery-mobile"
                />
                <input
                  className="mall-delivery-input"
                  placeholder="House No, Street, Area"
                  value={delivery.address_line}
                  onChange={(e) => setDelivery({ ...delivery, address_line: e.target.value })}
                  data-testid="mall-delivery-address"
                />
                <div className="mall-delivery-row">
                  <input
                    className="mall-delivery-input"
                    placeholder="City"
                    value={delivery.city}
                    onChange={(e) => setDelivery({ ...delivery, city: e.target.value })}
                    data-testid="mall-delivery-city"
                  />
                  <input
                    className="mall-delivery-input"
                    placeholder="State"
                    value={delivery.state}
                    onChange={(e) => setDelivery({ ...delivery, state: e.target.value })}
                    data-testid="mall-delivery-state"
                  />
                </div>
                <input
                  className="mall-delivery-input"
                  placeholder="PIN Code (6 digits)"
                  type="tel"
                  maxLength={6}
                  value={delivery.pin_code}
                  onChange={(e) => setDelivery({ ...delivery, pin_code: e.target.value.replace(/\D/g, '') })}
                  data-testid="mall-delivery-pin"
                />
                <input
                  className="mall-delivery-input"
                  placeholder="Landmark (optional)"
                  value={delivery.landmark}
                  onChange={(e) => setDelivery({ ...delivery, landmark: e.target.value })}
                  data-testid="mall-delivery-landmark"
                />
              </div>

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
                    // Inline validation
                    if (!delivery.name.trim() || !delivery.mobile.trim() || !delivery.address_line.trim() || !delivery.pin_code.trim()) {
                      toast.error('Name, mobile, address & PIN code are required');
                      return;
                    }
                    if (delivery.mobile.length < 10) { toast.error('Mobile must be 10 digits'); return; }
                    if (delivery.pin_code.length !== 6) { toast.error('PIN code must be 6 digits'); return; }
                    const p = pendingBook;
                    const d = { ...delivery };
                    setPendingBook(null);
                    await bookProduct(p, d);
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
    </PullToRefresh>
  );
};

export default ParasMall;
