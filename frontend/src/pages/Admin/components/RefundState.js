import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle } from 'lucide-react';

const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('en-IN');

export const REFUND_STATE_UI = {
  refunded: { label: 'Refunded', cls: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
  missing: { label: 'Not Refunded', cls: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
  review: { label: 'Needs Review', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle },
  not_deducted: { label: 'No PRC Deducted', cls: 'bg-slate-50 text-slate-600 border-slate-200', icon: MinusCircle },
  eko_refund_pending: { label: 'Eko Refund Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle },
  legacy_copy: { label: 'Legacy Copy', cls: 'bg-slate-50 text-slate-500 border-slate-200', icon: MinusCircle },
};

export const RefundStateBadge = ({ req, onRefund, loading }) => {
  const ui = REFUND_STATE_UI[req.refund_state];
  if (!ui) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <span data-testid={`refund-state-${req.request_id}`} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ui.cls}`}>
        {ui.label}{req.refund_state_prc ? ` · ${fmt(req.refund_state_prc)}` : ''}
      </span>
      {req.refund_state === 'missing' && (
        <button
          type="button"
          onClick={onRefund}
          disabled={loading}
          data-testid={`audit-refund-btn-${req.request_id}`}
          className="text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 rounded px-1.5 py-0.5 disabled:opacity-50"
        >
          Refund
        </button>
      )}
    </span>
  );
};

export const RefundStatusBox = ({ info }) => {
  const ui = info && REFUND_STATE_UI[info.state];
  if (!ui) return null;
  const Icon = ui.icon;
  return (
    <div data-testid="refund-status-box" className={`rounded-xl p-4 border ${ui.cls}`}>
      <p className="text-xs font-semibold mb-1 flex items-center gap-1.5"><Icon className="h-4 w-4" /> PRC Refund Status: {ui.label}</p>
      <p className="text-sm">
        {info.state === 'refunded' && `${fmt(info.amount)} PRC returned to user${info.refunded_at ? ` on ${new Date(info.refunded_at).toLocaleString('en-IN')}` : ''}.`}
        {info.state === 'missing' && `${fmt(info.amount)} PRC was deducted and has NOT been returned yet.`}
        {info.state === 'review' && `Marked refunded but ledger does not match (${fmt(info.amount)} PRC). Check manually.`}
        {info.state === 'not_deducted' && 'No PRC was deducted for this request, nothing to refund.'}
        {info.state === 'eko_refund_pending' && `${fmt(info.amount)} PRC is held until the Eko refund (customer OTP) completes.`}
        {info.state === 'legacy_copy' && 'Archived copy of another record. Check the original transaction for refund status.'}
      </p>
      {(info.ledger_debits > 0 || info.ledger_credits > 0) && (
        <p className="text-[11px] mt-1 opacity-80">Ledger: debited {fmt(info.ledger_debits)} · credited {fmt(info.ledger_credits)}</p>
      )}
    </div>
  );
};
