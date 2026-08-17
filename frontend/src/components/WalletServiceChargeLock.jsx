// Small inline "PRC locked (pending service charge)" indicator for the Wallet.
// When a user has ANY pending PRC Redemption Service Charge, the ability to
// create a new redemption is blocked backend-side — so effectively their
// redeemable PRC is "locked" until the ₹cash fee is paid.
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Lock, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API } from '../lib/api';

const WalletServiceChargeLock = ({ uid, prcBalance = 0, prcRate = 10 }) => {
  const navigate = useNavigate();
  const [charge, setCharge] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!uid) return;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/redemption-service-charge/pending/${uid}`);
        if (alive) setCharge(data.has_pending ? data.charge : null);
      } catch { /* silent */ }
    })();
    return () => { alive = false; };
  }, [uid]);

  if (!charge) {
    return (
      <div className="flex items-center justify-between text-[10px]" data-testid="wallet-lock-none">
        <span className="text-emerald-400/80">Redemption: Available</span>
        <span className="text-zinc-500">₹{(Number(prcBalance) / (prcRate || 10)).toFixed(0)} eligible</span>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 space-y-1 cursor-pointer hover:bg-amber-500/15"
      onClick={() => navigate('/my-service-charges')}
      data-testid="wallet-lock-pending"
    >
      <div className="flex items-center gap-1.5">
        <Lock className="w-3 h-3 text-amber-400" />
        <span className="text-amber-300 text-[11px] font-bold">Redemption Locked</span>
      </div>
      <p className="text-amber-100/80 text-[10px] leading-tight">
        A prior redemption&apos;s 20% service fee of{' '}
        <b>₹{charge.total_payable}</b> is pending. Pay it to unlock new redemptions.
      </p>
      <div className="flex items-center gap-1 text-amber-200 text-[10px] font-semibold">
        <AlertCircle className="w-3 h-3" />
        <span>Tap for details</span>
      </div>
    </div>
  );
};

export default WalletServiceChargeLock;
