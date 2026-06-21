/**
 * mall/ProductBadges.js
 * --------------------------------------------------------------
 * Renders compact NEW / TRENDING / HOT / "Only X left!" badges
 * stacked at the top-left corner of a product card.
 *
 *   <ProductBadges product={current} />
 */
import { Flame, Sparkles, TrendingUp, AlertCircle } from "lucide-react";

const baseChip =
  "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase shadow-md backdrop-blur";

export default function ProductBadges({ product }) {
  if (!product) return null;
  const stock = product.stock_count;
  const lowStock = typeof stock === "number" && stock > 0 && stock <= 5;

  return (
    <div
      data-testid={`product-badges-${product.product_id}`}
      className="absolute top-3 left-3 z-20 flex flex-col gap-1.5 items-start pointer-events-none"
    >
      {product.is_new && (
        <span className={`${baseChip} bg-emerald-500/95 text-white`}>
          <Sparkles className="w-3 h-3" /> NEW
        </span>
      )}
      {product.is_hot && (
        <span className={`${baseChip} bg-rose-500/95 text-white`}>
          <Flame className="w-3 h-3" /> HOT
        </span>
      )}
      {product.is_trending && (
        <span className={`${baseChip} bg-amber-400/95 text-amber-950`}>
          <TrendingUp className="w-3 h-3" /> TRENDING
        </span>
      )}
      {lowStock && (
        <span className={`${baseChip} bg-orange-600/95 text-white animate-pulse`}>
          <AlertCircle className="w-3 h-3" /> Only {stock} left!
        </span>
      )}
    </div>
  );
}
