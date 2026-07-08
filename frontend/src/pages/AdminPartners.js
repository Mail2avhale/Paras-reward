/**
 * Admin — Partner Positions Management (Feb 6 2026)
 * ===================================================
 * Admin assigns multi-tier partner positions to users. Backed by
 * /api/admin/partners/* endpoints. Requires ADMIN_OPERATION_PIN.
 */
import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '../lib/api';
import { UserCog, Search, Trash2, Users, TrendingUp } from 'lucide-react';

const POSITION_OPTIONS = [
  { value: 'user',                    label: 'User (default)',            levels: 3, cap: 500 },
  { value: 'district_partner',        label: 'District Partner',          levels: 4, cap: 1000 },
  { value: 'regional_state_partner',  label: 'Regional State Partner',    levels: 5, cap: 2000 },
  { value: 'state_partner',           label: 'State Partner',             levels: 6, cap: 4000 },
  { value: 'national_partner',        label: 'National Partner',          levels: 7, cap: 8000 },
];

export default function AdminPartners({ user, onLogout }) {
  const [pin, setPin] = useState('');
  const [query, setQuery] = useState('');
  const [selectedPos, setSelectedPos] = useState('district_partner');
  const [assigning, setAssigning] = useState(false);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPartners = useCallback(async () => {
    if (!pin || pin.length < 4) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/partners/list`, {
        headers: { 'X-Admin-Pin': pin },
      });
      setPartners(res.data?.partners || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load partners');
    } finally {
      setLoading(false);
    }
  }, [pin]);

  const assign = async () => {
    if (!pin || pin.length < 4) { toast.error('Enter admin operation PIN'); return; }
    if (!query || query.length < 3) { toast.error('Enter mobile / email / uid'); return; }
    setAssigning(true);
    try {
      const res = await axios.post(
        `${API}/admin/partners/assign`,
        {
          admin_id: user?.uid || 'admin',
          query,
          position: selectedPos,
        },
        { headers: { 'X-Admin-Pin': pin } }
      );
      toast.success(res.data?.message || 'Position assigned', { duration: 4000 });
      setQuery('');

      // Optimistic list update — merge/replace the newly-assigned partner
      // into local state so the table refreshes without a race on the
      // follow-up GET (which sometimes returns stale reads under load).
      const u = res.data?.user;
      if (u && u.new_position && u.new_position !== 'user') {
        setPartners(prev => {
          const filtered = prev.filter(p => p.uid !== u.uid);
          return [
            {
              uid: u.uid,
              name: u.name,
              mobile: u.mobile,
              partner_position: u.new_position,
              position_label: u.config?.label || u.new_position,
              subscription_plan: u.subscription_plan,
              partner_position_assigned_at: new Date().toISOString(),
              partner_position_assigned_by: user?.uid || 'admin',
            },
            ...filtered,
          ];
        });
      }
      // Still fire a background refresh to reconcile with server truth.
      fetchPartners();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to assign position');
    } finally {
      setAssigning(false);
    }
  };

  const revoke = async (uid, name) => {
    if (!window.confirm(`Revert ${name} back to User position?`)) return;
    try {
      await axios.post(
        `${API}/admin/partners/revoke`,
        { admin_id: user?.uid || 'admin', uid },
        { headers: { 'X-Admin-Pin': pin } }
      );
      toast.success(`${name} → User`);
      // Optimistic removal from local list, then background sync.
      setPartners(prev => prev.filter(p => p.uid !== uid));
      fetchPartners();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to revoke position');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="max-w-5xl mx-auto px-4 pt-6">
        <div className="flex items-center gap-3 mb-6">
          <UserCog className="w-7 h-7 text-indigo-600" />
          <h1 className="text-2xl font-bold text-slate-800">Partners Management</h1>
        </div>

        {/* PIN + Refresh */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 mb-5" data-testid="partners-pin-card">
          <label className="text-xs font-semibold text-slate-700 mb-2 block">
            Admin Operation PIN <span className="text-rose-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="Enter ADMIN_OPERATION_PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              data-testid="partners-admin-pin-input"
            />
            <button
              onClick={fetchPartners}
              disabled={loading || pin.length < 4}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              data-testid="partners-refresh-btn"
            >
              {loading ? 'Loading…' : 'Load Partners'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Required for all Partner assign/revoke/list operations.</p>
        </div>

        {/* Assign Form */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 mb-6" data-testid="assign-partner-card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-800">Assign / Promote Partner</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                User Identifier (mobile / email / uid)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. 9970100782 or user@example.com"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
                  data-testid="assign-partner-query-input"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Position</label>
              <select
                value={selectedPos}
                onChange={(e) => setSelectedPos(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                data-testid="assign-partner-position-select"
              >
                {POSITION_OPTIONS.map(p => (
                  <option key={p.value} value={p.value}>
                    {p.label} — L1-L{p.levels}, cap {p.cap}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={assign}
            disabled={assigning}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-2.5 rounded-lg text-sm disabled:opacity-60"
            data-testid="assign-partner-submit-btn"
          >
            {assigning ? 'Assigning…' : 'Assign Position'}
          </button>
        </div>

        {/* Current Partners List */}
        <div className="bg-white rounded-xl p-5 border border-slate-200" data-testid="partners-list-card">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-800">Current Partners</h2>
            <span className="ml-auto text-xs text-slate-500">{partners.length} active</span>
          </div>

          {partners.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              {loading ? 'Loading…' : 'No partners yet. Enter PIN + click "Load Partners" above.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="partners-list-table">
                <thead className="text-xs text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="text-left py-2 px-2">Name</th>
                    <th className="text-left py-2 px-2">Mobile</th>
                    <th className="text-left py-2 px-2">Position</th>
                    <th className="text-left py-2 px-2">Plan</th>
                    <th className="text-left py-2 px-2">Assigned</th>
                    <th className="text-right py-2 px-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map(p => (
                    <tr key={p.uid} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`partner-row-${p.uid}`}>
                      <td className="py-2 px-2 font-medium">{p.name || '—'}</td>
                      <td className="py-2 px-2">{p.mobile || '—'}</td>
                      <td className="py-2 px-2">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                          {p.position_label}
                        </span>
                      </td>
                      <td className="py-2 px-2 capitalize">{p.subscription_plan || 'explorer'}</td>
                      <td className="py-2 px-2 text-xs text-slate-500">
                        {p.partner_position_assigned_at ? new Date(p.partner_position_assigned_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button
                          onClick={() => revoke(p.uid, p.name || p.mobile)}
                          className="p-1.5 hover:bg-rose-50 rounded"
                          title="Revert to User"
                          data-testid={`revoke-partner-${p.uid}`}
                        >
                          <Trash2 className="w-4 h-4 text-rose-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
