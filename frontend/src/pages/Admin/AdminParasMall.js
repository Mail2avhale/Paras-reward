/**
 * Admin — Paras Mall
 * Manage products + view bookings + mark delivered.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { Package, Plus, Edit, Trash2, CheckCircle, Truck, RefreshCw, X, Save, Upload, Image as ImageIcon, Coins, Sparkles, Wand2, Loader2, Star, Copy, MapPin, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { resolveAssetUrl } from '@/utils/resolveAssetUrl';
import OrderPipelineKanban from './components/OrderPipelineKanban';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const STATUS_COLORS = {
  mining: 'bg-amber-100 text-amber-700 border-amber-300',
  fulfilled: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  delivered: 'bg-blue-100 text-blue-700 border-blue-300',
};

// Page sizes — keep tables/grid scannable on typical laptop screens.
const PRODUCT_PAGE_SIZE = 12;
const BOOKING_PAGE_SIZE = 25;

// Compact previous/next paginator. Placed under any long list.
const Paginator = ({ page, totalPages, onChange, testIdPrefix }) => {
  if (totalPages <= 1) return null;
  const go = (p) => onChange(Math.min(Math.max(1, p), totalPages));
  return (
    <div
      className="flex items-center justify-between gap-2 mt-3 px-1"
      data-testid={`${testIdPrefix}-paginator`}
    >
      <button
        onClick={() => go(page - 1)}
        disabled={page <= 1}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
        data-testid={`${testIdPrefix}-paginator-prev`}
      >
        <ChevronLeft className="w-3.5 h-3.5" /> Prev
      </button>
      <span
        className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold tabular-nums"
        data-testid={`${testIdPrefix}-paginator-info`}
      >
        Page {page} <span className="text-slate-300">/</span> {totalPages}
      </span>
      <button
        onClick={() => go(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
        data-testid={`${testIdPrefix}-paginator-next`}
      >
        Next <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// Copy helper — surfaces a toast on success/failure. Used for shipping labels.
const copyText = async (text, label = 'Address') => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  } catch {
    toast.error('Copy failed — please select manually');
  }
};

const AdminParasMall = () => {
  const [tab, setTab] = useState('products');
  // Booking sub-tab: 'pending_delivery' (default) | 'delivered' | 'all'
  const [bookingsTab, setBookingsTab] = useState('pending_delivery');
  const [products, setProducts] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  // Pagination — one page pointer per pageable view. Bookings sub-tab
  // switching resets bookings page to 1 so admins don't land on an empty
  // page when filtering to a smaller bucket.
  const [productsPage, setProductsPage] = useState(1);
  const [bookingsPage, setBookingsPage] = useState(1);
  useEffect(() => { setBookingsPage(1); }, [bookingsTab]);

  // Derived booking lists
  const pendingDeliveryBookings = bookings.filter((b) => b.status === 'fulfilled');
  const deliveredBookings = bookings.filter((b) => b.status === 'delivered');
  const visibleBookings =
    bookingsTab === 'pending_delivery'
      ? pendingDeliveryBookings
      : bookingsTab === 'delivered'
      ? deliveredBookings
      : bookings;

  // Paginated slices — recomputed only when list or page changes.
  const productsTotalPages = Math.max(1, Math.ceil(products.length / PRODUCT_PAGE_SIZE));
  const bookingsTotalPages = Math.max(1, Math.ceil(visibleBookings.length / BOOKING_PAGE_SIZE));
  const productsSlice = useMemo(
    () => products.slice((productsPage - 1) * PRODUCT_PAGE_SIZE, productsPage * PRODUCT_PAGE_SIZE),
    [products, productsPage],
  );
  const bookingsSlice = useMemo(
    () => visibleBookings.slice((bookingsPage - 1) * BOOKING_PAGE_SIZE, bookingsPage * BOOKING_PAGE_SIZE),
    [visibleBookings, bookingsPage],
  );
  // Clamp when the underlying list shrinks (e.g. refresh removes rows).
  useEffect(() => {
    if (productsPage > productsTotalPages) setProductsPage(productsTotalPages);
  }, [productsTotalPages, productsPage]);
  useEffect(() => {
    if (bookingsPage > bookingsTotalPages) setBookingsPage(bookingsTotalPages);
  }, [bookingsTotalPages, bookingsPage]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      // IMPORTANT: Production has 1,400+ active bookings. The default
      // backend limit=200 (sorted by created_at DESC) buries older
      // `fulfilled` (mining complete) and `delivered` rows past the window
      // — admins reported "mining complete" orders never loading.
      // Solution: fan out into three targeted server calls so each pipeline
      // bucket is filtered server-side and the entire fulfilled/delivered
      // history is always visible regardless of recent mining churn.
      const [productsRes, fulfilledRes, deliveredRes, recentRes, analyticsRes] = await Promise.all([
        axios.get(`${API}/mall/products?only_active=false`),
        axios.get(`${API}/admin/mall/bookings?status=fulfilled&limit=500`, { headers }),
        axios.get(`${API}/admin/mall/bookings?status=delivered&limit=500`, { headers }),
        axios.get(`${API}/admin/mall/bookings?limit=300`, { headers }),
        axios.get(`${API}/admin/mall/analytics`, { headers }),
      ]);
      setProducts(productsRes.data?.products || []);
      // Merge buckets — dedupe by booking_id so the "all" tab still has the
      // full union (fulfilled + delivered + recent-mining) without dupes.
      const seen = new Set();
      const merged = [];
      for (const list of [
        fulfilledRes.data?.bookings || [],
        deliveredRes.data?.bookings || [],
        recentRes.data?.bookings || [],
      ]) {
        for (const b of list) {
          if (!seen.has(b.booking_id)) {
            seen.add(b.booking_id);
            merged.push(b);
          }
        }
      }
      // Stable sort: status priority (fulfilled → delivered → mining → other),
      // then most recent first within each bucket so admins see actionable
      // rows at the top of the table.
      const statusRank = { fulfilled: 0, delivered: 1, mining: 2, cancelled: 3 };
      merged.sort((a, b) => {
        const ra = statusRank[a.status] ?? 9;
        const rb = statusRank[b.status] ?? 9;
        if (ra !== rb) return ra - rb;
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
      setBookings(merged);
      setAnalytics(analyticsRes.data || null);
    } catch (e) {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const saveProduct = async (form, isCreate = false) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      if (isCreate) {
        await axios.post(`${API}/admin/mall/products`, form, { headers });
        toast.success('Product created');
      } else {
        await axios.patch(`${API}/admin/mall/products/${form.product_id}`, form, { headers });
        toast.success('Product updated');
      }
      setEditing(null);
      setShowCreate(false);
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    }
  };

  const deleteProduct = async (productId) => {
    if (!window.confirm('Delete this product? This cannot be undone.')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/admin/mall/products/${productId}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Deleted');
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Delete failed');
    }
  };

  const markDelivered = async (booking) => {
    // Show full delivery address for confirmation before marking delivered
    const d = booking.delivery || {};
    const fullAddr = [d.name, d.mobile, d.address_line, d.landmark, d.city, d.state, d.pin_code]
      .filter(Boolean).join('\n');
    if (!d.address_line) {
      toast.error('No delivery address captured for this booking — cannot deliver.');
      return;
    }
    if (!window.confirm(
      `Mark as DELIVERED?\n\nShipping to:\n${fullAddr}\n\nProduct: ${booking.product_name}\nBooking: ${booking.booking_id.slice(0, 8)}...`
    )) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/mall/bookings/${booking.booking_id}/mark-delivered`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Marked delivered + community post created');
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Mark delivered failed');
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto" data-testid="admin-paras-mall">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
            🛍 Paras Mall <span className="text-xs font-normal text-slate-500 uppercase tracking-wider ml-2">Admin</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage shop catalog, view bookings, and process deliveries.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => window.location.assign('/admin/mall/analytics')}
            data-testid="admin-mall-analytics-link"
          >
            📈 Analytics
          </Button>
          <Button variant="outline" onClick={fetchAll} disabled={loading} data-testid="admin-mall-refresh">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Analytics tiles */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-xl p-3 border border-slate-200">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Total Products</p>
            <p className="text-2xl font-bold text-slate-800">{analytics.total_products}</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-slate-200">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Active</p>
            <p className="text-2xl font-bold text-emerald-600">{analytics.active_products}</p>
          </div>
          {['mining', 'fulfilled', 'delivered'].map((s) => (
            <div key={s} className="bg-white rounded-xl p-3 border border-slate-200">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">{s}</p>
              <p className="text-2xl font-bold text-slate-800">{analytics.status_breakdown?.[s]?.count || 0}</p>
            </div>
          )).slice(0, 2)}
        </div>
      )}

      {/* Tab pills */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {['products', 'bookings', 'pipeline'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition flex items-center gap-2 ${
              tab === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
            data-testid={`admin-mall-tab-${t}`}
          >
            {t === 'products'
              ? `Products (${products.length})`
              : t === 'pipeline'
              ? `Order Pipeline`
              : `Bookings (${bookings.length})`}
            {t === 'bookings' && pendingDeliveryBookings.length > 0 && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-900 font-bold animate-pulse"
                title="Pending Delivery"
                data-testid="admin-mall-tab-bookings-pending-badge"
              >
                {pendingDeliveryBookings.length} 📦
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'pipeline' && <OrderPipelineKanban />}

      {tab === 'products' && (
        <div>
          <Button onClick={() => setShowCreate(true)} className="mb-3" data-testid="admin-mall-create-btn">
            <Plus className="w-4 h-4 mr-2" /> New Product
          </Button>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {productsSlice.map((p) => (
              <div key={p.product_id} className="bg-white border border-slate-200 rounded-xl p-3 flex gap-3" data-testid={`admin-mall-product-${p.product_id}`}>
                {p.image_url ? (
                  <img src={resolveAssetUrl(p.image_url)} className="w-20 h-20 object-cover rounded-lg bg-slate-100" alt="" />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-slate-100 grid place-items-center">
                    <ImageIcon className="w-6 h-6 text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">{p.category}</p>
                  <p className="text-sm font-bold text-amber-600 mt-1">₹{p.mrp_inr.toLocaleString('en-IN')}</p>
                  <div className="flex gap-1 mt-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => setEditing(p)} className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 grid place-items-center" data-testid={`admin-mall-edit-${p.product_id}`}>
                    <Edit className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                  <button onClick={() => deleteProduct(p.product_id)} className="w-7 h-7 rounded bg-red-50 hover:bg-red-100 grid place-items-center" data-testid={`admin-mall-delete-${p.product_id}`}>
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Paginator
            page={productsPage}
            totalPages={productsTotalPages}
            onChange={setProductsPage}
            testIdPrefix="admin-mall-products"
          />
        </div>
      )}

      {tab === 'bookings' && (
        <div>
          {/* Booking sub-tabs */}
          <div className="flex gap-2 mb-3 flex-wrap" data-testid="admin-mall-bookings-subtabs">
            {[
              { id: 'pending_delivery', label: 'Pending Delivery', count: pendingDeliveryBookings.length, color: 'bg-amber-500' },
              { id: 'delivered', label: 'Delivered', count: deliveredBookings.length, color: 'bg-blue-600' },
              { id: 'all', label: 'All Bookings', count: bookings.length, color: 'bg-slate-700' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setBookingsTab(st.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-2 ${
                  bookingsTab === st.id
                    ? `${st.color} text-white shadow`
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                }`}
                data-testid={`admin-mall-bookings-subtab-${st.id}`}
              >
                {st.label}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    bookingsTab === st.id ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                  data-testid={`admin-mall-bookings-subtab-${st.id}-count`}
                >
                  {st.count}
                </span>
              </button>
            ))}
          </div>

          {bookingsTab === 'pending_delivery' && (
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3" data-testid="admin-mall-bookings-pending-hint">
              📦 These bookings have collected full PRC and are awaiting your physical dispatch. Click <b>Mark Delivered</b> once shipped.
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Product</th>
                <th className="text-left p-3 min-w-[220px]">Delivery Address</th>
                <th className="text-right p-3">Paid / Total</th>
                <th className="text-right p-3">Progress</th>
                <th className="text-center p-3">Status</th>
                <th className="text-right p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {bookingsSlice.map((b) => {
                const d = b.delivery || {};
                const hasAddress = Boolean(d.address_line);
                const fullAddress = [
                  d.name,
                  d.mobile,
                  d.address_line,
                  d.landmark,
                  [d.city, d.state].filter(Boolean).join(', '),
                  d.pin_code,
                ].filter(Boolean).join('\n');
                return (
                <tr key={b.booking_id} className="border-t border-slate-100 align-top" data-testid={`admin-mall-booking-${b.booking_id}`}>
                  <td className="p-3" data-testid={`admin-mall-booking-user-${b.booking_id}`}>
                    <div className="font-semibold text-slate-800 text-xs">{b.user_name || 'Unknown'}</div>
                    {b.user_mobile && (
                      <div className="text-[10px] text-slate-500 font-mono">{b.user_mobile}</div>
                    )}
                    <div className="text-[9px] text-slate-400 font-mono">{b.user_id?.slice(0, 8)}…</div>
                  </td>
                  <td className="p-3">{b.product_name}</td>
                  <td className="p-3" data-testid={`admin-mall-booking-address-${b.booking_id}`}>
                    {hasAddress ? (
                      <div className="text-[11px] text-slate-700 leading-snug space-y-0.5 max-w-[260px]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-slate-800 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-blue-600 shrink-0" />
                            <span className="truncate">{d.name || '—'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyText(fullAddress, 'Address')}
                            className="text-slate-400 hover:text-blue-600 shrink-0"
                            title="Copy full address"
                            data-testid={`admin-mall-booking-copy-${b.booking_id}`}
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        {d.mobile && (
                          <div className="text-slate-500 font-mono text-[10px]">📞 {d.mobile}</div>
                        )}
                        <div className="text-slate-700">{d.address_line}</div>
                        {d.landmark && (
                          <div className="text-slate-500 text-[10px]">Landmark: {d.landmark}</div>
                        )}
                        <div className="text-slate-600 text-[10px]">
                          {[d.city, d.state].filter(Boolean).join(', ')} <span className="font-bold text-slate-800">{d.pin_code}</span>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1"
                        data-testid={`admin-mall-booking-noaddress-${b.booking_id}`}
                        title="Booking was placed before delivery address was mandatory. Cannot ship."
                      >
                        <AlertTriangle className="w-3 h-3" /> No Address Captured
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right tabular-nums">{Math.round(b.paid_prc)} / {b.total_prc}</td>
                  <td className="p-3 text-right tabular-nums">{b.progress_percent}%</td>
                  <td className="p-3 text-center">
                    <span className={`text-[10px] px-2 py-1 rounded-full border font-bold uppercase ${STATUS_COLORS[b.status]}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {b.status === 'fulfilled' && (
                      <Button
                        size="sm"
                        onClick={() => markDelivered(b)}
                        disabled={!hasAddress}
                        className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-300 disabled:cursor-not-allowed"
                        data-testid={`admin-mall-deliver-${b.booking_id}`}
                        title={hasAddress ? 'Mark this booking as delivered' : 'No delivery address on file — cannot mark delivered'}
                      >
                        <Truck className="w-3 h-3 mr-1" /> Mark Delivered
                      </Button>
                    )}
                  </td>
                </tr>
                );
              })}
              {bookingsSlice.length === 0 && (
                <tr><td colSpan="7" className="p-6 text-center text-slate-400" data-testid="admin-mall-bookings-empty">
                  {bookingsTab === 'pending_delivery'
                    ? 'No bookings pending delivery. Great job! 🎉'
                    : bookingsTab === 'delivered'
                    ? 'No deliveries marked yet.'
                    : 'No bookings yet'}
                </td></tr>
              )}
            </tbody>
          </table>
          </div>
          <Paginator
            page={bookingsPage}
            totalPages={bookingsTotalPages}
            onChange={setBookingsPage}
            testIdPrefix="admin-mall-bookings"
          />
        </div>
      )}

      {(editing || showCreate) && (
        <ProductForm
          initial={editing || { name: '', mrp_inr: 0, category: 'general', image_url: '', description: '', active: true }}
          isCreate={!editing}
          onSave={saveProduct}
          onCancel={() => { setEditing(null); setShowCreate(false); }}
        />
      )}
    </div>
  );
};

const ProductForm = ({ initial, isCreate, onSave, onCancel }) => {
  const [form, setForm] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiImgBusy, setAiImgBusy] = useState(false);
  const fileRef = useRef(null);

  const runAiDraft = async () => {
    if (!aiPrompt.trim()) { toast.error('Type a short product idea first'); return; }
    setAiBusy(true);
    try {
      const token = localStorage.getItem('token');
      const r = await axios.post(
        `${API}/mall/v2/admin/ai-generate-product`,
        { prompt: aiPrompt.trim(), category_hint: form.category || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const draft = r.data?.draft;
      if (draft) {
        setForm((f) => ({
          ...f,
          name: draft.title || f.name,
          description: draft.description || f.description,
          category: draft.category || f.category || 'general',
        }));
        toast.success('AI draft filled — review and Save');
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'AI generation failed');
    } finally {
      setAiBusy(false);
    }
  };

  const runAiImage = async () => {
    const promptForImg = aiPrompt.trim() || form.name;
    if (!promptForImg) { toast.error('Need a product name or AI prompt'); return; }
    setAiImgBusy(true);
    try {
      const token = localStorage.getItem('token');
      const r = await axios.post(
        `${API}/mall/v2/admin/ai-generate-image`,
        { prompt: promptForImg },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (r.data?.image_url) {
        setForm((f) => ({ ...f, image_url: r.data.image_url }));
        toast.success('AI image generated');
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'AI image failed');
    } finally {
      setAiImgBusy(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image too large (max 5 MB)'); return; }
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/admin/mall/upload-image`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.image_url) {
        setForm(f => ({ ...f, image_url: res.data.image_url }));
        const ratio = res.data.compression_ratio;
        toast.success(
          ratio
            ? `Image uploaded, cropped to 1:1 and compressed ${ratio}`
            : 'Image uploaded'
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 max-h-[90vh] overflow-y-auto" data-testid="admin-mall-form">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{isCreate ? 'New Product' : 'Edit Product'}</h3>
          <button onClick={onCancel}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          {/* AI Generate Panel */}
          <div className="bg-gradient-to-br from-violet-50 to-amber-50 border border-violet-200 rounded-lg p-3" data-testid="admin-mall-ai-panel">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-violet-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-violet-700">
                AI Product Assistant (Gemini)
              </span>
            </div>
            <Input
              placeholder="e.g. 65 inch 4K Smart TV, Sony Bravia"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              data-testid="admin-mall-ai-prompt"
              className="bg-white"
            />
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                onClick={runAiDraft}
                disabled={aiBusy}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
                data-testid="admin-mall-ai-draft"
              >
                {aiBusy ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Drafting…</>
                ) : (
                  <><Wand2 className="w-4 h-4 mr-1" /> Generate Title + Description</>
                )}
              </Button>
              <Button
                type="button"
                onClick={runAiImage}
                disabled={aiImgBusy}
                variant="outline"
                className="flex-1 border-amber-400 text-amber-700"
                data-testid="admin-mall-ai-image"
              >
                {aiImgBusy ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Painting…</>
                ) : (
                  <><ImageIcon className="w-4 h-4 mr-1" /> Generate Image</>
                )}
              </Button>
            </div>
            <p className="text-[10px] text-violet-700/70 mt-1.5">
              Tip: write the product idea, then click Generate. Title/Description/Category auto-fill; image saves to /api/static/mall.
            </p>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500">Name</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="admin-mall-form-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500">MRP ₹</label>
              <Input type="number" value={form.mrp_inr} onChange={(e) => setForm({ ...form, mrp_inr: parseInt(e.target.value) || 0 })} data-testid="admin-mall-form-mrp" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500">Category</label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
          </div>

          {/* Product Image — direct upload + optional URL override */}
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500">Product Image</label>
            <div className="mt-1 flex items-center gap-3">
              <div className="w-20 h-20 rounded-lg border border-slate-200 bg-slate-50 grid place-items-center overflow-hidden flex-shrink-0">
                {form.image_url ? (
                  <img src={resolveAssetUrl(form.image_url)} alt="" className="w-full h-full object-cover" data-testid="admin-mall-form-image-preview" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-300" />
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="admin-mall-form-image-file"
                />
                <Button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  variant="outline"
                  className="w-full"
                  data-testid="admin-mall-form-upload-btn"
                >
                  {uploading ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                  ) : (
                    <><Upload className="w-4 h-4 mr-2" /> {form.image_url ? 'Replace Image' : 'Upload Image'}</>
                  )}
                </Button>
                <div className="text-[10px] text-slate-400 mt-1">PNG / JPG / WEBP · max 5 MB · auto-cropped to 1:1</div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500">Description</label>
            <Input value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex items-center justify-between bg-slate-50 rounded p-3">
            <span className="text-sm">Active (visible to users)</span>
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button onClick={onCancel} variant="outline" className="flex-1">Cancel</Button>
          <Button onClick={() => onSave(form, isCreate)} className="flex-1 bg-amber-500 hover:bg-amber-600" data-testid="admin-mall-form-save">
            <Save className="w-4 h-4 mr-2" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminParasMall;
