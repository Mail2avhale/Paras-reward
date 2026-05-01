import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  BarChart3,
  CheckCircle,
  Clock,
  Edit2,
  Eye,
  ExternalLink,
  Megaphone,
  MousePointerClick,
  PauseCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';

import { API } from '../lib/api';

const emptyForm = {
  creator_name: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  platform: 'youtube',
  content_url: '',
  title: '',
  description: '',
  thumbnail_url: '',
  package_id: 'starter',
  package_name: 'Starter Boost',
  price: 999,
  gst_rate: 18,
  duration_days: 3,
  target_audience: '',
  target_regions: '',
  placements: ['dashboard'],
  start_date: '',
  end_date: '',
  status: 'draft',
  payment_status: 'unpaid',
  payment_reference: '',
  notes: '',
  is_featured: false,
};

const statusStyles = {
  draft: 'bg-slate-100 text-slate-700',
  pending_payment: 'bg-amber-100 text-amber-700',
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-orange-100 text-orange-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
};

const paymentStyles = {
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  refunded: 'bg-slate-100 text-slate-700',
};

const placements = ['dashboard', 'rewards', 'community', 'notification', 'featured'];
const platforms = ['youtube', 'instagram', 'facebook', 'other'];
const statuses = ['draft', 'pending_payment', 'active', 'paused', 'completed', 'cancelled'];
const paymentStatuses = ['unpaid', 'partial', 'paid', 'refunded'];

const currency = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const inputClass = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500';

const AdminCreatorPromotions = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [packages, setPackages] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    payment_status: 'all',
    platform: 'all',
    page: 1,
  });

  const totalAmount = useMemo(() => {
    const price = Number(form.price || 0);
    const gstRate = Number(form.gst_rate || 0);
    return price + (price * gstRate / 100);
  }, [form.price, form.gst_rate]);

  const fetchPackages = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/creator-promotions/packages`);
      setPackages(res.data?.packages || []);
    } catch {
      setPackages([]);
    }
  }, []);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const res = await axios.get(`${API}/creator-promotions/admin?${params.toString()}`);
      setCampaigns(res.data?.campaigns || []);
      setSummary(res.data?.summary || {});
      setPagination(res.data?.pagination || { page: 1, total: 0, pages: 1 });
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to load creator promotions');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const applyPackage = (packageId) => {
    const selected = packages.find((pkg) => pkg.package_id === packageId);
    if (!selected) {
      setForm((prev) => ({ ...prev, package_id: packageId }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      package_id: selected.package_id,
      package_name: selected.name,
      price: selected.price,
      duration_days: selected.duration_days,
      placements: selected.placements,
    }));
  };

  const openCreateModal = () => {
    setEditingCampaign(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (campaign) => {
    setEditingCampaign(campaign);
    setForm({
      ...emptyForm,
      ...campaign,
      target_regions: (campaign.target_regions || []).join(', '),
      placements: campaign.placements || ['dashboard'],
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCampaign(null);
  };

  const togglePlacement = (placement) => {
    setForm((prev) => {
      const current = prev.placements || [];
      const next = current.includes(placement)
        ? current.filter((item) => item !== placement)
        : [...current, placement];
      return { ...prev, placements: next.length ? next : ['dashboard'] };
    });
  };

  const buildPayload = () => ({
    ...form,
    price: Number(form.price || 0),
    gst_rate: Number(form.gst_rate || 0),
    duration_days: Number(form.duration_days || 1),
    target_regions: String(form.target_regions || '')
      .split(',')
      .map((region) => region.trim())
      .filter(Boolean),
    placements: form.placements?.length ? form.placements : ['dashboard'],
  });

  const saveCampaign = async (event) => {
    event.preventDefault();
    if (!form.creator_name || !form.title || !form.content_url) {
      toast.error('Creator name, campaign title, and content URL are required');
      return;
    }

    try {
      const payload = buildPayload();
      if (editingCampaign) {
        await axios.put(`${API}/creator-promotions/admin/${editingCampaign.campaign_id}`, payload);
        toast.success('Creator promotion updated');
      } else {
        await axios.post(`${API}/creator-promotions/admin`, payload);
        toast.success('Creator promotion created');
      }
      closeModal();
      fetchCampaigns();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to save campaign');
    }
  };

  const updateStatus = async (campaign, status) => {
    try {
      await axios.patch(`${API}/creator-promotions/admin/${campaign.campaign_id}/status`, {
        status,
        note: `Marked ${status} from admin dashboard`,
      });
      toast.success(`Campaign marked ${status.replace('_', ' ')}`);
      fetchCampaigns();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to update status');
    }
  };

  const deleteCampaign = async (campaign) => {
    if (!window.confirm(`Delete ${campaign.title}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/creator-promotions/admin/${campaign.campaign_id}`);
      toast.success('Campaign deleted');
      fetchCampaigns();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to delete campaign');
    }
  };

  const changeFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: key === 'page' ? value : 1 }));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-100 flex items-center justify-center">
              <Megaphone className="w-6 h-6 text-purple-700" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Creator Promotions</h1>
              <p className="text-sm text-slate-500">Paid creator campaigns, organic discovery, and in-app traffic tracking.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchCampaigns} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm hover:bg-slate-100">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold shadow-sm">
              <Plus className="w-4 h-4" /> New Campaign
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <StatCard icon={Wallet} label="Total Booked" value={currency(summary.total_revenue)} color="text-purple-700" />
          <StatCard icon={CheckCircle} label="Paid Revenue" value={currency(summary.paid_revenue)} color="text-emerald-700" />
          <StatCard icon={Clock} label="Active" value={summary.active || 0} color="text-blue-700" />
          <StatCard icon={Eye} label="Impressions" value={Number(summary.impressions || 0).toLocaleString('en-IN')} color="text-orange-700" />
          <StatCard icon={MousePointerClick} label="Clicks" value={Number(summary.clicks || 0).toLocaleString('en-IN')} color="text-pink-700" />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <label className="relative md:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                value={filters.search}
                onChange={(e) => changeFilter('search', e.target.value)}
                placeholder="Search creator, title, phone, email"
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </label>
            <Select value={filters.status} onChange={(value) => changeFilter('status', value)} options={['all', ...statuses]} />
            <Select value={filters.payment_status} onChange={(value) => changeFilter('payment_status', value)} options={['all', ...paymentStatuses]} />
            <Select value={filters.platform} onChange={(value) => changeFilter('platform', value)} options={['all', ...platforms]} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 flex items-center justify-center text-slate-500">
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Loading campaigns...
            </div>
          ) : campaigns.length === 0 ? (
            <div className="py-16 text-center">
              <Megaphone className="w-14 h-14 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-800">No creator campaigns yet</h3>
              <p className="text-slate-500 text-sm mb-4">Create packages for YouTubers, Reel stars, and local creators.</p>
              <button onClick={openCreateModal} className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold">Create First Campaign</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-3">Campaign</th>
                    <th className="text-left px-4 py-3">Package</th>
                    <th className="text-left px-4 py-3">Amount</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Metrics</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.campaign_id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-4 min-w-[280px]">
                        <div className="font-semibold text-slate-900">{campaign.title}</div>
                        <div className="text-xs text-slate-500 mt-1">{campaign.creator_name} • {campaign.platform}</div>
                        <a href={campaign.content_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-purple-700 mt-2 hover:underline">
                          Open content <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-800">{campaign.package_name}</div>
                        <div className="text-xs text-slate-500">{campaign.duration_days} days • {(campaign.placements || []).join(', ')}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-900">{currency(campaign.total_amount || campaign.price)}</div>
                        <span className={`inline-flex mt-1 px-2 py-1 rounded-full text-xs font-medium ${paymentStyles[campaign.payment_status] || paymentStyles.unpaid}`}>
                          {campaign.payment_status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusStyles[campaign.status] || statusStyles.draft}`}>
                          {campaign.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" /> {campaign.metrics?.impressions || 0}</span>
                          <span className="inline-flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> {campaign.metrics?.clicks || 0}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          {campaign.status !== 'active' && (
                            <IconButton title="Activate" onClick={() => updateStatus(campaign, 'active')} icon={CheckCircle} />
                          )}
                          {campaign.status === 'active' && (
                            <IconButton title="Pause" onClick={() => updateStatus(campaign, 'paused')} icon={PauseCircle} />
                          )}
                          <IconButton title="Edit" onClick={() => openEditModal(campaign)} icon={Edit2} />
                          <IconButton title="Delete" onClick={() => deleteCampaign(campaign)} icon={Trash2} danger />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pagination.pages > 1 && (
          <div className="flex justify-end gap-2 mt-4">
            <button disabled={pagination.page <= 1} onClick={() => changeFilter('page', pagination.page - 1)} className="px-3 py-2 border rounded-lg disabled:opacity-40">Previous</button>
            <span className="px-3 py-2 text-sm text-slate-600">Page {pagination.page} of {pagination.pages}</span>
            <button disabled={pagination.page >= pagination.pages} onClick={() => changeFilter('page', pagination.page + 1)} className="px-3 py-2 border rounded-lg disabled:opacity-40">Next</button>
          </div>
        )}
      </div>

      {showModal && (
        <CampaignModal
          form={form}
          setForm={setForm}
          editingCampaign={editingCampaign}
          packages={packages}
          applyPackage={applyPackage}
          togglePlacement={togglePlacement}
          totalAmount={totalAmount}
          onClose={closeModal}
          onSubmit={saveCampaign}
        />
      )}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
      </div>
      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
    </div>
  </div>
);

const Select = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
  >
    {options.map((option) => (
      <option key={option} value={option}>{option.replace('_', ' ')}</option>
    ))}
  </select>
);

const IconButton = ({ icon: Icon, onClick, title, danger = false }) => (
  <button
    onClick={onClick}
    title={title}
    className={`p-2 rounded-lg border transition-colors ${danger ? 'text-red-600 border-red-100 hover:bg-red-50' : 'text-slate-600 border-slate-200 hover:bg-slate-100'}`}
  >
    <Icon className="w-4 h-4" />
  </button>
);

const CampaignModal = ({
  form,
  setForm,
  editingCampaign,
  packages,
  applyPackage,
  togglePlacement,
  totalAmount,
  onClose,
  onSubmit,
}) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[92vh] overflow-y-auto">
      <form onSubmit={onSubmit}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{editingCampaign ? 'Edit Campaign' : 'New Creator Campaign'}</h2>
            <p className="text-xs text-slate-500">Use this for real creator promotion and in-app discovery packages.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Creator Name *" value={form.creator_name} onChange={(v) => setForm({ ...form, creator_name: v })} />
          <Input label="Contact Name" value={form.contact_name} onChange={(v) => setForm({ ...form, contact_name: v })} />
          <Input label="Phone" value={form.contact_phone} onChange={(v) => setForm({ ...form, contact_phone: v })} />
          <Input label="Email" value={form.contact_email} onChange={(v) => setForm({ ...form, contact_email: v })} />

          <Field label="Platform">
            <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className={inputClass}>
              {platforms.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
            </select>
          </Field>
          <Input label="Content URL *" value={form.content_url} onChange={(v) => setForm({ ...form, content_url: v })} />
          <Input label="Campaign Title *" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <Input label="Thumbnail URL" value={form.thumbnail_url} onChange={(v) => setForm({ ...form, thumbnail_url: v })} />

          <Field label="Package">
            <select value={form.package_id} onChange={(e) => applyPackage(e.target.value)} className={inputClass}>
              {packages.length === 0 && <option value={form.package_id}>{form.package_name}</option>}
              {packages.map((pkg) => <option key={pkg.package_id} value={pkg.package_id}>{pkg.name} - {currency(pkg.price)}</option>)}
            </select>
          </Field>
          <Input label="Package Name" value={form.package_name} onChange={(v) => setForm({ ...form, package_name: v })} />
          <Input type="number" label="Base Price" value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
          <Input type="number" label="GST Rate %" value={form.gst_rate} onChange={(v) => setForm({ ...form, gst_rate: v })} />
          <Input type="number" label="Duration Days" value={form.duration_days} onChange={(v) => setForm({ ...form, duration_days: v })} />
          <div className="rounded-xl border border-purple-100 bg-purple-50 p-3">
            <p className="text-xs text-purple-700">Total with GST</p>
            <p className="text-2xl font-bold text-purple-900">{currency(totalAmount)}</p>
          </div>

          <Field label="Description" className="md:col-span-2">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows="3" className={inputClass} />
          </Field>
          <Input label="Target Audience" value={form.target_audience} onChange={(v) => setForm({ ...form, target_audience: v })} />
          <Input label="Target Regions (comma separated)" value={form.target_regions} onChange={(v) => setForm({ ...form, target_regions: v })} />

          <Field label="Placements" className="md:col-span-2">
            <div className="flex flex-wrap gap-2">
              {placements.map((placement) => (
                <button
                  key={placement}
                  type="button"
                  onClick={() => togglePlacement(placement)}
                  className={`px-3 py-2 rounded-xl text-sm border ${form.placements?.includes(placement) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200'}`}
                >
                  {placement}
                </button>
              ))}
            </div>
          </Field>

          <Input type="date" label="Start Date" value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} />
          <Input type="date" label="End Date" value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} />

          <Field label="Campaign Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputClass}>
              {statuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Payment Status">
            <select value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })} className={inputClass}>
              {paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </Field>

          <Input label="Payment Reference" value={form.payment_reference} onChange={(v) => setForm({ ...form, payment_reference: v })} />
          <label className="flex items-center gap-2 mt-7">
            <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
            <span className="text-sm font-medium text-slate-700">Featured Campaign</span>
          </label>
          <Field label="Internal Notes" className="md:col-span-2">
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="3" className={inputClass} />
          </Field>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-4 flex justify-end gap-2 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-xl text-sm">Cancel</button>
          <button type="submit" className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold">
            {editingCampaign ? 'Save Changes' : 'Create Campaign'}
          </button>
        </div>
      </form>
    </div>
  </div>
);

const Field = ({ label, children, className = '' }) => (
  <label className={className}>
    <span className="block text-xs font-semibold text-slate-600 mb-1">{label}</span>
    {children}
  </label>
);

const Input = ({ label, value, onChange, type = 'text' }) => (
  <Field label={label}>
    <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} className={inputClass} />
  </Field>
);

export default AdminCreatorPromotions;
