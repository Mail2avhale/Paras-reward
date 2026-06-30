/**
 * ProductDetailSheet — Amazon/Flipkart-style premium product detail.
 * - Full-screen bottom-sheet on mobile (sticky bottom CTA)
 * - Multi-image gallery (uses product.images[] with image_url fallback)
 * - Live mining preview (fetches /mall/v2/mining-preview/{id})
 * - Trust badges + pricing breakdown
 */
import { useEffect, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ShoppingBag, Truck, ShieldCheck, RefreshCw, Sparkles, Package,
  Zap, TrendingUp, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { resolveAssetUrl } from '@/utils/resolveAssetUrl';
import ProductBadges from '@/components/mall/ProductBadges';
import WishlistHeart from '@/components/mall/WishlistHeart';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const fmtInr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtPrc = (n) => `${Number(n || 0).toLocaleString('en-IN')} PRC`;

export default function ProductDetailSheet({ product, open, onClose, onBook }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Multi-image: use product.images[] if present, else fallback to image_url
  const images = (Array.isArray(product?.images) && product.images.length
    ? product.images
    : (product?.image_url ? [product.image_url] : []));

  useEffect(() => {
    if (!open || !product?.product_id) return;
    setImgIdx(0);
    setPreview(null);
    setPreviewLoading(true);
    (async () => {
      try {
        const r = await axios.get(`${API}/mall/v2/mining-preview/${product.product_id}`);
        if (r.data?.success) setPreview(r.data);
      } catch (e) { /* silent — preview is optional */ }
      finally { setPreviewLoading(false); }
    })();
  }, [open, product?.product_id]);

  return (
    <AnimatePresence>
      {open && product && (
        <motion.div
          className="mall-detail-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          data-testid="mall-detail-backdrop"
        >
          <motion.div
            className="mall-detail-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            data-testid="mall-detail-sheet"
          >
            <div className="mall-detail-header">
              <button onClick={onClose} className="mall-detail-close" data-testid="mall-detail-close">
                <X className="w-5 h-5" />
              </button>
              <div className="mall-detail-title-mini">Product Detail</div>
              <WishlistHeart productId={product.product_id} />
            </div>

            <div className="mall-detail-scroll">
              {/* Image gallery */}
              <div className="mall-detail-gallery" data-testid="mall-detail-gallery">
                <ProductBadges product={product} />
                {images.length > 0 ? (
                  <>
                    <img
                      src={resolveAssetUrl(images[imgIdx])}
                      alt={product.name}
                      className="mall-detail-img"
                      data-testid="mall-detail-main-image"
                    />
                    {images.length > 1 && (
                      <>
                        <button
                          className="mall-detail-img-arrow left"
                          onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                          aria-label="Previous image"
                          data-testid="mall-detail-img-prev"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          className="mall-detail-img-arrow right"
                          onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                          aria-label="Next image"
                          data-testid="mall-detail-img-next"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <div className="mall-detail-img mall-detail-img-fallback">
                    <Package className="w-16 h-16 text-purple-300" />
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="mall-detail-thumbs" data-testid="mall-detail-thumbs">
                  {images.map((src, i) => (
                    <button
                      key={i}
                      className={`mall-detail-thumb ${i === imgIdx ? 'active' : ''}`}
                      onClick={() => setImgIdx(i)}
                      data-testid={`mall-detail-thumb-${i}`}
                    >
                      <img src={resolveAssetUrl(src)} alt={`thumb-${i}`} />
                    </button>
                  ))}
                </div>
              )}

              {/* Title + category */}
              <div className="mall-detail-info">
                <div className="mall-detail-cat">
                  <Sparkles className="w-3 h-3" /> {product.category || 'general'}
                </div>
                <h2 className="mall-detail-name" data-testid="mall-detail-name">
                  {product.name}
                </h2>
                {product.description && (
                  <p className="mall-detail-desc" data-testid="mall-detail-desc">
                    {product.description}
                  </p>
                )}

                {Array.isArray(product.brands) && product.brands.length > 0 && (
                  <div className="mall-detail-brands">
                    {product.brands.slice(0, 6).map((b) => (
                      <span key={b} className="mall-brand-chip">{b}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Pricing breakdown */}
              <div className="mall-detail-section">
                <div className="mall-detail-section-title">Pricing Breakdown</div>
                <div className="mall-detail-price-grid">
                  <div className="mall-detail-price-row">
                    <span>MRP <span className="opacity-60 text-[10px]">(All Inclusive)</span></span>
                    <span>{fmtInr(product.mrp_inr)}</span>
                  </div>
                  <div className="mall-detail-price-row">
                    <span>Processing Fee ({product.processing_percent || 10}%)</span>
                    <span>+ {fmtInr(product.processing_inr)}</span>
                  </div>
                  <div className="mall-detail-price-row total">
                    <span>Mining Target</span>
                    <span>{fmtPrc(product.total_prc)}</span>
                  </div>
                </div>
              </div>

              {/* Live Mining Preview */}
              <div className="mall-detail-section">
                <div className="mall-detail-section-title">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Live Mining Preview
                </div>
                {previewLoading && (
                  <div className="mall-detail-preview-skel" data-testid="mall-detail-preview-loading">
                    Estimating your mining timeline…
                  </div>
                )}
                {preview && (
                  <div className="mall-detail-preview" data-testid="mall-detail-preview">
                    <div className="mall-detail-preview-summary">
                      <div>
                        <div className="mall-detail-preview-label">Booking Fee</div>
                        <div className="mall-detail-preview-val">
                          {fmtPrc(preview.pricing.upfront_prc)}
                        </div>
                      </div>
                      <div>
                        <div className="mall-detail-preview-label">Mining Target</div>
                        <div className="mall-detail-preview-val">
                          {fmtPrc(preview.pricing.total_prc)}
                        </div>
                      </div>
                      <div>
                        <div className="mall-detail-preview-label">Your network cap</div>
                        <div className="mall-detail-preview-val">{preview.user_network_cap}</div>
                      </div>
                    </div>
                    <div className="mall-detail-preview-tiers">
                      <div className="mall-detail-preview-tier slow">
                        <span className="mall-detail-preview-tier-tag">Slow</span>
                        <div className="mall-detail-preview-tier-rate">
                          {fmtPrc(preview.estimates.slow.daily_prc)} / day
                        </div>
                        <div className="mall-detail-preview-tier-days">
                          ≈ {preview.estimates.slow.days_to_complete} days
                        </div>
                      </div>
                      <div className="mall-detail-preview-tier typical">
                        <span className="mall-detail-preview-tier-tag">Typical</span>
                        <div className="mall-detail-preview-tier-rate">
                          {fmtPrc(preview.estimates.typical.daily_prc)} / day
                        </div>
                        <div className="mall-detail-preview-tier-days">
                          ≈ {preview.estimates.typical.days_to_complete} days
                        </div>
                      </div>
                      <div className="mall-detail-preview-tier fast">
                        <span className="mall-detail-preview-tier-tag">Fast</span>
                        <div className="mall-detail-preview-tier-rate">
                          {fmtPrc(preview.estimates.fast.daily_prc)} / day
                        </div>
                        <div className="mall-detail-preview-tier-days">
                          ≈ {preview.estimates.fast.days_to_complete} days
                        </div>
                      </div>
                    </div>
                    <div className="mall-detail-preview-hint">
                      <TrendingUp className="w-3 h-3" /> {preview.hint}
                    </div>
                  </div>
                )}
              </div>

              {/* Trust badges */}
              <div className="mall-detail-section">
                <div className="mall-detail-trust">
                  <div className="mall-detail-trust-item">
                    <Truck className="w-4 h-4" />
                    <span>Doorstep Delivery on 100% mining</span>
                  </div>
                  <div className="mall-detail-trust-item">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verified, brand-fresh stock</span>
                  </div>
                  <div className="mall-detail-trust-item">
                    <RefreshCw className="w-4 h-4" />
                    <span>Cancel anytime — upfront PRC refunded</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky bottom CTA */}
            <div className="mall-detail-cta-bar" data-testid="mall-detail-cta-bar">
              <div className="mall-detail-cta-price">
                <div className="mall-detail-cta-label">Booking Fee</div>
                <div className="mall-detail-cta-value">{fmtPrc(product.upfront_prc)}</div>
              </div>
              <button
                className="mall-detail-cta-btn"
                onClick={() => onBook?.(product)}
                data-testid="mall-detail-book-btn"
              >
                <ShoppingBag className="w-4 h-4" />
                Book Now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
