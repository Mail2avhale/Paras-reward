/**
 * Admin — Partner Stores Management (Paras Reward v2.0, Feb 2026)
 * ================================================================
 * Admin creates + verifies Partner Store logins. No public registration.
 * Endpoints under /api/v2/partner-stores/admin/*. Requires X-Admin-Pin.
 */
import React, { useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '../lib/api';
import {
  Store, Search, CheckCircle2, XCircle, PauseCircle,
  Plus, Users, MapPin, Phone, IdCard, RefreshCw,
} from 'lucide-react';

const STATUS_META = {
  pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700 border-amber-300' },
  verified:  { label: 'Verified',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  rejected:  { label: 'Rejected',  cls: 'bg-rose-100 text-rose-700 border-rose-300' },
  suspended: { label: 'Suspended', cls: 'bg-slate-200 text-slate-600 border-slate-300' },
};

export default function AdminPartnerStores() {
  const [pin, setPin] = useState('');
  const [stores, setStores] = useState([]);
  const [countByStatus, setCountByStatus] = useState({});
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    business_name: '', owner_name: '', mobile_number: '', login_pin: '',
    email: '', address: '', aadhaar_number: '', pan_number: '',
    bank_account_number: '', bank_ifsc: '', bank_account_holder: '',
    business_type: '', gps_lat: '', gps_lng: '',
  });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (append = false) => {
    if (!pin) { toast.error('Enter admin PIN first'); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (search.trim()) params.set('search', search.trim());
      if (append && nextCursor) params.set('cursor', nextCursor);
      params.set('limit', '50');
      const res = await axios.get(`${API}/v2/partner-stores/admin/list?${params}`, {
        headers: { 'X-Admin-Pin': pin },
      });
      if (res.data.success) {
        setStores(prev => append ? [...prev, ...res.data.stores] : res.data.stores);
        setNextCursor(res.data.next_cursor);
        setHasMore(res.data.has_more);
        setCountByStatus(res.data.count_by_status || {});
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load partner stores');
    } finally {
      setLoading(false);
    }
  }, [pin, filterStatus, search, nextCursor]);

  const handleCreate = async () => {
    if (!pin) { toast.error('Enter admin PIN first'); return; }
    if (!/^\d{10}$/.test(form.mobile_number)) { toast.error('Mobile must be 10 digits'); return; }
    if (!/^\d{6}$/.test(form.login_pin)) { toast.error('Login PIN must be 6 digits'); return; }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.bank_ifsc)) { toast.error('Invalid IFSC (e.g. HDFC0001234)'); return; }
    setCreating(true);
    try {
      const payload = {
        admin_pin: pin,
        ...form,
        gps_lat: form.gps_lat ? parseFloat(form.gps_lat) : undefined,
        gps_lng: form.gps_lng ? parseFloat(form.gps_lng) : undefined,
      };
      // Strip empty optional strings so backend Pydantic treats them as absent
      ['email', 'aadhaar_number', 'pan_number', 'business_type'].forEach(k => {
        if (!payload[k]) delete payload[k];
      });
      const res = await axios.post(`${API}/v2/partner-stores/admin/create`, payload);
      if (res.data.success) {
        toast.success(`Store ${res.data.store_id} created — verify to activate`);
        setShowCreate(false);
        setForm({
          business_name: '', owner_name: '', mobile_number: '', login_pin: '',
          email: '', address: '', aadhaar_number: '', pan_number: '',
          bank_account_number: '', bank_ifsc: '', bank_account_holder: '',
          business_type: '', gps_lat: '', gps_lng: '',
        });
        load();
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create store');
    } finally {
      setCreating(false);
    }
  };

  const doAction = async (storeId, action) => {
    if (!pin) { toast.error('Enter admin PIN first'); return; }
    const remark = action !== 'verify' ? window.prompt(`Reason for ${action}?`) || '' : '';
    try {
      const res = await axios.post(`${API}/v2/partner-stores/admin/verify`, {
        admin_pin: pin, store_id: storeId, action, remark,
      });
      if (res.data.success) {
        toast.success(`Store ${storeId} → ${res.data.verification_status}`);
        load();
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || `${action} failed`);
    }
  };

  const totalStores = useMemo(
    () => Object.values(countByStatus).reduce((a, b) => a + b, 0),
    [countByStatus]
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6" data-testid="admin-partner-stores-page">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Store className="w-7 h-7 text-indigo-600" />
          <h1 className="text-2xl font-bold text-slate-800">Partner Stores</h1>
          <span className="ml-auto text-xs text-slate-500 font-medium tabular-nums">{totalStores} total</span>
        </div>

        {/* Admin PIN Gate */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 mb-4">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Admin Operation PIN</label>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              data-testid="ps-admin-pin-input"
            />
            <button
              onClick={() => load()}
              disabled={loading}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
              data-testid="ps-load-btn"
            >
              {loading ? 'Loading…' : 'Load'}
            </button>
          </div>
        </div>

        {/* Status Chips */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {['', 'pending', 'verified', 'rejected', 'suspended'].map(s => (
            <button
              key={s || 'all'}
              onClick={() => { setFilterStatus(s); setNextCursor(null); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ${
                filterStatus === s
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              data-testid={`ps-filter-${s || 'all'}`}
            >
              {s ? `${STATUS_META[s]?.label || s} (${countByStatus[s] || 0})` : `All (${totalStores})`}
            </button>
          ))}
          <div className="flex-1" />
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search business/owner/address"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setNextCursor(null), load())}
              className="pl-9 pr-3 py-1.5 border border-slate-300 rounded-full text-xs bg-white w-64"
              data-testid="ps-search-input"
            />
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="ml-2 px-4 py-1.5 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 hover:bg-emerald-500"
            data-testid="ps-toggle-create-btn"
          >
            <Plus className="w-3.5 h-3.5" /> New Store
          </button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="bg-white rounded-xl p-5 border border-emerald-200 mb-4" data-testid="ps-create-form">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Onboard New Partner Store</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                ['business_name', 'Business Name *', 'text', 'e.g. Sharma Kirana Store'],
                ['owner_name', 'Owner Name *', 'text', 'Full name'],
                ['mobile_number', 'Mobile Number * (10 digits)', 'tel', '8888800001'],
                ['login_pin', 'Login PIN * (6 digits)', 'password', '******'],
                ['email', 'Email', 'email', 'optional'],
                ['address', 'Address *', 'text', 'Full shop address'],
                ['aadhaar_number', 'Aadhaar (12 digits, optional)', 'text', '123456789012'],
                ['pan_number', 'PAN (optional)', 'text', 'ABCDE1234F'],
                ['bank_account_number', 'Bank Account No *', 'text', ''],
                ['bank_ifsc', 'IFSC *', 'text', 'HDFC0001234'],
                ['bank_account_holder', 'Bank Account Holder *', 'text', ''],
                ['business_type', 'Business Type', 'text', 'Grocery / Cafe / Salon...'],
                ['gps_lat', 'GPS Lat (optional)', 'number', '21.1458'],
                ['gps_lng', 'GPS Lng (optional)', 'number', '79.0882'],
              ].map(([key, label, type, ph]) => (
                <div key={key}>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">{label}</label>
                  <input
                    type={type}
                    placeholder={ph}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm"
                    data-testid={`ps-form-${key}`}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg text-sm disabled:opacity-60"
              data-testid="ps-create-submit-btn"
            >
              {creating ? 'Creating…' : 'Create Partner Store Login'}
            </button>
          </div>
        )}

        {/* Store List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid="ps-list-card">
          {stores.length === 0 ? (
            <div className="text-center py-14 text-slate-400 text-sm">
              {loading ? 'Loading…' : 'No stores. Enter PIN and click Load.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="ps-list-table">
                <thead className="text-xs text-slate-500 uppercase border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="text-left p-3">Store ID</th>
                    <th className="text-left p-3">Business</th>
                    <th className="text-left p-3">Owner</th>
                    <th className="text-left p-3">Mobile</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stores.map((s) => (
                    <tr key={s.store_id} className="hover:bg-slate-50" data-testid={`ps-row-${s.store_id}`}>
                      <td className="p-3 font-mono text-xs text-slate-800">{s.store_id}</td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{s.business_name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {s.address?.slice(0, 40)}{s.address?.length > 40 ? '…' : ''}
                        </div>
                      </td>
                      <td className="p-3 text-slate-700">
                        <div className="flex items-center gap-1"><Users className="w-3 h-3 text-slate-400" /> {s.owner_name}</div>
                        {s.business_type && (
                          <div className="text-[11px] text-slate-500 mt-0.5">{s.business_type}</div>
                        )}
                      </td>
                      <td className="p-3 text-slate-700">
                        <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> {s.mobile_number}</div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold ${STATUS_META[s.verification_status]?.cls || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                          {STATUS_META[s.verification_status]?.label || s.verification_status}
                        </span>
                        {s.aadhaar_number && (
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1"><IdCard className="w-3 h-3" /> Aadhaar ✓</div>
                        )}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {s.verification_status === 'pending' && (
                          <button
                            onClick={() => doAction(s.store_id, 'verify')}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold"
                            data-testid={`ps-verify-${s.store_id}`}
                          >
                            <CheckCircle2 className="w-3 h-3" /> Verify
                          </button>
                        )}
                        {['pending', 'verified'].includes(s.verification_status) && (
                          <button
                            onClick={() => doAction(s.store_id, 'suspend')}
                            className="ml-1 inline-flex items-center gap-1 px-2 py-1 bg-amber-500 hover:bg-amber-400 text-white rounded text-[11px] font-bold"
                            data-testid={`ps-suspend-${s.store_id}`}
                          >
                            <PauseCircle className="w-3 h-3" /> Suspend
                          </button>
                        )}
                        {s.verification_status !== 'rejected' && (
                          <button
                            onClick={() => doAction(s.store_id, 'reject')}
                            className="ml-1 inline-flex items-center gap-1 px-2 py-1 bg-rose-500 hover:bg-rose-400 text-white rounded text-[11px] font-bold"
                            data-testid={`ps-reject-${s.store_id}`}
                          >
                            <XCircle className="w-3 h-3" /> Reject
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hasMore && (
                <button
                  onClick={() => load(true)}
                  disabled={loading}
                  className="w-full py-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 border-t border-slate-200 flex items-center justify-center gap-2"
                  data-testid="ps-load-more-btn"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Load more
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
