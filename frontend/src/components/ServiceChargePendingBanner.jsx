// Global banner shown when user has any PENDING PRC Redemption Service Charge.
// Blocks nothing at UI (backend enforces); acts as a persistent nag + Pay CTA.
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API } from '../lib/api';
import { ensureRazorpayLoaded } from '../lib/razorpay';

const ServiceChargePendingBanner = ({ user }) => {
  const navigate = useNavigate();
  const [charge, setCharge] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const { data } = await axios.get(`${API}/redemption-service-charge/pending/${user.uid}`);
      setCharge(data.has_pending ? data.charge : null);
    } catch { /* silent */ }
  }, [user?.uid]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);   // refresh every 30s
    return () => clearInterval(t);
  }, [load]);

  // Preload Razorpay SDK as soon as the banner mounts so Pay is snappy.
  // Best-effort — errors are surfaced only when user actually clicks Pay.
  useEffect(() => {
    if (charge) ensureRazorpayLoaded().catch(() => { /* noop preload */ });
  }, [charge]);

  const pay = async () => {
    if (!charge) return;
    setBusy(true);
    try {
      await ensureRazorpayLoaded();
      const { data: order } = await axios.post(`${API}/redemption-service-charge/create-payment`, {
        charge_id: charge.charge_id,
      });
      // Open Razorpay checkout
      const rzp = new window.Razorpay({
        key: order.razorpay_key,
        amount: order.amount, currency: order.currency,
        order_id: order.order_id,
        name: 'Paras Reward',
        description: `PRC Redemption Service Charge · ${charge.charge_id}`,
        prefill: { name: user?.name, email: user?.email, contact: user?.mobile || user?.phone },
        theme: { color: '#f59e0b' },
        handler: async (resp) => {
          try {
            await axios.post(`${API}/redemption-service-charge/verify-payment`, {
              charge_id: charge.charge_id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            toast.success('Service charge paid! You can now create a new redemption.');
            setCharge(null);
          } catch (e) {
            toast.error(e?.response?.data?.detail || 'Verification failed');
          }
        },
      });
      rzp.on('payment.failed', () => toast.error('Payment failed. You can retry from the banner.'));
      rzp.open();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      const netErr = !e?.response;
      const msg = detail
        || (netErr && `Cannot open payment gateway${e?.message ? ` (${e.message})` : ''}`)
        || 'Failed to create payment order';
      toast.error(msg, { duration: 8000 });
      console.error('[svc-charge banner pay error]', e);
    } finally {
      setBusy(false);
    }
  };

  if (!charge || dismissed) return null;

  return (
    <div className="sticky top-0 z-[60] bg-amber-500 text-slate-900 border-b-2 border-amber-600 shadow-md" data-testid="svc-charge-banner">
      <div className="max-w-7xl mx-auto px-3 py-2 flex items-center gap-3 flex-wrap">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">
            Service Fee Pending — ₹{charge.total_payable}
          </p>
          <p className="text-xs opacity-90 truncate">
            Complete this payment to unlock further PRC spends.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={pay} disabled={busy} className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-md text-xs font-bold disabled:opacity-60" data-testid="banner-pay-btn">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : `Pay ₹${charge.total_payable}`}
          </button>
          <button onClick={() => navigate('/my-service-charges')} className="text-xs underline hover:no-underline" data-testid="banner-details-btn">
            Details
          </button>
          <button onClick={() => setDismissed(true)} className="p-1 hover:bg-amber-600 rounded" data-testid="banner-dismiss">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceChargePendingBanner;
