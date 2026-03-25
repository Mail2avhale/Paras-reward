import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, RefreshCw, Search, XCircle, CheckCircle, 
  Loader2, IndianRupee, Clock, Filter, Wallet
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminPendingRequests() {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failingAll, setFailingAll] = useState(false);
  const [failingSingle, setFailingSingle] = useState(null);
  const [ekoBalance, setEkoBalance] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ total: 0, totalPrc: 0, totalInr: 0 });

  // Fetch Eko wallet balance
  const fetchEkoBalance = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/redeem/admin/eko-balance`);
      if (res.data.success) {
        setEkoBalance(res.data);
      }
    } catch (err) {
      console.error('Error fetching Eko balance:', err);
    }
  }, []);

  // Fetch pending requests
  const fetchPendingRequests = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch from multiple sources
      const [billsRes, redeemsRes] = await Promise.all([
        axios.get(`${API}/api/redeem/admin/bulk-reject-refund?collection=bill_payments&dry_run=true`).catch(() => ({ data: { transactions: [] } })),
        axios.get(`${API}/api/redeem/admin/bulk-reject-refund?collection=bank_withdrawals&dry_run=true`).catch(() => ({ data: { transactions: [] } }))
      ]);

      const bills = (billsRes.data.transactions || []).map(t => ({ ...t, collection: 'bill_payments' }));
      const redeems = (redeemsRes.data.transactions || []).map(t => ({ ...t, collection: 'bank_withdrawals' }));
      
      const allRequests = [...bills, ...redeems];
      setPendingRequests(allRequests);
      
      // Calculate stats
      const totalPrc = allRequests.reduce((sum, r) => sum + (r.prc || 0), 0);
      const totalInr = allRequests.reduce((sum, r) => sum + (r.amount_inr || 0), 0);
      setStats({ total: allRequests.length, totalPrc, totalInr });
      
    } catch (err) {
      console.error('Error fetching pending requests:', err);
      toast.error('Failed to fetch pending requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingRequests();
    fetchEkoBalance();
  }, [fetchPendingRequests, fetchEkoBalance]);

  // Fail single request
  const handleFailSingle = async (request) => {
    if (!window.confirm(`Fail request for ${request.user_name}?\n\nPRC to refund: ${request.prc?.toLocaleString()}`)) {
      return;
    }

    setFailingSingle(request.request_id);
    try {
      const res = await axios.post(`${API}/api/redeem/admin/fail-request`, {
        request_id: request.request_id,
        reason: 'Admin manually marked as failed'
      });

      if (res.data.success) {
        toast.success(`Request failed. ${res.data.details.prc_refunded?.toLocaleString()} PRC refunded to ${request.user_name}`);
        fetchPendingRequests();
      } else {
        toast.error(res.data.message || 'Failed to process request');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error failing request');
    } finally {
      setFailingSingle(null);
    }
  };

  // Bulk fail all pending requests
  const handleFailAll = async () => {
    if (!window.confirm(`⚠️ BULK FAIL ALL ${stats.total} PENDING REQUESTS?\n\nTotal PRC to refund: ${stats.totalPrc.toLocaleString()}\n\nThis action cannot be undone!`)) {
      return;
    }

    setFailingAll(true);
    try {
      // Process both collections
      const [billsRes, redeemsRes] = await Promise.all([
        axios.get(`${API}/api/redeem/admin/bulk-reject-refund?collection=bill_payments&dry_run=false`),
        axios.get(`${API}/api/redeem/admin/bulk-reject-refund?collection=bank_withdrawals&dry_run=false`)
      ]);

      const billsSuccess = billsRes.data.summary?.success || 0;
      const redeemsSuccess = redeemsRes.data.summary?.success || 0;
      const totalRefunded = (billsRes.data.summary?.total_prc_to_refund || 0) + (redeemsRes.data.summary?.total_prc_to_refund || 0);

      toast.success(`✅ Bulk fail complete!\n${billsSuccess + redeemsSuccess} requests failed.\n${totalRefunded.toLocaleString()} PRC refunded.`);
      fetchPendingRequests();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error in bulk fail operation');
    } finally {
      setFailingAll(false);
    }
  };

  // Filter requests
  const filteredRequests = pendingRequests.filter(r => {
    const matchesFilter = filter === 'all' || r.collection === filter;
    const matchesSearch = !searchTerm || 
      r.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.user_id?.includes(searchTerm) ||
      r.request_id?.includes(searchTerm);
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Pending Requests Manager</h1>
            <p className="text-slate-500 text-sm">Fail pending requests and refund PRC</p>
          </div>
          <Button 
            onClick={() => { fetchPendingRequests(); fetchEkoBalance(); }}
            variant="outline"
            className="border-slate-200"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Eko Balance Card */}
        {ekoBalance && (
          <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-500/20 rounded-xl">
                  <Wallet className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-slate-500 text-sm">Eko Wallet Balance</p>
                  <p className="text-2xl font-bold text-green-400">₹{ekoBalance.balance?.toLocaleString()}</p>
                </div>
              </div>
              <div className="text-right text-sm text-slate-500">
                <p>Locked: ₹{ekoBalance.locked?.toLocaleString() || 0}</p>
                <p>Available: ₹{(ekoBalance.balance - (ekoBalance.locked || 0))?.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats & Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-yellow-400" />
              <div>
                <p className="text-slate-500 text-sm">Pending Requests</p>
                <p className="text-xl font-bold text-slate-800">{stats.total}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <IndianRupee className="h-5 w-5 text-amber-400" />
              <div>
                <p className="text-slate-500 text-sm">Total PRC Locked</p>
                <p className="text-xl font-bold text-amber-400">{stats.totalPrc.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <IndianRupee className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-slate-500 text-sm">Total INR Value</p>
                <p className="text-xl font-bold text-blue-400">₹{stats.totalInr.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center">
            <Button
              onClick={handleFailAll}
              disabled={failingAll || stats.total === 0}
              className="w-full h-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-slate-800 font-bold"
              data-testid="fail-all-btn"
            >
              {failingAll ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <AlertTriangle className="h-5 w-5 mr-2" />
              )}
              FAIL ALL & REFUND
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200/50 text-slate-800 rounded-lg px-3 py-2"
            >
              <option value="all">All Types</option>
              <option value="bill_payments">Bill Payments</option>
              <option value="bank_withdrawals">Bank Withdrawals</option>
            </select>
          </div>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search by name, user ID, request ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-200/50 text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Requests Table */}
        <div className="bg-slate-50 border border-slate-200/50 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
              <p className="text-green-400 font-semibold">No Pending Requests!</p>
              <p className="text-slate-500 text-sm">All requests have been processed</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white">
                  <tr>
                    <th className="text-left text-slate-500 text-sm font-medium p-4">User</th>
                    <th className="text-left text-slate-500 text-sm font-medium p-4">Type</th>
                    <th className="text-right text-slate-500 text-sm font-medium p-4">Amount</th>
                    <th className="text-right text-slate-500 text-sm font-medium p-4">PRC to Refund</th>
                    <th className="text-center text-slate-500 text-sm font-medium p-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {filteredRequests.map((request, idx) => (
                    <tr key={request.request_id || idx} className="hover:bg-slate-100/20 transition-colors">
                      <td className="p-4">
                        <p className="text-slate-800 font-medium">{request.user_name || 'Unknown'}</p>
                        <p className="text-slate-500 text-xs">{request.user_id}</p>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          request.collection === 'bill_payments' 
                            ? 'bg-blue-500/20 text-blue-400' 
                            : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {request.service_type || request.collection?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <p className="text-slate-800">₹{request.amount_inr?.toLocaleString() || 0}</p>
                      </td>
                      <td className="p-4 text-right">
                        <p className="text-amber-400 font-semibold">{request.prc?.toLocaleString() || 0} PRC</p>
                      </td>
                      <td className="p-4 text-center">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleFailSingle(request)}
                          disabled={failingSingle === request.request_id}
                          className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50"
                        >
                          {failingSingle === request.request_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-1" />
                          )}
                          Fail & Refund
                        </Button>
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
