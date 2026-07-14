/**
 * Paras Mall — Premium Reward Shopping (v3 — Advanced)
 * Full-screen overlay (z-index 9999) with category chips, live ticker,
 * balance pill, sort, and social proof.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import PullToRefresh from '@/components/PullToRefresh';
import {
  ArrowLeft, ShoppingBag, Sparkles, Package,
  Coins, Search, X, Flame, ArrowUpDown, TrendingUp, Users, Heart
} from 'lucide-react';
import { toast } from 'sonner';
import { hapticPrimary, hapticSuccess, hapticError } from '@/utils/nativeUx';
// useAdMob is initialized at the App root (App.js). Mall does not show
// ad triggers itself — App Open ads auto-show on foreground per Google policy.
import WishlistHeart from '@/components/mall/WishlistHeart';
import SaverProgressBar from '@/components/mall/SaverProgressBar';
import ProductBadges from '@/components/mall/ProductBadges';
import SkeletonGrid from '@/components/mall/SkeletonCard';
import HeroCarousel from '@/components/mall/HeroCarousel';
import CategoriesGrid from '@/components/mall/CategoriesGrid';
import ProductDetailSheet from '@/components/mall/ProductDetailSheet';
import './ParasMall.css';
import ParasMallBookings from './ParasMallBookings';
import { resolveAssetUrl } from '@/utils/resolveAssetUrl';
import { useRewardedInterstitial } from '@/components/RewardedInterstitialTrigger';

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

  // Rewarded Interstitial trigger — opens after a successful booking so
  // the user sees "watch to earn +10 bonus PRC" opt-in. Never gates the
  // primary booking (Google AdMob policy safe).
  const rewardedAd = useRewardedInterstitial();
  const [products, setProducts] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [feed, setFeed] = useState([]);
  const [bookingCounts, setBookingCounts] = useState({});  // by_product_name → count (all-time)
  const [loading, setLoading] = useState(true);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingBook, setPendingBook] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);
  // V3 (Feb 2026): user-selectable upfront/deposit % — 10 (default) / 20 / 35 / 50
  const [upfrontPercent, setUpfrontPercent] = useState(0.10);
  const [delivery, setDelivery] = useState({
    name: '', mobile: '', address_line: '', city: '', state: '', pin_code: '', landmark: '',
  });

  // Pre-fill delivery form from user profile when modal opens
  useEffect(() => {
    if (pendingBook && user) {
      // Reset upfront back to default 10% each time modal reopens
      setUpfrontPercent(0.10);
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

  useEffect(() => {
    const handler = (e) => {
      if (tab !== 'discover') return;
      if (e.key === 'Escape') { setSearchOpen(false); setPendingBook(null); setSortOpen(false); setFilterOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tab]);

  const bookProduct = async (product, delivery, upfrontPct = 0.10) => {
    if (!user?.uid) { toast.error('Please log in to book'); return; }
    if (!delivery) { toast.error('Delivery details required'); return; }
    setBookingInProgress(true);
    try {
      const res = await axios.post(`${API}/mall/book/${product.product_id}`, {
        user_id: user.uid,
        delivery,
        upfront_percent: upfrontPct,
      });
      if (res.data?.success) {
        hapticSuccess();
        toast.success(`Booked ${product.name}! Mining started.`);
        // App Open ads now auto-show on app foreground (per Google policy);
        // they MUST NOT be triggered as interstitials after in-app actions.

        // NEW (Feb 8 2026) — Post-action Rewarded Interstitial opt-in.
        // Non-gating: booking is already saved on the server; the modal
        // just offers a bonus in exchange for watching an ad. Skipping
        // is 100% harmless.
        rewardedAd.open({ bonusPrc: 10 });

        // Phase 3: maybe prompt Play Store review after a successful booking
        setTimeout(async () => {
          const { maybePromptReview } = await import('@/utils/inAppReview');
          maybePromptReview('mall_booking');
        }, 4000);
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

  // Mall 2.0: auto-track recently-viewed — grid layout tracks the first product on load
  const trackedProductId = filtered[0]?.product_id;
  useEffect(() => {
    if (!trackedProductId) return;
    const t = setTimeout(() => {
      axios.post(`${API}/mall/v2/track-view/${trackedProductId}`).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [trackedProductId]);

  if (loading) {
    // Shimmer skeleton instead of "Loading Mall" text — Amazon/Flipkart polish.
    return (
      <div className="mall-root" data-testid="mall-loading" style={{ paddingTop: 20 }}>
        <div style={{ padding: '0 16px', marginBottom: 16 }}>
          <div
            style={{
              height: 28, width: '40%', borderRadius: 8,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 100%)',
              backgroundSize: '200% 100%',
              animation: 'mallSkelShimmer 1.4s ease-in-out infinite',
            }}
          />
        </div>
        <SkeletonGrid count={4} variant="product" />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={loadAllMallData}>
    <div className="mall-root" data-testid="paras-mall-root">
      <div className="mall-bg" />
      {/* Post-booking Rewarded Interstitial modal — hidden until bookProduct
          success triggers rewardedAd.open(). */}
      {rewardedAd.element}

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
        <button
          className="mall-icon-btn"
          onClick={() => navigate('/mall/wishlist')}
          data-testid="mall-wishlist-link"
          aria-label="Wishlist"
        >
          <Heart className="w-5 h-5" />
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

      {/* Mall 2.0: PRC Saver Progress (next-target motivator) */}
      <SaverProgressBar refreshKey={user?.prc_balance || 0} />

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

      {/* Sub-Batch B: Hero Carousel + Categories Grid (landing refresh) */}
      {tab === 'discover' && !searchOpen && (
        <>
          <HeroCarousel onSelectProduct={(p) => setDetailProduct(p)} />
          <CategoriesGrid
            active={category}
            onSelect={(cid) => setCategory(cid)}
          />
        </>
      )}

      {/* Filter bar — compact strip (sort + count + advanced filter) */}
      {tab === 'discover' && !searchOpen && (
        <div className="mall-filter-bar mall-filter-bar-compact" data-testid="mall-filter-bar">
          <button
            className={`mall-filter-btn ${sortBy !== 'default' ? 'active' : ''}`}
            onClick={() => setFilterOpen(true)}
            data-testid="mall-filter-open"
          >
            <span className="mall-filter-label">
              {sortBy !== 'default' ? `Sort: ${SORTS.find(s => s.id === sortBy)?.label}` : 'Sort & Filter'}
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

      {/* 1-COLUMN PRODUCT GRID (was: swipe/carousel single-product view) */}
      <AnimatePresence mode="wait">
        {tab === 'discover' && (
          <motion.div
            key="discover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mall-hero mall-hero-grid"
          >
            {filtered.length === 0 ? (
              <div className="flex-1 grid place-items-center text-center px-6 py-20">
                <div>
                  <Package className="w-12 h-12 mx-auto mb-3 text-purple-400 opacity-60" />
                  <p className="text-white font-semibold mb-1">No products found</p>
                  <p className="text-xs text-zinc-400">Try a different category or search</p>
                </div>
              </div>
            ) : (
              <div className="mall-grid-1col" data-testid="mall-grid-1col">
                {filtered.map((product, idx) => {
                  const socialForCard = bookingCountByProduct[product.name] || 0;
                  const mrp = Number(product.mrp_inr || 0);
                  const bookingFee = Number(product.processing_inr || 0);
                  const discount = mrp > 0 && bookingFee > 0 && bookingFee < mrp
                    ? Math.round(((mrp - bookingFee) / mrp) * 100)
                    : 0;
                  return (
                    <motion.article
                      key={product.product_id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.24, delay: Math.min(idx * 0.04, 0.24) }}
                      className="mall-product-card"
                      data-testid={`mall-product-card-${product.product_id}`}
                    >
                      {/* Image + overlays */}
                      <div className="mall-product-card-image-wrap">
                        <ProductBadges product={product} />
                        <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-1.5">
                          <WishlistHeart productId={product.product_id} />
                          {socialForCard > 0 && (
                            <div
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-white/95 text-emerald-700 shadow ring-1 ring-emerald-200"
                              data-testid={`mall-social-badge-${product.product_id}`}
                            >
                              <Users className="w-3 h-3" /> {socialForCard} booked
                            </div>
                          )}
                        </div>
                        {product.image_url ? (
                          <img
                            src={resolveAssetUrl(product.image_url)}
                            alt={product.name}
                            className="mall-product-card-image"
                            data-testid={`mall-product-image-${product.product_id}`}
                            onClick={() => setDetailProduct(product)}
                          />
                        ) : (
                          <div
                            className="mall-product-card-image-fallback"
                            onClick={() => setDetailProduct(product)}
                          >
                            <Package className="w-20 h-20 text-purple-300" />
                          </div>
                        )}
                        {discount > 0 && (
                          <div className="mall-product-card-discount-tag" data-testid={`mall-product-discount-${product.product_id}`}>
                            {discount}% Off
                          </div>
                        )}
                      </div>

                      {/* Body */}
                      <div className="mall-product-card-body">
                        <div className="mall-category-strip">
                          <Sparkles className="w-3 h-3" />
                          {product.category}
                        </div>
                        <h2 className="mall-product-name" data-testid={`mall-product-name-${product.product_id}`}>
                          {product.name}
                        </h2>

                        {Array.isArray(product.brands) && product.brands.length > 0 && (
                          <div className="mall-brands-row" data-testid={`mall-brands-row-${product.product_id}`}>
                            <span className="mall-brands-label">Top Brands</span>
                            <div className="mall-brands-list">
                              {product.brands.slice(0, 5).map((b) => (
                                <span key={b} className="mall-brand-chip">
                                  {b}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="mall-price-row">
                          <div className="mall-price-tile" data-testid={`mall-mrp-tile-${product.product_id}`}>
                            <div className="mall-price-tile-label">MRP (All Inclusive)</div>
                            <div className="mall-price-tile-value">{fmtInr(product.mrp_inr)}</div>
                          </div>
                          <div className="mall-price-tile total" data-testid={`mall-total-tile-${product.product_id}`}>
                            <div className="mall-price-tile-label">Booking Fee (from PRC wallet)</div>
                            <div className="mall-price-tile-value">{fmtInr(product.processing_inr)}</div>
                            <div className="mall-price-tile-sub">
                              = {fmtPrc(product.upfront_prc)} (one-time)
                            </div>
                          </div>
                        </div>

                        <button
                          className="mall-book-btn"
                          onClick={() => { hapticPrimary(); setPendingBook(product); }}
                          disabled={bookingInProgress}
                          data-testid={`mall-book-btn-${product.product_id}`}
                        >
                          <ShoppingBag className="w-4 h-4" />
                          {bookingInProgress ? 'Booking…' : `Book Now · ${fmtPrc(product.upfront_prc)}`}
                        </button>

                        <button
                          className="mall-view-details-btn"
                          onClick={() => setDetailProduct(product)}
                          data-testid={`mall-view-details-btn-${product.product_id}`}
                        >
                          View Full Details →
                        </button>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
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
              <div className="mall-confirm-prices" data-testid="mall-confirm-pricing-breakdown">
                <div className="mall-pricing-row">
                  <span>MRP <span className="text-amber-300/80 text-[10px]">(All Inclusive)</span></span>
                  <span>{fmtInr(pendingBook.mrp_inr)}</span>
                </div>
                <div className="mall-pricing-row total">
                  <span>Mining Target</span>
                  <span>{fmtPrc(pendingBook.total_prc)}</span>
                </div>
                <div className="mall-pricing-divider" />

                {/* V3 Prepaid Deposit selector — 10 / 20 / 35 / 50% */}
                <div className="mall-upfront-selector" data-testid="mall-upfront-selector">
                  <div className="mall-upfront-label">
                    💰 Upfront Deposit
                    <span className="mall-upfront-hint">— pay more now, fulfil faster</span>
                  </div>
                  <div className="mall-upfront-options">
                    {[0.10, 0.20, 0.35, 0.50].map((pct) => {
                      const isActive = Math.abs(upfrontPercent - pct) < 0.001;
                      return (
                        <button
                          key={pct}
                          type="button"
                          className={`mall-upfront-chip${isActive ? ' active' : ''}`}
                          onClick={() => setUpfrontPercent(pct)}
                          data-testid={`mall-upfront-${Math.round(pct * 100)}`}
                        >
                          {Math.round(pct * 100)}%
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mall-pricing-row upfront-row">
                  <span>You pay now (Deposit)</span>
                  <span className="upfront" data-testid="mall-upfront-prc">
                    {fmtPrc(Math.round((pendingBook.mrp_inr || 0) * upfrontPercent * 10))}
                  </span>
                </div>
                <div className="mall-pricing-row">
                  <span>Remaining to mine</span>
                  <span data-testid="mall-remaining-prc">
                    {fmtPrc(
                      Math.max(
                        0,
                        (pendingBook.total_prc || 0) -
                          Math.round((pendingBook.mrp_inr || 0) * upfrontPercent * 10)
                      )
                    )}
                  </span>
                </div>
                <div className="mall-pricing-hint">
                  Deposit counts toward the mining target — the more you pay now, the less you mine later. ≈ {fmtInr((pendingBook.mrp_inr || 0) * upfrontPercent)} from your wallet.
                </div>
              </div>
              <p className="mall-confirm-note">
                Daily mining (50 PRC floor + downline boost) accumulates toward {fmtPrc(pendingBook.total_prc || 0)}. Delivery triggers at 100%.
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
                    const up = upfrontPercent;
                    setPendingBook(null);
                    await bookProduct(p, d, up);
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

      {/* Product Detail Sheet (Sub-Batch B premium UX) */}
      <ProductDetailSheet
        product={detailProduct}
        open={!!detailProduct}
        onClose={() => setDetailProduct(null)}
        onBook={(p) => { setDetailProduct(null); setPendingBook(p); }}
      />
    </div>
    </PullToRefresh>
  );
};

export default ParasMall;
