/**
 * Paras Mall — My Bookings list with live per-booking mining widget.
 * Each booking has its own 24-hour session ticker and Collect button.
 */
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Coins, Clock, Package, CheckCircle, Truck, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const formatPrc = (n) => `${Math.round(Number(n)).toLocaleString('en-IN')}`;
const formatTime = (sec) => {
  if (sec <= 0) return '00:00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const STATUS_META = {
  mining: { label: 'Mining', color: 'text-amber-400', icon: Sparkles, bg: 'bg-amber-500/10 border-amber-500/30' },
  fulfilled: { label: 'Fulfilled — Awaiting Delivery', color: 'text-emerald-300', icon: CheckCircle, bg: 'bg-emerald-500/10 border-emerald-500/30' },
  delivered: { label: 'Delivered', color: 'text-blue-300', icon: Truck, bg: 'bg-blue-500/10 border-blue-500/30' },
};

const BookingCard = ({ booking, onCollect, onRefresh }) => {
  const meta = STATUS_META[booking.status] || STATUS_META.mining;
  const Icon = meta.icon;

  // Live counter tick
  const [liveAccumulated, setLiveAccumulated] = useState(booking.session_accumulated_prc || 0);
  const [liveRemaining, setLiveRemaining] = useState(booking.session_remaining_seconds || 0);
  const tickRef = useRef(null);

  useEffect(() => {
    setLiveAccumulated(booking.session_accumulated_prc || 0);
    setLiveRemaining(booking.session_remaining_seconds || 0);
  }, [booking.session_accumulated_prc, booking.session_remaining_seconds]);

  useEffect(() => {
    if (booking.status !== 'mining') return;
    const perSec = booking.per_second_prc || 0;
    tickRef.current = setInterval(() => {
      setLiveAccumulated((prev) => prev + perSec);
      setLiveRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [booking.status, booking.per_second_prc]);

  const collect = async () => {
    try {
      const res = await axios.post(`${API}/mall/collect/${booking.booking_id}`, { user_id: booking.user_id });
      if (res.data?.success) {
        toast.success(`Collected ${formatPrc(res.data.collected_prc)} PRC`);
        if (res.data.fulfilled) toast.success(`🎉 ${booking.product_name} fulfilled! Awaiting delivery.`);
        onCollect?.();
        onRefresh?.();
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Collect failed');
    }
  };

  const progress = booking.progress_percent || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-zinc-900/80 to-zinc-950 border border-white/8 rounded-2xl p-4 mb-3"
      data-testid={`mall-booking-card-${booking.booking_id}`}
    >
      <div className="flex items-center gap-3 mb-3">
        {booking.product_image_url ? (
          <img src={booking.product_image_url} className="w-14 h-14 rounded-xl object-cover bg-zinc-800" alt="" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-zinc-800 grid place-items-center">
            <Package className="w-6 h-6 text-amber-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-[15px] truncate">{booking.product_name}</p>
          <p className="text-xs text-zinc-500 tabular-nums">
            {formatPrc(booking.paid_prc)} / {formatPrc(booking.total_prc)} PRC
          </p>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] uppercase tracking-wider font-bold ${meta.bg}`}>
          <Icon className={`w-3 h-3 ${meta.color}`} />
          <span className={meta.color}>{meta.label}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-zinc-900 rounded-full overflow-hidden mb-1">
        <div
          className="h-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all duration-700"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
      <p className="text-[10px] text-zinc-500 tabular-nums mb-3 text-right">{progress.toFixed(1)}%</p>

      {booking.status === 'mining' && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            <div className="bg-zinc-900/70 rounded-lg py-2 border border-white/5">
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1">Rate / Day</p>
              <p className="text-sm font-bold text-amber-400 tabular-nums">{booking.daily_rate_prc} PRC</p>
            </div>
            <div className="bg-zinc-900/70 rounded-lg py-2 border border-white/5">
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1">Session</p>
              <p className="text-sm font-bold text-white tabular-nums" data-testid={`mall-session-prc-${booking.booking_id}`}>
                {liveAccumulated.toFixed(4)}
              </p>
            </div>
            <div className="bg-zinc-900/70 rounded-lg py-2 border border-white/5">
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1">Resets In</p>
              <p className="text-sm font-bold text-zinc-300 tabular-nums">{formatTime(liveRemaining)}</p>
            </div>
          </div>

          <button
            onClick={collect}
            disabled={liveAccumulated < 0.01}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 disabled:from-zinc-700 disabled:to-zinc-800 text-black disabled:text-zinc-500 font-bold py-3 rounded-xl text-sm uppercase tracking-wider transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
            data-testid={`mall-collect-btn-${booking.booking_id}`}
          >
            <Coins className="w-4 h-4" />
            Collect {liveAccumulated > 0 ? liveAccumulated.toFixed(2) : '0.00'} PRC
          </button>

          {liveRemaining <= 60 && liveRemaining > 0 && (
            <p className="flex items-center justify-center gap-1 text-[11px] text-amber-300 mt-2">
              <AlertCircle className="w-3 h-3" /> Session resets soon — collect now!
            </p>
          )}
        </>
      )}

      {booking.status === 'fulfilled' && (
        <p className="text-center text-emerald-300 text-xs mt-1">
          🎉 100% paid! Our team will mark it delivered soon.
        </p>
      )}

      {booking.status === 'delivered' && (
        <p className="text-center text-blue-300 text-xs mt-1">
          📦 Delivered on {booking.delivered_at ? new Date(booking.delivered_at).toLocaleDateString() : '—'}
        </p>
      )}
    </motion.div>
  );
};

const ParasMallBookings = ({ user }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    if (!user?.uid) return;
    try {
      const res = await axios.get(`${API}/mall/my-bookings/${user.uid}`);
      // Enrich with product image_url (1 extra fetch since my-bookings doesn't include it)
      const list = res.data?.bookings || [];
      if (list.length > 0) {
        const productIds = [...new Set(list.map(b => b.product_id))];
        const productsRes = await axios.get(`${API}/mall/products?only_active=false`);
        const productMap = {};
        (productsRes.data?.products || []).forEach(p => { productMap[p.product_id] = p; });
        list.forEach(b => { b.product_image_url = productMap[b.product_id]?.image_url; });
      }
      setBookings(list);
    } catch (e) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    // Periodic refresh every 30s
    const id = setInterval(fetchBookings, 30000);
    return () => clearInterval(id);
  }, [user?.uid]);

  if (loading) {
    return (
      <div className="p-6 text-center text-zinc-500" data-testid="mall-bookings-loading">
        <Sparkles className="w-6 h-6 mx-auto mb-2 animate-pulse text-amber-400" />
        <p className="text-[11px] uppercase tracking-[0.32em]">Loading bookings…</p>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="p-8 text-center" data-testid="mall-bookings-empty">
        <Package className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
        <p className="text-white font-semibold">No bookings yet</p>
        <p className="text-xs text-zinc-500 mt-1">Swipe through Discover to find your first product</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-24" data-testid="mall-bookings-list">
      <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500 mb-3 mt-2">
        {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
      </p>
      {bookings.map((b) => (
        <BookingCard
          key={b.booking_id}
          booking={b}
          onRefresh={fetchBookings}
        />
      ))}
    </div>
  );
};

export default ParasMallBookings;
