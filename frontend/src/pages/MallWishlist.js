/**
 * MallWishlist.js
 * --------------------------------------------------------------
 * /mall/wishlist — user's saved products.
 *
 * Tap a card → navigates back to /mall with the product preselected
 * via `?product=<id>`. Empty state guides them back to browse.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Heart, ShoppingBag, Loader2 } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmtPrc = (n) => `${Number(n || 0).toLocaleString("en-IN")} PRC`;

export default function MallWishlist() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/mall/v2/wishlist`);
      setItems(data?.items || []);
    } catch (_) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (pid) => {
    try {
      await axios.post(`${API}/mall/v2/wishlist/${pid}/toggle`);
      setItems((prev) => prev.filter((it) => it.product?.product_id !== pid));
      toast.success("Removed from Wishlist");
    } catch (_) {
      toast.error("Could not remove");
    }
  };

  const openProduct = (pid) => {
    navigate(`/mall?product=${pid}`);
  };

  return (
    <div
      data-testid="mall-wishlist-page"
      className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white pb-24"
    >
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-slate-950/85 backdrop-blur border-b border-white/5">
        <button
          data-testid="wishlist-back-btn"
          onClick={() => navigate("/mall")}
          className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 inline-flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-400 fill-rose-400" />
          My Wishlist
        </h1>
        <span className="ml-auto text-xs text-slate-400">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </span>
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-24">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="px-6 pt-20 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-rose-500/10 ring-2 ring-rose-500/20 flex items-center justify-center mb-4">
            <Heart className="w-7 h-7 text-rose-400" />
          </div>
          <h2 className="text-base font-semibold">Your wishlist is empty</h2>
          <p className="text-sm text-slate-400 mt-1">
            Tap the heart on any Mall product to save it for later.
          </p>
          <button
            data-testid="wishlist-browse-btn"
            onClick={() => navigate("/mall")}
            className="mt-6 inline-flex items-center gap-2 bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:brightness-110 transition"
          >
            <ShoppingBag className="w-4 h-4" />
            Browse Mall
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-3 pt-3">
          {items.map((it) => {
            const p = it.product || {};
            return (
              <li
                key={p.product_id}
                data-testid={`wishlist-item-${p.product_id}`}
                className="relative bg-slate-900/60 ring-1 ring-white/5 rounded-2xl overflow-hidden shadow-md hover:shadow-fuchsia-500/10 transition"
              >
                <button
                  type="button"
                  onClick={() => openProduct(p.product_id)}
                  className="block w-full text-left"
                >
                  <div className="aspect-square bg-slate-800 flex items-center justify-center">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag className="w-10 h-10 text-slate-500" />
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-[11px] text-fuchsia-300 mt-0.5">
                      ₹{Number(p.mrp_inr || 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => remove(p.product_id)}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/95 inline-flex items-center justify-center hover:scale-105 transition"
                  aria-label="Remove from wishlist"
                  data-testid={`wishlist-remove-${p.product_id}`}
                >
                  <Heart className="w-4 h-4 text-rose-500" fill="currentColor" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
