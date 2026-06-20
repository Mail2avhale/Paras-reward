/**
 * Admin — Paras Mall
 * Manage products + view bookings + mark delivered.
 */
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Package, Plus, Edit, Trash2, CheckCircle, Truck, RefreshCw, X, Save, Upload, Image as ImageIcon, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const STATUS_COLORS = {
  mining: 'bg-amber-100 text-amber-700 border-amber-300',
  fulfilled: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  delivered: 'bg-blue-100 text-blue-700 border-blue-300',
};

const AdminParasMall = () => {
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [productsRes, bookingsRes, analyticsRes] = await Promise.all([
        axios.get(`${API}/mall/products?only_active=false`),
        axios.get(`${API}/admin/mall/bookings`, { headers }),
        axios.get(`${API}/admin/mall/analytics`, { headers }),
      ]);
      setProducts(productsRes.data?.products || []);
      setBookings(bookingsRes.data?.bookings || []);
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

  const markDelivered = async (bookingId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/mall/bookings/${bookingId}/mark-delivered`, {}, {
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
        <Button variant="outline" onClick={fetchAll} disabled={loading} data-testid="admin-mall-refresh">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
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
      <div className="flex gap-2 mb-5">
        {['products', 'bookings'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
              tab === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
            data-testid={`admin-mall-tab-${t}`}
          >
            {t === 'products' ? `Products (${products.length})` : `Bookings (${bookings.length})`}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <div>
          <Button onClick={() => setShowCreate(true)} className="mb-3" data-testid="admin-mall-create-btn">
            <Plus className="w-4 h-4 mr-2" /> New Product
          </Button>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.map((p) => (
              <div key={p.product_id} className="bg-white border border-slate-200 rounded-xl p-3 flex gap-3" data-testid={`admin-mall-product-${p.product_id}`}>
                {p.image_url ? (
                  <img src={p.image_url} className="w-20 h-20 object-cover rounded-lg bg-slate-100" alt="" />
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
        </div>
      )}

      {tab === 'bookings' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Product</th>
                <th className="text-right p-3">Paid / Total</th>
                <th className="text-right p-3">Progress</th>
                <th className="text-center p-3">Status</th>
                <th className="text-right p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.booking_id} className="border-t border-slate-100" data-testid={`admin-mall-booking-${b.booking_id}`}>
                  <td className="p-3 font-mono text-xs">{b.user_id.slice(0, 8)}…</td>
                  <td className="p-3">{b.product_name}</td>
                  <td className="p-3 text-right tabular-nums">{Math.round(b.paid_prc)} / {b.total_prc}</td>
                  <td className="p-3 text-right tabular-nums">{b.progress_percent}%</td>
                  <td className="p-3 text-center">
                    <span className={`text-[10px] px-2 py-1 rounded-full border font-bold uppercase ${STATUS_COLORS[b.status]}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {b.status === 'fulfilled' && (
                      <Button size="sm" onClick={() => markDelivered(b.booking_id)} className="bg-blue-600 hover:bg-blue-700 text-white" data-testid={`admin-mall-deliver-${b.booking_id}`}>
                        <Truck className="w-3 h-3 mr-1" /> Mark Delivered
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr><td colSpan="6" className="p-6 text-center text-slate-400">No bookings yet</td></tr>
              )}
            </tbody>
          </table>
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
  const fileRef = useRef(null);

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
        toast.success('Image uploaded');
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
                  <img src={form.image_url} alt="" className="w-full h-full object-cover" data-testid="admin-mall-form-image-preview" />
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
                <div className="text-[10px] text-slate-400 mt-1">PNG / JPG / WEBP · max 5 MB</div>
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
