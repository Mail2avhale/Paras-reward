import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

import { API } from '../lib/api';

const RechargePlanPicker = ({ number, rechargeType, operators, selectedOperator, onOperatorDetected, amount, onPick, maxAllowed }) => {
  const [circle, setCircle] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const valid = rechargeType === 'mobile' && /^[6-9]\d{9}$/.test(number || '');

  useEffect(() => {
    setCircle(null);
    setPlans([]);
    if (!valid) return;
    axios.get(`${API}/recharge/detect-operator/${number}`).then((r) => {
      if (!r.data?.success) return;
      setCircle(r.data.circle);
      if (operators.some((o) => String(o.operator_id) === String(r.data.operator_id))) onOperatorDetected(String(r.data.operator_id));
    }).catch(() => {});
  }, [number, valid]); // operators/onOperatorDetected intentionally omitted

  useEffect(() => {
    if (!valid || !circle || !selectedOperator) return;
    setLoading(true);
    axios.get(`${API}/recharge/plans/${number}`, { params: { operator_id: selectedOperator, circle } })
      .then((r) => setPlans(r.data?.plans || []))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, [number, valid, circle, selectedOperator]);

  if (!valid || !circle) return null;
  const picked = plans.find((p) => String(p.amount) === String(amount));

  return (
    <div data-testid="recharge-plan-picker" className="mt-2">
      <p className="text-[11px] text-gray-400 mb-1.5 pl-1">Choose a plan {plans.length > 3 && <span className="text-gray-500">· {plans.length} plans, swipe for more →</span>} {loading && <Loader2 className="inline h-3 w-3 animate-spin" />}</p>
      {!loading && plans.length === 0 && <p className="text-[11px] text-gray-500 pl-1" data-testid="no-plans">Plans not available — enter the amount manually.</p>}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {plans.map((p) => {
          const tooHigh = p.amount > maxAllowed;
          const active = picked?.amount === p.amount;
          return (
            <button
              key={`${p.amount}-${p.validity}`}
              type="button"
              disabled={tooHigh}
              onClick={() => onPick(String(p.amount))}
              data-testid={`plan-chip-${p.amount}`}
              className={`shrink-0 rounded-xl px-3 py-2 text-left border transition-colors ${active ? 'border-emerald-400 bg-emerald-500/15' : 'border-white/10 bg-white/5'} ${tooHigh ? 'opacity-40' : 'hover:border-emerald-400/60'}`}
            >
              <span className="block text-sm font-bold text-white">₹{p.amount}</span>
              <span className="block text-[10px] text-gray-400">{p.validity || '—'}</span>
            </button>
          );
        })}
      </div>
      {picked && <p className="text-[10px] text-gray-400 mt-1 pl-1 line-clamp-3" data-testid="plan-description">{picked.description}</p>}
    </div>
  );
};

export default RechargePlanPicker;
