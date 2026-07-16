/**
 * Pay to Partner Store — user-facing payment flow (Paras Reward v2.0, Feb 2026)
 * =============================================================================
 * Step 1: enter mobile / 6-digit Store ID → lookup
 * Step 2: enter PRC amount + optional remark → confirm
 * Step 3: server atomic PRC transfer → success screen
 */
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '../lib/api';
import {
  ArrowLeft, Store, Search, CheckCircle2, ShieldCheck,
  Wallet, Send, RefreshCw,
} from 'lucide-react';
import AdMobBanner from '../components/AdMobBanner';

const MAX_TXN_PRC = 5000;

export default function PayPartnerStore({ user }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [store, setStore] = useState(null);
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(null);

  const doLookup = useCallback(async () => {
    const q = query.trim();
    if (!q) { toast.error('Enter mobile or Store ID'); return; }
    const payload = {};
    if (/^\d{10}$/.test(q)) payload.mobile = q;
    else if (/^\d{6}$/.test(q)) payload.store_id = q;
    else { toast.error('Enter 10-digit mobile OR 6-digit Store ID'); return; }
    setLookingUp(true);
    try {
      const res = await axios.post(`${API}/v2/partner-stores/pay/lookup`, payload);
      if (res.data.success) {
        setStore(res.data.store);
        toast.success(`Found: ${res.data.store.business_name}`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Store not found');
      setStore(null);
    } finally {
      setLookingUp(false);
    }
  }, [query]);

  const doPay = async () => {
    if (!store) { toast.error('Look up a store first'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (amt > MAX_TXN_PRC) { toast.error(`Max ₹${MAX_TXN_PRC} per transaction`); return; }
    setPaying(true);
    try {
      const clientTxnId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const payload = {
        user_uid: user.uid,
        prc_amount: amt,
        client_txn_id: clientTxnId,
        remark: remark || undefined,
      };
      if (store.store_id) payload.store_id = store.store_id;
      const res = await axios.post(`${API}/v2/partner-stores/pay`, payload);
      if (res.data.success) {
        setSuccess({
          txn: res.data.transaction,
          new_balance: res.data.new_user_balance,
        });
        toast.success('Payment successful!');
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const reset = () => {
    setStore(null);
    setQuery('');
    setAmount('');
    setRemark('');
    setSuccess(null);
  };

  // SUCCESS SCREEN
  if (success) {
    const t = success.txn;
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4" data-testid="pay-store-success-screen">
        <div className="max-w-md mx-auto pt-8">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 mx-auto grid place-items-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Payment Successful</h1>
          <p className="text-center text-slate-400 text-sm mb-6">
            You paid <span className="font-bold text-emerald-300">{t.prc_amount} PRC</span> to<br />
            <span className="font-semibold text-white">{t.store_name}</span>
          </p>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 mb-6" data-testid="pay-store-receipt">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Transaction ID</span>
              <span className="font-mono text-xs text-white">{t.txn_id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Store ID</span>
              <span className="font-mono text-white">{t.store_id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Amount</span>
              <span className="font-bold text-emerald-300 tabular-nums">{t.prc_amount} PRC</span>
            </div>
            {t.remark && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Note</span>
                <span className="text-white text-right max-w-[60%] truncate">{t.remark}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t border-slate-800 pt-3">
              <span className="text-slate-400">New Wallet Balance</span>
              <span className="font-bold text-white tabular-nums">{success.new_balance?.toFixed(2)} PRC</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm"
              data-testid="pay-store-pay-another-btn"
            >
              Pay Another Store
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm"
              data-testid="pay-store-done-btn"
            >
              Done
            </button>
          </div>

          {/* Banner ad shown after payment success (Feb 2026 — v2.0) */}
          <AdMobBanner placement="partner_store_payment" />
        </div>
      </div>
    );
  }

  // FORM SCREEN
  return (
    <div className="min-h-screen bg-slate-950 text-white pb-8" data-testid="pay-store-page">
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-800 rounded-lg" data-testid="pay-store-back-btn">
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
          <div className="flex-1">
            <p className="font-bold text-white">Pay to Partner Store</p>
            <p className="text-[11px] text-slate-500">Send PRC to verified local shops</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Wallet Balance */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-4" data-testid="pay-store-balance-card">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-indigo-200" />
            <p className="text-[10px] uppercase tracking-wider text-indigo-200 font-semibold">Your PRC Balance</p>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums mt-1" data-testid="pay-store-balance">
            {(user?.prc_balance ?? 0).toFixed(2)} PRC
          </p>
        </div>

        {/* Step 1: Lookup */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Step 1 — Find Store</label>
          <p className="text-[11px] text-slate-500 mt-0.5 mb-3">Enter Store&apos;s 10-digit mobile or 6-digit Store ID</p>
          <div className="flex gap-2">
            <input
              type="tel"
              placeholder="e.g. 8888800001 or 100001"
              value={query}
              onChange={(e) => { setQuery(e.target.value); if (store) setStore(null); }}
              className="flex-1 px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm"
              data-testid="pay-store-query-input"
            />
            <button
              onClick={doLookup}
              disabled={lookingUp}
              className="px-4 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-semibold text-sm disabled:opacity-60"
              data-testid="pay-store-lookup-btn"
            >
              {lookingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Store Found Card */}
        {store && (
          <div
            className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-4"
            data-testid="pay-store-found-card"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 grid place-items-center flex-shrink-0">
                <Store className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-white" data-testid="pay-store-found-name">{store.business_name}</p>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-[11px] text-slate-400">{store.owner_name} · Store ID {store.store_id}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">{store.address}</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Amount */}
        {store && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4" data-testid="pay-store-amount-card">
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Step 2 — Amount</label>
            <div className="mt-2">
              <input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                max={MAX_TXN_PRC}
                step="1"
                className="w-full px-3 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-2xl font-bold tabular-nums text-center"
                data-testid="pay-store-amount-input"
              />
              <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                <span>PRC</span>
                <span>Max ₹{MAX_TXN_PRC.toLocaleString('en-IN')} per transaction</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-3">
              {[50, 100, 500, 1000].map(v => (
                <button
                  key={v}
                  onClick={() => setAmount(String(v))}
                  className="py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                  data-testid={`pay-store-quick-${v}`}
                >
                  ₹{v}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Note (optional)"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              maxLength={120}
              className="w-full mt-3 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500"
              data-testid="pay-store-remark-input"
            />

            <button
              onClick={doPay}
              disabled={paying || !amount || parseFloat(amount) <= 0}
              className="w-full mt-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              data-testid="pay-store-confirm-btn"
            >
              <Send className="w-4 h-4" />
              {paying ? 'Processing…' : `Pay ${amount || 0} PRC`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
