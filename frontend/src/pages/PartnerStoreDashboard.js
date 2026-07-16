/**
 * Partner Store Dashboard — Paras Reward v2.0 (Feb 2026)
 * ======================================================
 * Minimal, mobile-first dashboard for verified Partner Stores.
 *
 * Shows: today's PRC collection, wallet balance, lifetime received,
 * pending settlement, recent transactions, Store ID (share with users).
 *
 * Auth: caller must be a `partner_store` role. Uid comes from the
 * currently-logged-in user prop passed by App.js.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '../lib/api';
import {
  Store, Wallet, TrendingUp, Clock, CheckCircle2,
  RefreshCw, LogOut, Copy, ShieldCheck, ShieldAlert,
  Banknote, X,
} from 'lucide-react';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const prc = (n) => `${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} PRC`;
const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
};

export default function PartnerStoreDashboard({ user, onLogout }) {
  const [data, setData] = useState(null);
  const [txns, setTxns] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleRemark, setSettleRemark] = useState('');
  const [submittingSettle, setSubmittingSettle] = useState(false);

  const loadAll = useCallback(async () => {
    if (!user?.uid) return;
    setRefreshing(true);
    try {
      const [selfRes, txnRes, settlementRes] = await Promise.all([
        axios.get(`${API}/v2/partner-stores/self/${user.uid}`),
        axios.get(`${API}/v2/partner-stores/self/${user.uid}/transactions?limit=20`),
        axios.get(`${API}/v2/partner-stores/settlement/history/${user.uid}?limit=20`),
      ]);
      if (selfRes.data.success) setData(selfRes.data);
      if (txnRes.data.success) setTxns(txnRes.data.transactions || []);
      if (settlementRes.data.success) setSettlements(settlementRes.data.requests || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const requestSettlement = async () => {
    const amt = parseFloat(settleAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    setSubmittingSettle(true);
    try {
      const res = await axios.post(`${API}/v2/partner-stores/settlement/request`, {
        uid: user.uid,
        prc_amount: amt,
        remark: settleRemark || undefined,
      });
      if (res.data.success) {
        toast.success(`Settlement of ${amt} PRC requested — admin will review`);
        setShowSettleModal(false);
        setSettleAmount('');
        setSettleRemark('');
        loadAll();
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Settlement request failed');
    } finally {
      setSubmittingSettle(false);
    }
  };

  const copyStoreId = () => {
    if (!data?.store?.store_id) return;
    navigator.clipboard?.writeText(data.store.store_id);
    toast.success('Store ID copied — share with your customers');
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-400">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading your Partner Store…</p>
        </div>
      </div>
    );
  }

  const store = data?.store || {};
  const wallet = data?.wallet || {};
  const isVerified = store.verification_status === 'verified' && store.is_active;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-8" data-testid="partner-store-dashboard">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Partner Store</p>
            <p className="font-bold text-white text-sm truncate" data-testid="ps-dash-business-name">
              {store.business_name || 'Your Store'}
            </p>
          </div>
          <button
            onClick={loadAll}
            disabled={refreshing}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-300"
            data-testid="ps-dash-refresh-btn"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onLogout}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-300"
            data-testid="ps-dash-logout-btn"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Verification Banner */}
        {!isVerified && (
          <div
            className={`rounded-xl p-4 border ${
              store.verification_status === 'pending'
                ? 'bg-amber-500/10 border-amber-500/40'
                : 'bg-rose-500/10 border-rose-500/40'
            }`}
            data-testid="ps-dash-verification-banner"
          >
            <div className="flex items-start gap-3">
              <ShieldAlert className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                store.verification_status === 'pending' ? 'text-amber-400' : 'text-rose-400'
              }`} />
              <div>
                <p className="font-bold text-white">
                  {store.verification_status === 'pending' && 'KYC Verification Pending'}
                  {store.verification_status === 'rejected' && 'KYC Rejected'}
                  {store.verification_status === 'suspended' && 'Account Suspended'}
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  {store.verification_status === 'pending' && 'You cannot receive PRC payments until admin verifies your documents. Please wait or contact support.'}
                  {store.verification_status === 'rejected' && `Reason: ${store.verification_remark || 'Contact support for details'}`}
                  {store.verification_status === 'suspended' && `Reason: ${store.verification_remark || 'Contact support'}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Store ID card */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-5 shadow-lg" data-testid="ps-dash-store-id-card">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-indigo-200 font-semibold">Your Store ID</p>
              <p className="text-3xl font-black text-white font-mono tracking-widest mt-1" data-testid="ps-dash-store-id">
                {store.store_id}
              </p>
            </div>
            {isVerified && (
              <ShieldCheck className="w-6 h-6 text-emerald-300" />
            )}
          </div>
          <p className="text-xs text-indigo-100 mb-3">
            Share this 6-digit ID (or your registered mobile <span className="font-mono">{store.mobile_number}</span>) with customers to receive PRC payments.
          </p>
          <button
            onClick={copyStoreId}
            className="w-full py-2 bg-white/15 hover:bg-white/25 rounded-lg text-white font-semibold text-xs flex items-center justify-center gap-2"
            data-testid="ps-dash-copy-store-id-btn"
          >
            <Copy className="w-3.5 h-3.5" /> Copy Store ID
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4" data-testid="ps-dash-today-tile">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Today</p>
            </div>
            <p className="text-xl font-bold text-emerald-300 tabular-nums" data-testid="ps-dash-today-prc">
              {prc(data?.today_collection_prc)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">{data?.today_txn_count || 0} transactions</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4" data-testid="ps-dash-balance-tile">
            <div className="flex items-center gap-1.5 mb-2">
              <Wallet className="w-3.5 h-3.5 text-indigo-400" />
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Wallet Balance</p>
            </div>
            <p className="text-xl font-bold text-white tabular-nums" data-testid="ps-dash-wallet-balance">
              {prc(wallet.prc_balance)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Available to settle</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4" data-testid="ps-dash-pending-tile">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Pending Settlement</p>
            </div>
            <p className="text-xl font-bold text-amber-300 tabular-nums" data-testid="ps-dash-pending-prc">
              {prc(wallet.pending_settlement_prc)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Awaiting bank transfer</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4" data-testid="ps-dash-lifetime-tile">
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Lifetime Settled</p>
            </div>
            <p className="text-xl font-bold text-cyan-300 tabular-nums" data-testid="ps-dash-lifetime-settled">
              {inr(wallet.lifetime_settled_prc)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Total to bank</p>
          </div>
        </div>

        {/* Bank Details Recap */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4" data-testid="ps-dash-bank-card">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Settlement Bank</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-slate-500">A/c Holder</p>
              <p className="text-white font-semibold">{store.bank_account_holder || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500">A/c Number</p>
              <p className="text-white font-semibold font-mono tabular-nums">
                {store.bank_account_number ? `••••${String(store.bank_account_number).slice(-4)}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-slate-500">IFSC</p>
              <p className="text-white font-semibold font-mono">{store.bank_ifsc || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500">Mobile</p>
              <p className="text-white font-semibold font-mono">{store.mobile_number || '—'}</p>
            </div>
          </div>
        </div>

        {/* Request Settlement Button */}
        {isVerified && (
          <button
            onClick={() => setShowSettleModal(true)}
            disabled={(wallet.prc_balance || 0) <= 0}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="ps-dash-request-settlement-btn"
          >
            <Banknote className="w-4 h-4" />
            Request Settlement to Bank
          </button>
        )}

        {/* Recent Transactions */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden" data-testid="ps-dash-txns-card">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-white text-sm">Recent Payments</h3>
            <span className="text-[10px] text-slate-500">Last 20</span>
          </div>
          {txns.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              No PRC payments received yet. Share your Store ID with customers to start.
            </div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {txns.map((t) => (
                <li key={t.txn_id || t.client_txn_id} className="px-4 py-3 flex items-center gap-3" data-testid={`ps-dash-txn-${t.txn_id || t.client_txn_id}`}>
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 grid place-items-center">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold">
                      +{prc(t.prc_amount)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {t.user_name_masked || 'Customer'} · {fmtDate(t.created_at)}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    t.status === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {t.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Settlement History */}
        {settlements.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden" data-testid="ps-dash-settlements-card">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">Settlement History</h3>
              <span className="text-[10px] text-slate-500">{settlements.length}</span>
            </div>
            <ul className="divide-y divide-slate-800">
              {settlements.map((s) => (
                <li key={s.request_id} className="px-4 py-3" data-testid={`ps-dash-settlement-${s.request_id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-semibold text-sm tabular-nums">
                      {prc(s.prc_deducted)} → ₹{Number(s.withdrawal_amount || 0).toLocaleString('en-IN')}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      s.status === 'paid' ? 'bg-emerald-500/20 text-emerald-300' :
                      s.status === 'pending' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-rose-500/20 text-rose-300'
                    }`}>
                      {s.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {fmtDate(s.created_at)} · {s.request_id}
                    {s.utr_number && <> · UTR {s.utr_number}</>}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Settlement Request Modal */}
      {showSettleModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur grid place-items-center p-4"
          onClick={() => setShowSettleModal(false)}
          data-testid="ps-settle-modal"
        >
          <div
            className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">Request Settlement</h3>
              <button onClick={() => setShowSettleModal(false)} className="text-slate-400 hover:text-white" data-testid="ps-settle-modal-close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-800/60 rounded-lg p-3 mb-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Available Balance</p>
              <p className="text-xl font-bold text-emerald-300 tabular-nums">{prc(wallet.prc_balance)}</p>
            </div>

            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Amount (PRC)</label>
            <input
              type="number"
              min="1"
              max={wallet.prc_balance || 0}
              step="0.01"
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-lg font-bold tabular-nums"
              data-testid="ps-settle-amount-input"
            />

            <label className="block text-[11px] font-semibold text-slate-400 mb-1 mt-3">Note (optional)</label>
            <input
              type="text"
              maxLength={200}
              value={settleRemark}
              onChange={(e) => setSettleRemark(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm"
              data-testid="ps-settle-remark-input"
            />

            <p className="text-[11px] text-slate-500 mt-3">
              Funds will be deducted from your wallet and queued for admin approval. On approval, the equivalent INR will be transferred to your registered bank account.
            </p>

            <button
              onClick={requestSettlement}
              disabled={submittingSettle || !settleAmount || parseFloat(settleAmount) <= 0}
              className="w-full mt-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm disabled:opacity-60"
              data-testid="ps-settle-submit-btn"
            >
              {submittingSettle ? 'Submitting…' : 'Submit Settlement Request'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
