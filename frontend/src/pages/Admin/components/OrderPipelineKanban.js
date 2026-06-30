/**
 * OrderPipelineKanban — Admin Kanban board for Mall bookings.
 * Columns: Booked → Confirmed → Packed → Shipped → Delivered
 * Each card click opens the status-advance dialog using
 * PATCH /mall/v2/admin/booking/{booking_id}/status.
 */
import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { RefreshCw, X, ChevronRight, Package, MapPin, Phone } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const COL_META = {
  Booked:    { color: 'border-slate-300', dot: 'bg-slate-500',   chip: 'bg-slate-100 text-slate-700' },
  Confirmed: { color: 'border-amber-300', dot: 'bg-amber-500',   chip: 'bg-amber-100 text-amber-800' },
  Packed:    { color: 'border-violet-300',dot: 'bg-violet-500',  chip: 'bg-violet-100 text-violet-800' },
  Shipped:   { color: 'border-sky-300',   dot: 'bg-sky-500',     chip: 'bg-sky-100 text-sky-800' },
  Delivered: { color: 'border-emerald-300',dot: 'bg-emerald-500',chip: 'bg-emerald-100 text-emerald-800' },
};

export default function OrderPipelineKanban() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null); // { booking, currentLabel }
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');

  const fetchPipeline = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const r = await axios.get(`${API}/mall/v2/admin/pipeline?limit=300`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPipeline(); }, []);

  const advance = async (newLabel) => {
    if (!active?.booking?.booking_id) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API}/mall/v2/admin/booking/${active.booking.booking_id}/status`,
        { label: newLabel, note: note.trim() || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Moved to ${newLabel}`);
      setActive(null);
      setNote('');
      fetchPipeline();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-10 text-slate-500" data-testid="admin-pipeline-loading">
        <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2" />
        Loading order pipeline…
      </div>
    );
  }
  if (!data || !data.success) return null;

  const labels = data.labels || ['Booked', 'Confirmed', 'Packed', 'Shipped', 'Delivered'];

  return (
    <div data-testid="admin-pipeline-root">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-slate-500">
          Click any card to advance its pipeline status. Stats are live.
        </div>
        <button
          className="text-xs px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 flex items-center gap-1"
          onClick={fetchPipeline}
          data-testid="admin-pipeline-refresh"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      <div className="overflow-x-auto pb-3">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(220px, 1fr))` }}>
          {labels.map((label) => {
            const items = data.columns?.[label] || [];
            const meta = COL_META[label] || COL_META.Booked;
            return (
              <div
                key={label}
                className={`bg-slate-50 rounded-xl border-t-4 ${meta.color} flex flex-col min-h-[320px]`}
                data-testid={`admin-pipeline-col-${label}`}
              >
                <div className="p-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                    <span className="font-bold text-sm text-slate-800">{label}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${meta.chip}`} data-testid={`admin-pipeline-count-${label}`}>
                    {items.length}
                  </span>
                </div>
                <div className="p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 520 }}>
                  {items.length === 0 && (
                    <div className="text-[11px] text-slate-400 text-center py-6">
                      No bookings here.
                    </div>
                  )}
                  {items.map((b) => (
                    <button
                      key={b.booking_id}
                      onClick={() => setActive({ booking: b, currentLabel: label })}
                      className="w-full text-left bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded-lg p-3 transition"
                      data-testid={`admin-pipeline-card-${b.booking_id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-slate-800 text-xs leading-snug line-clamp-2">
                          {b.product_name}
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 tabular-nums">
                          {b.progress_percent}%
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {b.user_name || 'Unknown'}
                      </div>
                      {b.user_mobile && (
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-2.5 h-2.5" /> {b.user_mobile}
                        </div>
                      )}
                      {b.delivery?.pin_code && (
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-2.5 h-2.5" /> {b.delivery.pin_code}
                          {b.delivery.city ? ` · ${b.delivery.city}` : ''}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 mt-1">
                        {b.upfront_prc?.toLocaleString('en-IN')} PRC upfront
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advance dialog */}
      {active && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4" onClick={() => setActive(null)}>
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            data-testid="admin-pipeline-dialog"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Booking</div>
                <h3 className="font-bold text-slate-800">{active.booking.product_name}</h3>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Current: <b>{active.currentLabel}</b> · {active.booking.user_name}
                </div>
              </div>
              <button onClick={() => setActive(null)}><X className="w-5 h-5" /></button>
            </div>

            {active.booking.delivery?.address_line && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 text-[12px] text-slate-700">
                <div className="font-bold flex items-center gap-1 mb-1">
                  <MapPin className="w-3 h-3" /> Delivery Address
                </div>
                <div>{active.booking.delivery.name} · {active.booking.delivery.mobile}</div>
                <div>{active.booking.delivery.address_line}</div>
                <div>
                  {active.booking.delivery.city || ''} {active.booking.delivery.state || ''} · {active.booking.delivery.pin_code}
                </div>
                {active.booking.delivery.landmark && (
                  <div className="text-slate-500">Landmark: {active.booking.delivery.landmark}</div>
                )}
              </div>
            )}

            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Note (optional)</div>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. AWB 8765432 · Bluedart"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm mb-3"
              data-testid="admin-pipeline-note"
            />

            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Move to</div>
            <div className="grid grid-cols-2 gap-2">
              {labels.map((lbl) => {
                const meta = COL_META[lbl] || COL_META.Booked;
                const isCurrent = lbl === active.currentLabel;
                return (
                  <button
                    key={lbl}
                    disabled={isCurrent || submitting}
                    onClick={() => advance(lbl)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm font-semibold transition
                      ${isCurrent ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50' :
                                    'bg-white hover:bg-slate-50 border-slate-300'}`}
                    data-testid={`admin-pipeline-move-${lbl}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                      {lbl}
                    </span>
                    {!isCurrent && <ChevronRight className="w-4 h-4 text-slate-400" />}
                    {isCurrent && <span className="text-[9px] text-slate-400 uppercase">Current</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
