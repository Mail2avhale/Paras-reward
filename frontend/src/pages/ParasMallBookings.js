/**
 * Paras Mall — My Bookings list with live per-booking mining widget.
 * Each booking has its own 24-hour session ticker and Collect button.
 */
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Coins, Clock, Package, CheckCircle, Truck, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { resolveAssetUrl } from '@/utils/resolveAssetUrl';
import RewardedAdPrompt from '@/components/RewardedAdPrompt';
import ForcedAdInterstitial from '@/components/ForcedAdInterstitial';

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

  // Live counter tick — only when session is active
  const sessionActive = !!booking.session_active;
  const [liveAccumulated, setLiveAccumulated] = useState(booking.session_accumulated_prc || 0);
  const [liveRemaining, setLiveRemaining] = useState(booking.session_remaining_seconds || 0);
  const [liveCooldown, setLiveCooldown] = useState(booking.cooldown_remaining_seconds || 0);
  const [starting, setStarting] = useState(false);
  const [adPromptOpen, setAdPromptOpen] = useState(false);
  // Forced ad interstitial — opens automatically AFTER product PRC is
  // collected. Mirrors the dashboard Mining Widget flow so the AdMob
  // rewarded video plays directly per Google policy.
  const [forcedAdOpen, setForcedAdOpen] = useState(false);
  const tickRef = useRef(null);
  const cooldownRef = useRef(null);

  useEffect(() => {
    setLiveAccumulated(booking.session_accumulated_prc || 0);
    setLiveRemaining(booking.session_remaining_seconds || 0);
    setLiveCooldown(booking.cooldown_remaining_seconds || 0);
  }, [booking.session_accumulated_prc, booking.session_remaining_seconds, booking.cooldown_remaining_seconds]);

  // Active-session mining tick: accumulate PRC every second
  useEffect(() => {
    if (booking.status !== 'mining' || !sessionActive) return;
    const perSec = booking.per_second_prc || 0;
    tickRef.current = setInterval(() => {
      setLiveAccumulated((prev) => prev + perSec);
      setLiveRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [booking.status, booking.per_second_prc, sessionActive]);

  // Cooldown tick — counts down to zero, then auto-refresh so server can
  // expose can_start_session=true. Mirrors the main mining 60s cooldown.
  useEffect(() => {
    if (sessionActive || booking.status !== 'mining' || liveCooldown <= 0) return;
    cooldownRef.current = setInterval(() => {
      setLiveCooldown((c) => {
        if (c <= 1) {
          clearInterval(cooldownRef.current);
          // Pull fresh booking state from server so Start Session enables
          onRefresh?.();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(cooldownRef.current);
  }, [sessionActive, booking.status, liveCooldown, onRefresh]);

  const performCollect = async () => {
    try {
      const res = await axios.post(`${API}/mall/collect/${booking.booking_id}`, { user_id: booking.user_id });
      if (res.data?.success) {
        toast.success(`Collected ${formatPrc(res.data.collected_prc)} PRC`);
        if (res.data.fulfilled) toast.success(`🎉 ${booking.product_name} fulfilled! Awaiting delivery.`);
        // Reflect cooldown state immediately so UI swaps to "Start Session" pending
        setLiveCooldown(res.data.cooldown_seconds || 0);
        onCollect?.();
        onRefresh?.();
        // ── Direct rewarded ad (Jun 24, 2026) ─────────────────────
        // Primary product PRC has just been credited. Now show the
        // direct AdMob rewarded video for a bonus, matching the
        // dashboard Mining Widget flow.
        setForcedAdOpen(true);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Collect failed');
    }
  };

  // Direct-collect (no intermediate opt-in modal — the ad screen runs
  // AUTOMATICALLY right after the primary collect succeeds).
  const collect = () => {
    if (liveAccumulated < 0.01) return;
    performCollect();
  };

  const startSession = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const res = await axios.post(`${API}/mall/start-session/${booking.booking_id}`, { user_id: booking.user_id });
      if (res.data?.success) {
        toast.success('New mining session started');
        onRefresh?.();
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not start session');
    } finally {
      setStarting(false);
    }
  };

  const progress = booking.progress_percent || 0;
  // Session progress: 24h cycle (86400 sec). 0% at session start, 100% at reset.
  const sessionElapsed = Math.max(0, 86400 - (liveRemaining || 0));
  const sessionProgress = sessionActive ? Math.min(100, (sessionElapsed / 86400) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-zinc-900/80 to-zinc-950 border border-white/8 rounded-2xl p-4 mb-3"
      data-testid={`mall-booking-card-${booking.booking_id}`}
    >
      <div className="flex items-center gap-3 mb-3">
        {booking.product_image_url ? (
          <img src={resolveAssetUrl(booking.product_image_url)} className="w-14 h-14 rounded-xl object-cover bg-zinc-800" alt="" />
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

      {/* PRODUCT PROGRESS — enhanced visual with numbers + gradient + estimated days */}
      <div
        className="rounded-xl p-3 mb-3 relative overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
            Product Progress
          </span>
          <span
            className="font-mono text-lg font-bold tabular-nums"
            style={{
              color: progress < 30 ? '#f87171' : progress < 70 ? '#fbbf24' : '#34d399',
            }}
            data-testid={`mall-progress-percent-${booking.booking_id}`}
          >
            {progress.toFixed(1)}%
          </span>
        </div>

        {/* Numbers row */}
        <div className="flex items-baseline justify-center gap-1.5 mb-2 font-mono tabular-nums">
          <span className="text-amber-400 text-base font-bold">
            {formatPrc(Math.floor(booking.paid_prc || 0))}
          </span>
          <span className="text-zinc-500 text-sm">/</span>
          <span className="text-zinc-400 text-sm">
            {formatPrc(booking.total_prc)} PRC
          </span>
        </div>

        {/* Gradient progress bar */}
        <div
          className="h-2.5 rounded-full overflow-hidden relative"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <motion.div
            className="h-full rounded-full relative"
            animate={{ width: `${Math.min(100, progress)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              background:
                progress < 30
                  ? 'linear-gradient(90deg, #ef4444, #f87171)'
                  : progress < 70
                  ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                  : 'linear-gradient(90deg, #10b981, #34d399)',
              boxShadow: `0 0 10px ${
                progress < 30 ? 'rgba(239,68,68,0.4)' : progress < 70 ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'
              }`,
            }}
          >
            {booking.status === 'mining' && progress < 100 && (
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                  animation: 'shimmerSlide 2s linear infinite',
                }}
              />
            )}
          </motion.div>
        </div>

        {/* Stats row: collected + remaining */}
        <div className="flex justify-between items-center mt-2 text-[10px] font-mono tabular-nums">
          <span className="text-emerald-400 inline-flex items-center gap-1">
            <span className="text-emerald-500">✓</span>
            Collected: <strong>{formatPrc(Math.floor(booking.paid_prc || 0))}</strong>
          </span>
          <span className="text-zinc-400 inline-flex items-center gap-1">
            Remaining: <strong>{formatPrc(Math.max(0, Math.floor((booking.total_prc || 0) - (booking.paid_prc || 0))))}</strong>
          </span>
        </div>

        {/* Estimated days to fulfill (only when mining) */}
        {booking.status === 'mining' && booking.daily_rate_prc > 0 && progress < 100 && (
          <p className="text-[10px] text-zinc-500 text-center mt-1.5">
            ⏱ At current rate (~
            {Number(booking.daily_rate_prc).toLocaleString('en-IN')} PRC/day),
            <strong className="text-amber-400 ml-1">
              {Math.ceil(((booking.total_prc || 0) - (booking.paid_prc || 0)) / (booking.daily_rate_prc || 1))} days
            </strong>{' '}
            to fulfill
          </p>
        )}
      </div>

      {booking.status === 'mining' && (
        <>
          {/* Time Remaining — digit boxes (Dashboard-style) */}
          <p className="text-zinc-400 text-xs text-center mb-2">Resets In</p>
          <div className="flex items-center justify-center gap-0.5 mb-3">
            {formatTime(liveRemaining).split('').map((char, i) => (
              <div
                key={i}
                className={char === ':' ? 'w-3 text-center' : 'w-7 h-9 rounded-md flex items-center justify-center'}
                style={char !== ':' ? { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' } : {}}
              >
                <span
                  className={`font-mono font-bold ${char === ':' ? 'text-base text-amber-400' : 'text-lg text-zinc-100'}`}
                >{char}</span>
              </div>
            ))}
          </div>

          {/* Session Earnings — digit boxes */}
          <div
            className="rounded-xl p-3 mb-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p className="text-zinc-500 text-xs text-center mb-2">Session Earnings</p>
            <div className="flex items-center justify-center gap-1 flex-wrap">
              <Coins className="w-4 h-4 mr-1 text-amber-400" />
              {liveAccumulated.toFixed(2).split('').map((char, i) => (
                <motion.div
                  key={`${i}-${char}`}
                  className={char === '.' ? 'w-2 flex items-end justify-center pb-0.5' : 'w-6 h-8 rounded-md flex items-center justify-center'}
                  style={char !== '.' ? { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,158,11,0.3)' } : {}}
                  initial={{ y: -3, opacity: 0.6 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <span className="font-mono font-bold text-base text-amber-400">{char}</span>
                </motion.div>
              ))}
              <span className="font-semibold text-sm ml-1 text-amber-400">PRC</span>
            </div>

            {/* PRC/SEC + PRC/HOUR — twin pills */}
            <div className="flex items-center justify-center gap-2 mt-3">
              <div
                className="rounded-lg px-3 py-1.5 text-center flex-1"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                <p className="text-emerald-400 text-xs font-bold font-mono leading-tight">
                  +{((booking.per_second_prc || 0)).toFixed(4)}
                </p>
                <p className="text-emerald-300/60 text-[9px] font-semibold tracking-wider mt-0.5">PRC/SEC</p>
              </div>
              <div
                className="rounded-lg px-3 py-1.5 text-center flex-1"
                style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.33)' }}
              >
                <p className="text-amber-300 text-xs font-bold font-mono leading-tight">
                  {Number(booking.daily_rate_prc || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-amber-300/70 text-[9px] font-semibold tracking-wider mt-0.5">PRC/DAY</p>
              </div>
            </div>

            {/* Session Progress bar */}
            <div className="mt-3">
              <div className="flex justify-between text-[11px] text-zinc-500 mb-1">
                <span>Session Progress</span>
                <span className="font-mono text-amber-400">{sessionProgress.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <motion.div
                  className="h-full rounded-full"
                  animate={{ width: `${sessionProgress}%` }}
                  transition={{ duration: 0.5 }}
                  style={{
                    background: 'linear-gradient(90deg, #f59e0b, #f59e0bcc)',
                    boxShadow: '0 0 8px rgba(245,158,11,0.4)',
                  }}
                />
              </div>
            </div>
          </div>

          <button
            onClick={collect}
            disabled={!sessionActive || liveAccumulated < 0.01}
            className={`w-full ${
              sessionActive
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 disabled:from-zinc-700 disabled:to-zinc-800 text-black disabled:text-zinc-500'
                : 'hidden'
            } font-bold py-3 rounded-xl text-sm uppercase tracking-wider transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            data-testid={`mall-collect-btn-${booking.booking_id}`}
          >
            <Coins className="w-4 h-4" />
            Collect {liveAccumulated > 0 ? liveAccumulated.toFixed(2) : '0.00'} PRC
          </button>

          {/* Cooldown timer — shown after Collect, before Start Session unlocks */}
          {!sessionActive && liveCooldown > 0 && (
            <div
              className="w-full bg-zinc-900/80 border border-amber-500/20 rounded-xl py-3 px-4 flex items-center justify-center gap-3"
              data-testid={`mall-cooldown-${booking.booking_id}`}
            >
              <div className="w-9 h-9 rounded-full border-2 border-amber-500/40 grid place-items-center text-amber-300 font-bold tabular-nums text-sm">
                {liveCooldown}
              </div>
              <div className="text-left">
                <p className="text-[11px] uppercase tracking-wider text-zinc-400">Cooldown</p>
                <p className="text-xs text-amber-300/90 font-medium">Next session in {liveCooldown}s</p>
              </div>
            </div>
          )}

          {/* Start Session — manual restart after cooldown */}
          {!sessionActive && liveCooldown === 0 && (
            <button
              onClick={startSession}
              disabled={starting}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:from-emerald-400 hover:to-emerald-500 shadow-lg shadow-emerald-500/20"
              data-testid={`mall-start-session-btn-${booking.booking_id}`}
            >
              {starting ? (
                <>Starting…</>
              ) : (
                <>
                  <Coins className="w-4 h-4" />
                  Start New Mining Session
                </>
              )}
            </button>
          )}

          {sessionActive && liveRemaining <= 60 && liveRemaining > 0 && (
            <p className="flex items-center justify-center gap-1 text-[11px] text-amber-300 mt-2">
              <AlertCircle className="w-3 h-3" /> Session ending soon — collect now!
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

      {/* Rewarded-ad opt-in: legacy — kept mounted but no longer triggered. */}
      <RewardedAdPrompt
        open={adPromptOpen}
        placement="mall_collect"
        title="Earn Bonus PRC"
        onClose={() => setAdPromptOpen(false)}
        onSkip={performCollect}
        onComplete={performCollect}
      />
      {/* Direct rewarded ad — auto-plays after a successful product collect. */}
      <ForcedAdInterstitial
        open={forcedAdOpen}
        placement="mall_collect"
        onClose={() => setForcedAdOpen(false)}
      />
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
