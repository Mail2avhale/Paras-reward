/**
 * mall/WishlistHeart.js
 * --------------------------------------------------------------
 * A floating heart button on each product card.
 *
 *   <WishlistHeart productId={current.product_id} />
 *
 * Self-contained — reads & toggles state via the backend.
 * Optimistic UI: heart fills immediately, rolls back on API failure.
 */
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { hapticTap } from "@/utils/nativeUx";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// In-memory cache of (productId → bool) so we don't refetch the whole wishlist
// every time a user swipes between cards in the same session.
const cache = new Map();
let cacheReady = false;

const primeCache = async () => {
  if (cacheReady) return;
  try {
    const { data } = await axios.get(`${API}/mall/v2/wishlist`);
    cache.clear();
    (data?.items || []).forEach((it) => cache.set(it.product?.product_id, true));
    cacheReady = true;
  } catch (_) {
    /* anonymous user or error — leave cache empty */
    cacheReady = true;
  }
};

export default function WishlistHeart({ productId, size = 22, className = "" }) {
  const [liked, setLiked] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await primeCache();
      if (!cancelled) setLiked(!!cache.get(productId));
    })();
    return () => { cancelled = true; };
  }, [productId]);

  const onClick = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (pending || !productId) return;
    setPending(true);
    const next = !liked;
    setLiked(next);
    cache.set(productId, next);
    hapticTap();
    try {
      const { data } = await axios.post(`${API}/mall/v2/wishlist/${productId}/toggle`);
      const server = !!data?.in_wishlist;
      cache.set(productId, server);
      setLiked(server);
      if (server) toast.success("Added to Wishlist ❤️", { duration: 1400 });
      else toast.success("Removed from Wishlist", { duration: 1200 });
    } catch (err) {
      // rollback
      setLiked(!next);
      cache.set(productId, !next);
      toast.error("Sign in to save to your Wishlist");
    } finally {
      setPending(false);
    }
  }, [pending, productId, liked]);

  return (
    <button
      type="button"
      aria-label="Toggle wishlist"
      onClick={onClick}
      disabled={pending}
      data-testid={`wishlist-heart-${productId}`}
      className={`relative inline-flex items-center justify-center rounded-full w-10 h-10 bg-white/95 shadow-md ring-1 ring-black/5 hover:scale-105 active:scale-95 transition disabled:opacity-60 ${className}`}
    >
      <Heart
        size={size}
        strokeWidth={2}
        className={liked ? "text-rose-500" : "text-slate-500"}
        fill={liked ? "currentColor" : "none"}
      />
    </button>
  );
}
