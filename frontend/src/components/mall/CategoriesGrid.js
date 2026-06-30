/**
 * CategoriesGrid — Flipkart-style 4-tile-per-row icon grid that drives the
 * Mall category filter. Highlights the current selection.
 */
import {
  Sparkles, TrendingUp, Flame, Package, Coins, Shirt, Home, Smartphone,
} from 'lucide-react';

const CATS = [
  { id: 'all', label: 'All', Icon: Sparkles, color: 'amber' },
  { id: 'electronics', label: 'Electronics', Icon: Smartphone, color: 'sky' },
  { id: 'appliances', label: 'Appliances', Icon: Flame, color: 'orange' },
  { id: 'kitchen', label: 'Kitchen', Icon: Package, color: 'rose' },
  { id: 'furniture', label: 'Furniture', Icon: Home, color: 'violet' },
  { id: 'vouchers', label: 'Vouchers', Icon: Coins, color: 'emerald' },
  { id: 'jewelry', label: 'Jewelry', Icon: Sparkles, color: 'pink' },
  { id: 'fashion', label: 'Fashion', Icon: Shirt, color: 'indigo' },
];

export default function CategoriesGrid({ active = 'all', onSelect }) {
  return (
    <div className="mall-categories-grid" data-testid="mall-categories-grid">
      {CATS.map((c) => {
        const Icon = c.Icon;
        const isActive = active === c.id;
        return (
          <button
            key={c.id}
            className={`mall-cat-tile mall-cat-${c.color} ${isActive ? 'active' : ''}`}
            onClick={() => onSelect?.(c.id)}
            data-testid={`mall-cat-tile-${c.id}`}
          >
            <div className="mall-cat-icon-wrap">
              <Icon className="w-5 h-5" />
            </div>
            <div className="mall-cat-label">{c.label}</div>
            {isActive && <span className="mall-cat-active-pill" />}
          </button>
        );
      })}
    </div>
  );
}
