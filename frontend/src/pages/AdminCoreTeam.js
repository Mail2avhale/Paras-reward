import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Users, UserPlus, Trash2, Wallet, Settings, RefreshCw, Search, Loader2, Crown, Shield } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminCoreTeam = () => {
  const [members, setMembers] = useState([]);
  const [poolData, setPoolData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchUid, setSearchUid] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [poolRate, setPoolRate] = useState(20);
  const [savingRate, setSavingRate] = useState(false);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [membersRes, balanceRes] = await Promise.all([
        axios.get(`${API}/pool-wallet/admin/members`, { headers }),
        axios.get(`${API}/pool-wallet/admin/balance`, { headers }),
      ]);
      setMembers(membersRes.data?.members || []);
      setPoolData(balanceRes.data);
      setPoolRate(balanceRes.data?.settings?.pool_rate || 20);
    } catch (err) {
      toast.error('Failed to load core team data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const searchUser = async () => {
    if (!searchUid.trim()) return;
    setSearching(true);
    try {
      const res = await axios.get(`${API}/admin/users?search=${searchUid.trim()}&limit=5`, { headers });
      setSearchResults(res.data?.users || []);
      if ((res.data?.users || []).length === 0) toast.info('No users found');
    } catch { toast.error('Search failed'); }
    finally { setSearching(false); }
  };

  const addMember = async (uid) => {
    try {
      const res = await axios.post(`${API}/pool-wallet/admin/add-member`, { uid }, { headers });
      if (res.data?.success) {
        toast.success(res.data.message);
        setSearchResults([]);
        setSearchUid('');
        fetchData();
      } else toast.error(res.data?.detail || 'Failed');
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to add member'); }
  };

  const removeMember = async (uid, name) => {
    if (!window.confirm(`Remove ${name} from core team?`)) return;
    try {
      const res = await axios.delete(`${API}/pool-wallet/admin/remove-member/${uid}`, { headers });
      if (res.data?.success) { toast.success('Member removed'); fetchData(); }
    } catch { toast.error('Failed to remove'); }
  };

  const distribute = async () => {
    if (!window.confirm('Distribute pool balance to all core team members now?')) return;
    setDistributing(true);
    try {
      const res = await axios.post(`${API}/pool-wallet/admin/distribute`, {}, { headers });
      toast.success(res.data?.message || 'Distribution complete');
      fetchData();
    } catch { toast.error('Distribution failed'); }
    finally { setDistributing(false); }
  };

  const saveRate = async () => {
    setSavingRate(true);
    try {
      await axios.put(`${API}/pool-wallet/admin/settings`, { pool_rate: poolRate }, { headers });
      toast.success(`Pool rate updated to ${poolRate}%`);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setSavingRate(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="admin-core-team-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="w-7 h-7 text-indigo-400" />
            Core Team Management
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Manage core team members and pool wallet distribution</p>
        </div>
        <button onClick={fetchData} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400" data-testid="refresh-btn">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Pool Wallet Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="pool-stats">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-indigo-400" />
            <span className="text-zinc-500 text-xs uppercase tracking-wider">Pool Balance</span>
          </div>
          <p className="text-2xl font-bold text-white">{Number(poolData?.balance || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} <span className="text-sm text-zinc-500 font-normal">PRC</span></p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-green-400" />
            <span className="text-zinc-500 text-xs uppercase tracking-wider">Core Team</span>
          </div>
          <p className="text-2xl font-bold text-white">{poolData?.core_team_count || 0} <span className="text-sm text-zinc-500 font-normal">Members</span></p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-zinc-500 text-xs uppercase tracking-wider">Total Credited</span>
          </div>
          <p className="text-2xl font-bold text-white">{Number(poolData?.total_credited || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} <span className="text-sm text-zinc-500 font-normal">PRC</span></p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            <span className="text-zinc-500 text-xs uppercase tracking-wider">Total Distributed</span>
          </div>
          <p className="text-2xl font-bold text-white">{Number(poolData?.total_distributed || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} <span className="text-sm text-zinc-500 font-normal">PRC</span></p>
        </div>
      </div>

      {/* Settings + Distribute */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-white">Pool Rate</h3>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number" min="0" max="100" value={poolRate}
              onChange={(e) => setPoolRate(Number(e.target.value))}
              className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-center"
              data-testid="pool-rate-input"
            />
            <span className="text-zinc-500 text-sm">% of mining collect → pool</span>
            <button onClick={saveRate} disabled={savingRate}
              className="ml-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg disabled:opacity-50"
              data-testid="save-rate-btn">
              {savingRate ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-white">Manual Distribution</h3>
          </div>
          <p className="text-zinc-500 text-xs mb-3">Distribute current pool balance equally to all Elite core team members.</p>
          <button onClick={distribute} disabled={distributing || (poolData?.balance || 0) <= 0}
            className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="distribute-btn">
            {distributing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {distributing ? 'Distributing...' : `Distribute ${Number(poolData?.balance || 0).toLocaleString()} PRC`}
          </button>
        </div>
      </div>

      {/* Add Member */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5" data-testid="add-member-section">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Add Core Team Member</h3>
        </div>
        <div className="flex gap-2 mb-3">
          <input
            type="text" placeholder="Search by name, mobile, or email..."
            value={searchUid} onChange={(e) => setSearchUid(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchUser()}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-zinc-600"
            data-testid="search-user-input"
          />
          <button onClick={searchUser} disabled={searching}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg disabled:opacity-50 flex items-center gap-2"
            data-testid="search-user-btn">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((u) => {
              const alreadyMember = members.some(m => m.uid === u.uid);
              return (
                <div key={u.uid} className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-white text-sm font-medium">{u.name}</p>
                    <p className="text-zinc-500 text-xs">{u.mobile} | {u.subscription_plan || 'explorer'}</p>
                  </div>
                  {alreadyMember ? (
                    <span className="text-xs text-green-400 font-medium">Already Member</span>
                  ) : (
                    <button onClick={() => addMember(u.uid)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg"
                      data-testid={`add-member-btn-${u.uid}`}>
                      Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Members List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5" data-testid="members-list-section">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Core Team Members ({members.length})</h3>
          </div>
        </div>
        {members.length === 0 ? (
          <p className="text-zinc-600 text-sm text-center py-8">No core team members yet. Search and add users above.</p>
        ) : (
          <div className="space-y-2">
            {members.map((m, idx) => (
              <div key={m.uid} className="flex items-center justify-between bg-zinc-800/40 rounded-lg px-4 py-3 hover:bg-zinc-800/60 transition-colors" data-testid={`member-row-${idx}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-bold">
                    {(m.name || '?')[0]}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{m.name || 'Unknown'}</p>
                    <p className="text-zinc-500 text-xs">{m.mobile || 'N/A'} | Added {m.added_at ? new Date(m.added_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A'}</p>
                  </div>
                </div>
                <button onClick={() => removeMember(m.uid, m.name)}
                  className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                  data-testid={`remove-member-btn-${idx}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      {poolData?.recent_transactions?.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5" data-testid="pool-transactions">
          <h3 className="text-sm font-semibold text-white mb-3">Recent Pool Transactions</h3>
          <div className="space-y-2">
            {poolData.recent_transactions.slice(0, 10).map((t, idx) => (
              <div key={idx} className="flex items-center justify-between bg-zinc-800/30 rounded-lg px-3 py-2 text-xs">
                <div>
                  <span className={`font-medium ${t.type === 'credit' ? 'text-green-400' : 'text-cyan-400'}`}>
                    {t.type === 'credit' ? '+' : '-'}{Number(t.amount || 0).toFixed(4)} PRC
                  </span>
                  <p className="text-zinc-600 mt-0.5">{t.description?.substring(0, 60)}</p>
                </div>
                <span className="text-zinc-600">{t.timestamp ? new Date(t.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCoreTeam;
