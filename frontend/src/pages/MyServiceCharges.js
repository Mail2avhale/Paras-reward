// User page — "My Redemption Service Charges" — history + retry pending
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, IndianRupee, CheckCircle, Clock, Loader2, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API } from '../lib/api';
import { ensureRazorpayLoaded } from '../lib/razorpay';

const fmt = (n) => `₹ ${(Number(n) || 0).toFixed(2)}`;

const MyServiceCharges = ({ user }) => {
  const navigate = useNavigate();
  const [data, setData] = useState({ charges: [], totals: {} });
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(null);
  const [bulkPaying, setBulkPaying] = useState(false);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const { data: d } = await axios.get(`${API}/redemption-service-charge/history/${user.uid}`);
      setData(d);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Load failed'); }
    finally { setLoading(false); }
  }, [user?.uid]);

  useEffect(() => { load(); }, [load]);

  const pay = async (charge) => {
    setPaying(charge.charge_id);
    try {
      // Ensure the Razorpay checkout SDK is loaded before we call new Razorpay(...)
      await ensureRazorpayLoaded();
      const { data: order } = await axios.post(`${API}/redemption-service-charge/create-payment`, {
        charge_id: charge.charge_id,
      });
      const rzp = new window.Razorpay({
        key: order.razorpay_key,
        amount: order.amount, currency: order.currency, order_id: order.order_id,
        name: 'Paras Reward',
        description: `Service Charge · ${charge.charge_id}`,
        prefill: { name: user?.name, email: user?.email, contact: user?.mobile },
        theme: { color: '#f59e0b' },
        handler: async (resp) => {
          try {
            await axios.post(`${API}/redemption-service-charge/verify-payment`, {
              charge_id: charge.charge_id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            toast.success('Payment verified. You may create a new redemption now.');
            load();
          } catch (e) { toast.error(e?.response?.data?.detail || 'Verify failed'); }
        },
      });
      rzp.open();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      const status = e?.response?.status;
      const netErr = !e?.response;
      const msg = detail
        || (netErr && `Network error — cannot reach payment server${e?.message ? ` (${e.message})` : ''}`)
        || (status && `Order create failed (HTTP ${status})`)
        || 'Order create failed';
      toast.error(msg, { duration: 8000 });
      console.error('[svc-charge single-pay error]', { status, detail, err: e });
    } finally { setPaying(null); }
  };

  // Bulk Pay — one Razorpay checkout that clears ALL pending charges
  const payAll = async () => {
    if (!user?.uid) return;
    setBulkPaying(true);
    try {
      await ensureRazorpayLoaded();
      const { data: order } = await axios.post(`${API}/redemption-service-charge/bulk-pay-order`, {
        user_id: user.uid,
      });
      const rzp = new window.Razorpay({
        key: order.razorpay_key,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: 'Paras Reward',
        description: `Bulk Service Charge · ${order.charge_count} charges`,
        prefill: { name: user?.name, email: user?.email, contact: user?.mobile },
        theme: { color: '#0ea5e9' },
        modal: { ondismiss: () => setBulkPaying(false) },
        handler: async (resp) => {
          try {
            const { data: verify } = await axios.post(
              `${API}/redemption-service-charge/bulk-verify-payment`,
              {
                user_id: user.uid,
                charge_ids: order.charge_ids,
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              },
            );
            toast.success(
              `All cleared! ${verify.paid_count} charges marked PAID` +
              (verify.already_paid ? ` (${verify.already_paid} were already paid)` : ''),
              { duration: 6000 },
            );
            load();
          } catch (e) {
            toast.error(e?.response?.data?.detail || 'Bulk verify failed');
          } finally { setBulkPaying(false); }
        },
      });
      rzp.on('payment.failed', () => setBulkPaying(false));
      rzp.open();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      const status = e?.response?.status;
      const netErr = !e?.response;
      const msg = detail
        || (netErr && `Network error — cannot reach payment server${e?.message ? ` (${e.message})` : ''}`)
        || (status && `Bulk order create failed (HTTP ${status})`)
        || 'Bulk order create failed';
      toast.error(msg, { duration: 8000 });
      console.error('[svc-charge bulk-pay error]', { status, detail, err: e });
      setBulkPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20" data-testid="my-service-charges-page">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm sm:text-base font-bold text-slate-900">My Service Charges</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4">
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-white border border-yellow-200 rounded-xl p-3" data-testid="totals-pending">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase font-semibold text-slate-500">Pending</p>
              <Clock className="w-4 h-4 text-yellow-600" />
            </div>
            <p className="text-lg font-bold text-yellow-700 mt-1">{fmt(data.totals?.pending)}</p>
          </div>
          <div className="bg-white border border-emerald-200 rounded-xl p-3" data-testid="totals-paid">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase font-semibold text-slate-500">Paid</p>
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-emerald-700 mt-1">{fmt(data.totals?.paid)}</p>
          </div>
        </div>

        {/* Bulk-Pay banner — shows when 2+ pending charges exist */}
        {(() => {
          const pendingCharges = (data.charges || []).filter((c) => c.status === 'PENDING');
          if (pendingCharges.length < 2) return null;
          return (
            <div
              className="mb-3 rounded-xl border border-sky-300 bg-gradient-to-r from-sky-50 to-cyan-50 p-3 flex items-center justify-between gap-3 flex-wrap"
              data-testid="bulk-pay-banner"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-sky-800 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Bulk Pay Available
                </p>
                <p className="text-[11px] text-sky-700/80 mt-0.5">
                  Clear all <b>{pendingCharges.length}</b> pending charges of
                  <b> {fmt(data.totals?.pending)}</b> in ONE checkout instead of {pendingCharges.length} separate payments.
                </p>
              </div>
              <button
                onClick={payAll}
                disabled={bulkPaying}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold disabled:opacity-60 shrink-0 flex items-center gap-1"
                data-testid="bulk-pay-btn"
              >
                {bulkPaying ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Processing…</>
                ) : (
                  <><Zap className="w-3 h-3" /> Pay All {fmt(data.totals?.pending)}</>
                )}
              </button>
            </div>
          );
        })()}

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" /></div>
        ) : data.charges.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <IndianRupee className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No service charges yet.</p>
            <p className="text-xs text-slate-400 mt-1">Charges appear after a successful PRC redemption.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.charges.map(c => (
              <div key={c.charge_id} className={`bg-white border rounded-xl p-3 ${c.status === 'PENDING' ? 'border-yellow-300 bg-yellow-50/30' : 'border-slate-200'}`} data-testid={`svc-row-${c.charge_id}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{fmt(c.service_charge_amount)}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {(c.created_at || '').slice(0, 10)} · {c.prc_amount} PRC → {fmt(c.redemption_value_inr)}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400 truncate">{c.charge_id}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${c.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {c.status}
                    </span>
                    {c.status === 'PENDING' && (
                      <button onClick={() => pay(c)} disabled={paying === c.charge_id} className="mt-1 block ml-auto px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded text-xs font-bold disabled:opacity-60" data-testid={`pay-btn-${c.charge_id}`}>
                        {paying === c.charge_id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Pay Now'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyServiceCharges;
